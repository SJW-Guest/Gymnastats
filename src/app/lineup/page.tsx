// @ts-nocheck
'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'

export const dynamic = 'force-dynamic'

type AgeGroup = 'Novice' | 'Children' | 'Junior' | 'Senior'

interface Meet { id: string; name: string; meet_date: string; status: string }
interface Team { id: string; name: string; division_group: string | null }
interface Gymnast { id: string; first_name: string; last_name: string; age_group: AgeGroup; current_team_id: string }
interface LineupEntry {
  gymnast_id: string; first_name: string; last_name: string
  age_group: AgeGroup; team_name: string; running_order: number
  status: 'active' | 'scratched'; scratch_reason?: string; is_in_lineup: boolean
}

const SCRATCH_REASONS = ['injury', 'illness', 'no_show', 'other']

export default function LineupPage() {
  const searchParams = useSearchParams()
  const [meets, setMeets] = useState<Meet[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedMeet, setSelectedMeet] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [lineup, setLineup] = useState<LineupEntry[]>([])
  const [roster, setRoster] = useState<Gymnast[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [lineupAlreadySubmitted, setLineupAlreadySubmitted] = useState(false)
  const [userName, setUserName] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userClubId, setUserClubId] = useState<string | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  useEffect(() => {
    async function init() {
      const { createBrowserClient } = await import('@supabase/ssr')
      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth/login'; return }

      const { data: userData } = await supabase.from('users').select('full_name, role, club_id').eq('id', user.id).single()
      setUserName(userData?.full_name ?? null)
      setUserRole(userData?.role ?? null)
      setUserClubId(userData?.club_id ?? null)

      const [{ data: m }, { data: t }] = await Promise.all([
        supabase.from('meets').select('id, name, meet_date, status').order('meet_date', { ascending: false }).limit(10),
        userData?.club_id
          ? supabase.from('teams').select('id, name, division_group').eq('club_id', userData.club_id).eq('is_active', true).order('name')
          : supabase.from('teams').select('id, name, division_group').eq('is_active', true).order('name'),
      ])

      setMeets(m ?? [])
      setTeams(t ?? [])

      // honour deep-link params from dashboard
      const paramMeetId = searchParams.get('meetId')
      const paramTeamId = searchParams.get('teamId')
      const firstMeet = paramMeetId ?? (m && m.length > 0 ? m[0].id : '')
      const firstTeam = paramTeamId ?? (t && t.length > 0 ? t[0].id : '')
      setSelectedMeet(firstMeet)
      setSelectedTeam(firstTeam)
      setLoading(false)
    }
    init()
  }, [])

  const loadLineup = useCallback(async (meetId: string, teamId: string) => {
    if (!meetId || !teamId) return
    const { createBrowserClient } = await import('@supabase/ssr')
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

    const [{ data: gymnasts }, { data: lineupData }, { data: meetTeamData }] = await Promise.all([
      supabase.from('gymnasts').select('id, first_name, last_name, age_group, current_team_id').eq('current_team_id', teamId).eq('is_active', true).order('last_name'),
      supabase.from('meet_lineups').select('gymnast_id, running_order, status, scratch_reason').eq('meet_id', meetId).eq('team_id', teamId),
      supabase.from('meet_teams').select('lineup_submitted_at').eq('meet_id', meetId).eq('team_id', teamId).single(),
    ])

    setLineupAlreadySubmitted(!!meetTeamData?.lineup_submitted_at)

    const team = teams.find(t => t.id === teamId)
    const lineupMap: Record<string, any> = {}
    for (const l of (lineupData ?? [])) lineupMap[l.gymnast_id] = l

    const entries: LineupEntry[] = (gymnasts ?? []).map(g => ({
      gymnast_id: g.id, first_name: g.first_name, last_name: g.last_name,
      age_group: g.age_group, team_name: team?.name ?? '',
      running_order: lineupMap[g.id]?.running_order ?? 99,
      status: lineupMap[g.id]?.status ?? 'active',
      scratch_reason: lineupMap[g.id]?.scratch_reason,
      is_in_lineup: !!lineupMap[g.id],
    })).sort((a, b) => a.running_order - b.running_order)

    setRoster(gymnasts ?? [])
    setLineup(entries)
  }, [teams])

  useEffect(() => {
    if (selectedMeet && selectedTeam && teams.length > 0) loadLineup(selectedMeet, selectedTeam)
  }, [selectedMeet, selectedTeam, teams, loadLineup])

  function moveUp(idx: number) {
    if (idx === 0) return
    const n = [...lineup]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]]
    setLineup(n.map((e, i) => ({ ...e, running_order: i+1 })))
  }
  function moveDown(idx: number) {
    if (idx === lineup.length-1) return
    const n = [...lineup]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]
    setLineup(n.map((e, i) => ({ ...e, running_order: i+1 })))
  }
  function toggleScratch(gymnast_id: string, reason?: string) {
    setLineup(prev => prev.map(e => e.gymnast_id === gymnast_id
      ? { ...e, status: e.status === 'scratched' ? 'active' : 'scratched', scratch_reason: reason }
      : e))
  }
  function toggleInLineup(gymnast_id: string) {
    setLineup(prev => {
      const exists = prev.find(e => e.gymnast_id === gymnast_id)
      if (exists) return prev.filter(e => e.gymnast_id !== gymnast_id).map((e,i) => ({ ...e, running_order: i+1 }))
      const g = roster.find(g => g.id === gymnast_id)!
      const team = teams.find(t => t.id === selectedTeam)
      return [...prev, { gymnast_id, first_name: g.first_name, last_name: g.last_name, age_group: g.age_group, team_name: team?.name ?? '', running_order: prev.length+1, status: 'active', is_in_lineup: true }]
    })
  }

  async function saveLineup() {
    setSaving(true)
    const { createBrowserClient } = await import('@supabase/ssr')
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    await supabase.from('meet_lineups').delete().eq('meet_id', selectedMeet).eq('team_id', selectedTeam)
    const rows = lineup.map(e => ({
      meet_id: selectedMeet, team_id: selectedTeam, gymnast_id: e.gymnast_id,
      age_group: e.age_group, running_order: e.running_order,
      status: e.status, scratch_reason: e.scratch_reason ?? null,
    }))
    if (rows.length > 0) await supabase.from('meet_lineups').insert(rows)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function submitLineup() {
    setSubmitting(true)
    const { createBrowserClient } = await import('@supabase/ssr')
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data: { user } } = await supabase.auth.getUser()

    // save lineup first
    await supabase.from('meet_lineups').delete().eq('meet_id', selectedMeet).eq('team_id', selectedTeam)
    const rows = lineup.map(e => ({
      meet_id: selectedMeet, team_id: selectedTeam, gymnast_id: e.gymnast_id,
      age_group: e.age_group, running_order: e.running_order,
      status: e.status, scratch_reason: e.scratch_reason ?? null,
    }))
    if (rows.length > 0) await supabase.from('meet_lineups').insert(rows)

    // mark as submitted on meet_teams
    await supabase.from('meet_teams')
      .update({ lineup_submitted_at: new Date().toISOString(), lineup_submitted_by: user?.id ?? null })
      .eq('meet_id', selectedMeet).eq('team_id', selectedTeam)

    setLineupAlreadySubmitted(true)
    setSubmitting(false)
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 3000)
  }

  const dashboardPath = userRole === 'maga_admin' ? '/maga/dashboard' : '/club/dashboard'
  const meet = meets.find(m => m.id === selectedMeet)
  const isLocked = meet?.status === 'finalized'
  const activeCount = lineup.filter(e => e.status === 'active').length
  const scratchedCount = lineup.filter(e => e.status === 'scratched').length

  if (loading) return <div style={s.loading}>Loading...</div>

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <div style={s.navLeft}>
          <button onClick={() => window.location.href = dashboardPath} style={s.backBtn}>← Dashboard</button>
          <div style={s.navLogo}>
            <div style={s.logoMark}>G</div>
            <span style={s.logoText}>Gymnastats</span>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {userName && <span style={{ color:'#94a3b8', fontSize:13 }}>{userName}</span>}
          <button onClick={async () => {
            const { createBrowserClient } = await import('@supabase/ssr')
            const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
            await sb.auth.signOut(); window.location.href = '/auth/login'
          }} style={s.signOutBtn}>Sign out</button>
        </div>
      </nav>

      <main style={s.main}>
        <div style={s.header}>
          <div>
            <h1 style={s.h1}>Lineup manager</h1>
            <p style={s.sub}>{activeCount} competing · {scratchedCount} scratched · {10 - lineup.length} slots open</p>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {lineupAlreadySubmitted && !submitted && (
              <span style={s.submittedTag}>✓ Lineup submitted</span>
            )}
            {submitted && (
              <span style={s.submittedTag}>✓ Submitted!</span>
            )}
            <button onClick={saveLineup} disabled={saving || isLocked} style={{ ...s.ghostBtn, ...(saved ? s.savedBtn : {}) }}>
              {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save draft'}
            </button>
            {!isLocked && (
              <button onClick={submitLineup} disabled={submitting || lineup.length === 0} style={s.submitBtn}>
                {submitting ? 'Submitting...' : lineupAlreadySubmitted ? 'Resubmit lineup' : 'Submit lineup →'}
              </button>
            )}
          </div>
        </div>

        {lineupAlreadySubmitted && !submitted && (
          <div style={s.submittedBanner}>
            ✓ Lineup has been submitted for this meet. You can still make changes and resubmit if needed.
          </div>
        )}

        <div style={s.controls}>
          <div style={s.field}>
            <label style={s.label}>Meet</label>
            <select value={selectedMeet} onChange={e => setSelectedMeet(e.target.value)} style={s.select}>
              {meets.map(m => <option key={m.id} value={m.id}>{m.name} — {new Date(m.meet_date).toLocaleDateString()}</option>)}
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Team</label>
            <select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)} style={s.select}>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>

        {isLocked && <div style={s.alert}>This meet is finalized. Lineup is read-only.</div>}

        <div style={s.card}>
          <div style={s.cardHead}>
            <span style={s.colNum}>#</span>
            <span style={s.colName}>Gymnast</span>
            <span style={s.colAge}>Age group</span>
            <span style={s.colStatus}>Status</span>
            {!isLocked && <span style={s.colActions}>Order</span>}
          </div>
          {lineup.length === 0 ? (
            <div style={s.empty}>No gymnasts in lineup yet. Add from the roster below.</div>
          ) : lineup.map((entry, idx) => (
            <div key={entry.gymnast_id} style={{ ...s.row, ...(entry.status === 'scratched' ? s.scratchedRow : {}) }}>
              <span style={s.colNum}>{entry.running_order}</span>
              <div style={s.colName}>
                <span style={{ ...s.gymnName, ...(entry.status === 'scratched' ? { textDecoration:'line-through', opacity:0.5 } : {}) }}>
                  {entry.last_name}, {entry.first_name}
                </span>
              </div>
              <span style={{ ...s.colAge, ...(entry.status === 'scratched' ? { opacity:0.5 } : {}) }}>{entry.age_group}</span>
              <div style={s.colStatus}>
                {entry.status === 'scratched' ? (
                  <div style={s.scratchBadge}>
                    {entry.scratch_reason ?? 'scratched'}
                    {!isLocked && <button onClick={() => toggleScratch(entry.gymnast_id)} style={s.undoBtn}>restore</button>}
                  </div>
                ) : !isLocked ? (
                  <select onChange={e => { if (e.target.value) toggleScratch(entry.gymnast_id, e.target.value) }} defaultValue="" style={s.scratchSelect}>
                    <option value="">Competing</option>
                    {SCRATCH_REASONS.map(r => <option key={r} value={r}>Scratch — {r}</option>)}
                  </select>
                ) : (
                  <span style={{ fontSize:'12px', color:'#10b981' }}>Competing</span>
                )}
              </div>
              {!isLocked && (
                <div style={s.colActions}>
                  <button onClick={() => moveUp(idx)} disabled={idx === 0 || entry.status === 'scratched'} style={s.moveBtn}>↑</button>
                  <button onClick={() => moveDown(idx)} disabled={idx === lineup.length-1 || entry.status === 'scratched'} style={s.moveBtn}>↓</button>
                  <button onClick={() => toggleInLineup(entry.gymnast_id)} style={s.removeBtn} title="Remove">×</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {!isLocked && roster.filter(g => !lineup.find(l => l.gymnast_id === g.id)).length > 0 && (
          <div style={s.rosterCard}>
            <h2 style={s.h2}>Add from roster</h2>
            <div style={s.rosterGrid}>
              {roster.filter(g => !lineup.find(l => l.gymnast_id === g.id)).map(g => (
                <button key={g.id} onClick={() => toggleInLineup(g.id)} style={s.rosterBtn} disabled={lineup.length >= 10}>
                  <span style={s.rosterName}>{g.last_name}, {g.first_name}</span>
                  <span style={s.rosterAge}>{g.age_group}</span>
                </button>
              ))}
            </div>
            {lineup.length >= 10 && <p style={s.maxNote}>Maximum 10 gymnasts per team per meet reached.</p>}
          </div>
        )}
      </main>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page:          { minHeight:'100vh', background:'#f8f9fb', fontFamily:'system-ui,sans-serif' },
  loading:       { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#888', fontFamily:'system-ui' },
  nav:           { background:'#0a0f1e', padding:'0 1.5rem', height:'60px', display:'flex', alignItems:'center', justifyContent:'space-between' },
  navLeft:       { display:'flex', alignItems:'center', gap:'16px' },
  backBtn:       { background:'none', border:'1px solid #334155', color:'#94a3b8', padding:'5px 12px', borderRadius:'6px', cursor:'pointer', fontSize:'13px' },
  navLogo:       { display:'flex', alignItems:'center', gap:'10px' },
  logoMark:      { width:'32px', height:'32px', borderRadius:'8px', background:'#fff', color:'#0a0f1e', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', fontWeight:'700', fontFamily:'Georgia,serif' },
  logoText:      { color:'#fff', fontWeight:'600', fontSize:'16px' },
  signOutBtn:    { background:'none', border:'1px solid #334155', color:'#94a3b8', padding:'5px 12px', borderRadius:'6px', cursor:'pointer', fontSize:'13px' },
  main:          { maxWidth:'900px', margin:'0 auto', padding:'2rem 1rem' },
  header:        { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.5rem', flexWrap:'wrap', gap:12 },
  h1:            { fontSize:'28px', fontWeight:'700', color:'#0a0f1e', margin:'0 0 4px', letterSpacing:'-0.5px' },
  h2:            { fontSize:'15px', fontWeight:'600', color:'#0a0f1e', margin:'0 0 1rem' },
  sub:           { fontSize:'13px', color:'#64748b', margin:0 },
  ghostBtn:      { background:'none', border:'1px solid #e5e7eb', color:'#374151', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', cursor:'pointer', fontWeight:500 },
  savedBtn:      { borderColor:'#10b981', color:'#10b981' },
  submitBtn:     { background:'#0a0f1e', color:'#fff', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', cursor:'pointer', fontWeight:600 },
  submittedTag:  { fontSize:'13px', color:'#16a34a', fontWeight:600, padding:'6px 12px', background:'#dcfce7', borderRadius:'8px' },
  submittedBanner: { background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'8px', padding:'10px 14px', fontSize:'13px', color:'#166534', marginBottom:'1rem' },
  controls:      { display:'flex', gap:'1rem', marginBottom:'1rem', flexWrap:'wrap' },
  field:         { display:'flex', flexDirection:'column', gap:'4px' },
  label:         { fontSize:'12px', fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.04em' },
  select:        { padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:'8px', fontSize:'14px', color:'#0a0f1e', background:'#fff', minWidth:'220px' },
  alert:         { background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'8px', padding:'10px 14px', fontSize:'13px', color:'#92400e', marginBottom:'1rem' },
  card:          { background:'#fff', borderRadius:'12px', border:'0.5px solid #e5e7eb', overflow:'hidden', marginBottom:'1rem' },
  cardHead:      { display:'grid', gridTemplateColumns:'40px 2fr 100px 1fr 100px', gap:'8px', padding:'10px 16px', background:'#f8f9fb', fontSize:'11px', fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'0.5px solid #e5e7eb' },
  row:           { display:'grid', gridTemplateColumns:'40px 2fr 100px 1fr 100px', gap:'8px', padding:'11px 16px', borderBottom:'0.5px solid #f1f5f9', alignItems:'center' },
  scratchedRow:  { background:'#fafafa' },
  colNum:        { fontSize:'13px', color:'#94a3b8', fontWeight:500 },
  colName:       { minWidth:0 },
  colAge:        { fontSize:'13px', color:'#64748b' },
  colStatus:     {},
  colActions:    { display:'flex', gap:'4px', alignItems:'center' },
  gymnName:      { fontSize:'14px', fontWeight:500, color:'#0a0f1e' },
  scratchBadge:  { display:'flex', alignItems:'center', gap:'6px', fontSize:'11px', color:'#92400e', background:'#fffbeb', border:'1px solid #fde68a', padding:'3px 8px', borderRadius:'6px', fontWeight:600 },
  undoBtn:       { background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'11px', textDecoration:'underline' },
  scratchSelect: { padding:'4px 8px', border:'1px solid #e5e7eb', borderRadius:'6px', fontSize:'12px', color:'#0a0f1e', background:'#fff' },
  moveBtn:       { width:'28px', height:'28px', border:'1px solid #e5e7eb', borderRadius:'6px', background:'#fff', cursor:'pointer', fontSize:'14px', display:'flex', alignItems:'center', justifyContent:'center' },
  removeBtn:     { width:'28px', height:'28px', border:'1px solid #fecaca', borderRadius:'6px', background:'#fef2f2', color:'#ef4444', cursor:'pointer', fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center' },
  rosterCard:    { background:'#fff', borderRadius:'12px', border:'0.5px solid #e5e7eb', padding:'1.25rem' },
  rosterGrid:    { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:'8px' },
  rosterBtn:     { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 12px', border:'1px solid #e5e7eb', borderRadius:'8px', background:'#f8f9fb', cursor:'pointer', textAlign:'left' },
  rosterName:    { fontSize:'13px', fontWeight:500, color:'#0a0f1e' },
  rosterAge:     { fontSize:'11px', color:'#94a3b8' },
  maxNote:       { fontSize:'12px', color:'#94a3b8', textAlign:'center', marginTop:'0.5rem' },
  empty:         { padding:'2rem', textAlign:'center', color:'#94a3b8', fontSize:'14px' },
}
