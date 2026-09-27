# Grassroots Football Platform (prototype)

A mobile-first platform for community football leagues. League tables are always
calculated from match results. See [PLAN.md](PLAN.md) for the design and
[CLAUDE.md](CLAUDE.md) for conventions.

> This README covers local setup. The full deploy guide (Vercel + Neon) comes in Milestone 6.

## Requirements

- Node.js 22+
- pnpm (`npm i -g pnpm`)
- A Postgres database: a **Neon dev branch** (recommended) or **local Docker Postgres**

## Setup

```bash
pnpm install
cp .env.example .env.local      # then fill in DATABASE_URL (see below)
pnpm db:migrate                 # create tables
pnpm db:seed                    # Batho Pele + Demo organisations
pnpm dev                        # http://localhost:3000
```

### Option A — Neon dev branch (recommended)

1. In the Vercel project, add **Neon** from the Marketplace (Storage → Neon). This creates
   the Neon project and sets `DATABASE_URL` for each environment.
2. In the Neon console, create a branch for yourself (e.g. `dev-yourname`) from `main`.
   Branches are cheap copies, so you can reset them freely.
3. Copy that branch's **pooled** connection string into `.env.local` as `DATABASE_URL`
   (or use `vercel env pull .env.local` for the development environment).

The app talks to Neon through `@neondatabase/serverless` (WebSocket pool).
`drizzle-kit migrate` uses a normal TCP connection, which Neon also supports.

### Option B — local Postgres with Docker

```bash
pnpm db:up          # starts postgres:17 on localhost:5432
# .env.local:
# DATABASE_URL=postgres://football:football@localhost:5432/football
pnpm db:migrate && pnpm db:seed
pnpm db:down        # stop (data is kept in a Docker volume)
```

When `DATABASE_URL` points at `localhost`, the app uses the `pg` driver instead of the Neon driver.

## Database workflow

- The schema lives in `lib/db/schema.ts`. After changing it, run
  `pnpm db:generate --name <change>` and commit the SQL in `db/migrations/`.
- `pnpm db:seed` is idempotent. Re-running it updates reference data and **inserts only new
  matches**, keyed on competition + home + away + match date. Results edited in admin are kept.
  `pnpm db:seed --overwrite-results` re-applies the results in the seed files.
- `pnpm db:seed` loads only the three 15 Aug Batho Pele results. The full Stream A results
  (transcribed from the organiser's posts) are in `tests/fixtures/stream-a-results.json`.
  Once the organiser confirms them, set `"unverified": false` in that file and run
  `pnpm db:seed:stream-a-results`. Until then the command refuses, except with
  `--allow-unverified`, which is meant for throwaway test databases only.

## Admin (prototype)

- Go to `/admin`. You sign in with the single `ADMIN_PASSWORD`, and a signed cookie (`AUTH_SECRET`) keeps
  you signed in for 14 days. Set real values in `.env.local`. Production refuses the example ones.
- The header switches the organisation you are working in.
- **Results**: tap a match, use the +/− buttons, then *Save provisional* or *Confirm & publish*. A
  confirmation is published straight away: the public table and pages update within seconds. The
  share panel then offers WhatsApp, the link, a Facebook caption, graphic downloads, and (on Android)
  *Share image…*, which sends the PNG straight to WhatsApp.
- **Paste**: paste fixtures from WhatsApp, fix any names shown in red, and save. Corrected names
  can be remembered as aliases. Fixtures that already exist are skipped.
- **Fixture**: add a fixture. Competition, date, time and venue stay filled in for the next one.
- **Teams**: add or edit teams and their aliases (other spellings).
- Competitions, team entries, points adjustments, venues and branding are managed with the seed
  and scripts for now.

## Graphics

PNG graphics are drawn with `next/og` in the organisation's branding. They are public, and they only
ever show confirmed results.

| URL | Graphic |
|---|---|
| `/graphics/{org}/matchday/{competition}?date=YYYY-MM-DD` | Table as at the date (default: latest result day), that day's results, top 3 |
| `/graphics/{org}/table/{competition}?date=…` | League table only |
| `/graphics/{org}/fixtures/{competition}?date=…` | Fixtures on a date (default: the next match day) |
| `/graphics/{org}/result/{matchId}` | Full-time result (404 until confirmed) |
| `/graphics/{org}/match/{matchId}` | Match card in any state (link previews). Never shows a provisional score |

- `size=portrait` (1080×1350, default), `square` (1080×1080) or `og` (1200×630).
- `download=1` makes the browser download the file.
- `v=…` is a content version: links from the app carry it, and it changes whenever the data changes,
  so shared links can be cached for a long time.

Every public page's link preview (`og:image`) uses these graphics.

- **Logos**: set `logo_url` on the organisation, competition or sponsor. It can be a file in
  `public/` (e.g. `/brand/qdl.png`) or an https URL. Without a logo, graphics show a text lockup.
- **Font**: Barlow Condensed (SIL OFL, `assets/fonts/`).

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test
```

`pnpm build` prerenders the home page, so it needs `DATABASE_URL`, just like the Vercel build.
`pnpm test` needs no database. DB tests run the real migrations against in-memory Postgres (PGlite).
