'use client'
import { useEffect, useState } from 'react'

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [meets, setMeets] = useState<Array<{id:string,name:string,meet_date:string,status:string}>>([])
  const [stats, setStats] = useState<Array<{label:string,value:number}>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { createBrowserClient } = await import('@supabase/ssr')
        const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { window.location.href = '/auth/login'; return }
        const { data: prof } = await supabase.from('users').select('full_name,role').eq('id', user.id).single()
        if (prof) { setName(prof.full_name); setRole(prof.role) }
        const { data: m } = await supabase.from('meets').select('id,name,meet_date,status').order('meet_date',{ascending:false}).limit(5)
        setMeets(m ?? [])
        const [{ count: gymCount }, { count: meetCount }, { count: teamCount }] = await Promise.all([
          supabase.from('gymnasts').select('*', { count: 'exact', head: true }),
          supabase.from('meets').select('*', { count: 'exact', head: true }),
          supabase.from('teams').select('*', { count: 'exact', head: true }),
        ])
        setStats([
          { label: 'Gymnasts', value: gymCount ?? 0 },
          { label: 'Meets', value: meetCount ?? 0 },
          { label: 'Teams', value: teamCount ?? 0 },
        ])
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

  if (loading) return <div style={s.loading}>Loading...</div>

  const statusColor: Record<string,string> = {setup:'#f59e0b',active:'#10b981',finalized:'#6366f1',suspended:'#ef4444'}
  const roleLabel: Record<string,string> = {maga_admin:'MAGA Administrator',club_staff:'Club Staff',parent:'Parent / Guardian'}

  const quickLinks = [
    { label: 'Manage roster', sub: 'Add and edit gymnasts', href: '/roster', icon: '👥' },
    { label: 'Lineup manager', sub: 'Set running order per meet', href: '/lineup', icon: '📋' },
    { label: 'Score entry', sub: 'Enter event scores', href: '/scores', icon: '📊' },
    { label: 'Season standings', sub: 'Rankings across all meets', href: '/standings', icon: '🏆' },
  ]

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <div style={s.navLogo}>
          <div style={s.logoMark}>G</div>
          <span style={s.logoText}>Gymnastats</span>
        </div>
        <div style={s.navRight}>
          <span style={s.navName}>{name}</span>
          <button onClick={signOut} style={s.signOutBtn}>Sign out</button>
        </div>
      </nav>

      <main style={s.main}>
        <div style={s.header}>
          <div>
            <h1 style={s.h1}>Dashboard</h1>
            <p style={s.roleTag}>{roleLabel[role] ?? role}</p>
          </div>
        </div>

        <div style={s.statsGrid}>
          {stats.map((stat, i) => (
            <div key={i} style={s.statCard}>
              <div style={s.statNum}>{stat.value}</div>
              <div style={s.statLabel}>{stat.label}</div>
            </div>
          ))}
        </div>

        <div style={s.section}>
          <div style={s.sectionHeader}>
            <h2 style={s.h2}>Recent meets</h2>
            <button style={s.actionBtn}>+ New meet</button>
          </div>
          {meets.length === 0 ? (
            <p style={s.emptyText}>No meets yet this season.</p>
          ) : (
            <div style={s.meetList}>
              {meets.map(meet => (
                <div key={meet.id} style={s.meetRow}>
                  <div>
                    <div style={s.meetName}>{meet.name}</div>
                    <div style={s.meetDate}>{new Date(meet.meet_date).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</div>
                  </div>
                  <div style={{...s.statusBadge, background:`${statusColor[meet.status]}20`, color:statusColor[meet.status], border:`1px solid ${statusColor[meet.status]}40`}}>
                    {meet.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={s.quickLinks}>
          {quickLinks.map(link => (
            <button key={link.href} onClick={() => window.location.href = link.href} style={s.quickBtn}>
              <span style={s.quickIcon}>{link.icon}</span>
              <div>
                <div style={s.quickLabel}>{link.label}</div>
                <div style={s.quickSub}>{link.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f8f9fb', fontFamily: 'system-ui,sans-serif' },
  loading: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontFamily: 'system-ui' },
  nav: { background: '#0a0f1e', padding: '0 2rem', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  navLogo: { display: 'flex', alignItems: 'center', gap: '10px' },
  logoMark: { width: '32px', height: '32px', borderRadius: '8px', background: '#fff', color: '#0a0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '700', fontFamily: 'Georgia,serif' },
  logoText: { color: '#fff', fontWeight: '600', fontSize: '16px' },
  navRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  navName: { color: '#94a3b8', fontSize: '13px' },
  signOutBtn: { background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  main: { maxWidth: '900px', margin: '0 auto', padding: '2rem 1rem' },
  header: { marginBottom: '1.5rem' },
  h1: { fontSize: '28px', fontWeight: '700', color: '#0a0f1e', margin: '0 0 4px', letterSpacing: '-0.5px' },
  h2: { fontSize: '16px', fontWeight: '600', color: '#0a0f1e', margin: 0 },
  roleTag: { fontSize: '13px', color: '#64748b', margin: 0 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '1.5rem' },
  statCard: { background: '#fff', borderRadius: '12px', padding: '1.25rem', border: '0.5px solid #e5e7eb' },
  statNum: { fontSize: '32px', fontWeight: '700', color: '#0a0f1e', letterSpacing: '-1px' },
  statLabel: { fontSize: '12px', color: '#64748b', marginTop: '2px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' },
  section: { background: '#fff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1.25rem', marginBottom: '1rem' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  actionBtn: { background: '#0a0f1e', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: 500 },
  emptyText: { color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '1rem' },
  meetList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  meetRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#f8f9fb', borderRadius: '8px', border: '0.5px solid #e5e7eb' },
  meetName: { fontSize: '14px', fontWeight: 600, color: '#0a0f1e', marginBottom: '2px' },
  meetDate: { fontSize: '12px', color: '#64748b' },
  statusBadge: { fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', textTransform: 'capitalize' },
  quickLinks: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' },
  quickBtn: { background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: '12px', padding: '1.25rem', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', transition: 'border-color 0.15s' },
  quickIcon: { fontSize: '20px', flexShrink: 0 },
  quickLabel: { fontSize: '14px', fontWeight: 500, color: '#0a0f1e' },
  quickSub: { fontSize: '12px', color: '#94a3b8', marginTop: '2px' },
}
