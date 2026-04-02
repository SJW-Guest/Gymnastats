-- ============================================================
-- Gymnastats v1 - Initial Schema
-- MAGA Club Gymnastics Scoring Platform
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUMERATIONS
-- ============================================================

create type user_role as enum ('maga_admin', 'club_staff', 'parent');
create type age_group as enum ('Novice', 'Children', 'Junior', 'Senior');
create type meet_status as enum ('setup', 'active', 'finalized', 'suspended');
create type results_visibility as enum ('live', 'after_finalized');
create type scratch_reason as enum ('injury', 'illness', 'no_show', 'other');
create type dnc_reason as enum ('injury', 'illness', 'other');
create type division_group as enum ('Upper', 'Lower');
create type payment_type as enum ('per_meet', 'season');
create type payment_status as enum ('pending', 'paid', 'manual');

-- ============================================================
-- ASSOCIATIONS (future-proofed for AAU, USAG, MN HS, etc.)
-- ============================================================

create table associations (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,                        -- 'MAGA', 'USAG', 'AAU', etc.
  abbreviation  text not null unique,
  is_active     boolean default true,
  created_at    timestamptz default now()
);

insert into associations (name, abbreviation) values ('Midwest Amateur Gymnastics Association', 'MAGA');

-- ============================================================
-- SEASONS
-- ============================================================

create table seasons (
  id                        uuid primary key default uuid_generate_v4(),
  association_id            uuid not null references associations(id),
  name                      text not null,             -- '2024-2025'
  start_date                date not null,             -- Oct 1
  end_date                  date not null,             -- Feb 28
  state_meet_min_qualifiers int not null default 4,    -- configurable min meets for State
  registration_deadline     date,
  fee_deadline              date,
  is_active                 boolean default false,
  created_at                timestamptz default now()
);

-- ============================================================
-- CLUBS
-- ============================================================

create table clubs (
  id               uuid primary key default uuid_generate_v4(),
  association_id   uuid not null references associations(id),
  name             text not null,
  city             text,
  state            text default 'MN',
  contact_email    text,
  contact_phone    text,
  is_active        boolean default true,
  -- Stripe Connect for parent payment collection
  stripe_account_id        text,                      -- Stripe Connect account ID
  stripe_onboarded         boolean default false,
  parent_meet_price_cents  int,                       -- price clubs charge per meet access
  parent_season_price_cents int,                      -- price clubs charge for season access
  created_at       timestamptz default now()
);

-- ============================================================
-- USERS
-- ============================================================

create table users (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null unique,
  full_name    text not null,
  role         user_role not null,
  club_id      uuid references clubs(id),             -- null for maga_admin and parents
  is_active    boolean default true,
  created_at   timestamptz default now()
);

-- MAGA admins — board members designated each season
create table maga_admin_seasons (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references users(id),
  season_id    uuid not null references seasons(id),
  designated_by uuid references users(id),
  created_at   timestamptz default now(),
  unique(user_id, season_id)
);

-- ============================================================
-- TEAMS
-- ============================================================

create table teams (
  id             uuid primary key default uuid_generate_v4(),
  club_id        uuid not null references clubs(id),
  name           text not null,                       -- 'Northfield Blue', 'Northfield Silver'
  division_group division_group,                      -- 'Upper' or 'Lower' (MAGA-specific)
  is_active      boolean default true,
  created_at     timestamptz default now()
);

-- ============================================================
-- GYMNASTS
-- ============================================================

create table gymnasts (
  id           uuid primary key default uuid_generate_v4(),
  first_name   text not null,
  last_name    text not null,
  birth_date   date,                                  -- stored for future age group automation
  -- current assignment (updated each season)
  current_club_id  uuid references clubs(id),
  current_team_id  uuid references teams(id),
  age_group        age_group,                         -- manually set each season by club staff
  is_active        boolean default true,
  created_at       timestamptz default now()
);

-- Season roster — which gymnasts are on which team for a given season
-- This is the gate before their first meet
create table season_rosters (
  id           uuid primary key default uuid_generate_v4(),
  season_id    uuid not null references seasons(id),
  gymnast_id   uuid not null references gymnasts(id),
  team_id      uuid not null references teams(id),
  age_group    age_group not null,                    -- age group for this season specifically
  is_active    boolean default true,                  -- false = removed mid-season
  created_at   timestamptz default now(),
  unique(season_id, gymnast_id)                       -- one roster entry per gymnast per season
);

