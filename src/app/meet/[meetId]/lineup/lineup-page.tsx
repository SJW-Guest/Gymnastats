'use client'

// src/app/meet/[meetId]/lineup/page.tsx

import { useState, useEffect } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

interface Meet {
  id: string; name: string; meet_date: string; location: string | null
  status: string; host_club_id: string
}

interface LineupEntry {
  id: string
  running_order: number
  age_group: string
  status: string
  scratch_reason: string | null
  gymnast_id: string
  team_id: string
  gymnast_first_name: string
  gymnast_last_name: string
  team_name: string
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

export default function LineupManagerPage() {
  const { meetId } = useParams<{ meetId: string }>()
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [meet, setMeet] = useState<Meet | null>(null)
  const [lineup, setLineup] = useState<LineupEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userClubId, setUserClubId] = useState<string | null>(null)
  const [groupBy, setGroupBy] = useState<'team' | 'age_group'>('team')
  const [filterTeamId, setFilterTeamId] = useState<string>('all')

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
        .from('meets').select('id, name, meet_date, location, status, host_club_id')
        .eq('id', meetId).single()
      if (meetError || !meetData) { setError('Meet not found.'); setLoading(false); return }
      setMeet(meetData as Meet)

      const { data: lineupData } = await supabase.rpc('get_meet_lineup', { p_meet_id: meetId })
      setLineup(lineupData || [])
      setLoading(false)
    }
    if (meetId) load()
  }, [meetId])

  const isHost = meet !== null && userClubId !== null && userClubId === meet.host_club_id

  const teams = Array.from(new Map(lineup.map(e => [e.team_id, e.team_name])).entries())
    .map(([id, name]) => ({ id, name }))

  const filtered = filterTeamId === 'all' ? lineup : lineup.filter(e => e.team_id === filterTeamId)

  function groupedEntries(): { label: string; entries: LineupEntry[] }[] {
    if (groupBy === 'team') {
      return teams
        .filter(t => filterTeamId === 'all' || t.id === filterTeamId)
        .map(t => ({
          label: t.name,
          entries: filtered.filter(e => e.team_id === t.id).sort((a, b) => a.running_order - b.running_order),
        })).filter(g => g.entries.length > 0)
    } else {
      const ageGroups = Array.from(new Set(filtered.map(e => e.age_group))).sort()
      return ageGroups.map(ag => ({
        label: ag,
        entries: filtered.filter(e => e.age_group === ag).sort((a, b) => a.running_order - b.running_order),
      }))
    }
  }

  async function markScratched(entryId: string, scratched: boolean) {
    await supabase.from('meet_lineups').update({
      status: scratched ? 'scratched' : 'active',
      scratched_at: scratched ? new Date().toISOString() : null,
    }).eq('id', entryId)
    setLineup(prev => prev.map(e => e.id === entryId ? { ...e, status: scratched ? 'scratched' : 'active' } : e))
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
  const groups = groupedEntries()
  const scratchedCount = lineup.filter(e => e.status === 'scratched').length

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
              <h1 style={s.pageTitle}>Lineup Manager</h1>
              <p style={s.pageSub}>{lineup.length} gymnasts{scratchedCount > 0 ? ` · ${scratchedCount} scratched` : ''}</p>
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <select value={filterTeamId} onChange={e=>setFilterTeamId(e.target.value)} style={s.select}>
                <option value="all">All teams</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <div style={s.segmented}>
                <button style={{...s.seg,...(groupBy==='team'?s.segActive:{})}} onClick={()=>setGroupBy('team')}>By team</button>
                <button style={{...s.seg,...(groupBy==='age_group'?s.segActive:{})}} onClick={()=>setGroupBy('age_group')}>By age group</button>
              </div>
            </div>
          </div>

          {lineup.length === 0 ? (
            <div style={s.emptyState}>
              <p style={{fontSize:15,fontWeight:600,color:'#374151',margin:'0 0 4px'}}>No lineup submitted yet</p>
              <p style={{fontSize:13,color:'#9ca3af',margin:0}}>Teams need to submit their lineups before gymnasts appear here.</p>
            </div>
          ) : (
            groups.map(group => (
              <div key={group.label} style={s.card}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <h2 style={s.cardTitle}>{group.label}</h2>
                  <span style={s.countBadge}>{group.entries.length} gymnasts</span>
                </div>
                <div style={s.tableHeader}>
                  <span>#</span>
                  <span>Gymnast</span>
                  <span>Age group</span>
                  {groupBy === 'age_group' && <span>Team</span>}
                  <span>Status</span>
                  {isHost && <span></span>}
                </div>
                {group.entries.map(entry => {
                  const scratched = entry.status === 'scratched'
                  return (
                    <div key={entry.id} style={{...s.tableRow, ...(scratched ? s.scratchedRow : {})}}>
                      <span style={{fontSize:13,color:'#9ca3af',fontWeight:500}}>{entry.running_order}</span>
                      <span style={{fontSize:14,fontWeight:500,color: scratched ? '#9ca3af' : '#111827',textDecoration: scratched ? 'line-through' : 'none'}}>
                        {entry.gymnast_first_name} {entry.gymnast_last_name}
                      </span>
                      <span style={{fontSize:13,color:'#6b7280'}}>{entry.age_group}</span>
                      {groupBy === 'age_group' && <span style={{fontSize:13,color:'#6b7280'}}>{entry.team_name}</span>}
                      <span>
                        {scratched ? (
                          <span style={{...s.badge, backgroundColor:'#fee2e2', color:'#dc2626'}}>Scratched</span>
                        ) : (
                          <span style={{...s.badge, backgroundColor:'#dcfce7', color:'#16a34a'}}>Active</span>
                        )}
                      </span>
                      {isHost && (
                        <span>
                          <button
                            onClick={() => markScratched(entry.id, !scratched)}
                            style={{...s.scratchBtn, ...(scratched ? s.restoreBtn : {})}}
                          >
                            {scratched ? 'Restore' : 'Scratch'}
                          </button>
                        </span>
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
  segmented:    {display:'flex',border:'1px solid #e5e7eb',borderRadius:8,overflow:'hidden'},
  seg:          {background:'none',border:'none',padding:'7px 14px',fontSize:13,color:'#6b7280',cursor:'pointer'},
  segActive:    {backgroundColor:'#111827',color:'#fff',fontWeight:500},
  card:         {backgroundColor:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:20},
  cardTitle:    {fontSize:15,fontWeight:600,color:'#111827',margin:0},
  countBadge:   {fontSize:12,color:'#6b7280',backgroundColor:'#f3f4f6',borderRadius:99,padding:'3px 10px'},
  tableHeader:  {display:'grid',gridTemplateColumns:'40px 2fr 1fr 1fr',gap:12,padding:'6px 8px',fontSize:11,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4},
  tableRow:     {display:'grid',gridTemplateColumns:'40px 2fr 1fr 1fr',gap:12,padding:'10px 8px',borderRadius:8,alignItems:'center',borderBottom:'1px solid #f3f4f6'},
  scratchedRow: {backgroundColor:'#fafafa'},
  scratchBtn:   {fontSize:12,padding:'4px 10px',borderRadius:6,border:'1px solid #e5e7eb',background:'none',color:'#dc2626',cursor:'pointer',fontWeight:500},
  restoreBtn:   {color:'#16a34a',borderColor:'#bbf7d0'},
  emptyState:   {backgroundColor:'#fff',border:'1px dashed #e5e7eb',borderRadius:12,padding:'48px 24px',textAlign:'center'},
}
