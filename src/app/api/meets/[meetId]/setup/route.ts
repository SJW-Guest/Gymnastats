// src/app/api/meets/[meetId]/setup/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface DivisionInput {
  name: string;
  teamIds: string[];
}

interface SetupBody {
  teamIds: string[];
  divisions: DivisionInput[];
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ meetId: string }> }
) {
  const { meetId } = await params;

  // ── 1. Parse & validate body ────────────────────────────────────────────
  let body: SetupBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { teamIds, divisions } = body;

  if (!Array.isArray(teamIds) || teamIds.length === 0) {
    return NextResponse.json(
      { error: 'At least one team is required' },
      { status: 400 }
    );
  }

  if (!Array.isArray(divisions) || divisions.length === 0) {
    return NextResponse.json(
      { error: 'At least one division is required' },
      { status: 400 }
    );
  }

  // Every selected team must be in exactly one division
  const assignedTeamIds = divisions.flatMap(d => d.teamIds);
  const unassigned = teamIds.filter(id => !assignedTeamIds.includes(id));
  if (unassigned.length > 0) {
    return NextResponse.json(
      { error: `${unassigned.length} team(s) are not assigned to a division` },
      { status: 400 }
    );
  }

  // ── 2. Verify meet exists ───────────────────────────────────────────────
  const { data: meet, error: meetError } = await supabaseAdmin
    .from('meets')
    .select('id, status')
    .eq('id', meetId)
    .single();

  if (meetError || !meet) {
    return NextResponse.json({ error: 'Meet not found' }, { status: 404 });
  }

  // ── 3. Delete existing divisions + team assignments (full replace) ──────
  const { error: delTeamsError } = await supabaseAdmin
    .from('meet_teams')
    .delete()
    .eq('meet_id', meetId);

  if (delTeamsError) {
    console.error('[setup] Failed to delete old meet_teams:', delTeamsError);
    return NextResponse.json(
      { error: 'Failed to reset meet teams' },
      { status: 500 }
    );
  }

  const { error: delDivisionsError } = await supabaseAdmin
    .from('meet_divisions')
    .delete()
    .eq('meet_id', meetId);

  if (delDivisionsError) {
    console.error('[setup] Failed to delete old meet_divisions:', delDivisionsError);
    return NextResponse.json(
      { error: 'Failed to reset meet divisions' },
      { status: 500 }
    );
  }

  // ── 4. Insert new divisions ─────────────────────────────────────────────
  const divisionRows = divisions.map(d => ({
    meet_id: meetId,
    name: d.name.trim(),
  }));

  const { data: insertedDivisions, error: divInsertError } = await supabaseAdmin
    .from('meet_divisions')
    .insert(divisionRows)
    .select('id, name');

  if (divInsertError || !insertedDivisions) {
    console.error('[setup] Failed to insert divisions:', divInsertError);
    return NextResponse.json(
      { error: 'Failed to create divisions' },
      { status: 500 }
    );
  }

  // Build name → id map
  const divisionNameToId: Record<string, string> = {};
  insertedDivisions.forEach(d => {
    divisionNameToId[d.name] = d.id;
  });

  // ── 5. Insert meet_teams rows ───────────────────────────────────────────
  const meetTeamRows = divisions.flatMap(div => {
    const divisionId = divisionNameToId[div.name.trim()];
    return div.teamIds.map(teamId => ({
      meet_id: meetId,
      team_id: teamId,
      division_id: divisionId,
    }));
  });

  const { error: teamsInsertError } = await supabaseAdmin
    .from('meet_teams')
    .insert(meetTeamRows);

  if (teamsInsertError) {
    console.error('[setup] Failed to insert meet_teams:', teamsInsertError);
    return NextResponse.json(
      { error: 'Failed to assign teams to meet' },
      { status: 500 }
    );
  }

  // ── 6. Advance meet status from 'setup' → 'scheduled' ──────────────────
  if (meet.status === 'setup') {
    const { error: statusError } = await supabaseAdmin
      .from('meets')
      .update({ status: 'active' })
      .eq('id', meetId);

    if (statusError) {
      console.warn('[setup] Failed to update meet status:', statusError);
    }
  }

  // ── 7. Return summary ───────────────────────────────────────────────────
  return NextResponse.json({
    success: true,
    meetId,
    teamsCount: teamIds.length,
    divisionsCount: divisions.length,
    divisions: insertedDivisions.map(d => ({
      id: d.id,
      name: d.name,
      teamCount: divisions.find(x => x.name.trim() === d.name)?.teamIds.length ?? 0,
    })),
  });
}
