// Refreshes data/events.js and data/naval.js using Claude with web search.
//
// Two steps per dataset:
//   1. Research: Claude searches the web and writes notes with source URLs.
//   2. Extract:  a second call turns the notes into JSON matching a strict schema.
// The script then validates everything in code. In particular, every source URL
// must have appeared in the research step's search or fetch results (or in the
// existing data), so events cannot be backed by invented links.
//
// Usage: ANTHROPIC_API_KEY=... node update.mjs [--dry-run]

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EVENTS_FILE = path.join(ROOT, "data/events.js");
const NAVAL_FILE = path.join(ROOT, "data/naval.js");

const MODEL = process.env.FF_MODEL || "claude-opus-5-5";
const EFFORT = process.env.FF_EFFORT || "medium";
const EVENT_WINDOW_DAYS = 21; // events older than this are dropped
const MAX_EVENTS = 60;
const MIN_EVENTS = 5; // fewer than this after validation means something went wrong: don't write
const DAY_MS = 86400000;

const EVENT_TYPES = ["strike", "missile", "drone", "naval", "ground", "exercise", "diplomacy"];
const CONFIDENCE = ["high", "medium", "low"];

// ---------------------------------------------------------------- schemas

const Source = z.object({ label: z.string(), url: z.string() });

export const EventSchema = z.object({
  events: z.array(z.object({
    date: z.string().describe("YYYY-MM-DD, the day the event happened"),
    title: z.string().describe("Short headline, under 70 characters"),
    type: z.enum(EVENT_TYPES),
    conflict: z.string().describe("Conflict name, reusing existing names where they fit"),
    lat: z.number(),
    lon: z.number(),
    d: z.string().describe("One or two factual sentences; attribute claims to who made them"),
    src: z.array(Source).describe("Sources; URLs must come from the research notes or existing data"),
    from: z.object({ lat: z.number(), lon: z.number() }).nullable()
      .describe("Approximate launch area for long-range strikes when reported, else null"),
  })),
});

export const NavalSchema = z.object({
  as_of: z.string().describe("YYYY-MM-DD date of the newest report used"),
  ships: z.array(z.object({
    n: z.string().describe("Ship name exactly as in the existing data"),
    lat: z.number(),
    lon: z.number(),
    conf: z.enum(CONFIDENCE),
    status: z.string(),
    area: z.string(),
    d: z.string(),
  })),
  sources: z.array(Source),
});

// ---------------------------------------------------------------- data files

export function loadDataFile(file) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox.window;
}

const GENERATED_NOTE = "// Updated automatically by scripts/update-data (GitHub Action). Manual edits are kept\n" +
  "// only if the next run carries them forward, so prefer changing the updater's prompts.\n";

function writeEventsFile(asOf, events) {
  const body = `${GENERATED_NOTE}//
// Recent conflict events compiled from public news reporting. Locations are
// approximate (town, district or sea area named in the report), and casualty
// figures are as first reported. Follow the source link for details.
//
// Fields: date (YYYY-MM-DD), title, type, conflict, lat, lon, d = summary,
//         src = [{ label, url }], from = optional [lat, lon] approximate launch
//         direction drawn as an arc.
// Types: ${EVENT_TYPES.join(", ")}
window.FF_EVENTS_AS_OF = ${JSON.stringify(asOf)};

window.FF_EVENTS = ${JSON.stringify(events, null, 2)};
`;
  fs.writeFileSync(EVENTS_FILE, body);
}

function writeNavalFile(asOf, sources, ships) {
  const body = `${GENERATED_NOTE}//
// Approximate positions of US aircraft carriers and big-deck amphibious ships,
// compiled from public open-source reporting (USNI News Fleet & Marine Tracker,
// TWZ and others). Ships at sea are placed at a representative point in the
// reported body of water, not a real-time fix.
//
// confidence: high   = in port / reported at a named location
//             medium = reported in a named sea or exercise area
//             low    = not covered by recent reporting; shown at homeport/yard
// w = Wikipedia article title, used to fetch the ship's photo.
window.FF_NAVAL_AS_OF = ${JSON.stringify(asOf)};
window.FF_NAVAL_SOURCES = ${JSON.stringify(sources, null, 2)};

window.FF_NAVAL = ${JSON.stringify(ships, null, 2)};
`;
  fs.writeFileSync(NAVAL_FILE, body);
}

