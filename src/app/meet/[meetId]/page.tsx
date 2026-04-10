'use client'

// src/app/meet/[meetId]/page.tsx

import { useState, useEffect } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

interface Meet {
  id: string; name: string; meet_date: string; location: string | null; status: string
  lineup_due_date: string | null; num_judges: number | null; counts_for_state: boolean | null
  results_visibility: string; host_club_id: string
  clubs: { name: string; city: string | null; state: string | null } | { name: string; city: string | null; state: string | null }[]
}

interface MeetTeam {
  id: string; status: string; division_id: string | null; confirmed_at: string | null
  teams: { id: string; name: string; clubs: { name: string } | { name: string }[] } | { id: string; name: string; clubs: { name: string } | { name: string }[] }[]
  meet_divisions: { name: string } | { name: string }[] | null
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  setup:     { bg: '#fef3c7', color: '#d97706' },
  active:    { bg: '#dbeafe', color: '#1d4ed8' },
  finalized: { bg: '#dcfce7', color: '#16a34a' },
  suspended: { bg: '#fee2e2', color: '#dc2626' },
}

const TEAM_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  invited:   { bg: '#fef3c7', color: '#d97706' },
  confirmed: { bg: '#dcfce7', color: '#16a34a' },
  declined:  { bg: '#fee2e2', color: '#dc2626' },
  pending:   { bg: '#f3f4f6', color: '#6b7280' },
}

const NAV_ITEMS = [
  { key: 'overview',  label: 'Meet Overview',  suffix: '' },
  { key: 'lineup',    label: 'Lineup Manager', suffix: '/lineup' },
  { key: 'scores',    label: 'Score Entry',    suffix: '/scores' },
  { key: 'standings', label: 'Meet Standings', suffix: '/standings' },
]

function getTeamName(mt: MeetTeam): string {
  const t = Array.isArray(mt.teams) ? mt.teams[0] : mt.teams
  return t?.name || '—'
}
function getClubName(mt: MeetTeam): string {
  const t = Array.isArray(mt.teams) ? mt.teams[0] : mt.teams
  if (!t) return '—'
  const c = Array.isArray(t.clubs) ? t.clubs[0] : t.clubs
  return c?.name || '—'
}
function getDivisionName(mt: MeetTeam): string {
  const d = Array.isArray(mt.meet_divisions) ? mt.meet_divisions[0] : mt.meet_divisions
  return d?.name || '—'
}
function getHostClubName(meet: Meet): string {
  const c = Array.isArray(meet.clubs) ? meet.clubs[0] : meet.clubs
  return c?.name || '—'
}

