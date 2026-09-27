# Prototype Brief — Grassroots Football Platform (PrimeCode Solutions)

You are building the first prototype of a mobile-first grassroots football platform for
township/community football in South Africa. It is a **PrimeCode Solutions product** that
will be used by several partner organisations. The first pilot partner is
**Batho Pele Kasi Tournaments** (Qwaqwa, Free State), starting with the
**QwaQwa Development League U19 — Stream A**.

The prototype has one job: let an organiser see **their own league online on their phone**,
enter a result in seconds, and get an updated table plus a branded graphic ready for
Facebook/WhatsApp. It will be demoed in person to the organiser, so polish on the core
flow matters more than breadth.

The product principle: **the platform is the source of truth**. Facebook is a distribution
channel, WhatsApp is a communication channel. League tables are always **calculated from
match results**, never typed in.

---

## How to work

1. **Milestone 0 — Plan first.** Read this whole brief, then write `PLAN.md` covering: folder
   structure, database schema (tables, key columns, enums, relationships), route map, the
   standings algorithm, and any questions or disagreements with this brief. **Stop and wait
   for my approval before writing application code.**
2. Also create `CLAUDE.md` with the project's conventions (stack, commands, folder layout,
   "tables are derived", multi-tenancy rule, no player personal data) so future sessions
   stay consistent.
3. Work milestone by milestone. At the end of each: run typecheck, lint and tests, fix
   failures, commit with a clear message, and give me a short summary of what changed and
   how to try it.
4. If something in this brief is ambiguous or you think it's wrong, ask. **Do not invent
   football rules**; make them configurable and flag the assumption.
5. Prefer boring, well-documented choices. Don't add libraries that aren't needed.

---

## Stack (decided)

- **Next.js** (latest stable, App Router), **TypeScript** in strict mode
- **Tailwind CSS**
- **PostgreSQL** on **Neon** (provisioned through the Vercel Marketplace), using
  `@neondatabase/serverless`
- **Drizzle ORM** + `drizzle-kit` for schema and migrations
- **zod** for input validation; **Server Actions** for admin mutations
- **`next/og`** (`ImageResponse`) for generated graphics and Open Graph images
- **Vitest** for unit tests
- **pnpm**
- Deploy on **Vercel**
- Timezone for all display and date logic: `Africa/Johannesburg`

The app name is not decided. Read it from `NEXT_PUBLIC_APP_NAME` and never hard-code a
product name in the UI.

---

## Multi-organisation from day one

Every tenant-owned table carries `organisation_id`. Public routes are scoped by organisation
slug: `/{orgSlug}/...`. All data access goes through query helpers that require an
organisation, so one partner's data can never leak into another's pages. Don't build
organisation sign-up or billing; organisations are created by seed/admin script for now.

---

## Domain model (prototype scope)

Design the exact schema in `PLAN.md`, but it must support at least:

- **Organisation** — name, slug, branding: logo URL, primary and secondary colour, tagline,
  hashtags (array), social links.
- **Club** — belongs to an organisation. A club can field several teams
  (e.g. "Passion" fields both an U19 and an Open team).
- **Team** — belongs to a club; has a display name, short name, category (e.g. `U19`, `Open`),
  gender, optional logo.
