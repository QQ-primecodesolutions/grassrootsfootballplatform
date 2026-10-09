# Grassroots Football Platform (prototype)

A mobile-first platform for community football leagues: public tables, fixtures and results,
a quick admin for entering results at the pitch, and branded graphics for WhatsApp and Facebook.
League tables are always calculated from confirmed match results. They are never typed in.

- [PLAN.md](PLAN.md): design and decisions
- [CLAUDE.md](CLAUDE.md): conventions for working on the code
- First pilot: Batho Pele Kasi Soccer Tournament (QwaQwa Development League, Open, Stream A)

Contents: [Local setup](#local-setup) · [Environment variables](#environment-variables) ·
[Database workflow](#database-workflow) · [Deploy to Vercel + Neon](#deploy-to-vercel--neon) ·
[Admin](#admin) · [Graphics](#graphics) · [Checks](#checks) · [Troubleshooting](#troubleshooting)

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
pnpm admin:super --email you@example.com --name "Your Name"   # prints a link to set your password
pnpm dev                        # http://localhost:3000
```

Open http://localhost:3000. For admin, open the link that `pnpm admin:super` printed, choose a
password, and you're signed in. Next time, sign in at http://localhost:3000/admin with your email.

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
   - `AUTH_SECRET` (Production and Preview; use a different value for each).
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

Finally, create your own super-admin account on production (same terminal, same `DATABASE_URL`).
`--site` makes the printed link point at the live site:

```powershell
pnpm admin:super --email you@example.com --name "Your Name" --site https://<your-app>.vercel.app
```

Open the printed link, choose a password, and you're signed in. Run the same command again if you
ever forget your password: it prints a fresh reset link.

### 5. Check it

- `https://<your-app>.vercel.app/` lists the organisation, and `/batho-pele` shows Stream A.
- `/admin`: sign in with your email and password, then confirm a test result and check the
  public table.
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

## Admin

### Accounts and organisations

Everyone signs in at `/admin` with their own email and password. A signed cookie keeps them
signed in for 14 days.

- **Platform admin (super admin)**: you. Sees every organisation, creates new ones, and adds or
  removes their admins under **Platform** (link in the admin header). Created with
  `pnpm admin:super` (see [Local setup](#local-setup) and [Deploy](#4-seed-production-once)).
- **Organisation admin**: works only in the organisations they were added to. The header switches
  between them if there is more than one.
- **Scorer**: for club officials or volunteers at the ground. Sees only **Results**: enters the
  score of a played match and taps *Send score for confirmation*. The score stays private until an
  organisation admin publishes it from **Waiting for you to publish** on the admin home, which
  shows who entered each score. A scorer can't change a published result, set a match as
  postponed or cancelled, or touch fixtures, teams or setup.
  - Choose the role when adding the person on the Platform page; *Make scorer* / *Make
    organisation admin* changes it later.
  - Organisation admins add their own scorers under **People & scorers** (admin home or Setup):
    name and email, then send the one-time link on WhatsApp. They can send new links to, and
    remove, scorers who belong only to their organisation. Adding another organisation admin
    stays with the platform admin.

Onboarding a new organisation:

1. **Platform → + New organisation**: name, link name (the public URL, fixed once created),
   colours, and optionally a logo link, Facebook page and hashtags.
   - It starts **unlisted**: `/{link-name}` works, but it isn't shown on the home page until you
     tap *List on home page*.
2. **Add an admin**: their name and email. The platform creates a one-time link (valid 7 days).
   Tap **WhatsApp** to send it. They open it, choose a password, and are signed in.
   - The link is shown only once. If it gets lost or expires, tap *New invite link*.
3. Tap *Work in this org* (or let its admin do it): **Setup → + New competition**, paste the team
   list, then add fixtures. See [Competitions and teams](#competitions-and-teams).

Forgotten password: on the organisation's Platform page, tap *Password reset link* next to the
person and send it to them (valid 24 hours). Removing someone signs them out straight away.

Security:

- Passwords are hashed with scrypt; invite and reset links are stored only as hashes.
- **Login lockout**: 5 wrong attempts from one device/network within 15 minutes block sign-in from
  there for 15 minutes. 100 failures from everywhere together pause sign-in for everyone for
  15 minutes. A correct sign-in resets the count.
- Changing your password (**Account**) signs you out on your other devices. Changing
  `AUTH_SECRET` signs everyone out.

### Competitions and teams

Under **Setup** (bottom bar). A new organisation's admin home shows the same three steps.

1. **+ New competition**: choose **League** (a table), **Knockout / cup** (rounds, a winner each
   match) or **Friendlies** (no table), then the name and season.
   - The link name (public URL) is suggested from the name and season and can't change later.
   - **Feature on the public home page**: the featured league leads the organisation's page.
     Only one competition is featured at a time.
2. **Teams**:
   - *Add new teams*: paste the list from WhatsApp, one per line. Numbers and bullets are removed,
     and names that match an existing team are reused instead of duplicated.
   - *Add existing teams*: tick teams already used in another competition.
   - A team can be removed only before it has matches in that competition. Edit names, short names
     and logos under **Teams**.
3. **Fixtures**: *Paste* or *Fixture* as before. For a cup, put the round (e.g. "Semi-final") in
   **Round**: the public page groups matches by it.
4. **Rules** (leagues): points for a win, draw and loss; the tie-breaker order; and the walkover
   score.
   - New competitions start with defaults, flagged as **not confirmed**. The admin home keeps
     reminding you until you tick *The organiser has confirmed these rules*.
   - Changing a rule recalculates the table straight away.
5. **Points adjustments** (leagues): deductions or awards announced by the organiser, with the
   reason and the date they apply from.
6. **Sponsors**: the names (or logos) along the bottom of the competition's graphics, up to 5.
   - Pick one of the organisation's sponsors, or add a new one with an optional logo link.
   - Use the arrows to set the order. A sponsor's logo is shared by every competition it's on.
   - With no sponsors, the graphics end at the hashtags.
7. **Delete this competition** (bottom of the page): only before it has any matches.

**Friendlies** (and matches in other organisers' tournaments): create one competition per season,
e.g. "Friendlies", with the **Friendlies** format. There's no table, and a level score is fine.
Extra time or a penalty shootout can be recorded if one was played. Opponents from outside the
league are just teams: paste their names. Their matches never affect a league table.

Group stages (groups, then knockouts) aren't supported yet.

Re-running `pnpm db:seed` refreshes only logos and Facebook links. Names, settings, rules and
sponsors edited in admin are kept.

### Logos

Every logo field (organisation, competition, team, sponsor) has **Upload logo**, **Remove**
and *Or paste a link*. Upload from the phone's gallery:

- The phone tidies the picture first. It removes a plain background colour (e.g. a JPEG's
  white) where it touches the edges, crops the empty margins, and shrinks it to 600 px. So a
  logo saved from WhatsApp fills its space on graphics, and stays small (usually under 100 KB).
- Only PNG and JPEG are stored (checked on the server). HEIC photos from iPhones work in Safari;
  elsewhere, save the logo as PNG or JPEG first.
- The logo changes when you **save the form**.
- Uploaded logos live in the database (`media` table) and are served from
  `/media/{org}/{id}.png` with a one-year cache. There's no separate file store to set up.
- The organisation logo is uploaded from **Platform → the organisation** (after creating it).

### Day-to-day admin
- **Results**: tap a match, use the +/− buttons, then *Save provisional* or *Confirm & publish*.
  - A confirmed result is published straight away, and the public table and pages update within
    seconds.
  - The share panel then offers WhatsApp, the link, a Facebook caption and graphic downloads. On
    Android there is also *Share image…*, which sends the PNG straight to WhatsApp.
- **Paste**: paste fixtures from WhatsApp, fix any names shown in red, and save. Corrected names
  can be remembered as aliases. Fixtures that already exist are skipped.
- **Fixture**: add one fixture. Competition, date, time and venue stay filled in for the next one.
- **Sharing fixtures** (before the matches):
  - After saving fixtures, tap *Share these fixtures*. The admin home also lists the coming match
    days under *Coming up: share fixtures*.
  - The page offers the fixtures graphic (portrait for WhatsApp status, square for Facebook),
    *Share image…* on Android, and a ready-made WhatsApp message.
  - Tap a match there (or open it from **Results**) and use *Announce this match* for a
    single-match "A vs B" graphic.
- **Setup**: competitions, their teams, rules and points adjustments (above). **All teams** lists
  every team with its aliases (other spellings).
- Venues are created from the fixture forms. Organisation branding is edited by the platform admin.

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
| Admin: "AUTH_SECRET still has the example value" or "login isn't set up" | Set a real `AUTH_SECRET` for that environment in Vercel, then redeploy. |
| Admin: "Too many wrong attempts from this device" | Wait the minutes shown. If you forgot the password, ask the platform admin for a reset link (platform admins: run `pnpm admin:super` again). |
| Neon SQL editor: `relation "organisations" does not exist` | The editor is on a different branch from your app. Switch branches, or run `pnpm db:migrate` against that one. |
| Link previews show an old image | WhatsApp and Facebook cache previews per link. Test a new link, or refresh the preview in Facebook's Sharing Debugger. |
| Graphics show text instead of a logo | Upload the logo in admin. For a pasted link: it must be https and return PNG, JPEG, SVG or WebP under 1.5 MB. |
| Logo upload: "That picture can't be read here" | The browser can't open that format (often HEIC). Save it as PNG or JPEG and upload again. |
| `pnpm install` refuses a package version | pnpm's minimum-release-age policy blocks very new releases. Pick an older version; don't bypass the policy. |
