// src/app/api/seasons/[seasonId]/scoring-rules/route.ts
// GET  — fetch current rules
// PUT  — update rules (MAGA admin only)

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const DEFAULTS = {
  scores_per_event:     4,
  min_meets_to_qualify: 4,
  meets_to_sum:         3,
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> }
) {
  const { seasonId } = await params;

  const { data, error } = await supabaseAdmin
    .from('scoring_rules')
    .select('*')
    .eq('season_id', seasonId)
    .single();

  if (error || !data) {
    return NextResponse.json({ season_id: seasonId, ...DEFAULTS });
  }

  return NextResponse.json(data);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> }
) {
  const { seasonId } = await params;

  let body: {
    scores_per_event?:     number;
    min_meets_to_qualify?: number;
    meets_to_sum?:         number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { scores_per_event, min_meets_to_qualify, meets_to_sum } = body;

  // Validate ranges
  if (scores_per_event !== undefined && (scores_per_event < 1 || scores_per_event > 10)) {
    return NextResponse.json({ error: 'scores_per_event must be 1–10' }, { status: 400 });
  }
  if (min_meets_to_qualify !== undefined && (min_meets_to_qualify < 1 || min_meets_to_qualify > 20)) {
    return NextResponse.json({ error: 'min_meets_to_qualify must be 1–20' }, { status: 400 });
  }
  if (meets_to_sum !== undefined && (meets_to_sum < 1 || meets_to_sum > 20)) {
    return NextResponse.json({ error: 'meets_to_sum must be 1–20' }, { status: 400 });
  }
  // meets_to_sum must be less than min_meets_to_qualify
  // (you need to attend more meets than you count)
  const effectiveMeetsToSum         = meets_to_sum         ?? DEFAULTS.meets_to_sum;
  const effectiveMinMeetsToQualify  = min_meets_to_qualify ?? DEFAULTS.min_meets_to_qualify;
  if (effectiveMeetsToSum >= effectiveMinMeetsToQualify) {
    return NextResponse.json(
      { error: 'Meets to sum must be less than minimum meets to qualify' },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('scoring_rules')
    .upsert(
      {
        season_id: seasonId,
        ...(scores_per_event     !== undefined && { scores_per_event }),
        ...(min_meets_to_qualify !== undefined && { min_meets_to_qualify }),
        ...(meets_to_sum         !== undefined && { meets_to_sum }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'season_id' }
    )
    .select()
    .single();

  if (error) {
    console.error('[scoring-rules PUT]', error);
    return NextResponse.json({ error: 'Failed to update scoring rules' }, { status: 500 });
  }

  return NextResponse.json(data);
}
