# PLAN — Grassroots Football Platform prototype

Status: **approved on 2026-09-27, with the decisions below.** Where this section conflicts with
the rest of the document, this section wins.

## 0. Approved decisions and changes

**Answers to §7**
1. `name` is **not** a tie-breaker. It only sets display order within a shared position.
2. Head-to-head follows the brief: anyone still tied continues down the list. The mini-table
   ranks by points → GD → GF. This is flagged as an assumption in the rules banner.
3. Stream A is assumed to be a **double round-robin (10 rounds)**, currently after round 7. Each
   stream is its own competition with `stream_label`.
4. Org display name: **"Batho Pele Kasi Soccer Tournament"**. The slug stays `batho-pele`.
   Batho Pele runs the **Open/Senior** league (see Context), not U19.
5. A walkover stores only the winner, and the engine applies `rules.walkover`. An *awarded*
   result stores the entered score and counts like a normal result. `countGoals` does **not**
   apply to awarded results.
6. DB driver: `pg` for localhost, the Neon WebSocket Pool otherwise. The primary documented
   dev path is a Neon dev branch.
7. There's a single operator. No `ADMIN_ALLOWED_ORGS`.
8. URLs as proposed.
9. The Batho Pele table shows only the entered results. Admins see an "X of 21 results entered"
   banner. **The match seed is idempotent by the natural key (competition, home entry, away
   entry, kickoff date in SAST)**, and a unique index backs this up, so re-running it never
   duplicates results.
10–15. Approved as proposed: category and gender values, TBC kickoff, only the four sponsors
   seeded, social icons hidden when a link is missing, a text sponsor strip, 14-day sessions,
   colours sampled from the reference, and a delay after a failed login.

**Later decisions (2026-09-27)**
- The full Stream A results live in `tests/fixtures/stream-a-results.json`, marked
  `"unverified": true`. Round 5 Samba Boys 3–0 Passion FC is inferred from the published tables.
  Round 3 Lere La Tshepe 0–2 Tseki Junior Stars is an **awarded** result. The reconciliation
  test runs against this fixture. `pnpm db:seed` still loads only the three 15 Aug results.
  `pnpm db:seed:stream-a-results` loads the full set, and refuses while the fixture is unverified.
- The tie-breaker order is **unknown** until the organiser answers, because their earlier tables
  don't follow GD → GF. The defaults stay configurable, and we don't reverse-engineer an order
  from the graphics.
- Stream B is out of scope for now.
- Milestone 4 (admin): *Confirm & publish* uses a two-tap confirmation that shows the exact score.
  A "Yes, publish …" button replaces a modal dialog because it is faster at the pitch. The
  graphic download and the native image share in the share panel come in Milestone 5.
- Milestone 3 (public pages) ships `generateMetadata` on every page. The Open Graph **images** come in
  Milestone 5, alongside the other graphics (change D). The team page shows the latest season only;
  `?season=` is deferred.

- Milestone 5 (graphics):
  - Graphic links carry a content version (`v`, a hash of the data drawn), so the CDN can cache
    them for 30 days and a change always gives a new URL. Unversioned URLs are cached for 60 s.
  - The PNGs are also cached server-side by tag.
  - A `/graphics/{org}/match/{id}` route previews a match in any state; it's the match page's OG image.
  - Open Graph images are set in `generateMetadata` rather than with `opengraph-image.tsx`, so they
    use the same versioned graphics.
  - Logos come from the organiser (`docs/logo/`), cropped into `public/brand/`.
  - The supplied QDL logo shows BrandCrowd watermarks, and the Batho Pele logo is low-resolution
    (217×60 after cropping) and reads "Batho Pele Tournaments". Clean originals are requested.

- Milestone 6 (deploy), 2026-09-27, approved by the owner. The database driver moves from Neon's
  WebSocket `Pool` to node-postgres over TCP with `attachDatabasePool` from `@vercel/functions`,
  following Neon's current guidance for Vercel Fluid compute. `@neondatabase/serverless` is removed,
  and one driver now serves Neon, Docker and the scripts.
  - Connection strings are upgraded from `sslmode=require` to `verify-full`. That matches pg 8's
    current behaviour and won't weaken in pg 9.
  - Vercel runs `pnpm db:migrate && pnpm build` (`vercel.json`), with Corepack enabled for pnpm 12.
  - Production is seeded once with `pnpm db:seed --no-demo`.

- 2026-10-03: the owner released the Stream A fixture (`"unverified": false`). Its 20
  organiser-published results load as confirmed. Round 5 Samba Boys v Passion (3–0, inferred) is
  marked `"pending"` and loads as **provisional**: private, not counted, and confirmed or corrected in
  admin once the organiser answers. Until then the live table differs from the organiser's 15 Aug
  table by that one match.

- 2026-10-03: clean logos supplied (no watermark), re-cropped into `public/brand/`. Facebook pages
  supplied: Batho Pele (organisation) and QDL. QDL's is stored on the competition, in the new
  `competitions.social_links` column; there are no other social accounts. The public site links
  both, and graphics show a Facebook icon.

