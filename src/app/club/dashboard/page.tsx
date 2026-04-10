'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface Club { id: string; name: string; city: string; state: string; }
interface Team { id: string; name: string; level: string | null; division_group: string | null; }
interface MeetTeamStatus { id: string; name: string; status: string; }
interface Meet {
  id: string; name: string; date: string; status: string; location: string;
  perspective: 'hosting' | 'invited'; hostClub?: string;
  teamsInvited: number; teamsConfirmed: number; hasScores: boolean;
  teams?: MeetTeamStatus[];
}
interface DashboardData {
  club: Club; season: { id: string; name: string } | null;
  user: { id: string; name: string; role: string };
  stats: { gymnasts: number; teams: number; meets: number };
  teams: Team[]; meets: Meet[];
}

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  setup:       { backgroundColor: '#fef3c7', color: '#92400e' },
  active:      { backgroundColor: '#dbeafe', color: '#1e40af' },
  scheduled:   { backgroundColor: '#dbeafe', color: '#1e40af' },
  in_progress: { backgroundColor: '#dcfce7', color: '#166534' },
  finalized:   { backgroundColor: '#f3f4f6', color: '#374151' },
  suspended:   { backgroundColor: '#fee2e2', color: '#991b1b' },
};

const NAV_ITEMS = [
  { key: 'dashboard',  label: 'Dashboard',       href: '/club/dashboard' },
  { key: 'roster',     label: 'Manage Roster',    href: '/roster' },
  { key: 'lineup',     label: 'Lineup Manager',   href: '/lineup' },
  { key: 'scores',     label: 'Score Entry',      href: '/scores' },
  { key: 'standings',  label: 'Season Standings', href: '/standings' },
];

