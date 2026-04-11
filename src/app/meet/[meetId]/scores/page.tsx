'use client'

// src/app/meet/[meetId]/scores/page.tsx

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

interface Meet {
  id: string; name: string; meet_date: string; location: string | null
  status: string; host_club_id: string; num_judges: number | null
}

interface ScoreRow {
  gymnast_id: string; team_id: string; age_group: string; running_order: number
  lineup_status: string; gymnast_first_name: string; gymnast_last_name: string
  team_name: string; division_name: string | null; score_id: string | null
  vault: number | null; vault_dnc: boolean; bars: number | null; bars_dnc: boolean
  beam: number | null; beam_dnc: boolean; floor: number | null; floor_dnc: boolean
}

type Event = 'vault' | 'bars' | 'beam' | 'floor'
const EVENTS: Event[] = ['vault', 'bars', 'beam', 'floor']
const EVENT_LABELS: Record<Event, string> = { vault: 'Vault', bars: 'Bars', beam: 'Beam', floor: 'Floor' }

// Distinct color per event — visible at a glance
const EVENT_COLORS: Record<Event, { bg: string; text: string; light: string }> = {
  vault:    { bg: '#1d4ed8', text: '#fff', light: '#eff6ff' },
  bars:     { bg: '#b45309', text: '#fff', light: '#fffbeb' },
  beam:     { bg: '#065f46', text: '#fff', light: '#f0fdf4' },
  floor:    { bg: '#7c3aed', text: '#fff', light: '#f5f3ff' },
}

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

const TEAM_COLORS = ['#374151','#1e40af','#065f46','#7c2d12','#4c1d95','#831843']