- Milestone 7 (accounts and organisations), 2026-10-08, approved by the owner because other
  organisations have asked to join. The shared `ADMIN_PASSWORD` is replaced by personal logins.
  - Roles: super admin (the owner; all organisations, creates organisations, adds and removes
    their admins) and org admin (only their memberships). A scorer role can come later.
  - Invites and password resets are one-time links (7 days / 24 hours) that the super admin sends
    on WhatsApp. There's no email service. The first super admin is made with `pnpm admin:super`.
  - Login lockout as agreed on 2026-10-03: 5 failures per IP in 15 minutes, a global cap of 100,
    counted in Postgres (`login_failures`).
  - New organisations start unlisted (reachable by link, not shown on "/").
  - Competition, season and team setup screens are Milestone 8.

- Milestone 8 (setup screens), 2026-10-08, approved by the owner. Admins create league and knockout
  competitions (season by name), enter teams (paste a list or tick existing ones), set rules, and
  record points adjustments.
  - Rules gain `confirmed` (default false). This replaces the fixed Stream A assumption list with
    per-competition reminders.
  - One featured competition per organisation.
  - The seed re-run now refreshes only logos and social links, so admin edits survive.
  - Group stages are deferred.

- Milestone 9, 2026-10-09, approved by the owner:
  - Fixture graphics in admin: the share page per match day, links after saving fixtures, and an
    "Announce this match" card. The graphics already existed; only the admin entry points were
    missing.
  - Sponsors in setup, and fixtures-graphic rows sized to the list.
- 2026-10-09: logo upload, approved by the owner, stored **in Postgres** (owner's choice over
  Vercel Blob: no new service, key or dependency). The browser tidies and shrinks images
  before upload.
- 2026-10-09: scorer role, approved by the owner. Scorers enter scores, which stay provisional;
  only org admins publish. Migration 0006 adds the role and `matches.result_entered_by`.
  - New competition format `friendly` (enum value, migration 0004): no table, and draws are
    allowed. It also covers matches in other organisers' tournaments.

**Changes**
- A. CHECK: `outcome_type = 'walkover'` ⇒ `status = 'completed'`.
- B. Graphics route handlers send `Cache-Control: public, s-maxage=…, stale-while-revalidate=…`
  and are cached by tag. Confirming or editing a result invalidates the graphics for that match
  and competition.
- C. Milestone 4 is trimmed to what the demo needs, in this order: auth → result entry + share
  panel → bulk-paste fixtures → single fixture form → teams/aliases. Competitions, entries,
  adjustments, venues and settings are managed through seed and scripts for now. Their schema
  and query functions stay, and their admin screens come after the demo.
- D. Milestone 5 order: Matchday graphic (portrait) → result graphic → OG images → table and
  fixtures graphics → square sizes.
- E. The random-league property test stays, but it's lower priority than the named cases.

**Context**
- **"QwaQwa Development League U19" (QDL) is the parent organisation.** Batho Pele Kasi
  Soccer Tournament is responsible for QDL's **Open/Senior** teams, in two streams:
  **Stream A (Tseki)** and **Stream B (Phuthaditjhaba)**. Each stream is its own competition:
  - name "QwaQwa Development League Open", with `stream_label` and the new `competitions.area`
    column, e.g. "Stream A · Tseki"
  - slug `qdl-open-stream-a-2026`
  - teams have category `Open`

  The QDL logo and slogan ("It's time to shine") are carried as the **competition brand**.
  Graphics show the **Batho Pele logo and the QDL logo side by side**, as in the references.
  The "U19"/"U13" text in the QDL logo is part of the parent's name, not the competition's age group.
- **Stream B** is not seeded yet. So far we know only 4 team names (Junior Stars, Dynamos FC,
  Botjhabela United, International FC) and two 25 July results. Note that "Junior Stars"
  (Stream B) is a different team from "Tseki Junior Stars FC" (Stream A). Alias matching is
  scoped to the competition, so pasted fixtures can't cross streams.
- Adding QDL as a parent organisation (with a view across its member organisations'
  competitions) is later work. Not built now. Nothing here should block adding a nullable
  `organisations.parent_organisation_id` plus a cross-org competition view. Concretely:
  - competition identity doesn't depend on a single-org URL. Competitions have their own UUID.
  - query helpers take an `OrgScope`, which can later be widened to a set of orgs.
  - branding is resolved per competition first, then per organisation.
- Reference graphics are in `docs/reference/`. The 15 Aug table is `results 7.png`, which the
  brief calls `batho-pele-table-2026-08-15.png`. `fixture 1.jpg` and `results 1–4, 6.jpg/png`
  are the earlier matchdays.

---

## 1. Versions and tooling

I'll pin versions when I scaffold (Milestone 1) with `pnpm create next-app@latest`, then check the
current docs for each package rather than rely on memory. Expected:

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js latest stable (16.x expected), App Router, Turbopack | In Next 16, `middleware.ts` became **`proxy.ts`**, and `revalidateTag` takes a cache-profile argument. Server Actions can use `updateTag` to read their own writes. I'll follow whatever the installed version documents. |
| Language | TypeScript `strict`, plus `noUncheckedIndexedAccess` | |
| Styling | Tailwind CSS v4 (CSS-first config) | Branding via CSS variables (see §5.4) |
| DB | Neon Postgres, `@neondatabase/serverless` | Uses the **WebSocket `Pool`** (`drizzle-orm/neon-serverless`) instead of `neon-http`, because we need real transactions (bulk-paste save, result confirm, seed). See Q6 about local Docker. |
| ORM | Drizzle ORM + drizzle-kit | SQL migrations generated into `db/migrations/` and committed |
| Validation | zod | Shared schemas for Server Actions and the rules JSON |
| Auth | `jose` (HS256 JWT in a cookie) | Prototype only, behind `getCurrentAdmin()` |
| Graphics | `next/og` `ImageResponse` | Static TTF fonts bundled in `assets/fonts/` |
| Tests | Vitest | Pure unit tests. No DB needed for `pnpm test` |
| Lint | ESLint flat config (`eslint-config-next`) | Called via `eslint .`, since `next lint` was removed |
| Package manager | pnpm | |

