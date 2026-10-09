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
- Neon Postgres via node-postgres (`pg`, TCP pool + `attachDatabasePool` from `@vercel/functions`),
  with Drizzle ORM and drizzle-kit. Same driver locally (Docker) and on Neon
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
                      # (refuses while "unverified": true; "pending" results load as provisional)
pnpm db:studio        # drizzle studio
pnpm admin:super --email … --name …  # create/promote a super admin; prints a one-time password link
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
- `app/graphics/…`: PNG route handlers (thin); drawing lives in `lib/graphics/`
- `components/public`, `components/admin`: small hand-written components. No UI kits.
- `lib/standings/`: the standings engine. **Pure functions: no DB, no clock, no I/O.**
- `lib/rules/`: the competition rules zod schema and its defaults
- `lib/fixtures-paste/`: pure parser and name matcher for pasted fixtures
- `lib/db/schema.ts`: the Drizzle schema
- `lib/db/queries/`: the **only** place that reads or writes tenant data (`setup.ts`: competitions,
  entries, rules, adjustments)
- `lib/auth/`: session cookie, passwords (scrypt), one-time links, lockout, `getCurrentAdmin()`
- `lib/platform/`: pure input schemas for the super admin's organisation and invite forms
- `lib/competitions/`: pure input schemas for competition setup, the rules form and team-list paste
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
   officials or disciplinary records. Youth data needs a POPIA consent process first. The only
   people stored are admin users (name + email, to sign in).
5. **Never fabricate results for a real organisation.** For Batho Pele, seed only the results the
   organiser supplied. Fictional data belongs only in the `demo` org.
6. **Don't invent football rules.** Put rules in the competition `rules` JSON (zod, with
   defaults), flag the assumption in the UI, and ask.
7. **The app name comes from `NEXT_PUBLIC_APP_NAME`.** Never hard-code a product name in the UI.
8. **Admin auth goes through `lib/auth`.** Org screens use `getCurrentAdmin()` (user + an org they
   may access); platform screens use `getCurrentSuperAdmin()` (hands out the `PlatformScope` that
   `lib/db/queries/platform.ts` requires). Re-check in every Server Action, not just in `proxy.ts`.
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

## Admin

- Every admin page renders `<Suspense>` around an async component that calls `getCurrentAdmin()`.
  It reads the cookie, so the read must sit inside the boundary. Client hooks that read the URL,
  such as `usePathname()`, also need a Suspense boundary.
- Admin data comes from `lib/db/queries/admin.ts`. It is never cached and returns raw data,
  including provisional scores. Each function takes an `OrgScope` and an optional `db` for PGlite tests.
- Every Server Action starts with `getCurrentAdmin()`, validates its input with zod, and calls
  `updateTag(...)` for each affected tag (see `tagsForMatchChange`), then `refresh()`.
- Accounts: personal email + password logins; roles are super admin (`users.is_super_admin`),
  org admin and scorer (`memberships.role`). `getCurrentAdmin()` is admin-only by default (a
  scorer is redirected to Results); only the result screens and `saveResult` pass
  `{ allowScorer: true }`, and `scorerSaveProblem` (`lib/auth/roles.ts`) limits a scorer to a
  provisional score for a played, unpublished match. `matches.result_entered_by` records who saved. Invites and resets are one-time links (only a SHA-256 is stored) that
  the super admin sends on WhatsApp; there's no email service. Bumping `users.session_version`
  signs a user out everywhere (password change, link use, removal).
- Login lockout (`lib/auth/lockout.ts`): failures are counted per IP in `login_failures`
  (Postgres, because Vercel runs many instances): 5 in 15 min per IP, 100 globally.
- New organisations start `listed = false`: reachable by link, hidden from "/" until listed.
- Competition setup (`/admin/competitions`) is owned by admins. The seed only refreshes logos and
  social links on re-run, so admin edits survive. `rules.confirmed` (default false) drives the
  "rules not yet confirmed" reminders. Admins can create every type.