function ClubDashboardInner() {
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [respondingId, setRespondingId] = useState<string | null>(null);

  async function loadDashboard() {
    try {
      const res = await fetch('/api/club/dashboard');
      if (res.status === 401) { router.push('/auth/login'); return; }
      if (!res.ok) throw new Error('Failed to load');
      setData(await res.json());
    } catch { setError('Failed to load dashboard data.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadDashboard(); }, [router]);

  async function handleRespond(meetId: string, teamId: string, action: 'confirm' | 'decline') {
    if (action === 'decline' && !confirm('Decline this meet invitation?')) return;
    setRespondingId(meetId + teamId);
    try {
      const res = await fetch(`/api/meets/${meetId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: teamId, action }),
      });
      if (res.ok) await loadDashboard();
    } catch { /* silent */ }
    finally { setRespondingId(null); }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  if (loading) return <div style={s.page}><div style={s.center}><div style={s.spinner}/><p style={s.loadingText}>Loading...</p></div></div>;
  if (error) return <div style={s.page}><div style={s.center}><p style={s.errorText}>⚠️ {error}</p><button style={s.retryBtn} onClick={() => window.location.reload()}>Retry</button></div></div>;
  if (!data) return null;

  const { club, season, stats, meets } = data;
  const pendingInvites = meets.filter(m => m.perspective === 'invited' && m.teams?.some(t => t.status === 'invited'));

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

      <div style={s.body}>
        <aside style={s.sidebar}>
          <div style={s.sidebarClubName}>
            <span style={s.sidebarMuted}>{club.name} </span>
            <span style={s.sidebarBold}>Dashboard</span>
          </div>
          <p style={s.sidebarSub}>{club.city}, {club.state}</p>
          <nav style={{ marginTop: 24 }}>
            {NAV_ITEMS.map(item => {
              const active = pathname === item.href;
              return (
                <button key={item.key} style={{ ...s.navItem, ...(active ? s.navActive : {}) }}
                  onClick={() => router.push(item.href)}>
                  {item.label}
                  {item.key === 'dashboard' && pendingInvites.length > 0 && (
                    <span style={s.navBadge}>{pendingInvites.length}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        <main style={s.main}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={s.seasonBadge}>
              <span style={s.seasonLabel}>Season:</span>
              <span style={s.seasonValue}>{season?.name ?? '—'}</span>
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

          {/* ── Action required: pending invitations ── */}
          {pendingInvites.length > 0 && (
            <div style={s.card}>
              <div style={s.cardHeader}>
                <h2 style={s.cardTitle}>Action Required</h2>
                <span style={s.pendingBadge}>{pendingInvites.length} pending</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pendingInvites.map(meet => {
                  const pendingTeams = meet.teams?.filter(t => t.status === 'invited') ?? [];
                  return (
                    <div key={meet.id} style={s.taskCard}>
                      <div style={s.taskLeft}>
                        <span style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>📬</span>
                        <div>
                          <p style={s.taskTitle}>
                            Meet invitation: <strong>{meet.name}</strong>
                          </p>
                          <p style={s.taskSub}>
                            Hosted by {meet.hostClub} · {formatDate(meet.date)}
                            {meet.location ? ` · ${meet.location}` : ''}
                          </p>
                          <p style={s.taskNote}>
                            {pendingTeams.length} team{pendingTeams.length !== 1 ? 's' : ''} awaiting response
                          </p>
                        </div>
                      </div>
                      <div style={s.taskRight}>
                        <button style={s.viewBtn} onClick={() => router.push(`/meet/${meet.id}`)}>
                          View meet
                        </button>
                        {pendingTeams.map(team => (
                          <div key={team.id} style={s.teamActionRow}>
                            {pendingTeams.length > 1 && (
                              <span style={{ fontSize: 12, color: '#6b7280' }}>{team.name || 'Team'}</span>
                            )}
                            <button
                              style={s.declineBtn}
                              disabled={respondingId === meet.id + team.id}
                              onClick={() => handleRespond(meet.id, team.id, 'decline')}
                            >
                              Decline
                            </button>
                            <button
                              style={s.acceptBtn}
                              disabled={respondingId === meet.id + team.id}
                              onClick={() => handleRespond(meet.id, team.id, 'confirm')}
                            >
                              {respondingId === meet.id + team.id ? 'Saving...' : 'Accept ✓'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upcoming meets */}
          <div style={s.card}>
            <div style={s.cardHeader}>
              <h2 style={s.cardTitle}>Upcoming Meets</h2>
              <button style={s.newMeetBtn} onClick={() => router.push('/meet/new')}>+ New meet</button>
            </div>
            <div style={s.tableHeader}>
              <span style={{ flex: 1 }}>Meet</span>
              <span style={s.col}>Teams Invited</span>
              <span style={s.col}>Teams Confirmed</span>
              <span style={s.col}>Meet Scores</span>
              <span style={{ width: 90 }}>Status</span>
            </div>
            {meets.length === 0 ? (
              <p style={s.empty}>No upcoming meets this season.</p>
            ) : meets.map(meet => (
              <div key={meet.id} style={s.meetRow} onClick={() => router.push(`/meet/${meet.id}`)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                    <span style={s.meetName}>{meet.name}</span>
                    <span style={{ ...s.tag, ...(meet.perspective === 'hosting' ? s.tagHost : s.tagGuest) }}>
                      {meet.perspective === 'hosting' ? 'Hosting' : `@ ${meet.hostClub}`}
                    </span>
                    {meet.perspective === 'invited' && meet.teams?.some(t => t.status === 'invited') && (
                      <span style={s.actionNeeded}>● Action needed</span>
                    )}
                  </div>
                  <p style={s.meetDate}>{formatDate(meet.date)}</p>
                </div>
                <div style={s.col}><span style={s.meetStat}>{meet.teamsInvited}</span></div>
                <div style={s.col}><span style={{ ...s.meetStat, color: meet.teamsConfirmed > 0 ? '#16a34a' : '#9ca3af' }}>{meet.teamsConfirmed}</span></div>
                <div style={s.col}>{meet.hasScores ? <span style={s.scoresYes}>✓ Entered</span> : <span style={s.scoresNo}>—</span>}</div>
                <div style={{ width: 90 }}><span style={{ ...s.statusPill, ...(STATUS_STYLES[meet.status] ?? STATUS_STYLES.setup) }}>{meet.status.replace('_', ' ')}</span></div>
              </div>
            ))}
            <button style={s.viewAll} onClick={() => router.push('/meets')}>View All</button>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function ClubDashboard() {
  return (
    <Suspense fallback={<div style={s.page}><div style={s.center}><div style={s.spinner}/></div></div>}>
      <ClubDashboardInner />
    </Suspense>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:           { minHeight: '100vh', backgroundColor: '#f8f9fa', fontFamily: "'DM Sans', sans-serif" },
  center:         { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16 },
  spinner:        { width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#111827', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  loadingText:    { color: '#6b7280', fontSize: 14, margin: 0 },
  errorText:      { color: '#dc2626', fontSize: 14, margin: 0 },
  retryBtn:       { backgroundColor: '#111827', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 14 },
  topBar:         { backgroundColor: '#111827', padding: '0 24px' },
  topBarInner:    { maxWidth: 1200, margin: '0 auto', height: 52, display: 'flex', alignItems: 'center', gap: 10 },
  topBarLogo:     { width: 28, height: 28, borderRadius: 6, backgroundColor: '#fff', color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 },
  topBarName:     { color: '#fff', fontWeight: 600, fontSize: 15 },
  topBarUser:     { color: '#9ca3af', fontSize: 13 },
  signOutBtn:     { marginLeft: 12, background: 'none', border: '1px solid #374151', borderRadius: 6, color: '#9ca3af', padding: '5px 12px', fontSize: 13, cursor: 'pointer' },
  body:           { maxWidth: 1200, margin: '0 auto', display: 'flex', minHeight: 'calc(100vh - 52px)' },
  sidebar:        { width: 220, flexShrink: 0, padding: '28px 20px', borderRight: '1px solid #e5e7eb', backgroundColor: '#fff' },
  sidebarClubName:{ fontSize: 18, fontWeight: 400, margin: '0 0 4px' },
  sidebarMuted:   { color: '#6b7280', fontWeight: 400 },
  sidebarBold:    { color: '#111827', fontWeight: 700 },
  sidebarSub:     { fontSize: 12, color: '#9ca3af', margin: 0 },
  navItem:        { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: '#374151', cursor: 'pointer', marginBottom: 2 },
  navActive:      { backgroundColor: '#111827', color: '#fff', fontWeight: 500 },
  navBadge:       { backgroundColor: '#ef4444', color: '#fff', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 700 },
  main:           { flex: 1, padding: '28px', display: 'flex', flexDirection: 'column', gap: 20 },
  seasonBadge:    { display: 'flex', alignItems: 'center', gap: 8 },
  seasonLabel:    { fontSize: 14, color: '#6b7280' },
  seasonValue:    { fontSize: 16, fontWeight: 600, color: '#111827' },
  statsGrid:      { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  statCard:       { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  statVal:        { fontSize: 32, fontWeight: 700, color: '#111827' },
  statLabel:      { fontSize: 13, color: '#6b7280' },
  card:           { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' },
  cardHeader:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle:      { fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 },
  pendingBadge:   { backgroundColor: '#fef3c7', color: '#92400e', borderRadius: 99, padding: '3px 10px', fontSize: 12, fontWeight: 600 },
  taskCard:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '16px', gap: 16 },
  taskLeft:       { display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1 },
  taskTitle:      { fontSize: 14, color: '#111827', margin: '0 0 4px' },
  taskSub:        { fontSize: 12, color: '#6b7280', margin: '0 0 4px' },
  taskNote:       { fontSize: 12, color: '#92400e', fontWeight: 500, margin: 0 },
  taskRight:      { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 },
  viewBtn:        { background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#374151', cursor: 'pointer' },
  teamActionRow:  { display: 'flex', alignItems: 'center', gap: 8 },
  declineBtn:     { background: 'none', border: '1px solid #fca5a5', borderRadius: 6, padding: '6px 14px', fontSize: 13, color: '#dc2626', cursor: 'pointer', fontWeight: 500 },
  acceptBtn:      { backgroundColor: '#111827', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  newMeetBtn:     { backgroundColor: '#111827', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  tableHeader:    { display: 'flex', alignItems: 'center', padding: '0 0 8px', borderBottom: '1px solid #e5e7eb', marginBottom: 4, fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' },
  col:            { width: 130, textAlign: 'center', flexShrink: 0 },
  meetRow:        { display: 'flex', alignItems: 'center', padding: '12px 8px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', gap: 8, borderRadius: 8 },
  meetName:       { fontSize: 14, fontWeight: 500, color: '#111827' },
  meetDate:       { fontSize: 12, color: '#9ca3af', margin: 0 },
  meetStat:       { fontSize: 15, fontWeight: 600, color: '#111827' },
  tag:            { fontSize: 11, fontWeight: 600, borderRadius: 99, padding: '2px 8px' },
  tagHost:        { backgroundColor: '#ede9fe', color: '#5b21b6' },
  tagGuest:       { backgroundColor: '#e0f2fe', color: '#0369a1' },
  actionNeeded:   { fontSize: 11, color: '#d97706', fontWeight: 600 },
  scoresYes:      { fontSize: 12, fontWeight: 600, color: '#16a34a' },
  scoresNo:       { fontSize: 14, color: '#d1d5db' },
  statusPill:     { borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' },
  viewAll:        { background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', padding: '10px 0 0', display: 'block', textAlign: 'center', width: '100%' },
  empty:          { fontSize: 14, color: '#9ca3af', textAlign: 'center', padding: '24px 0', margin: 0 },
};