New runtime dependencies are limited to: `next`, `react`, `react-dom`, `drizzle-orm`,
`@neondatabase/serverless`, `ws` (only if the Node runtime needs it), `zod` and `jose`. `pg` is added
only if we choose Q6(a). No UI kit, no date library (SAST is a fixed UTC+2 offset, so `Intl` is
enough), no fuzzy-match library.

**Font:** **Barlow Condensed** (SIL OFL), static TTFs in weights 600/700/800 plus 800 italic.
It's close to the condensed bold lettering in the reference graphic and has the italic used on
the "TODAY'S RESULTS" and "TOP OF THE TABLE" headers. The web pages use the system UI font for
body text and a single `woff2` subset of Barlow Condensed for headings and scores (~20 KB).

---

## 2. Folder structure

```
.
├── app/
│   ├── layout.tsx                  # root: <html>, system font, base CSS
│   ├── globals.css                 # Tailwind + CSS variable defaults
│   ├── page.tsx                    # "/" org list, or redirect when only one org
│   ├── [org]/
│   │   ├── layout.tsx              # resolve org, inject branding CSS vars, header/footer
│   │   ├── page.tsx                # org home
│   │   ├── opengraph-image.tsx
│   │   ├── [competition]/
│   │   │   ├── layout.tsx          # competition header + tab links (no client JS)
│   │   │   ├── page.tsx            # Table tab
│   │   │   ├── fixtures/page.tsx
│   │   │   ├── results/page.tsx
│   │   │   └── opengraph-image.tsx
│   │   ├── match/[matchId]/{page.tsx,opengraph-image.tsx}
│   │   └── team/[teamSlug]/{page.tsx,opengraph-image.tsx}
│   ├── graphics/[org]/…/route.tsx  # PNG route handlers (see §4.3)
│   └── admin/
│       ├── login/page.tsx
│       ├── layout.tsx              # calls getCurrentAdmin(); org switcher; bottom nav
│       ├── page.tsx                # dashboard: today's matches, quick actions
│       ├── results/…               # most important screen
│       ├── fixtures/…
│       ├── teams/…
│       ├── competitions/…
│       ├── venues/…
│       └── settings/…              # org branding, sponsors
├── components/                     # small, hand-written UI (no kit)
│   ├── public/                     # StandingsTable, MatchRow, ScoreLine, StatusBadge, Tabs…
│   └── admin/                      # ScoreStepper, ShareBox, ConfirmButton, PastePreview…
├── lib/
│   ├── standings/                  # PURE: compute, tiebreak, invariants, compare, types
│   ├── rules/                      # competition rules zod schema + defaults
│   ├── fixtures-paste/             # PURE: line parser + name normaliser/matcher
│   ├── match/                      # PURE: result validation, display helpers (HT/AET/pens)
│   ├── db/
│   │   ├── client.ts
│   │   ├── schema.ts               # Drizzle schema (single file while small)
│   │   └── queries/                # the ONLY place that reads/writes tenant data
│   ├── auth/                       # session cookie, getCurrentAdmin()
│   ├── cache/                      # tag name builders + invalidate helpers
│   ├── graphics/                   # fonts loader, sizes, shared JSX pieces
│   ├── share/                      # WhatsApp / Facebook caption builders (pure)
│   ├── time.ts                     # SAST formatting, "today" in Africa/Johannesburg
│   └── env.ts                      # zod-validated env
├── proxy.ts                        # (middleware.ts on older Next) guards /admin/*
├── db/migrations/                  # drizzle-kit output, committed
├── scripts/
│   ├── seed.ts                     # pnpm db:seed (idempotent: upsert by slug)
│   └── seed/{batho-pele.ts,demo.ts}
├── assets/fonts/                   # Barlow Condensed TTFs (+ OFL.txt)
├── tests/
│   ├── fixtures/
│   │   ├── published-table-2026-08-15.ts
│   │   └── stream-a-results.json   # absent until the organiser sends the 21 results
│   ├── standings/*.test.ts
│   ├── fixtures-paste/*.test.ts
│   └── share/*.test.ts
├── docs/                           # brief + reference graphic
├── docker-compose.yml              # local Postgres (see Q6)
├── drizzle.config.ts
├── .env.example
├── CLAUDE.md
└── README.md                       # Milestone 6
```

---

## 3. Database schema

Conventions:
- Primary keys are `uuid` with `gen_random_uuid()`.
- Timestamps are `timestamptz`, and every table has `created_at` and `updated_at`.
- Names are snake_case in SQL and camelCase in TypeScript.
- **Tenancy in the database itself.** Every tenant-owned table has `organisation_id NOT NULL`.
  Parent tables also expose `UNIQUE (id, organisation_id)`, and children reference them with
  **composite FKs** `(parent_id, organisation_id)`. A team can't point at another org's club, and a
  match can't point at another org's competition, even if app code has a bug.

### Enums

