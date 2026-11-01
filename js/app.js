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

  const EVENT_TYPES = {
    strike: { label: "Strike / airstrike", color: "#e5383b" },
    missile: { label: "Missile attack", color: "#ff7b00" },
    drone: { label: "Drone attack", color: "#b15cff" },
    naval: { label: "Naval incident", color: "#00a6d6" },
    ground: { label: "Ground fighting / troops", color: "#5f9e1a" },
    exercise: { label: "Military exercise", color: "#d4a800" },
    diplomacy: { label: "Diplomacy / talks", color: "#7d8794" },
  };
  // Armed-group areas (data/groups.js), one colour per group.
  const GROUP_COLORS = {
    "Hezbollah": "#f5d90a",
    "Hamas": "#2fbf71",
    "Palestinian Islamic Jihad": "#9be15d",
    "Houthis": "#ff5d73",
    "Kataib Hezbollah": "#ff9f43",
    "IRGC": "#d7263d",
    "ISIS": "#c4c4c4",
    "al-Shabaab": "#33d1c4",
    "AQAP": "#a77bff",
  };
  const GROUP_STATUS = {
    stronghold: { label: "Stronghold", alpha: 0.22 },
    contested: { label: "Contested", alpha: 0.14 },
    degraded: { label: "Degraded / residual", alpha: 0.08 },
  };
  // State militaries layer (data/state_forces.js): one colour per country.
  const STATE_COLORS = { "Russia": "#ff4d4d", "China": "#ffcc00", "North Korea": "#c77dff", "Iran": "#00d68f" };
  const STATE_CATS = {
    naval: { label: "Naval base / fleet", shape: "naval" },
    air: { label: "Air base / airfield", shape: "air" },
    nuclear: { label: "Nuclear / missile / submarine site", shape: "space" },
    hq: { label: "Command headquarters", shape: "hq" },
    overseas: { label: "Overseas base", shape: "access" },
  };
  // Events this close to the newest event in the data get a pulsing ring.
  const PULSE_DAYS = 3;
  const DAY_MS = 86400000;

  const BASES = window.FF_BASES || [];
  const NAVAL = window.FF_NAVAL || [];
  const EVENTS = window.FF_EVENTS || [];
  const CONFLICTS = window.FF_CONFLICTS || {};
  const GROUPS = window.FF_GROUPS || [];
  const STATE_FORCES = window.FF_STATE_FORCES || [];
  const GROUP_INFO = window.FF_GROUP_INFO || {};
  const groupColor = (g) => GROUP_COLORS[g] || "#e6e9ef";

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

  function eventGlyph(g, type, m) {
    g.fillStyle = g.strokeStyle = "#fff";
    g.lineWidth = 1.8;
    g.lineCap = g.lineJoin = "round";
    g.beginPath();
    switch (type) {
      case "strike": // starburst
        for (let i = 0; i < 16; i++) {
          const a = (i * Math.PI) / 8, r = i % 2 ? 3 : 7.5;
          g.lineTo(m + r * Math.cos(a), m + r * Math.sin(a));
        }
        g.closePath(); g.fill();
        break;
      case "missile": // rocket pointing up-right
        g.save(); g.translate(m, m); g.rotate(Math.PI / 4);
        g.moveTo(0, -8); g.lineTo(2.5, -4); g.lineTo(2.5, 4); g.lineTo(5, 7.5); g.lineTo(-5, 7.5);
        g.lineTo(-2.5, 4); g.lineTo(-2.5, -4); g.closePath(); g.fill();
        g.restore();
        break;
      case "drone": // quadcopter
        g.moveTo(m - 5, m - 5); g.lineTo(m + 5, m + 5); g.moveTo(m + 5, m - 5); g.lineTo(m - 5, m + 5); g.stroke();
        for (const [dx, dy] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) {
          g.beginPath(); g.arc(m + dx, m + dy, 2.6, 0, Math.PI * 2); g.stroke();
        }
        break;
      case "naval": // hull and mast
        g.moveTo(m - 8, m + 1); g.lineTo(m + 8, m + 1); g.lineTo(m + 5, m + 6); g.lineTo(m - 5, m + 6); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(m, m + 1); g.lineTo(m, m - 7); g.lineTo(m + 5, m - 2); g.lineTo(m, m - 2); g.fill(); g.stroke();
        break;
      case "ground": // double chevron
        g.moveTo(m - 6, m + 1); g.lineTo(m, m - 5); g.lineTo(m + 6, m + 1);
        g.moveTo(m - 6, m + 6); g.lineTo(m, m); g.lineTo(m + 6, m + 6);
        g.lineWidth = 2.4; g.stroke();
        break;
      case "exercise": // target
        g.arc(m, m, 7, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.arc(m, m, 3.5, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.arc(m, m, 1.2, 0, Math.PI * 2); g.fill();
        break;
      default: // diplomacy: speech bubble
        g.moveTo(m - 7, m - 6); g.lineTo(m + 7, m - 6); g.lineTo(m + 7, m + 3); g.lineTo(m - 1, m + 3);
        g.lineTo(m - 5, m + 7); g.lineTo(m - 4, m + 3); g.lineTo(m - 7, m + 3); g.closePath(); g.fill();
    }
  }

  function eventIcon(type, size = 26) {
    return canvasIcon(`e|${type}|${size}`, size, (g, s) => {
      g.save();
      g.scale(s / 26, s / 26); // glyphs are drawn on a 26px grid
      g.beginPath(); g.arc(13, 13, 11.5, 0, Math.PI * 2);
      g.fillStyle = EVENT_TYPES[type].color; g.fill();
      g.lineWidth = 2; g.strokeStyle = "#fff"; g.stroke();
      eventGlyph(g, type, 13);
      g.restore();
    });
  }

  // State-military site: same shapes as US bases, in the country's colour with a red-black border
  // so they read as non-US at a glance.
  function stateIcon(country, cat, size = 18) {
    return canvasIcon(`st|${country}|${cat}|${size}`, size, (g, s) => {
      const shape = (STATE_CATS[cat] || STATE_CATS.naval).shape;
      const color = STATE_COLORS[country] || "#e6e9ef";
      shapePath(g, shape, s);
      if (shape === "access") {
        g.lineWidth = 3.5; g.strokeStyle = "#5a0000"; g.stroke();
        g.lineWidth = 2; g.strokeStyle = color; g.stroke();
      } else {
        g.fillStyle = color; g.fill();
        g.lineWidth = 2; g.strokeStyle = "#5a0000"; g.stroke();
      }
    });
  }

  // Armed-group area: hexagon in the group's colour with a dark exclamation mark.
  function groupIcon(group, size = 20) {
    return canvasIcon(`g|${group}|${size}`, size, (g, s) => {
      const m = s / 2, r = s / 2 - 1.5;
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i * Math.PI) / 3;
        g.lineTo(m + r * Math.cos(a), m + r * Math.sin(a));
      }
      g.closePath();
      g.fillStyle = groupColor(group); g.fill();
      g.lineWidth = 1.5; g.strokeStyle = "#0b0e12"; g.stroke();
      g.fillStyle = "#0b0e12";
      g.fillRect(m - s * 0.06, m - s * 0.28, s * 0.12, s * 0.33);
      g.beginPath(); g.arc(m, m + s * 0.2, s * 0.07, 0, Math.PI * 2); g.fill();
    });
  }

  function ringIcon(type) {
    return canvasIcon(`r|${type}`, 40, (g, s) => {
      g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2);
      g.lineWidth = 3; g.strokeStyle = EVENT_TYPES[type].color; g.stroke();
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
  const eventDS = new Cesium.CustomDataSource("events");
  const groupDS = new Cesium.CustomDataSource("groups");
  const stateDS = new Cesium.CustomDataSource("state-forces");

  STATE_FORCES.forEach((rec, i) => {
    rec.id = `state-${i}`;
    const color = Cesium.Color.fromCssColorString(STATE_COLORS[rec.c] || "#e6e9ef");
    const e = stateDS.entities.add({
      id: rec.id,
      name: rec.n,
      position: Cesium.Cartesian3.fromDegrees(rec.lon, rec.lat),
      billboard: { ...icon(stateIcon(rec.c, rec.cat)), verticalOrigin: Cesium.VerticalOrigin.CENTER },
      label: labelStyle(rec.n, 2.5e6, color.brighten(0.3, new Cesium.Color())),
    });
    e.ff = { kind: "state", rec };
  });

  GROUPS.forEach((rec, i) => {
    rec.id = `group-${i}`;
    const color = Cesium.Color.fromCssColorString(groupColor(rec.g));
    const st = GROUP_STATUS[rec.status] || GROUP_STATUS.stronghold;
    const e = groupDS.entities.add({
      id: rec.id,
      name: rec.n,
      position: Cesium.Cartesian3.fromDegrees(rec.lon, rec.lat),
      billboard: { ...icon(groupIcon(rec.g)), verticalOrigin: Cesium.VerticalOrigin.CENTER },
      label: { ...labelStyle(`${rec.n} · ${rec.g}`, 2.0e6, color.brighten(0.3, new Cesium.Color())),
        verticalOrigin: Cesium.VerticalOrigin.TOP, pixelOffset: new Cesium.Cartesian2(0, 14) },
      ellipse: {
        semiMajorAxis: rec.r * 1000,
        semiMinorAxis: rec.r * 1000,
        height: 0,
        material: new Cesium.StripeMaterialProperty({
          evenColor: color.withAlpha(st.alpha),
          oddColor: color.withAlpha(st.alpha * 0.35),
          repeat: Math.max(4, Math.round(rec.r / 3)),
          orientation: Cesium.StripeOrientation.VERTICAL,
        }),
        outline: true,
        outlineColor: color.withAlpha(0.75),
      },
    });
    e.ff = { kind: "group", rec };
  });

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
  viewer.dataSources.add(groupDS);
  viewer.dataSources.add(stateDS);
  viewer.dataSources.add(eventDS);
  viewer.dataSources.add(airDS);

  // ---------------------------------------------------------------- conflict events
  const eventTime = (rec) => Date.parse(`${rec.date}T12:00:00Z`);
  const EVENTS_AS_OF = window.FF_EVENTS_AS_OF ? Date.parse(`${window.FF_EVENTS_AS_OF}T12:00:00Z`)
    : Math.max(0, ...EVENTS.map(eventTime));
  const eventEntities = new Map(); // event id -> entities (marker, pulse ring, arc)

  // Arc raised above the surface between launch area and target, like a trajectory.
  function arcPositions(from, to) {
    const a = Cesium.Cartographic.fromDegrees(from[1], from[0]);
    const b = Cesium.Cartographic.fromDegrees(to[1], to[0]);
    const geo = new Cesium.EllipsoidGeodesic(a, b);
    const peak = geo.surfaceDistance * 0.15;
    const pts = [];
    for (let i = 0; i <= 48; i++) {
      const f = i / 48;
      const c = geo.interpolateUsingFraction(f);
      pts.push(Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, Math.sin(Math.PI * f) * peak));
    }
    return pts;
  }

  const pulseStart = Date.now();
  const pulsePhase = () => ((Date.now() - pulseStart) % 1800) / 1800;

  EVENTS.forEach((rec, i) => {
    rec.id = `event-${i}`;
    rec.n = rec.title;
    const ff = { kind: "event", rec };
    const color = Cesium.Color.fromCssColorString(EVENT_TYPES[rec.type].color);
    const position = Cesium.Cartesian3.fromDegrees(rec.lon, rec.lat);
    const list = [];
    const marker = eventDS.entities.add({
      id: rec.id,
      name: rec.title,
      position,
      billboard: { ...icon(eventIcon(rec.type)), verticalOrigin: Cesium.VerticalOrigin.CENTER },
      label: labelStyle(rec.title, 1.2e6, color.brighten(0.5, new Cesium.Color())),
    });
    list.push(marker);
    if (EVENTS_AS_OF - eventTime(rec) <= PULSE_DAYS * DAY_MS) {
      list.push(eventDS.entities.add({
        position,
        billboard: {
          ...icon(ringIcon(rec.type)),
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          scale: new Cesium.CallbackProperty(() => 0.6 + pulsePhase() * 1.2, false),
          color: new Cesium.CallbackProperty(() => Cesium.Color.WHITE.withAlpha(1 - pulsePhase()), false),
        },
      }));
    }
    if (rec.from) {
      list.push(eventDS.entities.add({
        polyline: {
          positions: arcPositions(rec.from, [rec.lat, rec.lon]),
          width: 2.5,
          material: new Cesium.PolylineDashMaterialProperty({ color: color.withAlpha(0.9), dashLength: 14 }),
        },
      }));
    }
    for (const e of list) e.ff = ff;
    eventEntities.set(rec.id, list);
  });

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
    showEvents: true,
    showGroups: true,
    showState: true,
    states: new Set(STATE_FORCES.map((r) => r.c)),
    groups: new Set(GROUPS.map((g) => g.g)),
    eventDays: 0, // 0 = all
    conflicts: new Set(EVENTS.map((e) => e.conflict)),
  };

  function matches(rec, q) {
    if (!q) return true;
    const hay = [rec.n, rec.b, rec.cc, rec.d, rec.area, rec.status, CATEGORY_LABELS[rec.c], rec.conflict,
      rec.type && EVENT_TYPES[rec.type].label, rec.date,
      rec.g, rec.g && GROUP_INFO[rec.g] && GROUP_INFO[rec.g].full, rec.status,
      rec.c, rec.cat && STATE_CATS[rec.cat] && STATE_CATS[rec.cat].label]
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

    const eventList = $("event-list");
    eventList.replaceChildren();
    const visibleEvents = [];
    for (const rec of EVENTS) {
      const inWindow = !state.eventDays || EVENTS_AS_OF - eventTime(rec) <= state.eventDays * DAY_MS;
      const show = state.showEvents && inWindow && state.conflicts.has(rec.conflict) && matches(rec, q);
      for (const e of eventEntities.get(rec.id)) e.show = show;
      if (show) visibleEvents.push(rec);
    }
    visibleEvents.sort((a, b) => b.date.localeCompare(a.date));
    for (const rec of visibleEvents) {
      eventList.append(el("li", { onclick: () => focusRecord("event", rec) },
        el("img", { src: eventIcon(rec.type, 16), width: 16, height: 16, alt: "" }),
        el("div", {}, rec.title, el("div", { class: "meta" }, `${fmtDate(rec.date)} · ${rec.conflict}`))));
    }
    $("count-events").textContent = `${visibleEvents.length}/${EVENTS.length}`;

    const groupList = $("group-list");
    groupList.replaceChildren();
    let shownGroups = 0;
    for (const rec of GROUPS) {
      const show = state.showGroups && state.groups.has(rec.g) && matches(rec, q);
      groupDS.entities.getById(rec.id).show = show;
      if (!show) continue;
      shownGroups++;
      groupList.append(el("li", { onclick: () => focusRecord("group", rec) },
        el("img", { src: groupIcon(rec.g, 14), width: 14, height: 14, alt: "" }),
        el("div", {}, rec.n, el("div", { class: "meta" }, `${rec.g} · ${rec.cc}`)),
        el("span", { class: `conf ${rec.status}`, title: "Status" }, (GROUP_STATUS[rec.status] || {}).label || rec.status)));
    }
    $("count-groups").textContent = `${shownGroups}/${GROUPS.length}`;

    const stateList = $("state-list");
    stateList.replaceChildren();
    let shownState = 0;
    for (const rec of STATE_FORCES) {
      const show = state.showState && state.states.has(rec.c) && matches(rec, q);
      stateDS.entities.getById(rec.id).show = show;
      if (!show) continue;
      shownState++;
      stateList.append(el("li", { onclick: () => focusRecord("state", rec) },
        el("img", { src: stateIcon(rec.c, rec.cat, 14), width: 14, height: 14, alt: "" }),
        el("div", {}, rec.n, el("div", { class: "meta" }, `${rec.c} · ${rec.cc}`))));
    }
    $("count-state").textContent = `${shownState}/${STATE_FORCES.length}`;
  }

  function fmtDate(iso) {
    return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
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
    for (const [type, t] of Object.entries(EVENT_TYPES)) {
      legend.append(el("div", { class: "row" }, el("img", { src: eventIcon(type, 16), width: 16, height: 16, alt: "" }), t.label));
    }
    legend.append(el("div", { class: "row" }, el("span", { class: "dash" }), "Approximate attack direction"));
    legend.append(el("div", { class: "row" }, el("img", { src: groupIcon("ISIS", 14), width: 14, height: 14, alt: "" }),
      "Armed-group area (striped ring = approx. extent)"));

    const groupWrap = $("group-filters");
    const groupCounts = {};
    for (const r of GROUPS) groupCounts[r.g] = (groupCounts[r.g] || 0) + 1;
    for (const group of Object.keys(groupCounts)) {
      const cb = el("input", { type: "checkbox", checked: "" });
      cb.addEventListener("change", () => {
        cb.checked ? state.groups.add(group) : state.groups.delete(group);
        applyFilters();
      });
      const info = GROUP_INFO[group];
      groupWrap.append(el("label", { class: "row", title: info ? `${info.full} — ${info.fto}` : group },
        cb, el("img", { src: groupIcon(group, 14), width: 14, height: 14, alt: "" }), group,
        el("span", { class: "count" }, String(groupCounts[group]))));
    }
    for (const [cat, c] of Object.entries(STATE_CATS)) {
      legend.append(el("div", { class: "row" }, el("img", { src: stateIcon("Russia", cat, 14), width: 14, height: 14, alt: "" }),
        `Foreign military: ${c.label.toLowerCase()}`));
    }
    const stateWrap = $("state-filters");
    const stateCounts = {};
    for (const r of STATE_FORCES) stateCounts[r.c] = (stateCounts[r.c] || 0) + 1;
    for (const country of Object.keys(stateCounts)) {
      const cb = el("input", { type: "checkbox", checked: "" });
      cb.addEventListener("change", () => {
        cb.checked ? state.states.add(country) : state.states.delete(country);
        applyFilters();
      });
      const sw = el("span", { class: "swatch" });
      sw.style.background = STATE_COLORS[country];
      stateWrap.append(el("label", { class: "row" }, cb, sw, country, el("span", { class: "count" }, String(stateCounts[country]))));
    }
    $("layer-state").addEventListener("change", (e) => { state.showState = e.target.checked; applyFilters(); });
    $("state-asof").textContent = window.FF_STATE_FORCES_AS_OF ? `as of ${window.FF_STATE_FORCES_AS_OF}` : "";
    $("layer-groups").addEventListener("change", (e) => { state.showGroups = e.target.checked; applyFilters(); });
    $("groups-asof").textContent = window.FF_GROUPS_AS_OF ? `as of ${window.FF_GROUPS_AS_OF}` : "";

    const conflictWrap = $("conflict-filters");
    const conflictCounts = {};
    for (const e of EVENTS) conflictCounts[e.conflict] = (conflictCounts[e.conflict] || 0) + 1;
    for (const conflict of Object.keys(conflictCounts).sort()) {
      const cb = el("input", { type: "checkbox", checked: "" });
      cb.addEventListener("change", () => {
        cb.checked ? state.conflicts.add(conflict) : state.conflicts.delete(conflict);
        applyFilters();
      });
      const info = CONFLICTS[conflict] ? el("button", {
        class: "info-btn", type: "button", title: `About ${conflict}`, "aria-label": `About ${conflict}`,
        onclick: (e) => { e.preventDefault(); e.stopPropagation(); showConflict(conflict, true); },
      }, "ⓘ") : null;
      conflictWrap.append(el("label", { class: "row", "data-conflict": conflict }, cb, conflict, info, el("span", { class: "count" }, String(conflictCounts[conflict]))));
    }
    $("event-window").addEventListener("change", (e) => { state.eventDays = Number(e.target.value); applyFilters(); });
    $("layer-events").addEventListener("change", (e) => { state.showEvents = e.target.checked; applyFilters(); });
    $("events-asof").textContent = window.FF_EVENTS_AS_OF ? `as of ${window.FF_EVENTS_AS_OF}` : "";

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
    $("sources").append(el("li", {}, "Conflict events: linked news reports (see each event)"));
    $("sources").append(el("li", {}, "Armed-group areas: linked public reporting (see each area)"));
    $("sources").append(el("li", {}, "Foreign military sites: Wikipedia, think tanks and news (see each site)"));
    $("sources").append(el("li", {}, "Installations: DoD Base Structure Report, service websites, Wikipedia"));
    $("sources").append(el("li", {}, "Photos: ", el("a", { href: "https://en.wikipedia.org", target: "_blank", rel: "noopener" }, "Wikipedia"),
      " (bases, ships) / ", el("a", { href: "https://www.planespotters.net", target: "_blank", rel: "noopener" }, "Planespotters.net"), " (aircraft)"));
    $("sources").append(el("li", {}, "Live aircraft: ", el("a", { href: "https://adsb.lol", target: "_blank", rel: "noopener" }, "adsb.lol"),
      " / ", el("a", { href: "https://airplanes.live", target: "_blank", rel: "noopener" }, "airplanes.live")));
  }

  // ---------------------------------------------------------------- photos
  // Bases and ships: lead image of the matching Wikipedia article.
  // Live aircraft: photo of that exact airframe (by ICAO hex) from Planespotters.net.
  const WIKI_REST = "https://en.wikipedia.org/api/rest_v1/page/summary/";
  const WIKI_API = "https://en.wikipedia.org/w/api.php";
  const PLANESPOTTERS = "https://api.planespotters.net/pub/photos/hex/";
  const ABBREVIATIONS = [
    [/\bAFB\b/, "Air Force Base"], [/\bAB\b/, "Air Base"], [/\bSFB\b/, "Space Force Base"],
    [/\bSFS\b/, "Space Force Station"], [/\bNAS\b/, "Naval Air Station"], [/\bNAF\b/, "Naval Air Facility"],
    [/\bNAWS\b/, "Naval Air Weapons Station"], [/\bNSA\b/, "Naval Support Activity"],
    [/\bMCAS\b/, "Marine Corps Air Station"], [/\bMCB\b/, "Marine Corps Base"],
    [/\bMCRD\b/, "Marine Corps Recruit Depot"], [/\bMCAGCC\b/, "Marine Corps Air Ground Combat Center"],
    [/\bUSAG\b/, "United States Army Garrison"],
  ];
  const photoCache = new Map();
  let photoToken = 0;

  async function getJSON(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      return res.ok ? await res.json() : null;
    } catch (_) {
      return null;
    } finally {
      clearTimeout(t);
    }
  }

  async function wikiByTitle(title) {
    const data = await getJSON(WIKI_REST + encodeURIComponent(title.replace(/ /g, "_")));
    if (!data || data.type === "disambiguation" || !data.thumbnail) return null;
    return { src: data.thumbnail.source, link: data.content_urls?.desktop?.page, credit: `Wikipedia: ${data.title}` };
  }

  async function wikiBySearch(query) {
    const params = new URLSearchParams({
      action: "query", format: "json", origin: "*", generator: "search", gsrsearch: query, gsrlimit: "1",
      prop: "pageimages|info", piprop: "thumbnail", pithumbsize: "640", inprop: "url",
    });
    const data = await getJSON(`${WIKI_API}?${params}`);
    const page = data && data.query && Object.values(data.query.pages)[0];
    if (!page || !page.thumbnail) return null;
    return { src: page.thumbnail.source, link: page.fullurl, credit: `Wikipedia: ${page.title}` };
  }

  function wikiTitleForBase(rec) {
    let name = rec.w || rec.n.replace(/\s*\(.*?\)\s*/g, " ").trim();
    for (const [re, full] of ABBREVIATIONS) name = name.replace(re, full);
    return name;
  }

  async function findPhoto(kind, rec) {
    if (kind === "aircraft") {
      const data = await getJSON(PLANESPOTTERS + encodeURIComponent(rec.hex));
      const p = data && data.photos && data.photos[0];
      if (!p) return null;
      return { src: (p.thumbnail_large || p.thumbnail).src, link: p.link, credit: `© ${p.photographer} / Planespotters.net` };
    }
    if (kind === "naval") return (await wikiByTitle(rec.w || rec.n)) || wikiBySearch(rec.w || rec.n);
    const title = wikiTitleForBase(rec);
    return (await wikiByTitle(title)) || wikiBySearch(`${title} ${rec.cc.split(",")[0]}`);
  }

  async function loadPhoto(fig, kind, rec) {
    const token = ++photoToken;
    const key = kind === "aircraft" ? `ac-${rec.hex}` : rec.id;
    if (!photoCache.has(key)) photoCache.set(key, findPhoto(kind, rec).catch(() => null));
    const photo = await photoCache.get(key);
    if (token !== photoToken) return; // another asset was opened meanwhile
    fig.classList.remove("loading");
    if (!photo) {
      photoCache.delete(key); // allow a retry next time (e.g. transient network error)
      fig.replaceChildren(el("div", { class: "photo-msg" }, "No photo available"));
      return;
    }
    const img = el("img", { src: photo.src, alt: rec.n || rec.flight || rec.hex, loading: "lazy" });
    img.addEventListener("error", () => fig.replaceChildren(el("div", { class: "photo-msg" }, "Photo failed to load")));
    const link = el("a", { href: photo.link || photo.src, target: "_blank", rel: "noopener" }, img);
    fig.replaceChildren(link, el("figcaption", {}, photo.credit));
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
    } else if (kind === "state") {
      sub = `${rec.c} · ${(STATE_CATS[rec.cat] || {}).label || rec.cat}`;
      rows.push(["Location", rec.cc], ["Coords", fmtCoord(rec.lat, rec.lon) + " (approx.)"],
        ["As of", window.FF_STATE_FORCES_AS_OF], ["Notes", rec.d]);
    } else if (kind === "group") {
      const info = GROUP_INFO[rec.g] || {};
      sub = `${info.full || rec.g} · ${rec.cc}`;
      rows.push(["Status", (GROUP_STATUS[rec.status] || {}).label || rec.status], ["Designation", info.fto],
        ["Area", `${fmtCoord(rec.lat, rec.lon)} (approx.), ring ±${rec.r} km`], ["As of", window.FF_GROUPS_AS_OF], ["Notes", rec.d]);
    } else if (kind === "event") {
      title = rec.title;
      sub = `${EVENT_TYPES[rec.type].label} · ${rec.conflict}`;
      const ago = Math.round((EVENTS_AS_OF - eventTime(rec)) / DAY_MS);
      rows.push(["Date", `${fmtDate(rec.date)}${ago > 0 ? ` (${ago}d before update)` : ""}`],
        ["Location", fmtCoord(rec.lat, rec.lon) + " (approx.)"], ["Summary", rec.d]);
    }
    const dl = el("dl");
    for (const [k, v] of rows) dl.append(el("dt", {}, k), el("dd", {}, v == null ? "—" : String(v)));
    if (kind === "state") {
      const links = el("dd", { class: "sources" });
      for (const s of rec.src || []) links.append(el("a", { href: s.url, target: "_blank", rel: "noopener" }, `${s.label} ↗`));
      dl.append(el("dt", {}, "Sources"), links);
      body.replaceChildren(el("h3", {}, title), el("div", { class: "meta" }, sub), dl);
      $("details").hidden = false;
      return;
    }
    if (kind === "group") {
      const links = el("dd", { class: "sources" });
      for (const s of [...(rec.src || []), ...((GROUP_INFO[rec.g] || {}).src || [])]) {
        links.append(el("a", { href: s.url, target: "_blank", rel: "noopener" }, `${s.label} ↗`));
      }
      dl.append(el("dt", {}, "Sources"), links);
      body.replaceChildren(el("h3", {}, title), el("div", { class: "meta" }, sub), dl,
        el("p", { class: "disclaimer" }, "Broad area of influence from public reporting, not a facility location. Control changes; check the sources."));
      $("details").hidden = false;
      return;
    }
    if (kind === "event") {
      const links = el("dd", { class: "sources" });
      for (const s of rec.src || []) links.append(el("a", { href: s.url, target: "_blank", rel: "noopener" }, `${s.label} ↗`));
      dl.append(el("dt", {}, "Sources"), links);
      const about = CONFLICTS[rec.conflict]
        ? el("button", { class: "link-btn", type: "button", onclick: () => showConflict(rec.conflict, false) }, `About the ${rec.conflict} war →`)
        : null;
      body.replaceChildren(el("h3", {}, title), el("div", { class: "meta" }, sub), dl, about);
      $("details").hidden = false;
      return;
    }
    const photo = el("figure", { class: "photo loading" }, el("div", { class: "photo-msg" }, "Loading photo…"));
    body.replaceChildren(el("h3", {}, title), el("div", { class: "meta" }, sub), photo, dl);
    $("details").hidden = false;
    loadPhoto(photo, kind, rec);
  }

  // Overview card for a conflict (data/conflicts.js): summary, key facts with sources, further reading.
  function showConflict(name, fly) {
    const c = CONFLICTS[name];
    if (!c) return;
    const linkList = (src) => el("div", { class: "fact-src" },
      ...(src || []).map((s) => el("a", { href: s.url, target: "_blank", rel: "noopener" }, `${s.label} ↗`)));
    const facts = (c.facts || []).map((f) => el("div", { class: "fact" },
      el("h4", {}, f.label), el("p", {}, f.text), linkList(f.src)));
    const reading = c.reading && c.reading.length
      ? el("div", { class: "fact" }, el("h4", {}, "Further reading"), linkList(c.reading))
      : null;
    const only = el("button", { class: "link-btn", type: "button", onclick: () => focusConflict(name) }, `Show only ${name} events`);
    $("details-body").replaceChildren(
      el("h3", {}, name),
      el("div", { class: "meta" }, `Conflict overview${c.asOf ? ` · as of ${fmtDate(c.asOf)}` : ""}`),
      el("p", { class: "summary" }, c.summary),
      ...facts, reading, only);
    $("details").hidden = false;
    $("details").scrollTop = 0;
    viewer.selectedEntity = undefined;
    if (fly && c.view) {
      viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(c.view.lon, c.view.lat, c.view.height), duration: 2 });
    }
  }

  function focusConflict(name) {
    state.conflicts = new Set([name]);
    for (const label of $("conflict-filters").querySelectorAll("label")) {
      label.querySelector("input").checked = label.dataset.conflict === name;
    }
    applyFilters();
    const c = CONFLICTS[name];
    if (c && c.view) viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(c.view.lon, c.view.lat, c.view.height), duration: 2 });
  }

  function hideDetails() {
    $("details").hidden = true;
    viewer.selectedEntity = undefined;
  }

  function focusRecord(kind, rec) {
    const ds = { base: baseDS, naval: navalDS, event: eventDS, group: groupDS, state: stateDS }[kind];
    viewer.selectedEntity = ds.entities.getById(rec.id);
    const height = kind === "base" || kind === "state" ? 25000 : kind === "event" ? 700000
      : kind === "group" ? Math.max(60000, rec.r * 1000 * 6) : CONF_RADIUS[rec.conf] * 6 + 200000;
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
      viewer.selectedEntity = e.ff.kind === "event" ? eventDS.entities.getById(e.ff.rec.id) : e;
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
        text = kind === "aircraft" ? `${rec.flight || rec.hex.toUpperCase()} · ${rec.t || "unknown type"}`
          : kind === "event" ? `${rec.title} · ${fmtDate(rec.date)}`
          : kind === "group" ? `${rec.n} · ${rec.g}`
          : kind === "state" ? `${rec.n} · ${rec.c}` : rec.n;
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
  window.ForceFinder = { viewer, baseDS, navalDS, airDS, eventDS, state, applyFilters, refreshAircraft };
})();
