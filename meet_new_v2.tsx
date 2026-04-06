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
  const [newDivName, setNewDivName] = useState('')

  const [form, setForm] = useState({
    name: '', meet_date: '', location: '',
    host_club_id: '', season_id: '',
    results_visibility: 'after_finalized', num_judges: 1,
  })

  const [selectedTeams, setSelectedTeams] = useState([])
  const [useDivisions, setUseDivisions] = useState(true)
  const [divisions, setDivisions] = useState([])

  useEffect(() => {
    async function load() {
      const { createBrowserClient } = await import('@supabase/ssr')
      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth/login'; return }
      const [{ data: c }, { data: t }, { data: s }] = await Promise.all([
        supabase.from('clubs').select('id, name').eq('is_active', true).order('name'),
        supabase.from('teams').select('id, name, club_id').eq('is_active', true).order('name'),
        supabase.from('seasons').select('id, name').order('start_date', { ascending: false }).limit(5),
      ])
      setClubs(c ?? [])
      setTeams(t ?? [])
      setSeasons(s ?? [])
      if (c?.length > 0) setForm(f => ({ ...f, host_club_id: c[0].id }))
      if (s?.length > 0) setForm(f => ({ ...f, season_id: s[0].id }))
      setLoading(false)
    }
    load()
  }, [])

  async function createMeet(e) {
    e.preventDefault(); setSaving(true)
    const { createBrowserClient } = await import('@supabase/ssr')
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { data, error } = await supabase.from('meets').insert({
      name: form.name, meet_date: form.meet_date, location: form.location,
      host_club_id: form.host_club_id, season_id: form.season_id,
      results_visibility: form.results_visibility, num_judges: form.num_judges, status: 'setup',
    }).select('id').single()
    if (!error && data) { setMeetId(data.id); setStep(2) }
    setSaving(false)
  }

  function addDivision() {
    const name = newDivName.trim()
    if (!name || divisions.find(d => d.name.toLowerCase() === name.toLowerCase())) return
    setDivisions(prev => [...prev, { name, teams: [] }])
    setNewDivName('')
  }

  function removeDivision(divName) {
    setDivisions(prev => prev.filter(d => d.name !== divName))
  }

  function assignTeamToDiv(teamId, divName) {
    setDivisions(prev => prev.map(d => ({
      ...d,
      teams: d.name === divName
        ? d.teams.includes(teamId) ? d.teams.filter(id => id !== teamId) : [...d.teams, teamId]
        : d.teams.filter(id => id !== teamId)
    })))
  }

  function getTeamDivision(teamId) {
    for (const div of divisions) {
      if (div.teams.includes(teamId)) return div.name
    }
    return null
  }

  function toggleTeam(id) {
    setSelectedTeams(p => {
      if (p.includes(id)) {
        setDivisions(prev => prev.map(d => ({ ...d, teams: d.teams.filter(t => t !== id) })))
        return p.filter(x => x !== id)
      }
      return [...p, id]
    })
  }

  async function saveTeamsAndDivisions() {
    setSaving(true)
    const { createBrowserClient } = await import('@supabase/ssr')
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    if (selectedTeams.length > 0) {
      const rows = selectedTeams.map(teamId => ({
        meet_id: meetId, team_id: teamId,
        division_group: useDivisions ? (getTeamDivision(teamId) ?? null) : null
      }))
      await supabase.from('meet_teams').insert(rows)
    }
    if (useDivisions && divisions.length > 0) {
      const divRows = divisions.filter(d => d.teams.length > 0).map(d => ({ meet_id: meetId, name: d.name }))
      if (divRows.length > 0) await supabase.from('meet_divisions').insert(divRows)
    }
    setStep(3); setSaving(false)
  }

  async function activateMeet() {
    setSaving(true)
    const { createBrowserClient } = await import('@supabase/ssr')
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    await supabase.from('meets').update({ status: 'active' }).eq('id', meetId)
    window.location.href = '/scores'
  }

  if (loading) return <div style={s.loading}>Loading...</div>

  const unassignedTeams = useDivisions ? selectedTeams.filter(id => !getTeamDivision(id)) : []
  const hostClub = clubs.find(c => c.id === form.host_club_id)
  const season = seasons.find(s => s.id === form.season_id)

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
        {/* Step indicators */}
        <div style={s.stepRow}>
          {['Meet details', 'Teams & divisions', 'Summary'].map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ ...s.stepCircle, ...(step > i + 1 ? s.stepDone : step === i + 1 ? s.stepActive : {}) }}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span style={{ ...s.stepLabel, ...(step === i + 1 ? { color: '#0a0f1e', fontWeight: 600 } : {}) }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        <div style={s.card}>

          {/* ── STEP 1: Meet Details ── */}
          {step === 1 && <>
            <h1 style={s.h1}>New meet</h1>
            <p style={s.sub}>Fill in the basic details for this meet</p>
            <form onSubmit={createMeet} style={s.form}>
              <div style={s.row2}>
                <div style={s.field}>
                  <label style={s.label}>Meet name</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Blizzard Invite 2025" style={s.input} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Date</label>
                  <input type="date" value={form.meet_date} onChange={e => setForm(f => ({ ...f, meet_date: e.target.value }))} required style={s.input} />
                </div>
              </div>
              <div style={s.row2}>
                <div style={s.field}>
                  <label style={s.label}>Host club</label>
                  <select value={form.host_club_id} onChange={e => setForm(f => ({ ...f, host_club_id: e.target.value }))} style={s.input}>
                    {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div style={s.field}>
                  <label style={s.label}>Location</label>
                  <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="City, MN" style={s.input} />
                </div>
              </div>
              <div style={s.row2}>
                <div style={s.field}>
                  <label style={s.label}>Season</label>
                  <select value={form.season_id} onChange={e => setForm(f => ({ ...f, season_id: e.target.value }))} style={s.input}>
                    {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div style={s.field}>
                  <label style={s.label}>Number of judges</label>
                  <input type="number" min="1" max="5" value={form.num_judges} onChange={e => setForm(f => ({ ...f, num_judges: parseInt(e.target.value) }))} style={s.input} />
                </div>
              </div>
              <div style={s.field}>
                <label style={s.label}>Public results</label>
                <select value={form.results_visibility} onChange={e => setForm(f => ({ ...f, results_visibility: e.target.value }))} style={s.input}>
                  <option value="after_finalized">Show after meet is finalized</option>
                  <option value="live">Show live during meet</option>
                </select>
              </div>
              <div style={s.btnRow}>
                <button type="submit" disabled={saving} style={s.primaryBtn}>{saving ? 'Creating...' : 'Continue →'}</button>
              </div>
            </form>
          </>}

          {/* ── STEP 2: Teams & Divisions ── */}
          {step === 2 && <>
            <h1 style={s.h1}>Teams & divisions</h1>
            <p style={s.sub}>Select which teams are competing, create your divisions, and assign teams to each one.</p>

            {/* Divisions toggle */}
            <div style={s.toggleRow}>
              <div>
                <div style={s.toggleLabel}>Use divisions for this meet</div>
                <div style={s.toggleSub}>Divisions group teams for awards. Turn off if all teams compete together.</div>
              </div>
              <div onClick={() => setUseDivisions(!useDivisions)} style={{ ...s.toggle, ...(useDivisions ? s.toggleOn : {}) }}>
                <div style={{ ...s.toggleThumb, ...(useDivisions ? s.toggleThumbOn : {}) }} />
              </div>
            </div>

            <div style={s.divider} />

            {/* Team selection */}
            <div style={s.sectionHeader}>
              <h2 style={s.h2}>Participating teams</h2>
              <span style={s.badge}>{selectedTeams.length} selected</span>
            </div>
            <div style={s.teamsGrid}>
              {teams.map(team => {
                const divName = getTeamDivision(team.id)
                const selected = selectedTeams.includes(team.id)
                return (
                  <div key={team.id} onClick={() => toggleTeam(team.id)}
                    style={{ ...s.teamChip, ...(selected ? s.teamChipSelected : {}) }}>
                    <div>
                      <div style={s.teamChipName}>{team.name}</div>
                      {selected && divName && useDivisions && (
                        <div style={s.teamChipDiv}>{divName}</div>
                      )}
                      {selected && !divName && useDivisions && (
                        <div style={{ ...s.teamChipDiv, color: '#f59e0b' }}>Unassigned</div>
                      )}
                    </div>
                    {selected && <span style={s.checkmark}>✓</span>}
                  </div>
                )
              })}
            </div>

            {/* Division builder */}
            {useDivisions && <>
              <div style={s.divider} />
              <div style={s.sectionHeader}>
                <h2 style={s.h2}>Divisions</h2>
                <span style={s.badge}>{divisions.length} created</span>
              </div>

              {/* Add division input */}
              <div style={s.addDivRow}>
                <input
                  value={newDivName}
                  onChange={e => setNewDivName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDivision() } }}
                  placeholder="Division name (e.g. Gold, Silver, Beginner...)"
                  style={{ ...s.input, flex: 1 }}
                />
                <button onClick={addDivision} disabled={!newDivName.trim()} style={s.addDivBtn}>+ Add</button>
              </div>

              {divisions.length === 0 && (
                <div style={s.emptyDivs}>No divisions created yet. Type a name above and click Add.</div>
              )}

              {/* Division cards */}
              {divisions.length > 0 && (
                <div style={s.divGrid}>
                  {divisions.map(div => (
                    <div key={div.name} style={s.divCard}>
                      <div style={s.divCardHead}>
                        <div style={s.divCardTitle}>{div.name}</div>
                        <div style={s.divCardMeta}>
                          <span style={s.divTeamCount}>{div.teams.length} teams</span>
                          <button onClick={() => removeDivision(div.name)} style={s.removeBtn} title="Remove division">×</button>
                        </div>
                      </div>
                      <div style={s.divTeamList}>
                        {selectedTeams.length === 0 && (
                          <div style={s.divEmpty}>Select teams above first</div>
                        )}
                        {selectedTeams.map(teamId => {
                          const team = teams.find(t => t.id === teamId)
                          const assigned = div.teams.includes(teamId)
                          return (
                            <div key={teamId} onClick={() => assignTeamToDiv(teamId, div.name)}
                              style={{ ...s.divTeamRow, ...(assigned ? s.divTeamAssigned : {}) }}>
                              <span>{team?.name}</span>
                              <span style={{ color: assigned ? '#10b981' : '#d1d5db', fontSize: '14px' }}>
                                {assigned ? '✓' : '+'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {unassignedTeams.length > 0 && (
                <div style={s.warnBox}>
                  ⚠ {unassignedTeams.length} team{unassignedTeams.length > 1 ? 's are' : ' is'} not assigned to a division:{' '}
                  {unassignedTeams.map(id => teams.find(t => t.id === id)?.name).join(', ')}
                </div>
              )}
            </>}

            <div style={s.btnRow}>
              <button onClick={() => setStep(1)} style={s.ghostBtn}>← Back</button>
              <button onClick={saveTeamsAndDivisions}
                disabled={saving || selectedTeams.length === 0}
                style={s.primaryBtn}>
                {saving ? 'Saving...' : 'Review summary →'}
              </button>
            </div>
          </>}

          {/* ── STEP 3: Summary ── */}
          {step === 3 && <>
            <div style={s.summaryHeader}>
              <div style={s.successIcon}>✓</div>
              <h1 style={s.h1}>Meet created!</h1>
              <p style={s.sub}>Review the details below before activating.</p>
            </div>

            {/* Meet info summary */}
            <div style={s.summarySection}>
              <div style={s.summarySectionTitle}>Meet details</div>
              <div style={s.summaryGrid}>
                <div style={s.summaryRow}><span style={s.summaryKey}>Name</span><span style={s.summaryVal}>{form.name}</span></div>
                <div style={s.summaryRow}><span style={s.summaryKey}>Date</span><span style={s.summaryVal}>{form.meet_date ? new Date(form.meet_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '—'}</span></div>
                <div style={s.summaryRow}><span style={s.summaryKey}>Host club</span><span style={s.summaryVal}>{hostClub?.name ?? '—'}</span></div>
                <div style={s.summaryRow}><span style={s.summaryKey}>Location</span><span style={s.summaryVal}>{form.location || '—'}</span></div>
                <div style={s.summaryRow}><span style={s.summaryKey}>Season</span><span style={s.summaryVal}>{season?.name ?? '—'}</span></div>
                <div style={s.summaryRow}><span style={s.summaryKey}>Judges</span><span style={s.summaryVal}>{form.num_judges}</span></div>
                <div style={s.summaryRow}><span style={s.summaryKey}>Results</span><span style={s.summaryVal}>{form.results_visibility === 'live' ? 'Live during meet' : 'After finalized'}</span></div>
              </div>
            </div>

            {/* Teams summary */}
            <div style={s.summarySection}>
              <div style={s.summarySectionTitle}>Teams ({selectedTeams.length})</div>
              {!useDivisions ? (
                <div style={s.teamPillRow}>
                  {selectedTeams.map(id => (
                    <span key={id} style={s.teamPill}>{teams.find(t => t.id === id)?.name}</span>
                  ))}
                </div>
              ) : (
                <div style={s.divSummaryGrid}>
                  {divisions.filter(d => d.teams.length > 0).map(div => (
                    <div key={div.name} style={s.divSummaryCard}>
                      <div style={s.divSummaryTitle}>{div.name}</div>
                      {div.teams.map(teamId => (
                        <div key={teamId} style={s.divSummaryTeam}>
                          {teams.find(t => t.id === teamId)?.name}
                        </div>
                      ))}
                    </div>
                  ))}
                  {selectedTeams.filter(id => !getTeamDivision(id)).length > 0 && (
                    <div style={{ ...s.divSummaryCard, borderColor: '#fde68a' }}>
                      <div style={{ ...s.divSummaryTitle, color: '#92400e' }}>No division</div>
                      {selectedTeams.filter(id => !getTeamDivision(id)).map(teamId => (
                        <div key={teamId} style={s.divSummaryTeam}>
                          {teams.find(t => t.id === teamId)?.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ ...s.btnRow, justifyContent: 'space-between', marginTop: '1.5rem' }}>
              <button onClick={() => setStep(2)} style={s.ghostBtn}>← Edit teams</button>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => window.location.href = '/lineup'} style={s.ghostBtn}>Set up lineups first</button>
                <button onClick={activateMeet} disabled={saving} style={s.primaryBtn}>
                  {saving ? 'Activating...' : 'Activate meet →'}
                </button>
              </div>
            </div>
          </>}
        </div>
      </main>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: '#f8f9fb', fontFamily: 'system-ui,sans-serif' },
  loading: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontFamily: 'system-ui' },
  nav: { background: '#0a0f1e', padding: '0 1.5rem', height: '60px', display: 'flex', alignItems: 'center', gap: '16px' },
  navLeft: { display: 'flex', alignItems: 'center', gap: '16px' },
  backBtn: { background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  navLogo: { display: 'flex', alignItems: 'center', gap: '10px' },
  logoMark: { width: '32px', height: '32px', borderRadius: '8px', background: '#fff', color: '#0a0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '700', fontFamily: 'Georgia,serif' },
  logoText: { color: '#fff', fontWeight: '600', fontSize: '16px' },
  main: { maxWidth: '720px', margin: '0 auto', padding: '2rem 1rem' },
  stepRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2rem', justifyContent: 'center' },
  stepCircle: { width: '28px', height: '28px', borderRadius: '50%', background: '#e5e7eb', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, flexShrink: 0 },
  stepActive: { background: '#0a0f1e', color: '#fff' },
  stepDone: { background: '#10b981', color: '#fff' },
  stepLabel: { fontSize: '13px', color: '#94a3b8', marginRight: '20px' },
  card: { background: '#fff', borderRadius: '16px', border: '0.5px solid #e5e7eb', padding: '2rem' },
  h1: { fontSize: '24px', fontWeight: '700', color: '#0a0f1e', margin: '0 0 4px', letterSpacing: '-0.5px' },
  h2: { fontSize: '14px', fontWeight: '600', color: '#0a0f1e', margin: 0 },
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
  sectionHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' },
  badge: { fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: '#f1f5f9', color: '#64748b' },
  toggleRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' },
  toggleLabel: { fontSize: '14px', color: '#0a0f1e', fontWeight: 600, marginBottom: '2px' },
  toggleSub: { fontSize: '12px', color: '#94a3b8' },
  toggle: { width: '40px', height: '22px', borderRadius: '11px', background: '#e5e7eb', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0, marginTop: '2px' },
  toggleOn: { background: '#0a0f1e' },
  toggleThumb: { position: 'absolute', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', top: '3px', left: '3px', transition: 'left 0.2s' },
  toggleThumbOn: { left: '21px' },
  teamsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px', marginBottom: '0.5rem' },
  teamChip: { padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: '10px', cursor: 'pointer', background: '#f8f9fb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  teamChipSelected: { border: '1.5px solid #0a0f1e', background: '#f0f4ff' },
  teamChipName: { fontSize: '13px', fontWeight: 500, color: '#0a0f1e' },
  teamChipDiv: { fontSize: '11px', color: '#64748b', marginTop: '2px' },
  checkmark: { color: '#0a0f1e', fontWeight: 700, fontSize: '14px', flexShrink: 0 },
  addDivRow: { display: 'flex', gap: '8px', marginBottom: '12px' },
  addDivBtn: { background: '#0a0f1e', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '14px', cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' },
  emptyDivs: { fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '1.5rem', background: '#f8f9fb', borderRadius: '8px', border: '1px dashed #e5e7eb', marginBottom: '1rem' },
  divGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '1rem' },
  divCard: { border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' },
  divCardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8f9fb', borderBottom: '1px solid #e5e7eb' },
  divCardTitle: { fontSize: '13px', fontWeight: 700, color: '#0a0f1e', textTransform: 'uppercase', letterSpacing: '0.05em' },
  divCardMeta: { display: 'flex', alignItems: 'center', gap: '8px' },
  divTeamCount: { fontSize: '11px', color: '#94a3b8' },
  removeBtn: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 2px' },
  divTeamList: { padding: '8px' },
  divEmpty: { fontSize: '12px', color: '#94a3b8', padding: '8px', textAlign: 'center' },
  divTeamRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#64748b', marginBottom: '4px', border: '1px solid #f1f5f9', background: '#fff' },
  divTeamAssigned: { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#0a0f1e' },
  warnBox: { background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#92400e', marginBottom: '0.5rem' },
  successIcon: { width: '56px', height: '56px', borderRadius: '50%', background: '#f0fdf4', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', margin: '0 auto 1rem', color: '#10b981' },
  summaryHeader: { textAlign: 'center', marginBottom: '1.5rem' },
  summarySection: { marginBottom: '1.5rem' },
  summarySectionTitle: { fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px', paddingBottom: '6px', borderBottom: '0.5px solid #e5e7eb' },
  summaryGrid: { display: 'flex', flexDirection: 'column', gap: '8px' },
  summaryRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '14px' },
  summaryKey: { color: '#64748b', flexShrink: 0 },
  summaryVal: { color: '#0a0f1e', fontWeight: 500, textAlign: 'right', marginLeft: '1rem' },
  teamPillRow: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  teamPill: { fontSize: '12px', padding: '4px 10px', borderRadius: '20px', background: '#f1f5f9', color: '#0a0f1e', fontWeight: 500 },
  divSummaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' },
  divSummaryCard: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 12px' },
  divSummaryTitle: { fontSize: '12px', fontWeight: 700, color: '#0a0f1e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', paddingBottom: '6px', borderBottom: '0.5px solid #e5e7eb' },
  divSummaryTeam: { fontSize: '13px', color: '#374151', padding: '3px 0' },
}