-- ============================================================
-- PARENT / FOLLOWER ACCESS
-- ============================================================

create table gymnast_followers (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references users(id),
  gymnast_id   uuid not null references gymnasts(id),
  relationship text,                                  -- 'parent', 'grandparent', 'guardian', etc.
  created_at   timestamptz default now(),
  unique(user_id, gymnast_id)
);

-- Tracks what access a follower has paid for
create table follower_access (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references users(id),
  gymnast_id       uuid not null references gymnasts(id),
  club_id          uuid not null references clubs(id),  -- which club collected payment
  season_id        uuid references seasons(id),          -- null = per-meet access
  meet_id          uuid,                                 -- null = season access (FK added later)
  payment_type     payment_type not null,
  payment_status   payment_status not null default 'pending',
  amount_cents     int,
  stripe_payment_intent_id text,
  paid_at          timestamptz,
  created_at       timestamptz default now()
);

-- ============================================================
-- MEETS
-- ============================================================

create table meets (
  id                   uuid primary key default uuid_generate_v4(),
  season_id            uuid not null references seasons(id),
  host_club_id         uuid not null references clubs(id),
  name                 text not null,                 -- 'Blizzard Invite 2025'
  meet_date            date not null,
  location             text,
  status               meet_status not null default 'setup',
  results_visibility   results_visibility not null default 'after_finalized',
  num_judges           int default 1,
  -- State qualification: lowest score tracking
  counts_for_state     boolean default true,
  -- Suspension support
  suspended_at         timestamptz,
  suspended_reason     text,
  created_by           uuid references users(id),
  created_at           timestamptz default now()
);

-- Add the FK now that meets table exists
alter table follower_access add constraint fk_meet foreign key (meet_id) references meets(id);

-- Which teams are participating in a meet (host adds them)
create table meet_teams (
  id           uuid primary key default uuid_generate_v4(),
  meet_id      uuid not null references meets(id),
  team_id      uuid not null references teams(id),
  division_group division_group,                      -- division assignment for THIS meet
  created_at   timestamptz default now(),
  unique(meet_id, team_id)
);

-- ============================================================
-- DIVISIONS (per meet — flexible naming)
-- ============================================================

create table meet_divisions (
  id           uuid primary key default uuid_generate_v4(),
  meet_id      uuid not null references meets(id),
  name         text not null,                         -- 'Upper', 'Lower'
  created_at   timestamptz default now(),
  unique(meet_id, name)
);

-- ============================================================
-- MEET LINEUPS
-- ============================================================

-- The official running order for each team at each meet
-- Max 10 gymnasts per team per meet
create table meet_lineups (
  id              uuid primary key default uuid_generate_v4(),
  meet_id         uuid not null references meets(id),
  team_id         uuid not null references teams(id),
  gymnast_id      uuid not null references gymnasts(id),
  age_group       age_group not null,
  running_order   int not null check (running_order between 1 and 10),
  -- Game-day status
  status          text not null default 'active'
                  check (status in ('active', 'scratched')),
  scratch_reason  scratch_reason,
  scratched_at    timestamptz,
  scratched_by    uuid references users(id),
  created_at      timestamptz default now(),
  unique(meet_id, team_id, running_order),
  unique(meet_id, gymnast_id)
);

-- ============================================================
-- JUDGE ASSIGNMENTS
-- ============================================================

create table judge_assignments (
  id           uuid primary key default uuid_generate_v4(),
  meet_id      uuid not null references meets(id),
  user_id      uuid not null references users(id),
  event        text not null check (event in ('vault', 'bars', 'beam', 'floor')),
  created_at   timestamptz default now(),
  unique(meet_id, event, user_id)
);

-- ============================================================
-- SCORES
-- ============================================================

-- One row per gymnast per meet
-- null score = not yet entered
-- dnc = true means explicitly Did Not Compete (never null-filled to 0)
create table scores (
  id              uuid primary key default uuid_generate_v4(),
  meet_id         uuid not null references meets(id),
  gymnast_id      uuid not null references gymnasts(id),
  team_id         uuid not null references teams(id),
  age_group       age_group not null,
  division_group  division_group,

  -- Vault
  vault           numeric(5,2) check (vault >= 0 and vault <= 10),
  vault_dnc       boolean not null default false,
  vault_dnc_reason dnc_reason,
  vault_entered_by uuid references users(id),
  vault_entered_at timestamptz,

  -- Bars
  bars            numeric(5,2) check (bars >= 0 and bars <= 10),
  bars_dnc        boolean not null default false,
  bars_dnc_reason dnc_reason,
  bars_entered_by uuid references users(id),
  bars_entered_at timestamptz,

  -- Beam
  beam            numeric(5,2) check (beam >= 0 and beam <= 10),
  beam_dnc        boolean not null default false,
  beam_dnc_reason dnc_reason,
  beam_entered_by uuid references users(id),
  beam_entered_at timestamptz,

  -- Floor
  floor           numeric(5,2) check (floor >= 0 and floor <= 10),
  floor_dnc       boolean not null default false,
  floor_dnc_reason dnc_reason,
  floor_entered_by uuid references users(id),
  floor_entered_at timestamptz,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique(meet_id, gymnast_id)
);

