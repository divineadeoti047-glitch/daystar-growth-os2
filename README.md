# DAYSTAR Personal Growth OS

DAYSTAR is a fresh, private accountability workspace for daily commitments, life areas, goals, planning, reflection, and focused work. The interface uses a deep navy (#172A46) dashboard foundation, warm ivory (#F7F3EA) reading panels, muted antique gold (#B08D57), DM Sans body text, and expressive Libre Caslon Display headings. Comfortable line spacing and 16px form inputs keep the mobile and laptop layouts readable. The Android layout uses Home, Tasks, Insights, Journal, and Settings as its bottom navigation.

This project is separate from the original DAYSTAR deployment. Its typed React interface replaces the original monolithic browser script. The current deployment target is Vercel, with Neon Postgres for cloud workspaces and Better Auth for email/password accounts.

## Run locally

Use Node 22.13 or newer and pnpm. Install dependencies with `pnpm install`, set `DATABASE_URL` to a Neon Postgres connection string, then run `pnpm dev`. The server creates its required tables on the first API request. `pnpm test` runs the Vitest suites; `pnpm run typecheck` checks types.

## Deploy on Vercel

Import `divineadeoti047-glitch/daystar-growth-os2` as a TanStack Start project and keep the root directory as `./`. Connect a Neon Postgres database from the Vercel Marketplace before using sign-in or cloud saving; the integration must provide `DATABASE_URL` to Preview and Production. `BETTER_AUTH_SECRET` is optional; when omitted, the private database URL signs sessions. The initial API request creates the workspace and authentication tables. Set `DAYSTAR_COACH_PROVIDER=rules` for the no-key coach, or add `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` for AI coaching.

The Vercel/Nitro production build and TypeScript check pass locally. Vercel deployment, database provisioning, account sign-in, cloud writes, AI-provider calls, and real-device offline behavior still need live acceptance checks. Component tests use mocked platform responses and do not prove deployed service availability.

## Architecture

React 19 and TanStack Start render the application through Nitro on Vercel. Radix Dialog provides keyboard-accessible forms, Lucide provides icons, and CSS implements the responsive editorial layout. Server routes use Better Auth and Drizzle with Neon Postgres. The first API request creates the workspace and auth tables if needed.

Each owner has a versioned JSONB document containing tasks, occurrences with task snapshots, incremental progress entries, life areas, goals with milestones and reviews, journal entries, focus sessions, and preferences. Stable UUIDs and relationships are validated with Zod on both client and server. The document is a deliberate bounded-workspace model; it has a 4 MB payload limit and collection caps. It is suitable for a personal application, not unbounded organisation analytics. Larger deployments should normalise records with an explicitly approved migration.

The browser never directly accesses the database. Email/password accounts use Better Auth. A browser without an account receives a random, HttpOnly, Secure, SameSite cookie, whose hash identifies its private server-stored workspace. This provides refresh persistence without exposing a shared public dataset or storing records in localStorage. Account workspaces are separate and synchronise across signed-in devices. After sign-in, DAYSTAR offers an explicit additive import of records from the current browser workspace; it never silently uploads or replaces records. The browser copy remains separate and can be exported.

Writes use a database compare-and-swap revision check. A workspace scope fingerprint rejects submissions after an account changes or expires. Requests require same-origin mutations, input validation, private no-store responses, and owner-filtered queries. Online 409 conflicts never overwrite remote changes. The PWA caches its application shell and static assets, and stores a validated workspace snapshot in this browser's IndexedDB. Offline writes are saved to that local snapshot. On reconnect they sync automatically only when the base cloud revision is unchanged. If another device changed the cloud workspace, both copies remain available for download and the user explicitly chooses which complete snapshot to keep. There is no field-level merge because records do not yet carry per-field revision metadata. Local snapshots are private to the browser profile, not encrypted by the app; anyone who can use that profile may access them. When no form or timer is active, saved changes are polled every 30 seconds. Refresh is also supported.

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
- Offline use: cached application shell plus private IndexedDB workspace snapshot; offline changes queue durably. Reconnection syncs only if the base revision is unchanged, otherwise both copies can be downloaded and the user chooses explicitly.
- Sign-in continuity: after account sign-in, users with device records are offered a confirmed additive import. Existing account records with matching IDs stay in place; the device workspace remains available separately.

## Accounts

Email/password registration, sign-in, and sign-out use Better Auth with Neon Postgres. Registration is open. Email confirmation, password reset delivery, and Google sign-in are not configured yet. Use a strong password and keep it safely; recovery email must be configured before relying on password reset.

## Accountability coach

The coach uses server-only Gemini or Anthropic APIs when configured. `DAYSTAR_COACH_PROVIDER` selects `gemini` (default), `anthropic`, or `rules`. API keys stay on the server; missing keys and provider failures fall back to the clearly labelled record-based response.

Only today's commitment names, progress, units, and aggregate metrics are sent by default. Weekly aggregates and a minimal goal summary are included only for a relevant request. No profile, journal entry, task note, or goal note is sent. Task lists are capped at 30. Each response is independent; visible conversation messages exist only in the current page session and are not sent as persistent model memory. The coach cannot edit records. A database-backed 15-second per-workspace throttle limits duplicate inference requests; stricter site-wide abuse controls may be needed for a broadly public launch.

## Services and limitations requiring setup

- **Database:** connect a Neon Postgres database to the Vercel project so `DATABASE_URL` is available at runtime.
- **Authentication:** account sign-in uses Better Auth. Password recovery email delivery and Google OAuth need additional provider configuration.
- **AI:** configure `GEMINI_API_KEY` or `ANTHROPIC_API_KEY` for live inference; otherwise the coach uses its record-based fallback.
- **Email and closed-device reminders:** scheduled delivery is not configured for Vercel yet. Open-page reminders remain available; background push needs VAPID configuration and a Vercel Cron route.
- **Automatic database backups:** retention, point-in-time recovery, and restore access were not configured or verified. Inspect this project's Database controls and account plan before relying on provider backups. Downloads are manual backups only.
- **Legacy imports:** only documented v2 backups are accepted. Original exports remain intact; importing their different schema requires a separately reviewed converter, never a silent migration.
- **Offline:** app-shell access and local task, progress, goal, journal, planner, and focus-workspace edits are implemented through the cached workspace snapshot. Browser storage limits, private-browsing restrictions, actual installation, and service-worker update behavior still need device verification. An offline edit on one device does not reach another device until reconnection. Conflicts require an explicit whole-workspace choice; export both copies first when both contain important changes.

## Backup format

A backup is `{ "format": "daystar-backup", "exportedAt": "ISO timestamp", "data": { "version": 1, ...workspace collections... } }`. The product is version 2.0; the backup document schema is version 1. It contains sensitive personal records. Store it privately. Imports merge new identifiers, preserve matching identifiers, and keep current preferences. Finish active focus sessions before merging a backup with another active session. Backup validation rejects broken relationships, impossible dates, duplicate IDs, negative/nonfinite progress, and falsely completed focus sessions.

## Acceptance handoff

Regression suites cover denominator correctness, empty and partial days, independent targets, all units, capped displays, zero targets, skips, recurrence, history isolation, edits, pause/resume gaps, duplicate occurrences, weekly/monthly aggregation, future exclusion, progress removal, time zones, additive backups, timer recovery, private coach context, API owner isolation, stale writes, expired sessions, invalid payloads, and cross-origin rejection. They passed during the final design review, together with component checks for all workspace destinations and preservation of unsaved task text after a revision conflict. Retain the existing original deployment as a fallback until pipeline tests and manual acceptance pass and the owner approves any production replacement.

## Safe preview delivery and rollback

Submit these changes through the managed preview pipeline for this isolated DAYSTAR project. Do not publish to the original share-app-link site or promote a replacement before owner acceptance. The generated route tree is included so type checks and tests also run before a Vite build. Never delete or edit either already-applied database migration; all schema corrections must roll forward through a new generated migration.

Before approval, check the preview at approximately 360px and 1440px widths, create a test task and incremental progress, reload, then sign in on both devices with the same test account. Confirm recurrence history, journal edits, focus refresh recovery, backup import, and provider fallback using disposable records. Export a private backup before any production promotion. The current reminders require an open page; email and closed-device delivery remain unavailable.

Rollback the interface by republishing the previous known-good deployment on this replacement project. A deployment rollback does not roll back database records or migrations. Keep manual exports and verify the provider's restore/retention controls separately. The original application remains a separate fallback with its own unchanged data; no automatic data transfer occurs between the two sites.

## October 18 refinement

The existing workspace was refined in place. `/app` and `/` render the same workspace, using private cookie/account ownership and database records. This project has not been published to Vercel yet.

Planner now includes a searchable study and scripture recall library. Each record groups a topic or passage under a course or reading plan, stores a recall question and private answer/notes, and has an editable next-review date. Reveal the answer after recalling, then record Again, Hard, or Good. Again schedules tomorrow, Hard schedules two days later, and consecutive Good reviews schedule 3, 7, 15, 31, then at most 60 days. A difficult rating resets the increasing interval. Future reviews cannot be rated early. Ratings record practice and perceived difficulty; they do not claim mastery, learning outcomes, or spiritual maturity. Insights reports academic and scripture review counts separately for the selected period in the workspace timezone. The review summary explicitly does not use the commitment life-area filter.

Review records use the existing bounded JSONB document and guarded save API. No database table or column changed, and both applied migrations remained untouched. Older v1 documents and backups default to an empty review library. Exports include reviews; additive imports preserve existing matching IDs. Recall notes, course names, topics, and answers are not added to external coach context. Existing task schedules support study sessions, examination/assignment deadlines, reading and prayer routines; goals and linked tasks support study plans. Dedicated course enrolment, exam entities, and separate project entities were not added.

Archived commitments now have a recovery control under Tasks. Recovery freezes historical occurrences, preserves archive gaps and logged progress, and resumes from today. It clears an expired end date and reschedules one-time commitments for today. Unlogged skipped occurrences from today onward are regenerated; historical skips remain unchanged. Focus reset records elapsed time as an interrupted session before returning to the ready state. Backward clock changes no longer increase remaining time, and a running timestamp of zero is handled correctly. Equal quiet-hour endpoints now mean no quiet period.

Browser notification delivery uses `ServiceWorkerRegistration.showNotification`, required by Android Chrome. Permission still requires an explicit user action. The service worker caches the application shell and static files; it never caches API responses. Background push delivery needs provider configuration and device acceptance tests. Email reminders and per-task delivery are not claimed.

The navy/ivory design retains its existing fonts, type scale, navigation and screen arrangement, with deeper navy surfaces, restrained borders, inset highlights, controlled shadows, consistent form focus states, and comfortable mobile tap targets. No reference image was supplied in this session. Visual review on an Android device and screenshot comparison remain unverified. Automatic cloud sync retains the existing signed-in polling and revision guards; it pauses while forms or focus sessions are active. Manual JSON export is not automatic backup retention. Cross-device sync, live database saves, account recovery, and AI-provider requests still require deployed acceptance checks. No production deployment or original-site migration was performed.
