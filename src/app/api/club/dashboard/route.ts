// src/app/api/club/dashboard/route.ts
// GET /api/club/dashboard
// Returns all data for the club dashboard scoped to the logged-in user's club.
// Requires: Authorization header with Supabase user JWT
//
// Returns:
//   - club info
//   - season stats (gymnasts, teams, meets)
//   - upcoming meets (both hosting and invited)
//   - quick action counts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    // ── 1. Authenticate the user ──────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify token and get user
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── 2. Get user profile + club_id ─────────────────────────────────────
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, role, club_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.club_id) {
      return NextResponse.json(
        { error: 'No club associated with this account' },
        { status: 403 }
      );
    }

    const clubId = profile.club_id;

    // ── 3. Get active season ──────────────────────────────────────────────
    const { data: season } = await supabaseAdmin
      .from('seasons')
      .select('id, name, start_date, end_date')
      .eq('is_active', true)
      .single();

    const seasonId = season?.id;

    // ── 4. Run all queries in parallel ────────────────────────────────────
    const [
      clubRes,
      teamsRes,
      gymnastsRes,
      hostingMeetsRes,
      invitedMeetsRes,
    ] = await Promise.all([
      // Club info
      supabaseAdmin
        .from('clubs')
        .select('id, name, city, state, contact_email')
        .eq('id', clubId)
        .single(),

      // Teams in this club
      supabaseAdmin
        .from('teams')
        .select('id, name, level, division_group')
        .eq('club_id', clubId)
        .eq('is_active', true)
        .order('name'),

      // Gymnasts on season roster for this club
      supabaseAdmin
        .from('season_rosters')
        .select('id', { count: 'exact', head: true })
        .eq('season_id', seasonId ?? '')
        .eq('is_active', true)
        .in(
          'team_id',
          // subquery: team ids for this club
          (await supabaseAdmin
            .from('teams')
            .select('id')
            .eq('club_id', clubId)
            .eq('is_active', true)
          ).data?.map((t: any) => t.id) ?? []
        ),

      // Meets THIS club is HOSTING
      supabaseAdmin
        .from('meets')
        .select(`
          id, name, meet_date, status, location, season_id,
          meet_teams (
            id, status,
            team:teams ( id, name, club_id )
          )
        `)
        .eq('host_club_id', clubId)
        .eq('season_id', seasonId ?? '')
        .order('meet_date', { ascending: true })
        .limit(10),

      // Meets THIS club's teams are INVITED TO (not hosting)
      supabaseAdmin
        .from('meet_teams')
        .select(`
          id, status,
          team:teams ( id, name, club_id ),
          meet:meets (
            id, name, meet_date, status, location, season_id,
            host_club:clubs ( name )
          )
        `)
        .eq('team.club_id', clubId)
        .eq('meet.season_id', seasonId ?? '')
        .neq('meet.host_club_id', clubId)
        .order('meet.meet_date', { ascending: true })
        .limit(20),
    ]);

    const teams = teamsRes.data ?? [];
    const teamIds = teams.map((t: any) => t.id);

    // ── 5. Build hosting meets with invite/confirm/score counts ───────────
    const hostingMeets = (hostingMeetsRes.data ?? []).map((meet: any) => {
      const allTeams    = meet.meet_teams ?? [];
      const invited     = allTeams.length;
      const confirmed   = allTeams.filter((mt: any) => mt.status === 'confirmed').length;
      return {
        id:            meet.id,
        name:          meet.name,
        date:          meet.meet_date,
        status:        meet.status,
        location:      meet.location,
        perspective:   'hosting' as const,
        teamsInvited:  invited,
        teamsConfirmed: confirmed,
        hasScores:     false, // will enhance with scores query if needed
      };
    });

    // ── 6. Build invited meets grouped by meet ────────────────────────────
    const invitedByMeet: Record<string, any> = {};
    for (const row of (invitedMeetsRes.data ?? [])) {
      if (!row.meet) continue;
      const meetId = row.meet.id;
      if (!invitedByMeet[meetId]) {
        invitedByMeet[meetId] = {
          id:            row.meet.id,
          name:          row.meet.name,
          date:          row.meet.meet_date,
          status:        row.meet.status,
          location:      row.meet.location,
          hostClub:      row.meet.host_club?.name ?? 'Unknown',
          perspective:   'invited' as const,
          teamsInvited:  0,
          teamsConfirmed: 0,
          hasScores:     false,
          teams:         [],
        };
      }
      invitedByMeet[meetId].teamsInvited++;
      if (row.status === 'confirmed') invitedByMeet[meetId].teamsConfirmed++;
      invitedByMeet[meetId].teams.push({
        id:     row.team?.id,
        name:   row.team?.name,
        status: row.status,
      });
    }

    // ── 7. Check which meets have scores for this club's teams ────────────
    const allMeetIds = [
      ...hostingMeets.map((m: any) => m.id),
      ...Object.keys(invitedByMeet),
    ];

    if (allMeetIds.length > 0 && teamIds.length > 0) {
      const { data: scoreData } = await supabaseAdmin
        .from('scores')
        .select('meet_id')
        .in('meet_id', allMeetIds)
        .in('team_id', teamIds);

      const meetIdsWithScores = new Set((scoreData ?? []).map((s: any) => s.meet_id));
      hostingMeets.forEach((m: any) => { m.hasScores = meetIdsWithScores.has(m.id); });
      Object.values(invitedByMeet).forEach((m: any) => { m.hasScores = meetIdsWithScores.has(m.id); });
    }

    // ── 8. Combine and sort all meets by date ─────────────────────────────
    const allMeets = [
      ...hostingMeets,
      ...Object.values(invitedByMeet),
    ].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json({
      club:     clubRes.data,
      season,
      user:     { id: profile.id, name: profile.full_name, role: profile.role },
      stats: {
        gymnasts: gymnastsRes.count ?? 0,
        teams:    teams.length,
        meets:    allMeets.length,
      },
      teams,
      meets: allMeets,
    });

  } catch (err) {
    console.error('[GET /api/club/dashboard]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
