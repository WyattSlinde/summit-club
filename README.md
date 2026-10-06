# SUMMIT Basecamp

Cathedral Catholic High School outdoor adventure, service, and leadership club.

## What works

- A live Three.js forest whose walking position is driven directly by native page scroll. Stopping holds position; scrolling backward retraces the route. The camera stays about 1.78 m above the ground, and SUMMIT appears after reaching the overlook. There is no video player, frame sequence, automatic walking, or aerial camera lift.
- One shared 3D landscape continues behind the club introduction, outings, and ideas. The club page emerges over that landscape instead of switching to a separate forest photograph. Forest green, moss, and warm paper colors are shared by the journey, content, and signup dialogs.
- Reduced-motion and WebGL-error fallbacks, a skip-to-club link, and a navigation bar that arrives with the summit reveal.
- Three Explore / Serve / Lead stops explain the club during the hike; students can jump to a stop, look left/right, recenter, drag to look around on desktop, or swipe sideways on touchscreens while retaining native vertical scrolling.
- A 27% shorter, sunlit green trail with denser pines, ferns, grasses, wooden markers, fallen timber, stone cairns, grazing deer, rabbits, birds, and subtle daylight pollen. Plant and wildlife motion pauses offscreen; reduced-motion users get a static entrance.
- Photographic pine-needle, moss-floor and compacted-soil materials on the live 3D landscape, soft irregular track edges, textured bark, gentle tree movement and nearby detail shadows.
- Rebuilt deer and rabbits with continuous anatomical meshes, fur coloration, articulated limbs and quiet responses as the camera approaches. A binocular button eases into a close-up of nearby wildlife; scrolling, turning or pressing it again restores the wide view.
- Varied trail width, rolling banks, exposed roots, scattered mossy stone and a shallow animated brook. The entrance has mature conifers, young trees and light-barked leafy groves, with lupines, cream and gold wildflowers, low shrubs and butterflies. Nearby terrain has denser geometry, while distant terrain and phone vegetation use lighter detail.
- A brighter meadow entrance with warmer bark, open tree crowns, smaller foreground boulders and more flowering patches. Forest stands have separate bounds so offscreen trees can be skipped; a 12-second graphics-loading deadline falls back to the accessible club layout if initialization stalls.
- Proportioned pine sprays and exposed branch joints, irregular moss and needle beds, lower foothills, and a narrow recessed brook. Tree detail changes with camera distance; distant understory and trunks are culled to reduce rendering work.
- A short club page: who can join, meeting status, club leadership, signup, outing voting and suggestions. Full SUMMIT/PEAK values are optional expandable content.
- Three selectable outing ideas, live vote counts, downloadable field notes, and a device-local packing checklist.
- Authenticated club-interest registration and a personalized downloadable SVG field pass.
- Database-backed voting and adventure proposals.
- Leadership desk: view interest and ideas, publish/cancel events, and inspect RSVPs.
- Student calendar with persistent RSVPs.

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

Earlier local checks covered unauthenticated write rejection, cross-origin rejection, malformed submissions, member privacy, duplicate vote prevention, leadership authorization, event creation, idempotent RSVPs, cancellation, and stale-event rejection. Earlier browser checks covered desktop/mobile layout and the club flows.

The October 5 repairs were checked with TypeScript, a production build, HTTP readiness and asset checks, and geometry validation. The later scroll-driven revision adds `npm run test:journey`: six regression checks cover paused position, backward travel, human eye height, the overlook reveal, reduced motion, and invalid scroll input. Server-rendered HTML also confirms one shared canvas, the club sections, and no video element. Rendering is held once the club is revealed, avoiding continuous scene rendering behind the lower page.

Earlier CPU estimates for forest and understory geometry at the entrance were about 1.17 million triangles on desktop and 357,000 on mobile; these are not GPU timing measurements. Fresh browser and visual verification was blocked by the browser tool's URL security policy, so the latest scenery and layout still require an in-browser check.

## Design references

The new visual direction uses one deep-forest/moss/warm-paper/trail-amber palette and original generated landscape assets. Research references included [JavaScript Mastery's React/Three.js/GSAP video](https://www.youtube.com/watch?v=DEeaT6FxEws) and [Bruno Simon's interactive portfolio](https://bruno-simon.com/). No reference-site code or artwork was copied.

Forest structure and the contrast between shaded groves and flowering clearings were informed by the National Park Service's [Giant Forest trails](https://www.nps.gov/seki/planyourvisit/gfdayhikesum.htm) and [Crescent Meadow](https://home.nps.gov/thingstodo/crescent-meadow.htm). This is an original imagined environment, not a recreation of those trails. The forest, terrain, plants and water are procedural geometry and shaders; the reference photos were not downloaded or used as website assets.

The brighter entrance also draws on the [Big Trees Trail photograph](https://www.nps.gov/thingstodo/big-trees-trail.htm): warm trunks, visible sky above a meadow, varied tree ages and sunlight on the low vegetation.
