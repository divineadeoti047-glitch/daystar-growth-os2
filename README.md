# DAYSTAR Personal Growth OS

DAYSTAR is a fresh, private accountability workspace for daily commitments, life areas, goals, planning, reflection, and focused work. The interface uses a deep navy (#172A46) dashboard foundation, warm ivory (#F7F3EA) reading panels, muted antique gold (#B08D57), DM Sans body text, and expressive Libre Caslon Display headings. Comfortable line spacing and 16px form inputs keep the mobile and laptop layouts readable. The Android layout uses Home, Tasks, Insights, Journal, and Settings as its bottom navigation.

This project is separate from `share-app-link.netlify.app`. No original records, database tables, or deployments were changed. The original public repository was inspected in a temporary directory. Its plain HTML/JavaScript frontend used browser storage, a manual Identity cloud backup, and a Postgres JSON workspace. The replacement uses the supplied TanStack Start project environment and retains the original Netlify/Postgres/Identity infrastructure approach, with a typed React UI and centralised, testable business logic instead of the original monolithic browser script.

## Run locally

Use Node 22.13 or newer and pnpm. Install dependencies with `pnpm install`, link this separate Netlify project, then use `netlify dev --port 8889` for the application and platform services. `pnpm test` runs the Vitest suites. `pnpm run typecheck` checks types. The deployment pipeline handles building and applying migrations. Do not run database push or migration commands against the original application.

The final design review ran the regression suites and TypeScript checks and served the application through Netlify Dev with an HTTP 200 response. TanStack generated the route tree through the development server. Production builds remain delegated to the automatic pipeline. Real account and two-device checks, live database write checks, AI-provider requests, and visual Android/laptop browser checks remain acceptance gates before approving replacement of the old app. Component interaction tests use mocked platform responses; they do not prove deployed service availability.

## Architecture

React 19 and TanStack Start render the application. Radix Dialog provides keyboard-accessible forms, Lucide provides icons, and CSS implements the responsive editorial layout. Server-only Netlify Functions access managed Netlify Database using Drizzle ORM and `@netlify/database`. `db/schema.ts` defines a new `daystar_v2_workspaces` table. Generated migrations are additive and only target that table. They are applied by Netlify, not by this implementation session.

Each owner has a versioned JSONB document containing tasks, occurrences with task snapshots, incremental progress entries, life areas, goals with milestones and reviews, journal entries, focus sessions, and preferences. Stable UUIDs and relationships are validated with Zod on both client and server. The document is a deliberate bounded-workspace model; it has a 4 MB payload limit and collection caps. It is suitable for a personal application, not unbounded organisation analytics. Larger deployments should normalise records with an explicitly approved migration.

The browser never directly accesses the database. Accounts use Netlify Identity. A browser without an account receives a random, HttpOnly, Secure, SameSite cookie, whose hash identifies its private server-stored workspace. This provides refresh persistence without exposing a shared public dataset or storing private application records in localStorage. Losing the cookie loses access to that browser workspace. Account workspaces are separate and synchronise across signed-in devices. Export and explicitly import browser records to move them into an account; signing in never silently uploads or replaces records.

Writes use a database compare-and-swap revision check. A workspace scope fingerprint rejects submissions after an account changes or expires. Requests require same-origin mutations, input validation, private no-store responses, and owner-filtered queries. A 409 conflict leaves the current form open and never overwrites remote changes. Copy unsaved form text, reconnect, and submit again. Unsaved edits do not survive closing the browser. There is no offline write queue and no offline-save claim. When no form or timer is active, saved changes are polled every 30 seconds. Refresh is also supported.

## Progress rules and the original bug

The original `dayStats()` used `done / recorded`, and its weekly views also used recorded tasks as the denominator. One completed record and several untouched scheduled tasks therefore appeared as 100% completion. The replacement uses **completed scheduled occurrences / all eligible scheduled occurrences**. Missing records are unfinished occurrences. A zero-task day has no percentage. A measurable occurrence is complete only when its logged sum meets its target, regardless of an arbitrary status flag. Zero-target tasks require an explicit check-off.

Target progress is an equal, unweighted mean of `min(100, actual / target × 100)` across measurable occurrences in the selected period. Minutes, chapters, sessions, repetitions, counts, and custom units are never summed together. Over-target amounts remain in the entry history. Zero targets are excluded from the target mean. Skipped/cancelled occurrences are excluded from both denominators and remain stored. Missed/overdue occurrences remain incomplete. Date-specific views include the selected date; period totals exclude future dates. Nearly complete values never round to 100%.

One recurring occurrence has the deterministic identifier `taskId:YYYY-MM-DD`. Rendering never creates database rows. Before a schedule edit, pause, resume, or archive, past scheduled occurrences are materialised once with their original task snapshot. The changed schedule has an effective-from boundary, preventing new recurrence rules from backfilling historical gaps. Existing logged occurrences keep their original target and unit. Archive cancels unlogged future/current occurrences and preserves historical records and recorded progress. To change a target after logging today, create a new commitment. All cards, trends, area views, and coach summaries use the shared model functions.

## Implemented workflows

- Tasks: create, edit, archive, pause/resume schedules; one-time, daily, weekdays, weekly, and selected weekdays; positive incremental entries, individual entry removal, skip/restore occurrences, unit-aware progress, date and area filtering, and actionable overdue history.
- Home and Insights: real record-driven daily completion and target progress, weekly overview, daily/weekly/30-day trends, previous-period comparisons, consistency, missed commitments, and life-area comparisons. Empty datasets remain empty.
- Life areas: defaults plus custom names, colours, editing, filtering, and scoped historical insights.
- Goals: title, description, area, target date, milestones, linked existing tasks, notes, and saved review history. Progress/status derive from milestone completion; linked tasks are references and do not silently complete milestones.
- Journal: dated titles and reflections, area and goal links, prompts, search, editing, and confirmed individual deletion. Journal text is not sent to AI.
- Focus: configurable focus and break durations, task association, start/pause/resume/finish, persisted session state, timestamp-based refresh recovery, and actual elapsed history. Early finishes are interrupted, never completed. Focus sessions do not automatically add task progress; explicitly record it to avoid double counting.
- Reminders: daily in-app check-ins and optional browser notifications, configured time zone and quiet hours, with a persisted daily claim before delivery to prevent duplicate open tabs. The page must be open at the selected time. This is a daily check-in, not per-task scheduled delivery.
- Recovery: versioned JSON export and validated, confirmed, additive import. Matching identifiers keep current records and preferences remain unchanged. No reset control or destructive workspace endpoint exists.

## Authentication and Google setup

Netlify Identity activation was requested successfully for this new site. Email/password registration, confirmation callbacks, login, sign-out, password-recovery requests, and recovery password updates are implemented. Complete a real email-confirmation and recovery smoke test on the deployed preview. Invitations are not implemented as a separate acceptance UI; use open registration for this version.

For Google login:

1. Open this new project's Identity configuration and enable Google under external providers.
2. Create a Google OAuth web client in Google Cloud Console and configure its consent screen.
3. Copy the Identity-provided OAuth callback URL from the provider configuration into the Google client's authorised redirect URIs. Include the intended preview and eventual production origin where the provider requires an origin.
4. Enter the client ID and client secret only in the provider's server-side configuration. Never add a secret to frontend code.
5. Add test users while the Google consent app is in testing, or publish it as appropriate. Test phone and laptop sign-in with the same account.

The Google button appears only when Identity reports that provider as enabled. Google credentials were not supplied or configured by this implementation. User records are not made public when OAuth is unavailable.

## Accountability coach

The original coach used built-in browser rules, not a live AI model. Useful deterministic review behaviour was retained and labelled. The replacement has a real, server-only Netlify AI Gateway integration. Runtime configuration `DAYSTAR_COACH_PROVIDER` selects `gemini` (default, `gemini-3-flash-preview`), `anthropic` (`claude-haiku-4-5`), or `rules`. Provider SDKs obtain Gateway credentials at runtime; no provider key is bundled in the client. Gateway availability depends on account credits and service access. Test one real request on the deployed preview. Provider failures and throttling return a clearly identified, record-based response.

Only today's commitment names, progress, units, and aggregate metrics are sent by default. Weekly aggregates and a minimal goal summary are included only for a relevant request. No profile, journal entry, task note, or goal note is sent. Task lists are capped at 30. Each response is independent; visible conversation messages exist only in the current page session and are not sent as persistent model memory. The coach cannot edit records. A database-backed 15-second per-workspace throttle limits duplicate inference requests; stricter site-wide abuse controls may be needed for a broadly public launch.

## Services and limitations requiring setup

- **Database:** automatic provisioning and migration application happen at deploy time. Confirm the preview database is healthy before acceptance. Only the new table is used.
- **Google OAuth:** follow the steps above. Email delivery also depends on Identity's configured sender/SMTP and service limits.
- **AI:** uses Netlify AI Gateway credits. Provider selection is server-side. Real inference and failure handling require a deployed smoke test.
- **Email and closed-device reminders:** not implemented or claimed. They require an email provider, verified sending domain and sender, consent/preferences, delivery credentials stored in runtime settings, and a scheduled Netlify Function with durable per-user/per-occurrence delivery claims. Scheduled functions run on published deploys, so test delivery in a dedicated non-production project before enabling it. Reliable Android closed-browser alerts also require a tested push/subscription architecture. The current app does not request email or push permissions.
- **Automatic database backups:** retention, point-in-time recovery, and restore access were not configured or verified. Inspect this project's Database controls and account plan before relying on provider backups. Downloads are manual backups only.
- **Legacy imports:** only documented v2 backups are accepted. Original exports remain intact; importing their different schema requires a separately reviewed converter, never a silent migration.
- **Offline:** reading or editing without a connection is not promised. Failed saves show errors and leave forms open; retry online.

## Backup format

A backup is `{ "format": "daystar-backup", "exportedAt": "ISO timestamp", "data": { "version": 1, ...workspace collections... } }`. The product is version 2.0; the backup document schema is version 1. It contains sensitive personal records. Store it privately. Imports merge new identifiers, preserve matching identifiers, and keep current preferences. Finish active focus sessions before merging a backup with another active session. Backup validation rejects broken relationships, impossible dates, duplicate IDs, negative/nonfinite progress, and falsely completed focus sessions.

## Acceptance handoff

Regression suites cover denominator correctness, empty and partial days, independent targets, all units, capped displays, zero targets, skips, recurrence, history isolation, edits, pause/resume gaps, duplicate occurrences, weekly/monthly aggregation, future exclusion, progress removal, time zones, additive backups, timer recovery, private coach context, API owner isolation, stale writes, expired sessions, invalid payloads, and cross-origin rejection. They passed during the final design review, together with component checks for all workspace destinations and preservation of unsaved task text after a revision conflict. Retain the existing original deployment as a fallback until pipeline tests and manual acceptance pass and the owner approves any production replacement.

## Safe preview delivery and rollback

Submit these changes through the managed preview pipeline for this isolated DAYSTAR project. Do not publish to the original share-app-link site or promote a replacement before owner acceptance. The generated route tree is included so type checks and tests also run before a Vite build. Never delete or edit either already-applied database migration; all schema corrections must roll forward through a new generated migration.

Before approval, check the preview at approximately 360px and 1440px widths, create a test task and incremental progress, reload, then sign in on both devices with the same test account. Confirm recurrence history, journal edits, focus refresh recovery, backup import, and provider fallback using disposable records. Export a private backup before any production promotion. The current reminders require an open page; email and closed-device delivery remain unavailable.

Rollback the interface by republishing the previous known-good deployment on this replacement project. A deployment rollback does not roll back database records or migrations. Keep manual exports and verify the provider's restore/retention controls separately. The original application remains a separate fallback with its own unchanged data; no automatic data transfer occurs between the two sites.

## October 18 refinement

The existing workspace was refined in place. `/app` and `/` now render the same workspace, using the same private cookie/account ownership and database records. This does not change the separate `share-app-link.netlify.app` deployment or import any records from it. No public preview was published during this session; the managed deployment pipeline remains responsible for delivery.

Planner now includes a searchable study and scripture recall library. Each record groups a topic or passage under a course or reading plan, stores a recall question and private answer/notes, and has an editable next-review date. Reveal the answer after recalling, then record Again, Hard, or Good. Again schedules tomorrow, Hard schedules two days later, and consecutive Good reviews schedule 3, 7, 15, 31, then at most 60 days. A difficult rating resets the increasing interval. Future reviews cannot be rated early. Ratings record practice and perceived difficulty; they do not claim mastery, learning outcomes, or spiritual maturity. Insights reports academic and scripture review counts separately for the selected period in the workspace timezone. The review summary explicitly does not use the commitment life-area filter.

Review records use the existing bounded JSONB document and guarded save API. No database table or column changed, and both applied migrations remained untouched. Older v1 documents and backups default to an empty review library. Exports include reviews; additive imports preserve existing matching IDs. Recall notes, course names, topics, and answers are not added to external coach context. Existing task schedules support study sessions, examination/assignment deadlines, reading and prayer routines; goals and linked tasks support study plans. Dedicated course enrolment, exam entities, and separate project entities were not added.

Archived commitments now have a recovery control under Tasks. Recovery freezes historical occurrences, preserves archive gaps and logged progress, and resumes from today. It clears an expired end date and reschedules one-time commitments for today. Unlogged skipped occurrences from today onward are regenerated; historical skips remain unchanged. Focus reset records elapsed time as an interrupted session before returning to the ready state. Backward clock changes no longer increase remaining time, and a running timestamp of zero is handled correctly. Equal quiet-hour endpoints now mean no quiet period.

Browser notification delivery now uses `ServiceWorkerRegistration.showNotification`, which is required by Android Chrome rather than the desktop-style Notification constructor. Permission still requires an explicit user action. The dedicated notification worker caches no records and intercepts no network requests. It brings an existing page to the foreground when a notification is tapped. This remains a single daily open-page check-in: there is no push subscription, backend per-occurrence scheduler, closed-browser guarantee, email reminder, or per-task notification delivery. Background push requires a durable subscription store, server-only VAPID credentials, scheduled dispatch, delivery claims, and device acceptance tests.

The navy/ivory design retains its existing fonts, type scale, navigation and screen arrangement, with deeper navy surfaces, restrained borders, inset highlights, controlled shadows, consistent form focus states, and comfortable mobile tap targets. No reference image was supplied in this session. Visual review on an Android device and screenshot comparison remain unverified. Automatic cloud sync retains the existing 30-second signed-in polling and revision guards; it pauses while forms or focus sessions are active. Manual JSON export is not automatic backup retention. Cross-device sync, real database saves, Identity email/OAuth and AI-provider requests still require deployed acceptance checks. No production deployment or original-site migration was performed.
