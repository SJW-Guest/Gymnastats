'use client'

// src/app/meet/[meetId]/scores/page.tsx

import { useState, useEffect, useCallback } from 'react'
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
  // existing scores (null = not yet entered)
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
  const [saving, setSaving] = useState<string | null>(null) // gymnast_id being saved
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [filterTeamId, setFilterTeamId] = useState<string>('all')
  const [filterAgeGroup, setFilterAgeGroup] = useState<string>('all')
  // local edits: { [gymnast_id]: { vault, bars, beam, floor, vault_dnc, ... } }
  const [edits, setEdits] = useState<Record<string, Partial<ScoreRow>>>({})

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: userData } = await supabase
          .from('users').select('club_id').eq('id', user.id).single()
        setUserClubId(userData?.club_id ?? null)
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

  const teams = Array.from(new Map(rows.map(r => [r.team_id, r.team_name])).entries()).map(([id, name]) => ({ id, name }))
  const ageGroups = Array.from(new Set(rows.map(r => r.age_group))).sort()

  const filtered = rows.filter(r =>
    (filterTeamId === 'all' || r.team_id === filterTeamId) &&
    (filterAgeGroup === 'all' || r.age_group === filterAgeGroup) &&
    r.lineup_status !== 'scratched'
  )

  function getVal(row: ScoreRow, field: keyof ScoreRow) {
    const edit = edits[row.gymnast_id]
    if (edit && field in edit) return edit[field as keyof typeof edit]
    return row[field]
  }

  function setEdit(gymnast_id: string, field: string, value: unknown) {
    setEdits(prev => ({ ...prev, [gymnast_id]: { ...prev[gymnast_id], [field]: value } }))
  }

  async function saveRow(row: ScoreRow) {
    setSaving(row.gymnast_id)
    const edit = edits[row.gymnast_id] || {}
    const payload = {
      meet_id: meetId,
      gymnast_id: row.gymnast_id,
      team_id: row.team_id,
      age_group: row.age_group,
      vault:       edit.vault       !== undefined ? edit.vault       : row.vault,
      vault_dnc:   edit.vault_dnc   !== undefined ? edit.vault_dnc   : row.vault_dnc,
      bars:        edit.bars        !== undefined ? edit.bars        : row.bars,
      bars_dnc:    edit.bars_dnc    !== undefined ? edit.bars_dnc    : row.bars_dnc,
      beam:        edit.beam        !== undefined ? edit.beam        : row.beam,
      beam_dnc:    edit.beam_dnc    !== undefined ? edit.beam_dnc    : row.beam_dnc,
      floor:       edit.floor       !== undefined ? edit.floor       : row.floor,
      floor_dnc:   edit.floor_dnc   !== undefined ? edit.floor_dnc   : row.floor_dnc,
    }

    if (row.score_id) {
      await supabase.from('scores').update(payload).eq('id', row.score_id)
    } else {
      const { data: inserted } = await supabase.from('scores').insert(payload).select('id').single()
      if (inserted) {
        setRows(prev => prev.map(r => r.gymnast_id === row.gymnast_id ? { ...r, score_id: inserted.id } : r))
      }
    }

    // merge edits back into rows
    setRows(prev => prev.map(r => r.gymnast_id === row.gymnast_id ? { ...r, ...payload } : r))
    setEdits(prev => { const n = {...prev}; delete n[row.gymnast_id]; return n })
    setSaving(null)
    setSaved(prev => new Set(prev).add(row.gymnast_id))
    setTimeout(() => setSaved(prev => { const n = new Set(prev); n.delete(row.gymnast_id); return n }), 2000)
  }

  function allEventScore(row: ScoreRow): number | null {
    const v = getVal(row, 'vault') as number | null
    const b = getVal(row, 'bars') as number | null
    const bm = getVal(row, 'beam') as number | null
    const f = getVal(row, 'floor') as number | null
    const vd = getVal(row, 'vault_dnc') as boolean
    const bd = getVal(row, 'bars_dnc') as boolean
    const bmd = getVal(row, 'beam_dnc') as boolean
    const fd = getVal(row, 'floor_dnc') as boolean
    if (v == null && b == null && bm == null && f == null) return null
    return (vd ? 0 : (v ?? 0)) + (bd ? 0 : (b ?? 0)) + (bmd ? 0 : (bm ?? 0)) + (fd ? 0 : (f ?? 0))
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
  const enteredCount = rows.filter(r => r.score_id !== null).length

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <div style={s.topBarInner}>
          <div style={s.logo}>G</div>
          <span style={s.logoText}>Gymnastats</span>
          <div style={{flex:1}}/>
          <button onClick={()=>router.push('/club/dashboard')} style={s.backBtn}>← Dashboard</button>
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
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12,marginBottom:4}}>
            <div>
              <h1 style={s.pageTitle}>Score Entry</h1>
              <p style={s.pageSub}>{enteredCount} of {rows.filter(r=>r.lineup_status!=='scratched').length} gymnasts scored</p>
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <select value={filterTeamId} onChange={e=>setFilterTeamId(e.target.value)} style={s.select}>
                <option value="all">All teams</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select value={filterAgeGroup} onChange={e=>setFilterAgeGroup(e.target.value)} style={s.select}>
                <option value="all">All age groups</option>
                {ageGroups.map(ag => <option key={ag} value={ag}>{ag}</option>)}
              </select>
            </div>
          </div>

          {rows.length === 0 ? (
            <div style={s.emptyState}>
              <p style={{fontSize:15,fontWeight:600,color:'#374151',margin:'0 0 4px'}}>No lineup available</p>
              <p style={{fontSize:13,color:'#9ca3af',margin:'0 0 16px'}}>Scores can be entered once teams have submitted their lineups.</p>
              <button style={s.goBtn} onClick={()=>router.push(`/meet/${meetId}/lineup`)}>Go to Lineup Manager →</button>
            </div>
          ) : (
            <div style={s.card}>
              {/* Header */}
              <div style={s.scoreHeader}>
                <span style={{gridColumn:'span 2'}}>Gymnast</span>
                {EVENTS.map(ev => <span key={ev}>{EVENT_LABELS[ev]}</span>)}
                <span>AA</span>
                <span></span>
              </div>

              {filtered.map(row => {
                const isSaving = saving === row.gymnast_id
                const isSaved = saved.has(row.gymnast_id)
                const hasEdits = !!edits[row.gymnast_id]
                const aa = allEventScore(row)

                return (
                  <div key={row.gymnast_id} style={s.scoreRow}>
                    <span style={{fontSize:12,color:'#9ca3af'}}>{row.running_order}</span>
                    <div>
                      <div style={{fontSize:14,fontWeight:500,color:'#111827'}}>{row.gymnast_first_name} {row.gymnast_last_name}</div>
                      <div style={{fontSize:11,color:'#9ca3af'}}>{row.team_name} · {row.age_group}</div>
                    </div>

                    {EVENTS.map(ev => {
                      const dncKey = `${ev}_dnc` as keyof ScoreRow
                      const isDnc = getVal(row, dncKey) as boolean
                      const val = getVal(row, ev as keyof ScoreRow) as number | null
                      return (
                        <div key={ev} style={{display:'flex',flexDirection:'column',gap:3}}>
                          <input
                            type="number"
                            step="0.025"
                            min="0"
                            max="20"
                            disabled={isDnc || !isHost}
                            value={isDnc ? '' : (val ?? '')}
                            placeholder={isDnc ? 'DNC' : '—'}
                            onChange={e => setEdit(row.gymnast_id, ev, e.target.value === '' ? null : parseFloat(e.target.value))}
                            style={{...s.scoreInput, ...(isDnc ? s.dncInput : {})}}
                          />
                          {isHost && (
                            <label style={s.dncLabel}>
                              <input
                                type="checkbox"
                                checked={isDnc}
                                onChange={e => {
                                  setEdit(row.gymnast_id, dncKey as string, e.target.checked)
                                  if (e.target.checked) setEdit(row.gymnast_id, ev, null)
                                }}
                                style={{width:10,height:10}}
                              />
                              <span>DNC</span>
                            </label>
                          )}
                        </div>
                      )
                    })}

                    <span style={{fontSize:14,fontWeight:600,color:'#111827',textAlign:'center'}}>
                      {aa !== null ? aa.toFixed(3) : '—'}
                    </span>

                    {isHost && (
                      <button
                        onClick={() => saveRow(row)}
                        disabled={isSaving || !hasEdits}
                        style={{
                          ...s.saveBtn,
                          ...(isSaved ? s.savedBtn : {}),
                          ...((!hasEdits && !isSaved) ? s.disabledBtn : {}),
                        }}
                      >
                        {isSaving ? '...' : isSaved ? '✓' : 'Save'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
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
  select:       {border:'1px solid #e5e7eb',borderRadius:8,padding:'7px 12px',fontSize:13,color:'#374151',backgroundColor:'#fff',cursor:'pointer'},
  card:         {backgroundColor:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:20,overflowX:'auto'},
  scoreHeader:  {display:'grid',gridTemplateColumns:'32px 2fr 1fr 1fr 1fr 1fr 80px 60px',gap:8,padding:'6px 8px',fontSize:11,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4,minWidth:700},
  scoreRow:     {display:'grid',gridTemplateColumns:'32px 2fr 1fr 1fr 1fr 1fr 80px 60px',gap:8,padding:'10px 8px',borderRadius:8,alignItems:'center',borderBottom:'1px solid #f3f4f6',minWidth:700},
  scoreInput:   {width:'100%',border:'1px solid #e5e7eb',borderRadius:6,padding:'6px 8px',fontSize:13,color:'#111827',textAlign:'center',outline:'none',boxSizing:'border-box'},
  dncInput:     {backgroundColor:'#f9fafb',color:'#9ca3af',borderColor:'#f3f4f6'},
  dncLabel:     {display:'flex',alignItems:'center',gap:3,fontSize:10,color:'#9ca3af',cursor:'pointer'},
  saveBtn:      {backgroundColor:'#111827',color:'#fff',border:'none',borderRadius:6,padding:'6px 12px',fontSize:12,fontWeight:500,cursor:'pointer'},
  savedBtn:     {backgroundColor:'#16a34a'},
  disabledBtn:  {backgroundColor:'#f3f4f6',color:'#9ca3af',cursor:'default'},
  emptyState:   {backgroundColor:'#fff',border:'1px dashed #e5e7eb',borderRadius:12,padding:'48px 24px',textAlign:'center'},
  goBtn:        {backgroundColor:'#111827',color:'#fff',border:'none',borderRadius:8,padding:'9px 18px',fontSize:13,fontWeight:500,cursor:'pointer'},
}
