# CLAUDE.md

This is a mobile-first grassroots football platform for township and community football in
South Africa. It's a PrimeCode Solutions product used by several partner organisations. The first
pilot is Batho Pele (QwaQwa Development League U19, Stream A).

- Source brief: `docs/PROTOTYPE_BRIEF.md`
- Agreed design: `PLAN.md`
- If they conflict, PLAN.md wins once it's approved.

## Stack

- Next.js (App Router), TypeScript strict, Tailwind CSS v4
- Neon Postgres via `@neondatabase/serverless`, with Drizzle ORM and drizzle-kit
- zod for all input validation; Server Actions for admin mutations
- `next/og` for PNG graphics and OG images; Vitest for tests; pnpm
- Deployed on Vercel
- Timezone: `Africa/Johannesburg` for all display and date logic. Store UTC `timestamptz`.

## Commands (available from Milestone 1)

```
pnpm dev            # local dev server
pnpm build          # production build
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint .
pnpm test           # vitest run
pnpm db:generate    # drizzle-kit generate (after editing lib/db/schema.ts)
pnpm db:migrate     # apply migrations in db/migrations
pnpm db:seed        # seed Batho Pele + Demo orgs (idempotent)
pnpm db:studio      # drizzle studio
```

Before every commit, run `pnpm typecheck && pnpm lint && pnpm test` and fix any failures.

## Folder layout

- `app/[org]/…`: public pages (Server Components by default)
- `app/admin/…`: admin UI and Server Actions
- `app/graphics/…`: PNG route handlers
- `components/public`, `components/admin`: small hand-written components. No UI kits.
- `lib/standings/`: the standings engine. **Pure functions: no DB, no clock, no I/O.**
- `lib/rules/`: the competition rules zod schema and its defaults
- `lib/fixtures-paste/`: pure parser and name matcher for pasted fixtures
- `lib/db/schema.ts`: the Drizzle schema
- `lib/db/queries/`: the **only** place that reads or writes tenant data
- `lib/auth/`: session cookie and `getCurrentAdmin()`
- `lib/time.ts`: SAST helpers
- `lib/share/`: caption builders
- `lib/env.ts`: validated env
- `db/migrations/`: generated SQL, committed
- `scripts/seed*`: seed scripts
- `tests/`: Vitest tests. Fixtures go in `tests/fixtures/`.

## Non-negotiable rules

1. **League tables are derived.** Standings are always computed from confirmed, completed match
   results plus points adjustments. There's no stored or editable table anywhere. The platform
   is the source of truth. Facebook and WhatsApp are only distribution channels.
2. **Only `status = completed` AND `result_state = confirmed` matches count.** They're also the
   only scores shown as final in public pages, OG images or graphics. Provisional scores are
   never shown publicly.
3. **Multi-tenancy.** Every tenant-owned table has `organisation_id`. Every query goes through
   `lib/db/queries/*` and takes an `OrgScope`, which you get from `resolveOrgBySlug()` or
   `getCurrentAdmin()`. Look up any ID from a URL together with the org scope. Composite FKs
   `(x_id, organisation_id)` keep child rows in the same org. Never bypass this.
4. **No player or person personal data.** Don't model players, registrations, match events,
   officials or disciplinary records. Youth data needs a POPIA consent process first.
5. **Never fabricate results for a real organisation.** For Batho Pele, seed only the results the
   organiser supplied. Fictional data belongs only in the `demo` org.
6. **Don't invent football rules.** Put rules in the competition `rules` JSON (zod, with
   defaults), flag the assumption in the UI, and ask.
7. **The app name comes from `NEXT_PUBLIC_APP_NAME`.** Never hard-code a product name in the UI.
8. **Admin auth is a prototype.** Everything goes through `getCurrentAdmin()`. Re-check it in every
   Server Action, not just in `proxy.ts`/middleware.
9. **Keep it light on mobile data.** Design for 360 px Android first. Use Server Components by
   default and client components only for real interaction. Keep tables readable with a sticky
   team column, and scroll horizontally inside the table container only.
10. **Use boring, documented choices.** Don't add a dependency without a clear need, and note why
    in the commit.

## Conventions

- Validate every Server Action with zod and return `{ ok: true } | { ok: false, errors }`.
- After any result, status or fixture change, invalidate the cache tags (`lib/cache/`) so
  public pages update within seconds.
- Use "GP" for games played in the UI.
- Format dates and times with `lib/time.ts`, never with raw `Date` methods.
- Put tests for pure modules under `tests/`, mirroring the `lib/` path.
- Commits: work milestone by milestone, with clear messages. Summarise what changed and how to
  try it after each milestone.
- Git: **commit locally only.** Never push or open PRs; the owner pushes. Don't add
  `Co-Authored-By` or any other attribution trailer to commit messages.
- Reference graphics are in `docs/reference/`. `results 7.png` is the 15 Aug 2026 table, which
  the brief calls `batho-pele-table-2026-08-15.png`.
