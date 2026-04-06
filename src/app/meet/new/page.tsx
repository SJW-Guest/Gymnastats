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
  const [form, setForm] = useState({ name:'', meet_date:'', location:'', host_club_id:'', season_id:'', results_visibility:'after_finalized', num_judges:1 })
  const [selectedTeams, setSelectedTeams] = useState([])
  const [useDivisions, setUseDivisions] = useState(true)
  const [divisions, setDivisions] = useState([{name:'Upper',teams:[]},{name:'Lower',teams:[]}])
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
      if (c?.length > 0) setForm(f => ({...f, host_club_id: c[0].id}))
      if (s?.length > 0) setForm(f => ({...f, season_id: s[0].id}))
      setLoading(false)
    }
    load()
  }, [])
  async function createMeet(e) {
    e.preventDefault(); setSaving(true)
    const { createBrowserClient } = await import('@supabase/ssr')
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { data, error } = await supabase.from('meets').insert({ name:form.name, meet_date:form.meet_date, location:form.location, host_club_id:form.host_club_id, season_id:form.season_id, results_visibility:form.results_visibility, num_judges:form.num_judges, status:'setup' }).select('id').single()
    if (!error && data) { setMeetId(data.id); setStep(2) }
    setSaving(false)
  }
  async function saveTeamsAndDivisions() {
    setSaving(true)
    const { createBrowserClient } = await import('@supabase/ssr')
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    if (selectedTeams.length > 0) {
      const rows = selectedTeams.map(teamId => {
        let divGroup = null
        if (useDivisions) { for (const div of divi


exite
exit
cd ..
kill
stop 
end
cat > src/app/meet/new/page.tsx << 'ENDOFFILE'
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
  const [form, setForm] = useState({ name:'', meet_date:'', location:'', host_club_id:'', season_id:'', results_visibility:'after_finalized', num_judges:1 })
  const [selectedTeams, setSelectedTeams] = useState([])
  const [useDivisions, setUseDivisions] = useState(true)
  const [divisions, setDivisions] = useState([{name:'Upper',teams:[]},{name:'Lower',teams:[]}])
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
      if (c?.length > 0) setForm(f => ({...f, host_club_id: c[0].id}))
      if (s?.length > 0) setForm(f => ({...f, season_id: s[0].id}))
      setLoading(false)
    }
    load()
  }, [])
  async function createMeet(e) {
    e.preventDefault(); setSaving(true)
    const { createBrowserClient } = await import('@supabase/ssr')
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { data, error } = await supabase.from('meets').insert({ name:form.name, meet_date:form.meet_date, location:form.location, host_club_id:form.host_club_id, season_id:form.season_id, results_visibility:form.results_visibility, num_judges:form.num_judges, status:'setup' }).select('id').single()
    if (!error && data) { setMeetId(data.id); setStep(2) }
    setSaving(false)
  }
  async function saveTeamsAndDivisions() {
    setSaving(true)
    const { createBrowserClient } = await import('@supabase/ssr')
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    if (selectedTeams.length > 0) {
      const rows = selectedTeams.map(teamId => {
        let divGroup = null
        if (useDivisions) { for (const div of divisions) { if (div.teams.includes(teamId)) { divGroup = div.name; break } } }
        return { meet_id: meetId, team_id: teamId, division_group: divGroup }
      })
      await supabase.from('meet_teams').insert(rows)
    }
    if (useDivisions) {
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
  function toggleTeam(id) { setSelectedTeams(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]) }
  function assignDiv(teamId, divName) {
    setDivisions(prev => prev.map(d => ({...d, teams: d.name === divName ? d.teams.includes(teamId) ? d.teams : [...d.teams, teamId] : d.teams.filter(id => id !== teamId)})))
  }
  if (loading) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'system-ui'}}>Loading...</div>
  return (
    <div style={{minHeight:'100vh',background:'#f8f9fb',fontFamily:'system-ui,sans-serif'}}>
      <nav style={{background:'#0a0f1e',padding:'0 1.5rem',height:'60px',display:'flex',alignItems:'center',gap:'16px'}}>
        <button onClick={() => window.location.href='/dashboard'} style={{background:'none',border:'1px solid #334155',color:'#94a3b8',padding:'5px 12px',borderRadius:'6px',cursor:'pointer',fontSize:'13px'}}>← Dashboard</button>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <div style={{width:'32px',height:'32px',borderRadius:'8px',background:'#fff',color:'#0a0f1e',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',fontWeight:'700',fontFamily:'Georgia,serif'}}>G</div>
          <span style={{color:'#fff',fontWeight:'600',fontSize:'16px'}}>Gymnastats</span>
        </div>
      </nav>
      <main style={{maxWidth:'680px',margin:'0 auto',padding:'2rem 1rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'2rem',justifyContent:'center'}}>
          {['Meet details','Teams & divisions','Ready'].map((label,i) => (
            <div key={i} style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <div style={{width:'28px',height:'28px',borderRadius:'50%',background:step>i+1?'#10b981':step===i+1?'#0a0f1e':'#e5e7eb',color:step>=i+1?'#fff':'#94a3b8',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:600}}>{step>i+1?'✓':i+1}</div>
              <span style={{fontSize:'13px',color:step===i+1?'#0a0f1e':'#94a3b8',fontWeight:step===i+1?600:400,marginRight:'16px'}}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{background:'#fff',borderRadius:'16px',border:'0.5px solid #e5e7eb',padding:'2rem'}}>
          {step === 1 && <>
            <h1 style={{fontSize:'24px',fontWeight:'700',color:'#0a0f1e',margin:'0 0 4px'}}>New meet</h1>
            <p style={{fontSize:'14px',color:'#64748b',margin:'0 0 1.5rem'}}>Fill in the basic details</p>
            <form onSubmit={createMeet} style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                  <label style={{fontSize:'12px',fontWeight:600,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.04em'}}>Meet name</label>
                  <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required placeholder="e.g. Blizzard Invite 2025" style={{padding:'9px 12px',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'14px',color:'#0a0f1e'}} />
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                  <label style={{fontSize:'12px',fontWeight:600,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.04em'}}>Date</label>
                  <input type="date" value={form.meet_date} onChange={e=>setForm(f=>({...f,meet_date:e.target.value}))} required style={{padding:'9px 12px',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'14px',color:'#0a0f1e'}} />
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                  <label style={{fontSize:'12px',fontWeight:600,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.04em'}}>Host club</label>
                  <select value={form.host_club_id} onChange={e=>setForm(f=>({...f,host_club_id:e.target.value}))} style={{padding:'9px 12px',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'14px',color:'#0a0f1e'}}>
                    {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                  <label style={{fontSize:'12px',fontWeight:600,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.04em'}}>Location</label>
                  <input value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} placeholder="City, MN" style={{padding:'9px 12px',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'14px',color:'#0a0f1e'}} />
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                  <label style={{fontSize:'12px',fontWeight:600,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.04em'}}>Season</label>
                  <select value={form.season_id} onChange={e=>setForm(f=>({...f,season_id:e.target.value}))} style={{padding:'9px 12px',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'14px',color:'#0a0f1e'}}>
                    {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                  <label style={{fontSize:'12px',fontWeight:600,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.04em'}}>Number of judges</label>
                  <input type="number" min="1" max="5" value={form.num_judges} onChange={e=>setForm(f=>({...f,num_judges:parseInt(e.target.value)}))} style={{padding:'9px 12px',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'14px',color:'#0a0f1e'}} />
                </div>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                <label style={{fontSize:'12px',fontWeight:600,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.04em'}}>Public results</label>
                <select value={form.results_visibility} onChange={e=>setForm(f=>({...f,results_visibility:e.target.value}))} style={{padding:'9px 12px',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'14px',color:'#0a0f1e'}}>
                  <option value="after_finalized">Show after meet is finalized</option>
                  <option value="live">Show live during meet</option>
                </select>
              </div>
              <div style={{display:'flex',justifyContent:'flex-end',marginTop:'0.5rem'}}>
                <button type="submit" disabled={saving} style={{background:'#0a0f1e',color:'#fff',border:'none',borderRadius:'8px',padding:'10px 20px',fontSize:'14px',cursor:'pointer',fontWeight:500}}>{saving?'Creating...':'Continue →'}</button>
              </div>
            </form>
          </>}
          {step === 2 && <>
            <h1 style={{fontSize:'24px',fontWeight:'700',color:'#0a0f1e',margin:'0 0 4px'}}>Teams & divisions</h1>
            <p style={{fontSize:'14px',color:'#64748b',margin:'0 0 1.5rem'}}>Select competing teams and optionally assign divisions</p>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.5rem'}}>
              <span style={{fontSize:'14px',color:'#0a0f1e',fontWeight:500}}>Use divisions for this meet</span>
              <div onClick={()=>setUseDivisions(!useDivisions)} style={{width:'40px',height:'22px',borderRadius:'11px',background:useDivisions?'#0a0f1e':'#e5e7eb',cursor:'pointer',position:'relative',transition:'background 0.2s'}}>
                <div style={{position:'absolute',width:'16px',height:'16px',borderRadius:'50%',background:'#fff',top:'3px',left:useDivisions?'21px':'3px',transition:'left 0.2s'}} />
              </div>
            </div>
            <h2 style={{fontSize:'14px',fontWeight:600,color:'#0a0f1e',margin:'0 0 10px'}}>Select teams</h2>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:'8px',marginBottom:'1.5rem'}}>
              {teams.map(team => (
                <div key={team.id} onClick={()=>toggleTeam(team.id)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',border:selectedTeams.includes(team.id)?'1.5px solid #0a0f1e':'1.5px solid #e5e7eb',borderRadius:'10px',cursor:'pointer',background:selectedTeams.includes(team.id)?'#f0f4ff':'#f8f9fb'}}>
                  <span style={{fontSize:'13px',fontWeight:500,color:'#0a0f1e'}}>{team.name}</span>
                  {selectedTeams.includes(team.id) && <span style={{color:'#0a0f1e',fontWeight:700}}>✓</span>}
                </div>
              ))}
            </div>
            {useDivisions && selectedTeams.length > 0 && <>
              <div style={{height:'0.5px',background:'#e5e7eb',margin:'1rem 0'}} />
              <h2 style={{fontSize:'14px',fontWeight:600,color:'#0a0f1e',margin:'0 0 10px'}}>Assign to divisions</h2>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'1rem'}}>
                {divisions.map(div => (
                  <div key={div.name} style={{border:'1px solid #e5e7eb',borderRadius:'10px',padding:'12px',background:'#f8f9fb'}}>
                    <div style={{fontSize:'13px',fontWeight:700,color:'#0a0f1e',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'0.05em'}}>{div.name}</div>
                    {selectedTeams.map(teamId => {
                      const team = teams.find(t => t.id === teamId)
                      const assigned = div.teams.includes(teamId)
                      return (
                        <div key={teamId} onClick={()=>assignDiv(teamId,div.name)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 10px',borderRadius:'6px',cursor:'pointer',fontSize:'13px',background:assigned?'#f0fdf4':'#fff',border:assigned?'1px solid #bbf7d0':'1px solid #e5e7eb',marginBottom:'4px',color:assigned?'#0a0f1e':'#64748b'}}>
                          <span>{team?.name}</span>
                          {assigned && <span style={{color:'#10b981',fontWeight:600}}>✓</span>}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </>}
            <div style={{display:'flex',gap:'10px',justifyContent:'flex-end',marginTop:'1rem'}}>
              <button onClick={()=>setStep(1)} style={{background:'none',border:'1px solid #e5e7eb',color:'#64748b',borderRadius:'8px',padding:'10px 20px',fontSize:'14px',cursor:'pointer'}}>← Back</button>
              <button onClick={saveTeamsAndDivisions} disabled={saving||selectedTeams.length===0} style={{background:'#0a0f1e',color:'#fff',border:'none',borderRadius:'8px',padding:'10px 20px',fontSize:'14px',cursor:'pointer',fontWeight:500}}>{saving?'Saving...':'Continue →'}</button>
            </div>
          </>}
          {step === 3 && <div style={{textAlign:'center',padding:'1rem 0'}}>
            <div style={{width:'60px',height:'60px',borderRadius:'50%',background:'#f0fdf4',border:'2px solid #10b981',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px',margin:'0 auto 1.5rem',color:'#10b981'}}>✓</div>
            <h1 style={{fontSize:'24px',fontWeight:'700',color:'#0a0f1e',margin:'0 0 8px'}}>Meet created!</h1>
            <p style={{fontSize:'14px',color:'#64748b',marginBottom:'2rem',lineHeight:'1.5'}}><strong>{form.name}</strong> is ready.<br/>Activate it to start accepting scores.</p>
            <div style={{display:'flex',gap:'10px',justifyContent:'center'}}>
              <button onClick={()=>window.location.href='/lineup'} style={{background:'none',border:'1px solid #e5e7eb',color:'#64748b',borderRadius:'8px',padding:'10px 20px',fontSize:'14px',cursor:'pointer'}}>Set up lineups first</button>
              <button onClick={activateMeet} disabled={saving} style={{background:'#0a0f1e',color:'#fff',border:'none',borderRadius:'8px',padding:'10px 20px',fontSize:'14px',cursor:'pointer',fontWeight:500}}>{saving?'Activating...':'Activate & go to score entry →'}</button>
            </div>
          </div>}
        </div>
      </main>
    </div>
  )
}