// ---------------------------------------------------------------- Claude calls

const RESEARCH_SYSTEM = `You are an open-source intelligence researcher maintaining a public map of
military activity built only from published news reporting. Search the web, read the most
relevant reports, and write concise research notes. Be factual and neutral: attribute claims
to whoever made them ("Ukraine's General Staff said...", "CENTCOM said..."), and note when
parties dispute an account. Prefer wire services, major outlets, official statements and
established trackers (USNI News, ISW/CTP, UKMTO). Every fact in your notes must be followed
by the full URL of the page it came from. Do not include anything you could not find a
source for.`;

// Search/fetch caps per dataset keep the daily cost bounded (web search is billed per search).
const SEARCH_LIMITS = { events: { search: 15, fetch: 6 }, naval: { search: 8, fetch: 4 } };

function researchTools(label) {
  const lim = SEARCH_LIMITS[label];
  return [
    { type: "web_search_20260209", name: "web_search", max_uses: lim.search },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: lim.fetch },
  ];
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function collectUrls(content, into) {
  const add = (url) => { const n = normalizeUrl(url); if (n) into.add(n); };
  for (const block of content) {
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const r of block.content) if (r.url) add(r.url);
    } else if (block.type === "web_fetch_tool_result" && block.content && block.content.url) {
      add(block.content.url);
    } else if (block.type === "text" && Array.isArray(block.citations)) {
      for (const c of block.citations) if (c.url) add(c.url);
    }
  }
}

function logUsage(label, usage) {
  const searches = usage.server_tool_use?.web_search_requests ?? 0;
  console.log(`[${label}] input ${usage.input_tokens}, output ${usage.output_tokens}, ` +
    `cache read ${usage.cache_read_input_tokens ?? 0}, web searches ${searches}`);
}

// Step 1: research with web search. Returns the notes and every URL Claude actually saw.
async function research(client, label, prompt) {
  const messages = [{ role: "user", content: prompt }];
  const urls = new Set();
  let notes = "";
  for (let turn = 0; turn < 8; turn++) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: EFFORT },
      system: RESEARCH_SYSTEM,
      tools: researchTools(label),
      messages,
    });
    const msg = await stream.finalMessage();
    logUsage(`${label} research`, msg.usage);
    if (msg.stop_reason === "refusal") throw new Error(`${label} research was declined: ${msg.stop_details?.explanation ?? "no details"}`);
    collectUrls(msg.content, urls);
    for (const block of msg.content) if (block.type === "text") notes += block.text;
    // A long server-side tool loop pauses; send the turn back unchanged to resume it.
    if (msg.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: msg.content });
  }
  if (!notes.trim()) throw new Error(`${label} research returned no notes`);
  return { notes, urls };
}

// Step 2: turn research notes into schema-valid JSON (no tools, so structured output applies cleanly).
async function extract(client, label, schema, prompt) {
  const msg = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: EFFORT, format: betaZodOutputFormat(schema) },
    messages: [{ role: "user", content: prompt }],
  });
  logUsage(`${label} extract`, msg.usage);
  if (msg.stop_reason === "refusal") throw new Error(`${label} extraction was declined`);
  if (msg.stop_reason === "max_tokens") throw new Error(`${label} extraction hit max_tokens`);
  if (!msg.parsed_output) throw new Error(`${label} extraction returned no parsable output`);
  return msg.parsed_output;
}

// ---------------------------------------------------------------- validation

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const validCoord = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

function knownUrlsFrom(records, key = "src") {
  const urls = new Set();
  for (const r of records) for (const s of r[key] || []) { const n = normalizeUrl(s.url); if (n) urls.add(n); }
  return urls;
}

function filterSources(src, allowed) {
  const seen = new Set();
  const out = [];
  for (const s of src || []) {
    const n = normalizeUrl(s.url);
    if (!n || !allowed.has(n) || seen.has(n)) continue;
    seen.add(n);
    out.push({ label: String(s.label || new URL(s.url).hostname).trim(), url: s.url });
  }
  return out;
}

