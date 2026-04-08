'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Types
interface Team {
  id: string;
  name: string;
  clubName: string;
}

interface Division {
  id: string;
  name: string;
  teamIds: string[];
}

export default function MeetCreationStep2() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const meetId = searchParams.get('meetId');

  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [newDivisionName, setNewDivisionName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'teams' | 'divisions'>('teams');

  // Fetch all MAGA teams
  useEffect(() => {
    async function fetchTeams() {
      try {
        const res = await fetch('/api/teams');
        if (!res.ok) throw new Error('Failed to fetch teams');
        const data = await res.json();
        setAllTeams(data);
      } catch (err) {
        setError('Could not load teams. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    fetchTeams();
  }, []);

  // Toggle team selection
  function toggleTeam(teamId: string) {
    setSelectedTeamIds(prev => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
        // Remove from any division if de-selected
        setDivisions(divs =>
          divs.map(d => ({ ...d, teamIds: d.teamIds.filter(id => id !== teamId) }))
        );
      } else {
        next.add(teamId);
      }
      return next;
    });
  }

  // Add a new division
  function addDivision() {
    const name = newDivisionName.trim();
    if (!name) return;
    if (divisions.some(d => d.name.toLowerCase() === name.toLowerCase())) {
      setError('A division with that name already exists.');
      return;
    }
    setDivisions(prev => [
      ...prev,
      { id: crypto.randomUUID(), name, teamIds: [] },
    ]);
    setNewDivisionName('');
    setError('');
  }

  // Remove a division
  function removeDivision(divId: string) {
    setDivisions(prev => prev.filter(d => d.id !== divId));
  }

  // Assign a team to a division (one team = one division)
  function assignTeamToDivision(teamId: string, divId: string) {
    setDivisions(prev =>
      prev.map(d => {
        if (d.id === divId) {
          // Toggle: if already in this division, remove; otherwise add
          const already = d.teamIds.includes(teamId);
          return {
            ...d,
            teamIds: already
              ? d.teamIds.filter(id => id !== teamId)
              : [...d.teamIds, teamId],
          };
        }
        // Remove from other divisions (one team = one division)
        return { ...d, teamIds: d.teamIds.filter(id => id !== teamId) };
      })
    );
  }

  // Get which division a team is in (if any)
  function getTeamDivision(teamId: string): string | null {
    const div = divisions.find(d => d.teamIds.includes(teamId));
    return div ? div.id : null;
  }

  const selectedTeams = allTeams.filter(t => selectedTeamIds.has(t.id));
  const unassignedTeams = selectedTeams.filter(t => getTeamDivision(t.id) === null);

  // Validate and save
  async function handleSave() {
    if (selectedTeamIds.size === 0) {
      setError('Please select at least one team.');
      return;
    }
    if (divisions.length === 0) {
      setError('Please create at least one division.');
      return;
    }
    if (unassignedTeams.length > 0) {
      setError(`${unassignedTeams.length} team(s) are not assigned to a division.`);
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await fetch(`/api/meets/${meetId}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamIds: Array.from(selectedTeamIds),
          divisions: divisions.map(d => ({ name: d.name, teamIds: d.teamIds })),
        }),
      });

      if (!res.ok) throw new Error('Failed to save meet setup');
      router.push(`/meet/${meetId}`);
    } catch (err) {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading teams...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerInner}>
          <button onClick={() => router.back()} style={styles.backBtn}>
            ← Back
          </button>
          <div>
            <p style={styles.stepLabel}>Meet Setup · Step 2 of 2</p>
            <h1 style={styles.title}>Teams & Divisions</h1>
          </div>
        </div>

        {/* Step tabs */}
        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(step === 'teams' ? styles.tabActive : {}) }}
            onClick={() => setStep('teams')}
          >
            <span style={styles.tabNumber}>1</span>
            Select Teams
            {selectedTeamIds.size > 0 && (
              <span style={styles.badge}>{selectedTeamIds.size}</span>
            )}
          </button>
          <div style={styles.tabDivider} />
          <button
            style={{
              ...styles.tab,
              ...(step === 'divisions' ? styles.tabActive : {}),
              ...(selectedTeamIds.size === 0 ? styles.tabDisabled : {}),
            }}
            onClick={() => selectedTeamIds.size > 0 && setStep('divisions')}
          >
            <span style={styles.tabNumber}>2</span>
            Create Divisions
            {divisions.length > 0 && (
              <span style={styles.badge}>{divisions.length}</span>
            )}
          </button>
        </div>
      </div>

      <div style={styles.content}>
        {error && (
          <div style={styles.errorBanner}>
            <span>⚠️</span> {error}
          </div>
        )}

        {/* STEP 1: Select Teams */}
        {step === 'teams' && (
          <div>
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Which teams are coming to this meet?</h2>
                <p style={styles.sectionSub}>Select all participating teams from MAGA clubs.</p>
              </div>
              {selectedTeamIds.size > 0 && (
                <button
                  style={styles.primaryBtn}
                  onClick={() => setStep('divisions')}
                >
                  Continue to Divisions →
                </button>
              )}
            </div>

            {/* Group teams by club */}
            {Object.entries(
              allTeams.reduce((acc, team) => {
                if (!acc[team.clubName]) acc[team.clubName] = [];
                acc[team.clubName].push(team);
                return acc;
              }, {} as Record<string, Team[]>)
            ).map(([clubName, teams]) => (
              <div key={clubName} style={styles.clubGroup}>
                <p style={styles.clubGroupLabel}>{clubName}</p>
                <div style={styles.teamGrid}>
                  {teams.map(team => {
                    const selected = selectedTeamIds.has(team.id);
                    return (
                      <button
                        key={team.id}
                        style={{
                          ...styles.teamCard,
                          ...(selected ? styles.teamCardSelected : {}),
                        }}
                        onClick={() => toggleTeam(team.id)}
                      >
                        <div style={styles.teamCardCheck}>
                          {selected ? '✓' : ''}
                        </div>
                        <span style={styles.teamCardName}>{team.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* STEP 2: Create Divisions & Assign Teams */}
        {step === 'divisions' && (
          <div>
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Create divisions & assign teams</h2>
                <p style={styles.sectionSub}>
                  Each selected team must be assigned to exactly one division.
                </p>
              </div>
              <button
                style={{
                  ...styles.primaryBtn,
                  ...(unassignedTeams.length > 0 || divisions.length === 0
                    ? styles.primaryBtnDisabled
                    : {}),
                }}
                onClick={handleSave}
                disabled={saving || unassignedTeams.length > 0 || divisions.length === 0}
              >
                {saving ? 'Saving...' : 'Save & Finish ✓'}
              </button>
            </div>

            <div style={styles.divisionLayout}>
              {/* Left: Unassigned teams */}
              <div style={styles.unassignedPanel}>
                <p style={styles.panelLabel}>
                  Unassigned Teams
                  {unassignedTeams.length > 0 && (
                    <span style={styles.unassignedCount}>{unassignedTeams.length}</span>
                  )}
                </p>
                {unassignedTeams.length === 0 ? (
                  <div style={styles.allAssigned}>
                    <span style={styles.allAssignedIcon}>✓</span>
                    <p style={styles.allAssignedText}>All teams assigned!</p>
                  </div>
                ) : (
                  <div style={styles.unassignedList}>
                    {unassignedTeams.map(team => (
                      <div key={team.id} style={styles.unassignedTeam}>
                        <div>
                          <p style={styles.unassignedTeamName}>{team.name}</p>
                          <p style={styles.unassignedTeamClub}>{team.clubName}</p>
                        </div>
                        <select
                          style={styles.assignSelect}
                          value=""
                          onChange={e => {
                            if (e.target.value) assignTeamToDivision(team.id, e.target.value);
                          }}
                        >
                          <option value="">Assign to...</option>
                          {divisions.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Divisions */}
              <div style={styles.divisionsPanel}>
                {/* Add division input */}
                <div style={styles.addDivisionRow}>
                  <input
                    style={styles.divisionInput}
                    type="text"
                    placeholder="Division name (e.g. Level 3, Beginner...)"
                    value={newDivisionName}
                    onChange={e => setNewDivisionName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addDivision()}
                  />
                  <button style={styles.addDivBtn} onClick={addDivision}>
                    + Add Division
                  </button>
                </div>

                {divisions.length === 0 ? (
                  <div style={styles.emptyDivisions}>
                    <p style={styles.emptyDivisionsText}>
                      No divisions yet. Add one above to get started.
                    </p>
                  </div>
                ) : (
                  <div style={styles.divisionList}>
                    {divisions.map(div => {
                      const divTeams = selectedTeams.filter(t => div.teamIds.includes(t.id));
                      return (
                        <div key={div.id} style={styles.divisionCard}>
                          <div style={styles.divisionCardHeader}>
                            <div>
                              <p style={styles.divisionName}>{div.name}</p>
                              <p style={styles.divisionTeamCount}>
                                {divTeams.length} team{divTeams.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <button
                              style={styles.removeDivBtn}
                              onClick={() => removeDivision(div.id)}
                            >
                              Remove
                            </button>
                          </div>
                          <div style={styles.divisionTeams}>
                            {divTeams.length === 0 ? (
                              <p style={styles.noTeamsYet}>No teams assigned yet</p>
                            ) : (
                              divTeams.map(team => (
                                <div key={team.id} style={styles.divisionTeamChip}>
                                  <span>{team.name}</span>
                                  <button
                                    style={styles.removeTeamBtn}
                                    onClick={() => assignTeamToDivision(team.id, div.id)}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f8f9fa',
    fontFamily: "'DM Sans', sans-serif",
  },
  header: {
    backgroundColor: '#fff',
    borderBottom: '1px solid #e5e7eb',
    padding: '0 24px',
  },
  headerInner: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '20px 0 16px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 16,
  },
  backBtn: {
    background: 'none',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '8px 14px',
    cursor: 'pointer',
    fontSize: 14,
    color: '#374151',
    marginTop: 4,
  },
  stepLabel: {
    fontSize: 12,
    color: '#9ca3af',
    margin: '0 0 4px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: '#111827',
    margin: 0,
  },
  tabs: {
    maxWidth: 960,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    paddingBottom: 0,
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 4px',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    color: '#6b7280',
    transition: 'all 0.15s',
  },
  tabActive: {
    color: '#111827',
    borderBottomColor: '#111827',
  },
  tabDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  tabDivider: {
    width: 32,
    height: 1,
    backgroundColor: '#e5e7eb',
    margin: '0 8px',
  },
  tabNumber: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    backgroundColor: '#f3f4f6',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
  },
  badge: {
    backgroundColor: '#111827',
    color: '#fff',
    borderRadius: 99,
    padding: '1px 7px',
    fontSize: 11,
    fontWeight: 600,
  },
  content: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '32px 24px',
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fca5a5',
    borderRadius: 8,
    padding: '12px 16px',
    color: '#dc2626',
    marginBottom: 24,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#111827',
    margin: '0 0 4px',
  },
  sectionSub: {
    fontSize: 14,
    color: '#6b7280',
    margin: 0,
  },
  primaryBtn: {
    backgroundColor: '#111827',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  primaryBtnDisabled: {
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed',
  },
  clubGroup: {
    marginBottom: 24,
  },
  clubGroupLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    margin: '0 0 10px',
  },
  teamGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 10,
  },
  teamCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 14px',
    backgroundColor: '#fff',
    border: '1.5px solid #e5e7eb',
    borderRadius: 10,
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'all 0.15s',
  },
  teamCardSelected: {
    backgroundColor: '#f0fdf4',
    borderColor: '#16a34a',
  },
  teamCardCheck: {
    width: 20,
    height: 20,
    borderRadius: 6,
    border: '1.5px solid #d1d5db',
    backgroundColor: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    color: '#16a34a',
    flexShrink: 0,
  },
  teamCardName: {
    fontSize: 14,
    fontWeight: 500,
    color: '#111827',
  },
  // Divisions layout
  divisionLayout: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    gap: 24,
    alignItems: 'start',
  },
  unassignedPanel: {
    backgroundColor: '#fff',
    border: '1.5px solid #e5e7eb',
    borderRadius: 12,
    padding: 16,
    position: 'sticky' as const,
    top: 24,
  },
  panelLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    margin: '0 0 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  unassignedCount: {
    backgroundColor: '#fef3c7',
    color: '#d97706',
    borderRadius: 99,
    padding: '1px 7px',
    fontSize: 11,
    fontWeight: 700,
  },
  allAssigned: {
    textAlign: 'center' as const,
    padding: '24px 0',
  },
  allAssignedIcon: {
    fontSize: 28,
    display: 'block',
    marginBottom: 8,
  },
  allAssignedText: {
    fontSize: 14,
    color: '#16a34a',
    fontWeight: 500,
    margin: 0,
  },
  unassignedList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  unassignedTeam: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    backgroundColor: '#fafafa',
    borderRadius: 8,
    border: '1px solid #f3f4f6',
  },
  unassignedTeamName: {
    fontSize: 13,
    fontWeight: 500,
    color: '#111827',
    margin: '0 0 2px',
  },
  unassignedTeamClub: {
    fontSize: 11,
    color: '#9ca3af',
    margin: 0,
  },
  assignSelect: {
    fontSize: 12,
    padding: '5px 8px',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    backgroundColor: '#fff',
    color: '#374151',
    cursor: 'pointer',
  },
  divisionsPanel: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },
  addDivisionRow: {
    display: 'flex',
    gap: 10,
  },
  divisionInput: {
    flex: 1,
    padding: '10px 14px',
    border: '1.5px solid #e5e7eb',
    borderRadius: 8,
    fontSize: 14,
    color: '#111827',
    outline: 'none',
  },
  addDivBtn: {
    backgroundColor: '#fff',
    border: '1.5px solid #111827',
    color: '#111827',
    borderRadius: 8,
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  emptyDivisions: {
    backgroundColor: '#fff',
    border: '1.5px dashed #e5e7eb',
    borderRadius: 12,
    padding: '40px 24px',
    textAlign: 'center' as const,
  },
  emptyDivisionsText: {
    color: '#9ca3af',
    fontSize: 14,
    margin: 0,
  },
  divisionList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  divisionCard: {
    backgroundColor: '#fff',
    border: '1.5px solid #e5e7eb',
    borderRadius: 12,
    padding: 16,
  },
  divisionCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  divisionName: {
    fontSize: 15,
    fontWeight: 600,
    color: '#111827',
    margin: '0 0 2px',
  },
  divisionTeamCount: {
    fontSize: 12,
    color: '#6b7280',
    margin: 0,
  },
  removeDivBtn: {
    background: 'none',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    color: '#6b7280',
    cursor: 'pointer',
  },
  divisionTeams: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 8,
    minHeight: 36,
  },
  noTeamsYet: {
    fontSize: 13,
    color: '#d1d5db',
    fontStyle: 'italic' as const,
    margin: 0,
    alignSelf: 'center',
  },
  divisionTeamChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: 99,
    padding: '4px 10px 4px 12px',
    fontSize: 13,
    color: '#0369a1',
    fontWeight: 500,
  },
  removeTeamBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#0369a1',
    fontSize: 16,
    lineHeight: 1,
    padding: 0,
    fontWeight: 700,
  },
  // Loading
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    gap: 16,
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #e5e7eb',
    borderTopColor: '#111827',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 14,
    margin: 0,
  },
};
