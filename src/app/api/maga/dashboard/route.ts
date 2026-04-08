// src/app/api/maga/dashboard/route.ts
// GET /api/maga/dashboard
// Returns all data needed for the MAGA admin dashboard in one call:
// - season stats (clubs, teams, gymnasts, meets)
// - upcoming meets
// - top 20 season team standings

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    // Run all queries in parallel
    const [
      seasonsRes,
      upcomingMeetsRes,
      standingsRes,
      clubContactsRes,
    ] = await Promise.all([
      // Active season + stats
      supabaseAdmin
        .from('seasons')
        .select(`
          id, name, start_date, end_date, is_active,
          state_meet_min_qualifiers,
          scoring_rules (
            scores_per_event,
            meets_for_standings
          )
        `)
        .eq('is_active', true)
        .single(),

      // Upcoming meets (next 10, status not finalized)
      supabaseAdmin
        .from('meets')
        .select(`
          id, name, meet_date, status, location,
          host_club:clubs (name)
        `)
        .in('status', ['setup', 'scheduled', 'in_progress'])
        .gte('meet_date', new Date().toISOString().split('T')[0])
        .order('meet_date', { ascending: true })
        .limit(10),

      // Top 20 season team standings
      supabaseAdmin
        .from('season_team_standings')
        .select(`
          id, season_id, team_id, meets_attended,
          meets_counting, best_meets_total, qualifies_for_state,
          team:teams (
            name,
            club:clubs (name)
          )
        `)
        .order('best_meets_total', { ascending: false })
        .limit(20),

      // Club contacts
      supabaseAdmin
        .from('clubs')
        .select('id, name, contact_email, contact_phone, city, state')
        .eq('is_active', true)
        .order('name'),
    ]);

    // Count stats separately
    const seasonId = seasonsRes.data?.id;
    const [clubCount, teamCount, gymnastCount, meetCount] = await Promise.all([
      supabaseAdmin.from('clubs').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabaseAdmin.from('teams').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabaseAdmin.from('season_rosters').select('id', { count: 'exact', head: true }).eq('season_id', seasonId ?? '').eq('is_active', true),
      supabaseAdmin.from('meets').select('id', { count: 'exact', head: true }).eq('season_id', seasonId ?? ''),
    ]);

    return NextResponse.json({
      season: seasonsRes.data,
      stats: {
        clubs: clubCount.count ?? 0,
        teams: teamCount.count ?? 0,
        gymnasts: gymnastCount.count ?? 0,
        meets: meetCount.count ?? 0,
      },
      upcomingMeets: upcomingMeetsRes.data ?? [],
      standings: (standingsRes.data ?? []).map((s: any, i: number) => ({
        rank: i + 1,
        teamId: s.team_id,
        teamName: s.team?.name ?? 'Unknown',
        clubName: s.team?.club?.name ?? 'Unknown',
        meetsAttended: s.meets_attended,
        meetsCounting: s.meets_counting,
        bestMeetsTotal: s.best_meets_total,
        qualifiesForState: s.qualifies_for_state,
      })),
      clubContacts: clubContactsRes.data ?? [],
    });
  } catch (err) {
    console.error('[GET /api/maga/dashboard]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
