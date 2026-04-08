// src/app/api/club/dashboard/route.ts
// GET /api/club/dashboard
// Uses Supabase SSR to read the session from cookies — same pattern as MAGA dashboard

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    // ── 1. Get user from session cookie ───────────────────────────────────
    const res = NextResponse.next();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
            cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── 2. Get user profile + club_id ─────────────────────────────────────
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('id, full_name, role, club_id')
      .eq('id', user.id)
      .single();

    if (!profile?.club_id) {
      return NextResponse.json({ error: 'No club associated with this account' }, { status: 403 });
    }

    const clubId = profile.club_id;

    // ── 3. Active season ──────────────────────────────────────────────────
    const { data: season } = await supabaseAdmin
      .from('seasons')
      .select('id, name, start_date, end_date')
      .eq('is_active', true)
      .single();

    const seasonId = season?.id ?? '';

    // ── 4. Get club teams ─────────────────────────────────────────────────
    const { data: teamsData } = await supabaseAdmin
      .from('teams')
      .select('id, name, level, division_group')
      .eq('club_id', clubId)
      .eq('is_active', true)
      .order('name');

    const teams = teamsData ?? [];
    const teamIds = teams.map((t: any) => t.id);

    // ── 5. Parallel queries ───────────────────────────────────────────────
    const [clubRes, gymnastsRes, hostingMeetsRes, invitedMeetsRes] = await Promise.all([
      supabaseAdmin
        .from('clubs')
        .select('id, name, city, state, contact_email')
        .eq('id', clubId)
        .single(),

      teamIds.length > 0
        ? supabaseAdmin
            .from('season_rosters')
            .select('id', { count: 'exact', head: true })
            .eq('season_id', seasonId)
            .eq('is_active', true)
            .in('team_id', teamIds)
        : Promise.resolve({ count: 0 }),

      supabaseAdmin
        .from('meets')
        .select('id, name, meet_date, status, location, meet_teams(id, status, team_id)')
        .eq('host_club_id', clubId)
        .eq('season_id', seasonId)
        .order('meet_date', { ascending: true })
        .limit(10),

      teamIds.length > 0
        ? supabaseAdmin
            .from('meet_teams')
            .select('id, status, team_id, meet:meets(id, name, meet_date, status, location, host_club_id, host_club:clubs(name))')
            .in('team_id', teamIds)
            .limit(50)
        : Promise.resolve({ data: [] }),
    ]);

    // ── 6. Build hosting meets ────────────────────────────────────────────
    const hostingMeets = (hostingMeetsRes.data ?? []).map((meet: any) => {
      const allTeams = meet.meet_teams ?? [];
      return {
        id: meet.id, name: meet.name, date: meet.meet_date,
        status: meet.status, location: meet.location ?? '',
        perspective: 'hosting' as const,
        teamsInvited: allTeams.length,
        teamsConfirmed: allTeams.filter((mt: any) => mt.status === 'confirmed').length,
        hasScores: false,
        teams: allTeams.map((mt: any) => ({ id: mt.team_id, name: '', status: mt.status })),
      };
    });

    // ── 7. Build invited meets ────────────────────────────────────────────
    const invitedByMeet: Record<string, any> = {};
    for (const row of ((invitedMeetsRes as any).data ?? []) as any[]) {
      const meet = row.meet as any;
      if (!meet || meet.host_club_id === clubId) continue;
      const meetId = meet.id as string;
      if (!invitedByMeet[meetId]) {
        invitedByMeet[meetId] = {
          id: meetId, name: meet.name, date: meet.meet_date,
          status: meet.status, location: meet.location ?? '',
          hostClub: (meet.host_club as any)?.name ?? 'Unknown',
          perspective: 'invited' as const,
          teamsInvited: 0, teamsConfirmed: 0, hasScores: false, teams: [],
        };
      }
      invitedByMeet[meetId].teamsInvited++;
      if (row.status === 'confirmed') invitedByMeet[meetId].teamsConfirmed++;
      invitedByMeet[meetId].teams.push({ id: row.team_id, name: '', status: row.status });
    }

    // ── 8. Check scores ───────────────────────────────────────────────────
    const allMeetIds = [...hostingMeets.map((m: any) => m.id), ...Object.keys(invitedByMeet)];
    if (allMeetIds.length > 0 && teamIds.length > 0) {
      const { data: scoreData } = await supabaseAdmin
        .from('scores').select('meet_id').in('meet_id', allMeetIds).in('team_id', teamIds);
      const meetIdsWithScores = new Set((scoreData ?? []).map((s: any) => s.meet_id));
      hostingMeets.forEach((m: any) => { m.hasScores = meetIdsWithScores.has(m.id); });
      Object.values(invitedByMeet).forEach((m: any) => { m.hasScores = meetIdsWithScores.has(m.id); });
    }

    const allMeets = [...hostingMeets, ...Object.values(invitedByMeet)]
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json({
      club: clubRes.data, season,
      user: { id: profile.id, name: profile.full_name, role: profile.role },
      stats: { gymnasts: (gymnastsRes as any).count ?? 0, teams: teams.length, meets: allMeets.length },
      teams, meets: allMeets,
    });

  } catch (err) {
    console.error('[GET /api/club/dashboard]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
