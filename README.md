# SUMMIT Basecamp

Cathedral Catholic High School outdoor adventure, service, and leadership club.

## What works

- A Higgsfield-generated photographic mountain hike, delivered as 241 local WebP frames. Native page scroll chooses the exact frame: stop to hold the view, scroll backward to retrace the path. There is no video element, autoplay, playback clock, or automatic camera motion.
- A continuous forest-to-overlook shot with vibrant pines, ferns, flowers, rocky trail and a grazing deer. SUMMIT appears at the overlook; the club field journal rises into view below it.
- Separate desktop/mobile frames, four concurrent requests, compressed prefetch, a bounded decoded-image cache, a static poster while loading, per-request timeouts, and an accessible still-image fallback.
- Reduced-motion and data-saver visitors receive a static overlook and ordinary club page. Everyone has a skip-to-club link.
- Explore / Serve / Lead trail stops, reversible scrubbing, and a replay link. The cinematic camera is fixed to the generated path; free 3D turning is not part of this version.
- A concise forest-green and warm-paper club page: what the club does, who can join, real meeting status, Tobias Kell's leadership, signup, outing votes and suggestions. Full SUMMIT/PEAK values are expandable.
- Three selectable outing proposals, live vote counts, downloadable notes, and a device-local packing checklist.
- Authenticated interest registration, a downloadable SVG club pass, database-backed voting and proposals, event RSVPs, and a leadership desk.

## Journey media

The generated source clip is a production asset, not a website player. Its source job and generation prompts are recorded in `journey-provenance.json`. The website ships only the derived frames and two stills in `public/journey/`; no external Higgsfield URL is needed at runtime. The desktop sequence is about 29.6 MiB and the mobile sequence about 15.0 MiB, prefetched progressively. Only one variant loads per visit.

To prepare replacement media, use `FFMPEG_PATH=/path/to/ffmpeg node scripts/prepare-journey.mjs /path/to/source.mp4` with empty frame output folders. The script produces both sizes and updates `app/journey-media.json`. FFmpeg is an authoring tool and is not required to run the site.

## Local development

Requires Node 22.13 or newer. Run `npm ci`, then `npm run build`.
Apply each migration in order, once, from the project directory:

```
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_nervous_northstar.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_wild_major_mapleleaf.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_solid_yellowjacket.sql
npm run dev
```

Open http://127.0.0.1:4173/ or http://localhost:4173/. Both `npm run dev` and `npm start` run the development server on port 4173. Keep its terminal running while using the local website; restarting the computer or stopping the server makes this local address unavailable.

After the first setup, double-click `Start SUMMIT.command` on macOS, or run `npm run preview:local`. The launcher checks for an existing SUMMIT server, starts one if needed, waits for a successful response, and opens the address. It leaves unrelated processes alone. Use `node scripts/open-local.mjs --check` for a readiness check without opening a browser. The development server fails explicitly on a port conflict instead of silently choosing another port.

The starter simulates sign-in only in local development. Clicking Sign in with ChatGPT locally uses its demo identity. That demo identity can open Leadership desk in the footer. This local-only permission is compiled out of the production build.

For a built-worker preview, stop the development server and run `npm run preview:production` after building. This mode does not provide the development sign-in simulation.

## Production setup

Reuse project `appgprj_6abf0fbf6f848191a6ae788a7cd47a39`. The application uses the Sites D1 binding `DB`; schema migrations are in `drizzle/`.

Set the hosted `SUMMIT_LEADER_ID` environment variable to the club leader's Site-scoped authenticated user ID. Do not use a name, browser parameter, or unverified email as a substitute. Leadership endpoints fail closed when it is unset. Authentication is provided by Sites, not by an app password database.

Publication has not completed: the current environment rejects the Sites workflow credential-input action because required sandbox approval is disabled. The local preview and production build are available, but there is no verified live URL.

## Content and demo boundaries

- The photographic landscapes are generated illustrations of an outdoor setting, not verified outing locations or school photography. Asset prompts and provenance are in ASSET-NOTES.txt.
- Three initial activities are proposals; no unconfirmed meeting dates are presented as real.
- A saved club pass records interest, not confirmed membership, an outing reservation, or a permission slip.
- Local development data is separate from the future hosted database. Demo test records are not included in the downloadable source.
- Real dates, permissions, trip details, and leadership access need club review before public launch.

## Validation

Earlier API checks covered unauthenticated write rejection, cross-origin rejection, malformed submissions, member privacy, duplicate vote prevention, leadership authorization, event creation, idempotent RSVPs, cancellation, and stale-event rejection.

The cinematic revision is checked with TypeScript, scoped ESLint, a production build, HTTP readiness and asset validation, and `npm run test:journey`. Journey tests cover exact pause/reverse mapping, reveal bounds, reduced motion, directional prefetch, cache limits/disposal, out-of-order decoding and missing-media fallback. Club UI server-render checks cover loading/error states, a real meeting date, populated votes and unknown vote counts.

The generated source was visually inspected as a contact sheet and checked for abrupt scene cuts. Browser automation for localhost was rejected by the browser URL security policy; the rebuilt page still needs a fresh interactive browser check. These source/HTTP checks do not establish final rendered layout or scroll smoothness on a physical phone.

## Design references

The new visual direction uses one deep-forest/moss/warm-paper/trail-amber palette and original generated landscape assets. Research references included [JavaScript Mastery's React/Three.js/GSAP video](https://www.youtube.com/watch?v=DEeaT6FxEws) and [Bruno Simon's interactive portfolio](https://bruno-simon.com/). No reference-site code or artwork was copied.

Forest structure and the contrast between shaded groves and flowering clearings were informed by the National Park Service's [Giant Forest trails](https://www.nps.gov/seki/planyourvisit/gfdayhikesum.htm) and [Crescent Meadow](https://home.nps.gov/thingstodo/crescent-meadow.htm). This is an original imagined environment, not a recreation of those trails. Those references informed the earlier procedural scene. The current hike uses original Higgsfield-generated frames; no reference-site artwork is included.

The brighter entrance also draws on the [Big Trees Trail photograph](https://www.nps.gov/thingstodo/big-trees-trail.htm): warm trunks, visible sky above a meadow, varied tree ages and sunlight on the low vegetation.
