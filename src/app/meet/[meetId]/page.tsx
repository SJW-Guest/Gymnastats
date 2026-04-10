'use client'

// src/app/meet/[meetId]/page.tsx
// Central meet hub — all meet management happens here

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

interface Meet {
  id: string
  name: string
  meet_date: string
  location: string | null
  status: string
  lineup_due_date: string | null
  num_judges: number | null
  counts_for_state: boolean | null
  results_visibility: string
  host_club_id: string
  clubs: { name: string; city: string | null; state: string | null }
}

interface MeetTeam {
  id: string
  status: string
  division_id: string | null
  confirmed_at: string | null
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

export default function MeetDetailPage() {
  const { meetId } = useParams<{ meetId: string }>()
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [meet, setMeet] = useState<Meet | null>(null)
  const [meetTeams, setMeetTeams] = useState<MeetTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)

      const { data: meetData, error: meetError } = await supabase
        .from('meets')
        .select(`
          *,
          clubs (name, city, state)
        `)
        .eq('id', meetId)
        .single()

      if (meetError || !meetData) {
        setError('Meet not found.')
        setLoading(false)
        return
      }

      setMeet(meetData as Meet)

      const { data: teamsData } = await supabase
        .from('meet_teams')
        .select(`
          id,
          status,
          division_id,
          confirmed_at,
          teams (
            id,
            name,
            clubs (name)
          ),
          meet_divisions (name)
        `)
        .eq('meet_id', meetId)
        .order('status')

