// Areas where US-designated armed groups are based or hold sway, compiled from
// public reporting (news, think tanks, Wikipedia, ACLED, EUAA). These are broad
// areas of influence at the town / district / region level, NOT facility
// locations. The ring radius (r, km) is a rough indication of the area's size.
//
// Fields: n = area name, g = group (key into FF_GROUP_INFO), cc = country,
//         lat/lon = approximate centre, r = ring radius in km,
//         status = "stronghold" | "contested" | "degraded", d = notes,
//         src = [{ label, url }]
// Status: stronghold = group holds or dominates the area; contested = another
//         force occupies or disputes it; degraded = group pushed back or heavily
//         struck, with a residual presence.
window.FF_GROUPS_AS_OF = "2026-11-01";

window.FF_GROUP_INFO = {
  "Hezbollah": { full: "Hezbollah (Lebanon)", fto: "US-designated Foreign Terrorist Organization (1997)",
    src: [{ label: "CIA World Factbook: terrorist groups", url: "https://www.cia.gov/the-world-factbook/about/archives/2023/field/terrorist-groups" }] },
  "Hamas": { full: "Hamas", fto: "US-designated Foreign Terrorist Organization (1997)",
    src: [{ label: "CIA World Factbook: terrorist groups", url: "https://www.cia.gov/the-world-factbook/about/archives/2023/field/terrorist-groups" }] },
  "Palestinian Islamic Jihad": { full: "Palestinian Islamic Jihad (al-Quds Brigades)", fto: "US-designated Foreign Terrorist Organization (1997)",
    src: [{ label: "CIA World Factbook: terrorist groups", url: "https://www.cia.gov/the-world-factbook/about/archives/2023/field/terrorist-groups" }] },
  "Houthis": { full: "Houthis (Ansar Allah)", fto: "US-designated Foreign Terrorist Organization (2025)",
    src: [{ label: "NCITE: Iran-aligned FTOs (2026)", url: "https://www.unomaha.edu/ncite/news/2026/03/rapid-report-iran-aligned-ftos.pdf" }] },
  "Kataib Hezbollah": { full: "Kata'ib Hezbollah and allied Iraqi militias", fto: "US-designated Foreign Terrorist Organization (2009)",
    src: [{ label: "Iran Watch: designations of Iran-aligned militias", url: "https://www.iranwatch.org/library/governments/united-states/executive-branch/department-state/fact-sheet-terrorist-designations-iran-aligned-militia-groups" }] },
  "IRGC": { full: "Islamic Revolutionary Guard Corps (Iran)", fto: "US-designated Foreign Terrorist Organization (2019)",
    src: [{ label: "Iran Watch: IRGC FTO designation", url: "https://www.iranwatch.org/library/governments/united-states/executive-branch/department-state/designation-islamic-revolutionary-guard-corps-foreign-terrorist-organization" }] },
  "ISIS": { full: "Islamic State (ISIS) and affiliates", fto: "US-designated Foreign Terrorist Organization",
    src: [{ label: "CIA World Factbook: terrorist groups", url: "https://www.cia.gov/the-world-factbook/about/archives/2023/field/terrorist-groups" }] },
  "al-Shabaab": { full: "al-Shabaab (Somalia)", fto: "US-designated Foreign Terrorist Organization (2008)",
    src: [{ label: "CIA World Factbook: terrorist groups", url: "https://www.cia.gov/the-world-factbook/about/archives/2023/field/terrorist-groups" }] },
  "AQAP": { full: "al-Qaeda in the Arabian Peninsula", fto: "US-designated Foreign Terrorist Organization (2010)",
    src: [{ label: "CIA World Factbook: terrorist groups", url: "https://www.cia.gov/the-world-factbook/about/archives/2023/field/terrorist-groups" }] },
};

