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
- **Recent conflict events** (Iran war / Strait of Hormuz, Russia–Ukraine, Israel–Gaza/Lebanon, Sudan,
  South China Sea, China–Taiwan), each with an icon for its type (strike, missile, drone, naval incident,
  ground fighting, exercise, diplomacy) and links to the news reports it comes from. Events from the last
  few days pulse, dashed arcs show approximate attack direction for long-range strikes, and you can filter
  by conflict and time window.
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

It is hosted on GitHub Pages by the `update-and-deploy` workflow. See the setup steps under Automatic daily updates below.

## Updating the data

| File | Contents |
|------|----------|
| `data/bases.js` | Installations (`n` name, optional `w` Wikipedia title for the photo, `b` branch, `c` category, `cc` location, `lat`/`lon`, `d` notes) |
| `data/events.js` | Conflict events (`date`, `title`, `type`, `conflict`, `lat`/`lon`, `d` summary, `src` links, optional `from` launch area) and `FF_EVENTS_AS_OF` |
| `data/naval.js` | Ship positions (`w` = Wikipedia article title for the photo), `FF_NAVAL_AS_OF` date, and source links |

### Automatic daily updates

`data/events.js` and `data/naval.js` are refreshed every day by the
[`update-and-deploy`](.github/workflows/update-and-deploy.yml) GitHub Action, which then redeploys the site.
It runs [`scripts/update-data/update.mjs`](scripts/update-data/update.mjs), which uses the Claude API in two steps:

1. **Research:** Claude searches the web (news, USNI's Fleet & Marine Tracker, TWZ and others) and writes
   notes with a source URL for every fact.
2. **Extract:** a second call turns the notes into JSON that matches a strict schema.

The script then checks the result in code before writing anything:

- Every source URL must have appeared in that run's search or fetch results, or in the existing data.
  Events with no verifiable link are dropped.
- Dates can't be in the future, and events older than 21 days age out.
- Coordinates must be valid. A ship with a bad update keeps its previous entry.
- If fewer than 5 events survive, nothing is written.

**Setup (once):**

1. Repo **Settings → Secrets and variables → Actions → New repository secret**: name `ANTHROPIC_API_KEY`,
   value your key from [console.anthropic.com](https://console.anthropic.com).
2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Run it once by hand: **Actions → Update data and deploy site → Run workflow**.

**Cost:** each run makes up to 23 web searches ($10 per 1,000) plus four Claude calls on Claude Opus 5.5
($4 / $20 per million input/output tokens). Expect roughly $0.50–$2 per run, so about $15–$60 a month
for daily runs. To spend less, set the repository variable `FF_MODEL` to `claude-sonnet-5-5`
(about half the token price), or change the `cron` line to run less often. The token use of each call is
printed in the Action log.

To run it locally: `cd scripts/update-data && npm ci && ANTHROPIC_API_KEY=... node update.mjs`
(add `--dry-run` to see what would change without writing files).

### Manual edits

You can still edit the files by hand. The next automatic run passes the current events to Claude and
keeps those from the last 21 days, so manual additions carry forward if they have a source link.

## Disclaimer

All data comes from publicly available reporting and is approximate. Ships at sea are placed at
a representative point in the reported body of water, and those reports are often several days old.
Do not use this for operational purposes.
