'use client'

// src/app/meet/new/CreateMeetForm.tsx
// Full create-meet form with team invite selector
// Usage: drop into src/app/meet/new/page.tsx as the main component

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import type { Team, CreateMeetFormData } from '@/types/meet.types'

interface TeamWithClub {
  id: string
  name: string
  club_id: string
  division_group: string | null
  level: string | null
  age_group: string | null
  is_active: boolean | null
  created_at: string | null
  clubs: { name: string; city: string | null; state: string | null } |
         { name: string; city: string | null; state: string | null }[] |
         null
}

export default function CreateMeetForm() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [teams, setTeams] = useState<TeamWithClub[]>([])
  const [loadingTeams, setLoadingTeams] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState<CreateMeetFormData>({
    name: '',
    meet_date: '',
    location: '',
    lineup_due_date: '',
    num_judges: null,
    counts_for_state: false,
    results_visibility: 'members_only',
    invited_team_ids: [],
  })

  // Load all active teams (excluding host club's own teams)
  useEffect(() => {
    async function loadTeams() {
      setLoadingTeams(true)

      // Get current user's club to exclude their own teams from selector
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('users')
        .select('club_id')
        .eq('id', user.id)
        .single()

      const query = supabase
        .from('teams')
        .select(`
          id,
          name,
          club_id,
          division_group,
          level,
          age_group,
          is_active,
          created_at,
          clubs (
            name,
            city,
            state
          )
        `)
        .eq('is_active', true)
        .order('name')

      // Exclude host club's own teams if we have their club_id
      if (profile?.club_id) {
        query.neq('club_id', profile.club_id)
      }

      const { data, error } = await query

      if (!error && data) {
        setTeams(data as unknown as TeamWithClub[])
      }
      setLoadingTeams(false)
    }

    loadTeams()
  }, [supabase])

  function handleField<K extends keyof CreateMeetFormData>(
    key: K,
    value: CreateMeetFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError(null)
  }

  function toggleTeam(teamId: string) {
    setForm((prev) => {
      const already = prev.invited_team_ids.includes(teamId)
      return {
        ...prev,
        invited_team_ids: already
          ? prev.invited_team_ids.filter((id) => id !== teamId)
          : [...prev.invited_team_ids, teamId],
      }
    })
  }

  function selectAllTeams() {
    setForm((prev) => ({
      ...prev,
      invited_team_ids: teams.map((t) => t.id),
    }))
  }

  function clearAllTeams() {
    setForm((prev) => ({ ...prev, invited_team_ids: [] }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.name.trim()) {
      setError('Meet name is required.')
      return
    }
    if (!form.meet_date) {
      setError('Meet date is required.')
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/meets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok && res.status !== 207) {
        setError(data.error || 'Failed to create meet.')
        setSubmitting(false)
        return
      }

      if (data.warning) {
        // Meet created but invites partially failed — still navigate
        console.warn(data.warning)
      }

      setSuccess(true)
      // Navigate to the new meet's detail page
      router.push(`/meet/${data.meet.id}`)
      router.refresh()
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  // Group teams by club for the selector
  const teamsByClub = teams.reduce<Record<string, TeamWithClub[]>>((acc, team) => {
    const clubName = (Array.isArray(team.clubs) ? team.clubs[0]?.name : team.clubs?.name) || 'Unknown Club'
    if (!acc[clubName]) acc[clubName] = []
    acc[clubName].push(team)
    return acc
  }, {})

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Create New Meet</h1>
        <p className="text-sm text-gray-500 mt-1">
          Fill in meet details and invite teams. Invited clubs will see a task on their dashboard to accept.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Meet Details ── */}
        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Meet Details
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meet Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleField('name', e.target.value)}
              placeholder="e.g. Spring Invitational 2026"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meet Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.meet_date}
                onChange={(e) => handleField('meet_date', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lineup Due Date
              </label>
              <input
                type="date"
                value={form.lineup_due_date}
                onChange={(e) => handleField('lineup_due_date', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => handleField('location', e.target.value)}
              placeholder="e.g. Minneapolis, MN"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Judges
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.num_judges ?? ''}
                onChange={(e) =>
                  handleField('num_judges', e.target.value ? Number(e.target.value) : null)
                }
                placeholder="e.g. 3"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Results Visibility
              </label>
              <select
                value={form.results_visibility}
                onChange={(e) =>
                  handleField('results_visibility', e.target.value as CreateMeetFormData['results_visibility'])
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              >
                <option value="members_only">Members Only</option>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="counts_for_state"
              checked={form.counts_for_state}
              onChange={(e) => handleField('counts_for_state', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <label htmlFor="counts_for_state" className="text-sm text-gray-700">
              Counts toward state qualifications
            </label>
          </div>
        </section>

        {/* ── Invite Teams ── */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Invite Teams
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {form.invited_team_ids.length} team{form.invited_team_ids.length !== 1 ? 's' : ''} selected
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllTeams}
                className="text-xs text-gray-500 hover:text-gray-800 underline"
              >
                Select all
              </button>
              <span className="text-gray-300">·</span>
              <button
                type="button"
                onClick={clearAllTeams}
                className="text-xs text-gray-500 hover:text-gray-800 underline"
              >
                Clear
              </button>
            </div>
          </div>

          {loadingTeams ? (
            <div className="text-sm text-gray-400 py-4 text-center">Loading teams...</div>
          ) : teams.length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center">
              No active teams found in other clubs.
            </div>
          ) : (
            <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
              {Object.entries(teamsByClub).sort().map(([clubName, clubTeams]) => (
                <div key={clubName}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {clubName}
                  </p>
                  <div className="space-y-1">
                    {clubTeams.map((team) => {
                      const selected = form.invited_team_ids.includes(team.id)
                      return (
                        <label
                          key={team.id}
                          className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                            selected
                              ? 'bg-gray-900 text-white'
                              : 'bg-gray-50 hover:bg-gray-100 text-gray-800'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleTeam(team.id)}
                            className="w-4 h-4 rounded border-gray-300 accent-white"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium truncate block">
                              {team.name}
                            </span>
                            {(team.age_group || team.level) && (
                              <span className={`text-xs ${selected ? 'text-gray-300' : 'text-gray-400'}`}>
                                {[team.age_group, team.level].filter(Boolean).join(' · ')}
                              </span>
                            )}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Submit ── */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || success}
            className="bg-gray-900 text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting
              ? 'Creating...'
              : form.invited_team_ids.length > 0
              ? `Create Meet & Invite ${form.invited_team_ids.length} Team${form.invited_team_ids.length !== 1 ? 's' : ''}`
              : 'Create Meet'}
          </button>
        </div>
      </form>
    </div>
  )
}
