// src/app/api/teams/route.ts
// GET /api/teams
// Returns all active teams across all MAGA clubs, with club name attached.
// Used by meet creation Step 2 to populate team selection.

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('teams')
      .select(`
        id,
        name,
        level,
        age_group,
        is_active,
        club:clubs (
          id,
          name
        )
      `)
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('[GET /api/teams] Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch teams' },
        { status: 500 }
      );
    }

    // Flatten for easy consumption by the frontend
    const teams = (data ?? []).map((t: any) => ({
      id: t.id,
      name: t.name,
      level: t.level ?? null,
      ageGroup: t.age_group ?? null,
      clubId: t.club?.id ?? null,
      clubName: t.club?.name ?? 'Unknown Club',
    }));

    return NextResponse.json(teams);
  } catch (err) {
    console.error('[GET /api/teams] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
