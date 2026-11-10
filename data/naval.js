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
window.FF_NAVAL_AS_OF = "2026-11-09";
window.FF_NAVAL_SOURCES = [
  { label: "USNI News Fleet & Marine Tracker (Nov. 9, 2026)", url: "https://news.usni.org/2026/11/09/usni-news-fleet-and-marine-tracker-nov-9-2026" },
  { label: "Maritime Executive: Theodore Roosevelt CSG leaves Singapore (Nov. 2026)", url: "https://maritime-executive.com/article/uss-theodore-roosevelt-csg-leaves-singapore-bound-for-the-gulf" },
  { label: "Misbar: tracking Theodore Roosevelt from Singapore (Nov. 9, 2026)", url: "https://www.misbar.com/en/editorial/2026/11/09/misbar-tracks-uss-theodore-roosevelts-transit-singapore-toward-middle-east" },
  { label: "USNI News: Theodore Roosevelt CSG pulls into Singapore (Nov. 6, 2026)", url: "https://news.usni.org/2026/11/06/theodore-roosevelt-carrier-strike-group-pulls-into-singapore" },
  { label: "TWZ: USS Theodore Roosevelt arrives in Singapore (Nov. 2026)", url: "https://www.twz.com/sea/uss-theodore-roosevelt-arrives-in-singapore-last-stop-before-third-strike-group-reaches-the-middle-east" },
  { label: "RANE: U.S. Naval Update Map (Nov. 5, 2026)", url: "https://worldview.ranenetwork.com/content/analysis/2026-11-04/u-s-naval-update-map-nov-5-2026/fff4e3015afc59f8" },
  { label: "Misbar: satellite images of USS Theodore Roosevelt transiting (Nov. 5, 2026)", url: "https://www.misbar.com/en/editorial/2026/11/05/satellite-images-show-uss-roosevelt-transiting-southeast-asia-middle-east" },
  { label: "Defence Blog: satellite imagery of Theodore Roosevelt CSG (Nov. 4, 2026)", url: "https://defence-blog.com/chinese-satellites-track-u-s-carrier-group-crossing-south-china-sea/" },
  { label: "USNI News Fleet & Marine Tracker (Nov. 2, 2026)", url: "https://news.usni.org/2026/11/02/usni-news-fleet-and-marine-tracker-nov-2-2026" },
  { label: "USNI News Fleet & Marine Tracker (Oct. 26, 2026)", url: "https://news.usni.org/2026/10/26/usni-news-fleet-and-marine-tracker-oct-26-2026" },
  { label: "TWZ: Where Are The Aircraft Carriers? (Oct. 27, 2026)", url: "https://www.twz.com/sea/where-are-the-aircraft-carriers-october-27-2026" },
  { label: "US Navy: Makin Island ARG / 13th MEU arrive in Yokosuka (Oct. 26, 2026)", url: "https://www.navy.mil/Press-Office/News-Stories/display-news/Article/4633316/makin-island-amphibious-ready-group-13th-marine-expeditionary-unit-arrive-in-yo/" },
  { label: "19FortyFive: USS Harry S. Truman out of action (Oct. 2026)", url: "https://www.19fortyfive.com/2026/10/100000-ton-us-navy-nuclear-nimitz-class-aircraft-carrier-uss-harry-s-truman-just-declared-out-of-action-indefinitely/" },
  { label: "USS Gerald R. Ford (Wikipedia)", url: "https://en.wikipedia.org/wiki/USS_Gerald_R._Ford" },
  { label: "TWZ: Where Are The Aircraft Carriers? (Oct. 17, 2026)", url: "https://www.twz.com/sea/where-are-the-aircraft-carriers-october-17-2026" },
  { label: "USNI News Fleet & Marine Tracker (Oct. 5, 2026)", url: "https://news.usni.org/2026/10/05/usni-news-fleet-and-marine-tracker-oct-5-2026" },
];

