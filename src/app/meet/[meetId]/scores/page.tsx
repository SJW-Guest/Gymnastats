'use client'

// src/app/meet/[meetId]/scores/page.tsx

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

interface Meet {
  id: string; name: string; meet_date: string; location: string | null
  status: string; host_club_id: string; num_judges: number | null
}

interface ScoreRow {
  gymnast_id: string
  team_id: string
  age_group: string
  running_order: number
  lineup_status: string
  gymnast_first_name: string
  gymnast_last_name: string
  team_name: string
  score_id: string | null
  vault: number | null;      vault_dnc: boolean
  bars: number | null;       bars_dnc: boolean
  beam: number | null;       beam_dnc: boolean
  floor: number | null;      floor_dnc: boolean
}

type Event = 'vault' | 'bars' | 'beam' | 'floor'
const EVENTS: Event[] = ['vault', 'bars', 'beam', 'floor']
const EVENT_LABELS: Record<Event, string> = { vault: 'Vault', bars: 'Bars', beam: 'Beam', floor: 'Floor' }

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  setup:     { bg: '#fef3c7', color: '#d97706' },
  active:    { bg: '#dbeafe', color: '#1d4ed8' },
  finalized: { bg: '#dcfce7', color: '#16a34a' },
  suspended: { bg: '#fee2e2', color: '#dc2626' },
}

const NAV_ITEMS = [
  { key: 'overview',  label: 'Meet Overview',  suffix: '' },
  { key: 'lineup',    label: 'Lineup Manager', suffix: '/lineup' },
  { key: 'scores',    label: 'Score Entry',    suffix: '/scores' },
  { key: 'standings', label: 'Meet Standings', suffix: '/standings' },
]

// ─── Judge mobile numpad ───────────────────────────────────────────────────
function NumPad({ value, onChange, onConfirm, onDnc, isDnc, disabled }:
  { value: string; onChange: (v: string) => void; onConfirm: () => void; onDnc: (v: boolean) => void; isDnc: boolean; disabled: boolean }) {
  function tap(key: string) {
    if (disabled) return
    if (key === 'DEL') { onChange(value.slice(0, -1)); return }
    if (key === '.') {
      if (value.includes('.')) return
      onChange(value + '.')
      return
    }
    const next = value + key
    const num = parseFloat(next)
    if (!isNaN(num) && num <= 20) onChange(next)
  }

  return (
    <div style={np.wrap}>
      <div style={np.display}>
        {isDnc ? <span style={{color:'#dc2626',fontWeight:700}}>DNC</span> : (
          <span style={{fontSize:36,fontWeight:700,color:'#111827'}}>{value || '—'}</span>
        )}
      </div>
      <div style={np.grid}>
        {['7','8','9','4','5','6','1','2','3','.','0','DEL'].map(k => (
          <button key={k} onClick={() => tap(k)} disabled={isDnc}
            style={{...np.key, ...(k==='DEL'?np.delKey:{}), ...(isDnc?np.disKey:{})}}>
            {k}
          </button>
        ))}
      </div>
      <div style={{display:'flex',gap:8,marginTop:8}}>
        <button onClick={() => onDnc(!isDnc)} style={{...np.dncBtn, ...(isDnc?np.dncActive:{})}}>
          DNC
        </button>
        <button onClick={onConfirm} disabled={!value && !isDnc} style={np.confirmBtn}>
          Confirm ✓
        </button>
      </div>
    </div>
  )
}

