// ============================================================
// Gymnastats - TypeScript Types
// Mirrors the Supabase database schema
// ============================================================

export type UserRole = 'maga_admin' | 'club_staff' | 'parent'
export type AgeGroup = 'Novice' | 'Children' | 'Junior' | 'Senior'
export type MeetStatus = 'setup' | 'active' | 'finalized' | 'suspended'
export type ResultsVisibility = 'live' | 'after_finalized'
export type ScratchReason = 'injury' | 'illness' | 'no_show' | 'other'
export type DncReason = 'injury' | 'illness' | 'other'
export type DivisionGroup = 'Upper' | 'Lower'
export type PaymentType = 'per_meet' | 'season'
export type PaymentStatus = 'pending' | 'paid' | 'manual'
export type Event = 'vault' | 'bars' | 'beam' | 'floor'

export const AGE_GROUPS: AgeGroup[] = ['Novice', 'Children', 'Junior', 'Senior']
export const EVENTS: Event[] = ['vault', 'bars', 'beam', 'floor']
export const DIVISION_GROUPS: DivisionGroup[] = ['Upper', 'Lower']

// ============================================================
// DATABASE ENTITIES
// ============================================================

export interface Association {
  id: string
  name: string
  abbreviation: string
  is_active: boolean
  created_at: string
}

export interface Season {
  id: string
  association_id: string
  name: string
  start_date: string
  end_date: string
  state_meet_min_qualifiers: number
  registration_deadline: string | null
  fee_deadline: string | null
  is_active: boolean
  created_at: string
}

export interface Club {
  id: string
  association_id: string
  name: string
  city: string | null
  state: string
  contact_email: string | null
  contact_phone: string | null
  is_active: boolean
  stripe_account_id: string | null
  stripe_onboarded: boolean
  parent_meet_price_cents: number | null
  parent_season_price_cents: number | null
  created_at: string
}

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  club_id: string | null
  is_active: boolean
  created_at: string
}

export interface Team {
  id: string
  club_id: string
  name: string
  division_group: DivisionGroup | null
  is_active: boolean
  created_at: string
}

export interface Gymnast {
  id: string
  first_name: string
  last_name: string
  birth_date: string | null
  current_club_id: string | null
  current_team_id: string | null
  age_group: AgeGroup | null
  is_active: boolean
  created_at: string
  // computed
  full_name?: string
}

export interface SeasonRoster {
  id: string
  season_id: string
  gymnast_id: string
  team_id: string
  age_group: AgeGroup
  is_active: boolean
  created_at: string
}

export interface Meet {
  id: string
  season_id: string
  host_club_id: string
  name: string
  meet_date: string
  location: string | null
  status: MeetStatus
  results_visibility: ResultsVisibility
  num_judges: number
  counts_for_state: boolean
  suspended_at: string | null
  suspended_reason: string | null
  created_by: string | null
  created_at: string
}

export interface MeetLineup {
  id: string
  meet_id: string
  team_id: string
  gymnast_id: string
  age_group: AgeGroup
  running_order: number
  status: 'active' | 'scratched'
  scratch_reason: ScratchReason | null
  scratched_at: string | null
  scratched_by: string | null
  created_at: string
}

export interface Score {
  id: string
  meet_id: string
  gymnast_id: string
  team_id: string
  age_group: AgeGroup
  division_group: DivisionGroup | null
  // Vault
  vault: number | null
  vault_dnc: boolean
  vault_dnc_reason: DncReason | null
  vault_entered_by: string | null
  vault_entered_at: string | null
  // Bars
  bars: number | null
  bars_dnc: boolean
  bars_dnc_reason: DncReason | null
  bars_entered_by: string | null
  bars_entered_at: string | null
  // Beam
  beam: number | null
  beam_dnc: boolean
  beam_dnc_reason: DncReason | null
  beam_entered_by: string | null
  beam_entered_at: string | null
  // Floor
  floor: number | null
  floor_dnc: boolean
  floor_dnc_reason: DncReason | null
  floor_entered_by: string | null
  floor_entered_at: string | null
  created_at: string
  updated_at: string
}

export interface ScoreWithAA extends Score {
  events_competed: number
  all_around: number
  is_partial_aa: boolean
}

export interface TeamMeetScore {
  id: string
  meet_id: string
  team_id: string
  division_group: DivisionGroup | null
  vault_total: number | null
  bars_total: number | null
  beam_total: number | null
  floor_total: number | null
  team_aa_total: number | null
  division_place: number | null
  vault_5th: number | null
  bars_5th: number | null
  beam_5th: number | null
  floor_5th: number | null
  computed_at: string
}

export interface ScoreCorrection {
  id: string
  score_id: string
  meet_id: string
  gymnast_id: string
  corrected_by: string
  event: Event
  old_value: number | null
  new_value: number | null
  reason: string | null
  club_notified: boolean
  notified_at: string | null
  created_at: string
}

export interface GymnastFollower {
  id: string
  user_id: string
  gymnast_id: string
  relationship: string | null
  created_at: string
}

export interface FollowerAccess {
  id: string
  user_id: string
  gymnast_id: string
  club_id: string
  season_id: string | null
  meet_id: string | null
  payment_type: PaymentType
  payment_status: PaymentStatus
  amount_cents: number | null
  stripe_payment_intent_id: string | null
  paid_at: string | null
  created_at: string
}

