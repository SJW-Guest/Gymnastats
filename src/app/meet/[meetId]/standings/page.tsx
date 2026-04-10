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
  vault: number | null;  vault_dnc: boolean
  bars: number | null;   bars_dnc: boolean
  beam: number | null;   beam_dnc: boolean
  floor: number | null;  floor_dnc: boolean
  all_around: number | null
}

interface TeamStanding {
  team_id: string
  team_name: string
  division_name: string | null
  gymnast_count: number
  vault_top4: number | null
  bars_top4: number | null
  beam_top4: number | null
  floor_top4: number | null
  team_total: number | null
}

type Tab = 'team' | 'allaround' | 'events'
type Event = 'vault' | 'bars' | 'beam' | 'floor'
const EVENTS: Event[] = ['vault', 'bars', 'beam', 'floor']
const EVENT_LABELS: Record<Event, string> = { vault: 'Vault', bars: 'Bars', beam: 'Beam', floor: 'Floor' }
const EVENT_COLORS: Record<Event, string> = { vault: '#1d4ed8', bars: '#b45309', beam: '#065f46', floor: '#7c3aed' }

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

const AGE_GROUP_ORDER = ['Novice', 'Children', 'Junior', 'Senior']

function fmt(n: number | null | undefined, dnc?: boolean): string {
  if (dnc) return 'DNC'
  if (n === null || n === undefined) return '—'
  return Number(n).toFixed(3)
}

function ranked<T extends Record<string, any>>(items: T[], key: string): (T & { rank: number })[] {
  const sorted = [...items].filter(i => i[key] != null).sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))
  let rank = 1
  return sorted.map((item, i) => {
    if (i > 0 && (item[key] ?? 0) < (sorted[i-1][key] ?? 0)) rank = i + 1
    return { ...item, rank }
  })
}

function getDncForEvent(g: GymnastStanding, ev: Event): boolean {
  return g[`${ev}_dnc` as keyof GymnastStanding] as boolean || false
}

function Medal({ rank }: { rank: number }) {
  if (rank === 1) return <span style={{fontSize:18}}>🥇</span>
  if (rank === 2) return <span style={{fontSize:18}}>🥈</span>
  if (rank === 3) return <span style={{fontSize:18}}>🥉</span>
  return <span style={{fontSize:13,fontWeight:600,color:'#6b7280'}}>#{rank}</span>
}

// Division header bar
function DivisionHeader({ name }: { name: string }) {
  return (
    <div style={{padding:'8px 16px',backgroundColor:'#111827',borderRadius:'10px 10px 0 0',marginBottom:0}}>
      <span style={{fontSize:12,fontWeight:700,color:'#fff',textTransform:'uppercase',letterSpacing:'0.08em'}}>
        {name} Division
      </span>
    </div>
  )
}

