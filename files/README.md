# Gymnastats

MAGA Club Gymnastics Scoring & Results Platform

Built with Next.js 15, Supabase, and Stripe Connect.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase (PostgreSQL + Row Level Security)
- **Auth**: Supabase Auth
- **Payments**: Stripe Connect (parent access fees go directly to clubs)
- **Hosting**: Vercel
- **Language**: TypeScript

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── scores/         # Score entry & correction API
│   ├── auth/login/         # Login page
│   ├── dashboard/          # Role-based dashboard
│   ├── meet/               # Meet management & score entry
│   ├── lineup/             # Coach lineup management
│   └── results/            # Season standings & reports
├── components/
│   ├── ui/                 # Shared UI components
│   ├── meet/               # Meet-specific components
│   ├── scores/             # Score entry components
│   ├── lineup/             # Lineup drag-and-drop
│   └── awards/             # Awards ceremony output
├── lib/
│   └── supabase.ts         # Browser & server Supabase clients
├── types/
│   └── index.ts            # All TypeScript types + scoring utilities
└── middleware.ts            # Auth protection (all routes require login)
```

---

## Database

```
supabase/migrations/
├── 001_initial_schema.sql  # Full schema with RLS policies
└── 002_seed_data.sql       # Blizzard Invite 2015 seed data
```

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/SJW-Guest/Gymnastats.git
cd Gymnastats
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run `supabase/migrations/001_initial_schema.sql`
3. Optionally run `supabase/migrations/002_seed_data.sql` for sample data

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in your Supabase URL, anon key, and Stripe keys.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Deploy to Vercel

1. Push to GitHub
2. Import repo in [vercel.com](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Point Gymnastats.com domain in Vercel → Settings → Domains

---

## User Roles

| Role | Access |
|------|--------|
| `maga_admin` | Full system access, score corrections, season dashboard |
| `club_staff` | Their club's teams, rosters, lineups, meet management |
| `parent` | Their gymnast's score history, live scoring (if purchased) |

---

## Key Scoring Rules (MAGA v1)

- Scores: 0.00 – 10.00, hundredths precision
- Team score: top 4 per event per team
- AA: sum of competed events only — no zeroes inserted for DNC
- Partial AA labeled clearly — never ambiguous
- State qualification: configurable meet minimum (default 4)
- Drop lowest meets when team attends more than minimum
- Score corrections: MAGA admin only, full audit trail + club email notification

---

## Roadmap

### v1 (Current)
- MAGA regular season meets
- Score entry (table + judge mobile)
- Lineup management with drag-to-reorder
- Live & post-meet results
- Awards ceremony report
- Parent access with Stripe Connect
- Season standings & State qualification tracking

### v2
- State tournament (15 divisions, performance-based seeding)
- Push notifications
- Age group automation from birth date
- Additional associations (AAU, USAG, MN HS)
- API for State tournament operator integration