export default function MeetDetailPage() {
  const { meetId } = useParams<{ meetId: string }>()
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [meet, setMeet] = useState<Meet | null>(null)
  const [meetTeams, setMeetTeams] = useState<MeetTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', meet_date: '', location: '', results_visibility: '' })

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: meetData, error: meetError } = await supabase
        .from('meets').select('*, clubs (name, city, state)').eq('id', meetId).single()
      if (meetError || !meetData) { setError('Meet not found.'); setLoading(false); return }
      setMeet(meetData as unknown as Meet)
      setEditForm({ name: meetData.name, meet_date: meetData.meet_date, location: meetData.location || '', results_visibility: meetData.results_visibility })
      const { data: teamsData } = await supabase
        .from('meet_teams')
        .select('id, status, division_id, confirmed_at, teams (id, name, clubs (name)), meet_divisions (name)')
        .eq('meet_id', meetId).order('status')
      setMeetTeams((teamsData as unknown as MeetTeam[]) || [])
      setLoading(false)
    }
    if (meetId) load()
  }, [meetId])

  async function handleSaveEdit() {
    if (!meet) return
    setSaving(true)
    const { error: updateError } = await supabase.from('meets').update({
      name: editForm.name.trim(), meet_date: editForm.meet_date,
      location: editForm.location.trim() || null, results_visibility: editForm.results_visibility,
    }).eq('id', meetId)
    if (updateError) { alert('Failed to save. Please try again.'); setSaving(false); return }
    setMeet(prev => prev ? { ...prev, ...editForm, location: editForm.location || null } : prev)
    setEditing(false); setSaving(false)
  }

  if (loading) return <div style={s.page}><div style={s.center}><div style={s.spinner}/></div></div>
  if (error || !meet) return <div style={s.page}><div style={s.center}><p style={{color:'#dc2626'}}>{error||'Meet not found.'}</p><button onClick={()=>router.back()} style={s.linkBtn}>← Go back</button></div></div>

  const sc = STATUS_COLORS[meet.status] || STATUS_COLORS.setup
  const confirmed = meetTeams.filter(t => t.status === 'confirmed').length
  const declined  = meetTeams.filter(t => t.status === 'declined').length
  const fmtDate = (d: string) => new Date(d+'T00:00:00').toLocaleDateString('en-US',{weekday:'short',month:'long',day:'numeric',year:'numeric'})
  const lineupDue = meet.lineup_due_date ? new Date(meet.lineup_due_date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : null
  const lineupOverdue = meet.lineup_due_date && new Date(meet.lineup_due_date+'T00:00:00') < new Date() && confirmed > 0

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

          <div style={{marginTop:24,paddingTop:24,borderTop:'1px solid #e5e7eb',display:'flex',flexDirection:'column',gap:8}}>
            <button style={s.sidebarBtn} onClick={()=>setEditing(true)}>✏️ Edit meet details</button>
            <button style={s.sidebarBtn} onClick={()=>router.push(`/meet/new?meetId=${meetId}`)}>👥 Edit teams & divisions</button>
          </div>
        </aside>

        <main style={s.main}>
          {editing && (
            <div style={s.overlay}>
              <div style={s.modal}>
                <h2 style={s.modalTitle}>Edit meet details</h2>
                <div style={s.field}><label style={s.label}>Meet Name</label>
                  <input style={s.input} value={editForm.name} onChange={e=>setEditForm(p=>({...p,name:e.target.value}))}/></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
                  <div><label style={s.label}>Meet Date</label>
                    <input type="date" style={s.input} value={editForm.meet_date} onChange={e=>setEditForm(p=>({...p,meet_date:e.target.value}))}/></div>
                  <div><label style={s.label}>Location</label>
                    <input style={s.input} value={editForm.location} placeholder="City, State" onChange={e=>setEditForm(p=>({...p,location:e.target.value}))}/></div>
                </div>
                <div style={s.field}><label style={s.label}>Results Visibility</label>
                  <select style={s.input} value={editForm.results_visibility} onChange={e=>setEditForm(p=>({...p,results_visibility:e.target.value}))}>
                    <option value="after_finalized">After Finalized</option>
                    <option value="live">Live</option>
                  </select></div>
                <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:8}}>
                  <button style={s.cancelBtn} onClick={()=>setEditing(false)}>Cancel</button>
                  <button style={s.saveBtn} onClick={handleSaveEdit} disabled={saving}>{saving?'Saving...':'Save changes'}</button>
                </div>
              </div>
            </div>
          )}

          {lineupOverdue && (
            <div style={s.warning}>⚠️ Lineup due date ({lineupDue}) has passed — {confirmed} confirmed team{confirmed!==1?'s':''} still need to submit lineups.</div>
          )}

          <div style={s.statsRow}>
            {[
              {val:meetTeams.length,label:'Teams invited'},
              {val:confirmed,label:'Confirmed',color:confirmed>0?'#16a34a':undefined},
              {val:declined,label:'Declined',color:declined>0?'#dc2626':undefined},
              {val:meet.num_judges??'—',label:'Judges'},
              ...(lineupDue?[{val:lineupDue,label:'Lineup due',small:true}]:[]),
            ].map((item,i)=>(
              <div key={i} style={s.statCard}>
                <p style={{...s.statNum,...(item.color?{color:item.color}:{}),...((item as {small?:boolean}).small?{fontSize:15}:{})}}>{item.val}</p>
                <p style={s.statLabel}>{item.label}</p>
              </div>
            ))}
          </div>

          <div style={s.card}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <h2 style={s.cardTitle}>Teams</h2>
              <button style={s.linkBtn} onClick={()=>router.push(`/meet/new?meetId=${meetId}`)}>+ Manage teams</button>
            </div>
            {meetTeams.length===0 ? (
              <p style={{textAlign:'center',color:'#9ca3af',fontSize:14,padding:'24px 0'}}>No teams added yet.</p>
            ) : (
              <>
                <div style={s.tableHeader}><span>Team</span><span>Club</span><span>Division</span><span>Status</span></div>
                {meetTeams.map(mt=>{
                  const ts = TEAM_STATUS_COLORS[mt.status]||TEAM_STATUS_COLORS.pending
                  return (
                    <div key={mt.id} style={s.tableRow}>
                      <span style={{fontSize:14,fontWeight:500,color:'#111827'}}>{getTeamName(mt)}</span>
                      <span style={{fontSize:13,color:'#6b7280'}}>{getClubName(mt)}</span>
                      <span style={{fontSize:13,color:'#6b7280'}}>{getDivisionName(mt)}</span>
                      <span style={{...s.badge,backgroundColor:ts.bg,color:ts.color}}>{mt.status}</span>
                    </div>
                  )
                })}
              </>
            )}
          </div>

          <div style={s.card}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <h2 style={s.cardTitle}>Meet details</h2>
              <button style={s.linkBtn} onClick={()=>setEditing(true)}>Edit</button>
            </div>
            <div style={s.detailGrid}>
              {[
                ['Date', fmtDate(meet.meet_date)],
                ['Location', meet.location||'—'],
                ['Status', meet.status],
                ['Judges', meet.num_judges??'—'],
                ['Results visibility', meet.results_visibility],
                ['Counts for state', meet.counts_for_state?'Yes':'No'],
                ['Hosted by', getHostClubName(meet)],
                ...(lineupDue?[['Lineup due',lineupDue]]:[]),
              ].map(([label,value])=>(
                <div key={label as string}>
                  <p style={s.detailLabel}>{label}</p>
                  <p style={s.detailValue}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

const s: Record<string,React.CSSProperties> = {
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
  warning:      {backgroundColor:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,padding:'12px 16px',fontSize:14,color:'#dc2626'},
  statsRow:     {display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(110px, 1fr))',gap:12},
  statCard:     {backgroundColor:'#fff',border:'1px solid #e5e7eb',borderRadius:10,padding:16,textAlign:'center'},
  statNum:      {fontSize:24,fontWeight:700,color:'#111827',margin:'0 0 4px'},
  statLabel:    {fontSize:12,color:'#6b7280',margin:0},
  card:         {backgroundColor:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:20},
  cardTitle:    {fontSize:16,fontWeight:600,color:'#111827',margin:0},
  tableHeader:  {display:'grid',gridTemplateColumns:'2fr 2fr 1.5fr 1fr',gap:12,padding:'8px 12px',fontSize:11,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.05em'},
  tableRow:     {display:'grid',gridTemplateColumns:'2fr 2fr 1.5fr 1fr',gap:12,padding:'12px',borderRadius:8,alignItems:'center',backgroundColor:'#fafafa',marginBottom:2},
  detailGrid:   {display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))',gap:16},
  detailLabel:  {fontSize:11,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.05em',margin:'0 0 4px'},
  detailValue:  {fontSize:14,color:'#111827',margin:0,fontWeight:500},
  overlay:      {position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50},
  modal:        {backgroundColor:'#fff',borderRadius:12,padding:28,width:'100%',maxWidth:480},
  modalTitle:   {fontSize:18,fontWeight:600,color:'#111827',margin:'0 0 20px'},
  field:        {marginBottom:16},
  label:        {display:'block',fontSize:13,fontWeight:500,color:'#374151',marginBottom:6},
  input:        {width:'100%',border:'1.5px solid #e5e7eb',borderRadius:8,padding:'9px 12px',fontSize:14,color:'#111827',outline:'none',boxSizing:'border-box',backgroundColor:'#fff'},
  cancelBtn:    {background:'none',border:'1px solid #e5e7eb',borderRadius:8,padding:'8px 16px',fontSize:14,color:'#374151',cursor:'pointer'},
  saveBtn:      {backgroundColor:'#111827',color:'#fff',border:'none',borderRadius:8,padding:'8px 20px',fontSize:14,fontWeight:500,cursor:'pointer'},
}