- **TeamAlias** — alternative spellings of a team name ("Tseki Jnr Stars" = "Tseki Junior
  Stars"), used when matching pasted text.
- **Season** — e.g. 2026.
- **Competition** — organisation, season, name, type (`league` | `knockout` |
  `group_knockout`), optional division/stream label, and a typed `rules` JSON (see below).
- **CompetitionEntry** — a team registered in a competition. Matches reference entries,
  not teams directly.
- **Venue** — name, area, optional map link.
- **Match** — competition, round label (e.g. "Round 3", "Semi-final"), home entry,
  away entry, venue, kickoff (timestamptz), status, and result fields:
  - `status`: `scheduled` | `postponed` | `cancelled` | `abandoned` | `completed`
  - `outcome_type`: `normal` | `walkover` | `awarded`
  - full-time score (home/away goals)
  - optional half-time score
  - optional score after extra time
  - optional penalty shootout score (never counted as goals)
  - `winner_entry_id` (needed for knockouts, esp. shootouts)
  - `result_state`: `provisional` | `confirmed` — only **confirmed completed** matches count
    toward standings and appear as final on public pages
  - `notes`, `confirmed_at`, `updated_at`
  - Enforce with constraints where practical: home ≠ away entry, both entries in the same
    competition, non-negative scores, penalty scores only when the match was drawn.
- **PointsAdjustment** — competition, entry, points (+/−), reason, date. Shown on the table.
- **Sponsor** — organisation, name, logo URL, optional link; can be attached to a
  competition. Used on graphics.

Competition `rules` JSON (validate with zod, with defaults):

```json
{
  "points": { "win": 3, "draw": 1, "loss": 0 },
  "tieBreakers": ["points", "goalDifference", "goalsFor", "headToHead", "name"],
  "walkover": { "score": [3, 0], "countGoals": true }
}
```

These defaults are assumptions until the organiser confirms. Put a visible note in the
admin competition settings saying so.

**Out of scope for the prototype, do not model yet:** players, player registrations, match
events (goals/cards/subs), live scoring, officials, disciplinary records, news, media
galleries, notifications. Youth player data needs a POPIA consent process first.

---

## Standings engine (the heart of the product)

Put it in `lib/standings/` as **pure functions with no database access**, e.g.
`computeStandings(entries, matches, rules, adjustments) → StandingRow[]`.

Each row: position, team, P, W, D, L, GF, GA, GD, points adjustment, Pts, and form
(last 5 confirmed results, most recent last, as `W`/`D`/`L`).

Requirements:
- Only `completed` + `confirmed` matches count.
- Walkovers apply the configured score; `countGoals: false` means the result counts but
  goals don't.
- Penalty shootouts never change goals or league points.
- Tie-breakers apply in configured order. `headToHead` means a mini-table among only the
  tied teams, then continue down the list for anyone still tied.
- Teams still tied after all tie-breakers share the same position.
- Deterministic output.

**Tests (Vitest) are required**, covering: basic W/D/L/points; a full round-robin;
walkover with and without goals; points deduction; goal-difference tie; head-to-head tie
among three teams; unconfirmed and postponed matches being ignored; shootout not affecting
goals; and these invariants on any computed table: total wins = total losses, total draws
is even, total GF = total GA, sum of GD = 0.

Also add a small exported `checkTableInvariants(rows)` helper, and a
`compareWithPublishedTable(computed, published)` helper that lists every cell that differs.
Use the **table Batho Pele published "as at 15 August 2026"** (below) as a test fixture:
it must **pass** `checkTableInvariants` (21 matches played, 15 decisive + 6 draws,
55 goals for and against). Once the 21 real Stream A results are entered, the computed
table must match this published table exactly; add that as a reconciliation test that is
skipped until the results exist in `tests/fixtures/stream-a-results.json`.

| Pos | Team                  | GP | W | D | L | GF | GA | GD | Pts |
|-----|-----------------------|----|---|---|---|----|----|----|-----|
| 1   | Tseki Junior Stars FC | 7  | 5 | 2 | 0 | 12 | 5  | +7 | 17  |
| 2   | Remember Matoota FC   | 7  | 3 | 2 | 2 | 13 | 9  | +4 | 11  |
| 3   | Passion FC            | 7  | 3 | 1 | 3 | 10 | 12 | −2 | 10  |
| 4   | Lere La Tshepe FC     | 7  | 2 | 2 | 3 | 7  | 9  | −2 | 8   |
| 5   | Samba Boys FC         | 7  | 1 | 3 | 3 | 8  | 8  | 0  | 6   |
| 6   | Tseki Galaxy FC       | 7  | 1 | 2 | 4 | 5  | 12 | −7 | 5   |

No two teams are level on points, so this table doesn't reveal the tie-breaker order.
Keep tie-breakers configurable. The graphic uses "GP" for games played; use GP in the UI.

---

## Public site (mobile-first, fast on mobile data)

Routes (adjust naming in `PLAN.md` if you have a better idea):

- `/` — list of organisations (or redirect when there's only one)
- `/{org}` — org home: featured competition table (compact), latest results, upcoming fixtures
- `/{org}/{competition}` — tabs for **Table**, **Fixtures**, **Results**
- `/{org}/match/{id}` — match page: teams, score (with HT / AET / penalties when present),
  status, kickoff, venue, round
- `/{org}/team/{id}` — team page: position, record, form, fixtures and results in that season

Requirements:
- Design for a ~360px wide Android screen first. Large tap targets, readable tables
  (sticky team column, horizontal scroll inside the table container only).
- Server Components by default; client components only where interaction truly needs them.
  No heavy UI kits. Keep JavaScript and page weight small; people are paying for data.
- Organisation branding (colours, logo, tagline) applied via CSS variables.
- Every public page has proper `generateMetadata` and an Open Graph image so links shared
  on WhatsApp/Facebook show a rich preview.
- Use `revalidateTag`/`revalidatePath` so a confirmed result shows publicly within seconds.
- Show clear "Provisional" and "Postponed" states; never show a provisional score as final.
- Friendly empty states ("No fixtures yet").

---

## Admin (used on a phone, often at the pitch)

- `/admin/login` — **prototype auth only**: single password from `ADMIN_PASSWORD`, compared
  in constant time, session in an httpOnly, secure, signed cookie (`jose`, `AUTH_SECRET`),
  `/admin` protected by middleware. Wrap it behind a `getCurrentAdmin()` seam so real
  users and roles can replace it later. Don't build user or role management now.
- Admin chooses which organisation they're working in (stored in the session).
- **Teams:** quick add/edit of clubs and teams, aliases, logo URL.
- **Competitions:** create, set rules, register teams (entries), add points adjustments.
- **Fixtures:** single-fixture form with an "add another" flow that keeps competition,
  date and venue filled in. Plus **bulk paste**: paste lines like `Passion FC vs Samba Boys`
  (the way fixtures get typed into WhatsApp); match names using team names and aliases,
  show a preview with unmatched names highlighted, then save.
- **Result entry (most important screen):**
  - List of today's and recent matches, one tap to open.
  - Big +/− steppers for home and away score; optional HT score; extra-time and penalty
    fields appear only when relevant (knockout and drawn).
  - Status and outcome type (normal / walkover / awarded).
  - Two buttons: **Save provisional** and **Confirm & publish**. Confirming asks once
    for confirmation.
  - Entering and confirming a normal result must take **under 30 seconds** on a phone.
  - After saving, show a **Share panel**: copy public link, "Share to WhatsApp"
    (`https://wa.me/?text=` with a caption and the link), download graphic, copy
    Facebook caption (with the organisation's hashtags).
- Validate everything with zod on the server; show clear errors.

---

## Generated graphics

Route handlers returning PNGs via `next/og`, in the organisation's branding:

- **Full-time result:** competition name, round, teams, score (with AET/pens line when
  relevant), date, venue, tagline, sponsor strip.
- **League table:** competition name, "As at {date}", compact table, tagline, sponsor strip.
- **Fixtures for a date:** list of matches with kickoff times and venues.

**Layout reference:** `docs/reference/batho-pele-table-2026-08-15.png` is Batho Pele's own
matchday graphic. Model a **Matchday graphic** on it (this is their most important post):
competition and organisation logos at the top, competition name, big "LEAGUE TABLE" title,
"As at {date}" banner, full table with position and points in highlighted boxes and GD
coloured green/red, a "Today's results" panel, a "Top of the table" top-3 panel, the
tagline, hashtags, social icons, and a sponsor logo strip at the bottom. Match its
structure and colours, not their stadium photo background (use a clean gradient instead).

Sizes: 1080×1350 (Facebook/Instagram portrait, default), 1080×1080 (square), and
1200×630 for Open Graph. Keep in mind `next/og` only supports a flexbox subset of CSS and
needs font data loaded explicitly; bundle a bold, condensed, open-licence font in the repo.
Team logos are optional, so layouts must look good without them. Render each graphic once
in the dev environment and check it visually before calling the milestone done.

---

## Seed data

`pnpm db:seed` should create:

1. **Batho Pele Kasi Tournaments** (slug `batho-pele`)
   - Tagline: `ONE GAME. ONE PASSION. ONE LEAGUE.`
   - Hashtags: `#ITSTIMETOSHINE`, `#QDL`, `#BathoPeleKasiSoccerTournament`
   - Colours taken from their graphic (approximate; sample exact values from the logo files
     in `docs/reference/` when available): deep green `#0B3D1F` primary, brighter green
     `#1E6B34` secondary, near-black text, white/light-grey background
   - Season 2026, competition **QwaQwa Development League U19** (slogan "It's time to
     shine"), stream label **Stream A**, type `league`
   - Six teams, each in its **own club** (don't assume any teams share a club until the
     organiser confirms). Official names use the "FC" suffix; add aliases without it:
     Tseki Junior Stars FC (aliases "Tseki Junior Stars", "Tseki Jnr Stars"),
     Remember Matoota FC, Passion FC, Lere La Tshepe FC, Samba Boys FC, Tseki Galaxy FC
   - Sponsors (names only, logos to be supplied): Mayday Alarms, RE/MAX Maluti,
     Prestige, Next Business, plus others visible on the graphic that the organiser
     will confirm
   - **No invented match results.** Only these three results from 15 August 2026 are
     known and may be seeded as confirmed: Tseki Junior Stars FC 2–1 Samba Boys FC,
     Tseki Galaxy FC 1–2 Lere La Tshepe FC, Remember Matoota FC 0–0 Passion FC. The other
     18 come from the organiser later. Never fabricate results for a real organisation.
2. **Demo Community League** (slug `demo`): obviously fictional teams, a full generated
   round-robin with a mix of confirmed, provisional and postponed matches, one walkover and
   one points deduction, plus a small knockout with one shootout. Used for development and
   screenshots.

---

## Milestones

0. `PLAN.md` + `CLAUDE.md` → wait for approval
1. Scaffold, Tailwind, Drizzle schema, migrations, seed script, local dev setup
   (`.env.example`, Neon branch or local Postgres via Docker — document both)
2. Standings engine + full test suite
3. Public pages
4. Admin: auth, teams, competitions, fixtures (incl. bulk paste), result entry
5. Graphics, share panel, Open Graph images
6. README: setup, env vars, migrations, seeding, deploying to Vercel with Neon

---

## Not in this prototype

Player data of any kind, live scores and match events, notifications, tournament bracket
visuals, offline mode, multiple admin users and roles, payments, native app, news and
media galleries. Design the schema so these can be added later without rewrites, but
don't build them.

---

## Definition of done (demo script)

On a mid-range Android phone over mobile data, I can:

1. Open `/batho-pele` and see QwaQwa Development League U19 — Stream A.
2. Log in to admin, bulk-paste three fixtures, and enter and confirm a result in under
   30 seconds.
3. See the public table update within a few seconds, calculated from results.
4. Download a 1080×1350 full-time graphic in Batho Pele branding with their tagline.
5. Share the match link to WhatsApp and see a rich preview image.
6. Download a Matchday graphic that follows the layout of their 15 August graphic.
7. `pnpm test` passes, including the invariant test on the published 15 August table.
