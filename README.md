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
- Real Batho Pele results go in `scripts/seed/data/batho-pele-stream-a.ts`. Only add
  results the organiser has published or confirmed.

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test
```

`pnpm test` needs no database. DB tests run the real migrations against in-memory Postgres (PGlite).
