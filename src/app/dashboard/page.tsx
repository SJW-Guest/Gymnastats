'use client'
import { useEffect, useState } from 'react'

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [meets, setMeets] = useState<Array<{id:string,name:string,meet_date:string,status:string}>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { createBrowserClient } = await import('@supabase/ssr')
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { window.location.href = '/auth/login'; return }
        const { data: prof } = await supabase.from('users').select('full_name,role').eq('id', user.id).single()
        if (prof) { setName(prof.full_name); setRole(prof.role) }
        const { data: m } = await supabase.from('meets').select('id,name,meet_date,status').order('meet_date',{ascending:false}).limit(5)
        setMeets(m ?? [])
      } catch { window.location.href = '/auth/login' }
      setLoading(false)
    }
    load()
  }, [])

  async function signOut() {
    const { createBrowserClient } = await import('@supabase/ssr')
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  if (loading) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f8f9fb'}}><p style={{color:'#888',fontFamily:'system-ui'}}>Loading...</p></div>

  const statusColor: Record<string,string> = {setup:'#f59e0b',active:'#10b981',finalized:'#6366f1',suspended:'#ef4444'}
  const roleLabel: Record<string,string> = {maga_admin:'MAGA Administrator',club_staff:'Club Staff',parent:'Parent / Guardian'}

  return (
    <div style={{minHeight:'100vh',background:'#f8f9fb',fontFamily:'system-ui,sans-serif'}}>
      <nav style={{background:'#0a0f1e',padding:'0 2rem',height:'60px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <div style={{width:'32px',height:'32px',borderRadius:'8px',background:'#fff',color:'#0a0f1e',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',fontWeight:'700',fontFamily:'Georgia,serif'}}>G</div>
          <span style={{color:'#fff',fontWeight:'600',fontSize:'16px'}}>Gymnastats</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          <span style={{color:'#94a3b8',fontSize:'13px'}}>{name}</span>
          <button onClick={signOut} style={{background:'none',border:'1px solid #334155',color:'#94a3b8',padding:'5px 12px',borderRadius:'6px',cursor:'pointer',fontSize:'13px'}}>Sign out</button>
        </div>
      </nav>
      <main style={{maxWidth:'900px',margin:'0 auto',padding:'2rem 1rem'}}>
        <h1 style={{fontSize:'28px',fontWeight:'700',color:'#0a0f1e',margin:'0 0 4px',letterSpacing:'-0.5px'}}>Dashboard</h1>
        <p style={{fontSize:'13px',color:'#64748b',margin:'0 0 2rem'}}>{roleLabel[role] ?? role}</p>
        <div style={{background:'#fff',borderRadius:'12px',border:'0.5px solid #e5e7eb',padding:'1.25rem',marginBottom:'1rem'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
            <h2 style={{fontSize:'16px',fontWeight:'600',color:'#0a0f1e',margin:0}}>Recent meets</h2>
            <button style={{background:'#0a0f1e',color:'#fff',border:'none',borderRadius:'8px',padding:'7px 14px',fontSize:'13px',cursor:'pointer',fontWeight:500}}>+ New meet</button>
          </div>
          {meets.length === 0 ? (
            <p style={{color:'#94a3b8',textAlign:'center' as const,padding:'2rem',fontSize:'14px'}}>No meets yet this season.</p>
          ) : (
            <div style={{display:'flex',flexDirection:'column' as const,gap:'8px'}}>
              {meets.map(meet => (
                <div key={meet.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:'#f8f9fb',borderRadius:'8px',border:'0.5px solid #e5e7eb'}}>
                  <div>
                    <div style={{fontSize:'14px',fontWeight:600,color:'#0a0f1e',marginBottom:'2px'}}>{meet.name}</div>
                    <div style={{fontSize:'12px',color:'#64748b'}}>{new Date(meet.meet_date).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</div>
                  </div>
                  <div style={{fontSize:'11px',fontWeight:600,padding:'3px 10px',borderRadius:'20px',background:`${statusColor[meet.status]}20`,color:statusColor[meet.status],border:`1px solid ${statusColor[meet.status]}40`,textTransform:'capitalize' as const}}>{meet.status}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:'10px'}}>
          {['Manage roster','Lineup manager','Score entry','Season standings'].map(label => (
            <button key={label} style={{background:'#fff',border:'0.5px solid #e5e7eb',borderRadius:'12px',padding:'1.25rem',cursor:'pointer',textAlign:'left' as const,fontSize:'14px',fontWeight:500,color:'#0a0f1e'}}>{label}</button>
          ))}
        </div>
      </main>
    </div>
  )
}
