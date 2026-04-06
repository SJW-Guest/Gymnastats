// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'

export const dynamic = 'force-dynamic'

export default function StandingsPage() {
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterAge, setFilterAge] = useState('all')
  const [view, setView] = useState('aa')
  const [meetCount, setMeetCount] = useState(0)

  useEffect(() => {
    async function load() {
      const { createBrowserClient } = await import('@supabase/ssr')
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth/login'; return }

      const [{ data: meetsData }, { data: scoresData }] = await Promise.all([
        supabase.from('meets').select('id').eq('status', 'finalized'),
        supabase.from('scores').select(`
          gymnast_id, age_group,
          vault, bars, beam, floor,
          vault_dnc, bars_dnc, beam_dnc, floor_dnc,
          gymnasts(first_name, last_name),
          teams(name)
        `),
      ])

      setMeetCount(meetsData?.length ?? 0)

      const byGymnast = {}
      for (const score of (scoresData ?? [])) {
        const id = score.gymnast_id
        if (!byGymnast[id]) {
          byGymnast[id] = {
            gymnast_id: id,
            name: `${score.gymnasts?.last_name}, ${score.gymnasts?.first_name}`,
            team: score.teams?.name ?? '—',
            age_group: score.age_group,
            vaults: [], bars: [], beams: [], floors: [], aas: []
          }
        }
        const e = byGymnast[id]
        if (score.vault != null && !score.vault_dnc) e.vaults.push(score.vault)
        if (score.bars != null && !score.bars_dnc) e.bars.push(score.bars)
        if (score.beam != null && !score.beam_dnc) e.beams.push(score.beam)
        if (score.floor != null && !score.floor_dnc) e.floors.push(score.floor)
        const competed = [
          score.vault_dnc ? 0 : (score.vault ?? 0),
          score.bars_dnc ? 0 : (score.bars ?? 0),
          score.beam_dnc ? 0 : (score.beam ?? 0),
          score.floor_dnc ? 0 : (score.floor ?? 0)
        ]
        const aa = competed.reduce((a, b) => a + b, 0)
        if (aa > 0) e.aas.push(aa)
      }

      const rows = Object.values(byGymnast).map(e => ({
        gymnast_id: e.gymnast_id,
        name: e.name,
        team: e.team,
        age_group: e.age_group,
        meets: e.aas.length,
        best_vault: e.vaults.length ? Math.max(...e.vaults) : null,
        best_bars: e.bars.length ? Math.max(...e.bars) : null,
        best_beam: e.beams.length ? Math.max(...e.beams) : null,
        best_floor: e.floors.length ? Math.max(...e.floors) : null,
        best_aa: e.aas.length ? Math.max(...e.aas) : null,
      }))

      setStandings(rows)
      setLoading(false)
    }
    load()
  }, [])

  const scoreKey = { aa: 'best_aa', vault: 'best_vault', bars: 'best_bars', beam: 'best_beam', floor: 'best_floor' }
  const viewLabel = { aa: 'All-Around', vault: 'Vault', bars: 'Bars', beam: 'Beam', floor: 'Floor' }

  const filtered = standings
    .filter(r => filterAge === 'all' || r.age_group === filterAge)
    .sort((a, b) => {
      const av = a[scoreKey[view]]
      const bv = b[scoreKey[view]]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return bv - av
    })
    .map((r, i) => ({ ...r, rank: i + 1 }))

  if (loading) return <div style={s.loading}>Loading standings...</div>

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
        <button onClick={async () => {
          const { createBrowserClient } = await import('@supabase/ssr')
          const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
          await sb.auth.signOut()
          window.location.href = '/auth/login'
        }} style={s.signOutBtn}>Sign out</button>
      </nav>

      <main style={s.main}>
        <div style={s.header}>
          <div>
            <h1 style={s.h1}>Season standings</h1>
            <p style={s.sub}>{meetCount} finalized meet{meetCount !== 1 ? 's' : ''} · {filtered.length} gymnasts</p>
          </div>
        </div>

        <div style={s.controls}>
          <div style={s.viewTabs}>
            {['aa','vault','bars','beam','floor'].map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{...s.viewTab, ...(view === v ? s.viewTabActive : {})}}>
                {viewLabel[v]}
              </button>
            ))}
          </div>
          <select value={filterAge} onChange={e => setFilterAge(e.target.value)} style={s.select}>
            <option value="all">All age groups</option>
            {['Novice','Children','Junior','Senior'].map(ag => (
              <option key={ag} value={ag}>{ag}</option>
            ))}
          </select>
        </div>

        <div style={s.table}>
          <div style={s.tableHead}>
            <span>#</span>
            <span>Gymnast</span>
            <span>Team</span>
            <span>Age group</span>
            <span>Meets</span>
            <span style={{textAlign:'right'}}>{viewLabel[view]}</span>
          </div>
          {filtered.length === 0 ? (
            <div style={s.empty}>No standings data yet. Meets must be finalized to appear here.</div>
          ) : (
            filtered.map(r => (
              <div key={r.gymnast_id} style={{...s.tableRow, ...(r.rank === 1 ? s.goldRow : {})}}>
                <span style={{...s.rank, ...(r.rank === 1 ? s.goldRank : {})}}>{r.rank}</span>
                <span style={s.gymnName}>{r.name}</span>
                <span style={s.cell}>{r.team}</span>
                <span style={s.cell}>{r.age_group}</span>
                <span style={s.cell}>{r.meets}</span>
                <span style={{...s.score, ...(r.rank === 1 ? s.goldScore : {}), textAlign:'right'}}>
                  {r[scoreKey[view]]?.toFixed(2) ?? '—'}
                </span>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: '#f8f9fb', fontFamily: 'system-ui,sans-serif' },
  loading: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontFamily: 'system-ui' },
  nav: { background: '#0a0f1e', padding: '0 1.5rem', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  navLeft: { display: 'flex', alignItems: 'center', gap: '16px' },
  backBtn: { background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  navLogo: { display: 'flex', alignItems: 'center', gap: '10px' },
  logoMark: { width: '32px', height: '32px', borderRadius: '8px', background: '#fff', color: '#0a0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '700', fontFamily: 'Georgia,serif' },
  logoText: { color: '#fff', fontWeight: '600', fontSize: '16px' },
  signOutBtn: { background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  main: { maxWidth: '1000px', margin: '0 auto', padding: '2rem 1rem' },
  header: { marginBottom: '1.5rem' },
  h1: { fontSize: '28px', fontWeight: '700', color: '#0a0f1e', margin: '0 0 4px', letterSpacing: '-0.5px' },
  sub: { fontSize: '13px', color: '#64748b', margin: 0 },
  controls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' },
  viewTabs: { display: 'flex', gap: '4px', background: '#fff', padding: '4px', borderRadius: '10px', border: '0.5px solid #e5e7eb' },
  viewTab: { padding: '6px 14px', borderRadius: '8px', border: 'none', background: 'none', fontSize: '13px', cursor: 'pointer', color: '#64748b', fontWeight: 500 },
  viewTabActive: { background: '#0a0f1e', color: '#fff' },
  select: { padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', color: '#0a0f1e', background: '#fff' },
  table: { background: '#fff', borderRadius: '12px', border: '0.5px solid #e5e7eb', overflow: 'hidden' },
  tableHead: { display: 'grid', gridTemplateColumns: '40px 2fr 1.5fr 100px 60px 80px', gap: '8px', padding: '10px 16px', background: '#f8f9fb', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '0.5px solid #e5e7eb' },
  tableRow: { display: 'grid', gridTemplateColumns: '40px 2fr 1.5fr 100px 60px 80px', gap: '8px', padding: '12px 16px', borderBottom: '0.5px solid #f1f5f9', alignItems: 'center' },
  goldRow: { background: '#f0fdf4' },
  rank: { fontSize: '14px', fontWeight: 600, color: '#64748b' },
  goldRank: { color: '#16a34a' },
  gymnName: { fontSize: '14px', fontWeight: 500, color: '#0a0f1e' },
  cell: { fontSize: '13px', color: '#64748b' },
  score: { fontSize: '15px', fontWeight: 600, color: '#0a0f1e' },
  goldScore: { color: '#16a34a' },
  empty: { padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '14px' },
}