window.FF_NAVAL = [
  // ---------------- Aircraft carriers ----------------
  { n: "USS Nimitz (CVN-68)", w: "USS Nimitz", t: "carrier", lat: 36.6, lon: -75.0, conf: "medium", status: "Underway for training", area: "Atlantic Ocean",
    d: "Final years of service; used mainly for training ahead of planned deactivation in 2027. Got underway for training Oct. 27 and listed underway in the Atlantic on RANE's Nov. 5 naval map." },
  { n: "USS Dwight D. Eisenhower (CVN-69)", w: "USS Dwight D. Eisenhower", t: "carrier", lat: 36.3, lon: -74.3, conf: "medium", status: "Work-ups", area: "Virginia Capes operating area (est.)",
    d: "Departed Naval Station Norfolk Oct. 24 for pre-deployment work-ups; listed underway in the Atlantic on RANE's Nov. 5 naval map." },
  { n: "USS Carl Vinson (CVN-70)", w: "USS Carl Vinson", t: "carrier", lat: 32.699, lon: -117.215, conf: "low", status: "Not in recent reporting", area: "Homeport: NAS North Island, San Diego",
    d: "Shown at homeport; no current location found in recent public reporting." },
  { n: "USS Theodore Roosevelt (CVN-71)", w: "USS Theodore Roosevelt (CVN-71)", t: "carrier", lat: 5.5, lon: 95.0, conf: "medium", status: "Deployed — transiting to Middle East", area: "Strait of Malacca / eastern Indian Ocean (est.)",
    d: "After a Nov. 6 port visit at Changi Naval Base, Singapore, Maritime Executive and Misbar reported the strike group left Singapore heading west toward the Gulf; position shown is an estimate along that route. It is expected to relieve the George Washington; a US official told Axios it would not enter Central Command's area before mid-November." },
  { n: "USS Abraham Lincoln (CVN-72)", w: "USS Abraham Lincoln (CVN-72)", t: "carrier", lat: 32.699, lon: -117.215, conf: "high", status: "In port — post-deployment", area: "San Diego, CA",
    d: "Returned Oct. 8 from a 321-day deployment. Expected homeport shift to Bremerton, WA, for overhaul." },
  { n: "USS George Washington (CVN-73)", w: "USS George Washington (CVN-73)", t: "carrier", lat: 19.5, lon: 62.5, conf: "medium", status: "Deployed — Middle East operations", area: "Arabian Sea",
    d: "Forward-deployed (Yokosuka) carrier operating in the Arabian Sea with Carrier Air Wing 5 and USS Shoup (DDG-86), per the Nov. 9 USNI tracker. In the region since Aug. 19 and expected to be relieved by the Theodore Roosevelt." },
  { n: "USS John C. Stennis (CVN-74)", w: "USS John C. Stennis", t: "carrier", lat: 36.985, lon: -76.443, conf: "medium", status: "Refueling and complex overhaul", area: "Newport News Shipbuilding, VA",
    d: "Mid-life refueling and complex overhaul (RCOH)." },
  { n: "USS Harry S. Truman (CVN-75)", w: "USS Harry S. Truman", t: "carrier", lat: 36.990, lon: -76.450, conf: "high", status: "Refueling and complex overhaul", area: "Newport News Shipbuilding, VA",
    d: "Reported to have entered the shipyard phase of its mid-life refueling and complex overhaul (RCOH) on Sept. 30; completion scheduled for 2031." },
  { n: "USS Ronald Reagan (CVN-76)", w: "USS Ronald Reagan", t: "carrier", lat: 32.705, lon: -117.205, conf: "medium", status: "Carrier qualifications / in port", area: "San Diego, CA",
    d: "Completed Fleet Replacement Squadron carrier qualifications off Southern California; moored at NAS North Island Oct. 27." },
  { n: "USS George H.W. Bush (CVN-77)", w: "USS George H.W. Bush", t: "carrier", lat: 22.5, lon: 60.8, conf: "medium", status: "Deployed — Middle East operations", area: "Arabian Sea / Gulf of Oman",
    d: "Listed in the Arabian Sea supporting US operations against Iran in the Nov. 9 USNI tracker." },
  { n: "USS Gerald R. Ford (CVN-78)", w: "USS Gerald R. Ford", t: "carrier", lat: 36.815, lon: -76.295, conf: "high", status: "Planned incremental availability", area: "Norfolk Naval Shipyard, Portsmouth, VA",
    d: "In a planned maintenance period at Norfolk Naval Shipyard since July, after a 326-day deployment that ended in May." },

  // ---------------- Amphibious assault ships ----------------
  { n: "USS Tripoli (LHA-7)", w: "USS Tripoli (LHA-7)", t: "amphib", lat: 33.160, lon: 129.716, conf: "medium", status: "Forward-deployed — in port", area: "Sasebo, Japan",
    d: "Forward-deployed amphibious assault ship; reported in port in Sasebo (Oct. 5 tracker)." },
  { n: "USS Makin Island (LHD-8) ARG / 13th MEU", w: "USS Makin Island", t: "amphib", lat: 38.5, lon: 134.5, conf: "medium", status: "Deployed — underway", area: "Sea of Japan",
    d: "The Nov. 9 USNI tracker said Makin Island left Yokosuka on Saturday (Nov. 7), according to ship spotters, and the group, including USS John P. Murtha with 13th MEU Marines, is operating in the Sea of Japan. Fox News earlier reported, citing US officials, that the group is bound for the Middle East." },
];