// ============================================================
// COMPOSITE / VIEW TYPES
// ============================================================

// Lineup entry with gymnast details joined
export interface LineupEntry extends MeetLineup {
  gymnast: Pick<Gymnast, 'id' | 'first_name' | 'last_name'>
  team: Pick<Team, 'id' | 'name'>
  score?: ScoreWithAA
}

// Leaderboard row for results pages
export interface LeaderboardRow {
  rank: number
  gymnast: Pick<Gymnast, 'id' | 'first_name' | 'last_name'>
  team: Pick<Team, 'id' | 'name'>
  age_group: AgeGroup
  division_group: DivisionGroup
  vault: number | null
  vault_dnc: boolean
  bars: number | null
  bars_dnc: boolean
  beam: number | null
  beam_dnc: boolean
  floor: number | null
  floor_dnc: boolean
  all_around: number
  events_competed: number
  is_partial_aa: boolean
}

// Team leaderboard row
export interface TeamLeaderboardRow {
  rank: number
  team: Pick<Team, 'id' | 'name'>
  club: Pick<Club, 'id' | 'name'>
  division_group: DivisionGroup
  vault_total: number
  bars_total: number
  beam_total: number
  floor_total: number
  team_aa_total: number
}

// Awards ceremony row (reverse order: last to first)
export interface AwardsRow {
  place: number
  gymnast_name: string
  team_name: string
  score: number
  is_partial_aa?: boolean
}

// ============================================================
// SCORING UTILITIES
// ============================================================

/**
 * Calculate all-around from a score record.
 * Never inserts zeros — only sums competed events.
 */
export function calculateAA(score: Partial<Score>): number {
  let total = 0
  if (score.vault != null && !score.vault_dnc) total += score.vault
  if (score.bars != null && !score.bars_dnc) total += score.bars
  if (score.beam != null && !score.beam_dnc) total += score.beam
  if (score.floor != null && !score.floor_dnc) total += score.floor
  return Math.round(total * 100) / 100
}

/**
 * Count how many events a gymnast competed in.
 */
export function countEventsCompeted(score: Partial<Score>): number {
  let count = 0
  if (score.vault != null && !score.vault_dnc) count++
  if (score.bars != null && !score.bars_dnc) count++
  if (score.beam != null && !score.beam_dnc) count++
  if (score.floor != null && !score.floor_dnc) count++
  return count
}

/**
 * Check if a score is pending (event not yet entered and not DNC).
 */
export function isEventPending(score: Partial<Score>, event: Event): boolean {
  return score[event] == null && !score[`${event}_dnc` as keyof Score]
}

/**
 * Calculate team score: top 4 per event.
 * Returns null per event if fewer than 1 score available.
 */
export function calculateTeamScore(scores: ScoreWithAA[]): {
  vault: number | null
  bars: number | null
  beam: number | null
  floor: number | null
  total: number | null
  vault_5th: number | null
  bars_5th: number | null
  beam_5th: number | null
  floor_5th: number | null
} {
  const top = (vals: number[], n: number) =>
    [...vals].sort((a, b) => b - a).slice(0, n)

  const vaults = scores.filter(s => s.vault != null && !s.vault_dnc).map(s => s.vault!)
  const bars   = scores.filter(s => s.bars  != null && !s.bars_dnc).map(s => s.bars!)
  const beams  = scores.filter(s => s.beam  != null && !s.beam_dnc).map(s => s.beam!)
  const floors = scores.filter(s => s.floor != null && !s.floor_dnc).map(s => s.floor!)

  const vTop = top(vaults, 4)
  const bTop = top(bars, 4)
  const bmTop = top(beams, 4)
  const fTop = top(floors, 4)

  const sum = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) * 100) / 100 : null

  const vTotal  = sum(vTop)
  const bTotal  = sum(bTop)
  const bmTotal = sum(bmTop)
  const fTotal  = sum(fTop)

  const total = (vTotal != null && bTotal != null && bmTotal != null && fTotal != null)
    ? Math.round((vTotal + bTotal + bmTotal + fTotal) * 100) / 100
    : null

  return {
    vault: vTotal,
    bars: bTotal,
    beam: bmTotal,
    floor: fTotal,
    total,
    vault_5th:  vaults.sort((a,b) => b-a)[4] ?? null,
    bars_5th:   bars.sort((a,b) => b-a)[4] ?? null,
    beam_5th:   beams.sort((a,b) => b-a)[4] ?? null,
    floor_5th:  floors.sort((a,b) => b-a)[4] ?? null,
  }
}

/**
 * Validate a score value.
 * Must be 0.00–10.00, max 2 decimal places.
 */
export function validateScore(value: number): { valid: boolean; error?: string } {
  if (value < 0) return { valid: false, error: 'Score cannot be negative' }
  if (value > 10) return { valid: false, error: 'Score cannot exceed 10.00' }
  if (Math.round(value * 100) !== value * 100)
    return { valid: false, error: 'Score must have at most 2 decimal places' }
  return { valid: true }
}

/**
 * Format a score for display.
 */
export function formatScore(value: number | null, dnc: boolean): string {
  if (dnc) return '—'
  if (value == null) return ''
  return value.toFixed(2)
}