| Enum | Values |
|---|---|
| `competition_type` | `league`, `knockout`, `group_knockout` |
| `match_status` | `scheduled`, `postponed`, `cancelled`, `abandoned`, `completed` |
| `outcome_type` | `normal`, `walkover`, `awarded` |
| `result_state` | `provisional`, `confirmed` |
| `team_gender` | `male`, `female`, `mixed` (Q10) |

### Tables

**organisations**: `id`, `slug` (unique, reserved-word check), `name`, `short_name`, `logo_url`,
`primary_color`, `secondary_color`, `accent_color` (nullable), `text_color`, `background_color`,
`tagline`, `hashtags text[] NOT NULL DEFAULT '{}'`, `social_links jsonb` (zod:
`{ facebook?, instagram?, x?, tiktok?, whatsapp?, website? }`), timestamps.
Colours are CHECKed as `^#[0-9A-Fa-f]{6}$`.

**clubs**: `id`, `organisation_id` → organisations, `name`, `short_name`, `logo_url`.
`UNIQUE (organisation_id, name)` and `UNIQUE (id, organisation_id)`.

**teams**: `id`, `organisation_id`, `club_id`, `name` (official name, e.g. "Passion FC"),
`short_name` (for graphics, e.g. "PASSION"), `slug`, `category text` (e.g. `U19`, `Open`),
`gender team_gender`, `logo_url` (nullable; falls back to the club logo, then to initials).
FK `(club_id, organisation_id)` → clubs. `UNIQUE (organisation_id, slug)` and
`UNIQUE (id, organisation_id)`.
Team names are **not** unique per org: "Passion FC" can exist as both the U19 and the Open team.
Slugs disambiguate (`passion-fc-u19`).

**team_aliases**: `id`, `organisation_id`, `team_id`, `alias`, `normalized_alias`.
FK `(team_id, organisation_id)` → teams. `UNIQUE (team_id, normalized_alias)`.
Aliases are deliberately **not** unique per org: "Passion" legitimately fits both Passion teams.
Ambiguity is resolved in *competition* scope when pasting (§6).

**seasons**: `id`, `organisation_id`, `name` ("2026"), `starts_on date`, `ends_on date` (nullable).
`UNIQUE (organisation_id, name)`.

**competitions**: `id`, `organisation_id`, `season_id`, `name`, `slug`, `type competition_type`,
`stream_label` (nullable, "Stream A"), `area` (nullable, "Tseki"), `slogan` (nullable, "It's time to shine"), `logo_url`,
`rules jsonb NOT NULL` (zod-validated, defaults applied on read and write), `is_featured bool`,
`sort_order int`. FK `(season_id, organisation_id)` → seasons. `UNIQUE (organisation_id, slug)`
and `UNIQUE (id, organisation_id)`.
Slug example: `qdl-open-stream-a-2026`.

**competition_entries**: `id`, `organisation_id`, `competition_id`, `team_id`,
`display_name` (nullable override), `group_label` (nullable, for `group_knockout`),
`withdrawn_at` (nullable, reserved for later). FKs `(competition_id, organisation_id)` and
`(team_id, organisation_id)`. `UNIQUE (competition_id, team_id)` and
**`UNIQUE (id, competition_id)`**. The last one is the target for the match FKs below.

**venues**: `id`, `organisation_id`, `name`, `area`, `map_url`. `UNIQUE (organisation_id, name)`.

**matches**:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | appears in public URLs |
| `organisation_id`, `competition_id` | | FK `(competition_id, organisation_id)` |
| `round_label` | text | "Round 3", "Semi-final" |
| `round_number` | int null | for sorting fixtures |
| `home_entry_id`, `away_entry_id` | uuid | FK `(home_entry_id, competition_id)` → entries `(id, competition_id)`, same for away. Both entries are in the same competition **by FK**. |
| `venue_id` | uuid null | FK `(venue_id, organisation_id)` |
| `kickoff_at` | timestamptz null | null = date TBC |
| `kickoff_time_tbc` | bool default false | date known, time not (common in WhatsApp fixture posts) |
| `status` | match_status | default `scheduled` |
| `outcome_type` | outcome_type | default `normal` |
| `home_goals`, `away_goals` | smallint null | score at end of normal time |
| `ht_home_goals`, `ht_away_goals` | smallint null | |
| `aet_home_goals`, `aet_away_goals` | smallint null | cumulative score after extra time |
| `pen_home`, `pen_away` | smallint null | shootout; never counted as goals |
| `winner_entry_id` | uuid null | |
| `result_state` | result_state | default `provisional` |
| `notes` | text null | |
| `confirmed_at` | timestamptz null | |
| `created_at`, `updated_at` | | |

CHECK constraints on `matches`:
1. `home_entry_id <> away_entry_id`
2. Every score column is `>= 0`.
3. Pairs are all-or-nothing: HT both null or both set; the same for AET, pens, and FT.
4. `aet_*` only when the FT score is level.
5. `pen_*` only when the final score (`COALESCE(aet, ft)`) is level, and `pen_home <> pen_away`.
6. `winner_entry_id IS NULL OR winner_entry_id IN (home_entry_id, away_entry_id)`.
7. `status = 'completed' AND outcome_type IN ('normal','awarded')` ⇒ FT goals not null.
8. `outcome_type = 'walkover'` ⇒ `winner_entry_id IS NOT NULL`, and the goal columns are null.
   The engine applies the configured walkover score (Q5).
