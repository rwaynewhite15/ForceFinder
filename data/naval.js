// Approximate positions of US aircraft carriers and big-deck amphibious ships,
// compiled from public open-source reporting (USNI News Fleet & Marine Tracker,
// The War Zone "Where Are The Aircraft Carriers?"). Ships at sea are placed at a
// representative point in the reported body of water — NOT a real-time fix.
//
// confidence: high   = in port / reported at a named location
//             medium = reported in a named sea or exercise area
//             low    = not covered by recent reporting; shown at homeport/yard
// The uncertainty ring drawn on the globe scales with confidence.
// w = Wikipedia article title, used to fetch the ship's photo.
window.FF_NAVAL_AS_OF = "2026-10-27";
window.FF_NAVAL_SOURCES = [
  { label: "USNI News Fleet & Marine Tracker (Oct. 26, 2026)", url: "https://news.usni.org/2026/10/26/usni-news-fleet-and-marine-tracker-oct-26-2026" },
  { label: "TWZ: Where Are The Aircraft Carriers? (Oct. 27, 2026)", url: "https://www.twz.com/sea/where-are-the-aircraft-carriers-october-27-2026" },
  { label: "USNI News Western Pacific Pulse (Oct. 16, 2026)", url: "https://news.usni.org/2026/10/16/usni-news-western-pacific-pulse-oct-16-2026" },
  { label: "USNI News Fleet & Marine Tracker (Oct. 13, 2026)", url: "https://news.usni.org/2026/10/13/usni-news-fleet-and-marine-tracker-oct-13-2026" },
  { label: "USNI News Fleet & Marine Tracker (Oct. 5, 2026)", url: "https://news.usni.org/2026/10/05/usni-news-fleet-and-marine-tracker-oct-5-2026" },
];

window.FF_NAVAL = [
  // ---------------- Aircraft carriers ----------------
  { n: "USS Nimitz (CVN-68)", w: "USS Nimitz", t: "carrier", lat: 36.6, lon: -75.0, conf: "low", status: "Underway for training", area: "Western Atlantic (est.)",
    d: "Final years of service; used mainly for training ahead of planned deactivation. Reported getting underway for training Oct. 27." },
  { n: "USS Dwight D. Eisenhower (CVN-69)", w: "USS Dwight D. Eisenhower", t: "carrier", lat: 36.3, lon: -74.3, conf: "medium", status: "Work-ups", area: "Virginia Capes operating area (est.)",
    d: "Departed Naval Station Norfolk Oct. 24 for pre-deployment work-ups." },
  { n: "USS Carl Vinson (CVN-70)", w: "USS Carl Vinson", t: "carrier", lat: 32.699, lon: -117.215, conf: "low", status: "Not in recent reporting", area: "Homeport: NAS North Island, San Diego",
    d: "Shown at homeport; no current location found in recent public reporting." },
  { n: "USS Theodore Roosevelt (CVN-71)", w: "USS Theodore Roosevelt (CVN-71)", t: "carrier", lat: 25.0, lon: 133.0, conf: "medium", status: "Deployed — exercise Keen Sword 27", area: "Philippine Sea",
    d: "Westward deployment; port call at Yokosuka mid-October, then multilateral exercise Keen Sword 27 in the Philippine Sea." },
  { n: "USS Abraham Lincoln (CVN-72)", w: "USS Abraham Lincoln (CVN-72)", t: "carrier", lat: 32.699, lon: -117.215, conf: "high", status: "In port — post-deployment", area: "San Diego, CA",
    d: "Returned Oct. 8 from a 321-day deployment. Expected homeport shift to Bremerton, WA, for overhaul." },
  { n: "USS George Washington (CVN-73)", w: "USS George Washington (CVN-73)", t: "carrier", lat: 19.5, lon: 62.5, conf: "medium", status: "Deployed — Middle East operations", area: "Arabian Sea",
    d: "Forward-deployed (Yokosuka) carrier reported operating in the Arabian Sea with Carrier Air Wing 5 and USS Shoup (DDG-86)." },
  { n: "USS John C. Stennis (CVN-74)", w: "USS John C. Stennis", t: "carrier", lat: 36.985, lon: -76.443, conf: "medium", status: "Refueling and complex overhaul", area: "Newport News Shipbuilding, VA",
    d: "Mid-life refueling and complex overhaul (RCOH)." },
  { n: "USS Harry S. Truman (CVN-75)", w: "USS Harry S. Truman", t: "carrier", lat: 36.946, lon: -76.303, conf: "low", status: "Not in recent reporting", area: "Homeport: Naval Station Norfolk",
    d: "Shown at homeport; no current location found in recent public reporting (scheduled to begin RCOH)." },
  { n: "USS Ronald Reagan (CVN-76)", w: "USS Ronald Reagan", t: "carrier", lat: 32.705, lon: -117.205, conf: "medium", status: "Carrier qualifications / in port", area: "San Diego, CA",
    d: "Completed Fleet Replacement Squadron carrier qualifications off Southern California; moored at NAS North Island Oct. 27." },
  { n: "USS George H.W. Bush (CVN-77)", w: "USS George H.W. Bush", t: "carrier", lat: 22.5, lon: 60.8, conf: "medium", status: "Deployed — Middle East operations", area: "Arabian Sea / Gulf of Oman",
    d: "Reported operating in the Arabian Sea as one of two carriers supporting operations against Iran." },
  { n: "USS Gerald R. Ford (CVN-78)", w: "USS Gerald R. Ford", t: "carrier", lat: 36.950, lon: -76.310, conf: "low", status: "Not in recent reporting", area: "Homeport: Naval Station Norfolk",
    d: "Shown at homeport; no current location found in recent public reporting." },

  // ---------------- Amphibious assault ships ----------------
  { n: "USS Tripoli (LHA-7)", w: "USS Tripoli (LHA-7)", t: "amphib", lat: 33.160, lon: 129.716, conf: "medium", status: "Forward-deployed — in port", area: "Sasebo, Japan",
    d: "Forward-deployed amphibious assault ship; reported in port in Sasebo (Oct. 5 tracker)." },
  { n: "USS Makin Island (LHD-8) ARG / 13th MEU", w: "USS Makin Island", t: "amphib", lat: 21.0, lon: -160.0, conf: "low", status: "Deployed", area: "Eastern / Central Pacific (est.)",
    d: "Departed San Diego on deployment Sept. 28 with USS Anchorage (LPD-23), USS John P. Murtha (LPD-26) and the 13th MEU. Position estimated." },
];
