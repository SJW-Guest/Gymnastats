'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ScoringRules {
  scores_per_event: number;
  meets_for_standings: number;
}

interface Season {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  state_meet_min_qualifiers: number;
  scoring_rules: ScoringRules | null;
}

interface Stats {
  clubs: number;
  teams: number;
  gymnasts: number;
  meets: number;
}

interface Meet {
  id: string;
  name: string;
  meet_date: string;
  status: string;
  location: string;
  host_club: { name: string } | null;
}

interface Standing {
  rank: number;
  teamId: string;
  teamName: string;
  clubName: string;
  meetsAttended: number;
  meetsCounting: number;
  bestMeetsTotal: number;
  qualifiesForState: boolean;
}

interface ClubContact {
  id: string;
  name: string;
  contact_email: string;
  contact_phone: string;
  city: string;
  state: string;
}

type NavSection = 'standings' | 'contacts' | 'maga-contacts' | 'scoring-rules';

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  setup:       { backgroundColor: '#fef3c7', color: '#92400e' },
  scheduled:   { backgroundColor: '#dbeafe', color: '#1e40af' },
  in_progress: { backgroundColor: '#dcfce7', color: '#166534' },
  finalized:   { backgroundColor: '#f3f4f6', color: '#374151' },
  suspended:   { backgroundColor: '#fee2e2', color: '#991b1b' },
};

