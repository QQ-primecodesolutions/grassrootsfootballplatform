# CLAUDE.md

@AGENTS.md

This is a mobile-first grassroots football platform for township and community football in
South Africa. It's a PrimeCode Solutions product used by several partner organisations. The first
pilot is Batho Pele Kasi Soccer Tournament, which runs the Open/Senior league of the QwaQwa
Development League U19 (the parent body) in two streams: A (Tseki) and B (Phuthaditjhaba).

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

## Commands

```
pnpm dev              # local dev server
pnpm build            # production build
pnpm typecheck        # next typegen && tsc --noEmit
pnpm lint             # eslint .
pnpm test             # vitest run (DB tests use in-memory PGlite; no DB needed)
pnpm db:generate      # drizzle-kit generate --name <change> (after editing lib/db/schema.ts)
pnpm db:migrate       # drizzle-kit migrate (applies db/migrations)
pnpm db:seed          # seed Batho Pele + Demo (idempotent; --overwrite-results re-applies seed results)
pnpm db:seed:stream-a-results  # load all Stream A results from tests/fixtures/stream-a-results.json
                      # (refuses while the fixture is "unverified": true)
pnpm db:studio        # drizzle studio
pnpm db:up / db:down  # optional local Postgres via Docker
```

- Next.js is 16.x. Read `node_modules/next/dist/docs/` before using an API (see AGENTS.md).
  `middleware` is now `proxy.ts`.
- pnpm enforces a minimum release age for packages. Don't bypass it; pick an older version.
- Env: `.env.local`. Next.js and the scripts both load it via `@next/env`.

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
- `scripts/seed.ts` + `scripts/seed/`: the seed. Real Batho Pele results live in
  `scripts/seed/data/batho-pele-stream-a.ts` (organiser-published results only).
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

## Caching (Next 16 Cache Components)

- `cacheComponents` and `partialPrefetching` are on. Public queries in `lib/db/queries` use
  `"use cache"` + `cacheLife("hours")` + tags from `lib/cache/tags.ts` (org, competition,
  match, team). Admin mutations must invalidate those tags (`updateTag` in Server Actions).
- `app/[org]/layout.tsx` awaits `params` inside `<Suspense>`, so every `/[org]/…` route gets an
  App Shell. That boundary only covers full page loads. **Every page must also** export a
  plain (non-async) default component that renders `<Suspense fallback={<PageSkeleton />}>`
  around an async `…Content({ params })` component, and await `params` only inside it.
  Otherwise dev prints "encountered URL data during prerendering or a navigation", and a tapped
  link waits for the database instead of showing the skeleton straight away.
- Public pages must not read the clock (`Date.now()`/`new Date()`). "Upcoming" means scheduled or
  postponed, in kickoff order.
- `pnpm build` prerenders `/`, so the build needs `DATABASE_URL`.
- Public match data goes through `toPublicResult`, which drops scores unless the match is
  completed and confirmed.

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
