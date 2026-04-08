'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Club { id: string; name: string; city: string; state: string; }
interface Team { id: string; name: string; level: string | null; division_group: string | null; }
interface Meet {
  id: string; name: string; date: string; status: string; location: string;
  perspective: 'hosting' | 'invited'; hostClub?: string;
  teamsInvited: number; teamsConfirmed: number; hasScores: boolean;
  teams?: { id: string; name: string; status: string }[];
}
interface DashboardData {
  club: Club; season: { id: string; name: string } | null;
  user: { id: string; name: string; role: string };
  stats: { gymnasts: number; teams: number; meets: number };
  teams: Team[]; meets: Meet[];
}

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  setup:       { backgroundColor: '#fef3c7', color: '#92400e' },
  scheduled:   { backgroundColor: '#dbeafe', color: '#1e40af' },
  in_progress: { backgroundColor: '#dcfce7', color: '#166534' },
  finalized:   { backgroundColor: '#f3f4f6', color: '#374151' },
  suspended:   { backgroundColor: '#fee2e2', color: '#991b1b' },
};

const QUICK_ACTIONS = [
  { key: 'roster',    icon: '👥', title: 'Manage roster',    sub: 'Add and edit gymnasts',      href: '/roster' },
  { key: 'lineup',    icon: '📋', title: 'Lineup manager',   sub: 'Set running order per meet', href: '/lineup' },
  { key: 'scores',    icon: '📊', title: 'Score entry',      sub: 'Enter event scores',         href: '/scores' },
  { key: 'standings', icon: '🏆', title: 'Season standings', sub: 'Rankings across all meets',  href: '/standings' },
];

