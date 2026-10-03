# Grassroots Football Platform (prototype)

A mobile-first platform for community football leagues: public tables, fixtures and results,
a quick admin for entering results at the pitch, and branded graphics for WhatsApp and Facebook.
League tables are always calculated from confirmed match results. They are never typed in.

- [PLAN.md](PLAN.md): design and decisions
- [CLAUDE.md](CLAUDE.md): conventions for working on the code
- First pilot: Batho Pele Kasi Soccer Tournament (QwaQwa Development League, Open, Stream A)

Contents: [Local setup](#local-setup) · [Environment variables](#environment-variables) ·
[Database workflow](#database-workflow) · [Deploy to Vercel + Neon](#deploy-to-vercel--neon) ·
[Admin](#admin-prototype) · [Graphics](#graphics) · [Checks](#checks) · [Troubleshooting](#troubleshooting)

## Local setup

Requirements:

- Node.js 22 (production runs 22.x, pinned in `package.json`)
- pnpm 12 (`npm i -g pnpm@12`, or `corepack enable`)
- Git
- A Postgres database: a Neon branch (Option A) or Docker (Option B)

```bash
git clone <your-repo-url> grassroots-football
cd grassroots-football
pnpm install
cp .env.example .env.local      # then set DATABASE_URL (Option A or B below)
pnpm db:migrate                 # create the tables
pnpm db:seed                    # Batho Pele + the fictional Demo organisation
pnpm dev                        # http://localhost:3000
```

Open http://localhost:3000. For admin, go to http://localhost:3000/admin. The password is
`ADMIN_PASSWORD` from `.env.local`.

### Option A: a Neon branch (recommended)

1. Create a Neon project, either at https://console.neon.tech or through the Vercel integration
   (see [Deploy](#deploy-to-vercel--neon)).
2. In the Neon console, create a branch for development (e.g. `dev`) from `main`. A branch is a
   cheap copy of the database that you can reset at any time, and it keeps your experiments away
   from production.
3. Open **Connect** for that branch and copy two strings into `.env.local`:
   - the **pooled** one (host contains `-pooler`) as `DATABASE_URL`
   - the **direct** one as `DATABASE_URL_UNPOOLED` (used for migrations)

In the Neon **SQL Editor**, check that the branch selector shows the branch you are using.

### Option B: local Postgres with Docker

```bash
pnpm db:up          # starts postgres:17 on localhost:5432
# in .env.local:
# DATABASE_URL=postgres://football:football@localhost:5432/football
pnpm db:migrate && pnpm db:seed
pnpm db:down        # stops it (the data is kept in a Docker volume)
```

## Environment variables

| Variable | Needed for | Notes |
|---|---|---|
| `DATABASE_URL` | app, build, scripts | Postgres URL. On Neon use the **pooled** string. The Vercel/Neon integration sets it. |
| `DATABASE_URL_UNPOOLED` | migrations | Neon **direct** string. Optional: falls back to `DATABASE_URL`. The integration sets it. |
| `ADMIN_PASSWORD` | admin | At least 8 characters. Production refuses the value from `.env.example`. |
| `AUTH_SECRET` | admin | At least 32 characters; signs the admin cookie. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Changing it signs everyone out. |
| `NEXT_PUBLIC_APP_NAME` | UI | Product name shown in the app (default "Grassroots Football"). |
| `NEXT_PUBLIC_SITE_URL` | share links, link previews | The public address, e.g. `https://football.example.org`. On Vercel it falls back to the production domain, and preview deployments always use their own URL. |
| `ENABLE_EXPERIMENTAL_COREPACK` | Vercel builds only | Set to `1` so Vercel uses the pnpm version pinned in `package.json` (see [Deploy](#deploy-to-vercel--neon)). |

`NEXT_PUBLIC_*` values are built into the app. After changing one on Vercel, redeploy.

Local files: Next.js and the scripts read `.env.local`. **Don't create `.env.production.local`**
with production values. Next.js and the scripts also read that file, so `pnpm build` and
`pnpm db:seed` would quietly use the production database.

## Database workflow

- The schema is in `lib/db/schema.ts`. After you change it, run
  `pnpm db:generate --name <what-changed>`, check the SQL it writes to `db/migrations/`, and
  commit it.
- `pnpm db:migrate` applies new migrations. On Vercel this runs automatically before every
  build (see `vercel.json`).
- `pnpm db:seed` is safe to run again. It updates reference data and **inserts only new
  matches**, keyed on competition + home + away + match date. Results edited in admin are kept.
  - `--overwrite-results` re-applies the results in the seed files.
  - `--no-demo` leaves out the fictional Demo organisation. Use it for a real pilot's production
    database.
- `pnpm db:seed` loads only the three 15 August Batho Pele results. The full Stream A results
  (transcribed from the organiser's posts) are in `tests/fixtures/stream-a-results.json`.
  - Load them with `pnpm db:seed:stream-a-results` (on production: set `DATABASE_URL` as in
    [Seed production](#4-seed-production-once), then redeploy so the pages refresh).
  - Results marked `"pending": true` (currently Round 5 Samba Boys v Passion) load as
    *provisional*: they stay private and don't count. Once the organiser confirms the score, open
    the match in **/admin → Results**, correct it if needed, and tap *Confirm & publish*.
  - If the file is ever marked `"unverified": true`, the command refuses to run unless you pass
    `--allow-unverified`. That flag is
    for throwaway test databases only.
- `pnpm db:studio` opens Drizzle Studio to browse the data.

## Deploy to Vercel + Neon

You need a GitHub (or GitLab/Bitbucket) repository with this code, a Vercel account and a Neon
account. Neon can also be created from inside Vercel.

### 1. Create the Vercel project

1. In Vercel, **Add New… → Project** and import the repository. Vercel detects **Next.js**.
   Leave the build and install settings as they are: `vercel.json` sets the build command to
   `pnpm db:migrate && pnpm build`.
2. Before the first deploy, open **Environment Variables** and add:
   - `ENABLE_EXPERIMENTAL_COREPACK` = `1` (all environments).
     - Without it, Vercel installs with its own pnpm version (currently up to 10), which doesn't
       match this project's pnpm 12 settings.
   - `ADMIN_PASSWORD` and `AUTH_SECRET` (Production and Preview; use different values for each).
   - `NEXT_PUBLIC_APP_NAME` (all environments).
3. Importing starts a first deploy straight away. It fails with "DATABASE_URL … is missing" until
   Neon is connected (next section). That's expected.

### 2. Connect Neon

1. In the Vercel project, open **Storage** (or the **Marketplace**) and add **Neon**. Create a new
   database, or link an existing Neon project.
   - **Choose the region when you create it**, because it can't easily be changed later.
     **AWS Europe (Frankfurt)** is the closest to South Africa.
   - Set Vercel's function region to match, under **Settings → Functions → Region**
     (`fra1` for Frankfurt).
2. In the **Configure** dialog:
   - **Environments**: Production and Preview.
   - **Create Database Branch For Deployment**: tick **Preview** only. Never tick Production:
     every production deploy would then get a new branch, and live results would be split
     across branches.
   - **Custom Environment Variable Prefix**: `DATABASE`. This gives `DATABASE_URL` (pooled) and
     `DATABASE_URL_UNPOOLED` (direct), which the app and migrations read. The suggested
     `STORAGE` prefix would make the build fail with "DATABASE_URL … is missing".
   - **Sensitive**: leave it on. Builds can still read the values; to seed, copy the connection
     string from the Neon console instead.
3. With preview branches, each preview deployment gets its own copy of the database, and the
   build's `pnpm db:migrate` applies any new migrations to that copy.

### 3. Deploy

Redeploy (Deployments → ⋯ → Redeploy), or push a commit. The build:

1. installs with the pinned pnpm, on Node 22 (`engines` in `package.json`)
2. runs `pnpm db:migrate`, which creates or updates the tables in that environment's database
3. runs `pnpm build`, which prerenders the home page and needs the database

If a migration fails, the build stops and the previous deployment stays live.

### 4. Seed production (once)

The production database starts empty. Load the pilot's data from your machine by passing the
production URL to these commands. Always migrate first: the seed may need columns that the
next deploy hasn't added yet.

```bash
# Neon console → production branch (main) → Connect → pooled connection string
export DATABASE_URL="postgres://…-pooler…/neondb?sslmode=require"
pnpm db:migrate
pnpm db:seed --no-demo
```

On Windows PowerShell (the VS Code default), use a new terminal and close it afterwards:

```powershell
$env:DATABASE_URL="postgres://…-pooler…/neondb?sslmode=require"
pnpm db:migrate
pnpm db:seed --no-demo
```

A variable set on the command line takes priority over `.env.local`, so this can't touch your
dev branch. Both commands are safe to run again later: re-run them after updating the seed
(e.g. new logos or links). Migrating only applies migrations that haven't run yet, and the seed
keeps results entered in admin.

Then **redeploy once**. The home page was built while the database was empty, and the site
keeps that copy for up to an hour. A redeploy rebuilds it with the new organisation.

### 5. Check it

- `https://<your-app>.vercel.app/` lists the organisation, and `/batho-pele` shows Stream A.
- `/admin`: log in with the production `ADMIN_PASSWORD`, then confirm a test result and check
  the public table.
- Share a match link in WhatsApp: the preview shows the match graphic.
  - WhatsApp caches previews per link, so test with a link you haven't shared before.
- `/graphics/batho-pele/matchday/qdl-open-stream-a-2026` returns the matchday PNG.

### 6. Custom domain (optional)

Add the domain under **Settings → Domains**. Then set `NEXT_PUBLIC_SITE_URL` to
`https://<domain>` for **Production only** and redeploy, so share links and previews use it.

### Day-to-day

- **Deploying**: push to the production branch. Migrations run first, then the build.
- **Schema changes**: `pnpm db:generate --name …` locally, then test on your dev branch with
  `pnpm db:migrate`, then commit. The next deploy migrates production.
- **Rolling back**: in Vercel, use **Instant Rollback** to go back to an earlier deployment.
  Migrations aren't rolled back, so keep them additive (add columns and tables; drop them later).
- **Backups**: Neon keeps history for point-in-time restore. The window depends on your Neon
  plan. Before a risky change, create a branch from production as a snapshot.

## Admin (prototype)

- Go to `/admin`. You sign in with the single `ADMIN_PASSWORD`, and a signed cookie keeps you
  signed in for 14 days.
- The header switches the organisation you are working in.
- **Results**: tap a match, use the +/− buttons, then *Save provisional* or *Confirm & publish*.
  - A confirmed result is published straight away, and the public table and pages update within
    seconds.
  - The share panel then offers WhatsApp, the link, a Facebook caption and graphic downloads. On
    Android there is also *Share image…*, which sends the PNG straight to WhatsApp.
- **Paste**: paste fixtures from WhatsApp, fix any names shown in red, and save. Corrected names
  can be remembered as aliases. Fixtures that already exist are skipped.
- **Fixture**: add one fixture. Competition, date, time and venue stay filled in for the next one.
- **Teams**: add or edit teams and their aliases (other spellings).
- Competitions, team entries, points adjustments, venues and branding are managed through the
  seed and scripts for now.

## Graphics

PNG graphics are drawn with `next/og` in the organisation's branding. They are public, and they
only ever show confirmed results.

| URL | Graphic |
|---|---|
| `/graphics/{org}/matchday/{competition}?date=YYYY-MM-DD` | Table as at the date (default: latest result day), that day's results, top 3 |
| `/graphics/{org}/table/{competition}?date=…` | League table only |
| `/graphics/{org}/fixtures/{competition}?date=…` | Fixtures on a date (default: the next match day) |
| `/graphics/{org}/result/{matchId}` | Full-time result (404 until confirmed) |
| `/graphics/{org}/match/{matchId}` | Match card in any state (link previews); never shows a provisional score |

- `size=portrait` (1080×1350, default), `square` (1080×1080) or `og` (1200×630).
- `download=1` makes the browser download the file.
- `v=…` is a content version. Links from the app carry it, and it changes whenever the data
  changes, so shared links can be cached for a long time.

Every public page's link preview (`og:image`) uses these graphics.

- **Social links**: `social_links` on the organisation and on the competition (the competition
  brand's own pages, e.g. QDL). Each one adds a link on the public site and a Facebook icon on the
  graphics. Only https links are shown.
- **Logos**: set `logo_url` on the organisation, competition or sponsor. It can be a file in
  `public/` (e.g. `/brand/qdl.png`) or an https URL. Without a logo, graphics show a text lockup.
- **Font**: Barlow Condensed (SIL Open Font License, `assets/fonts/`).

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test
```

- `pnpm test` needs no database. DB tests run the real migrations against in-memory Postgres
  (PGlite).
- `pnpm build` prerenders the home page, so it needs `DATABASE_URL`, just like the Vercel build.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build: `DATABASE_URL is missing` | Connect Neon to that environment (Production/Preview) in Vercel, or set `DATABASE_URL` in `.env.local` locally. |
| Build: pnpm version or `allowBuilds` errors during install | Set `ENABLE_EXPERIMENTAL_COREPACK=1` on the Vercel project and redeploy. |
| Admin: "ADMIN_PASSWORD / AUTH_SECRET still have the example values" | Set real values for Production in Vercel, then redeploy. |
| Neon SQL editor: `relation "organisations" does not exist` | The editor is on a different branch from your app. Switch branches, or run `pnpm db:migrate` against that one. |
| Link previews show an old image | WhatsApp and Facebook cache previews per link. Test a new link, or refresh the preview in Facebook's Sharing Debugger. |
| Graphics show text instead of a logo | Check `logo_url`: a file under `public/` starting with `/`, or an https URL returning PNG, JPEG, SVG or WebP under 1.5 MB. |
| `pnpm install` refuses a package version | pnpm's minimum-release-age policy blocks very new releases. Pick an older version; don't bypass the policy. |
