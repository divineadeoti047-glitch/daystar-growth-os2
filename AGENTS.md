# DAYSTAR project guide

DAYSTAR is a personal growth workspace built with React 19, TanStack Start, TypeScript, Netlify Functions, Identity, and managed Netlify Postgres through Drizzle. This is an isolated replacement project. Never modify the original live site, silently import its data, or add a global reset control.

## Architecture

- `src/routes/index.tsx` mounts the product workspace; `__root.tsx` supplies product metadata, providers, favicon, and manifest.
- `src/components/daystar.tsx` contains navigation, dashboard and feature screens, accessible Radix modal forms, authenticated service integration, and explicitly non-optimistic writes.
- `src/styles.css` contains the supplied UI primitives' theme plus the DAYSTAR editorial design and mobile layouts. Navy and ivory dominate; antique gold is restrained. Decorative sunrise geometry is code-native SVG, not a remote image.
- `src/lib/model.ts` owns the Zod data contract, recurrence, historical freezing, target/completion metrics, focus timestamp calculation, and backup merge. Keep business rules here rather than reimplementing them in screens.
- `src/lib/coaching.ts` selects minimal authorised task context and generates explicitly deterministic fallbacks. Never include journals or personal profile data in provider context.
- `netlify/functions/workspace.mts` is the private GET/PUT API. Owner IDs come from Identity or a secure server-issued device cookie, never client-provided identifiers. Scope and optimistic-revision guards prevent writes after account changes or concurrent updates. Do not add unauthenticated public record endpoints.
- `netlify/functions/coach.mts` handles configured Gateway providers, strict context boundaries, a database-backed request throttle, and labelled rules fallback.
- `db/schema.ts`, `db/index.ts`, `drizzle.config.ts`, and `netlify/database/migrations/` define and provision the new bounded JSONB workspace. Any table/column change needs a generated migration; never apply migrations manually.
- `src/lib/*.test.ts` contains domain, API security and coach regression tests. Existing UI primitive tests remain available.

## Decisions and invariants

Completion divides by **all eligible scheduled occurrences**, never recorded statuses. Zero scheduled tasks produces null, not 100. Target progress equally averages capped measurable occurrence percentages. Preserve actual amounts above target. Units are not interchangeable. Zero-target tasks require manual completion. Skipped occurrences are retained but excluded from denominators. Period summaries exclude future dates.

Recurring occurrence IDs are `taskId:date`. Before editing, pausing, resuming, or archiving schedules, materialise past occurrences with immutable task snapshots, then apply an effective-from boundary. This preserves historical gaps during pauses. Archiving is a reversible data-retention operation in the model; there is no permanent global deletion. Individual journals and progress entries can be removed with confirmation.

Data persists only in Netlify Database. Do not add localStorage, local JSON, or an in-memory persistence fallback. Device cookies are private capabilities; losing one loses browser-workspace access. Accounts provide cross-device access. Device and account workspaces remain separate until an explicit backup import. JSON import is additive by stable ID, validates relationships, and keeps existing preferences. Never silently migrate legacy backups.

Failed writes do not mutate saved client state. Forms remain open; users need to copy unsaved text before reconnecting after a conflict. There is no offline write queue. Active focus sessions are saved with timestamps; early finish is interrupted. Browser notification claims are persisted before delivery, with quiet hours and explicit permission. No closed-device or email-reminder guarantee exists.

The server-only `DAYSTAR_COACH_PROVIDER` setting supports gemini, anthropic, and rules. SDKs use Netlify AI Gateway runtime credentials. Do not expose or log credentials, records, journal content, or raw provider failures. The coach does not change records or persist conversation memory.

## Development and validation

Install with `pnpm install`. Local platform emulation uses `netlify dev --port 8889`. Available scripts include `pnpm test` and `pnpm run typecheck`. Honour the active environment's validation restrictions: the initial implementation environment delegated all build/start/test execution to its automatic pipeline. Format changes with Prettier and inspect sources. Do not report unexecuted tests or unverified service integration as passing. No direct commits or production deployments are needed in the agent-runner environment.

Use stable IDs, strict types, named business helpers, server-side validation and accessible labels. Preserve empty, error, and unavailable-service states. Keep secrets server-only, add migrations for schema changes, and document service setup in README. Google OAuth, provider credits, real authentication email delivery, automatic backup retention and closed-device delivery require deployed verification or configuration.
