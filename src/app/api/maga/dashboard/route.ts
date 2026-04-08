// src/app/api/maga/dashboard/route.ts

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const [seasonsRes, upcomingMeetsRes, standingsRes, clubContactsRes] =
      await Promise.all([
        supabaseAdmin
          .from('seasons')
          .select(`
            id, name, start_date, end_date, is_active,
            state_meet_min_qualifiers,
            scoring_rules (
              scores_per_event,
              meets_for_standings,
              min_meets_to_qualify,
              meets_to_sum
            )
          `)
          .eq('is_active', true)
          .single(),

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

        supabaseAdmin
          .from('clubs')
          .select('id, name, contact_email, contact_phone, city, state')
          .eq('is_active', true)
          .order('name'),
      ]);

    const seasonId = seasonsRes.data?.id;

    const [clubCount, teamCount, gymnastCount, meetCount] = await Promise.all([
      supabaseAdmin.from('clubs').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabaseAdmin.from('teams').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabaseAdmin.from('season_rosters').select('id', { count: 'exact', head: true }).eq('season_id', seasonId ?? '').eq('is_active', true),
      supabaseAdmin.from('meets').select('id', { count: 'exact', head: true }).eq('season_id', seasonId ?? ''),
    ]);

    // Normalize scoring_rules — handle both array and single object from Supabase
    const rawRules = seasonsRes.data?.scoring_rules;
    const rules = Array.isArray(rawRules) ? rawRules[0] : rawRules;

    const scoringRules = rules ? {
      scores_per_event:     rules.scores_per_event     ?? 4,
      min_meets_to_qualify: rules.min_meets_to_qualify ?? 4,
      meets_to_sum:         rules.meets_to_sum         ?? 3,
      meets_for_standings:  rules.meets_for_standings  ?? 5,
    } : {
      scores_per_event:     4,
      min_meets_to_qualify: 4,
      meets_to_sum:         3,
      meets_for_standings:  5,
    };

    return NextResponse.json({
      season: seasonsRes.data ? { ...seasonsRes.data, scoring_rules: scoringRules } : null,
      stats: {
        clubs:     clubCount.count    ?? 0,
        teams:     teamCount.count    ?? 0,
        gymnasts:  gymnastCount.count ?? 0,
        meets:     meetCount.count    ?? 0,
      },
      upcomingMeets: upcomingMeetsRes.data ?? [],
      standings: (standingsRes.data ?? []).map((s: any, i: number) => ({
        rank:              i + 1,
        teamId:            s.team_id,
        teamName:          s.team?.name       ?? 'Unknown',
        clubName:          s.team?.club?.name ?? 'Unknown',
        meetsAttended:     s.meets_attended,
        meetsCounting:     s.meets_counting,
        bestMeetsTotal:    s.best_meets_total,
        qualifiesForState: s.qualifies_for_state,
      })),
      clubContacts: clubContactsRes.data ?? [],
    });
  } catch (err) {
    console.error('[GET /api/maga/dashboard]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