- `group_knockout`: teams get `competition_entries.group_label` (A–H); matches get `stage`
  (group/knockout). Group tables come from `groupTables` (`lib/public/groups.ts`), which runs
  the standings engine per group on confirmed group-stage matches. `resultRulesFor(type, stage)`
  in `lib/match/result-input.ts` decides extra time, penalties and whether a winner is needed.
- `friendly` competitions: no table and no forced winner (level is fine). Extra time and
  penalties are optional (`lib/match/result-input.ts`). Knockouts still require a winner.
- Sponsors: `sponsors` belong to the organisation, and `competition_sponsors` (ordered, max 5)
  puts them on a competition's graphics. The seed links sponsors only to a competition that has
  none, so admin changes survive a re-seed.
- Fixtures graphic: rows grow when there are 1–3 fixtures (`fixtureRowHeight`), and one name
  size fits every name (`fixtureNameFont`, which wraps the same way as `<Words>`).
- Logos: `LogoField` uploads via `uploadLogoAction` (`app/admin/media-actions.ts`). The browser
  first clears an edge-connected plain background, crops margins (`lib/media/trim.ts`, pure) and
  shrinks to 600 px (`resize-image.ts`). The server accepts only PNG/JPEG by magic bytes, max
  1.5 MB (`lib/media/image.ts`), deduplicated per org in `media`. They're served by
  `app/media/[org]/[file]` (immutable cache). `loadLogo` reads `/media/…` straight from the DB.
  "media" is a reserved org slug.
- Fixture sharing: `/admin/share/fixtures/[competitionId]?date=`, built from
  `lib/admin/share-links.ts` and `lib/share/fixtures.ts` (pure captions). `GraphicShare` is the
  client panel; `share-hooks.ts` has the Web Share helpers shared with `SharePanel`.
- Drizzle renders columns unqualified in a single-table select, so a correlated `sql` count
  subquery must name its tables explicitly (see `lib/db/queries/setup.ts`).
- Result rules live in `lib/match/result-input.ts` and captions in `lib/share/`. Both are pure and tested.

## Homepage, privacy, credit

- `app/page.tsx` always shows the homepage (it no longer redirects when there's one org).
  `OrgDirectory` filters in the browser (`matchesQuery`). The banner photos are `HERO_PHOTOS`
  (`lib/home.ts`), cross-faded with the CSS `hero-slide-N` keyframes (2–3 photos). Child safety:
  no recognisable minors without consent.
- Homepage cards come from `directoryCard` (`lib/public/directory.ts`): when the featured
  competition has its own logo (a parent body like the QDL), the card shows that brand, with
  "Run by" the organisation. The organisation pages' header, page titles and link-preview site
  name use the same brand. The link is still the organisation.
- `listLatestResults` (`lib/db/queries/latest.ts`) is the one cross-organisation read: confirmed
  results from listed organisations only, tagged with every listed org's tag.
- Quotes (`lib/testimonials.ts`) are shown only when `approved: true`. Never publish words in a
  real organisation's name without their approval.
- `PlatformCredit` is the footer line on every public page (plus the Privacy link once
  `privacyNoticeLive()`). "privacy" and "media" are reserved org slugs.

## Graphics (`lib/graphics/`)

- `model.ts`: pure view models, tested. `graphics.tsx` and `parts.tsx`: Satori JSX.
- `render.tsx`: `"use cache"` PNG renderers tagged org/competition/match, so `updateTag` re-renders them.
- `links.ts` and `urls.ts`: versioned URLs (`v` = hash of the drawn data) and OG metadata.
- Satori limits:
  - Every element with more than one child needs `display: flex`.
  - No `z-index` (later siblings paint on top) and no `space-evenly`.
  - Text is kerned unevenly across normal spaces. Render text through `upper()` (no-break
    spaces) or `<Words>` (pre-wrapped lines).
- Preview layouts without a server: render with a scratch script that stubs `next/cache`. Always
  check all three sizes by eye.
- Fonts and `public/brand` are read from disk. `outputFileTracingIncludes` in `next.config.ts`
  bundles them.

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