// ── Event picker screen ──────────────────────────────────────────────────────
function EventPicker({ onConfirm }: { onConfirm: (events: Event[]) => void }) {
  const [selected, setSelected] = useState<Event[]>([])
  function toggle(ev: Event) {
    setSelected(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev])
  }
  return (
    <div style={{minHeight:'100vh',backgroundColor:'#f8f9fa',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans', sans-serif",padding:24}}>
      <div style={{backgroundColor:'#fff',borderRadius:16,border:'1px solid #e5e7eb',padding:32,width:'100%',maxWidth:380}}>
        <h1 style={{fontSize:20,fontWeight:700,color:'#111827',margin:'0 0 6px',textAlign:'center'}}>Judge View</h1>
        <p style={{fontSize:13,color:'#6b7280',textAlign:'center',margin:'0 0 24px'}}>Select the event(s) you are scoring today</p>
        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:24}}>
          {EVENTS.map(ev => {
            const sel = selected.includes(ev)
            const c = EVENT_COLORS[ev]
            return (
              <button key={ev} onClick={() => toggle(ev)} style={{
                display:'flex',alignItems:'center',gap:14,padding:'14px 16px',
                borderRadius:10,border:`2px solid ${sel ? c.bg : '#e5e7eb'}`,
                background: sel ? c.light : '#fff',cursor:'pointer',textAlign:'left',
              }}>
                <div style={{width:20,height:20,borderRadius:4,backgroundColor: sel ? c.bg : '#e5e7eb',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  {sel && <span style={{color:'#fff',fontSize:13,fontWeight:700}}>✓</span>}
                </div>
                <div>
                  <div style={{fontSize:15,fontWeight:600,color: sel ? c.bg : '#374151'}}>{EVENT_LABELS[ev]}</div>
                  <div style={{fontSize:11,color:'#9ca3af'}}>Score all gymnasts on this event</div>
                </div>
                <div style={{marginLeft:'auto',width:12,height:12,borderRadius:'50%',backgroundColor: sel ? c.bg : '#e5e7eb'}}/>
              </button>
            )
          })}
        </div>
        <button
          onClick={() => selected.length > 0 && onConfirm(selected)}
          disabled={selected.length === 0}
          style={{width:'100%',padding:'12px',borderRadius:10,border:'none',
            backgroundColor: selected.length > 0 ? '#111827' : '#f3f4f6',
            color: selected.length > 0 ? '#fff' : '#9ca3af',
            fontSize:15,fontWeight:600,cursor: selected.length > 0 ? 'pointer' : 'default'
          }}>
          {selected.length === 0 ? 'Select at least one event' : `Start scoring ${selected.map(e => EVENT_LABELS[e]).join(' + ')} →`}
        </button>
      </div>
    </div>
  )
}

// ── Numpad ───────────────────────────────────────────────────────────────────
function NumPad({ value, onChange, onConfirm, onDnc, isDnc, eventColor }:
  { value: string; onChange: (v: string) => void; onConfirm: () => void
    onDnc: (v: boolean) => void; isDnc: boolean; eventColor: { bg: string; text: string; light: string } }) {
  function tap(key: string) {
    if (key === 'DEL') { onChange(value.slice(0, -1)); return }
    if (key === '.') { if (value.includes('.')) return; onChange(value + '.'); return }
    const next = value + key
    const num = parseFloat(next)
    if (!isNaN(num) && num <= 20) onChange(next)
  }
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,padding:'8px 16px 12px'}}>
      <div style={{height:60,display:'flex',alignItems:'center',justifyContent:'center',width:'100%',
        background: isDnc ? '#fee2e2' : eventColor.light,
        borderRadius:12,border:`1px solid ${isDnc ? '#fca5a5' : eventColor.bg}`,marginBottom:4}}>
        {isDnc
          ? <span style={{color:'#dc2626',fontWeight:700,fontSize:22}}>DNC</span>
          : <span style={{fontSize:36,fontWeight:700,color:eventColor.bg}}>{value || '—'}</span>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:6,width:'100%',maxWidth:280}}>
        {['7','8','9','4','5','6','1','2','3','.','0','DEL'].map(k => (
          <button key={k} onClick={() => tap(k)} disabled={isDnc}
            style={{height:52,borderRadius:10,border:'1px solid #e5e7eb',
              background: k === 'DEL' ? '#f3f4f6' : '#fff',
              fontSize:20,fontWeight:500,color:'#111827',cursor:'pointer',
              opacity: isDnc ? 0.3 : 1}}>
            {k}
          </button>
        ))}
      </div>
      <div style={{display:'flex',gap:8,marginTop:4,width:'100%',maxWidth:280}}>
        <button onClick={() => onDnc(!isDnc)}
          style={{flex:1,height:46,borderRadius:10,
            border:`1px solid ${isDnc ? '#fca5a5' : '#e5e7eb'}`,
            background: isDnc ? '#fee2e2' : '#fff',
            fontSize:14,fontWeight:600,color:'#dc2626',cursor:'pointer'}}>DNC</button>
        <button onClick={onConfirm} disabled={!value && !isDnc}
          style={{flex:2,height:46,borderRadius:10,border:'none',
            background: (!value && !isDnc) ? '#e5e7eb' : eventColor.bg,
            color: (!value && !isDnc) ? '#9ca3af' : eventColor.text,
            fontSize:15,fontWeight:600,cursor: (!value && !isDnc) ? 'default' : 'pointer'}}>
          Confirm ✓
        </button>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
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

  // Score table state
  const [activeEvent, setActiveEvent] = useState<Event>('vault')
  const [filterTeamId, setFilterTeamId] = useState<string>('all')
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [dncEdits, setDncEdits] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState<Set<string>>(new Set())

  // Judge mode state
  const [judgeMode, setJudgeMode] = useState(false)
  const [judgeEvents, setJudgeEvents] = useState<Event[]>([]) // selected events
  const [showEventPicker, setShowEventPicker] = useState(false)
  const [judgeEvent, setJudgeEvent] = useState<Event>('vault')
  const [judgeIndex, setJudgeIndex] = useState(0)
  const [judgeVal, setJudgeVal] = useState('')
  const [judgeDnc, setJudgeDnc] = useState(false)
  const [doneEvents, setDoneEvents] = useState<Set<Event>>(new Set())

  const activeRowRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    if (judgeMode && activeRowRef.current) {
      activeRowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [judgeIndex, judgeMode])

  const isHost = meet !== null && userClubId !== null && userClubId === meet.host_club_id
  const dashboardPath = userRole === 'maga_admin' ? '/maga/dashboard' : '/club/dashboard'
  const activeRows = rows.filter(r => r.lineup_status !== 'scratched')

  const teams = Array.from(new Map(
    activeRows.map(r => [r.team_id, { id: r.team_id, name: r.team_name, division: r.division_name }])
  ).values())

  const judgeRows = activeRows.slice().sort((a, b) => {
    const ai = teams.findIndex(t => t.id === a.team_id)
    const bi = teams.findIndex(t => t.id === b.team_id)
    if (ai !== bi) return ai - bi
    return a.running_order - b.running_order
  })

  const currentRow = judgeRows[judgeIndex] ?? null

  function getScore(row: ScoreRow, event: Event): number | null {
    return row[event as keyof ScoreRow] as number | null
  }
  function getDnc(row: ScoreRow, event: Event): boolean {
    return row[`${event}_dnc` as keyof ScoreRow] as boolean || false
  }
  function countEntered(event: Event) {
    return activeRows.filter(r => getScore(r, event) !== null || getDnc(r, event)).length
  }
  function allEnteredForEvent(event: Event) {
    return activeRows.length > 0 && countEntered(event) === activeRows.length
  }
  function getTeamColor(teamId: string): string {
    const idx = teams.findIndex(t => t.id === teamId)
    return TEAM_COLORS[idx % TEAM_COLORS.length]
  }
  function getRotationLeft(row: ScoreRow): number {
    const teamRows = judgeRows.filter(r => r.team_id === row.team_id)
    const idx = teamRows.findIndex(r => r.gymnast_id === row.gymnast_id)
    return Math.max(0, teamRows.length - idx - 1)
  }

  // score table helpers
  function getDisplayVal(row: ScoreRow, event: Event): string {
    if (row.gymnast_id in edits && activeEvent === event) return edits[row.gymnast_id]
    const v = getScore(row, event)
    return v !== null ? String(v) : ''
  }
  function isDncEdit(row: ScoreRow, event: Event): boolean {
    if (row.gymnast_id in dncEdits && activeEvent === event) return dncEdits[row.gymnast_id]
    return getDnc(row, event)
  }

  async function saveScore(row: ScoreRow, event: Event) {
    const gid = row.gymnast_id
    const rawVal = edits[gid]
    const dnc = dncEdits[gid] ?? getDnc(row, event)
    const numVal = rawVal !== undefined ? (rawVal === '' ? null : parseFloat(rawVal)) : getScore(row, event)
    setSaving(prev => new Set(prev).add(gid))
    const payload = { meet_id: meetId, gymnast_id: gid, team_id: row.team_id, age_group: row.age_group, [event]: numVal, [`${event}_dnc`]: dnc }
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

  async function judgeConfirm() {
    if (!currentRow) return
    const numVal = judgeVal === '' ? null : parseFloat(judgeVal)
    const gid = currentRow.gymnast_id
    const payload = {
      meet_id: meetId, gymnast_id: gid, team_id: currentRow.team_id,
      age_group: currentRow.age_group,
      [judgeEvent]: judgeDnc ? null : numVal,
      [`${judgeEvent}_dnc`]: judgeDnc,
    }
    setSaving(prev => new Set(prev).add(gid))
    if (currentRow.score_id) {
      await supabase.from('scores').update(payload).eq('id', currentRow.score_id)
    } else {
      const { data: ins } = await supabase.from('scores').insert({
        meet_id: meetId, gymnast_id: gid, team_id: currentRow.team_id,
        age_group: currentRow.age_group,
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
    setJudgeVal(''); setJudgeDnc(false)
    setJudgeIndex(i => Math.min(i + 1, judgeRows.length - 1))
  }

  function markEventDone(event: Event) {
    setDoneEvents(prev => new Set(prev).add(event))
    // if there are other assigned events not yet done, switch to the first one
    const remaining = judgeEvents.filter(e => e !== event && !doneEvents.has(e))
    if (remaining.length > 0) {
      setJudgeEvent(remaining[0])
      setJudgeIndex(0)
      setJudgeVal(''); setJudgeDnc(false)
    }
  }

  function allMyEventsDone() {
    return judgeEvents.length > 0 && judgeEvents.every(e => doneEvents.has(e) || allEnteredForEvent(e))
  }

  if (loading) return <div style={s.page}><div style={s.center}><div style={s.spinner}/></div></div>
  if (error || !meet) return (
    <div style={s.page}><div style={s.center}>
      <p style={{color:'#dc2626'}}>{error || 'Meet not found.'}</p>
      <button onClick={()=>router.back()} style={s.linkBtn}>← Go back</button>
    </div></div>
  )

  const sc = STATUS_COLORS[meet.status] || STATUS_COLORS.setup
  const fmtDate = (d: string) => new Date(d+'T00:00:00').toLocaleDateString('en-US',{weekday:'short',month:'long',day:'numeric',year:'numeric'})

  // ── SHOW EVENT PICKER ────────────────────────────────────────────────────
  if (showEventPicker) {
    return (
      <EventPicker onConfirm={(events) => {
        setJudgeEvents(events)
        setJudgeEvent(events[0])
        setJudgeIndex(0)
        setJudgeVal(''); setJudgeDnc(false)
        setDoneEvents(new Set())
        setShowEventPicker(false)
        setJudgeMode(true)
      }} />
    )
  }

  // ── JUDGE MODE ────────────────────────────────────────────────────────────
  if (judgeMode) {
    const row = currentRow
    const progress = judgeRows.length > 0 ? (judgeIndex / judgeRows.length) * 100 : 0
    const existingScore = row ? getScore(row, judgeEvent) : null
    const existingDnc = row ? getDnc(row, judgeEvent) : false
    const rotLeft = row ? getRotationLeft(row) : 0
    const teamColor = row ? getTeamColor(row.team_id) : '#374151'
    const ec = EVENT_COLORS[judgeEvent]
    const eventAllDone = allEnteredForEvent(judgeEvent)

    const rosterGroups = teams.map((team, ti) => ({
      ...team,
      color: TEAM_COLORS[ti % TEAM_COLORS.length],
      gymnasts: judgeRows.filter(r => r.team_id === team.id),
    }))

    return (
      <div style={{minHeight:'100vh',backgroundColor:'#f8f9fa',fontFamily:"'DM Sans', sans-serif"}}>
        {/* Top bar */}
        <div style={{backgroundColor:'#111827',padding:'10px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <button onClick={()=>setJudgeMode(false)} style={{background:'none',border:'1px solid #374151',borderRadius:6,color:'#9ca3af',padding:'5px 10px',fontSize:13,cursor:'pointer'}}>← Score table</button>
          <span style={{color:'#fff',fontWeight:600,fontSize:14,flex:1,textAlign:'center',margin:'0 8px'}}>{meet.name}</span>
          <span style={{fontSize:13,color:'#9ca3af'}}>{judgeIndex + 1} / {judgeRows.length}</span>
        </div>

        {/* Progress bar */}
        <div style={{height:4,background:'#e5e7eb'}}>
          <div style={{height:4,background:ec.bg,width:`${progress}%`,transition:'width 0.3s'}}/>
        </div>

        {/* Event tabs — color-coded, judge can only tap their assigned events */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',borderBottom:'1px solid #e5e7eb',backgroundColor:'#fff'}}>
          {EVENTS.map(ev => {
            const isAssigned = judgeEvents.includes(ev)
            const isActive = judgeEvent === ev
            const isDone = doneEvents.has(ev) || allEnteredForEvent(ev)
            const c = EVENT_COLORS[ev]
            return (
              <button key={ev}
                onClick={() => {
                  if (!isAssigned) return
                  setJudgeEvent(ev); setJudgeVal(''); setJudgeDnc(false); setJudgeIndex(0)
                }}
                style={{
                  padding:'10px 4px',border:'none',
                  background: isActive ? c.bg : isAssigned ? c.light : '#f9fafb',
                  fontSize:13,fontWeight:600,
                  color: isActive ? c.text : isAssigned ? c.bg : '#d1d5db',
                  cursor: isAssigned ? 'pointer' : 'default',
                  borderBottom: isActive ? `3px solid ${c.bg}` : '3px solid transparent',
                  position:'relative',
                  opacity: isAssigned ? 1 : 0.4,
                }}>
                {EVENT_LABELS[ev]}
                {isDone && isAssigned && (
                  <span style={{position:'absolute',top:4,right:6,fontSize:9,color: isActive ? c.text : c.bg,fontWeight:700}}>✓</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Done banner — appears when all scores entered for this event */}
        {eventAllDone && !doneEvents.has(judgeEvent) && (
          <div style={{backgroundColor:'#f0fdf4',border:'none',borderBottom:'1px solid #bbf7d0',padding:'10px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:13,color:'#166534',fontWeight:500}}>✓ All {EVENT_LABELS[judgeEvent]} scores entered</span>
            <button onClick={() => markEventDone(judgeEvent)}
              style={{backgroundColor:'#16a34a',color:'#fff',border:'none',borderRadius:8,padding:'6px 16px',fontSize:13,fontWeight:600,cursor:'pointer'}}>
              Done with {EVENT_LABELS[judgeEvent]}
            </button>
          </div>
        )}
        {doneEvents.has(judgeEvent) && (
          <div style={{backgroundColor:'#f0fdf4',borderBottom:'1px solid #bbf7d0',padding:'10px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:13,color:'#166534',fontWeight:500}}>✓ {EVENT_LABELS[judgeEvent]} marked complete</span>
            <button onClick={() => setDoneEvents(prev => { const n = new Set(prev); n.delete(judgeEvent); return n })}
              style={{background:'none',border:'1px solid #16a34a',borderRadius:8,padding:'5px 14px',fontSize:12,color:'#16a34a',cursor:'pointer'}}>
              Undo
            </button>
          </div>
        )}

        {/* All done banner */}
        {allMyEventsDone() && (
          <div style={{backgroundColor:'#111827',padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:14,color:'#fff',fontWeight:600}}>All your events are complete</span>
            <button onClick={()=>setJudgeMode(false)}
              style={{backgroundColor:'#fff',color:'#111827',border:'none',borderRadius:8,padding:'7px 18px',fontSize:13,fontWeight:600,cursor:'pointer'}}>
              Exit judge view →
            </button>
          </div>
        )}

        {/* Body: roster + entry */}
        <div style={{display:'flex',height:'calc(100vh - 115px)'}}>

          {/* Roster panel */}
          <div style={{width:160,flexShrink:0,backgroundColor:'#fff',borderRight:'1px solid #e5e7eb',overflowY:'auto'}}>
            {rosterGroups.map(group => (
              <div key={group.id}>
                <div style={{padding:'6px 10px',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,zIndex:1,backgroundColor:group.color}}>
                  <span style={{fontSize:10,fontWeight:600,color:'#fff',textTransform:'uppercase',letterSpacing:'0.05em'}}>{group.name}</span>
                  {group.division && <span style={{fontSize:9,color:'rgba(255,255,255,0.65)'}}>{group.division}</span>}
                </div>
                {group.gymnasts.map(r => {
                  const globalIdx = judgeRows.findIndex(jr => jr.gymnast_id === r.gymnast_id)
                  const isActive = globalIdx === judgeIndex
                  const score = getScore(r, judgeEvent)
                  const dnc = getDnc(r, judgeEvent)
                  const hasScore = score !== null || dnc
                  return (
                    <div key={r.gymnast_id}
                      ref={isActive ? activeRowRef : null}
                      onClick={() => { setJudgeIndex(globalIdx); setJudgeVal(''); setJudgeDnc(false) }}
                      style={{display:'flex',alignItems:'center',gap:6,padding:'7px 10px',
                        borderBottom:'1px solid #f3f4f6',cursor:'pointer',
                        backgroundColor: isActive ? ec.light : '#fff',
                        borderLeft: isActive ? `3px solid ${ec.bg}` : '3px solid transparent',
                      }}>
                      <span style={{fontSize:11,color:'#9ca3af',fontWeight:500,width:14,flexShrink:0}}>{r.running_order}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight: isActive ? 600 : 500,color:'#374151',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                          {r.gymnast_last_name}, {r.gymnast_first_name.charAt(0)}.
                        </div>
                        <div style={{fontSize:10,color:'#6b7280'}}>{r.age_group}</div>
                        {hasScore
                          ? <div style={{fontSize:10,color:ec.bg,fontWeight:600}}>{dnc ? 'DNC' : score?.toFixed(3)} ✓</div>
                          : <div style={{fontSize:10,color:'#d1d5db'}}>—</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Main entry */}
          <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column'}}>
            {row ? (
              <>
                {/* Team bar */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 14px',backgroundColor:'#f8f9fa',borderBottom:'1px solid #e5e7eb',borderLeft:`4px solid ${teamColor}`}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:'#111827'}}>{row.team_name}</div>
                    {row.division_name && <div style={{fontSize:11,color:'#6b7280'}}>{row.division_name}</div>}
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:20,fontWeight:700,color:'#111827',lineHeight:1}}>{rotLeft}</div>
                    <div style={{fontSize:10,color:'#9ca3af'}}>left in rotation</div>
                  </div>
                </div>

                <div style={{padding:'8px 14px 0',textAlign:'center'}}>
                  <div style={{fontSize:12,color:'#9ca3af',marginBottom:2}}>#{row.running_order}</div>
                  <div style={{fontSize:20,fontWeight:700,color:'#111827',padding:'0 16px'}}>{row.gymnast_first_name} {row.gymnast_last_name}</div>
                  <div style={{fontSize:12,color:'#6b7280',marginBottom:4}}>{row.age_group}</div>
                  {(existingScore !== null || existingDnc) && (
                    <div style={{fontSize:13,color:'#374151',padding:'4px 16px',background:'#f3f4f6',borderRadius:6,margin:'0 16px 4px',display:'inline-block'}}>
                      Current {EVENT_LABELS[judgeEvent]}: <strong>{existingDnc ? 'DNC' : existingScore?.toFixed(3)}</strong>
                    </div>
                  )}
                </div>

                <NumPad value={judgeVal} onChange={setJudgeVal} onConfirm={judgeConfirm}
                  onDnc={setJudgeDnc} isDnc={judgeDnc} eventColor={ec} />
              </>
            ) : (
              <div style={{padding:32,textAlign:'center',color:'#9ca3af'}}>No gymnasts available.</div>
            )}

            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',borderTop:'1px solid #e5e7eb',backgroundColor:'#fff',marginTop:'auto'}}>
              <button onClick={() => { setJudgeVal(''); setJudgeDnc(false); setJudgeIndex(i => Math.max(i-1,0)) }}
                disabled={judgeIndex === 0}
                style={{background:'none',border:'1px solid #e5e7eb',borderRadius:8,padding:'7px 14px',fontSize:13,color:'#374151',cursor:'pointer'}}>← Prev</button>
              <span style={{fontSize:12,color:'#9ca3af'}}>{row?.gymnast_first_name} {row?.gymnast_last_name}</span>
              <button onClick={() => { setJudgeVal(''); setJudgeDnc(false); setJudgeIndex(i => Math.min(i+1,judgeRows.length-1)) }}
                disabled={judgeIndex >= judgeRows.length-1}
                style={{background:'none',border:'1px solid #e5e7eb',borderRadius:8,padding:'7px 14px',fontSize:13,color:'#374151',cursor:'pointer'}}>Next →</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── SCORE TABLE VIEW ──────────────────────────────────────────────────────
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
          <span style={{...s.badge,backgroundColor:sc.bg,color:sc.color,fontSize:11}}>{meet.status}</span>
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
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
            <div>
              <h1 style={s.pageTitle}>Score Entry</h1>
              <p style={s.pageSub}>{EVENTS.map(ev => `${EVENT_LABELS[ev]}: ${countEntered(ev)}/${activeRows.length}`).join(' · ')}</p>
            </div>
            <button onClick={()=>setShowEventPicker(true)} style={s.judgeBtn}>📱 Judge view</button>
          </div>

          {/* Event tabs with distinct colors */}
          <div style={{display:'flex',gap:0,borderRadius:10,overflow:'hidden',border:'1px solid #e5e7eb',width:'fit-content'}}>
            {EVENTS.map(ev => {
              const isActive = activeEvent === ev
              const c = EVENT_COLORS[ev]
              return (
                <button key={ev} onClick={()=>setActiveEvent(ev)}
                  style={{padding:'9px 20px',border:'none',
                    background: isActive ? c.bg : '#fff',
                    fontSize:14,fontWeight:600,
                    color: isActive ? c.text : '#6b7280',
                    cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                  {EVENT_LABELS[ev]}
                  <span style={{fontSize:10,color: isActive ? 'rgba(255,255,255,0.7)' : '#9ca3af'}}>
                    {countEntered(ev)}/{activeRows.length}
                  </span>
                </button>
              )
            })}
          </div>

          {teams.length > 1 && (
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              <button onClick={()=>setFilterTeamId('all')} style={{...s.teamPill,...(filterTeamId==='all'?s.teamPillActive:{})}}>All teams</button>
              {teams.map(t => (
                <button key={t.id} onClick={()=>setFilterTeamId(t.id)} style={{...s.teamPill,...(filterTeamId===t.id?s.teamPillActive:{})}}>
                  {t.name}
                </button>
              ))}
            </div>
          )}

          {activeRows.length === 0 ? (
            <div style={s.emptyState}>
              <p style={{fontSize:15,fontWeight:600,color:'#374151',margin:'0 0 4px'}}>No lineup available</p>
              <p style={{fontSize:13,color:'#9ca3af',margin:'0 0 16px'}}>Scores can be entered once teams have submitted their lineups.</p>
              <button style={s.goBtn} onClick={()=>router.push(`/meet/${meetId}/lineup`)}>Go to Lineup Manager →</button>
            </div>
          ) : teamGroups.map(group => {
            const ec = EVENT_COLORS[activeEvent]
            return (
              <div key={group.id} style={s.card}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <h2 style={s.cardTitle}>{group.name}</h2>
                  <span style={{...s.countBadge,backgroundColor:ec.light,color:ec.bg}}>
                    {group.entries.filter(r => getScore(r,activeEvent)!==null||getDnc(r,activeEvent)).length} / {group.entries.length} entered
                  </span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'36px 2fr 1fr 120px 60px 70px',gap:8,padding:'6px 8px',fontSize:11,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:2}}>
                  <span>#</span><span>Gymnast</span><span>Age group</span>
                  <span style={{textAlign:'center',color:ec.bg}}>{EVENT_LABELS[activeEvent]}</span>
                  <span style={{textAlign:'center'}}>DNC</span><span></span>
                </div>
                {group.entries.map(row => {
                  const gid = row.gymnast_id
                  const isSaving = saving.has(gid); const isSaved = saved.has(gid)
                  const hasEdit = gid in edits || gid in dncEdits
                  const dnc = isDncEdit(row, activeEvent)
                  const displayVal = getDisplayVal(row, activeEvent)
                  const existingScore = getScore(row, activeEvent)
                  const alreadyEntered = existingScore !== null || getDnc(row, activeEvent)
                  return (
                    <div key={gid} style={{display:'grid',gridTemplateColumns:'36px 2fr 1fr 120px 60px 70px',gap:8,padding:'10px 8px',borderRadius:8,alignItems:'center',borderBottom:'1px solid #f3f4f6',backgroundColor: alreadyEntered ? ec.light : '#fff'}}>
                      <span style={{fontSize:13,color:'#9ca3af',fontWeight:500}}>{row.running_order}</span>
                      <span style={{fontSize:14,fontWeight:500,color:'#111827'}}>{row.gymnast_first_name} {row.gymnast_last_name}</span>
                      <span style={{fontSize:13,color:'#6b7280'}}>{row.age_group}</span>
                      <div style={{display:'flex',justifyContent:'center'}}>
                        <input type="number" step="0.025" min="0" max="20"
                          disabled={dnc||!isHost}
                          value={dnc?'':displayVal}
                          placeholder={dnc?'DNC':(existingScore!==null?String(existingScore):'—')}
                          onChange={e=>setEdits(prev=>({...prev,[gid]:e.target.value}))}
                          onKeyDown={e=>{if(e.key==='Enter')saveScore(row,activeEvent)}}
                          style={{width:'100%',border:`1px solid ${alreadyEntered&&!hasEdit?ec.bg:'#e5e7eb'}`,borderRadius:6,padding:'7px 10px',fontSize:14,color:'#111827',textAlign:'center',outline:'none',boxSizing:'border-box',backgroundColor:dnc?'#fef2f2':alreadyEntered&&!hasEdit?ec.light:'#fff'}}
                        />
                      </div>
                      <div style={{display:'flex',justifyContent:'center'}}>
                        <input type="checkbox" checked={dnc} disabled={!isHost}
                          onChange={e=>setDncEdits(prev=>({...prev,[gid]:e.target.checked}))}
                          style={{width:16,height:16,cursor:'pointer'}}
                        />
                      </div>
                      {isHost && (
                        <button onClick={()=>saveScore(row,activeEvent)}
                          disabled={isSaving||!hasEdit}
                          style={{width:'100%',backgroundColor:isSaved?'#16a34a':!hasEdit?'#f3f4f6':ec.bg,
                            color:!hasEdit&&!isSaved?'#9ca3af':'#fff',
                            border:'none',borderRadius:6,padding:'7px 0',fontSize:12,fontWeight:600,
                            cursor:hasEdit?'pointer':'default'}}>
                          {isSaving?'…':isSaved?'✓':alreadyEntered?'Update':'Save'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </main>
      </div>
    </div>
  )
}

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
  teamPill:     {padding:'6px 14px',borderRadius:99,border:'1px solid #e5e7eb',background:'#fff',fontSize:13,color:'#6b7280',cursor:'pointer'},
  teamPillActive:{backgroundColor:'#111827',color:'#fff',borderColor:'#111827'},
  card:         {backgroundColor:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:20},
  cardTitle:    {fontSize:15,fontWeight:600,color:'#111827',margin:0},
  countBadge:   {fontSize:12,borderRadius:99,padding:'3px 10px'},
  emptyState:   {backgroundColor:'#fff',border:'1px dashed #e5e7eb',borderRadius:12,padding:'48px 24px',textAlign:'center'},
  goBtn:        {backgroundColor:'#111827',color:'#fff',border:'none',borderRadius:8,padding:'9px 18px',fontSize:13,fontWeight:500,cursor:'pointer'},
}
