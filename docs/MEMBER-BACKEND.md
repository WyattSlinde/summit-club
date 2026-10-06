# SUMMIT member accounts

Status: implemented and tested locally. The public GitHub Pages site is still a visual preview until a separate SUMMIT Supabase project and verified email delivery are configured. `lib/cloud-config.json` deliberately contains no project URL or key yet. No student records have been copied from the unrelated Lowkey project.

## What is implemented

- Email/password account creation, confirmation, confirmation resend, sign-in, password recovery, and sign-out on the current device.
- Club registration followed by a member profile: display name, photo, bio, outdoor interests, and a next-adventure note.
- A random friend tag, exact-tag requests, accept/decline/cancel, friend profiles, removal, blocking/unblocking, and tag rotation.
- Private profiles by default. Full profiles and photos become available only to accepted friends when the owner chooses that setting. Display names remain visible on requests and existing connections. No member directory or email lookup.
- Photo preview and square crop, on-device JPEG conversion, metadata removal, 768-pixel maximum dimensions, original upload limit of 10 MB, private storage limit of 2 MB, photo replacement/removal.
- Shared outing vote totals, personal saved votes, private ideas, confirmed events, and RSVPs using the same account.
- Approved leaders can view registrations, interests, votes, ideas, RSVPs, and member concerns; publish/cancel events; and export the roster. A student cannot assign themselves leadership access.
- Delete-club-profile flow clears registration, profile, private photo, friends, votes, proposals, and RSVPs. The authentication account remains so the student may register again. Auth-account deletion can be handled by the Supabase project owner.

The hiking sequence, scroll timeline, mountain reveal, and animated identity are unchanged.

## Activate the hosted backend

1. Obtain the owner's organization choice and cost approval, then create a dedicated SUMMIT Supabase project. Do not reuse another application's database.
2. Apply every SQL file in `supabase/migrations/` to the new project in timestamp order: member profiles first, then hike ratings and the gallery. Both files were created with Supabase CLI `migration new`.
3. Configure Auth Site URL as `https://wyattslinde.github.io/summit-club/`. Allow these exact redirects:
   - `https://wyattslinde.github.io/summit-club/profile/`
   - `https://wyattslinde.github.io/summit-club/profile/?recovery=1`
   Add localhost redirects only for development when needed.
4. Keep email confirmation enabled. Configure a production SMTP sender in the Supabase Auth settings. The default Supabase sender only delivers to organization team members; it cannot serve student registrations. Use a verified sending domain, enter credentials in the provider dashboard, and never commit them or paste them into client configuration. Set the minimum password length to 12. Review signup/email rate limits for the expected school traffic.
5. Set the project URL and **publishable** key using `node scripts/configure-member-backend.mjs --url <project-url> --key <publishable-key>`. This updates only public client configuration. Keep `authReady` false until signup, confirmation, sign-in, and recovery work with an approved test email outside the organization team. Then rerun with `--auth-ready`.
6. Register the real club leader. Obtain their account UUID from the leadership page and verify that it belongs to the intended person. An authorized project owner grants access with a SQL query:

   ```sql
   insert into private.club_leaders(user_id)
   values ('VERIFIED_LEADER_ACCOUNT_UUID'::uuid)
   on conflict do nothing;
   ```

   The browser cannot execute this mutation. Never derive leadership from editable profile fields, registration grade, or `user_metadata`.
7. Check Supabase security/performance advisors. Verify two separate test accounts: student A cannot read student B's private profile/photo; a pending request does not reveal those details; accepted friends see only opted-in profiles; blocking revokes access; neither student can read the leader roster or grant themselves access. Delete approved test records afterwards.
8. Run `npm test`, `npx tsc --noEmit`, `npm run build`, and `npm run build:github-preview`. Publish the static output to the existing `gh-pages` branch using the established deployment workflow. The profile route has its own `profile/index.html` for direct iPad links.
9. Verify the public deployment, registration, friendship request/acceptance, photo upload/download, vote persistence, and leader access from separate accounts. Local DOM/Postgres tests are not a substitute for this final hosted check.

## Data model and authorization

The public schema contains `members`, `profiles`, `friendships`, `blocks`, `member_reports`, `votes`, `proposals`, `events`, and `rsvps`. Every exposed table has RLS. Direct authenticated table mutations are revoked. `profiles` permits direct SELECT only for the owner or an accepted friend with the owner's sharing consent, excluding blocked relationships.

