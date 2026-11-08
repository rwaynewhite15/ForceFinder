// Render one 1280x720 PNG per frame: map (d3-geo SVG) + facts panel + caption.
// Usage: node render_frames.js frames.json outdir
//   frames.json = { "scenes": {...}, "frames": [{ scene, speaker, text, dateLabel, sources? }] }
const fs = require("fs"), path = require("path");
const topojson = require("topojson-client");
const d3 = require("d3-geo");
const { chromium } = require("playwright");

const [framesPath, outDir] = process.argv.slice(2);
const { scenes, frames } = JSON.parse(fs.readFileSync(framesPath, "utf8"));
const world = JSON.parse(fs.readFileSync(path.join(__dirname, "node_modules/world-atlas/countries-50m.json"), "utf8"));
const countries = topojson.feature(world, world.objects.countries).features;

const MAP_W = 800, MAP_H = 560;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const KIND = { group: "#ff5d73", event: "#ffcc00", us: "#4fa3ff" };

function mapSvg(scene) {
  const [[w, n], [e, s]] = scene.bbox;
  const box = { type: "Feature", geometry: { type: "MultiPoint", coordinates: [[w, n], [e, s], [w, s], [e, n]] } };
  const proj = d3.geoMercator().fitExtent([[20, 20], [MAP_W - 20, MAP_H - 20]], box);
  const pathGen = d3.geoPath(proj);
  const focus = new Set(scene.focus);
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${MAP_W}" height="${MAP_H}" viewBox="0 0 ${MAP_W} ${MAP_H}">`;
  out += `<rect width="100%" height="100%" fill="#0e2233"/>`;
  out += `<path d="${pathGen({ type: "Sphere" }) || ""}" fill="#0e2233"/>`;
  for (const f of countries) {
    const d = pathGen(f);
    if (!d) continue;
    const on = focus.has(f.id);
    out += `<path d="${d}" fill="${on ? "#d9822b" : "#2b3a48"}" stroke="${on ? "#ffd08a" : "#4a5a6a"}" stroke-width="${on ? 1.2 : 0.5}"/>`;
  }
  // markers, with simple label placement that alternates sides to limit overlap
  scene.markers.forEach((m, i) => {
    const p = proj([m.lon, m.lat]);
    if (!p) return;
    const [x, y] = p;
    const c = KIND[m.kind] || "#fff";
    const right = x < MAP_W - 260;
    let lx = right ? x + 12 : x - 12, anchor = right ? "start" : "end";
    let ly = y + 5 + (i % 2 ? 14 : -4);
    if (m.lab) { lx = x + m.lab[0]; ly = y + m.lab[1]; anchor = m.lab[2]; }
    out += `<circle cx="${x}" cy="${y}" r="7" fill="${c}" stroke="#0b0e12" stroke-width="2"/>`;
    out += `<text x="${lx}" y="${ly}" text-anchor="${anchor}" font-family="DejaVu Sans" font-size="15" font-weight="bold" fill="#fff" stroke="#0b0e12" stroke-width="4" paint-order="stroke">${esc(m.name)}</text>`;
  });
  return out + "</svg>";
}

function html(frame) {
  const sc = scenes[frame.scene];
  const facts = sc.facts.map((f) => `<li>${esc(f)}</li>`).join("");
  const legend = sc.markers.length ? `<div class="legend"><span><i style="background:${KIND.group}"></i>armed group / prison</span><span><i style="background:${KIND.event}"></i>event / place</span>${sc.markers.some((m) => m.kind === "us") ? `<span><i style="background:${KIND.us}"></i>US</span>` : ""}</div>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box} body{margin:0;width:1280px;height:720px;background:#0b1118;color:#e6e9ef;font-family:"DejaVu Sans",sans-serif;overflow:hidden;position:relative}
  .top{position:absolute;top:0;left:0;right:0;height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 24px;background:#111a24;border-bottom:1px solid #22303e;font-size:14px;letter-spacing:1.5px;color:#9aa3b2}
  .top b{color:#e6e9ef} .map{position:absolute;top:56px;left:20px;width:800px;height:560px;border-radius:8px;overflow:hidden;border:1px solid #22303e}
  .panel{position:absolute;top:56px;left:836px;right:20px;height:560px;padding:6px 4px}
  h1{margin:0 0 4px;font-size:34px} .kicker{color:#ffb35c;font-size:16px;margin-bottom:14px}
  ul{margin:0;padding-left:20px} li{font-size:17px;line-height:1.35;margin-bottom:10px}
  .legend{position:absolute;bottom:4px;left:4px;font-size:12px;color:#9aa3b2;display:flex;flex-direction:column;gap:4px}
  .legend i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px}
  .cap{position:absolute;left:20px;right:20px;bottom:12px;height:92px;background:rgba(17,26,36,.96);border:1px solid #22303e;border-radius:8px;padding:10px 16px;display:flex;gap:14px;align-items:center}
  .who{flex:0 0 74px;height:74px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:15px;color:#0b0e12}
  .txt{font-size:19px;line-height:1.3}
  .src{position:absolute;inset:56px 20px 120px 20px;background:#0b1118;padding:10px 6px} .src h1{font-size:30px} .src li{font-size:16px;margin-bottom:6px}
  </style></head><body>
  <div class="top"><span><b>FORCEFINDER</b> · WESTERN HEMISPHERE BRIEFING</span><span>${esc(frame.dateLabel)} · AI-generated from open-source reporting</span></div>
  ${frame.sources ? `<div class="src"><h1>Sources</h1><ul>${frame.sources.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>` : `
  <div class="map">${mapSvg(sc)}</div>
  <div class="panel"><h1>${esc(sc.title)}</h1><div class="kicker">${esc(sc.kicker)}</div><ul>${facts}</ul>${legend}</div>`}
  <div class="cap"><div class="who" style="background:${frame.speaker === "Avery" ? "#7fd1ae" : "#8fb8ff"}">${esc(frame.speaker || "")}</div><div class="txt">${esc(frame.text || "")}</div></div>
  </body></html>`;
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  for (const [i, fr] of frames.entries()) {
    await page.setContent(html(fr), { waitUntil: "load" });
    await page.screenshot({ path: path.join(outDir, `f${String(i).padStart(3, "0")}.png`) });
  }
  await browser.close();
  console.log(`rendered ${frames.length} frames`);
})();
