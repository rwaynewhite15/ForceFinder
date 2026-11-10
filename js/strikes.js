/* ForceFinder — strike archive: nearest-city features, chart builder and CSV export. */
(() => {
  "use strict";
  const STRIKES = window.FF_STRIKES || [], CITIES = window.FF_CITIES || [];
  const $ = (id) => document.getElementById(id);
  if (!STRIKES.length || !$("strike-modal")) return;

  const DATA_KEY = "ff-strike-dataset", PREFS_KEY = "ff-strike-prefs";
  const NONE = "(not near a listed city)", AT_SEA = "Commercial shipping";

  // ------------------------------------------------------------ dataset
  function km(aLat, aLon, bLat, bLon) {
    const r = Math.PI / 180, dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  }
  function weekOf(iso) {  // Monday of that week
    const d = new Date(iso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  }
  const rows = STRIKES.map((s) => {
    let best = null, bestKm = Infinity;
    for (const c of CITIES) {
      const d = km(s.lat, s.lon, c.lat, c.lon);
      if (d < bestKm) { bestKm = d; best = c; }
    }
    return {
      ...s,
      week: weekOf(s.date),
      city: best ? best.n : "", city_country: best ? best.cc : "", city_pop: best ? best.pop : null,
      dist_km: best ? Math.round(bestKm) : null,
    };
  });
  // Keep the enriched dataset in this browser session so other scripts or the console can use it.
  try { sessionStorage.setItem(DATA_KEY, JSON.stringify({ asOf: window.FF_STRIKES_AS_OF, rows })); } catch { /* storage unavailable */ }

  const CSV_COLS = [
    ["id", "id"], ["date", "date"], ["conflict", "conflict"], ["weapon", "weapon"], ["fired_by", "by"],
    ["target", "target"], ["outcome", "outcome"], ["killed", "killed"], ["injured", "injured"],
    ["lat", "lat"], ["lon", "lon"], ["nearest_city", "city"], ["city_country", "city_country"],
    ["city_population", "city_pop"], ["distance_to_city_km", "dist_km"], ["title", "title"],
    ["summary", "d"], ["source_url", "src"],
  ];
  function toCsv(list) {
    const cell = (v) => {
      if (v === null || v === undefined) return "";
      const t = String(v);
      return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    return [CSV_COLS.map((c) => c[0]).join(","), ...list.map((r) => CSV_COLS.map((c) => cell(r[c[1]])).join(","))].join("\r\n") + "\r\n";
  }
  function download(list, name) {
    const url = URL.createObjectURL(new Blob(["﻿" + toCsv(list)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ------------------------------------------------------------ state
  const GROUPS = {
    city: "Nearest city", by: "Who fired", target: "Target", conflict: "Conflict",
    weapon: "Weapon", outcome: "Outcome", date: "Day", week: "Week",
  };
  const MEASURES = { count: "Number of strikes", killed: "Reported killed", injured: "Reported injured" };
  const prefs = { group: "city", measure: "count", top: "15", radius: "50", conflict: "", by: "", weapon: "", outcome: "", from: "", to: "" };
  try { Object.assign(prefs, JSON.parse(sessionStorage.getItem(PREFS_KEY) || "{}")); } catch { /* ignore */ }
  let picked = null;  // group value chosen by clicking a bar

  function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v; else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v);
    }
    n.append(...kids);
    return n;
  }
  const fmt = (n) => n.toLocaleString("en-US");
  const fmtDay = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  function filtered() {
    return rows.filter((r) =>
      (!prefs.conflict || r.conflict === prefs.conflict) && (!prefs.by || r.by === prefs.by) &&
      (!prefs.weapon || r.weapon === prefs.weapon) && (!prefs.outcome || r.outcome === prefs.outcome) &&
      (!prefs.from || r.date >= prefs.from) && (!prefs.to || r.date <= prefs.to));
  }
  function groupKey(r) {
    if (prefs.group !== "city") return r[prefs.group];
    const lim = prefs.radius === "any" ? Infinity : +prefs.radius;
    // Attacks on ships at sea aren't strikes on the nearest port, so they never count toward a city.
    return r.target !== AT_SEA && r.dist_km !== null && r.dist_km <= lim ? `${r.city}, ${r.city_country}` : NONE;
  }
  function value(r) { return prefs.measure === "count" ? 1 : (r[prefs.measure] || 0); }

  // ------------------------------------------------------------ rendering
  const tip = $("sm-tip");
  function showTip(e, html) {
    tip.innerHTML = html; tip.hidden = false;
    const box = $("strike-modal").getBoundingClientRect();
    tip.style.left = Math.min(e.clientX + 14, box.right - tip.offsetWidth - 8) + "px";
    tip.style.top = (e.clientY + 14) + "px";
  }
  const hideTip = () => { tip.hidden = true; };

  function tipHtml(label, list) {
    const k = list.reduce((a, r) => a + (r.killed || 0), 0), w = list.reduce((a, r) => a + (r.injured || 0), 0);
    return `<b>${label.replace(/</g, "&lt;")}</b><br>${fmt(list.length)} strike${list.length === 1 ? "" : "s"} · ${fmt(k)} killed · ${fmt(w)} injured`;
  }

  function renderChart(list) {
    const chart = $("sm-chart"), note = $("sm-note");
    chart.replaceChildren();
    const groups = new Map();
    for (const r of list) {
      const k = groupKey(r);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    const timeline = prefs.group === "date" || prefs.group === "week";
    let far = 0;
    if (prefs.group === "city" && groups.has(NONE)) { far = groups.get(NONE).length; groups.delete(NONE); }
    let items = [...groups].map(([k, g]) => ({ k, g, v: g.reduce((a, r) => a + value(r), 0) }));
    if (!items.length) {
      $("sm-chart-title").textContent = `${MEASURES[prefs.measure]} by ${GROUPS[prefs.group].toLowerCase()}`;
      note.textContent = "";
      chart.append(el("p", { class: "meta" }, "No strikes match these filters."));
      return;
    }
    if (timeline) {
      items.sort((a, b) => (a.k < b.k ? -1 : 1));
      // Fill empty days or weeks with zero so the time axis has no hidden gaps.
      const stepDays = prefs.group === "week" ? 7 : 1, have = new Map(items.map((i) => [i.k, i])), full = [];
      for (let d = new Date(items[0].k + "T00:00:00Z"), end = items[items.length - 1].k; ; d.setUTCDate(d.getUTCDate() + stepDays)) {
        const k = d.toISOString().slice(0, 10);
        if (k > end) break;
        full.push(have.get(k) || { k, g: [], v: 0 });
      }
      items = full;
    }
    else {
      items.sort((a, b) => b.v - a.v || (a.k < b.k ? -1 : 1));
      if (prefs.measure !== "count") items = items.filter((i) => i.v > 0);
      if (prefs.top !== "all") items = items.slice(0, +prefs.top);
    }
    $("sm-chart-title").textContent = `${MEASURES[prefs.measure]} by ${GROUPS[prefs.group].toLowerCase()}`;
    const notes = [];
    if (far) notes.push(`${far} strike${far === 1 ? " was" : "s were"} on ships at sea${prefs.radius === "any" ? "" : ` or more than ${prefs.radius} km from any listed city`} and ${far === 1 ? "is" : "are"} left out of this chart.`);
    if (prefs.measure !== "count") notes.push("Casualty totals count only strikes where a figure was reported, and many figures are unverified.");
    note.textContent = notes.join(" ");

    const max = Math.max(...items.map((i) => i.v), 1);
    const pick = (k) => { picked = picked === k ? null : k; render(); };

    if (timeline) {
      const wrap = el("div", { class: "sm-cols", role: "list" });
      const step = Math.ceil(items.length / 12);
      items.forEach((i, n) => {
        const label = prefs.group === "week" ? `Week of ${fmtDay(i.k)}` : fmtDay(i.k);
        const col = el("button", { class: "sm-col" + (picked === i.k ? " on" : ""), role: "listitem", "aria-label": `${label}: ${fmt(i.v)}`,
          onclick: () => pick(i.k), onmousemove: (e) => showTip(e, tipHtml(label, i.g)), onmouseleave: hideTip },
          el("span", { class: "sm-col-v" }, i.v === max || items.length <= 14 ? fmt(i.v) : ""),
          el("span", { class: "sm-col-bar", style: `height:${Math.max(i.v / max * 100, i.v ? 2 : 0)}%` }),
          el("span", { class: "sm-col-l" }, n % step === 0 ? fmtDay(i.k) : ""));
        wrap.append(col);
      });
      chart.append(wrap);
    } else {
      const wrap = el("div", { class: "sm-bars", role: "list" });
      for (const i of items) {
        wrap.append(el("button", { class: "sm-bar" + (picked === i.k ? " on" : ""), role: "listitem", "aria-label": `${i.k}: ${fmt(i.v)}`,
          onclick: () => pick(i.k), onmousemove: (e) => showTip(e, tipHtml(i.k, i.g)), onmouseleave: hideTip },
          el("span", { class: "sm-bar-l", title: i.k }, i.k),
          el("span", { class: "sm-bar-track" }, el("span", { class: "sm-bar-fill", style: `width:${Math.max(i.v / max * 100, 0.5)}%` })),
          el("span", { class: "sm-bar-v" }, fmt(i.v))));
      }
      chart.append(wrap);
    }
  }

  function flyTo(r) {
    const ff = window.ForceFinder;
    if (!ff || !window.Cesium) return;
    $("strike-modal").hidden = true;
    ff.viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(r.lon, r.lat, 600000), duration: 2 });
  }

  function renderTable(list) {
    const shown = picked === null ? list : list.filter((r) => groupKey(r) === picked);
    const sorted = [...shown].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const num = (v) => (v === null || v === undefined ? "–" : fmt(v));
    $("sm-rows").replaceChildren(...sorted.map((r) => el("tr", {},
      el("td", { class: "nw" }, fmtDay(r.date)),
      el("td", {}, el("button", { class: "sm-link", title: "Show on the globe", onclick: () => flyTo(r) }, r.title),
        " ", el("a", { href: r.src, target: "_blank", rel: "noopener", class: "sm-src" }, "source")),
      el("td", {}, r.by), el("td", {}, r.target), el("td", {}, r.weapon), el("td", {}, r.outcome),
      el("td", { class: "n" }, num(r.killed)), el("td", { class: "n" }, num(r.injured)),
      el("td", {}, r.city ? `${r.city} (${fmt(r.dist_km)} km)` : "–"))));
    const k = shown.reduce((a, r) => a + (r.killed || 0), 0);
    $("sm-table-title").textContent = picked === null
      ? `${fmt(shown.length)} strikes · ${fmt(k)} reported killed`
      : `${picked}: ${fmt(shown.length)} strikes · ${fmt(k)} reported killed`;
    $("sm-clear").hidden = picked === null;
    $("sm-dl-view").textContent = `Download these ${fmt(shown.length)} rows (.csv)`;
    $("sm-dl-view").onclick = () => download(sorted, `forcefinder-strikes-filtered-${window.FF_STRIKES_AS_OF}.csv`);
  }

  function render() {
    try { sessionStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
    const list = filtered();
    if (picked !== null && !list.some((r) => groupKey(r) === picked)) picked = null;
    $("sm-radius-row").hidden = prefs.group !== "city";
    $("sm-top-row").hidden = prefs.group === "date" || prefs.group === "week";
    renderChart(list);
    renderTable(list);
  }

  // ------------------------------------------------------------ controls
  function fill(id, key, options, allLabel) {
    const sel = $(id);
    sel.replaceChildren(...(allLabel ? [el("option", { value: "" }, allLabel)] : []),
      ...options.map(([v, t]) => el("option", { value: v }, t)));
    if (![...sel.options].some((o) => o.value === prefs[key])) prefs[key] = sel.options[0].value;
    sel.value = prefs[key];
    sel.addEventListener("change", () => { prefs[key] = sel.value; if (key !== "measure" && key !== "top") picked = null; render(); });
  }
  const uniq = (k) => [...new Set(rows.map((r) => r[k]))].sort().map((v) => [v, v]);
  fill("sm-group", "group", Object.entries(GROUPS));
  fill("sm-measure", "measure", Object.entries(MEASURES));
  fill("sm-top", "top", [["10", "Top 10"], ["15", "Top 15"], ["25", "Top 25"], ["all", "All"]]);
  fill("sm-radius", "radius", [["25", "25 km"], ["50", "50 km"], ["100", "100 km"], ["any", "Any distance"]]);
  fill("sm-conflict", "conflict", uniq("conflict"), "All conflicts");
  fill("sm-by", "by", uniq("by"), "Anyone");
  fill("sm-weapon", "weapon", uniq("weapon"), "All weapons");
  fill("sm-outcome", "outcome", uniq("outcome"), "All outcomes");
  const dates = rows.map((r) => r.date).sort(), first = dates[0], last = dates[dates.length - 1];
  for (const [id, key] of [["sm-from", "from"], ["sm-to", "to"]]) {
    const inp = $(id);
    inp.min = first; inp.max = last; inp.value = prefs[key];
    inp.addEventListener("change", () => { prefs[key] = inp.value; picked = null; render(); });
  }
  $("sm-clear").addEventListener("click", () => { picked = null; render(); });
  $("sm-dl-all").addEventListener("click", () => download(rows, `forcefinder-strikes-${window.FF_STRIKES_AS_OF}.csv`));
  $("strikes-dl").addEventListener("click", () => download(rows, `forcefinder-strikes-${window.FF_STRIKES_AS_OF}.csv`));

  const modal = $("strike-modal");
  const close = () => { modal.hidden = true; hideTip(); };
  $("strikes-open").addEventListener("click", () => { modal.hidden = false; render(); });
  $("sm-close").addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) close(); });

  const killed = rows.reduce((a, r) => a + (r.killed || 0), 0);
  $("strikes-meta").textContent = `${fmt(rows.length)} strikes since ${fmtDay(first)} · ${fmt(killed)} reported killed · as of ${window.FF_STRIKES_AS_OF}`;
  $("sm-sub").textContent = `${fmt(rows.length)} strikes and attacks from ${fmtDay(first)} to ${fmtDay(last)}, with the nearest of ${CITIES.length} listed cities worked out for each.`;
  $("strikes").hidden = false;
  window.ForceFinderStrikes = { rows, toCsv };
})();