9. `status = 'completed'` ⇒ `kickoff_at IS NOT NULL`, so form ordering is always defined.
10. `result_state = 'confirmed'` ⇒ `confirmed_at IS NOT NULL`.
11. `outcome_type = 'walkover'` ⇒ `status = 'completed'` (change A).

**Natural key (decision 9):** a stored generated column
`kickoff_date date GENERATED ALWAYS AS ((kickoff_at AT TIME ZONE 'Africa/Johannesburg')::date)`
plus `UNIQUE (competition_id, home_entry_id, away_entry_id, kickoff_date)`. The seed upserts
`ON CONFLICT` on that key. Postgres treats NULLs as distinct, so matches with an unknown date
(null) are not constrained.

Things enforced in zod/server code rather than SQL: `winner_entry_id` agrees with the score for
normal results, and knockout matches that end level must have pens.

Indexes: `(competition_id, kickoff_at)`, `(organisation_id, kickoff_at)`, `(home_entry_id)`,
`(away_entry_id)`, `(competition_id, status, result_state)`.

**points_adjustments**: `id`, `organisation_id`, `competition_id`, `entry_id`, `points int`
(CHECK `<> 0`), `reason text NOT NULL`, `effective_on date NOT NULL`. FK
`(entry_id, competition_id)` → entries.

**sponsors**: `id`, `organisation_id`, `name`, `logo_url` (nullable, since logos aren't supplied
yet), `website_url`, `sort_order`.

**competition_sponsors**: `competition_id`, `sponsor_id`, `sort_order`, with PK
`(competition_id, sponsor_id)`. Graphics use the competition's sponsors and fall back to the
org's sponsors.

### Growing later without rewrites

Players and registrations will reference `teams` and `competition_entries`. Match events will
reference `matches`. Officials will be their own table linked to matches. Users and roles will
sit behind `getCurrentAdmin()` with an `organisation_memberships` table. None of this is built now,
and there are **no player or person columns anywhere**.

### Competition `rules` (zod)

```ts
{
  points:   { win: 3, draw: 1, loss: 0 },                       // ints; loss may be 0
  tieBreakers: ["points", "goalDifference", "goalsFor", "headToHead"],
  walkover: { score: [3, 0], countGoals: true },
}
```
Allowed tie-breakers: `points`, `goalDifference`, `goalsFor`, `wins`, `headToHead`. `name` is not
allowed (decision 1). `points` must be first; zod rejects duplicates. The admin
competition-settings page shows a banner: *"These rules are assumptions until the organiser
confirms them."* The banner also lists the head-to-head mini-table order (points → GD → GF)
and the double round-robin format as assumptions.

---

## 4. Route map

### 4.1 Public (Server Components, zero client JS unless noted)

| Route | Content |
|---|---|
| `/` | Org list. `redirect()` when there's exactly one org. |
| `/{org}` | Featured competition table (compact: Pos, Team, GP, GD, Pts), latest confirmed results, upcoming fixtures |
| `/{org}/{competition}` | **Table** tab (full table, sticky team column, form chips, adjustments shown as a footnote) |
| `/{org}/{competition}/fixtures` | **Fixtures** tab, grouped by date (SAST), with postponed matches clearly badged |
| `/{org}/{competition}/results` | **Results** tab. Confirmed results only; provisional ones show "Result pending" |
| `/{org}/match/{matchId}` | Teams, score (HT / AET / pens lines), status badge, kickoff, venue, round |
| `/{org}/team/{teamSlug}` | Current season by default (`?season=2026` optional): position per competition, record, form, fixtures and results |

Tabs are three real routes rendered as `<Link>`s, so switching needs no JS and each tab gets its
own shareable URL and OG image. Competition slugs are unique per org. Reserved slugs are
`match`, `team`, `admin`, `graphics`, `api` and `_next`, and they're rejected by zod when
creating orgs or competitions.

Every page has `generateMetadata` (title = `"{thing} · {org name}"`, with `NEXT_PUBLIC_APP_NAME`
only in the root template) and an `opengraph-image.tsx` at 1200×630. For the match OG image:
a score if confirmed, "vs + kickoff" if scheduled, "POSTPONED" if postponed. A provisional score
**never** appears in the image. Absolute URLs come from `NEXT_PUBLIC_SITE_URL`, falling back to
`VERCEL_PROJECT_PRODUCTION_URL`.

### 4.2 Admin (protected by `proxy.ts` **and** re-checked by `getCurrentAdmin()` in every layout and Server Action)

| Route | Purpose |
|---|---|
| `/admin/login` | Password form (Server Action) |
| `/admin` | Org switcher (if more than one org), today's and recent matches, quick links |
| `/admin/results` | Today's matches first, then the last 14 days, then the next 7. One tap opens a match. |
| `/admin/results/{matchId}` | **Result entry**: steppers, optional HT, ET and pens (only for knockout/drawn), status, outcome, *Save provisional* / *Confirm & publish* (with one confirm step), then the **Share panel** |
| `/admin/fixtures/new` | Single-fixture form. "Save & add another" keeps competition, date, time and venue. |
| `/admin/fixtures/paste` | Bulk paste, then preview (unmatched names highlighted, with a dropdown to pick the team and an optional "save as alias" tick), then save in one transaction |
| `/admin/fixtures/{matchId}/edit` | Edit, postpone or cancel a fixture |
| `/admin/teams`, `/admin/teams/new`, `/admin/teams/{id}` | Clubs and teams (a club can be created inline), aliases, logo URL |
| `/admin/competitions`, `/new`, `/{id}` | Details and rules (with the assumptions banner) |
| `/admin/competitions/{id}/entries` | Register or remove teams |
| `/admin/competitions/{id}/adjustments` | Points adjustments |
| `/admin/venues` | List, plus quick-add (also inline in the fixture form) |
| `/admin/settings` | Org branding, hashtags, social links, sponsors |