-- Computed all-around (sum of competed events only — never adds zeroes)
create or replace view scores_with_aa as
select
  s.*,
  -- Count of competed events
  (case when s.vault  is not null and not s.vault_dnc  then 1 else 0 end +
   case when s.bars   is not null and not s.bars_dnc   then 1 else 0 end +
   case when s.beam   is not null and not s.beam_dnc   then 1 else 0 end +
   case when s.floor  is not null and not s.floor_dnc  then 1 else 0 end
  ) as events_competed,
  -- All-around = sum of competed events only
  (coalesce(case when not s.vault_dnc then s.vault else null end, 0) +
   coalesce(case when not s.bars_dnc  then s.bars  else null end, 0) +
   coalesce(case when not s.beam_dnc  then s.beam  else null end, 0) +
   coalesce(case when not s.floor_dnc then s.floor else null end, 0)
  ) as all_around,
  -- Is this a partial AA?
  (case when
    (case when s.vault is not null and not s.vault_dnc then 1 else 0 end +
     case when s.bars  is not null and not s.bars_dnc  then 1 else 0 end +
     case when s.beam  is not null and not s.beam_dnc  then 1 else 0 end +
     case when s.floor is not null and not s.floor_dnc then 1 else 0 end) < 4
   then true else false end
  ) as is_partial_aa
from scores s;

-- ============================================================
-- SCORE AUDIT TRAIL
-- ============================================================

create table score_corrections (
  id              uuid primary key default uuid_generate_v4(),
  score_id        uuid not null references scores(id),
  meet_id         uuid not null references meets(id),
  gymnast_id      uuid not null references gymnasts(id),
  corrected_by    uuid not null references users(id),   -- must be maga_admin
  event           text not null check (event in ('vault', 'bars', 'beam', 'floor')),
  old_value       numeric(5,2),
  new_value       numeric(5,2),
  reason          text,
  -- Notification tracking
  club_notified   boolean default false,
  notified_at     timestamptz,
  created_at      timestamptz default now()
);

-- ============================================================
-- TEAM SCORES (computed after meet, stored for performance)
-- ============================================================

-- Top 4 per event per team = team score
-- Computed and stored after finalization, recalculated on correction
create table team_meet_scores (
  id              uuid primary key default uuid_generate_v4(),
  meet_id         uuid not null references meets(id),
  team_id         uuid not null references teams(id),
  division_group  division_group,
  -- Top 4 event totals
  vault_total     numeric(6,2),
  bars_total      numeric(6,2),
  beam_total      numeric(6,2),
  floor_total     numeric(6,2),
  -- Team AA = sum of top 4 per event
  team_aa_total   numeric(7,2),
  -- Placement within division
  division_place  int,
  -- Tiebreaker: 5th place scores (rarely used)
  vault_5th       numeric(5,2),
  bars_5th        numeric(5,2),
  beam_5th        numeric(5,2),
  floor_5th       numeric(5,2),
  computed_at     timestamptz default now(),
  unique(meet_id, team_id)
);

-- ============================================================
-- SEASON STANDINGS & STATE QUALIFICATION
-- ============================================================

-- Tracks each team's meet participation toward State qualification
create table season_team_standings (
  id                    uuid primary key default uuid_generate_v4(),
  season_id             uuid not null references seasons(id),
  team_id               uuid not null references teams(id),
  meets_attended        int default 0,
  meets_counting        int default 0,    -- after dropping lowest scores
  best_meets_total      numeric(8,2),     -- sum of top N meet scores
  qualifies_for_state   boolean default false,
  updated_at            timestamptz default now(),
  unique(season_id, team_id)
);

