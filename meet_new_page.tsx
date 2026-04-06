// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'

export const dynamic = 'force-dynamic'

export default function NewMeetPage() {
  const [clubs, setClubs] = useState([])
  const [teams, setTeams] = useState([])
  const [seasons, setSeasons] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(1)
  const [meetId, setMeetId] = useState(null)

  const [form, setForm] = useState({
    name: '',
    meet_date: '',
    location: '',
    host_club_id: '',
    season_id: '',
    results_visibility: 'after_finalized',
    num_judges: 1,
  })

  const [selectedTeams, setSelectedTeams] = useState([])
  const [divisions, setDivisions] = useState([
    { name: 'Upper', teams: [] },
    { name: 'Lower', teams: [] },
  ])
  const [useDivisions, setUseDivisions] = useState(true)

  useEffect(() => {
    async function load() {
      const { createBrowserClient } = await import('@supabase/ssr')
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth/login'; return }

      const [{ data: c }, { data: t }, { data: s }] = await Promise.all([
        supabase.from('clubs').select('id, name').eq('is_active', true).order('name'),
        supabase.from('teams').select('id, name, club_id, division_group').eq('is_active', true).order('name'),
        supabase.from('seasons').select('id, name').order('start_date', { ascending: false }).limit(5),
      ])
      setClubs(c ?? [])
      setTeams(t ?? [])
      setSeasons(s ?? [])
      if (c && c.length > 0) setForm(f => ({ ...f, host_club_id: c[0].id }))
      if (s && s.length > 0) setForm(f => ({ ...f, season_id: s[0].id }))
      setLoading(false)
    }
    load()
  }, [])

  async function createMeet(e) {
    e.preventDefault()
    setSaving(true)
    const { createBrowserClient } = await import('@supabase/ssr')
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    const { data, error } = await supabase
      .from('meets')
      .insert({
        name: form.name,
        meet_date: form.meet_date,
        location: form.location,
        host_club_id: form.host_club_id,
        season_id: form.season_id,
        results_visibility: form.results_visibility,
        num_judges: form.num_judges,
        status: 'setup',
      })
      .select('id')
      .single()

    if (!error && data) {
      setMeetId(data.id)
      setStep(2)
    }
    setSaving(false)
  }

  async function saveTeamsAndDivisions() {
    setSaving(true)
    const { createBrowserClient } = await import('@supabase/ssr')
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    // Add teams to meet
    if (selectedTeams.length > 0) {
      const teamRows = selectedTeams.map(teamId => {
        let divGroup = null
        if (useDivisions) {
          for (const div of divisions) {
            if (div.teams.includes(teamId)) { divGroup = div.name; break }
          }
        }
        return { meet_id: meetId, team_id: teamId, division_group: divGroup }
      })
      await supabase.from('meet_teams').insert(teamRows)
    }

    // Create division records if using divisions
    if (useDivisions) {
      const divRows = divisions
        .filter(d => d.teams.length > 0)
        .map(d => ({ meet_id: meetId, name: d.name }))
      if (divRows.length > 0) await supabase.from('meet_divisions').insert(divRows)
    }

    setStep(3)
    setSaving(false)
  }

  async function activateMeet() {
    setSaving(true)
    const { createBrowserClient } = await import('@supabase/ssr')
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    await supabase.from('meets').update({ status: 'active' }).eq('id', meetId)
    window.location.href = '/scores'
  }

  function toggleTeam(teamId) {
    setSelectedTeams(prev =>
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    )
  }

  function assignToDivision(teamId, divName) {
    setDivisions(prev => prev.map(d => ({
      ...d,
      teams: d.name === divName
        ? d.teams.includes(teamId) ? d.teams : [...d.teams, teamId]
        : d.teams.filter(id => id !== teamId)
    })))
  }

  if (loading) return <div style={s.loading}>Loading...</div>

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <div style={s.navLeft}>
          <button onClick={() => window.location.href = '/dashboard'} style={s.backBtn}>← Dashboard</button>
          <div style={s.navLogo}>
            <div style={s.logoMark}>G</div>
            <span style={s.logoText}>Gymnastats</span>
          </div>
        </div>
      </nav>

      <main style={s.main}>
        <div style={s.stepRow}>
          {['Meet details', 'Teams & divisions', 'Ready'].map((label, i) => (
            <div key={i} style={s.stepItem}>
              <div style={{...s.stepCircle, ...(step > i + 1 ? s.stepDone : step === i + 1 ? s.stepActive : {})}}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span style={{...s.stepLabel, ...(step === i + 1 ? {color:'#0a0f1e', fontWeight:600} : {})}}>{label}</span>
            </div>
          ))}
        </div>

        {step === 1 && (
          <div style={s.card}>
            <h1 style={s.h1}>New meet</h1>
            <p style={s.sub}>Fill in the basic details for this meet</p>
            <form onSubmit={createMeet} style={s.form}>
              <div style={s.row2}>
                <div style={s.field}>
                  <label style={s.label}>Meet name</label>
                  <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required placeholder="e.g. Blizzard Invite 2025" style={s.input} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Date</label>
                  <input type="date" value={form.meet_date} onChange={e => setForm(f => ({...f, meet_date: e.target.value}))} required style={s.input} />
                </div>
              </div>
              <div style={s.row2}>
                <div style={s.field}>
                  <label style={s.label}>Host club</label>
                  <select value={form.host_club_id} onChange={e => setForm(f => ({...f, host_club_id: e.target.value}))} style={s.input}>
                    {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div style={s.field}>
                  <label style={s.label}>Location</label>
                  <input value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))} placeholder="City, MN" style={s.input} />
                </div>
              </div>
              <div style={s.row2}>
                <div style={s.field}>
                  <label style={s.label}>Season</label>
                  <select value={form.season_id} onChange={e => setForm(f => ({...f, season_id: e.target.value}))} style={s.input}>
                    {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div style={s.field}>
                  <label style={s.label}>Number of judges</label>
                  <input type="number" min="1" max="5" value={form.num_judges} onChange={e => setForm(f => ({...f, num_judges: parseInt(e.target.value)}))} style={s.input} />
                </div>
              </div>
              <div style={s.field}>
                <label style={s.label}>Public results</label>
                <select value={form.results_visibility} onChange={e => setForm(f => ({...f, results_visibility: e.target.value}))} style={s.input}>
                  <option value="after_finalized">Show after meet is finalized</option>
                  <option value="live">Show live during meet</option>
                </select>
              </div>
              <div style={s.btnRow}>
                <button type="submit" disabled={saving} style={s.primaryBtn}>
                  {saving ? 'Creating...' : 'Continue →'}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 2 && (
          <div style={s.card}>
            <h1 style={s.h1}>Teams & divisions</h1>
            <p style={s.sub}>Select which teams are competing and optionally assign them to divisions</p>

            <div style={s.toggleRow}>
              <span style={s.toggleLabel}>Use divisions for this meet</span>
              <div onClick={() => setUseDivisions(!useDivisions)} style={{...s.toggle, ...(useDivisions ? s.toggleOn : {})}}>
                <div style={{...s.toggleThumb, ...(useDivisions ? s.toggleThumbOn : {})}} />
              </div>
            </div>

            <div style={s.divider} />

            <h2 style={s.h2}>Select participating teams</h2>
            <div style={s.teamsGrid}>
              {teams.map(team => (
                <div
                  key={team.id}
                  onClick={() => toggleTeam(team.id)}
                  style={{...s.teamChip, ...(selectedTeams.includes(team.id) ? s.teamChipSelected : {})}}
                >
                  <div style={s.teamChipName}>{team.name}</div>
                  {selectedTeams.includes(team.id) && <span style={s.checkmark}>✓</span>}
                </div>
              ))}
            </div>

            {useDivisions && selectedTeams.length > 0 && (
              <>
                <div style={s.divider} />
                <h2 style={s.h2}>Assign teams to divisions</h2>
                <div style={s.divisionGrid}>
                  {divisions.map(div => (
                    <div key={div.name} style={s.divCard}>
                      <div style={s.divTitle}>{div.name}</div>
                      <div style={s.divTeams}>
                        {selectedTeams.map(teamId => {
                          const team = teams.find(t => t.id === teamId)
                          const assigned = div.teams.includes(teamId)
                          return (
                            <div
                              key={teamId}
                              onClick={() => assignToDivision(teamId, div.name)}
                              style={{...s.divTeamRow, ...(assigned ? s.divTeamAssigned : {})}}
                            >
                              <span>{team?.name}</span>
                              {assigned && <span style={{color:'#10b981', fontWeight:600}}>✓</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div style={s.btnRow}>
              <button onClick={() => setStep(1)} style={s.ghostBtn}>← Back</button>
              <button
                onClick={saveTeamsAndDivisions}
                disabled={saving || selectedTeams.length === 0}
                style={s.primaryBtn}
              >
                {saving ? 'Saving...' : 'Continue →'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{...s.card, textAlign: 'center'}}>
            <div style={s.successIcon}>✓</div>
            <h1 style={s.h1}>Meet created!</h1>
            <p style={s.sub}>
              <strong>{form.name}</strong> is ready.<br />
              Activate it to start accepting lineups and scores.
            </p>
            <div style={{...s.btnRow, justifyContent: 'center', marginTop: '2rem'}}>
              <button onClick={() => window.location.href = '/lineup'} style={s.ghostBtn}>
                Set up lineups first
              </button>
              <button onClick={activateMeet} disabled={saving} style={s.primaryBtn}>
                {saving ? 'Activating...' : 'Activate & go to score entry →'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: '#f8f9fb', fontFamily: 'system-ui,sans-serif' },
  loading: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontFamily: 'system-ui' },
  nav: { background: '#0a0f1e', padding: '0 1.5rem', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  navLeft: { display: 'flex', alignItems: 'center', gap: '16px' },
  backBtn: { background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  navLogo: { display: 'flex', alignItems: 'center', gap: '10px' },
  logoMark: { width: '32px', height: '32px', borderRadius: '8px', background: '#fff', color: '#0a0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '700', fontFamily: 'Georgia,serif' },
  logoText: { color: '#fff', fontWeight: '600', fontSize: '16px' },
  main: { maxWidth: '700px', margin: '0 auto', padding: '2rem 1rem' },
  stepRow: { display: 'flex', alignItems: 'center', gap: '0', marginBottom: '2rem', justifyContent: 'center' },
  stepItem: { display: 'flex', alignItems: 'center', gap: '8px' },
  stepCircle: { width: '28px', height: '28px', borderRadius: '50%', background: '#e5e7eb', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600 },
  stepActive: { background: '#0a0f1e', color: '#fff' },
  stepDone: { background: '#10b981', color: '#fff' },
  stepLabel: { fontSize: '13px', color: '#94a3b8', marginRight: '24px' },
  card: { background: '#fff', borderRadius: '16px', border: '0.5px solid #e5e7eb', padding: '2rem' },
  h1: { fontSize: '24px', fontWeight: '700', color: '#0a0f1e', margin: '0 0 4px', letterSpacing: '-0.5px' },
  h2: { fontSize: '15px', fontWeight: '600', color: '#0a0f1e', margin: '0 0 10px' },
  sub: { fontSize: '14px', color: '#64748b', margin: '0 0 1.5rem', lineHeight: '1.5' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  field: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' },
  input: { padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', color: '#0a0f1e', background: '#fff', outline: 'none' },
  btnRow: { display: 'flex', gap: '10px', marginTop: '1.5rem', justifyContent: 'flex-end' },
  primaryBtn: { background: '#0a0f1e', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer', fontWeight: 500 },
  ghostBtn: { background: 'none', border: '1px solid #e5e7eb', color: '#64748b', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer' },
  divider: { height: '0.5px', background: '#e5e7eb', margin: '1.5rem 0' },
  toggleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' },
  toggleLabel: { fontSize: '14px', color: '#0a0f1e', fontWeight: 500 },
  toggle: { width: '40px', height: '22px', borderRadius: '11px', background: '#e5e7eb', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' },
  toggleOn: { background: '#0a0f1e' },
  toggleThumb: { position: 'absolute', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', top: '3px', left: '3px', transition: 'transform 0.2s' },
  toggleThumbOn: { transform: 'translateX(18px)' },
  teamsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', marginBottom: '0.5rem' },
  teamChip: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: '10px', cursor: 'pointer', background: '#f8f9fb' },
  teamChipSelected: { border: '1.5px solid #0a0f1e', background: '#f0f4ff' },
  teamChipName: { fontSize: '13px', fontWeight: 500, color: '#0a0f1e' },
  checkmark: { color: '#0a0f1e', fontWeight: 700, fontSize: '14px' },
  divisionGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  divCard: { border: '1px solid #e5e7eb', borderRadius: '10px', padding: '12px', background: '#f8f9fb' },
  divTitle: { fontSize: '13px', fontWeight: 700, color: '#0a0f1e', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  divTeams: { display: 'flex', flexDirection: 'column', gap: '4px' },
  divTeamRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#64748b', background: '#fff', border: '1px solid #e5e7eb' },
  divTeamAssigned: { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#0a0f1e' },
  successIcon: { width: '60px', height: '60px', borderRadius: '50%', background: '#f0fdf4', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', margin: '0 auto 1.5rem', color: '#10b981' },
}