The public `summit_request` function is an invoker wrapper. Its private implementation verifies identity, confirmed email, membership, and leadership for each operation. It returns anonymous visitors only shared vote totals and published future events. Friend changes lock the account pair transactionally; pairs are unique; rejected tag guesses count against daily limits; tags contain 40 random bits. Requests do not automatically accept reciprocal requests.

The private `member-photos` storage bucket accepts JPEG only. Object policies restrict writes to `<auth.uid()>/avatar.jpg` and reads to the owner or an accepted, permitted friend. Downloads use the viewer's JWT, not permanent public URLs or long-lived signed URLs. Removing a friend or blocking them denies future downloads; files already downloaded cannot be recalled.

Grade, registration name, email, and friend lists are not included in friend profile cards. A student's account is email-verified; school membership is self-attested at registration, not represented as school-verified. Only the original registration fields and explicitly submitted ideas are exposed to leaders. Bio/next-adventure notes are governed by profile sharing settings.

## Development and tests

- `tests/member-backend.test.mjs` runs the actual migration and RPC in PGlite/Postgres with simulated Supabase Auth and Storage schemas, real roles and RLS. It covers authorization, consent, friendship transitions, private photo access, reports, votes, events, rate limits, and deletion.
- `tests/member-ui.test.mjs` mounts the real profile component in a DOM test environment with a test-only API fixture. It exercises editing, uploading, privacy, requests, acceptance/removal, and sign-out clearing. It does not contact production or inspect a browser.
- `tests/member-inputs.test.mjs` checks tag validation, safe return destinations, and file rejection before decoding.
- Test fixtures use synthetic names and emails only. They are not bundled into the public app.
- Existing D1/ChatGPT-auth routes are preserved when cloud configuration is absent. Once configured, the client uses Supabase consistently. Existing local D1 data is not silently migrated.

Public configuration and migrations belong in Git. Passwords, SMTP credentials, service-role keys, `.env` files, dependency directories, and database exports do not.

## Hike ratings and the camera roll

Apply the second migration, `20261006205628_hike_ratings_and_gallery.sql`, after the member migration. It adds:

- A leader-managed trail catalog with official park information links. The initial real trail entries are [Guy Fleming Trail](https://www.parks.ca.gov/?page_id=23207), [Cowles Mountain](https://www.sandiego.gov/cowles-mountain-summit), and [Los Peñasquitos Canyon](https://www.sandiego.gov/park-and-recreation/parks/osp/lospenasquitos). These are not scheduled SUMMIT outings and have no seeded ratings or invented trip photos.
- 1–5 star ratings with a member's attestation that they hiked the trail. One row per member/trail/hike month; saving again updates the same rating. Members can remove their rating. Months follow `America/Los_Angeles`, and the board offers the latest 12 months. Three distinct members' ratings are required to rank. Ranking uses the exact mean, then rating count, then name and ID; the displayed score is rounded to one decimal.
- A members-only hike-photo gallery at the bottom of the main site. Captions, accessible descriptions, trail selection, historical hike dates, camera-roll previews, edit/remove actions, trail filtering, stable cursor pagination, and a My photos view for unfinished/hidden uploads are included.
- A private `hike-photos` bucket. Each member may keep up to 30 photo records and create up to 10 per day. Uploads require a reserved draft row, are immutable, and accept JPEGs up to 4 MB. The client accepts JPG/PNG/WebP originals up to 10 MB, re-encodes without original metadata, and preserves the image's aspect ratio at a maximum dimension of 1600 pixels. No public student image URLs are generated.
- Explicit uploader confirmation that they have permission to share, including permission from people pictured. All registered members may view published gallery photos with the uploader's display name, even when the uploader keeps their separate profile private. Blocked relationships are excluded. Anonymous visitors cannot list or download gallery photos.
- A Hikes & photos tab in the leadership desk: add/archive trails, inspect reported images, hide/restore photos, and mark concerns reviewed. Leaders can access hidden photos for review; owners can still delete them. Photos are shared immediately within the club after upload and consent, not held in a pre-approval queue.
- Storage-aware deletion: a photo is first hidden, its object is deleted through the Storage API, and then its metadata is deleted. Failed cleanups remain visible to their owner in My photos for retry. Deleting a club profile first removes gallery objects; the server prevents account cleanup from silently leaving storage objects behind.

Activation remains pending alongside the member backend. The static preview displays the verified trail catalog and honest empty states; it cannot save ratings or accept uploads. Tests run the actual SQL in Postgres plus the React forms in a DOM harness; production email, storage delivery, and live multi-account verification still require the dedicated Supabase project.
