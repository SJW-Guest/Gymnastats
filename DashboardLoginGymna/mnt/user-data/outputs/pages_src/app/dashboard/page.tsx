'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

type UserRole = 'maga_admin' | 'club_staff' | 'parent'

interface UserProfile {
  full_name: string
  role: UserRole
  club_id: string | null
  email: string
}

interface MeetSummary {
  id: string
  name: string
  meet_date: string
  status: string
  host_club_id: string
}

interface StatCard {
  label: string
  value: string | number
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [meets, setMeets] = useState<MeetSummary[]>([])
  const [stats, setStats] = useState<StatCard[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth/login'; return }

      const { data: prof } = await supabase
        .from('users')
        .select('full_name, role, club_id')
        .eq('id', user.id)
        .single()

      if (prof) {
        setProfile({ ...prof, email: user.email ?? '' })

        const { data: meetsData } = await supabase
          .from('meets')
          .select('id, name, meet_date, status, host_club_id')
          .order('meet_date', { ascending: false })
          .limit(5)

        setMeets(meetsData ?? [])

        if (prof.role === 'maga_admin') {
          const [{ count: gymCount }, { count: meetCount }, { count: teamCount }] =
            await Promise.all([
              supabase.from('gymnasts').select('*', { count: 'exact', head: true }),
              supabase.from('meets').select('*', { count: 'exact', head: true }),
              supabase.from('teams').select('*', { count: 'exact', head: true }),
            ])
          setStats([
            { label: 'Total gymnasts', value: gymCount ?? 0 },
            { label: 'Meets this season', value: meetCount ?? 0 },
            { label: 'Teams registered', value: teamCount ?? 0 },
          ])
        } else if (prof.role === 'club_staff' && prof.club_id) {
          const [{ count: gymCount }, { count: teamCount }] =
            await Promise.all([
              supabase.from('gymnasts').select('*', { count: 'exact', head: true }).eq('current_club_id', prof.club_id),
              supabase.from('teams').select('*', { count: 'exact', head: true }).eq('club_id', prof.club_id),
            ])
          setStats([
            { label: 'Your gymnasts', value: gymCount ?? 0 },
            { label: 'Your teams', value: teamCount ?? 0 },
          ])
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  if (loading) return (
    <div style={s.loading}>
      <div style={s.spinner} />
      <p style={{ color: '#888', fontFamily: 'system-ui', marginTop: '1rem' }}>Loading...</p>
    </div>
  )

  const roleLabel: Record<UserRole, string> = {
    maga_admin: 'MAGA Administrator',
    club_staff: 'Club Staff',
    parent: 'Parent / Guardian',
  }

  const statusColor: Record<string, string> = {
    setup: '#f59e0b',
    active: '#10b981',
    finalized: '#6366f1',
    suspended: '#ef4444',
  }

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <div style={s.navLogo}>
          <div style={s.logoMark}>G</div>
          <span style={s.logoText}>Gymnastats</span>
        </div>
        <div style={s.navRight}>
          <span style={s.navName}>{profile?.full_name || profile?.email}</span>
          <button onClick={signOut} style={s.signOutBtn}>Sign out</button>
        </div>
      </nav>

      <main style={s.main}>
        <div style={s.header}>
          <div>
            <h1 style={s.h1}>Dashboard</h1>
            <p style={s.roleTag}>{profile?.role ? roleLabel[profile.role] : ''}</p>
          </div>
        </div>

        {stats.length > 0 && (
          <div style={s.statsGrid}>
            {stats.map((stat, i) => (
              <div key={i} style={s.statCard}>
                <div style={s.statNum}>{stat.value}</div>
                <div style={s.statLabel}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={s.section}>
          <div style={s.sectionHeader}>
            <h2 style={s.h2}>Recent meets</h2>
            <button style={s.actionBtn}>+ New meet</button>
          </div>

          {meets.length === 0 ? (
            <div style={s.empty}>
              <p style={s.emptyText}>No meets yet this season.</p>
              <button style={s.primaryBtn}>Create your first meet</button>
            </div>
          ) : (
            <div style={s.meetList}>
              {meets.map(meet => (
                <div key={meet.id} style={s.meetRow}>
                  <div style={s.meetInfo}>
                    <div style={s.meetName}>{meet.name}</div>
                    <div style={s.meetDate}>
                      {new Date(meet.meet_date).toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </div>
                  </div>
                  <div style={{
                    ...s.statusBadge,
                    background: `${statusColor[meet.status]}20`,
                    color: statusColor[meet.status],
                    border: `1px solid ${statusColor[meet.status]}40`,
                  }}>
                    {meet.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={s.quickLinks}>
          {profile?.role !== 'parent' && (
            <>
              <button style={s.quickBtn}>
                <span style={s.quickIcon}>👥</span>
                <span style={s.quickLabel}>Manage roster</span>
              </button>
              <button style={s.quickBtn}>
                <span style={s.quickIcon}>📋</span>
                <span style={s.quickLabel}>Lineup manager</span>
              </button>
              <button style={s.quickBtn}>
                <span style={s.quickIcon}>🏆</span>
                <span style={s.quickLabel}>Season standings</span>
              </button>
              <button style={s.quickBtn}>
                <span style={s.quickIcon}>📊</span>
                <span style={s.quickLabel}>Score entry</span>
              </button>
            </>
          )}
          {profile?.role === 'parent' && (
            <button style={s.quickBtn}>
              <span style={s.quickIcon}>⭐</span>
              <span style={s.quickLabel}>My gymnast</span>
            </button>
          )}
        </div>
      </main>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f8f9fb', fontFamily: 'system-ui, sans-serif' },
  loading: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  spinner: { width: '32px', height: '32px', border: '3px solid #e5e7eb', borderTopColor: '#0a0f1e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  nav: { background: '#0a0f1e', padding: '0 2rem', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  navLogo: { display: 'flex', alignItems: 'center', gap: '10px' },
  logoMark: { width: '32px', height: '32px', borderRadius: '8px', background: '#fff', color: '#0a0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '700', fontFamily: 'Georgia, serif' },
  logoText: { color: '#fff', fontWeight: '600', fontSize: '16px', letterSpacing: '-0.3px' },
  navRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  navName: { color: '#94a3b8', fontSize: '13px' },
  signOutBtn: { background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  main: { maxWidth: '900px', margin: '0 auto', padding: '2rem 1rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' },
  h1: { fontSize: '28px', fontWeight: '700', color: '#0a0f1e', margin: '0 0 4px', letterSpacing: '-0.5px' },
  roleTag: { fontSize: '13px', color: '#64748b', margin: 0, fontWeight: '500' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '1.5rem' },
  statCard: { background: '#fff', borderRadius: '12px', padding: '1.25rem', border: '0.5px solid #e5e7eb' },
  statNum: { fontSize: '32px', fontWeight: '700', color: '#0a0f1e', letterSpacing: '-1px' },
  statLabel: { fontSize: '12px', color: '#64748b', marginTop: '2px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.04em' },
  section: { background: '#fff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1.25rem', marginBottom: '1rem' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  h2: { fontSize: '16px', fontWeight: '600', color: '#0a0f1e', margin: 0 },
  actionBtn: { background: '#0a0f1e', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' },
  empty: { textAlign: 'center', padding: '2rem' },
  emptyText: { color: '#94a3b8', marginBottom: '1rem', fontSize: '14px' },
  primaryBtn: { background: '#0a0f1e', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer', fontWeight: '500' },
  meetList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  meetRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#f8f9fb', borderRadius: '8px', border: '0.5px solid #e5e7eb' },
  meetInfo: {},
  meetName: { fontSize: '14px', fontWeight: '600', color: '#0a0f1e', marginBottom: '2px' },
  meetDate: { fontSize: '12px', color: '#64748b' },
  statusBadge: { fontSize: '11px', fontWeight: '600', padding: '3px 10px', borderRadius: '20px', textTransform: 'capitalize' },
  quickLinks: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' },
  quickBtn: { background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: '12px', padding: '1.25rem', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', transition: 'border-color 0.15s' },
  quickIcon: { fontSize: '20px' },
  quickLabel: { fontSize: '14px', fontWeight: '500', color: '#0a0f1e' },
}