export function validateEvents(raw, allowedUrls, today) {
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  const seen = new Set();
  const out = [];
  const dropped = [];
  for (const e of raw) {
    const why = [];
    if (!isDate(e.date)) why.push("bad date");
    else {
      const t = Date.parse(`${e.date}T00:00:00Z`);
      if (t > todayMs) why.push("future date");
      if (todayMs - t > EVENT_WINDOW_DAYS * DAY_MS) why.push("too old");
    }
    if (!EVENT_TYPES.includes(e.type)) why.push("bad type");
    if (!validCoord(e.lat, e.lon)) why.push("bad coordinates");
    if (!e.title?.trim() || !e.conflict?.trim() || !e.d?.trim()) why.push("missing text");
    const src = filterSources(e.src, allowedUrls);
    if (!src.length) why.push("no verifiable source URL");
    const key = `${e.date}|${(e.title || "").toLowerCase().trim()}`;
    if (seen.has(key)) why.push("duplicate");
    if (why.length) { dropped.push(`${e.title} (${why.join(", ")})`); continue; }
    seen.add(key);
    const rec = {
      date: e.date, title: e.title.trim(), type: e.type, conflict: e.conflict.trim(),
      lat: Math.round(e.lat * 1000) / 1000, lon: Math.round(e.lon * 1000) / 1000, d: e.d.trim(), src,
    };
    const from = Array.isArray(e.from) ? { lat: e.from[0], lon: e.from[1] } : e.from;
    if (from && validCoord(from.lat, from.lon)) rec.from = [from.lat, from.lon];
    out.push(rec);
  }
  out.sort((a, b) => b.date.localeCompare(a.date) || a.conflict.localeCompare(b.conflict));
  return { events: out.slice(0, MAX_EVENTS), dropped };
}

export function validateNaval(raw, existing, allowedUrls, today) {
  const byName = new Map(raw.ships.map((s) => [s.n, s]));
  const changed = [];
  const ships = existing.map((old) => {
    const s = byName.get(old.n);
    if (!s || !validCoord(s.lat, s.lon) || !CONFIDENCE.includes(s.conf) || !s.status?.trim() || !s.area?.trim()) {
      return old; // keep the previous entry rather than lose a ship
    }
    const next = { ...old, lat: Math.round(s.lat * 1000) / 1000, lon: Math.round(s.lon * 1000) / 1000,
      conf: s.conf, status: s.status.trim(), area: s.area.trim(), d: s.d.trim() || old.d };
    if (next.lat !== old.lat || next.lon !== old.lon || next.status !== old.status) changed.push(old.n);
    return next;
  });
  const sources = filterSources(raw.sources, allowedUrls);
  const asOf = isDate(raw.as_of) && raw.as_of <= today ? raw.as_of : today;
  return { ships, sources, asOf, changed };
}

// ---------------------------------------------------------------- prompts

function eventsResearchPrompt(today, existing) {
  const conflicts = [...new Set(existing.map((e) => e.conflict))].join("; ");
  const known = existing.map((e) => `- ${e.date} | ${e.conflict} | ${e.title}`).join("\n");
  return `Today is ${today}. Find notable military and conflict events from the last 7 days
(prioritise the last 3 days) for a public conflict map.

Cover these ongoing conflicts: ${conflicts}. Also include any other major armed conflict or
military confrontation in the news that involves state militaries or affects US forces.

For each event, give: the date it happened; the specific place (town, district, base, port or
sea area) so it can be mapped; what happened in one or two sentences, attributing claims; the
kind of event (strike, missile attack, drone attack, naval incident, ground fighting or troop
movement, military exercise, diplomacy/talks); and the full URL of each source. For long-range
missile or drone attacks, note the approximate launch area if reported.

Aim for roughly 10-25 significant new events. Skip events already on the map:
${known || "(none)"}`;
}

function eventsExtractPrompt(today, existing, notes) {
  return `Today is ${today}. Update the conflict-event list for a public map.

Return the complete updated list: every existing event dated within the last ${EVENT_WINDOW_DAYS}
days (unchanged unless the notes correct it), plus each new event from the research notes.
Rules:
- Use only facts and URLs that appear in the research notes or the existing data. Never invent a URL.
- One event per distinct incident; merge duplicates and keep all their sources.
- Coordinates: the place named in the reporting, in decimal degrees (approximate is fine). For a
  sea area, use a point in that sea.
- Reuse existing conflict names where they fit (${[...new Set(existing.map((e) => e.conflict))].join(", ")}).
- Source labels: the outlet name, e.g. "Reuters" or "ISW/CTP assessment, Oct 29".
- "from": approximate launch area only when the notes report one, else null.

Existing events (JSON):
${JSON.stringify(existing)}

Research notes:
${notes}`;
}