window.FF_GROUPS = [
  // ---------------- Hezbollah ----------------
  { n: "Dahiyeh (southern Beirut suburbs)", g: "Hezbollah", cc: "Lebanon", lat: 33.850, lon: 35.505, r: 4, status: "stronghold",
    d: "Mostly Shia southern suburbs of Beirut; Hezbollah's political, social and security hub, and a frequent target of Israeli strikes in 2026. Al Jazeera notes Amal is also present.",
    src: [{ label: "Al Jazeera (Mar 2026)", url: "https://aljazeera.com/features/2026/3/18/why-israel-targets-beiruts-dahiyeh-and-what-the-suburb-means-to-lebanon" },
          { label: "Gulf News", url: "https://gulfnews.com/world/mena/fearing-israeli-strikes-residents-flee-south-beirut-hezbollah-stronghold-1.103770636" }] },
  { n: "Southern Lebanon", g: "Hezbollah", cc: "Lebanon", lat: 33.30, lon: 35.40, r: 30, status: "contested",
    d: "Hezbollah's traditional base south of the Litani River. Israel began ground operations here in March 2026 and still holds parts of the area; Israeli strikes continue despite the June ceasefire.",
    src: [{ label: "2026 Lebanon war (Wikipedia)", url: "https://en.wikipedia.org/wiki/2026_Lebanon_war" },
          { label: "CFR Global Conflict Tracker", url: "https://www.cfr.org/global-conflict-tracker/conflict/political-instability-lebanon" }] },
  { n: "Bekaa Valley (Baalbek-Hermel)", g: "Hezbollah", cc: "Lebanon", lat: 34.05, lon: 36.20, r: 35, status: "stronghold",
    d: "Eastern Lebanon, described as another area of Hezbollah influence; Israel ordered residents to leave during the 2026 escalation.",
    src: [{ label: "Israel warns people to leave Beirut's southern suburbs (Yahoo)", url: "https://www.yahoo.com/news/articles/israel-orders-residents-leave-southern-143721046.html" }] },

  // ---------------- Hamas / PIJ ----------------
  { n: "Gaza City (west of the Yellow Line)", g: "Hamas", cc: "Gaza Strip", lat: 31.51, lon: 34.45, r: 8, status: "contested",
    d: "Hamas still governs the western part of Gaza, west of the ceasefire 'Yellow Line'. Israel says it controls about 60% of the Strip and has moved the line west.",
    src: [{ label: "Yellow Line (Gaza) (Wikipedia)", url: "https://en.wikipedia.org/wiki/Yellow_Line_(Gaza)" },
          { label: "ACLED expert comment", url: "https://acleddata.com/expert-comment/nasser-khdour-israels-escalation-gaza-amid-hamas-refusal-disarm" }] },
  { n: "Central & southern Gaza coast (Deir al-Balah, al-Mawasi)", g: "Hamas", cc: "Gaza Strip", lat: 31.38, lon: 34.30, r: 9, status: "contested",
    d: "Western coastal strip of central and southern Gaza, outside Israeli-held territory; Reuters reported Israel moving the line forward near Deir al-Balah in July 2026.",
    src: [{ label: "Yellow Line (Gaza) (Wikipedia)", url: "https://en.wikipedia.org/wiki/Yellow_Line_(Gaza)" },
          { label: "Arab News (Reuters)", url: "https://www.arabnews.pk/node/2652620/middle-east" }] },
  { n: "Jenin refugee camp", g: "Palestinian Islamic Jihad", cc: "West Bank", lat: 32.461, lon: 35.292, r: 3, status: "contested",
    d: "Long-time base of PIJ's al-Quds Brigades alongside Fatah's al-Aqsa Martyrs' Brigades; under Israeli military control since Operation Iron Wall.",
    src: [{ label: "Jenin refugee camp (Wikipedia)", url: "https://en.wikipedia.org/wiki/Jenin_refugee_camp" },
          { label: "The New Arab", url: "https://www.newarab.com/analysis/why-jenin-refugee-camp-stronghold-palestinian-resistance" }] },

  // ---------------- Houthis ----------------
  { n: "Sanaa", g: "Houthis", cc: "Yemen", lat: 15.37, lon: 44.19, r: 25, status: "stronghold",
    d: "Yemen's capital, held by the Houthis since September 2014 along with most of the country's northwest.",
    src: [{ label: "Al Jazeera: Yemen maps (Oct 2026)", url: "https://www.aljazeera.com/news/2026/10/20/yemen-maps-show-10-years-of-changing-control" }] },
  { n: "Saada governorate", g: "Houthis", cc: "Yemen", lat: 16.94, lon: 43.76, r: 50, status: "stronghold",
    d: "The movement's birthplace and heartland on the Saudi border, long used as a launch area for attacks on Saudi Arabia.",
    src: [{ label: "Al Jazeera: Yemen maps (Oct 2026)", url: "https://www.aljazeera.com/news/2026/10/20/yemen-maps-show-10-years-of-changing-control" },
          { label: "Gulf News", url: "https://gulfnews.com/amp/story/world%2Fgulf%2Fyemen%2Fyemen-forces-seize-key-mountain-range-in-saada-1.2247059" }] },
  { n: "Hodeidah & Red Sea coast", g: "Houthis", cc: "Yemen", lat: 14.80, lon: 42.95, r: 40, status: "stronghold",
    d: "Yemen's main Red Sea port, held by the Houthis since 2014–15 and the gateway for most of the trade reaching Sanaa.",
    src: [{ label: "Al Jazeera: Yemen maps (Oct 2026)", url: "https://www.aljazeera.com/news/2026/10/20/yemen-maps-show-10-years-of-changing-control" },
          { label: "The National", url: "https://www.thenationalnews.com/world/mena/yemeni-forces-make-key-gain-in-campaign-to-retake-rebel-held-port-1.702748" }] },

  // ---------------- Iraq ----------------
  { n: "Jurf al-Sakhar (Jurf al-Nasr)", g: "Kataib Hezbollah", cc: "Iraq", lat: 32.88, lon: 44.12, r: 10, status: "stronghold",
    d: "Town about 60 km southwest of Baghdad described as a closed military zone dominated by Kata'ib Hezbollah and allied factions; struck repeatedly, including in 2026. An Iraqi government committee began disarmament fieldwork there in 2026.",
    src: [{ label: "Jurf al-Nasr (Wikipedia)", url: "https://en.wikipedia.org/wiki/Jurf_al-Nasr" },
          { label: "Shafaq News", url: "https://shafaq.com/en/Report/Jurf-al-Sakhr-and-Iraq-s-push-to-disarm-factions" },
          { label: "Alhurra", url: "https://alhurra.com/en/14420" }] },

  // ---------------- Iran (IRGC) ----------------
  { n: "Bandar Abbas (IRGC Navy, Strait of Hormuz)", g: "IRGC", cc: "Iran", lat: 27.15, lon: 56.22, r: 25, status: "degraded",
    d: "Main IRGC Navy hub and headquarters of its 1st Naval District, which covers the Strait of Hormuz; heavily struck in 2026. The IRGC Navy also operates from Qeshm and nearby islands.",
    src: [{ label: "Fox News", url: "https://www.foxnews.com/world/fires-rage-irans-bandar-abbas-naval-headquarters-strait-hormuz-traffic-stalled.amp" },
          { label: "GlobalSecurity.org: IRGC Navy", url: "https://www.globalsecurity.org/military/world/iran/irgcn.htm" }] },

  // ---------------- ISIS ----------------
  { n: "Central Syrian desert (Badia)", g: "ISIS", cc: "Syria", lat: 34.60, lon: 38.60, r: 120, status: "degraded",
    d: "Analysts describe the central desert as ISIS's main base of operations in Syria, where cells use remote terrain for ambushes and raids.",
    src: [{ label: "Middle East Institute", url: "https://www.mei.edu/blog/isis-escalating-its-insurgency-syrian-desert" },
          { label: "Small Wars Journal (2025)", url: "https://smallwarsjournal.com/2025/03/13/the-islamic-state-isis-in-syria/" }] },
  { n: "Cal Miskaad mountains (Puntland)", g: "ISIS", cc: "Somalia", lat: 10.80, lon: 49.60, r: 40, status: "degraded",
    d: "ISIS-Somalia's hideouts southeast of Bosaso; US airstrikes and Puntland ground operations in 2026 pushed out an estimated 100–200 fighters, with remnants reported in nearby valleys.",
    src: [{ label: "Geeska", url: "https://www.geeska.com/en/puntland-president-deni-opens-57th-parliament-session-declares-victory-over-isis" }] },

  // ---------------- al-Shabaab ----------------
  { n: "Jilib / Middle Juba", g: "al-Shabaab", cc: "Somalia", lat: 0.49, lon: 42.77, r: 60, status: "stronghold",
    d: "The EUAA describes Middle Juba as an al-Shabaab stronghold, with Jilib serving as the group's de facto capital and command centre; frequent target of US and Somali strikes.",
    src: [{ label: "EUAA: Middle Juba", url: "https://www.euaa.europa.eu/somalia-security-situation/212-middle-juba" },
          { label: "Jilib District (Wikipedia)", url: "https://en.wikipedia.org/wiki/Jilib_District" }] },

  // ---------------- AQAP ----------------
  { n: "Shabwa & Abyan", g: "AQAP", cc: "Yemen", lat: 14.20, lon: 46.40, r: 80, status: "degraded",
    d: "Long-time AQAP strongholds in southern Yemen; ACLED reports activity there declined after 2023 as southern forces retook key areas. Coverage of 2026 is thin.",
    src: [{ label: "ACLED: Shabwa profile", url: "https://acleddata.com/yemen-conflict-observatory/region-profiles/shabwa" },
          { label: "ACLED: Abyan profile", url: "https://acleddata.com/yemen-conflict-observatory/region-profiles/abyan" }] },
];