-- Which meets count for each team (drops lowest when over minimum)
create table team_qualifying_meets (
  id           uuid primary key default uuid_generate_v4(),
  season_id    uuid not null references seasons(id),
  team_id      uuid not null references teams(id),
  meet_id      uuid not null references meets(id),
  team_aa_total numeric(7,2),
  is_counting  boolean not null default true,   -- false = dropped (lowest score)
  unique(season_id, team_id, meet_id)
);

-- ============================================================
-- AWARDS CONFIGURATION PER MEET
-- ============================================================

create table meet_awards_config (
  id                    uuid primary key default uuid_generate_v4(),
  meet_id               uuid not null references meets(id) unique,
  award_individual_events boolean default true,
  award_aa              boolean default true,
  award_team            boolean default true,
  max_places            int,                     -- null = award all places
  created_at            timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table clubs enable row level security;
alter table users enable row level security;
alter table teams enable row level security;
alter table gymnasts enable row level security;
alter table season_rosters enable row level security;
alter table meets enable row level security;
alter table meet_lineups enable row level security;
alter table scores enable row level security;
alter table score_corrections enable row level security;
alter table gymnast_followers enable row level security;
alter table follower_access enable row level security;

-- Helper: get current user's role
create or replace function get_user_role()
returns user_role as $$
  select role from users where id = auth.uid();
$$ language sql security definer;

-- Helper: get current user's club_id
create or replace function get_user_club_id()
returns uuid as $$
  select club_id from users where id = auth.uid();
$$ language sql security definer;

-- Helper: check if current user is maga_admin
create or replace function is_maga_admin()
returns boolean as $$
  select exists(select 1 from users where id = auth.uid() and role = 'maga_admin');
$$ language sql security definer;

-- CLUBS: admins see all, club_staff see their own, parents see none
create policy "clubs_select" on clubs for select using (
  is_maga_admin() or
  (get_user_role() = 'club_staff' and id = get_user_club_id())
);

-- MEETS: admins see all, club_staff see meets their club hosts or attends
create policy "meets_select" on meets for select using (
  is_maga_admin() or
  get_user_role() = 'club_staff'
);

create policy "meets_insert" on meets for insert with check (
  is_maga_admin() or
  (get_user_role() = 'club_staff' and host_club_id = get_user_club_id())
);

-- SCORES: admins and club_staff can read all; only staff/judges can write
create policy "scores_select" on scores for select using (
  is_maga_admin() or
  get_user_role() = 'club_staff'
);

create policy "scores_insert" on scores for insert with check (
  is_maga_admin() or get_user_role() = 'club_staff'
);

create policy "scores_update" on scores for update using (
  is_maga_admin() or get_user_role() = 'club_staff'
);

-- SCORE CORRECTIONS: maga_admin only
create policy "corrections_all" on score_corrections for all using (is_maga_admin());

-- GYMNAST FOLLOWERS: users see their own links
create policy "followers_select" on gymnast_followers for select using (
  user_id = auth.uid() or is_maga_admin()
);

-- FOLLOWER ACCESS: parents see their own; clubs see their gymnasts' access
create policy "follower_access_select" on follower_access for select using (
  user_id = auth.uid() or
  is_maga_admin() or
  (get_user_role() = 'club_staff' and club_id = get_user_club_id())
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

create index idx_gymnasts_club on gymnasts(current_club_id);
create index idx_gymnasts_team on gymnasts(current_team_id);
create index idx_season_rosters_season on season_rosters(season_id);
create index idx_season_rosters_gymnast on season_rosters(gymnast_id);
create index idx_season_rosters_team on season_rosters(team_id);
create index idx_meets_season on meets(season_id);
create index idx_meets_host on meets(host_club_id);
create index idx_meets_status on meets(status);
create index idx_meet_lineups_meet on meet_lineups(meet_id);
create index idx_meet_lineups_team on meet_lineups(team_id);
create index idx_meet_lineups_gymnast on meet_lineups(gymnast_id);
create index idx_scores_meet on scores(meet_id);
create index idx_scores_gymnast on scores(gymnast_id);
create index idx_scores_team on scores(team_id);
create index idx_scores_meet_age_div on scores(meet_id, age_group, division_group);
create index idx_team_meet_scores_meet on team_meet_scores(meet_id);
create index idx_score_corrections_meet on score_corrections(meet_id);
create index idx_follower_gymnast on gymnast_followers(gymnast_id);
create index idx_follower_user on gymnast_followers(user_id);
create index idx_follower_access_user on follower_access(user_id);
create index idx_follower_access_meet on follower_access(meet_id);