All mutations are Server Actions with zod validation, return `{ ok, errors }`, and render
field-level errors.

### 4.3 Graphics (route handlers → PNG, public, confirmed data only)

| Route | Graphic |
|---|---|
| `/graphics/{org}/result/{matchId}` | Full-time result |
| `/graphics/{org}/table/{competition}?asOf=YYYY-MM-DD` | League table ("As at {date}") |
| `/graphics/{org}/fixtures/{competition}?date=YYYY-MM-DD` | Fixtures for a date |
| `/graphics/{org}/matchday/{competition}?date=YYYY-MM-DD` | **Matchday** (modelled on the 15 Aug reference) |

Shared query params: `size=portrait|square|og` (1080×1350 is the default, then 1080×1080 and
1200×630) and `download=1`, which adds `Content-Disposition: attachment; filename=…png`.
A result graphic for a non-confirmed match returns 404.

---

## 5. Key designs

### 5.1 Standings algorithm (`lib/standings/`, pure, no DB and no clock)

```ts
computeStandings(
  entries: StandingsEntry[],          // { entryId, name, shortName }
  matches: StandingsMatch[],          // status, resultState, outcomeType, goals, aet, pens, winnerEntryId, kickoffAt
  rules: CompetitionRules,
  adjustments: PointsAdjustment[] = [],
  opts?: { asOf?: string /* YYYY-MM-DD SAST, inclusive */ }
): StandingRow[]
// StandingRow = { position, entryId, name, played, won, drawn, lost,
//                 goalsFor, goalsAgainst, goalDifference, adjustment, points,
//                 form: ("W"|"D"|"L")[], tied: boolean }
```

1. **Filter.** Keep only `status === "completed" && resultState === "confirmed"`, with both
   entries in `entries`. If `asOf` is set, also require `kickoffAt ≤ end of asOf (SAST)` and
   `adjustment.effectiveOn ≤ asOf`. Postponed, cancelled, abandoned and provisional matches are
   ignored.
2. **Resolve each match** to `(homeGoals, awayGoals, result)`:
   - `normal` / `awarded`: goals = AET if present, else FT. The result follows from the goals.
     Pens are ignored for both goals and points.
   - `walkover`: the winner is `winnerEntryId`, and the result is a win for them. Goals are
     `rules.walkover.score` (oriented to the winner) when `countGoals`, otherwise 0–0 for goal
     purposes while still counting as W/L. This keeps every invariant intact.
3. **Accumulate** P, W, D, L, GF and GA per entry. Then
   `points = W·win + D·draw + L·loss + Σadjustments`.
4. **Form**: the last 5 counted matches per entry, sorted by `kickoffAt` then `id`, most recent last.
5. **Rank** with `rankGroup(group, criterionIndex)`, recursively:
   - With one team left, or no criteria left, the group is **tied** and shares a position.
   - Simple criteria (`points`, `goalDifference`, `goalsFor`, `wins`) partition the group by
     that value, descending. Each subgroup recurses with `criterionIndex + 1`.
   - `headToHead` builds a **mini-table from counted matches between the tied teams only**,
     using the same resolution as step 2. It partitions by mini-points, then mini-GD, then
     mini-GF. Any subgroup still tied **continues down the list** with `criterionIndex + 1`, as
     the brief says. Q2 covers the alternative of re-applying head-to-head.
   - Positions are competition-style (1, 2, 2, 4).
6. **Display order inside a tied group** is by name (`localeCompare(…, "en")`), then `entryId`.
   The same input always gives the same output, and nothing depends on input order.

The same file also exports:

- **`checkTableInvariants(rows, rules?)`** returns `{ ok, errors[] }`. It checks ΣW = ΣL, ΣD is
  even, ΣGF = ΣGA, ΣGD = 0, and, per row, P = W+D+L and GD = GF−GA. When `rules` is given it
  also checks `Pts − adj = W·win + D·draw + L·loss`.
- **`compareWithPublishedTable(computed, published)`** returns
  `{ team, column, expected, actual }[]`. It matches rows by normalised team name and compares
  Pos, GP, W, D, L, GF, GA, GD and Pts. A team missing on either side counts as a difference.

**Tests** (Vitest, `tests/standings/`):
- Basic W/D/L/points
- A full 4-team round-robin
- Walkover with and without `countGoals`
- A points deduction, including one that changes positions
- A GD tie
- A three-way head-to-head tie, including a partial split where one team stays tied and falls
  through to the next criterion
- Provisional, postponed, cancelled and abandoned matches ignored
- A shootout that doesn't change goals or points
- An AET score used for goals
- Teams still level sharing a position
- Output unchanged when the input order is shuffled
- The invariants on every computed table above, plus a small seeded random-league property test
  (hand-rolled LCG, no library)
