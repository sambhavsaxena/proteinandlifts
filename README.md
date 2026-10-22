# Trainory

Protein tracker and workout planner — https://trainory.pages.dev

The website for Trainory. The iOS/Android app lives in
[trainory-app](https://github.com/sambhavsaxena/trainory-app) and shares this
Supabase project, so accounts and data are the same on both.

Astro (static output) + Tailwind 4 + Preact islands, with Supabase for auth,
data and photo storage. There is no server code: the browser talks to Supabase
directly and row-level security keeps each account's rows private.

## Layout

| Path | What lives there |
|---|---|
| `src/pages/` | Public pages (`/`, legal, 404/500), auth pages, and the `/app/*` shells |
| `src/app/` | The signed-in screens (Preact): Today, Workouts, Session, Diet, Reports, Settings |
| `src/lib/` | Supabase client, date helpers, diet maths, photo upload, starter-plan seeding |
| `src/data/` | Starter plans, one training programme per goal and one diet per way of eating (`starter.ts`), and the shared food list (`food-catalog.ts`) |
| `scripts/` | `build-exercise-catalog.mjs` (exercise catalog and photos) and `build-icons.mjs` (favicon, PWA icons, social card from `scripts/brand/trainory.svg`) |
| `public/exercises/`, `public/exercise-catalog.json` | The full exercise catalog and its photos ([free-exercise-db](https://github.com/yuhonas/free-exercise-db), public domain) |
| `supabase/migrations/` | Database schema, RLS policies and the storage bucket |

## Run it locally

Needs Node 22+, Docker and the Supabase CLI.

```sh
npm install
supabase start                # local Postgres, auth and storage; applies the migration
supabase status -o env        # copy API_URL and ANON_KEY into .env.local (see .env.example)
npm run dev                   # http://localhost:4321
```

Local sign-ups need no email confirmation. A new account goes through
onboarding (weight, height, target weight, diet) and is seeded with the
training programme for its goal and a four-meal starter diet for its way of
eating, built from the shared food list. Users add more from the shared list
(filtered by their diet) or foods of their own.

## Exercise catalog

The in-app picker reads `public/exercise-catalog.json`; photos live in
`public/exercises/<id>/`. Both are generated, along with
`src/data/starter-exercises.json`, from a clone of free-exercise-db:

```sh
git clone --depth 1 https://github.com/yuhonas/free-exercise-db /tmp/fedb
node scripts/build-exercise-catalog.mjs /tmp/fedb
```

Starter plans refer to exercises by the keys in `src/data/starter-exercise-keys.json`.

## Checks

```sh
npx astro check
npm run build
node ~/.claude/skills/create-saas/verify.mjs --keyword "protein tracker"
```

## Environments

- `.env` holds the cloud Supabase project (`trainory`, ref `hyohztyiyhkokyleleuc`) and is used by `npm run dev` and `npm run build` alike.
- `.env.supabase-local` holds the local stack's URL and key. Copy it to `.env.local` to develop against `supabase start` instead; `.env.local` wins over `.env`.

## Deploying

Hosted on Cloudflare Pages, project `trainory` (https://trainory.pages.dev).

```sh
npm run deploy                # astro build && wrangler pages deploy dist
```

- The Supabase URL and key are baked into the bundle at build time.
- `public/_headers` sends `X-Robots-Tag: noindex` on branch and commit previews (`*.trainory.pages.dev`) so only the production host is indexed. If a custom domain is added, update `site` in `astro.config.mjs`, `SITE.domain`, `robots.txt`, and add `trainory.pages.dev` to `_headers`.
- Schema changes go in a new file under `supabase/migrations/`, applied with `supabase db push` after `supabase link --project-ref hyohztyiyhkokyleleuc`.
- In the Supabase dashboard (Authentication → URL Configuration) the Site URL must be the live origin, with `<origin>/app/` and `<origin>/reset/` as redirect URLs. Configure custom SMTP before opening sign-ups: the built-in mailer is rate limited.
