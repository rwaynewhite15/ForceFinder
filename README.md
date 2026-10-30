# ForceFinder

A Google Earth–style 3D globe showing approximate locations of US military installations
and naval assets (aircraft carriers, amphibious assault ships), all from open sources.

Built with [CesiumJS](https://cesium.com/platform/cesiumjs/). It has no build step and needs no API keys.

## Features

- **~225 installations** worldwide (Army, Navy, Air Force, Marine Corps, Space Force, joint),
  with a symbol for each type (air base, naval base, HQ, space/missile defense, rotational site).
- **Carriers and big-deck amphibs** with a dated position, a confidence rating, and an
  uncertainty ring (±15 km in port, up to ±500 km when only the ocean area is known).
- **Live military aircraft** (optional) from public ADS-B feeds (adsb.lol, then airplanes.live as backup),
  filtered to the US military ICAO address block. This only shows aircraft that are broadcasting a transponder.
- **Photos** in the details panel when you click an asset. Bases and ships use the lead image of
  the matching Wikipedia article. Live aircraft use a photo of that exact airframe (looked up by its
  transponder ID) from Planespotters.net. Each photo is credited and links to its source.
- Satellite, dark and light basemaps, marker clustering, search, branch filters, and click-for-details.

## Run it

Open `index.html` in a browser, or serve the folder (recommended):

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

To host it for free, enable GitHub Pages on this repo (Settings → Pages → deploy from `main`, root).

## Updating the data

| File | Contents |
|------|----------|
| `data/bases.js` | Installations (`n` name, optional `w` Wikipedia title for the photo, `b` branch, `c` category, `cc` location, `lat`/`lon`, `d` notes) |
| `data/naval.js` | Ship positions (`w` = Wikipedia article title for the photo), `FF_NAVAL_AS_OF` date, and source links |

Ship positions change weekly. To refresh them, use the
[USNI News Fleet & Marine Tracker](https://news.usni.org/category/fleet-tracker) (published on Mondays)
or TWZ's "Where Are The Aircraft Carriers?" series. Update each ship's `lat`/`lon`, `status`, `area`,
`conf`, and `FF_NAVAL_AS_OF`.

## Disclaimer

All data comes from publicly available reporting and is approximate. Ships at sea are placed at
a representative point in the reported body of water, and those reports are often several days old.
Do not use this for operational purposes.