- The published 15 Aug table passes `checkTableInvariants` (with rules → Pts consistent)
- The reconciliation test with `stream-a-results.json` is `it.skipIf(!exists)`: compute, then
  `compareWithPublishedTable` must return `[]`

### 5.2 Tenancy and data access

- `lib/db/queries/*` is the only module that imports the Drizzle schema for tenant tables. An ESLint
  `no-restricted-imports` rule enforces this outside `lib/db/**` and `scripts/**`.
- Every query takes an `OrgScope` (branded type `{ id: string; slug: string } & { __brand }`)
  as its first argument. You can only get one from `resolveOrgBySlug(slug)` (public) or
  `getCurrentAdmin()` (admin). Every `WHERE` includes `organisation_id = scope.id`.
- An ID from the URL (a match ID, say) is always looked up **with** the org scope, so an ID that
  belongs to another org is a 404.
- The composite FKs in §3 are the database-level backstop.

### 5.3 Caching and freshness

Public reads are cached with tags: `org:{id}`, `competition:{id}`, `match:{id}` and `team:{id}`.
Confirming a result, changing a status or editing a fixture invalidates the match's tag, its
competition's tag (and so its table), both teams' tags and the org tag, so the public page
updates within seconds. On Next 16 that means `"use cache"` + `cacheTag`, with `updateTag` in
Server Actions. On older versions it's `unstable_cache` + `revalidateTag`. I'll confirm against the
installed version.

### 5.4 Branding

`app/[org]/layout.tsx` sets `--brand-primary`, `--brand-secondary`, `--brand-text` and
`--brand-bg` in a `style` attribute. Tailwind v4 maps them as theme colours (`bg-brand`, etc.).
The same values feed the graphics. Colour contrast is checked at seed time, and if the primary
colour fails on white, the design falls back to dark text.

### 5.5 Admin auth (accounts since Milestone 7)

- Login Server Action: email + password, checked against a scrypt hash (Node's `crypto`, no new
  dependency), after the lockout check (`lib/auth/lockout.ts`). Unknown emails do the same work.
- On success it sets the `admin_session` cookie to a JWT (HS256, `AUTH_SECRET`) holding
  `{ sub: userId, orgId, sv }`, where `sv` must equal `users.session_version`. The cookie is `httpOnly; secure (prod); sameSite=lax; path=/admin`,
  with a 14-day expiry (Q13), because organisers at the pitch shouldn't be re-logging in.
- `proxy.ts` redirects to login when the cookie is missing or invalid. `getCurrentAdmin()`
  re-verifies inside layouts and **every Server Action**. The proxy alone isn't trusted.
- Switching org re-signs the cookie with the new `orgId`, after checking the user may access it.

### 5.6 Result entry flow (target: under 30 s)

The target interaction is 4 taps: open match → + + (home) → + (away) → *Confirm & publish* →
*Yes, publish*.

The steppers are a single small client component. HT is collapsed behind "Add half-time score".
ET and pens appear only for knockout matches when the score is level. Status defaults to
*completed* once a score is touched, and the outcome defaults to *normal*.

