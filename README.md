# SUMMIT Basecamp

Cathedral Catholic High School outdoor adventure, service, and leadership club.

## What works

- A Higgsfield-generated photographic mountain hike, delivered as 433 local WebP frames. Native page scroll chooses the exact fractional frame position, blending its two neighboring images: stop to hold the view, scroll backward to retrace the path. There is no video element, autoplay, playback clock, or automatic camera motion.
- A mule deer beside the opening trail, a distant hawk, and a peach-and-lavender sunset. Narrow screens begin on the deer and ease toward the path as you scroll.
- An uphill forest-and-granite climb with a fixed camera hold at the peak. SUMMIT rises from behind the foreground ridge, then continued scrolling carries the camera over the crest and down into the club page. Every stage can be reversed with scroll.
- Responsive motion frames while scrolling, followed by a 2560×1440 desktop or 1008×1792 portrait refinement of the same view after a short pause. The loader prioritizes the requested frame, cancels stale work, prefetches nearby poses, and bounds decoded memory. Retina-aware canvas sizing, a loading poster, request timeouts, and a still-image fallback remain available.
- Reduced-motion and data-saver visitors receive a static overlook and ordinary club page. Everyone has a skip-to-club link.
- Explore / Serve / Lead trail stops, reversible scrubbing, and a replay link. The cinematic camera is fixed to the generated path; free 3D turning is not part of this version.
- A continuous forest-green arrival and club page with sunset-peach controls: what the club does, who can join, real meeting status, Tobias Kell's leadership, signup, outing votes and suggestions. Full SUMMIT/PEAK values are expandable.
- Three selectable outing proposals, live vote counts, downloadable notes, and a device-local packing checklist.
- Plain authenticated interest registration with a simple saved-details confirmation, database-backed voting and proposals, event RSVPs, and a leadership desk. There is no ticket or pass.

## Club photography

Real photographs replace the generated stills in the club arrival and all three outing panels. Local 800px/1600px WebP files use responsive `srcset` selection and lazy loading. Original photographers are credited below each image; documentary locations stay separate from the proposed club plans. The images are under the Unsplash License or marked as public-domain NPS works. See [photo credits and licenses](public/photos/credits.txt).

## Journey media

The generated source clip is a production asset, not a website player. Its source job and generation prompts are recorded in `journey-provenance.json`. The website ships derived frames and three stills in `public/ascent-hd/`, plus lightweight copies in `public/ascent-motion/`; no external Higgsfield URL is needed at runtime. The complete motion sequence is 24.4 MiB at 960×540 desktop or 17.1 MiB at 540×960 portrait. Only the matching viewport variant loads, progressively as needed. Four concurrent motion requests prioritize the current pose; speculative requests can be canceled immediately when direction or position changes. The motion cache holds up to 32 decoded frames (plus transient in-flight decodes) and 128 compressed frames. After 100ms on the same pose, up to two HD requests refine the adjacent images without changing their blend; the separate HD cache holds two decoded frames and four compressed frames. The complete HD sequence is 139.9 MiB desktop or 55.5 MiB portrait, but it is not prefetched in full. Resizing across the portrait threshold replaces the sequence. The canvas only advances to positions requested by scroll; HD refinement never changes the camera pose. The 3840×2160 source was enhanced from a 1080p generation; it is not native 4K camera footage.

To prepare replacement media, use `FFMPEG_PATH=/path/to/ffmpeg node scripts/prepare-journey.mjs /path/to/source.mp4 ascent-hd 340` with a fresh media directory and the chosen summit-frame index. The script samples 24 frames per source second, applies the scroll-aligned portrait crop, produces HD and motion variants for both screen shapes and updates `app/journey-media.json`. FFmpeg is an authoring tool and is not required to run the site. Restart the development server after generating a new media directory so its public-asset index includes the new files.

The climb now spans 7.8 viewport heights (previously 4.2), with three separate Explore / Serve / Lead passages. Their fades, camera poses, title rise, and ridge reveal all follow scroll position; there is no trailing animation loop. The arrival shares the final overlook scenery behind its readable forest overlay.

The leadership desk includes a searchable registration roster, interest filters, per-member outing votes, aggregate interest/vote counts, student ideas, event publishing/cancellation, and RSVP lists. Leaders can export the currently filtered roster as a CSV; spreadsheet formula prefixes are escaped. The roster shows up to 2,000 registrations and the 500 latest ideas, with explicit notices when those limits are reached.

## Public GitHub repository