function navalResearchPrompt(today, ships) {
  return `Today is ${today}. Find the latest publicly reported status and location of each of these
US Navy ships: ${ships.map((s) => s.n).join("; ")}.

Start with the most recent USNI News "Fleet and Marine Tracker" (published weekly) and TWZ's
"Where Are The Aircraft Carriers?" series, then fill gaps with other reporting. For each ship
note: status (deployed, underway for training, in port, in maintenance...), the named port or
body of water, the date of the report, and the source URL. Say plainly when you find nothing
recent for a ship.`;
}

function navalExtractPrompt(today, ships, notes) {
  return `Today is ${today}. Update the ship positions for a public map using the research notes.

Return one entry for every ship in the existing data, using its exact "n" name.
- In port or at a named facility: that facility's coordinates, conf "high".
- At sea in a named body of water or exercise area: a representative point in it, conf "medium".
- Not covered by the notes: keep the existing position, status and area, conf "low"
  (or the existing conf if the existing entry is already newer than the notes).
- status: short phrase; area: place name; d: one or two sentences with the reported detail.
- as_of: date of the newest report used. sources: the reports used (label + URL from the notes only).

Existing ships (JSON):
${JSON.stringify(ships.map(({ n, lat, lon, conf, status, area, d }) => ({ n, lat, lon, conf, status, area, d })))}

Research notes:
${notes}`;
}

// ---------------------------------------------------------------- main

export async function updateEvents(client, today) {
  const { FF_EVENTS: existing = [] } = loadDataFile(EVENTS_FILE);
  const { notes, urls } = await research(client, "events", eventsResearchPrompt(today, existing));
  const raw = await extract(client, "events", EventSchema, eventsExtractPrompt(today, existing, notes));
  const allowed = new Set([...urls, ...knownUrlsFrom(existing)]);
  const { events, dropped } = validateEvents(raw.events, allowed, today);
  for (const d of dropped) console.log(`  dropped event: ${d}`);
  if (events.length < MIN_EVENTS) throw new Error(`only ${events.length} valid events; not writing`);
  const before = new Set(existing.map((e) => `${e.date}|${e.title}`));
  const added = events.filter((e) => !before.has(`${e.date}|${e.title}`));
  console.log(`events: ${events.length} total, ${added.length} new, ${dropped.length} dropped`);
  return { write: () => writeEventsFile(today, events), summary: `${added.length} new events` };
}

export async function updateNaval(client, today) {
  const data = loadDataFile(NAVAL_FILE);
  const existing = data.FF_NAVAL || [];
  const { notes, urls } = await research(client, "naval", navalResearchPrompt(today, existing));
  const raw = await extract(client, "naval", NavalSchema, navalExtractPrompt(today, existing, notes));
  const allowed = new Set([...urls, ...knownUrlsFrom(data.FF_NAVAL_SOURCES ? [{ src: data.FF_NAVAL_SOURCES }] : [])]);
  const { ships, sources, asOf, changed } = validateNaval(raw, existing, allowed, today);
  if (!sources.length) throw new Error("no verifiable naval sources; not writing");
  console.log(`naval: ${changed.length} ships changed (${changed.join(", ") || "none"}), as of ${asOf}`);
  return { write: () => writeNavalFile(asOf, sources, ships), summary: `${changed.length} ships moved` };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const today = new Date().toISOString().slice(0, 10);
  const client = new Anthropic();
  // Run both datasets in parallel; one failing doesn't block the other.
  const results = await Promise.allSettled([updateEvents(client, today), updateNaval(client, today)]);
  let failures = 0;
  for (const [i, r] of results.entries()) {
    const name = i === 0 ? "events" : "naval";
    if (r.status === "rejected") {
      failures++;
      console.error(`${name} update failed: ${r.reason?.stack || r.reason}`);
    } else if (!dryRun) {
      r.value.write();
      console.log(`${name}: wrote ${r.value.summary}`);
    }
  }
  if (failures === results.length) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
