// @ts-nocheck
// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'

export const dynamic = 'force-dynamic'

type AgeGroup = 'Novice' | 'Children' | 'Junior' | 'Senior'

interface Gymnast {
  id: string
  first_name: string
  last_name: string
  age_group: AgeGroup | null
  current_team_id: string | null
  teams?: { name: string }
}

interface Team {
  id: string
  name: string
  division_group: string | null
}

const AGE_GROUPS: AgeGroup[] = ['Novice', 'Children', 'Junior', 'Senior']

export default function RosterPage() {
  const [gymnasts, setGymnasts] = useState<Gymnast[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTeam, setFilterTeam] = useState('all')
  const [filterAge, setFilterAge] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ first_name: '', last_name: '', age_group: 'Children' as AgeGroup, current_team_id: '' })

  useEffect(() => {
    async function load() {
      const { createBrowserClient } = await import('@supabase/ssr')
      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth/login'; return }

      const [{ data: g }, { data: t }] = await Promise.all([
        supabase.from('gymnasts').select('id, first_name, last_name, age_group, current_team_id, teams(name)').eq('is_active', true).order('last_name'),
        supabase.from('teams').select('id, name, division_group').eq('is_active', true).order('name'),
      ])
      setGymnasts((g ?? []) as unknown as Gymnast[])
      setTeams(t ?? [])
      if (t && t.length > 0) setForm(f => ({ ...f, current_team_id: t[0].id }))
      setLoading(false)
    }
    load()
  }, [])

  async function addGymnast(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { createBrowserClient } = await import('@supabase/ssr')
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const team = teams.find(t => t.id === form.current_team_id)
    const club = team ? await supabase.from('teams').select('club_id').eq('id', team.id).single() : null
    const { data, error } = await supabase.from('gymnasts').insert({
      first_name: form.first_name,
      last_name: form.last_name,
      age_group: form.age_group,
      current_team_id: form.current_team_id || null,
      current_club_id: club?.data?.club_id ?? null,
      is_active: true,
    }).select('id, first_name, last_name, age_group, current_team_id, teams(name)').single()
    if (!error && data) {
      setGymnasts(prev => [...prev, data as Gymnast].sort((a, b) => a.last_name.localeCompare(b.last_name)))
      setShowAdd(false)
      setForm(f => ({ ...f, first_name: '', last_name: '' }))
    }
    setSaving(false)
  }

  const filtered = gymnasts.filter(g => {
    const name = `${g.first_name} ${g.last_name}`.toLowerCase()
    if (search && !name.includes(search.toLowerCase())) return false
    if (filterTeam !== 'all' && g.current_team_id !== filterTeam) return false
    if (filterAge !== 'all' && g.age_group !== filterAge) return false
    return true
  })

  const ageColors: Record<string, string> = { Novice: '#f59e0b', Children: '#10b981', Junior: '#6366f1', Senior: '#ef4444' }

  if (loading) return <div style={s.loading}>Loading roster...</div>

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <div style={s.navLeft}>
          <button onClick={() => window.location.href = '/dashboard'} style={s.backBtn}>← Dashboard</button>
          <div style={s.navLogo}>
            <div style={s.logoMark}>G</div>
            <span style={s.logoText}>Gymnastats</span>
          </div>
        </div>
        <button onClick={async () => { const { createBrowserClient } = await import('@supabase/ssr'); const s = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); await s.auth.signOut(); window.location.href = '/auth/login' }} style={s.signOutBtn}>Sign out</button>
      </nav>

      <main style={s.main}>
        <div style={s.header}>
          <div>
            <h1 style={s.h1}>Roster</h1>
            <p style={s.sub}>{filtered.length} gymnast{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} style={s.primaryBtn}>+ Add gymnast</button>
        </div>

        {showAdd && (
          <div style={s.addCard}>
            <h2 style={s.h2}>New gymnast</h2>
            <form onSubmit={addGymnast} style={s.form}>
              <div style={s.formRow}>
                <div style={s.field}>
                  <label style={s.label}>First name</label>
                  <input value={form.first_name} onChange={e => setForm(f => ({...f, first_name: e.target.value}))} required style={s.input} placeholder="First name" />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Last name</label>
                  <input value={form.last_name} onChange={e => setForm(f => ({...f, last_name: e.target.value}))} required style={s.input} placeholder="Last name" />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Age group</label>
                  <select value={form.age_group} onChange={e => setForm(f => ({...f, age_group: e.target.value as AgeGroup}))} style={s.input}>
                    {AGE_GROUPS.map(ag => <option key={ag} value={ag}>{ag}</option>)}
                  </select>
                </div>
                <div style={s.field}>
                  <label style={s.label}>Team</label>
                  <select value={form.current_team_id} onChange={e => setForm(f => ({...f, current_team_id: e.target.value}))} style={s.input}>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={s.formBtns}>
                <button type="button" onClick={() => setShowAdd(false)} style={s.cancelBtn}>Cancel</button>
                <button type="submit" disabled={saving} style={s.primaryBtn}>{saving ? 'Saving...' : 'Add gymnast'}</button>
              </div>
            </form>
          </div>
        )}

        <div style={s.filters}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name..." style={{...s.input, flex: 1, maxWidth: '280px'}} />
          <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} style={s.input}>
            <option value="all">All teams</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={filterAge} onChange={e => setFilterAge(e.target.value)} style={s.input}>
            <option value="all">All age groups</option>
            {AGE_GROUPS.map(ag => <option key={ag} value={ag}>{ag}</option>)}
          </select>
        </div>

        <div style={s.table}>
          <div style={s.tableHead}>
            <span>Name</span>
            <span>Team</span>
            <span>Age group</span>
          </div>
          {filtered.length === 0 ? (
            <div style={s.empty}>No gymnasts found.</div>
          ) : (
            filtered.map(g => (
              <div key={g.id} style={s.tableRow}>
                <span style={s.gymnName}>{g.last_name}, {g.first_name}</span>
                <span style={s.teamName}>{(g.teams as unknown as {name:string})?.name ?? '—'}</span>
                <span>
                  <span style={{...s.ageBadge, background: `${ageColors[g.age_group ?? 'Novice']}20`, color: ageColors[g.age_group ?? 'Novice'], border: `1px solid ${ageColors[g.age_group ?? 'Novice']}40`}}>
                    {g.age_group ?? '—'}
                  </span>
                </span>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f8f9fb', fontFamily: 'system-ui,sans-serif' },
  loading: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontFamily: 'system-ui' },
  nav: { background: '#0a0f1e', padding: '0 1.5rem', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  navLeft: { display: 'flex', alignItems: 'center', gap: '16px' },
  backBtn: { background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  navLogo: { display: 'flex', alignItems: 'center', gap: '10px' },
  logoMark: { width: '32px', height: '32px', borderRadius: '8px', background: '#fff', color: '#0a0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '700', fontFamily: 'Georgia,serif' },
  logoText: { color: '#fff', fontWeight: '600', fontSize: '16px' },
  signOutBtn: { background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  main: { maxWidth: '900px', margin: '0 auto', padding: '2rem 1rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' },
  h1: { fontSize: '28px', fontWeight: '700', color: '#0a0f1e', margin: '0 0 4px', letterSpacing: '-0.5px' },
  h2: { fontSize: '16px', fontWeight: '600', color: '#0a0f1e', margin: '0 0 1rem' },
  sub: { fontSize: '13px', color: '#64748b', margin: 0 },
  primaryBtn: { background: '#0a0f1e', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '14px', cursor: 'pointer', fontWeight: 500 },
  cancelBtn: { background: 'none', border: '1px solid #e5e7eb', color: '#64748b', borderRadius: '8px', padding: '9px 18px', fontSize: '14px', cursor: 'pointer' },
  addCard: { background: '#fff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1.25rem', marginBottom: '1rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  formRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' },
  formBtns: { display: 'flex', gap: '8px', justifyContent: 'flex-end' },
  filters: { display: 'flex', gap: '10px', marginBottom: '1rem', flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' },
  input: { padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', color: '#0a0f1e', background: '#fff', outline: 'none' },
  table: { background: '#fff', borderRadius: '12px', border: '0.5px solid #e5e7eb', overflow: 'hidden' },
  tableHead: { display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '1rem', padding: '10px 16px', background: '#f8f9fb', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '0.5px solid #e5e7eb' },
  tableRow: { display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '1rem', padding: '12px 16px', borderBottom: '0.5px solid #f1f5f9', alignItems: 'center' },
  gymnName: { fontSize: '14px', fontWeight: 500, color: '#0a0f1e' },
  teamName: { fontSize: '13px', color: '#64748b' },
  ageBadge: { fontSize: '11px', fontWeight: 600, padding: '2px 10px', borderRadius: '20px' },
  empty: { padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '14px' },
}
