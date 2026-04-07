# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start local dev server at http://localhost:3000
npm run build        # Production build (also catches type errors)
npm run lint         # ESLint via next lint
npm run type-check   # tsc --noEmit (type-check without building)
```

There are no automated tests. Validate changes by running `npm run build` and manually testing in the browser.

## Environment Variables

Two env vars are required (set in `.env.local` for local dev, Vercel dashboard for prod):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Stripe keys will be added for v1 payment features. No `.env.local.example` exists yet — create it from the above.

## Architecture

**Next.js 15 App Router** — all pages are in `src/app/`, all using `'use client'` with `export const dynamic = 'force-dynamic'`. There is no server-side rendering or server components in use yet; auth checks and data fetching happen client-side in `useEffect`.

**Auth pattern**: Every page manually checks `supabase.auth.getUser()` in its `useEffect` and redirects to `/auth/login` on failure. There is no middleware (it was removed to fix a runtime error). Role-based access is not yet enforced at the route level — roles (`maga_admin`, `club_staff`, `parent`) come from the `users` table and are used to conditionally show UI.

**Supabase client**: Created inline in each component with `createBrowserClient` from `@supabase/ssr` — there is no shared singleton in `src/lib/`. When adding new pages, follow this same pattern.

**Styling**: All styles are inline using `const s: Record<string, React.CSSProperties>` objects defined at the bottom of each file. No CSS files, no Tailwind, no component library. Brand colors: `#0a0f1e` (navy, primary), `#f8f9fb` (page background), `#10b981` (green/success).

**API routes**: `src/app/api/scores/route.ts` handles POST (new score) and PATCH (correction). Currently the route validates inputs but does not write to Supabase — the actual upsert happens client-side in `src/app/scores/page.tsx`. The API route is a stub.

## Database Schema

Migrations are in `supabase/migrations/` and must be run manually in the Supabase SQL editor. Key tables:

- `associations` → `seasons` → `meets` (hierarchy)
- `clubs` → `teams` → `gymnasts` (club hierarchy)
- `users` — mirrors `auth.users`, has `role` (enum: `maga_admin`, `club_staff`, `parent`) and `club_id`
- `meet_lineups` — join of meet + gymnast, has `running_order`, `status` (active/scratched), `age_group`
- `scores` — one row per gymnast per meet, has `vault/bars/beam/floor` + corresponding `_dnc` boolean flags; upserted on conflict `(meet_id, gymnast_id)`

Meet lifecycle: `setup` → `active` → `finalized` (or `suspended`). Standings only include `finalized` meets. Score entry only shows `setup` and `active` meets.

## Scoring Rules (MAGA v1)

- Scores: 0.00–10.00, step 0.05
- AA = sum of competed events only; DNC events are excluded (not zeroed)
- Partial AA displayed as e.g. `36.50 (3/4)`
- Season standings rank by best score across meets (not average)
- State qualification: configurable minimum meets competed (default 4)

## Root-Level Scratch Files

`meet_new_page.tsx`, `meet_new_v2.tsx`, `meet_v2.b64`, and `standings_clean.tsx` in the repo root are draft/backup files, not part of the app. Do not import or reference them.