function ClubDashboardInner() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedMeet, setExpandedMeet] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Same pattern as MAGA dashboard — just call the API, no session check needed
        const res = await fetch('/api/club/dashboard');
        if (res.status === 401) { router.push('/auth/login'); return; }
        if (!res.ok) throw new Error('Failed to load');
        const json = await res.json();
        setData(json);
      } catch {
        setError('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  if (loading) return (
    <div style={s.page}><div style={s.loadingWrap}><div style={s.spinner} /><p style={s.loadingText}>Loading dashboard...</p></div></div>
  );

  if (error) return (
    <div style={s.page}><div style={s.loadingWrap}><p style={s.errorText}>⚠️ {error}</p><button style={s.retryBtn} onClick={() => window.location.reload()}>Retry</button></div></div>
  );

  if (!data) return null;

  const { club, season, stats, meets } = data;

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <div style={s.topBarInner}>
          <div style={s.topBarLogo}>G</div>
          <span style={s.topBarName}>Gymnastats</span>
          <div style={{ flex: 1 }} />
          <span style={s.topBarUser}>{data.user.name}</span>
          <button style={s.signOutBtn} onClick={() => router.push('/auth/signout')}>Sign out</button>
        </div>
      </div>

      <div style={s.layout}>
        <div style={s.pageHeader}>
          <div>
            <h1 style={s.pageTitle}>
              <span style={s.pageTitleMuted}>{club.name} </span>
              <span style={s.pageTitleBold}>Dashboard</span>
            </h1>
            <p style={s.pageSubtitle}>{club.city}, {club.state}</p>
          </div>
          <div style={s.seasonBadge}>
            <span style={s.seasonBadgeLabel}>Season:</span>
            <span style={s.seasonBadgeValue}>{season?.name ?? '—'}</span>
          </div>
        </div>

        <div style={s.statsGrid}>
          {([
            [stats.gymnasts, 'Gymnasts'],
            [stats.teams,    'Teams'],
            [stats.meets,    'Meets'],
          ] as [number, string][]).map(([val, label]) => (
            <div key={label} style={s.statCard}>
              <span style={s.statVal}>{val}</span>
              <span style={s.statLabel}>{label}</span>
            </div>
          ))}
        </div>

        <div style={s.card}>
          <div style={s.cardHeader}>
            <h2 style={s.cardTitle}>Upcoming Meets</h2>
            <button style={s.newMeetBtn} onClick={() => router.push('/meet/new')}>+ New meet</button>
          </div>
          <div style={s.meetsTableHeader}>
            <span style={{ flex: 1 }}>Meet</span>
            <span style={s.meetsCol}>Teams Invited</span>
            <span style={s.meetsCol}>Teams Confirmed</span>
            <span style={s.meetsCol}>Meet Scores</span>
            <span style={{ width: 90 }}>Status</span>
          </div>
          {meets.length === 0 ? (
            <p style={s.emptyState}>No upcoming meets this season.</p>
          ) : meets.map(meet => (
            <div key={meet.id}>
              <div style={{ ...s.meetRow, ...(expandedMeet === meet.id ? s.meetRowExpanded : {}) }} onClick={() => setExpandedMeet(p => p === meet.id ? null : meet.id)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.meetNameRow}>
                    <span style={s.meetName}>{meet.name}</span>
                    <span style={{ ...s.perspectiveTag, ...(meet.perspective === 'hosting' ? s.perspectiveTagHost : s.perspectiveTagGuest) }}>
                      {meet.perspective === 'hosting' ? 'Hosting' : `@ ${meet.hostClub}`}
                    </span>
                  </div>
                  <p style={s.meetDate}>{formatDate(meet.date)}</p>
                </div>
                <div style={s.meetsCol}><span style={s.meetStat}>{meet.teamsInvited}</span></div>
                <div style={s.meetsCol}><span style={{ ...s.meetStat, color: meet.teamsConfirmed > 0 ? '#16a34a' : '#9ca3af' }}>{meet.teamsConfirmed}</span></div>
                <div style={s.meetsCol}>{meet.hasScores ? <span style={s.scoresYes}>✓ Entered</span> : <span style={s.scoresNo}>—</span>}</div>
                <div style={{ width: 90 }}><span style={{ ...s.statusPill, ...(STATUS_STYLES[meet.status] ?? STATUS_STYLES.setup) }}>{meet.status.replace('_', ' ')}</span></div>
              </div>
              {expandedMeet === meet.id && meet.teams && meet.teams.length > 0 && (
                <div style={s.expandedPanel}>
                  <p style={s.expandedTitle}>Teams</p>
                  {meet.teams.map(team => (
                    <div key={team.id} style={s.expandedTeamRow}>
                      <span style={s.expandedTeamName}>{team.name}</span>
                      <span style={{ ...s.teamStatusPill, ...(team.status === 'confirmed' ? s.teamStatusConfirmed : team.status === 'declined' ? s.teamStatusDeclined : s.teamStatusInvited) }}>{team.status}</span>
                    </div>
                  ))}
                  <div style={s.expandedActions}>
                    <button style={s.expandedActionBtn} onClick={e => { e.stopPropagation(); router.push(`/meet/${meet.id}`); }}>View meet →</button>
                    {meet.perspective === 'invited' && <button style={s.expandedActionBtn} onClick={e => { e.stopPropagation(); router.push(`/meet/${meet.id}/confirm`); }}>Confirm attendance →</button>}
                  </div>
                </div>
              )}
            </div>
          ))}
          <button style={s.viewAllBtn} onClick={() => router.push('/meets')}>View All</button>
        </div>

        <div style={s.quickActionsGrid}>
          {QUICK_ACTIONS.map(action => (
            <button key={action.key} style={s.quickActionCard} onClick={() => router.push(action.href)}>
              <span style={s.quickActionIcon}>{action.icon}</span>
              <div style={s.quickActionText}>
                <p style={s.quickActionTitle}>{action.title}</p>
                <p style={s.quickActionSub}>{action.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ClubDashboard() {
  return (
    <Suspense fallback={<div style={s.page}><div style={s.loadingWrap}><div style={s.spinner} /></div></div>}>
      <ClubDashboardInner />
    </Suspense>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:           { minHeight: '100vh', backgroundColor: '#f8f9fa', fontFamily: "'DM Sans', sans-serif" },
  loadingWrap:    { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16 },
  spinner:        { width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#111827', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  loadingText:    { color: '#6b7280', fontSize: 14, margin: 0 },
  errorText:      { color: '#dc2626', fontSize: 14, margin: 0 },
  retryBtn:       { backgroundColor: '#111827', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 14 },
  topBar:         { backgroundColor: '#111827', padding: '0 24px' },
  topBarInner:    { maxWidth: 1100, margin: '0 auto', height: 52, display: 'flex', alignItems: 'center', gap: 10 },
  topBarLogo:     { width: 28, height: 28, borderRadius: 6, backgroundColor: '#fff', color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 },
  topBarName:     { color: '#fff', fontWeight: 600, fontSize: 15 },
  topBarUser:     { color: '#9ca3af', fontSize: 13 },
  signOutBtn:     { marginLeft: 12, background: 'none', border: '1px solid #374151', borderRadius: 6, color: '#9ca3af', padding: '5px 12px', fontSize: 13, cursor: 'pointer' },
  layout:         { maxWidth: 1100, margin: '0 auto', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 20 },
  pageHeader:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  pageTitle:      { fontSize: 24, margin: '0 0 4px', fontWeight: 400 },
  pageTitleMuted: { color: '#6b7280', fontWeight: 400 },
  pageTitleBold:  { color: '#111827', fontWeight: 700 },
  pageSubtitle:   { fontSize: 13, color: '#9ca3af', margin: 0 },
  seasonBadge:    { display: 'flex', alignItems: 'center', gap: 8 },
  seasonBadgeLabel: { fontSize: 14, color: '#6b7280' },
  seasonBadgeValue: { fontSize: 16, fontWeight: 600, color: '#111827' },
  statsGrid:      { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  statCard:       { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  statVal:        { fontSize: 32, fontWeight: 700, color: '#111827' },
  statLabel:      { fontSize: 13, color: '#6b7280' },
  card:           { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' },
  cardHeader:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle:      { fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 },
  newMeetBtn:     { backgroundColor: '#111827', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  meetsTableHeader: { display: 'flex', alignItems: 'center', padding: '0 0 8px', borderBottom: '1px solid #e5e7eb', marginBottom: 4, fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' },
  meetsCol:       { width: 130, textAlign: 'center', flexShrink: 0 },
  meetRow:        { display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', gap: 8 },
  meetRowExpanded:{ backgroundColor: '#fafafa', borderRadius: 8, padding: '12px 8px', marginBottom: 2 },
  meetNameRow:    { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 },
  meetName:       { fontSize: 14, fontWeight: 500, color: '#111827' },
  meetDate:       { fontSize: 12, color: '#9ca3af', margin: 0 },
  meetStat:       { fontSize: 15, fontWeight: 600, color: '#111827' },
  perspectiveTag:       { fontSize: 11, fontWeight: 600, borderRadius: 99, padding: '2px 8px' },
  perspectiveTagHost:   { backgroundColor: '#ede9fe', color: '#5b21b6' },
  perspectiveTagGuest:  { backgroundColor: '#e0f2fe', color: '#0369a1' },
  scoresYes:      { fontSize: 12, fontWeight: 600, color: '#16a34a' },
  scoresNo:       { fontSize: 14, color: '#d1d5db' },
  statusPill:     { borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' },
  expandedPanel:      { backgroundColor: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 8, padding: '12px 16px', marginBottom: 8 },
  expandedTitle:      { fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' },
  expandedTeamRow:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  expandedTeamName:   { fontSize: 13, color: '#111827' },
  teamStatusPill:     { fontSize: 11, fontWeight: 600, borderRadius: 99, padding: '2px 8px' },
  teamStatusConfirmed:{ backgroundColor: '#dcfce7', color: '#166534' },
  teamStatusInvited:  { backgroundColor: '#fef3c7', color: '#92400e' },
  teamStatusDeclined: { backgroundColor: '#fee2e2', color: '#991b1b' },
  expandedActions:    { display: 'flex', gap: 10, marginTop: 12 },
  expandedActionBtn:  { background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#374151', cursor: 'pointer' },
  viewAllBtn:     { background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', padding: '10px 0 0', display: 'block', textAlign: 'center', width: '100%' },
  quickActionsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },
  quickActionCard:  { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' },
  quickActionIcon:  { fontSize: 22, flexShrink: 0 },
  quickActionText:  { display: 'flex', flexDirection: 'column', gap: 2 },
  quickActionTitle: { fontSize: 14, fontWeight: 500, color: '#111827', margin: 0 },
  quickActionSub:   { fontSize: 12, color: '#9ca3af', margin: 0 },
  emptyState:     { fontSize: 14, color: '#9ca3af', textAlign: 'center', padding: '24px 0', margin: 0 },
};
