#!/usr/bin/env node
/* Checks data/strikes.csv and fills in the nearest-city columns.

   Usage: node tools/strikes_csv.js          (rewrites data/strikes.csv in place)
          node tools/strikes_csv.js --check  (validates only; exits 1 on problems)

   data/strikes.csv is the single source for the app's strike data. Add a row with the
   nearest_city, city_country, city_population and distance_to_city_km cells left empty, then
   run this script: it works them out from data/cities.js, sorts rows by date and id, and
   reports any malformed rows. */
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, ".."), FILE = path.join(ROOT, "data", "strikes.csv");
const COLS = ["id", "date", "conflict", "weapon", "fired_by", "target", "outcome", "killed", "injured", "lat", "lon",
  "nearest_city", "city_country", "city_population", "distance_to_city_km", "title", "summary", "source_url"];

function parse(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const esc = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
function km(aLat, aLon, bLat, bLon) {
  const r = Math.PI / 180, dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

const w = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "data", "cities.js"), "utf8"), { window: w });
const [head, ...body] = parse(fs.readFileSync(FILE, "utf8").replace(/^﻿/, ""));
const bad = [];
if (head.join() !== COLS.join()) bad.push("header must be: " + COLS.join(","));
const ids = new Set(), today = new Date().toISOString().slice(0, 10);
const recs = body.filter((r) => r.some((c) => c !== "")).map((r, n) => {
  const o = Object.fromEntries(COLS.map((c, i) => [c, (r[i] || "").trim()])), at = `row ${n + 2} (${o.id || "no id"})`;
  if (r.length !== COLS.length) bad.push(`${at}: expected ${COLS.length} cells, found ${r.length}`);
  if (!/^\d{8}-\d{2}$/.test(o.id) || ids.has(o.id)) bad.push(`${at}: id must be unique, like 20261110-01`);
  ids.add(o.id);
  if (!/^\d{4}-\d\d-\d\d$/.test(o.date) || o.date > today || o.id.slice(0, 8) !== o.date.replace(/-/g, "")) bad.push(`${at}: bad date, future date, or id not matching the date`);
  for (const c of ["conflict", "weapon", "fired_by", "target", "title", "summary"]) if (!o[c]) bad.push(`${at}: ${c} is empty`);
  if (!["hit", "intercepted", "claimed"].includes(o.outcome)) bad.push(`${at}: outcome must be hit, intercepted or claimed`);
  for (const c of ["killed", "injured"]) if (o[c] !== "" && !/^\d+$/.test(o[c])) bad.push(`${at}: ${c} must be empty or a whole number`);
  const lat = +o.lat, lon = +o.lon;
  if (o.lat === "" || o.lon === "" || !(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) bad.push(`${at}: bad lat/lon`);
  if (!/^https?:\/\//.test(o.source_url)) bad.push(`${at}: source_url must be an http(s) link`);
  let best = null, d = Infinity;
  for (const c of w.FF_CITIES) { const x = km(lat, lon, c.lat, c.lon); if (x < d) { d = x; best = c; } }
  if (best) Object.assign(o, { nearest_city: best.n, city_country: best.cc, city_population: String(best.pop), distance_to_city_km: String(Math.round(d)) });
  return o;
});
recs.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
if (bad.length) { console.error(bad.join("\n")); process.exit(1); }
const out = [COLS.join(","), ...recs.map((o) => COLS.map((c) => esc(o[c])).join(","))].join("\n") + "\n";
if (process.argv.includes("--check")) {
  if (out !== fs.readFileSync(FILE, "utf8")) { console.error("data/strikes.csv is out of date: run node tools/strikes_csv.js"); process.exit(1); }
  console.log(`${recs.length} rows OK`);
} else { fs.writeFileSync(FILE, out); console.log(`Wrote ${recs.length} rows`); }
