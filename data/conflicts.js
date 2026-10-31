// Conflict overviews shown when you click the ⓘ next to a conflict in the sidebar.
// Each key matches the `conflict` name used in data/events.js.
//
// Fields: asOf (YYYY-MM-DD), summary, view = { lat, lon, height } camera position,
//         facts = [{ label, text, src: [{ label, url }] }], reading = [{ label, url }]
window.FF_CONFLICTS = {
  "Russia–Ukraine": {
    asOf: "2026-10-31",
    summary: "Russia's full-scale invasion of Ukraine began on 24 February 2022. In autumn 2026 the war runs on three tracks: grinding ground combat in the east and south, a long-range strike war against cities, power plants and oil infrastructure, and stop-start diplomacy.",
    view: { lat: 48.6, lon: 35.5, height: 2200000 },
    facts: [
      { label: "Battlefield",
        text: "ISW assesses that Ukrainian counteroffensives, including Operation Vivaldi in the Kupyansk and Oleksandrivka directions, have virtually halted Russian advances. It estimates a net Russian loss of about 122 km² between Sept. 1 and Oct. 16, 2026, and Russian combat losses of more than 40,000 killed and wounded since the summer.",
        src: [{ label: "ISW (X post)", url: "https://x.com/TheStudyofWar/status/2112713284604289066" }] },
      { label: "Front-line intensity",
        text: "Ukraine's General Staff reported roughly 180–270 combat clashes a day in October, concentrated on the Pokrovsk, Kostiantynivka and Huliaipole fronts. The Kupiansk front has been quieter. These are Ukrainian military figures.",
        src: [{ label: "Ukrainska Pravda, Oct 29", url: "https://www.pravda.com.ua/eng/news/2026/10/29/8060199/" },
              { label: "Ukrainska Pravda, Oct 21", url: "https://www.pravda.com.ua/eng/news/2026/10/21/8059013/" },
              { label: "Ukrinform, Oct 30", url: "https://www.ukrinform.net/rubric-ato/4179606-war-update-over-200-clashes-along-front-line-as-russian-forces-attack-in-eight-sectors.html" }] },
      { label: "Ukraine's strikes on Russia",
        text: "Ukraine hits Russian refineries and oil terminals with long-range drones. A refinery-damage ledger cited by bne IntelliNews counted 22 strikes in August, 16 in September and 6 in October; a two-week lull ended on Oct. 30 with attacks on three refineries.",
        src: [{ label: "bne IntelliNews", url: "https://www.intellinews.com/ukraine-targets-three-russian-refineries-as-two-week-strike-lull-ends-480486" },
              { label: "NPR", url: "https://www.npr.org/2026/10/15/g-s1-148194/russia-ukraine-war" }] },
      { label: "Russia's strikes on Ukraine",
        text: "Russia launches large drone and missile salvos at cities and the power grid, including ballistic missiles and 113 drones overnight on Oct. 30, and repeated strikes on DTEK thermal power plants and Odesa's ports.",
        src: [{ label: "Mezha", url: "https://mezha.net/eng/news/mezha-1f1e18001676f1ddbfab6fff_russia_attacked_ukraine" },
              { label: "Ukrainska Pravda (via Yahoo)", url: "https://www.yahoo.com/news/russia-strikes-yet-another-energy-083215733.html" },
              { label: "TASS", url: "https://tass.com/politics/2210697" }] },
      { label: "Diplomacy",
        text: "The Kremlin says it is ready in principle for technical-level trilateral talks with Ukraine and the US in mid-November, possibly in Abu Dhabi. Zelenskyy has proposed freezing the front along current positions; Russia has demanded Ukraine withdraw from the Donbas.",
        src: [{ label: "UNI", url: "https://www.uniindia.com/world/russia-putin-peace-talks/221385" },
              { label: "APA", url: "https://en.apa.az/cis-countries/kremlin-ready-to-resume-trilateral-talks-on-ukraine-531434" }] },
    ],
    reading: [
      { label: "ISW/CTP Russian Offensive Campaign Assessment", url: "https://www.criticalthreats.org/analysis/russian-offensive-campaign-assessment-october-29-2026" },
      { label: "Battle of Kostiantynivka (Wikipedia)", url: "https://en.wikipedia.org/wiki/Battle_of_Kostiantynivka" },
      { label: "Russian strikes against Ukrainian infrastructure (Wikipedia)", url: "https://en.wikipedia.org/wiki/Russian_strikes_against_Ukrainian_infrastructure" },
    ],
  },
};
