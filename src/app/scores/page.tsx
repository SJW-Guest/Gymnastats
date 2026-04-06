'use client'
import { useEffect, useState, useCallback } from 'react'

export const dynamic = 'force-dynamic'

type Event = 'vault' | 'bars' | 'beam' | 'floor'

interface Meet { id: string; name: string; meet_date: string; status: string }
interface LineupEntry {
  id: string
  gymnast_id: string
  running_order: number
  status: string
  age_group: string
  gymnasts: { first_name: string; last_name: string }
  teams: { name: string }
  score?: {
    vault: number | null; vault_dnc: boolean
    bars: number | null; bars_dnc: boolean
    beam: number | null; beam_dnc: boolean
    floor: number | null; floor_dnc: boolean
  }
}

const EVENTS: Event[] = ['vault', 'bars', 'beam', 'floor']
const EVENT_LABELS: Record<Event, string> = { vault: 'Vault', bars: 'Bars', beam: 'Beam', floor: 'Floor' }

export default function ScoreEntryPage() {
  const [meets, setMeets] = useState<Meet[]>([])
  const [selectedMeet, setSelectedMeet] = useState<string>('')
  const [selectedEvent, setSelectedEvent] = useState<Event>('vault')
  const [lineup, setLineup] = useState<LineupEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [pendingScores, setPendingScores] = useState<Record<string, string>>({})

  useEffect(() => {
    async function loadMeets() {
      const { createBrowserClient } = await import('@supabase/ssr')
      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth/login'; return }
      const { data } = await supabase.from('meets').select('id, name, meet_date, status').in('status', ['setup', 'active']).order('meet_date', { ascending: false })
      setMeets(data ?? [])
      if (data && data.length > 0) setSelectedMeet(data[0].id)
      setLoading(false)
    }
    loadMeets()
  }, [])

  const loadLineup = useCallback(async (meetId: string) => {
    if (!meetId) return
    setLoading(true)
    const { createBrowserClient } = await import('@supabase/ssr')
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const [{ data: lineupData }, { data: scoresData }] = await Promise.all([
      supabase.from('meet_lineups').select('id, gymnast_id, running_order, status, age_group, gymnasts(first_name, last_name), teams(name)').eq('meet_id', meetId).order('running_order'),
      supabase.from('scores').select('gymnast_id, vault, vault_dnc, bars, bars_dnc, beam, beam_dnc, floor, floor_dnc').eq('meet_id', meetId),
    ])
    const scoreMap: Record<string, LineupEntry['score']> = {}
    for (const score of (scoresData ?? [])) scoreMap[score.gymnast_id] = score
    setLineup((lineupData ?? []).map((l: LineupEntry) => ({ ...l, score: scoreMap[l.gymnast_id] })))
    setLoading(false)
  }, [])

  useEffect(() => { if (selectedMeet) loadLineup(selectedMeet) }, [selectedMeet, loadLineup])

  async function saveScore(gymnast_id: string, value: string, dnc: boolean) {
    setSaving(gymnast_id)
    const { createBrowserClient } = await import('@supabase/ssr')
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const score = parseFloat(value)
    if (!dnc && (isNaN(score) || score < 0 || score > 10)) { setSaving(null); return }

    const existing = lineup.find(l => l.gymnast_id === gymnast_id)?.score
    const update: Record<string, unknown> = {
      meet_id: selectedMeet, gymnast_id,
      updated_at: new Date().toISOString(),
    }

    // Preserve existing scores for other events
    EVENTS.forEach(ev => {
      if (ev === selectedEvent) {
        update[ev] = dnc ? null : score
        update[`${ev}_dnc`] = dnc
      } else {
        update[ev] = existing?.[ev as keyof typeof existing] ?? null
        update[`${ev}_dnc`] = existing?.[`${ev}_dnc` as keyof typeof existing] ?? false
      }
    })

    await supabase.from('scores').upsert(update, { onConflict: 'meet_id,gymnast_id' })
    await loadLineup(selectedMeet)
    setPendingScores(p => { const n = {...p}; delete n[gymnast_id]; return n })
    setSaving(null)
  }

  function getScore(entry: LineupEntry, event: Event): number | null {
    return entry.score?.[event as keyof typeof entry.score] as number | null ?? null
  }

  function isDnc(entry: LineupEntry, event: Event): boolean {
    return entry.score?.[`${event}_dnc` as keyof typeof entry.score] as boolean ?? false
  }

  function calcAA(entry: LineupEntry): string {
    let total = 0; let count = 0
    EVENTS.forEach(ev => {
      const val = getScore(entry, ev)
      if (val != null && !isDnc(entry, ev)) { total += val; count++ }
    })
    if (count === 0) return '—'
    return total.toFixed(2) + (count < 4 ? ` (${count}/4)` : '')
  }

  const activeLineup = lineup.filter(l => l.status === 'active')
  const scratched = lineup.filter(l => l.status === 'scratched')

  if (loading) return <div style={s.loading}>Loading...</div>

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
        <button onClick={async () => { const { createBrowserClient } = await import('@supabase/ssr'); const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); await sb.auth.signOut(); window.location.href = '/auth/login' }} style={s.signOutBtn}>Sign out</button>
      </nav>

      <main style={s.main}>
        <h1 style={s.h1}>Score entry</h1>

        <div style={s.controls}>
          <div style={s.field}>
            <label style={s.label}>Meet</label>
            <select value={selectedMeet} onChange={e => setSelectedMeet(e.target.value)} style={s.select}>
              {meets.length === 0 && <option value="">No active meets</option>}
              {meets.map(m => <option key={m.id} value={m.id}>{m.name} — {new Date(m.meet_date).toLocaleDateString()}</option>)}
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Event</label>
            <div style={s.eventTabs}>
              {EVENTS.map(ev => (
                <button key={ev} onClick={() => setSelectedEvent(ev)} style={{...s.eventTab, ...(selectedEvent === ev ? s.eventTabActive : {})}}>
                  {EVENT_LABELS[ev]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {meets.length === 0 ? (
          <div style={s.emptyState}>
            <p style={s.emptyText}>No active meets. Create a meet from the dashboard first.</p>
            <button onClick={() => window.location.href = '/dashboard'} style={s.primaryBtn}>Go to dashboard</button>
          </div>
        ) : (
          <>
            <div style={s.tableWrap}>
              <div style={s.tableHead}>
                <span>#</span>
                <span>Gymnast</span>
                <span>Team</span>
                <span>Age</span>
                <span style={{textAlign:'center'}}>{EVENT_LABELS[selectedEvent]}</span>
                <span style={{textAlign:'right'}}>All-Around</span>
              </div>

              {activeLineup.length === 0 ? (
                <div style={s.empty}>No lineup set for this meet. Go to Lineup Manager first.</div>
              ) : activeLineup.map(entry => {
                const currentScore = getScore(entry, selectedEvent)
                const dnc = isDnc(entry, selectedEvent)
                const pendingKey = entry.gymnast_id
                const pendingVal = pendingScores[pendingKey]
                const isSaving = saving === entry.gymnast_id

                return (
                  <div key={entry.id} style={s.tableRow}>
                    <span style={s.orderNum}>{entry.running_order}</span>
                    <span style={s.gymnName}>{(entry.gymnasts as unknown as {first_name:string,last_name:string})?.last_name}, {(entry.gymnasts as unknown as {first_name:string,last_name:string})?.first_name}</span>
                    <span style={s.cell}>{(entry.teams as unknown as {name:string})?.name}</span>
                    <span style={s.cell}>{entry.age_group}</span>
                    <div style={s.scoreCell}>
                      {dnc ? (
                        <div style={s.dncBadge}>DNC <button onClick={() => saveScore(entry.gymnast_id, '', false)} style={s.dncUndo}>undo</button></div>
                      ) : (
                        <div style={s.scoreInput}>
                          <input
                            type="number" step="0.05" min="0" max="10"
                            value={pendingVal ?? (currentScore?.toFixed(2) ?? '')}
                            onChange={e => setPendingScores(p => ({...p, [pendingKey]: e.target.value}))}
                            onBlur={() => { if (pendingVal) saveScore(entry.gymnast_id, pendingVal, false) }}
                            onKeyDown={e => { if (e.key === 'Enter' && pendingVal) saveScore(entry.gymnast_id, pendingVal, false) }}
                            placeholder="0.00"
                            style={{...s.numInput, ...(currentScore != null ? s.numInputFilled : {})}}
                          />
                          <button onClick={() => saveScore(entry.gymnast_id, '', true)} style={s.dncBtn} title="Did not compete">DNC</button>
                        </div>
                      )}
                      {isSaving && <span style={s.savingDot} />}
                    </div>
                    <span style={{...s.aaScore, textAlign:'right'}}>{calcAA(entry)}</span>
                  </div>
                )
              })}
            </div>

            {scratched.length > 0 && (
              <div style={s.scratchedSection}>
                <div style={s.scratchedLabel}>Scratched ({scratched.length})</div>
                {scratched.map(entry => (
                  <div key={entry.id} style={s.scratchedRow}>
                    <span style={s.orderNum}>{entry.running_order}</span>
                    <span style={{...s.gymnName, opacity: 0.5, textDecoration: 'line-through'}}>{(entry.gymnasts as unknown as {first_name:string,last_name:string})?.last_name}, {(entry.gymnasts as unknown as {first_name:string,last_name:string})?.first_name}</span>
                    <span style={{...s.cell, opacity: 0.5}}>{(entry.teams as unknown as {name:string})?.name}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={s.hint}>Tab between fields or press Enter to save. Click DNC to mark did-not-compete.</div>
          </>
        )}
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
  main: { maxWidth: '1000px', margin: '0 auto', padding: '2rem 1rem' },
  h1: { fontSize: '28px', fontWeight: '700', color: '#0a0f1e', margin: '0 0 1.5rem', letterSpacing: '-0.5px' },
  controls: { display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' },
  field: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' },
  select: { padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', color: '#0a0f1e', background: '#fff', minWidth: '240px' },
  eventTabs: { display: 'flex', gap: '4px', background: '#fff', padding: '4px', borderRadius: '10px', border: '0.5px solid #e5e7eb' },
  eventTab: { padding: '7px 16px', borderRadius: '8px', border: 'none', background: 'none', fontSize: '14px', cursor: 'pointer', color: '#64748b', fontWeight: 500 },
  eventTabActive: { background: '#0a0f1e', color: '#fff' },
  tableWrap: { background: '#fff', borderRadius: '12px', border: '0.5px solid #e5e7eb', overflow: 'hidden', marginBottom: '1rem' },
  tableHead: { display: 'grid', gridTemplateColumns: '40px 2fr 1.5fr 80px 160px 120px', gap: '8px', padding: '10px 16px', background: '#f8f9fb', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '0.5px solid #e5e7eb' },
  tableRow: { display: 'grid', gridTemplateColumns: '40px 2fr 1.5fr 80px 160px 120px', gap: '8px', padding: '10px 16px', borderBottom: '0.5px solid #f1f5f9', alignItems: 'center' },
  orderNum: { fontSize: '13px', color: '#94a3b8', fontWeight: 500 },
  gymnName: { fontSize: '14px', fontWeight: 500, color: '#0a0f1e' },
  cell: { fontSize: '13px', color: '#64748b' },
  scoreCell: { display: 'flex', alignItems: 'center', gap: '8px' },
  scoreInput: { display: 'flex', alignItems: 'center', gap: '4px' },
  numInput: { width: '72px', padding: '6px 8px', border: '1.5px solid #e5e7eb', borderRadius: '6px', fontSize: '15px', fontWeight: 500, textAlign: 'center', color: '#0a0f1e', outline: 'none' },
  numInputFilled: { borderColor: '#10b981', background: '#f0fdf4' },
  dncBtn: { padding: '5px 8px', border: '1px solid #fde68a', borderRadius: '6px', background: '#fffbeb', color: '#92400e', fontSize: '11px', cursor: 'pointer', fontWeight: 600 },
  dncBadge: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 },
  dncUndo: { background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' },
  savingDot: { width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' },
  aaScore: { fontSize: '14px', fontWeight: 600, color: '#0a0f1e' },
  scratchedSection: { background: '#fff', borderRadius: '12px', border: '0.5px solid #e5e7eb', overflow: 'hidden', marginBottom: '1rem' },
  scratchedLabel: { padding: '8px 16px', background: '#fef9f0', fontSize: '11px', fontWeight: 600, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '0.5px solid #fde68a' },
  scratchedRow: { display: 'grid', gridTemplateColumns: '40px 2fr 1.5fr', gap: '8px', padding: '10px 16px', borderBottom: '0.5px solid #f1f5f9', alignItems: 'center' },
  hint: { fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '0.5rem' },
  emptyState: { textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: '12px', border: '0.5px solid #e5e7eb' },
  emptyText: { color: '#94a3b8', marginBottom: '1rem', fontSize: '14px' },
  primaryBtn: { background: '#0a0f1e', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '14px', cursor: 'pointer', fontWeight: 500 },
  empty: { padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '14px' },
}