// ─── Main dashboard ───────────────────────────────────────────────────────────
function MAGADashboardInner() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<NavSection>('standings');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [season, setSeason] = useState<Season | null>(null);
  const [stats, setStats] = useState<Stats>({ clubs: 0, teams: 0, gymnasts: 0, meets: 0 });
  const [upcomingMeets, setUpcomingMeets] = useState<Meet[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [clubContacts, setClubContacts] = useState<ClubContact[]>([]);

  // Scoring rules edit state
  const [editingRules, setEditingRules] = useState(false);
  const [rulesForm, setRulesForm] = useState<ScoringRules>({ scores_per_event: 4, meets_for_standings: 5 });
  const [rulesSaving, setRulesSaving] = useState(false);
  const [rulesSuccess, setRulesSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/maga/dashboard');
        if (!res.ok) throw new Error('Failed to load dashboard');
        const data = await res.json();
        setSeason(data.season);
        setStats(data.stats);
        setUpcomingMeets(data.upcomingMeets);
        setStandings(data.standings);
        setClubContacts(data.clubContacts);
        if (data.season?.scoring_rules) {
          setRulesForm(data.season.scoring_rules);
        }
      } catch (e) {
        setError('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function saveRules() {
    if (!season) return;
    setRulesSaving(true);
    try {
      const res = await fetch(`/api/seasons/${season.id}/scoring-rules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rulesForm),
      });
      if (!res.ok) throw new Error();
      setEditingRules(false);
      setRulesSuccess(true);
      setTimeout(() => setRulesSuccess(false), 3000);
    } catch {
      setError('Failed to save scoring rules.');
    } finally {
      setRulesSaving(false);
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  if (loading) return (
    <div style={s.page}>
      <div style={s.loadingWrap}>
        <div style={s.spinner} />
        <p style={s.loadingText}>Loading dashboard...</p>
      </div>
    </div>
  );

  const seasonLabel = season
    ? `${new Date(season.start_date).getFullYear()} – ${new Date(season.end_date).getFullYear()}`
    : '—';

  return (
    <div style={s.page}>
      {/* ── Top bar ── */}
      <div style={s.topBar}>
        <div style={s.topBarInner}>
          <div style={s.topBarLogo}>G</div>
          <span style={s.topBarName}>Gymnastats</span>
          <div style={{ flex: 1 }} />
          <span style={s.topBarUser}>MAGA Administrator</span>
          <button style={s.signOutBtn} onClick={() => router.push('/auth/signout')}>Sign out</button>
        </div>
      </div>

      <div style={s.layout}>
        {/* ── Sidebar ── */}
        <aside style={s.sidebar}>
          <div style={s.sidebarTitle}>
            <span style={s.sidebarTitleMuted}>MAGA</span>
            <span style={s.sidebarTitleBold}>Dashboard</span>
          </div>
          <p style={s.sidebarSub}>MAGA Administrator</p>
          <nav style={s.nav}>
            {([
              ['standings',    'Season Standings'],
              ['contacts',     'Club Contacts'],
              ['maga-contacts','MAGA Contacts'],
              ['scoring-rules','Scoring Rules'],
            ] as [NavSection, string][]).map(([key, label]) => (
              <button
                key={key}
                style={{ ...s.navItem, ...(activeSection === key ? s.navItemActive : {}) }}
                onClick={() => setActiveSection(key)}
              >
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* ── Main ── */}
        <main style={s.main}>
          {/* Season label */}
          <div style={s.seasonRow}>
            <span style={s.seasonLabel}>Current Season:</span>
            <span style={s.seasonValue}>{seasonLabel}</span>
          </div>

          {error && <div style={s.errorBanner}>⚠️ {error}</div>}
          {rulesSuccess && <div style={s.successBanner}>✓ Scoring rules saved successfully.</div>}

          {/* ── Stats ── */}
          <div style={s.statsGrid}>
            {([
              [stats.clubs,    'Clubs'],
              [stats.teams,    'Teams'],
              [stats.gymnasts, 'Gymnasts'],
              [stats.meets,    'Meets'],
            ] as [number, string][]).map(([val, label]) => (
              <div key={label} style={s.statCard}>
                <span style={s.statVal}>{val}</span>
                <span style={s.statLabel}>{label}</span>
              </div>
            ))}
          </div>

          {/* ── Upcoming meets ── */}
          <div style={s.card}>
            <div style={s.cardHeader}>
              <h2 style={s.cardTitle}>Upcoming Meets</h2>
              <span style={s.cardHeaderRight}>Status</span>
            </div>
            {upcomingMeets.length === 0 ? (
              <p style={s.emptyState}>No upcoming meets.</p>
            ) : (
              upcomingMeets.map(meet => (
                <div
                  key={meet.id}
                  style={s.meetRow}
                  onClick={() => router.push(`/meet/${meet.id}`)}
                >
                  <div>
                    <p style={s.meetName}>{meet.name}</p>
                    <p style={s.meetDate}>{formatDate(meet.meet_date)}{meet.host_club ? ` · ${meet.host_club.name}` : ''}</p>
                  </div>
                  <span style={{ ...s.statusPill, ...(STATUS_STYLES[meet.status] ?? STATUS_STYLES.setup) }}>
                    {meet.status.replace('_', ' ')}
                  </span>
                </div>
              ))
            )}
            <button style={s.viewAllBtn} onClick={() => router.push('/meets')}>View All</button>
          </div>

          {/* ── Season standings (active section) ── */}
          {activeSection === 'standings' && (
            <div style={s.card}>
              <div style={s.cardHeader}>
                <h2 style={s.cardTitle}>Season Team Scores</h2>
                <button style={s.viewAllBtn} onClick={() => router.push('/standings')}>View All</button>
              </div>
              {standings.length === 0 ? (
                <p style={s.emptyState}>No standings data yet.</p>
              ) : (
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Rank</th>
                      <th style={s.th}>Team</th>
                      <th style={s.th}>Club</th>
                      <th style={{ ...s.th, textAlign: 'center' }}>Meets</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Score</th>
                      <th style={{ ...s.th, textAlign: 'center' }}>State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map(row => (
                      <tr key={row.teamId} style={s.tr}>
                        <td style={{ ...s.td, fontWeight: 600, color: row.rank <= 3 ? '#d97706' : '#111827' }}>
                          {row.rank}
                        </td>
                        <td style={s.td}>{row.teamName}</td>
                        <td style={{ ...s.td, color: '#6b7280' }}>{row.clubName}</td>
                        <td style={{ ...s.td, textAlign: 'center', color: '#6b7280' }}>
                          {row.meetsCounting}/{row.meetsAttended}
                        </td>
                        <td style={{ ...s.td, textAlign: 'right', fontWeight: 600 }}>
                          {row.bestMeetsTotal.toFixed(3)}
                        </td>
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          {row.qualifiesForState ? (
                            <span style={s.qualifyBadge}>✓</span>
                          ) : (
                            <span style={s.noQualifyBadge}>–</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Club contacts ── */}
          {activeSection === 'contacts' && (
            <div style={s.card}>
              <h2 style={s.cardTitle}>Club Contacts</h2>
              {clubContacts.length === 0 ? (
                <p style={s.emptyState}>No clubs found.</p>
              ) : (
                clubContacts.map(club => (
                  <div key={club.id} style={s.contactRow}>
                    <div>
                      <p style={s.contactName}>{club.name}</p>
                      <p style={s.contactSub}>{club.city}, {club.state}</p>
                    </div>
                    <div style={s.contactDetails}>
                      {club.contact_email && (
                        <a href={`mailto:${club.contact_email}`} style={s.contactLink}>
                          {club.contact_email}
                        </a>
                      )}
                      {club.contact_phone && (
                        <span style={s.contactPhone}>{club.contact_phone}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Scoring rules ── */}
          {activeSection === 'scoring-rules' && (
            <div style={s.card}>
              <div style={s.cardHeader}>
                <div>
                  <h2 style={s.cardTitle}>Scoring Rules</h2>
                  <p style={s.cardSubtitle}>Season {seasonLabel} · applies to all teams</p>
                </div>
                {!editingRules && (
                  <button style={s.editBtn} onClick={() => setEditingRules(true)}>Edit</button>
                )}
              </div>

              <div style={s.rulesGrid}>
                {/* Scores per event */}
                <div style={s.ruleCard}>
                  <p style={s.ruleLabel}>Top scores per event</p>
                  <p style={s.ruleDesc}>
                    The top <strong>{editingRules ? rulesForm.scores_per_event : (season?.scoring_rules?.scores_per_event ?? 4)}</strong> gymnast
                    scores from each event (vault, bars, beam, floor) count toward the team's meet total.
                  </p>
                  {editingRules && (
                    <div style={s.ruleInputRow}>
                      <button
                        style={s.stepBtn}
                        onClick={() => setRulesForm(f => ({ ...f, scores_per_event: Math.max(1, f.scores_per_event - 1) }))}
                      >−</button>
                      <span style={s.stepVal}>{rulesForm.scores_per_event}</span>
                      <button
                        style={s.stepBtn}
                        onClick={() => setRulesForm(f => ({ ...f, scores_per_event: Math.min(10, f.scores_per_event + 1) }))}
                      >+</button>
                    </div>
                  )}
                </div>

                {/* Meets for standings */}
                <div style={s.ruleCard}>
                  <p style={s.ruleLabel}>Best meets for state standing</p>
                  <p style={s.ruleDesc}>
                    A team's best <strong>{editingRules ? rulesForm.meets_for_standings : (season?.scoring_rules?.meets_for_standings ?? 5)}</strong> meet
                    scores are summed to determine their season standing and state qualification.
                  </p>
                  {editingRules && (
                    <div style={s.ruleInputRow}>
                      <button
                        style={s.stepBtn}
                        onClick={() => setRulesForm(f => ({ ...f, meets_for_standings: Math.max(1, f.meets_for_standings - 1) }))}
                      >−</button>
                      <span style={s.stepVal}>{rulesForm.meets_for_standings}</span>
                      <button
                        style={s.stepBtn}
                        onClick={() => setRulesForm(f => ({ ...f, meets_for_standings: Math.min(20, f.meets_for_standings + 1) }))}
                      >+</button>
                    </div>
                  )}
                </div>
              </div>

              {editingRules && (
                <div style={s.ruleActions}>
                  <button style={s.cancelBtn} onClick={() => setEditingRules(false)}>Cancel</button>
                  <button style={s.saveBtn} onClick={saveRules} disabled={rulesSaving}>
                    {rulesSaving ? 'Saving...' : 'Save Rules'}
                  </button>
                </div>
              )}

              <div style={s.rulesNote}>
                <p style={s.rulesNoteText}>
                  ℹ️ Changes take effect immediately and will recalculate all season standings.
                  Contact your Supabase administrator if you need to override standings for individual teams.
                </p>
              </div>
            </div>
          )}

          {/* ── MAGA contacts placeholder ── */}
          {activeSection === 'maga-contacts' && (
            <div style={s.card}>
              <h2 style={s.cardTitle}>MAGA Contacts</h2>
              <p style={s.emptyState}>MAGA contact directory coming soon.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function MAGADashboard() {
  return (
    <Suspense fallback={
      <div style={s.page}>
        <div style={s.loadingWrap}>
          <div style={s.spinner} />
        </div>
      </div>
    }>
      <MAGADashboardInner />
    </Suspense>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  page:            { minHeight: '100vh', backgroundColor: '#f8f9fa', fontFamily: "'DM Sans', sans-serif" },
  loadingWrap:     { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16 },
  spinner:         { width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#111827', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  loadingText:     { color: '#6b7280', fontSize: 14, margin: 0 },

  topBar:          { backgroundColor: '#111827', padding: '0 24px' },
  topBarInner:     { maxWidth: 1200, margin: '0 auto', height: 52, display: 'flex', alignItems: 'center', gap: 10 },
  topBarLogo:      { width: 28, height: 28, borderRadius: 6, backgroundColor: '#fff', color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 },
  topBarName:      { color: '#fff', fontWeight: 600, fontSize: 15 },
  topBarUser:      { color: '#9ca3af', fontSize: 13 },
  signOutBtn:      { marginLeft: 12, background: 'none', border: '1px solid #374151', borderRadius: 6, color: '#9ca3af', padding: '5px 12px', fontSize: 13, cursor: 'pointer' },

  layout:          { maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '220px 1fr', gap: 0, minHeight: 'calc(100vh - 52px)' },

  sidebar:         { backgroundColor: '#fff', borderRight: '1px solid #e5e7eb', padding: '28px 20px' },
  sidebarTitle:    { fontSize: 20, marginBottom: 2 },
  sidebarTitleMuted: { color: '#6b7280', fontWeight: 400 },
  sidebarTitleBold:  { color: '#111827', fontWeight: 700 },
  sidebarSub:      { fontSize: 12, color: '#9ca3af', margin: '0 0 24px' },
  nav:             { display: 'flex', flexDirection: 'column', gap: 2 },
  navItem:         { background: 'none', border: 'none', textAlign: 'left', padding: '9px 12px', borderRadius: 8, fontSize: 14, color: '#374151', cursor: 'pointer' },
  navItemActive:   { backgroundColor: '#f3f4f6', fontWeight: 600, color: '#111827' },

  main:            { padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 },

  seasonRow:       { display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' },
  seasonLabel:     { fontSize: 14, color: '#6b7280' },
  seasonValue:     { fontSize: 16, fontWeight: 600, color: '#111827' },

  errorBanner:     { backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 14 },
  successBanner:   { backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', color: '#16a34a', fontSize: 14 },

  statsGrid:       { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },
  statCard:        { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  statVal:         { fontSize: 28, fontWeight: 700, color: '#111827' },
  statLabel:       { fontSize: 13, color: '#6b7280' },

  card:            { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' },
  cardHeader:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle:       { fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 },
  cardSubtitle:    { fontSize: 12, color: '#9ca3af', margin: '2px 0 0' },
  cardHeaderRight: { fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' },

  meetRow:         { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' },
  meetName:        { fontSize: 14, fontWeight: 500, color: '#111827', margin: '0 0 2px' },
  meetDate:        { fontSize: 12, color: '#9ca3af', margin: 0 },
  statusPill:      { borderRadius: 99, padding: '3px 10px', fontSize: 12, fontWeight: 500 },

  viewAllBtn:      { background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', padding: '8px 0 0', display: 'block', textAlign: 'center', width: '100%' },

  table:           { width: '100%', borderCollapse: 'collapse' },
  th:              { fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 10px', borderBottom: '1px solid #e5e7eb', textAlign: 'left' },
  tr:              { borderBottom: '1px solid #f9fafb' },
  td:              { padding: '10px 10px', fontSize: 14, color: '#111827' },
  qualifyBadge:    { backgroundColor: '#dcfce7', color: '#166534', borderRadius: 99, padding: '2px 8px', fontSize: 12, fontWeight: 600 },
  noQualifyBadge:  { color: '#d1d5db', fontSize: 14 },

  contactRow:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f3f4f6' },
  contactName:     { fontSize: 14, fontWeight: 500, color: '#111827', margin: '0 0 2px' },
  contactSub:      { fontSize: 12, color: '#9ca3af', margin: 0 },
  contactDetails:  { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 },
  contactLink:     { fontSize: 13, color: '#2563eb', textDecoration: 'none' },
  contactPhone:    { fontSize: 13, color: '#6b7280' },

  // Scoring rules
  editBtn:         { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 7, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', color: '#374151' },
  rulesGrid:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8 },
  ruleCard:        { backgroundColor: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 10, padding: '16px 18px' },
  ruleLabel:       { fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' },
  ruleDesc:        { fontSize: 14, color: '#374151', lineHeight: 1.6, margin: 0 },
  ruleInputRow:    { display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 },
  stepBtn:         { width: 32, height: 32, borderRadius: 8, border: '1.5px solid #e5e7eb', backgroundColor: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111827', fontWeight: 500 },
  stepVal:         { fontSize: 22, fontWeight: 700, color: '#111827', minWidth: 32, textAlign: 'center' },
  ruleActions:     { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 },
  cancelBtn:       { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 18px', fontSize: 14, cursor: 'pointer', color: '#374151' },
  saveBtn:         { backgroundColor: '#111827', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#fff' },
  rulesNote:       { marginTop: 20, padding: '12px 16px', backgroundColor: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' },
  rulesNoteText:   { fontSize: 13, color: '#0369a1', margin: 0, lineHeight: 1.5 },
};