const np: Record<string, React.CSSProperties> = {
  wrap:       {display:'flex',flexDirection:'column',alignItems:'center',gap:8,padding:'16px'},
  display:    {height:64,display:'flex',alignItems:'center',justifyContent:'center',width:'100%',background:'#f8f9fa',borderRadius:12,border:'1px solid #e5e7eb',marginBottom:8},
  grid:       {display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:8,width:'100%',maxWidth:280},
  key:        {height:56,borderRadius:10,border:'1px solid #e5e7eb',background:'#fff',fontSize:20,fontWeight:500,color:'#111827',cursor:'pointer'},
  delKey:     {background:'#f3f4f6',color:'#374151'},
  disKey:     {opacity:0.3,cursor:'default'},
  dncBtn:     {flex:1,height:48,borderRadius:10,border:'1px solid #e5e7eb',background:'#fff',fontSize:14,fontWeight:600,color:'#dc2626',cursor:'pointer'},
  dncActive:  {background:'#fee2e2',borderColor:'#fca5a5'},
  confirmBtn: {flex:2,height:48,borderRadius:10,border:'none',background:'#111827',color:'#fff',fontSize:15,fontWeight:600,cursor:'pointer'},
}

// ─── Main page ─────────────────────────────────────────────────────────────
export default function ScoreEntryPage() {
  const { meetId } = useParams<{ meetId: string }>()
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [meet, setMeet] = useState<Meet | null>(null)
  const [rows, setRows] = useState<ScoreRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userClubId, setUserClubId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

  // Score table view state
  const [activeEvent, setActiveEvent] = useState<Event>('vault')
  const [filterTeamId, setFilterTeamId] = useState<string>('all')
  const [edits, setEdits] = useState<Record<string, string>>({})  // gymnast_id -> string value
  const [dncEdits, setDncEdits] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState<Set<string>>(new Set())

  // Judge mobile view state
  const [judgeMode, setJudgeMode] = useState(false)
  const [judgeEvent, setJudgeEvent] = useState<Event>('vault')
  const [judgeTeamId, setJudgeTeamId] = useState<string>('all')
  const [judgeIndex, setJudgeIndex] = useState(0)
  const [judgeVal, setJudgeVal] = useState('')
  const [judgeDnc, setJudgeDnc] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: userData } = await supabase
          .from('users').select('club_id, role').eq('id', user.id).single()
        setUserClubId(userData?.club_id ?? null)
        setUserRole(userData?.role ?? null)
      }

      const { data: meetData, error: meetError } = await supabase
        .from('meets').select('id, name, meet_date, location, status, host_club_id, num_judges')
        .eq('id', meetId).single()
      if (meetError || !meetData) { setError('Meet not found.'); setLoading(false); return }
      setMeet(meetData as Meet)

      const { data: scoreData } = await supabase.rpc('get_meet_score_rows', { p_meet_id: meetId })
      setRows(scoreData || [])
      setLoading(false)
    }
    if (meetId) load()
  }, [meetId])

  const isHost = meet !== null && userClubId !== null && userClubId === meet.host_club_id
  const dashboardPath = userRole === 'maga_admin' ? '/maga/dashboard' : '/club/dashboard'

  const activeRows = rows.filter(r => r.lineup_status !== 'scratched')
  const teams = Array.from(new Map(activeRows.map(r => [r.team_id, r.team_name])).entries())
    .map(([id, name]) => ({ id, name }))

  // ── Score table helpers ──────────────────────────────────────────────────
  const tableRows = activeRows.filter(r => filterTeamId === 'all' || r.team_id === filterTeamId)

  function getDisplayVal(row: ScoreRow, event: Event): string {
    if (row.gymnast_id in edits && activeEvent === event) return edits[row.gymnast_id]
    const v = row[event] as number | null
    return v !== null ? String(v) : ''
  }

  function isDnc(row: ScoreRow, event: Event): boolean {
    if (row.gymnast_id in dncEdits && activeEvent === event) return dncEdits[row.gymnast_id]
    return row[`${event}_dnc` as keyof ScoreRow] as boolean || false
  }

  async function saveScore(row: ScoreRow, event: Event) {
    const gid = row.gymnast_id
    const rawVal = edits[gid]
    const dnc = dncEdits[gid] ?? (row[`${event}_dnc` as keyof ScoreRow] as boolean || false)
    const numVal = rawVal !== undefined ? (rawVal === '' ? null : parseFloat(rawVal)) : row[event as keyof ScoreRow] as number | null

    setSaving(prev => new Set(prev).add(gid))
    const payload = {
      meet_id: meetId, gymnast_id: gid, team_id: row.team_id, age_group: row.age_group,
      [event]: numVal, [`${event}_dnc`]: dnc,
    }

    if (row.score_id) {
      await supabase.from('scores').update(payload).eq('id', row.score_id)
    } else {
      const { data: ins } = await supabase.from('scores').insert({
        meet_id: meetId, gymnast_id: gid, team_id: row.team_id, age_group: row.age_group,
        vault: null, bars: null, beam: null, floor: null,
        vault_dnc: false, bars_dnc: false, beam_dnc: false, floor_dnc: false,
        [event]: numVal, [`${event}_dnc`]: dnc,
      }).select('id').single()
      if (ins) setRows(prev => prev.map(r => r.gymnast_id === gid ? { ...r, score_id: ins.id } : r))
    }

    setRows(prev => prev.map(r => r.gymnast_id === gid ? { ...r, [event]: numVal, [`${event}_dnc`]: dnc } : r))
    setEdits(prev => { const n = {...prev}; delete n[gid]; return n })
    setDncEdits(prev => { const n = {...prev}; delete n[gid]; return n })
    setSaving(prev => { const n = new Set(prev); n.delete(gid); return n })
    setSaved(prev => new Set(prev).add(gid))
    setTimeout(() => setSaved(prev => { const n = new Set(prev); n.delete(gid); return n }), 1500)
  }

  function countEntered(event: Event) {
    return activeRows.filter(r => r[event as keyof ScoreRow] !== null || (r[`${event}_dnc` as keyof ScoreRow] as boolean)).length
  }

  // ── Judge mode helpers ───────────────────────────────────────────────────
  const judgeRows = activeRows.filter(r => judgeTeamId === 'all' || r.team_id === judgeTeamId)
  const currentJudgeRow = judgeRows[judgeIndex] ?? null

  function judgeNext() {
    setJudgeVal(''); setJudgeDnc(false)
    setJudgeIndex(i => Math.min(i + 1, judgeRows.length - 1))
  }
  function judgePrev() {
    setJudgeVal(''); setJudgeDnc(false)
    setJudgeIndex(i => Math.max(i - 1, 0))
  }

  async function judgeConfirm() {
    if (!currentJudgeRow) return
    const numVal = judgeVal === '' ? null : parseFloat(judgeVal)
    const gid = currentJudgeRow.gymnast_id
    const payload = {
      meet_id: meetId, gymnast_id: gid, team_id: currentJudgeRow.team_id,
      age_group: currentJudgeRow.age_group,
      [judgeEvent]: judgeDnc ? null : numVal,
      [`${judgeEvent}_dnc`]: judgeDnc,
    }
    setSaving(prev => new Set(prev).add(gid))
    if (currentJudgeRow.score_id) {
      await supabase.from('scores').update(payload).eq('id', currentJudgeRow.score_id)
    } else {
      const { data: ins } = await supabase.from('scores').insert({
        meet_id: meetId, gymnast_id: gid, team_id: currentJudgeRow.team_id,
        age_group: currentJudgeRow.age_group,
        vault: null, bars: null, beam: null, floor: null,
        vault_dnc: false, bars_dnc: false, beam_dnc: false, floor_dnc: false,
        [judgeEvent]: judgeDnc ? null : numVal, [`${judgeEvent}_dnc`]: judgeDnc,
      }).select('id').single()
      if (ins) setRows(prev => prev.map(r => r.gymnast_id === gid ? { ...r, score_id: ins.id } : r))
    }
    setRows(prev => prev.map(r => r.gymnast_id === gid
      ? { ...r, [judgeEvent]: judgeDnc ? null : numVal, [`${judgeEvent}_dnc`]: judgeDnc }
      : r))
    setSaving(prev => { const n = new Set(prev); n.delete(gid); return n })
    setSaved(prev => new Set(prev).add(gid))
    setTimeout(() => setSaved(prev => { const n = new Set(prev); n.delete(gid); return n }), 1000)
    judgeNext()
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) return <div style={s.page}><div style={s.center}><div style={s.spinner}/></div></div>
  if (error || !meet) return (
    <div style={s.page}><div style={s.center}>
      <p style={{color:'#dc2626'}}>{error || 'Meet not found.'}</p>
      <button onClick={()=>router.back()} style={s.linkBtn}>← Go back</button>
    </div></div>
  )

  const sc = STATUS_COLORS[meet.status] || STATUS_COLORS.setup
  const fmtDate = (d: string) => new Date(d+'T00:00:00').toLocaleDateString('en-US',{weekday:'short',month:'long',day:'numeric',year:'numeric'})

  // ── JUDGE MODE ────────────────────────────────────────────────────────────
  if (judgeMode) {
    const row = currentJudgeRow
    const progress = judgeRows.length > 0 ? ((judgeIndex) / judgeRows.length) * 100 : 0
    const existingScore = row ? (row[judgeEvent as keyof ScoreRow] as number | null) : null
    const existingDnc = row ? (row[`${judgeEvent}_dnc` as keyof ScoreRow] as boolean) : false

    return (
      <div style={jm.page}>
        {/* Judge top bar */}
        <div style={jm.topBar}>
          <button onClick={()=>setJudgeMode(false)} style={jm.backBtn}>← Score table</button>
          <span style={jm.title}>{meet.name}</span>
          <span style={{fontSize:13,color:'#9ca3af'}}>{judgeIndex + 1} / {judgeRows.length}</span>
        </div>

        {/* Progress bar */}
        <div style={{height:3,background:'#e5e7eb'}}>
          <div style={{height:3,background:'#111827',width:`${progress}%`,transition:'width 0.3s'}}/>
        </div>

        {/* Event selector */}
        <div style={jm.eventRow}>
          {EVENTS.map(ev => (
            <button key={ev}
              onClick={()=>{ setJudgeEvent(ev); setJudgeVal(''); setJudgeDnc(false) }}
              style={{...jm.eventBtn,...(judgeEvent===ev?jm.eventActive:{})}}>
              {EVENT_LABELS[ev]}
              {countEntered(ev) === activeRows.length && <span style={jm.eventDone}>✓</span>}
            </button>
          ))}
        </div>

        {/* Team filter */}
        {teams.length > 1 && (
          <div style={{padding:'0 16px 8px',overflowX:'auto',display:'flex',gap:8}}>
            <button onClick={()=>{setJudgeTeamId('all');setJudgeIndex(0)}}
              style={{...jm.teamChip,...(judgeTeamId==='all'?jm.teamChipActive:{})}}>All</button>
            {teams.map(t => (
              <button key={t.id} onClick={()=>{setJudgeTeamId(t.id);setJudgeIndex(0)}}
                style={{...jm.teamChip,...(judgeTeamId===t.id?jm.teamChipActive:{}),whiteSpace:'nowrap'}}>
                {t.name}
              </button>
            ))}
          </div>
        )}

        {/* Gymnast card */}
        {row ? (
          <div style={jm.card}>
            <div style={jm.order}>#{row.running_order}</div>
            <div style={jm.name}>{row.gymnast_first_name} {row.gymnast_last_name}</div>
            <div style={jm.sub}>{row.team_name} · {row.age_group}</div>
            {(existingScore !== null || existingDnc) && (
              <div style={jm.existing}>
                Current: <strong>{existingDnc ? 'DNC' : existingScore}</strong>
              </div>
            )}
            <NumPad
              value={judgeVal}
              onChange={setJudgeVal}
              onConfirm={judgeConfirm}
              onDnc={setJudgeDnc}
              isDnc={judgeDnc}
              disabled={false}
            />
          </div>
        ) : (
          <div style={{padding:32,textAlign:'center',color:'#9ca3af'}}>No gymnasts in this selection.</div>
        )}

        {/* Prev / Next */}
        <div style={jm.navRow}>
          <button onClick={judgePrev} disabled={judgeIndex === 0} style={jm.navBtn}>← Prev</button>
          <span style={{fontSize:13,color:'#9ca3af'}}>{row?.gymnast_first_name} {row?.gymnast_last_name}</span>
          <button onClick={judgeNext} disabled={judgeIndex >= judgeRows.length - 1} style={jm.navBtn}>Next →</button>
        </div>
      </div>
    )
  }

  // ── SCORE TABLE VIEW ──────────────────────────────────────────────────────
  // Group active rows by team in running order
  const teamGroups = teams
    .filter(t => filterTeamId === 'all' || t.id === filterTeamId)
    .map(t => ({
      ...t,
      entries: activeRows.filter(r => r.team_id === t.id).sort((a,b) => a.running_order - b.running_order)
    })).filter(g => g.entries.length > 0)

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <div style={s.topBarInner}>
          <div style={s.logo}>G</div>
          <span style={s.logoText}>Gymnastats</span>
          <div style={{flex:1}}/>
          <button onClick={()=>router.push(dashboardPath)} style={s.backBtn}>← Dashboard</button>
        </div>
      </div>

      <div style={s.body}>
        <aside style={s.sidebar}>
          <p style={s.sidebarMeetName}>{meet.name}</p>
          <span style={{...s.badge, backgroundColor:sc.bg, color:sc.color, fontSize:11}}>{meet.status}</span>
          <p style={s.sidebarDate}>{fmtDate(meet.meet_date)}</p>
          {meet.location && <p style={s.sidebarLoc}>{meet.location}</p>}
          <nav style={{marginTop:24}}>
            {NAV_ITEMS.map(item => {
              const href = `/meet/${meetId}${item.suffix}`
              const active = pathname === href
              return (
                <button key={item.key} style={{...s.navItem,...(active?s.navActive:{})}} onClick={()=>router.push(href)}>
                  {item.label}
                </button>
              )
            })}
          </nav>
          {isHost && (
            <div style={{marginTop:24,paddingTop:24,borderTop:'1px solid #e5e7eb',display:'flex',flexDirection:'column',gap:8}}>
              <button style={s.sidebarBtn} onClick={()=>router.push(`/meet/${meetId}`)}>✏️ Edit meet details</button>
              <button style={s.sidebarBtn} onClick={()=>router.push(`/meet/new?meetId=${meetId}`)}>👥 Edit teams & divisions</button>
            </div>
          )}
        </aside>

        <main style={s.main}>
          {/* Header row */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
            <div>
              <h1 style={s.pageTitle}>Score Entry</h1>
              <p style={s.pageSub}>
                {EVENTS.map(ev => `${EVENT_LABELS[ev]}: ${countEntered(ev)}/${activeRows.length}`).join(' · ')}
              </p>
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <button onClick={()=>setJudgeMode(true)} style={s.judgeBtn}>📱 Judge view</button>
            </div>
          </div>

          {/* Event tabs */}
          <div style={s.eventTabs}>
            {EVENTS.map(ev => (
              <button key={ev} onClick={()=>setActiveEvent(ev)}
                style={{...s.eventTab,...(activeEvent===ev?s.eventTabActive:{})}}>
                {EVENT_LABELS[ev]}
                <span style={{...s.eventCount,...(activeEvent===ev?{color:'#fff',opacity:0.7}:{})}}>
                  {countEntered(ev)}/{activeRows.length}
                </span>
              </button>
            ))}
          </div>

          {/* Team filter pills */}
          {teams.length > 1 && (
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              <button onClick={()=>setFilterTeamId('all')}
                style={{...s.teamPill,...(filterTeamId==='all'?s.teamPillActive:{})}}>All teams</button>
              {teams.map(t => (
                <button key={t.id} onClick={()=>setFilterTeamId(t.id)}
                  style={{...s.teamPill,...(filterTeamId===t.id?s.teamPillActive:{})}}>
                  {t.name}
                </button>
              ))}
            </div>
          )}

          {/* Score table — grouped by team */}
          {activeRows.length === 0 ? (
            <div style={s.emptyState}>
              <p style={{fontSize:15,fontWeight:600,color:'#374151',margin:'0 0 4px'}}>No lineup available</p>
              <p style={{fontSize:13,color:'#9ca3af',margin:'0 0 16px'}}>Scores can be entered once teams have submitted their lineups.</p>
              <button style={s.goBtn} onClick={()=>router.push(`/meet/${meetId}/lineup`)}>Go to Lineup Manager →</button>
            </div>
          ) : (
            teamGroups.map(group => (
              <div key={group.id} style={s.card}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <h2 style={s.cardTitle}>{group.name}</h2>
                  <span style={s.countBadge}>
                    {group.entries.filter(r => {
                      const score = r[activeEvent as keyof ScoreRow]
                      const dnc = r[`${activeEvent}_dnc` as keyof ScoreRow] as boolean
                      return score !== null || dnc
                    }).length} / {group.entries.length} entered
                  </span>
                </div>

                <div style={st.header}>
                  <span>#</span>
                  <span>Gymnast</span>
                  <span>Age group</span>
                  <span style={{textAlign:'center'}}>{EVENT_LABELS[activeEvent]}</span>
                  <span style={{textAlign:'center'}}>DNC</span>
                  <span></span>
                </div>

                {group.entries.map(row => {
                  const gid = row.gymnast_id
                  const isSaving = saving.has(gid)
                  const isSaved = saved.has(gid)
                  const hasEdit = gid in edits || gid in dncEdits
                  const dnc = isDnc(row, activeEvent)
                  const displayVal = getDisplayVal(row, activeEvent)
                  const existingScore = row[activeEvent as keyof ScoreRow] as number | null
                  const alreadyEntered = existingScore !== null || (row[`${activeEvent}_dnc` as keyof ScoreRow] as boolean)

                  return (
                    <div key={gid} style={{...st.row,...(alreadyEntered?st.enteredRow:{})}}>
                      <span style={{fontSize:13,color:'#9ca3af',fontWeight:500}}>{row.running_order}</span>
                      <span style={{fontSize:14,fontWeight:500,color:'#111827'}}>
                        {row.gymnast_first_name} {row.gymnast_last_name}
                      </span>
                      <span style={{fontSize:13,color:'#6b7280'}}>{row.age_group}</span>
                      <div style={{display:'flex',justifyContent:'center'}}>
                        <input
                          type="number"
                          step="0.025"
                          min="0"
                          max="20"
                          disabled={dnc || !isHost}
                          value={dnc ? '' : displayVal}
                          placeholder={dnc ? 'DNC' : (existingScore !== null ? String(existingScore) : '—')}
                          onChange={e => setEdits(prev => ({...prev, [gid]: e.target.value}))}
                          onKeyDown={e => { if (e.key === 'Enter') saveScore(row, activeEvent) }}
                          style={{...st.input,...(dnc?st.dncInput:{}),...(alreadyEntered&&!hasEdit?st.enteredInput:{})}}
                        />
                      </div>
                      <div style={{display:'flex',justifyContent:'center'}}>
                        <input type="checkbox" checked={dnc} disabled={!isHost}
                          onChange={e => setDncEdits(prev => ({...prev, [gid]: e.target.checked}))}
                          style={{width:16,height:16,cursor:'pointer'}}
                        />
                      </div>
                      {isHost && (
                        <button
                          onClick={() => saveScore(row, activeEvent)}
                          disabled={isSaving || (!hasEdit)}
                          style={{...st.saveBtn,
                            ...(isSaved?st.savedBtn:{}),
                            ...(!hasEdit&&!isSaved?st.idleBtn:{})
                          }}
                        >
                          {isSaving ? '…' : isSaved ? '✓' : alreadyEntered ? 'Update' : 'Save'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </main>
      </div>
    </div>
  )
}

// ── Score table sub-styles ──────────────────────────────────────────────────
const st: Record<string, React.CSSProperties> = {
  header:      {display:'grid',gridTemplateColumns:'36px 2fr 1fr 120px 60px 70px',gap:8,padding:'6px 8px',fontSize:11,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:2},
  row:         {display:'grid',gridTemplateColumns:'36px 2fr 1fr 120px 60px 70px',gap:8,padding:'10px 8px',borderRadius:8,alignItems:'center',borderBottom:'1px solid #f3f4f6'},
  enteredRow:  {backgroundColor:'#f0fdf4'},
  input:       {width:'100%',border:'1px solid #e5e7eb',borderRadius:6,padding:'7px 10px',fontSize:14,color:'#111827',textAlign:'center',outline:'none',boxSizing:'border-box' as const},
  dncInput:    {backgroundColor:'#fef2f2',color:'#dc2626',borderColor:'#fca5a5'},
  enteredInput:{borderColor:'#bbf7d0',backgroundColor:'#f0fdf4'},
  saveBtn:     {width:'100%',backgroundColor:'#111827',color:'#fff',border:'none',borderRadius:6,padding:'7px 0',fontSize:12,fontWeight:600,cursor:'pointer'},
  savedBtn:    {backgroundColor:'#16a34a'},
  idleBtn:     {backgroundColor:'#f3f4f6',color:'#9ca3af',cursor:'default'},
}

// ── Judge mode styles ───────────────────────────────────────────────────────
const jm: Record<string, React.CSSProperties> = {
  page:        {minHeight:'100vh',backgroundColor:'#f8f9fa',fontFamily:"'DM Sans', sans-serif",maxWidth:480,margin:'0 auto'},
  topBar:      {backgroundColor:'#111827',padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'},
  backBtn:     {background:'none',border:'1px solid #374151',borderRadius:6,color:'#9ca3af',padding:'5px 10px',fontSize:13,cursor:'pointer'},
  title:       {color:'#fff',fontWeight:600,fontSize:14,flex:1,textAlign:'center',margin:'0 8px'},
  eventRow:    {display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:0,borderBottom:'1px solid #e5e7eb',backgroundColor:'#fff'},
  eventBtn:    {padding:'12px 4px',border:'none',background:'none',fontSize:13,fontWeight:500,color:'#6b7280',cursor:'pointer',borderBottom:'3px solid transparent',position:'relative' as const},
  eventActive: {color:'#111827',borderBottomColor:'#111827'},
  eventDone:   {position:'absolute' as const,top:6,right:6,fontSize:9,color:'#16a34a',fontWeight:700},
  teamChip:    {padding:'6px 12px',borderRadius:99,border:'1px solid #e5e7eb',background:'#fff',fontSize:12,color:'#6b7280',cursor:'pointer',whiteSpace:'nowrap' as const},
  teamChipActive:{backgroundColor:'#111827',color:'#fff',borderColor:'#111827'},
  card:        {margin:'12px 16px',backgroundColor:'#fff',borderRadius:16,border:'1px solid #e5e7eb',overflow:'hidden'},
  order:       {textAlign:'center' as const,fontSize:13,color:'#9ca3af',paddingTop:16},
  name:        {textAlign:'center' as const,fontSize:22,fontWeight:700,color:'#111827',padding:'4px 16px 0'},
  sub:         {textAlign:'center' as const,fontSize:13,color:'#6b7280',paddingBottom:8},
  existing:    {textAlign:'center' as const,fontSize:13,color:'#374151',padding:'4px 16px',background:'#f8f9fa',margin:'0 16px',borderRadius:8},
  navRow:      {display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px'},
  navBtn:      {background:'none',border:'1px solid #e5e7eb',borderRadius:8,padding:'8px 16px',fontSize:14,color:'#374151',cursor:'pointer'},
}

// ── Main layout styles ──────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  page:         {minHeight:'100vh',backgroundColor:'#f8f9fa',fontFamily:"'DM Sans', sans-serif"},
  center:       {display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100vh',gap:12},
  spinner:      {width:28,height:28,border:'3px solid #e5e7eb',borderTopColor:'#111827',borderRadius:'50%',animation:'spin 0.8s linear infinite'},
  topBar:       {backgroundColor:'#111827',padding:'0 24px'},
  topBarInner:  {maxWidth:1200,margin:'0 auto',height:52,display:'flex',alignItems:'center',gap:10},
  logo:         {width:28,height:28,borderRadius:6,backgroundColor:'#fff',color:'#111827',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14},
  logoText:     {color:'#fff',fontWeight:600,fontSize:15},
  backBtn:      {marginLeft:12,background:'none',border:'1px solid #374151',borderRadius:6,color:'#9ca3af',padding:'5px 12px',fontSize:13,cursor:'pointer'},
  body:         {maxWidth:1200,margin:'0 auto',display:'flex',minHeight:'calc(100vh - 52px)'},
  sidebar:      {width:220,flexShrink:0,padding:'28px 20px',borderRight:'1px solid #e5e7eb',backgroundColor:'#fff'},
  sidebarMeetName:{fontSize:15,fontWeight:600,color:'#111827',margin:'0 0 6px',lineHeight:1.3},
  sidebarDate:  {fontSize:12,color:'#6b7280',margin:'6px 0 2px'},
  sidebarLoc:   {fontSize:12,color:'#9ca3af',margin:0},
  navItem:      {display:'block',width:'100%',textAlign:'left',background:'none',border:'none',borderRadius:8,padding:'9px 12px',fontSize:14,color:'#374151',cursor:'pointer',marginBottom:2},
  navActive:    {backgroundColor:'#111827',color:'#fff',fontWeight:500},
  sidebarBtn:   {display:'block',width:'100%',textAlign:'left',background:'none',border:'1px solid #e5e7eb',borderRadius:8,padding:'8px 12px',fontSize:13,color:'#374151',cursor:'pointer'},
  main:         {flex:1,padding:'28px',display:'flex',flexDirection:'column',gap:16},
  badge:        {display:'inline-block',borderRadius:99,padding:'3px 10px',fontSize:12,fontWeight:600},
  linkBtn:      {background:'none',border:'none',fontSize:13,color:'#2563eb',cursor:'pointer',padding:0,fontWeight:500},
  pageTitle:    {fontSize:22,fontWeight:700,color:'#111827',margin:'0 0 2px',letterSpacing:'-0.3px'},
  pageSub:      {fontSize:13,color:'#6b7280',margin:0},
  judgeBtn:     {backgroundColor:'#111827',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:500,cursor:'pointer'},
  eventTabs:    {display:'flex',gap:0,borderRadius:10,overflow:'hidden',border:'1px solid #e5e7eb',backgroundColor:'#fff',width:'fit-content'},
  eventTab:     {padding:'9px 20px',border:'none',background:'none',fontSize:14,fontWeight:500,color:'#6b7280',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:2},
  eventTabActive:{backgroundColor:'#111827',color:'#fff'},
  eventCount:   {fontSize:10,color:'#9ca3af'},
  teamPill:     {padding:'6px 14px',borderRadius:99,border:'1px solid #e5e7eb',background:'#fff',fontSize:13,color:'#6b7280',cursor:'pointer'},
  teamPillActive:{backgroundColor:'#111827',color:'#fff',borderColor:'#111827'},
  card:         {backgroundColor:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:20},
  cardTitle:    {fontSize:15,fontWeight:600,color:'#111827',margin:0},
  countBadge:   {fontSize:12,color:'#6b7280',backgroundColor:'#f3f4f6',borderRadius:99,padding:'3px 10px'},
  emptyState:   {backgroundColor:'#fff',border:'1px dashed #e5e7eb',borderRadius:12,padding:'48px 24px',textAlign:'center'},
  goBtn:        {backgroundColor:'#111827',color:'#fff',border:'none',borderRadius:8,padding:'9px 18px',fontSize:13,fontWeight:500,cursor:'pointer'},
}