// Age group sub-header
function AgeGroupHeader({ label }: { label: string }) {
  return (
    <div style={{padding:'5px 12px',backgroundColor:'#f3f4f6',borderBottom:'1px solid #e5e7eb'}}>
      <span style={{fontSize:11,fontWeight:600,color:'#374151',textTransform:'uppercase',letterSpacing:'0.05em'}}>{label}</span>
    </div>
  )
}

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
  const [tab, setTab] = useState<Tab>('team')
  const [activeEvent, setActiveEvent] = useState<Event>('vault')

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

  // All unique divisions in order they appear, null = no division
  const hasDivisions = gymnasts.some(g => g.division_name) || teams.some(t => t.division_name)
  const divisions = hasDivisions
    ? Array.from(new Set([
        ...teams.map(t => t.division_name),
        ...gymnasts.map(g => g.division_name),
      ].filter(Boolean) as string[])).sort()
    : [null]

  const ageGroups = AGE_GROUP_ORDER.filter(ag => gymnasts.some(g => g.age_group === ag))

  if (loading) return <div style={s.page}><div style={s.center}><div style={s.spinner}/></div></div>
  if (error || !meet) return (
    <div style={s.page}><div style={s.center}>
      <p style={{color:'#dc2626'}}>{error||'Meet not found.'}</p>
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
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12,marginBottom:4}}>
            <div>
              <h1 style={s.pageTitle}>Meet Standings</h1>
              <p style={s.pageSub}>{gymnasts.length} gymnasts scored · {teams.length} teams{hasDivisions ? ` · ${divisions.length} divisions` : ''}</p>
            </div>
          </div>

          {/* Tab bar */}
          <div style={{display:'flex',gap:0,borderRadius:10,overflow:'hidden',border:'1px solid #e5e7eb',width:'fit-content',marginBottom:8}}>
            {([
              { key:'team',      label:'Team' },
              { key:'allaround', label:'All-Around' },
              { key:'events',    label:'Events' },
            ] as {key:Tab,label:string}[]).map(t => (
              <button key={t.key} onClick={()=>setTab(t.key)}
                style={{padding:'9px 20px',border:'none',
                  background:tab===t.key?'#111827':'#fff',
                  fontSize:14,fontWeight:500,
                  color:tab===t.key?'#fff':'#6b7280',cursor:'pointer'}}>
                {t.label}
              </button>
            ))}
          </div>

          {noScores ? (
            <div style={s.emptyState}>
              <p style={{fontSize:15,fontWeight:600,color:'#374151',margin:'0 0 4px'}}>No scores entered yet</p>
              <p style={{fontSize:13,color:'#9ca3af',margin:'0 0 16px'}}>Standings will appear here once scores are entered.</p>
              {isHost && <button style={s.goBtn} onClick={()=>router.push(`/meet/${meetId}/scores`)}>Go to Score Entry →</button>}
            </div>

          ) : tab === 'team' ? (
            // ── TEAM TAB: Division → ranked teams ───────────────────────
            <div style={{display:'flex',flexDirection:'column',gap:20}}>
              {divisions.map(div => {
                const divTeams = ranked(
                  teams.filter(t => div === null ? !t.division_name : t.division_name === div),
                  'team_total'
                )
                if (divTeams.length === 0) return null
                return (
                  <div key={div??'nodiv'}>
                    {hasDivisions && div && <DivisionHeader name={div} />}
                    <div style={{border:'1px solid #e5e7eb',borderTop: hasDivisions && div ? 'none' : '1px solid #e5e7eb',borderRadius: hasDivisions && div ? '0 0 10px 10px' : 10,overflow:'hidden',backgroundColor:'#fff'}}>
                      <div style={{display:'grid',gridTemplateColumns:'48px 2fr 80px 80px 80px 80px 110px',gap:8,padding:'6px 12px',fontSize:11,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.05em',borderBottom:'1px solid #f3f4f6'}}>
                        <span>Rank</span><span>Team</span>
                        <span style={{textAlign:'right',color:EVENT_COLORS.vault}}>Vault</span>
                        <span style={{textAlign:'right',color:EVENT_COLORS.bars}}>Bars</span>
                        <span style={{textAlign:'right',color:EVENT_COLORS.beam}}>Beam</span>
                        <span style={{textAlign:'right',color:EVENT_COLORS.floor}}>Floor</span>
                        <span style={{textAlign:'right'}}>Total</span>
                      </div>
                      <div style={{fontSize:10,color:'#9ca3af',padding:'4px 12px 6px',borderBottom:'1px solid #f3f4f6'}}>Top 4 scores per event</div>
                      {divTeams.map(team => (
                        <div key={team.team_id} style={{
                          display:'grid',gridTemplateColumns:'48px 2fr 80px 80px 80px 80px 110px',
                          gap:8,padding:'12px',alignItems:'center',
                          borderBottom:'1px solid #f3f4f6',
                          backgroundColor:team.rank===1?'#fffbeb':team.rank===2?'#f8fafc':team.rank===3?'#fff7f0':'#fff',
                        }}>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'center'}}><Medal rank={team.rank}/></div>
                          <div>
                            <div style={{fontSize:14,fontWeight:500,color:'#111827'}}>{team.team_name}</div>
                            <div style={{fontSize:11,color:'#9ca3af'}}>{team.gymnast_count} gymnasts</div>
                          </div>
                          <div style={{textAlign:'right',fontSize:13,color:EVENT_COLORS.vault}}>{fmt(team.vault_top4)}</div>
                          <div style={{textAlign:'right',fontSize:13,color:EVENT_COLORS.bars}}>{fmt(team.bars_top4)}</div>
                          <div style={{textAlign:'right',fontSize:13,color:EVENT_COLORS.beam}}>{fmt(team.beam_top4)}</div>
                          <div style={{textAlign:'right',fontSize:13,color:EVENT_COLORS.floor}}>{fmt(team.floor_top4)}</div>
                          <div style={{textAlign:'right',fontSize:16,fontWeight:700,color:'#111827'}}>{fmt(team.team_total)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

          ) : tab === 'allaround' ? (
            // ── ALL-AROUND TAB: Division → Age Group → gymnasts by AA ────
            <div style={{display:'flex',flexDirection:'column',gap:20}}>
              {divisions.map(div => {
                const divGymnasts = gymnasts.filter(g => div === null ? !g.division_name : g.division_name === div)
                const divAgeGroups = AGE_GROUP_ORDER.filter(ag => divGymnasts.some(g => g.age_group === ag))
                if (divGymnasts.length === 0) return null
                return (
                  <div key={div??'nodiv'}>
                    {hasDivisions && div && <DivisionHeader name={div} />}
                    <div style={{border:'1px solid #e5e7eb',borderTop: hasDivisions && div ? 'none' : '1px solid #e5e7eb',borderRadius: hasDivisions && div ? '0 0 10px 10px' : 10,overflow:'hidden'}}>
                      {divAgeGroups.map((ag, agi) => {
                        const agGymnasts = ranked(divGymnasts.filter(g => g.age_group === ag), 'all_around')
                        if (agGymnasts.length === 0) return null
                        return (
                          <div key={ag}>
                            <AgeGroupHeader label={ag} />
                            {agGymnasts.map((g, i) => (
                              <div key={g.gymnast_id} style={{
                                display:'grid',gridTemplateColumns:'48px 2fr 80px 80px 80px 80px 100px',
                                gap:8,padding:'10px 12px',alignItems:'center',
                                borderBottom: i < agGymnasts.length-1 || agi < divAgeGroups.length-1 ? '1px solid #f3f4f6' : 'none',
                                backgroundColor:g.rank===1?'#fffbeb':g.rank===2?'#f8fafc':g.rank===3?'#fff7f0':'#fff',
                              }}>
                                <div style={{display:'flex',alignItems:'center',justifyContent:'center'}}><Medal rank={g.rank}/></div>
                                <div>
                                  <div style={{fontSize:14,fontWeight:500,color:'#111827'}}>{g.gymnast_first_name} {g.gymnast_last_name}</div>
                                  <div style={{fontSize:11,color:'#9ca3af'}}>{g.team_name}</div>
                                </div>
                                <div style={{textAlign:'right',fontSize:13,color:EVENT_COLORS.vault}}>{fmt(g.vault,g.vault_dnc)}</div>
                                <div style={{textAlign:'right',fontSize:13,color:EVENT_COLORS.bars}}>{fmt(g.bars,g.bars_dnc)}</div>
                                <div style={{textAlign:'right',fontSize:13,color:EVENT_COLORS.beam}}>{fmt(g.beam,g.beam_dnc)}</div>
                                <div style={{textAlign:'right',fontSize:13,color:EVENT_COLORS.floor}}>{fmt(g.floor,g.floor_dnc)}</div>
                                <div style={{textAlign:'right',fontSize:15,fontWeight:700,color:'#111827'}}>{fmt(g.all_around)}</div>
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

          ) : (
            // ── EVENTS TAB: event pills → Division → Age Group → gymnasts ─
            <div>
              <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>
                {EVENTS.map(ev => (
                  <button key={ev} onClick={()=>setActiveEvent(ev)}
                    style={{padding:'7px 16px',borderRadius:99,
                      border:`1.5px solid ${activeEvent===ev?EVENT_COLORS[ev]:'#e5e7eb'}`,
                      background:activeEvent===ev?EVENT_COLORS[ev]:'#fff',
                      fontSize:13,fontWeight:600,
                      color:activeEvent===ev?'#fff':EVENT_COLORS[ev],cursor:'pointer'}}>
                    {EVENT_LABELS[ev]}
                  </button>
                ))}
              </div>

              <div style={{display:'flex',flexDirection:'column',gap:20}}>
                {divisions.map(div => {
                  const divGymnasts = gymnasts.filter(g => div === null ? !g.division_name : g.division_name === div)
                  const divAgeGroups = AGE_GROUP_ORDER.filter(ag => divGymnasts.some(g => g.age_group === ag))
                  if (divGymnasts.length === 0) return null
                  return (
                    <div key={div??'nodiv'}>
                      {hasDivisions && div && <DivisionHeader name={div} />}
                      <div style={{border:'1px solid #e5e7eb',borderTop: hasDivisions && div ? 'none' : '1px solid #e5e7eb',borderRadius: hasDivisions && div ? '0 0 10px 10px' : 10,overflow:'hidden'}}>
                        {divAgeGroups.map((ag, agi) => {
                          const evScore = (g: GymnastStanding) => getDncForEvent(g, activeEvent) ? null : g[activeEvent]
                          const agAll = divGymnasts.filter(g => g.age_group === ag)
                          const agScored = ranked(agAll.filter(g => evScore(g) !== null), 'all_around').map(g => ({
                            ...g,
                            _evScore: evScore(g),
                            _rank: 0,
                          }))
                          // re-rank by event score
                          const agRanked = ranked(agAll.filter(g => evScore(g) !== null).map(g => ({...g, _evScore: evScore(g)})), '_evScore')
                          const agDnc = agAll.filter(g => getDncForEvent(g, activeEvent))
                          if (agRanked.length === 0 && agDnc.length === 0) return null
                          return (
                            <div key={ag}>
                              <AgeGroupHeader label={ag} />
                              {agRanked.map((g, i) => (
                                <div key={g.gymnast_id} style={{
                                  display:'grid',gridTemplateColumns:'48px 2fr 100px',
                                  gap:8,padding:'10px 12px',alignItems:'center',
                                  borderBottom:'1px solid #f3f4f6',
                                  backgroundColor:g.rank===1?'#fffbeb':g.rank===2?'#f8fafc':g.rank===3?'#fff7f0':'#fff',
                                }}>
                                  <div style={{display:'flex',alignItems:'center',justifyContent:'center'}}><Medal rank={g.rank}/></div>
                                  <div>
                                    <div style={{fontSize:14,fontWeight:500,color:'#111827'}}>{g.gymnast_first_name} {g.gymnast_last_name}</div>
                                    <div style={{fontSize:11,color:'#9ca3af'}}>{g.team_name}</div>
                                  </div>
                                  <div style={{textAlign:'right',fontSize:16,fontWeight:700,color:EVENT_COLORS[activeEvent]}}>{fmt(g._evScore as number)}</div>
                                </div>
                              ))}
                              {agDnc.map(g => (
                                <div key={g.gymnast_id} style={{display:'grid',gridTemplateColumns:'48px 2fr 100px',gap:8,padding:'10px 12px',alignItems:'center',borderBottom:'1px solid #f3f4f6',backgroundColor:'#fafafa'}}>
                                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,color:'#9ca3af'}}>—</div>
                                  <div>
                                    <div style={{fontSize:14,fontWeight:500,color:'#9ca3af'}}>{g.gymnast_first_name} {g.gymnast_last_name}</div>
                                    <div style={{fontSize:11,color:'#9ca3af'}}>{g.team_name}</div>
                                  </div>
                                  <div style={{textAlign:'right',fontSize:13,fontWeight:600,color:'#dc2626'}}>DNC</div>
                                </div>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
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
  emptyState:   {backgroundColor:'#fff',border:'1px dashed #e5e7eb',borderRadius:12,padding:'48px 24px',textAlign:'center'},
  goBtn:        {backgroundColor:'#111827',color:'#fff',border:'none',borderRadius:8,padding:'9px 18px',fontSize:13,fontWeight:500,cursor:'pointer'},
}