After the save:
- **Confirmed**: a Share panel with *Copy link*, *Share to WhatsApp*
  (`https://wa.me/?text=` + caption + link), *Download graphic* (portrait/square) and
  *Copy Facebook caption* (with the org's hashtags). If the browser supports
  `navigator.share({ files })`, a *Share image…* button appears too, which on Android sends the PNG
  straight into WhatsApp.
- **Provisional**: a note saying it isn't public yet. No graphic.

Caption builders are pure functions in `lib/share/` and have tests.

### 5.7 Time

Everything is stored as UTC `timestamptz`. Everything is displayed with
`Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg" })`. Admin date and time inputs
are interpreted as SAST (built with a `+02:00` offset; SA has no DST). "Today" means today in SAST.
All of this lives in `lib/time.ts`, with tests.

---

## 6. Bulk-paste fixture parsing (`lib/fixtures-paste/`, pure)

1. **Split** the paste into lines and drop blank lines, headings without "vs", and emoji/bullet
   prefixes (`1.`, `-`, `⚽`, `•`).
2. **Parse** the optional time token (`14:00`, `14h00`, `2pm`) at the start or end. The separator
   is ` vs `, ` vs. `, ` v ` or ` versus ` (case-insensitive). A hyphen is **not** a separator,
   because it clashes with scores and hyphenated names.
3. **Normalise names**: lower-case, strip diacritics and punctuation, collapse whitespace, and
   drop a trailing `fc`/`f.c.`.
4. **Match** only among teams **entered in the chosen competition**, comparing against their
   names and aliases. An exact normalised match wins. If a name matches several teams, or none,
   it's flagged, with up to 3 suggestions ranked by token overlap.
5. **Preview**: each row shows the green matched team or a red "unmatched" chip with a picker.
   Rows that are duplicates, self-matches or already exist get a warning. The date, venue and
   round come from shared fields above the paste box.
6. **Save** everything in one transaction. Ticked corrections are added as aliases.

---

## 7. Questions and disagreements

1. **(blocking, M2) The `name` tie-breaker contradicts "teams still tied share the same position".**
   Alphabetical name always breaks the tie, so no two teams could ever share a position.
   Sorting by name isn't a football rule either. **Proposal:** drop `name` from `tieBreakers` and
   use name only to order teams *display-wise* within a shared position. The alternative is to
   keep `name` as an allowed criterion but leave it out of the default list.
2. **(blocking, M2) Head-to-head after a partial split.** The brief says "continue down the
   list" for anyone still tied. Many competitions (e.g. UEFA) instead **re-apply head-to-head
   among just the remaining tied teams** before moving on. I'll implement the brief's version
   unless you say otherwise. Inside the mini-table I'll use points → GD → GF. Also an assumption,
   please confirm.
3. **Competition format.** Every team has played **7** games with 6 teams, which a single
   round-robin (5 games each) can't produce. It's most likely a **double round-robin (10 rounds)**
   at round 7. This doesn't affect the engine, but it matters for round labels and the demo.
   What's the format, and are there other streams (B, C…)? I'm modelling each stream as its own
   competition with `stream_label`.
4. **Organisation name.** The brief says "Batho Pele **Kasi Tournaments**". The graphic and the
   hashtag say "Batho Pele **Kasi Soccer Tournament**". Which is the display name?
5. **Walkovers and awarded results.** Proposal: a walkover stores only the winner, and the engine
   applies `rules.walkover`. If the rule changes later, the table updates, which is consistent with
   "tables are derived". An *awarded* result stores the score the admin enters (e.g. 3–0 by
   committee decision) and counts like a normal result. Is that right for this league? Should
   `countGoals` also apply to awarded results?
6. **(blocking, M1) Local Postgres via Docker vs `@neondatabase/serverless`.** The Neon driver
   speaks HTTP/WebSocket, not the plain Postgres wire protocol, so it can't talk to a vanilla
   Docker Postgres. Options:
   - **(a) recommended:** `lib/db/client.ts` uses `drizzle-orm/node-postgres` (`pg`) when
     `DATABASE_URL` points at localhost, and the Neon WebSocket Pool otherwise. It adds one
     boring dependency, and both paths go through the same Drizzle schema.
   - (b) Add a community Neon WebSocket proxy container to `docker-compose.yml` and keep one
     driver. There are fewer code paths, but it relies on a less well-known image.

   Either way, the **primary** documented dev path is a Neon dev branch.
7. **Admin session vs org selection.** There's one password for all orgs, which is fine for a
   prototype with a single operator (PrimeCode). Confirm that the partner organiser won't hold
   this password while the Demo org exists. If they will, I'd add `ADMIN_ALLOWED_ORGS`.
8. **URLs.** Match URLs use the UUID (`/batho-pele/match/3f2c…`). Competition and team URLs use
   readable slugs (`/batho-pele/qdl-u19-stream-a-2026`, `/batho-pele/team/passion-fc`). OK?
9. **Seeding the 3 known 15 Aug results.** They're seeded as confirmed, so the Batho Pele public
   table will show only those 3 matches (GP 1 each). It will **not** look like the published
   table until the other 18 arrive, and that could confuse the demo. Options: (a) show it as is,
   with an admin-only banner saying "3 of 21 results entered", or (b) hold the competition as
   unpublished until reconciled. I'd go with (a).
10. **Team `category` and `gender`.** Category is free text with suggestions (`U13`…`U19`,
    `Open`, `Veterans`). Gender is an enum `male` | `female` | `mixed`. OK?
11. **Kickoff unknown.** WhatsApp fixture posts often have no time. I'm allowing
    `kickoff_time_tbc` (the date is known), and a null `kickoff_at` for a postponed match with no
    new date.
12. **Social links and sponsor logos.** The graphic shows Facebook, Instagram and X icons but no
    handles. I need the URLs. The icons are hidden when a link is missing. Sponsor logos aren't
    supplied yet, so the strip shows sponsor **names** in a neat text style until logo URLs are
    added. The graphic also shows more sponsors than the four listed ("Tlhokomelo ga Setshaba
    Community Development", a funeral assurance brand, and one unreadable blue logo). I'll only
    seed the four you named.
13. **Session length.** 14 days, for convenience at the pitch. Shorter?
14. **Brand colours.** There are no separate logo files, so I'll sample the green from
    the reference graphic itself in M1 and compare it with `#0B3D1F`/`#1E6B34`.
15. **Login rate limiting** isn't in the brief. (Resolved in Milestone 7: per-IP lockout.) I'll add a simple failed-attempt delay only. Real
    rate limiting will come with real auth.

---

## 8. Milestone plan (after approval)

| # | Deliverable | Done when |
|---|---|---|
| 1 | Scaffold, Tailwind, env validation, Drizzle schema + first migration, DB client, docker-compose, `.env.example`, seed (Batho Pele + Demo) | `pnpm db:migrate && pnpm db:seed` works against both Neon and local; typecheck/lint pass |
| 2 | `lib/standings` + rules schema + full test suite + published-table fixture | `pnpm test` green; reconciliation test skipped |
| 3 | Public pages, branding, metadata, cache tags, empty states | Tried at 360 px in dev; Lighthouse mobile sanity check |
| 4 | Admin: auth, org switch, teams/aliases, competitions/rules/entries/adjustments, venues, fixtures (single + paste), result entry | Demo steps 2–3 work locally; paste parser tests green |
| 5 | Graphics (result, table, fixtures, matchday) in 3 sizes, share panel, OG images | Each graphic rendered and checked visually against the reference |
| 6 | README: setup, env, migrations, seeding, Vercel + Neon deploy | A fresh clone can follow it end to end |

Each milestone ends with typecheck, lint and test, then a commit and a short "what changed / how
to try it" summary.
