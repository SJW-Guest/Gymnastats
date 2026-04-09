// src/types/meet.types.ts
// Add these to your existing types file or create this new file

export type MeetStatus = 'setup' | 'active' | 'finalized' | 'suspended'
export type MeetTeamStatus = 'invited' | 'confirmed' | 'declined' | 'pending'
export type ResultsVisibility = 'public' | 'private' | 'members_only'

export interface Meet {
  id: string
  season_id: string
  host_club_id: string
  name: string
  meet_date: string           // date string 'YYYY-MM-DD'
  location: string | null
  status: MeetStatus
  results_visibility: ResultsVisibility
  num_judges: number | null
  counts_for_state: boolean | null
  lineup_due_date: string | null  // NEW — added by migration
  suspended_at: string | null
  suspended_reason: string | null
  created_by: string | null
  created_at: string | null
}

export interface MeetTeam {
  id: string
  meet_id: string
  team_id: string
  division_group: string | null
  division_id: string | null
  status: MeetTeamStatus
  confirmed_at: string | null
  confirmed_by: string | null
  invited_by: string | null   // NEW — added by migration
  invited_at: string | null   // NEW — added by migration
  created_at: string | null
}

export interface Team {
  id: string
  club_id: string
  name: string
  division_group: string | null
  is_active: boolean | null
  level: string | null
  age_group: string | null
  created_at: string | null
  // joined from clubs
  clubs?: {
    name: string
    city: string | null
    state: string | null
  }
}

// Form data shape for creating a meet
export interface CreateMeetFormData {
  name: string
  meet_date: string
  location: string
  lineup_due_date: string
  num_judges: number | null
  counts_for_state: boolean
  results_visibility: ResultsVisibility
  invited_team_ids: string[]
}
