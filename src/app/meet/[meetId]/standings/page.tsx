'use client'

// src/app/meet/[meetId]/standings/page.tsx

import { useState, useEffect } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

interface Meet {
  id: string; name: string; meet_date: string; location: string | null
  status: string; host_club_id: string
}

interface GymnastStanding {
  gymnast_id: string
  gymnast_first_name: string
  gymnast_last_name: string
  team_name: string
  age_group: string
  division_name: string | null
  vault: number | null;      vault_dnc: boolean
  bars: number | null;       bars_dnc: boolean
  beam: number | null;       beam_dnc: boolean
  floor: number | null;      floor_dnc: boolean
  all_around: number | null
}

interface TeamStanding {
  team_id: string
  team_name: string
  division_name: string | null
  gymnast_count: number
  team_total: number | null
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

type View = 'team' | 'individual'

export default function MeetStandingsPage() {
  const { meetId } = useParams<{ meetId: string }>()
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [meet, setMeet] = useState<Meet | null>(null)
  const [gymnasts, setGymnasts] = useState<GymnastStanding[]>([])
  const [teams, setTeams] = useState<TeamStanding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userClubId, setUserClubId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [view, setView] = useState<View>('team')
  const [filterAgeGroup, setFilterAgeGroup] = useState<string>('all')
  const [filterDivision, setFilterDivision] = useState<string>('all')

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
        .from('meets').select('id, name, meet_date, location, status, host_club_id')
        .eq('id', meetId).single()
      if (meetError || !meetData) { setError('Meet not found.'); setLoading(false); return }
      setMeet(meetData as Meet)

      const { data: standingsData } = await supabase.rpc('get_meet_standings', { p_meet_id: meetId })
      const { data: teamData } = await supabase.rpc('get_meet_team_standings', { p_meet_id: meetId })
      setGymnasts(standingsData || [])
      setTeams(teamData || [])
      setLoading(false)
    }
    if (meetId) load()
  }, [meetId])

  const isHost = meet !== null && userClubId !== null && userClubId === meet.host_club_id
  const dashboardPath = userRole === 'maga_admin' ? '/maga/dashboard' : '/club/dashboard'

  const ageGroups = Array.from(new Set(gymnasts.map(g => g.age_group))).sort()
  const divisions = Array.from(new Set([
    ...gymnasts.map(g => g.division_name),
    ...teams.map(t => t.division_name),
  ].filter(Boolean) as string[])).sort()
  const hasDivisions = divisions.length > 0

  const filteredGymnasts = gymnasts.filter(g =>
    (filterAgeGroup === 'all' || g.age_group === filterAgeGroup) &&
    (filterDivision === 'all' || g.division_name === filterDivision)
  )

  const filteredTeams = teams.filter(t =>
    filterDivision === 'all' || t.division_name === filterDivision
  )

  function ranked<T extends { all_around?: number | null; team_total?: number | null }>(items: T[]): (T & { rank: number })[] {
    const sorted = [...items].sort((a, b) => {
      const av = a.all_around ?? a.team_total ?? 0
      const bv = b.all_around ?? b.team_total ?? 0
      return bv - av
    })
    let rank = 1
    return sorted.map((item, i) => {
      if (i > 0) {
        const prev = sorted[i - 1]
        const prevScore = prev.all_around ?? prev.team_total ?? 0
        const currScore = item.all_around ?? item.team_total ?? 0
        if (currScore < prevScore) rank = i + 1
      }
      return { ...item, rank }
    })
  }

  function fmt(n: number | null, dnc?: boolean): string {
    if (dnc) return 'DNC'
    if (n === null) return '—'
    return n.toFixed(3)
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
  const noScores = gymnasts.length === 0

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
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12,marginBottom:4}}>
            <div>
              <h1 style={s.pageTitle}>Meet Standings</h1>
              <p style={s.pageSub}>{gymnasts.length} gymnasts scored · {teams.length} teams</p>
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
              {hasDivisions && (
                <select value={filterDivision} onChange={e=>setFilterDivision(e.target.value)} style={s.select}>
                  <option value="all">All divisions</option>
                  {divisions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              )}
              {view === 'individual' && (
                <select value={filterAgeGroup} onChange={e=>setFilterAgeGroup(e.target.value)} style={s.select}>
                  <option value="all">All age groups</option>
                  {ageGroups.map(ag => <option key={ag} value={ag}>{ag}</option>)}
                </select>
              )}
              <div style={s.segmented}>
                <button style={{...s.seg,...(view==='team'?s.segActive:{})}} onClick={()=>setView('team')}>Team</button>
                <button style={{...s.seg,...(view==='individual'?s.segActive:{})}} onClick={()=>setView('individual')}>Individual</button>
              </div>
            </div>
          </div>

          {noScores ? (
            <div style={s.emptyState}>
              <p style={{fontSize:15,fontWeight:600,color:'#374151',margin:'0 0 4px'}}>No scores entered yet</p>
              <p style={{fontSize:13,color:'#9ca3af',margin:'0 0 16px'}}>Standings will appear here once scores are entered.</p>
              {isHost && (
                <button style={s.goBtn} onClick={()=>router.push(`/meet/${meetId}/scores`)}>Go to Score Entry →</button>
              )}
            </div>
          ) : view === 'team' ? (
            <div style={s.card}>
              <div style={s.standingsHeader}>
                <span>Rank</span>
                <span>Team</span>
                {hasDivisions && <span>Division</span>}
                <span>Gymnasts</span>
                <span style={{textAlign:'right'}}>Team total</span>
              </div>
              {ranked(filteredTeams).map(team => (
                <div key={team.team_id} style={{...s.standingsRow, ...(team.rank === 1 ? s.goldRow : team.rank === 2 ? s.silverRow : team.rank === 3 ? s.bronzeRow : {})}}>
                  <span style={{...s.rankBadge, ...(team.rank <= 3 ? s.medalRank : {})}}>
                    {team.rank === 1 ? '🥇' : team.rank === 2 ? '🥈' : team.rank === 3 ? '🥉' : `#${team.rank}`}
                  </span>
                  <span style={{fontSize:14,fontWeight:500,color:'#111827'}}>{team.team_name}</span>
                  {hasDivisions && <span style={{fontSize:13,color:'#6b7280'}}>{team.division_name || '—'}</span>}
                  <span style={{fontSize:13,color:'#6b7280'}}>{team.gymnast_count}</span>
                  <span style={{fontSize:16,fontWeight:700,color:'#111827',textAlign:'right'}}>
                    {team.team_total !== null ? team.team_total.toFixed(3) : '—'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={s.card}>
              <div style={{...s.standingsHeader, gridTemplateColumns:'48px 2fr 1fr 1fr 1fr 1fr 1fr 100px'}}>
                <span>Rank</span>
                <span>Gymnast</span>
                <span>Vault</span>
                <span>Bars</span>
                <span>Beam</span>
                <span>Floor</span>
                <span>Age group</span>
                <span style={{textAlign:'right'}}>All-around</span>
              </div>
              {ranked(filteredGymnasts).map(g => (
                <div key={g.gymnast_id} style={{...s.standingsRow, gridTemplateColumns:'48px 2fr 1fr 1fr 1fr 1fr 1fr 100px', ...(g.rank === 1 ? s.goldRow : g.rank === 2 ? s.silverRow : g.rank === 3 ? s.bronzeRow : {})}}>
                  <span style={{...s.rankBadge, ...(g.rank <= 3 ? s.medalRank : {})}}>
                    {g.rank === 1 ? '🥇' : g.rank === 2 ? '🥈' : g.rank === 3 ? '🥉' : `#${g.rank}`}
                  </span>
                  <div>
                    <div style={{fontSize:14,fontWeight:500,color:'#111827'}}>{g.gymnast_first_name} {g.gymnast_last_name}</div>
                    <div style={{fontSize:11,color:'#9ca3af'}}>{g.team_name}</div>
                  </div>
                  <span style={{fontSize:13,color:'#374151'}}>{fmt(g.vault, g.vault_dnc)}</span>
                  <span style={{fontSize:13,color:'#374151'}}>{fmt(g.bars, g.bars_dnc)}</span>
                  <span style={{fontSize:13,color:'#374151'}}>{fmt(g.beam, g.beam_dnc)}</span>
                  <span style={{fontSize:13,color:'#374151'}}>{fmt(g.floor, g.floor_dnc)}</span>
                  <span style={{fontSize:13,color:'#6b7280'}}>{g.age_group}</span>
                  <span style={{fontSize:15,fontWeight:700,color:'#111827',textAlign:'right'}}>
                    {g.all_around !== null ? g.all_around.toFixed(3) : '—'}
                  </span>
                </div>
              ))}
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
  segmented:    {display:'flex',border:'1px solid #e5e7eb',borderRadius:8,overflow:'hidden'},
  seg:          {background:'none',border:'none',padding:'7px 14px',fontSize:13,color:'#6b7280',cursor:'pointer'},
  segActive:    {backgroundColor:'#111827',color:'#fff',fontWeight:500},
  card:         {backgroundColor:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:20,overflowX:'auto'},
  standingsHeader:{display:'grid',gridTemplateColumns:'48px 2fr 1fr 1fr 100px',gap:12,padding:'6px 8px',fontSize:11,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4,minWidth:500},
  standingsRow: {display:'grid',gridTemplateColumns:'48px 2fr 1fr 1fr 100px',gap:12,padding:'12px 8px',borderRadius:8,alignItems:'center',borderBottom:'1px solid #f3f4f6',minWidth:500},
  rankBadge:    {fontSize:13,fontWeight:600,color:'#6b7280'},
  medalRank:    {fontSize:18},
  goldRow:      {backgroundColor:'#fffbeb'},
  silverRow:    {backgroundColor:'#f8fafc'},
  bronzeRow:    {backgroundColor:'#fff7f0'},
  emptyState:   {backgroundColor:'#fff',border:'1px dashed #e5e7eb',borderRadius:12,padding:'48px 24px',textAlign:'center'},
  goBtn:        {backgroundColor:'#111827',color:'#fff',border:'none',borderRadius:8,padding:'9px 18px',fontSize:13,fontWeight:500,cursor:'pointer'},
}
