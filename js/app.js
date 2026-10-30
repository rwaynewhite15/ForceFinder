/* ForceFinder — 3D globe of approximate US military posture (open-source data). */
(() => {
  "use strict";

  const BRANCH_COLORS = {
    "Army": "#8fbf3a",
    "Navy": "#3d7bff",
    "Air Force": "#5ec8ff",
    "Marine Corps": "#e0453a",
    "Space Force": "#b48cff",
    "Joint": "#f2c14e",
  };
  const CATEGORY_LABELS = {
    ground: "Ground / garrison",
    air: "Air base",
    naval: "Naval base",
    space: "Space / missile defense / radar",
    hq: "Headquarters",
    access: "Rotational / host-nation site",
  };
  const SHIP_COLORS = { carrier: "#ff8c1a", amphib: "#ff4fa3" };
  const AIRCRAFT_COLOR = "#ffd23f";
  // Uncertainty radius (meters) drawn around ships, by confidence.
  const CONF_RADIUS = { high: 15000, medium: 250000, low: 500000 };
  const AIR_REFRESH_MS = 30000;
  // ICAO 24-bit address block allocated to US military aircraft.
  const US_MIL_HEX_MIN = 0xadf7c8, US_MIL_HEX_MAX = 0xafffff;
  const ADSB_ENDPOINTS = ["https://api.adsb.lol/v2/mil", "https://api.airplanes.live/v2/mil"];

  const BASES = window.FF_BASES || [];
  const NAVAL = window.FF_NAVAL || [];

  // ---------------------------------------------------------------- icons
  const iconCache = new Map();
  const iconSize = new Map(); // data URL -> CSS pixel size (canvases are drawn at 2x)

  function canvasIcon(key, size, draw) {
    if (iconCache.has(key)) return iconCache.get(key);
    const c = document.createElement("canvas");
    const dpr = 2;
    c.width = c.height = size * dpr;
    const g = c.getContext("2d");
    g.scale(dpr, dpr);
    draw(g, size);
    const url = c.toDataURL();
    iconCache.set(key, url);
    iconSize.set(url, size);
    return url;
  }

  function shapePath(g, category, s) {
    const m = s / 2, r = s / 2 - 2;
    g.beginPath();
    switch (category) {
      case "air":
        g.moveTo(m, m - r); g.lineTo(m + r, m + r * 0.8); g.lineTo(m - r, m + r * 0.8); g.closePath();
        break;
      case "naval":
        g.rect(m - r * 0.8, m - r * 0.8, r * 1.6, r * 1.6);
        break;
      case "space":
        g.moveTo(m, m - r); g.lineTo(m + r, m); g.lineTo(m, m + r); g.lineTo(m - r, m); g.closePath();
        break;
      case "hq":
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const rr = i % 2 ? r * 0.45 : r;
          g.lineTo(m + rr * Math.cos(a), m + rr * Math.sin(a));
        }
        g.closePath();
        break;
      default:
        g.arc(m, m, r * 0.85, 0, Math.PI * 2);
    }
  }

  function baseIcon(branch, category, size = 18) {
    return canvasIcon(`b|${branch}|${category}|${size}`, size, (g, s) => {
      shapePath(g, category, s);
      g.lineWidth = 1.5;
      g.strokeStyle = "#0b0e12";
      if (category === "access") {
        g.lineWidth = 3;
        g.strokeStyle = BRANCH_COLORS[branch];
        g.stroke();
      } else {
        g.fillStyle = BRANCH_COLORS[branch];
        g.fill();
        g.stroke();
      }
    });
  }

  function shipIcon(type) {
    return canvasIcon(`s|${type}`, 26, (g, s) => {
      // Top-down hull silhouette, bow up.
      const m = s / 2;
      g.beginPath();
      g.moveTo(m, 1);
      g.quadraticCurveTo(m + 8, 8, m + 7, s - 3);
      g.lineTo(m - 7, s - 3);
      g.quadraticCurveTo(m - 8, 8, m, 1);
      g.closePath();
      g.fillStyle = SHIP_COLORS[type];
      g.fill();
      g.lineWidth = 1.5;
      g.strokeStyle = "#fff";
      g.stroke();
      if (type === "carrier") {
        g.strokeStyle = "rgba(0,0,0,.6)";
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(m - 3, s - 6); g.lineTo(m + 2, 9); g.stroke();
      }
    });
  }

  function aircraftIcon() {
    return canvasIcon("aircraft", 22, (g, s) => {
      const m = s / 2;
      g.beginPath();
      g.moveTo(m, 1);
      g.lineTo(m + 1.8, 7); g.lineTo(m + 10, 12); g.lineTo(m + 10, 14); g.lineTo(m + 1.8, 11.5);
      g.lineTo(m + 1.5, 17); g.lineTo(m + 4.5, 19.5); g.lineTo(m + 4.5, 21); g.lineTo(m, 20);
      g.lineTo(m - 4.5, 21); g.lineTo(m - 4.5, 19.5); g.lineTo(m - 1.5, 17); g.lineTo(m - 1.8, 11.5);
      g.lineTo(m - 10, 14); g.lineTo(m - 10, 12); g.lineTo(m - 1.8, 7);
      g.closePath();
      g.fillStyle = AIRCRAFT_COLOR;
      g.fill();
      g.lineWidth = 1;
      g.strokeStyle = "#0b0e12";
      g.stroke();
    });
  }

  function clusterIcon(n) {
    const size = n < 10 ? 28 : n < 50 ? 34 : 40;
    return canvasIcon(`c|${n}`, size, (g, s) => {
      const m = s / 2;
      g.beginPath(); g.arc(m, m, m - 2, 0, Math.PI * 2);
      g.fillStyle = "rgba(20,26,34,.9)"; g.fill();
      g.lineWidth = 2; g.strokeStyle = "#f2c14e"; g.stroke();
      g.fillStyle = "#fff"; g.font = "bold 12px system-ui, sans-serif";
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(String(n), m, m + 0.5);
    });
  }

  // Billboard options that display a canvas icon at its CSS size rather than its 2x pixel size.
  function icon(url) {
    const s = iconSize.get(url);
    return { image: url, width: s, height: s };
  }

  // ---------------------------------------------------------------- viewer
  const viewer = new Cesium.Viewer("globe", {
    baseLayer: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: true,
    sceneModePicker: true,
    navigationHelpButton: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: true,
  });
  viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#0d1b2a");
  viewer.scene.screenSpaceCameraController.minimumZoomDistance = 500;

  const HOME = Cesium.Cartesian3.fromDegrees(-40, 28, 2.4e7);
  viewer.camera.setView({ destination: HOME });
  viewer.homeButton.viewModel.command.beforeExecute.addEventListener((e) => {
    e.cancel = true;
    viewer.camera.flyTo({ destination: HOME });
  });

  const BASEMAPS = {
    satellite: [
      { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        credit: "Imagery © Esri, Maxar, Earthstar Geographics", maximumLevel: 19 },
      { url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        credit: "Boundaries & places © Esri", maximumLevel: 19 },
    ],
    dark: [
      { url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", subdomains: "abcd",
        credit: "© OpenStreetMap contributors © CARTO", maximumLevel: 19 },
    ],
    light: [
      { url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", subdomains: "abcd",
        credit: "© OpenStreetMap contributors © CARTO", maximumLevel: 19 },
    ],
  };

  // Low-res Natural Earth imagery bundled with Cesium: always shown underneath so
  // the globe still renders if the online tile servers are blocked or offline.
  const fallbackLayer = Cesium.ImageryLayer.fromProviderAsync(
    Cesium.TileMapServiceImageryProvider.fromUrl(Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII")));

  function setBasemap(name) {
    viewer.imageryLayers.removeAll(false);
    viewer.imageryLayers.add(fallbackLayer);
    for (const spec of BASEMAPS[name] || BASEMAPS.satellite) {
      viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
        url: spec.url,
        subdomains: spec.subdomains,
        maximumLevel: spec.maximumLevel,
        credit: new Cesium.Credit(spec.credit),
      }));
    }
  }
  setBasemap("satellite");

  // ---------------------------------------------------------------- data sources
  const labelStyle = (text, maxDist, color = Cesium.Color.WHITE) => ({
    text,
    font: "12px system-ui, sans-serif",
    fillColor: color,
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 3,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    pixelOffset: new Cesium.Cartesian2(0, -14),
    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, maxDist),
  });

  const baseDS = new Cesium.CustomDataSource("bases");
  const navalDS = new Cesium.CustomDataSource("naval");
  const airDS = new Cesium.CustomDataSource("aircraft");

  BASES.forEach((rec, i) => {
    rec.id = `base-${i}`;
    const e = baseDS.entities.add({
      id: rec.id,
      name: rec.n,
      position: Cesium.Cartesian3.fromDegrees(rec.lon, rec.lat),
      billboard: { ...icon(baseIcon(rec.b, rec.c)), verticalOrigin: Cesium.VerticalOrigin.CENTER },
      label: labelStyle(rec.n, 1.5e6),
    });
    e.ff = { kind: "base", rec };
  });

  NAVAL.forEach((rec, i) => {
    rec.id = `naval-${i}`;
    const color = Cesium.Color.fromCssColorString(SHIP_COLORS[rec.t]);
    const e = navalDS.entities.add({
      id: rec.id,
      name: rec.n,
      position: Cesium.Cartesian3.fromDegrees(rec.lon, rec.lat),
      billboard: {
        ...icon(shipIcon(rec.t)),
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
      },
      label: labelStyle(rec.n.replace(/ \(.*$/, ""), 2.5e7, color.brighten(0.4, new Cesium.Color())),
      ellipse: {
        semiMajorAxis: CONF_RADIUS[rec.conf],
        semiMinorAxis: CONF_RADIUS[rec.conf],
        height: 0,
        material: color.withAlpha(0.12),
        outline: true,
        outlineColor: color.withAlpha(0.6),
      },
    });
    e.ff = { kind: "naval", rec };
  });

  viewer.dataSources.add(baseDS);
  viewer.dataSources.add(navalDS);
  viewer.dataSources.add(airDS);

  // Clustering keeps the global view readable; clusters split apart as you zoom in.
  baseDS.clustering.pixelRange = 28;
  baseDS.clustering.minimumClusterSize = 3;
  baseDS.clustering.clusterEvent.addEventListener((entities, cluster) => {
    cluster.label.show = false;
    cluster.billboard.show = true;
    cluster.billboard.id = cluster.label.id;
    cluster.billboard.verticalOrigin = Cesium.VerticalOrigin.CENTER;
    const ci = icon(clusterIcon(entities.length));
    cluster.billboard.image = ci.image;
    cluster.billboard.width = ci.width;
    cluster.billboard.height = ci.height;
  });
  function setClustering(on) {
    baseDS.clustering.enabled = on;
  }
  setClustering(true);

  // ---------------------------------------------------------------- filtering & lists
  const $ = (id) => document.getElementById(id);
  const state = {
    query: "",
    branches: new Set(Object.keys(BRANCH_COLORS)),
    showBases: true,
    showNaval: true,
  };

  function matches(rec, q) {
    if (!q) return true;
    const hay = [rec.n, rec.b, rec.cc, rec.d, rec.area, rec.status, CATEGORY_LABELS[rec.c]]
      .filter(Boolean).join(" ").toLowerCase();
    return q.split(/\s+/).every((w) => hay.includes(w));
  }

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const c of children) if (c != null) node.append(c);
    return node;
  }

  function applyFilters() {
    const q = state.query.trim().toLowerCase();

    const baseList = $("base-list");
    baseList.replaceChildren();
    let shownBases = 0;
    const visibleBases = [];
    for (const rec of BASES) {
      const show = state.showBases && state.branches.has(rec.b) && matches(rec, q);
      baseDS.entities.getById(rec.id).show = show;
      if (show) { shownBases++; visibleBases.push(rec); }
    }
    visibleBases.sort((a, b) => a.n.localeCompare(b.n));
    for (const rec of visibleBases) {
      baseList.append(el("li", { onclick: () => focusRecord("base", rec) },
        el("img", { src: baseIcon(rec.b, rec.c, 14), width: 14, height: 14, alt: "" }),
        el("div", {}, rec.n, el("div", { class: "meta" }, `${rec.b} · ${rec.cc}`))));
    }
    $("count-bases").textContent = `${shownBases}/${BASES.length}`;

    const navalList = $("naval-list");
    navalList.replaceChildren();
    let shownNaval = 0;
    for (const rec of NAVAL) {
      const show = state.showNaval && matches(rec, q);
      navalDS.entities.getById(rec.id).show = show;
      if (!show) continue;
      shownNaval++;
      navalList.append(el("li", { onclick: () => focusRecord("naval", rec) },
        el("img", { src: shipIcon(rec.t), width: 14, height: 14, alt: "" }),
        el("div", {}, rec.n, el("div", { class: "meta" }, `${rec.status} · ${rec.area}`)),
        el("span", { class: `conf ${rec.conf}`, title: "Location confidence" }, rec.conf)));
    }
    $("count-naval").textContent = `${shownNaval}/${NAVAL.length}`;
  }

  function buildControls() {
    const wrap = $("branch-filters");
    const counts = {};
    for (const b of BASES) counts[b.b] = (counts[b.b] || 0) + 1;
    for (const [branch, color] of Object.entries(BRANCH_COLORS)) {
      const cb = el("input", { type: "checkbox", checked: "" });
      cb.addEventListener("change", () => {
        cb.checked ? state.branches.add(branch) : state.branches.delete(branch);
        applyFilters();
      });
      const sw = el("span", { class: "swatch" });
      sw.style.background = color;
      wrap.append(el("label", { class: "row" }, cb, sw, branch, el("span", { class: "count" }, String(counts[branch] || 0))));
    }

    const legend = $("legend");
    for (const [cat, label] of Object.entries(CATEGORY_LABELS)) {
      legend.append(el("div", { class: "row" }, el("img", { src: baseIcon("Joint", cat, 14), width: 14, height: 14, alt: "" }), label));
    }
    legend.append(el("div", { class: "row" }, el("img", { src: shipIcon("carrier"), width: 14, height: 14, alt: "" }), "Aircraft carrier"));
    legend.append(el("div", { class: "row" }, el("img", { src: shipIcon("amphib"), width: 14, height: 14, alt: "" }), "Amphibious assault ship / ARG"));
    legend.append(el("div", { class: "row" }, el("img", { src: aircraftIcon(), width: 14, height: 14, alt: "" }), "Military aircraft (live ADS-B)"));

    $("search").addEventListener("input", (e) => { state.query = e.target.value; applyFilters(); });
    $("layer-bases").addEventListener("change", (e) => { state.showBases = e.target.checked; applyFilters(); });
    $("layer-naval").addEventListener("change", (e) => { state.showNaval = e.target.checked; applyFilters(); });
    $("layer-cluster").addEventListener("change", (e) => setClustering(e.target.checked));
    $("layer-air").addEventListener("change", (e) => setAircraft(e.target.checked));
    $("basemap").addEventListener("change", (e) => setBasemap(e.target.value));
    $("panel-toggle").addEventListener("click", () => document.body.classList.toggle("panel-hidden"));
    $("details-close").addEventListener("click", hideDetails);
    if (window.innerWidth < 700) document.body.classList.add("panel-hidden");

    $("naval-asof").textContent = window.FF_NAVAL_AS_OF ? `as of ${window.FF_NAVAL_AS_OF}` : "";
    for (const s of window.FF_NAVAL_SOURCES || []) {
      $("sources").append(el("li", {}, el("a", { href: s.url, target: "_blank", rel: "noopener" }, s.label)));
    }
    $("sources").append(el("li", {}, "Installations: DoD Base Structure Report, service websites, Wikipedia"));
    $("sources").append(el("li", {}, "Live aircraft: ", el("a", { href: "https://adsb.lol", target: "_blank", rel: "noopener" }, "adsb.lol"),
      " / ", el("a", { href: "https://airplanes.live", target: "_blank", rel: "noopener" }, "airplanes.live")));
  }

  // ---------------------------------------------------------------- details & navigation
  function fmtCoord(lat, lon) {
    return `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(3)}°${lon >= 0 ? "E" : "W"}`;
  }

  function showDetails(kind, rec) {
    const body = $("details-body");
    const rows = [];
    let title = rec.n, sub = "";
    if (kind === "base") {
      sub = `${rec.b} · ${CATEGORY_LABELS[rec.c]}`;
      rows.push(["Location", rec.cc], ["Coords", fmtCoord(rec.lat, rec.lon) + " (approx.)"], ["Notes", rec.d]);
    } else if (kind === "naval") {
      sub = rec.t === "carrier" ? "Aircraft carrier" : "Amphibious assault ship";
      rows.push(["Status", rec.status], ["Area", rec.area], ["Confidence", rec.conf],
        ["Ring", `±${Math.round(CONF_RADIUS[rec.conf] / 1000)} km`], ["As of", window.FF_NAVAL_AS_OF], ["Notes", rec.d]);
    } else if (kind === "aircraft") {
      title = rec.flight || rec.r || rec.hex.toUpperCase();
      sub = "Live ADS-B track";
      const alt = rec.alt_baro === "ground" ? "On ground" : rec.alt_baro != null ? `${Math.round(rec.alt_baro).toLocaleString()} ft` : "—";
      rows.push(["Type", rec.t || "—"], ["Registration", rec.r || "—"], ["ICAO hex", rec.hex.toUpperCase()], ["Altitude", alt],
        ["Ground speed", rec.gs != null ? `${Math.round(rec.gs)} kt` : "—"], ["Track", rec.track != null ? `${Math.round(rec.track)}°` : "—"],
        ["Position", fmtCoord(rec.lat, rec.lon)]);
    }
    const dl = el("dl");
    for (const [k, v] of rows) dl.append(el("dt", {}, k), el("dd", {}, v == null ? "—" : String(v)));
    body.replaceChildren(el("h3", {}, title), el("div", { class: "meta" }, sub), dl);
    $("details").hidden = false;
  }

  function hideDetails() {
    $("details").hidden = true;
    viewer.selectedEntity = undefined;
  }

  function focusRecord(kind, rec) {
    const ds = kind === "base" ? baseDS : navalDS;
    viewer.selectedEntity = ds.entities.getById(rec.id);
    const height = kind === "base" ? 25000 : CONF_RADIUS[rec.conf] * 6 + 200000;
    viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(rec.lon, rec.lat, height), duration: 2 });
    showDetails(kind, rec);
    if (window.innerWidth < 700) document.body.classList.add("panel-hidden");
  }

  function flyToCluster(entities) {
    const now = viewer.clock.currentTime;
    const carto = entities.map((e) => Cesium.Cartographic.fromCartesian(e.position.getValue(now)));
    const rect = Cesium.Rectangle.fromCartographicArray(carto);
    const pad = Math.max(rect.width, rect.height) * 0.3 + Cesium.Math.toRadians(0.5);
    viewer.camera.flyTo({
      destination: new Cesium.Rectangle(rect.west - pad, rect.south - pad, rect.east + pad, rect.north + pad),
      duration: 1.5,
    });
  }

  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((click) => {
    const picked = viewer.scene.pick(click.position);
    if (!Cesium.defined(picked)) { hideDetails(); return; }
    if (Array.isArray(picked.id)) { flyToCluster(picked.id); return; }
    const e = picked.id;
    if (e && e.ff) {
      viewer.selectedEntity = e;
      showDetails(e.ff.kind, e.ff.rec);
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  const tip = $("tooltip");
  handler.setInputAction((move) => {
    const picked = viewer.scene.pick(move.endPosition);
    let text = null;
    if (Cesium.defined(picked)) {
      if (Array.isArray(picked.id)) text = `${picked.id.length} installations — click to zoom`;
      else if (picked.id && picked.id.ff) {
        const { kind, rec } = picked.id.ff;
        text = kind === "aircraft" ? `${rec.flight || rec.hex.toUpperCase()} · ${rec.t || "unknown type"}` : rec.n;
      }
    }
    if (text) {
      tip.textContent = text;
      tip.style.left = `${move.endPosition.x + 14}px`;
      tip.style.top = `${move.endPosition.y + 14}px`;
      tip.hidden = false;
      viewer.scene.canvas.style.cursor = "pointer";
    } else {
      tip.hidden = true;
      viewer.scene.canvas.style.cursor = "";
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  // ---------------------------------------------------------------- live aircraft (ADS-B)
  let airTimer = null;

  function isUsMilitary(hex) {
    const v = parseInt(hex, 16);
    return v >= US_MIL_HEX_MIN && v <= US_MIL_HEX_MAX;
  }

  async function fetchAircraft() {
    for (const url of ADSB_ENDPOINTS) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 10000);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) continue;
        const data = await res.json();
        if (Array.isArray(data.ac)) return data.ac;
      } catch (_) { /* try next endpoint */ }
    }
    return null;
  }

  async function refreshAircraft() {
    const list = await fetchAircraft();
    if (!$("layer-air").checked) return;
    if (!list) { $("count-air").textContent = "unavailable"; return; }
    const seen = new Set();
    for (const ac of list) {
      if (ac.lat == null || ac.lon == null || !ac.hex || !isUsMilitary(ac.hex)) continue;
      const id = `ac-${ac.hex}`;
      seen.add(id);
      const altM = typeof ac.alt_baro === "number" ? ac.alt_baro * 0.3048 : 0;
      const position = Cesium.Cartesian3.fromDegrees(ac.lon, ac.lat, altM);
      const rotation = Cesium.Math.toRadians(-(ac.track || 0));
      let e = airDS.entities.getById(id);
      if (!e) {
        e = airDS.entities.add({
          id,
          position,
          billboard: {
            ...icon(aircraftIcon()),
            rotation,
            alignedAxis: Cesium.Cartesian3.UNIT_Z,
          },
          label: labelStyle((ac.flight || ac.hex).trim(), 2.0e6, Cesium.Color.fromCssColorString(AIRCRAFT_COLOR)),
        });
      } else {
        e.position = position;
        e.billboard.rotation = rotation;
      }
      e.ff = { kind: "aircraft", rec: { ...ac, flight: (ac.flight || "").trim() } };
    }
    for (const e of airDS.entities.values.slice()) if (!seen.has(e.id)) airDS.entities.remove(e);
    $("count-air").textContent = String(seen.size);
  }

  function setAircraft(on) {
    clearInterval(airTimer);
    airTimer = null;
    if (on) {
      $("count-air").textContent = "loading…";
      refreshAircraft();
      airTimer = setInterval(refreshAircraft, AIR_REFRESH_MS);
    } else {
      airDS.entities.removeAll();
      $("count-air").textContent = "";
    }
  }

  // ---------------------------------------------------------------- go
  buildControls();
  applyFilters();
  window.ForceFinder = { viewer, baseDS, navalDS, airDS, state, applyFilters, refreshAircraft };
})();