      setMeetTeams((teamsData as unknown as MeetTeam[]) || [])
      setLoading(false)
    }

    if (meetId) load()
  }, [meetId])

  if (loading) return (
    <div style={styles.page}>
      <div style={styles.loadingCenter}>
        <div style={styles.spinner} />
        <p style={{ color: '#6b7280', fontSize: 14 }}>Loading meet...</p>
      </div>
    </div>
  )

  if (error || !meet) return (
    <div style={styles.page}>
      <div style={styles.loadingCenter}>
        <p style={{ color: '#dc2626' }}>{error || 'Meet not found.'}</p>
        <button onClick={() => router.back()} style={styles.linkBtn}>← Go back</button>
      </div>
    </div>
  )

  const statusStyle = STATUS_COLORS[meet.status] || STATUS_COLORS.setup
  const invited   = meetTeams.filter(t => t.status === 'invited').length
  const confirmed = meetTeams.filter(t => t.status === 'confirmed').length
  const declined  = meetTeams.filter(t => t.status === 'declined').length
  const total     = meetTeams.length

  const formattedDate = meet.meet_date
    ? new Date(meet.meet_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
    : '—'

  const lineupDue = meet.lineup_due_date
    ? new Date(meet.lineup_due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  const today = new Date()
  const dueDate = meet.lineup_due_date ? new Date(meet.lineup_due_date + 'T00:00:00') : null
  const lineupOverdue = dueDate && dueDate < today && confirmed > 0

  return (
    <div style={styles.page}>

      {/* ── Header ── */}
      <div style={styles.header}>
        <div style={styles.headerInner}>
          <button onClick={() => router.back()} style={styles.backBtn}>← Back</button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={styles.title}>{meet.name}</h1>
              <span style={{ ...styles.badge, backgroundColor: statusStyle.bg, color: statusStyle.color }}>
                {meet.status}
              </span>
              {meet.counts_for_state && (
                <span style={{ ...styles.badge, backgroundColor: '#ede9fe', color: '#7c3aed' }}>
                  State qualifier
                </span>
              )}
            </div>
            <p style={styles.subtitle}>
              {formattedDate}
              {meet.location && ` · ${meet.location}`}
              {meet.clubs && ` · Hosted by ${meet.clubs.name}`}
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => router.push(`/meet/new?meetId=${meetId}`)}
              style={styles.outlineBtn}
            >
              Edit teams & divisions
            </button>
          </div>
        </div>
      </div>

      <div style={styles.content}>

        {/* ── Lineup due warning ── */}
        {lineupOverdue && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 14, color: '#dc2626' }}>
            ⚠️ Lineup due date ({lineupDue}) has passed — {confirmed} confirmed team{confirmed !== 1 ? 's' : ''} still need to submit lineups.
          </div>
        )}

        {/* ── Stats row ── */}
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <p style={styles.statNumber}>{total}</p>
            <p style={styles.statLabel}>Teams invited</p>
          </div>
          <div style={styles.statCard}>
            <p style={{ ...styles.statNumber, color: confirmed > 0 ? '#16a34a' : '#111827' }}>{confirmed}</p>
            <p style={styles.statLabel}>Confirmed</p>
          </div>
          <div style={styles.statCard}>
            <p style={{ ...styles.statNumber, color: declined > 0 ? '#dc2626' : '#111827' }}>{declined}</p>
            <p style={styles.statLabel}>Declined</p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statNumber}>{meet.num_judges ?? '—'}</p>
            <p style={styles.statLabel}>Judges</p>
          </div>
          {lineupDue && (
            <div style={styles.statCard}>
              <p style={{ ...styles.statNumber, fontSize: 16 }}>{lineupDue}</p>
              <p style={styles.statLabel}>Lineup due</p>
            </div>
          )}
        </div>

        {/* ── Quick actions ── */}
        <div style={styles.actionsRow}>
          <button onClick={() => router.push(`/lineup?meetId=${meetId}`)} style={styles.actionCard}>
            <span style={styles.actionIcon}>📋</span>
            <div>
              <p style={styles.actionTitle}>Lineup manager</p>
              <p style={styles.actionSub}>Set running order per meet</p>
            </div>
          </button>
          <button onClick={() => router.push(`/scores?meetId=${meetId}`)} style={styles.actionCard}>
            <span style={styles.actionIcon}>📊</span>
            <div>
              <p style={styles.actionTitle}>Score entry</p>
              <p style={styles.actionSub}>Enter event scores</p>
            </div>
          </button>
          <button onClick={() => router.push(`/standings?meetId=${meetId}`)} style={styles.actionCard}>
            <span style={styles.actionIcon}>🏆</span>
            <div>
              <p style={styles.actionTitle}>Meet standings</p>
              <p style={styles.actionSub}>Rankings for this meet</p>
            </div>
          </button>
        </div>

        {/* ── Teams ── */}
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={styles.sectionTitle}>Teams</h2>
            <button
              onClick={() => router.push(`/meet/new?meetId=${meetId}`)}
              style={styles.linkBtn}
            >
              + Manage teams
            </button>
          </div>

          {meetTeams.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 14 }}>
              No teams added yet.{' '}
              <button onClick={() => router.push(`/meet/new?meetId=${meetId}`)} style={styles.linkBtn}>
                Add teams →
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {/* Header row */}
              <div style={styles.tableHeader}>
                <span>Team</span>
                <span>Club</span>
                <span>Division</span>
                <span>Status</span>
              </div>
              {meetTeams.map((mt) => {
                const ts = TEAM_STATUS_COLORS[mt.status] || TEAM_STATUS_COLORS.pending
                return (
                  <div key={mt.id} style={styles.tableRow}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>
                      {(Array.isArray(mt.teams) ? mt.teams[0]?.name : mt.teams?.name) || '—'}
                    </span>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>
                      {(Array.isArray(mt.teams) ? (Array.isArray(mt.teams[0]?.clubs) ? mt.teams[0]?.clubs[0]?.name : mt.teams[0]?.clubs?.name) : (Array.isArray(mt.teams?.clubs) ? mt.teams?.clubs[0]?.name : mt.teams?.clubs?.name)) || '—'}
                    </span>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>
                      {(Array.isArray(mt.meet_divisions) ? mt.meet_divisions[0]?.name : mt.meet_divisions?.name) || '—'}
                    </span>
                    <span style={{ ...styles.badge, backgroundColor: ts.bg, color: ts.color }}>
                      {mt.status}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Meet details ── */}
        <div style={styles.card}>
          <h2 style={{ ...styles.sectionTitle, marginBottom: 16 }}>Meet details</h2>
          <div style={styles.detailGrid}>
            <div style={styles.detailItem}>
              <p style={styles.detailLabel}>Date</p>
              <p style={styles.detailValue}>{formattedDate}</p>
            </div>
            <div style={styles.detailItem}>
              <p style={styles.detailLabel}>Location</p>
              <p style={styles.detailValue}>{meet.location || '—'}</p>
            </div>
            <div style={styles.detailItem}>
              <p style={styles.detailLabel}>Status</p>
              <p style={styles.detailValue}>{meet.status}</p>
            </div>
            <div style={styles.detailItem}>
              <p style={styles.detailLabel}>Judges</p>
              <p style={styles.detailValue}>{meet.num_judges ?? '—'}</p>
            </div>
            <div style={styles.detailItem}>
              <p style={styles.detailLabel}>Results visibility</p>
              <p style={styles.detailValue}>{meet.results_visibility}</p>
            </div>
            <div style={styles.detailItem}>
              <p style={styles.detailLabel}>Counts for state</p>
              <p style={styles.detailValue}>{meet.counts_for_state ? 'Yes' : 'No'}</p>
            </div>
            {lineupDue && (
              <div style={styles.detailItem}>
                <p style={styles.detailLabel}>Lineup due</p>
                <p style={styles.detailValue}>{lineupDue}</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', backgroundColor: '#f8f9fa', fontFamily: "'DM Sans', sans-serif" },
  loadingCenter: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 12 },
  spinner: { width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#111827', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  header: { backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 24px' },
  headerInner: { maxWidth: 960, margin: '0 auto', padding: '20px 0', display: 'flex', alignItems: 'flex-start', gap: 16 },
  backBtn: { background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 14, color: '#374151', marginTop: 4, whiteSpace: 'nowrap' },
  title: { fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 },
  subtitle: { fontSize: 13, color: '#6b7280', margin: '4px 0 0' },
  badge: { display: 'inline-block', borderRadius: 99, padding: '3px 10px', fontSize: 12, fontWeight: 600 },
  outlineBtn: { border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 500, color: '#374151', background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' },
  linkBtn: { background: 'none', border: 'none', fontSize: 13, color: '#2563eb', cursor: 'pointer', padding: 0, fontWeight: 500 },
  content: { maxWidth: 960, margin: '0 auto', padding: '24px' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 20 },
  statCard: { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px', textAlign: 'center' },
  statNumber: { fontSize: 24, fontWeight: 700, color: '#111827', margin: '0 0 4px' },
  statLabel: { fontSize: 12, color: '#6b7280', margin: 0 },
  actionsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 },
  actionCard: { display: 'flex', alignItems: 'center', gap: 12, backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px', cursor: 'pointer', textAlign: 'left', width: '100%' },
  actionIcon: { fontSize: 20 },
  actionTitle: { fontSize: 14, fontWeight: 600, color: '#111827', margin: '0 0 2px' },
  actionSub: { fontSize: 12, color: '#6b7280', margin: 0 },
  card: { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 },
  tableHeader: { display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 1fr', gap: 12, padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' },
  tableRow: { display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 1fr', gap: 12, padding: '12px', borderRadius: 8, alignItems: 'center', backgroundColor: '#fafafa', marginBottom: 2 },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 },
  detailItem: {},
  detailLabel: { fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' },
  detailValue: { fontSize: 14, color: '#111827', margin: 0, fontWeight: 500 },
}
