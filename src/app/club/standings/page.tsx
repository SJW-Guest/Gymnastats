'use client'

// src/app/club/standings/page.tsx

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

interface StandingRow {
  team_id: string
  team_name: string
  meets_attended: number
  meets_counting: number
  best_meets_total: number | null
  qualifies_for_state: boolean | null
}

interface Season {
  id: string
  name: string
}

export default function ClubStandingsPage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [standings, setStandings] = useState<StandingRow[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedSeason, setSelectedSeason] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userClubId, setUserClubId] = useState<string | null>(null)
  const [clubName, setClubName] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: userData } = await supabase
        .from('users').select('full_name, role, club_id').eq('id', user.id).single()
      setUserName(userData?.full_name ?? null)
      setUserRole(userData?.role ?? null)
      setUserClubId(userData?.club_id ?? null)

      if (userData?.club_id) {
        const { data: clubData } = await supabase
          .from('clubs').select('name').eq('id', userData.club_id).single()
        setClubName(clubData?.name ?? null)
      }

      const { data: seasonData } = await supabase
        .from('seasons').select('id, name').order('start_date', { ascending: false }).limit(5)
      setSeasons(seasonData ?? [])
      if (seasonData && seasonData.length > 0) setSelectedSeason(seasonData[0].id)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    async function loadStandings() {
      if (!selectedSeason || !userClubId) return
      const { data: teamData } = await supabase
        .from('teams').select('id').eq('club_id', userClubId).eq('is_active', true)
      const teamIds = (teamData ?? []).map(t => t.id)
      if (teamIds.length === 0) { setStandings([]); return }

      const { data } = await supabase
        .from('season_team_standings')
        .select('team_id, meets_attended, meets_counting, best_meets_total, qualifies_for_state, teams(name)')
        .eq('season_id', selectedSeason)
        .in('team_id', teamIds)
        .order('best_meets_total', { ascending: false, nullsFirst: false })

      setStandings((data ?? []).map((row: any) => ({
        team_id: row.team_id,
        team_name: row.teams?.name ?? '—',
        meets_attended: row.meets_attended,
        meets_counting: row.meets_counting,
        best_meets_total: row.best_meets_total,
        qualifies_for_state: row.qualifies_for_state,
      })))
    }
    loadStandings()
  }, [selectedSeason, userClubId])

  const dashboardPath = userRole === 'maga_admin' ? '/maga/dashboard' : '/club/dashboard'

  if (loading) return (
    <div style={s.page}><div style={s.center}><div style={s.spinner}/></div></div>
  )

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <div style={s.topBarInner}>
          <div style={s.logo}>G</div>
          <span style={s.logoText}>Gymnastats</span>
          <div style={{flex:1}}/>
          {userName && <span style={s.userName}>{userName}</span>}
          <button onClick={()=>router.push(dashboardPath)} style={s.backBtn}>← Dashboard</button>
        </div>
      </div>

      <main style={s.main}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12,marginBottom:24}}>
          <div>
            <h1 style={s.pageTitle}>Season Standings</h1>
            <p style={s.pageSub}>{clubName ?? 'Your club'} · team rankings</p>
          </div>
          <select
            value={selectedSeason}
            onChange={e => setSelectedSeason(e.target.value)}
            style={s.select}
          >
            {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {standings.length === 0 ? (
          <div style={s.emptyState}>
            <p style={{fontSize:15,fontWeight:600,color:'#374151',margin:'0 0 4px'}}>No standings yet</p>
            <p style={{fontSize:13,color:'#9ca3af',margin:0}}>
              Standings appear after your teams compete in finalized meets.
            </p>
          </div>
        ) : (
          <div style={s.card}>
            <div style={s.tableHeader}>
              <span>Rank</span>
              <span>Team</span>
              <span style={{textAlign:'center'}}>Meets attended</span>
              <span style={{textAlign:'center'}}>Meets counting</span>
              <span style={{textAlign:'right'}}>Best meets total</span>
              <span style={{textAlign:'center'}}>State qualifier</span>
            </div>
            {standings.map((row, i) => (
              <div key={row.team_id} style={{...s.tableRow, ...(i === 0 ? s.goldRow : i === 1 ? s.silverRow : i === 2 ? s.bronzeRow : {})}}>
                <span style={{...s.rankBadge, ...(i < 3 ? s.medalRank : {})}}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </span>
                <span style={{fontSize:14,fontWeight:500,color:'#111827'}}>{row.team_name}</span>
                <span style={{fontSize:13,color:'#6b7280',textAlign:'center'}}>{row.meets_attended}</span>
                <span style={{fontSize:13,color:'#6b7280',textAlign:'center'}}>{row.meets_counting}</span>
                <span style={{fontSize:16,fontWeight:700,color:'#111827',textAlign:'right'}}>
                  {row.best_meets_total !== null ? Number(row.best_meets_total).toFixed(3) : '—'}
                </span>
                <span style={{textAlign:'center'}}>
                  {row.qualifies_for_state === true ? (
                    <span style={{...s.badge, backgroundColor:'#dcfce7', color:'#16a34a'}}>Yes</span>
                  ) : row.qualifies_for_state === false ? (
                    <span style={{...s.badge, backgroundColor:'#f3f4f6', color:'#6b7280'}}>No</span>
                  ) : (
                    <span style={{fontSize:13,color:'#9ca3af'}}>—</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page:       {minHeight:'100vh',backgroundColor:'#f8f9fa',fontFamily:"'DM Sans', sans-serif"},
  center:     {display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'},
  spinner:    {width:28,height:28,border:'3px solid #e5e7eb',borderTopColor:'#111827',borderRadius:'50%',animation:'spin 0.8s linear infinite'},
  topBar:     {backgroundColor:'#111827',padding:'0 24px'},
  topBarInner:{maxWidth:1200,margin:'0 auto',height:52,display:'flex',alignItems:'center',gap:10},
  logo:       {width:28,height:28,borderRadius:6,backgroundColor:'#fff',color:'#111827',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14},
  logoText:   {color:'#fff',fontWeight:600,fontSize:15},
  userName:   {color:'#9ca3af',fontSize:13,marginRight:4},
  backBtn:    {marginLeft:4,background:'none',border:'1px solid #374151',borderRadius:6,color:'#9ca3af',padding:'5px 12px',fontSize:13,cursor:'pointer'},
  main:       {maxWidth:1000,margin:'0 auto',padding:'32px 24px'},
  pageTitle:  {fontSize:22,fontWeight:700,color:'#111827',margin:'0 0 2px',letterSpacing:'-0.3px'},
  pageSub:    {fontSize:13,color:'#6b7280',margin:0},
  select:     {border:'1px solid #e5e7eb',borderRadius:8,padding:'7px 12px',fontSize:13,color:'#374151',backgroundColor:'#fff',cursor:'pointer'},
  card:       {backgroundColor:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:20,overflowX:'auto'},
  tableHeader:{display:'grid',gridTemplateColumns:'56px 2fr 1fr 1fr 140px 120px',gap:12,padding:'6px 8px',fontSize:11,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4,minWidth:560},
  tableRow:   {display:'grid',gridTemplateColumns:'56px 2fr 1fr 1fr 140px 120px',gap:12,padding:'12px 8px',borderRadius:8,alignItems:'center',borderBottom:'1px solid #f3f4f6',minWidth:560},
  rankBadge:  {fontSize:13,fontWeight:600,color:'#6b7280'},
  medalRank:  {fontSize:18},
  goldRow:    {backgroundColor:'#fffbeb'},
  silverRow:  {backgroundColor:'#f8fafc'},
  bronzeRow:  {backgroundColor:'#fff7f0'},
  badge:      {display:'inline-block',borderRadius:99,padding:'3px 10px',fontSize:12,fontWeight:600},
  emptyState: {backgroundColor:'#fff',border:'1px dashed #e5e7eb',borderRadius:12,padding:'48px 24px',textAlign:'center'},
}