The public source repository is [WyattSlinde/summit-club](https://github.com/WyattSlinde/summit-club). Collaborators can clone it or fork it and open a pull request. Direct pushes require repository write access from the owner. Environment files, credentials, dependencies, build output, and local database records are excluded from Git.

This repository URL shares the code, not a hosted website. No GitHub Pages deployment is configured. Follow the local setup below to run the application and its database-backed features.

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

After the first setup, double-click `Start SUMMIT.command` on macOS, or run `npm run preview:local`. The launcher checks for an existing SUMMIT server, starts one if needed, waits for a successful response, and opens the address. It leaves unrelated processes alone. Use `node scripts/open-local.mjs --check` for a readiness check without opening a browser. The development server fails explicitly on a port conflict instead of silently choosing another port. Generated frame exports, build output, and local Worker state are excluded from the development reload watcher to avoid mass invalidations while media is prepared.

The starter simulates sign-in only in local development. Clicking Sign in with ChatGPT locally uses its demo identity. That demo identity can open Leadership desk in the footer. This local-only permission is compiled out of the production build.

For a built-worker preview, stop the development server and run `npm run preview:production` after building. This mode does not provide the development sign-in simulation.

## Production setup

Reuse project `appgprj_6abf0fbf6f848191a6ae788a7cd47a39`. The application uses the Sites D1 binding `DB`; schema migrations are in `drizzle/`.

Set the hosted `SUMMIT_LEADER_IDS` environment variable to a comma-separated list of the club leaders' Site-scoped authenticated user IDs. The existing single `SUMMIT_LEADER_ID` variable remains supported. Do not use a name, browser parameter, or unverified email as a substitute. Leadership endpoints fail closed when it is unset. Authentication is provided by Sites, not by an app password database.

Publication has not completed: the current environment rejects the Sites workflow credential-input action because required sandbox approval is disabled. The local preview and production build are available, but there is no verified live URL.

## Content and demo boundaries

- The interactive intro uses generated Higgsfield scenery. The club page uses four real photographs: a mountain sunset, a group hike in the Tetons, a Fire Island beach cleanup, and Joshua Tree trail volunteers. These illustrate possible experiences, not completed SUMMIT trips or confirmed future locations. Each photo has a visible source credit; full license details are in `public/photos/credits.txt`. Asset prompts and historical provenance remain in ASSET-NOTES.txt.
- Three initial activities are proposals; no unconfirmed meeting dates are presented as real.
- Saved registration records club interest; outing RSVPs and any required permissions are handled separately.
- Local development data is separate from the future hosted database. Demo test records are not included in the downloadable source.
- Real dates, permissions, trip details, and leadership access need club review before public launch.

## Validation

An isolated SQLite integration test executes the actual route handlers against the generated migrations. It covers two student accounts, two leaders, production rejection of the demo identity, private member data, signup interests, per-member votes, idea attribution, export formula escaping, event creation, and duplicate/cancelled RSVPs. No real registration records are used or changed. Earlier API checks covered unauthenticated write rejection, cross-origin rejection, malformed submissions, member privacy, duplicate vote prevention, leadership authorization, event creation, idempotent RSVPs, cancellation, and stale-event rejection.

The cinematic revision is checked with TypeScript, scoped ESLint, a production build, HTTP readiness and asset validation, and `npm run test:journey`. Journey tests cover exact pause/reverse mapping, summit title hold and descent, reveal bounds, resize/fallback reading position, reduced motion, directional prefetch, cache limits/disposal, out-of-order decoding, missing-media fallback, Retina allocation limits, easing into the summit hold, and wildlife framing. The journey suite has 22 tests, including subframe forward/reverse blending and same-pose HD refinement. Run `npm test` for all 24 motion, export, and backend tests. The loader suite also covers rapid direction changes, cancellation at full request capacity, obsolete decodes, exact-pose HD refinement, optional-HD failure, preview fallback, HD eviction, and idle decode churn. A simulated 70ms network / 8ms decode run delivered all 32 sequential target frames immediately from cache with a peak of 33 live bitmaps; this is a deterministic loader test, not a browser FPS measurement. Club UI server-render checks cover loading/error states, a real meeting date, populated votes and unknown vote counts.

The generated source, edited sunset sequence, enhanced output, and both joins were inspected as contact sheets or individual frames. A discontinuity in the original generation was replaced with a separately generated four-second climb; a brief blend eases the second join. The landscape is generated, so minor geometry/motion artifacts remain possible. Browser automation for localhost was rejected by the browser URL security policy; the rebuilt page still needs a fresh interactive browser check. These source/HTTP checks do not establish final rendered layout or scroll smoothness on a physical phone.

## Design references

The visual direction carries deep forest through the entire club page, with sunset peach controls and warm stone signup dialogs and original generated landscape assets. Research references included [JavaScript Mastery's React/Three.js/GSAP video](https://www.youtube.com/watch?v=DEeaT6FxEws) and [Bruno Simon's interactive portfolio](https://bruno-simon.com/). No reference-site code or artwork was copied.

Forest structure and the contrast between shaded groves and flowering clearings were informed by the National Park Service's [Giant Forest trails](https://www.nps.gov/seki/planyourvisit/gfdayhikesum.htm) and [Crescent Meadow](https://home.nps.gov/thingstodo/crescent-meadow.htm). This is an original imagined environment, not a recreation of those trails. Those references informed the earlier procedural scene. The current hike uses original Higgsfield-generated frames; no reference-site artwork is included.

The brighter entrance also draws on the [Big Trees Trail photograph](https://www.nps.gov/thingstodo/big-trees-trail.htm): warm trunks, visible sky above a meadow, varied tree ages and sunlight on the low vegetation.
