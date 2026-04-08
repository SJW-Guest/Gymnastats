// src/app/api/seasons/[seasonId]/scoring-rules/route.ts
// GET  /api/seasons/[seasonId]/scoring-rules  — fetch current rules
// PUT  /api/seasons/[seasonId]/scoring-rules  — update rules (MAGA admin only)

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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

  if (error) {
    // Return defaults if no rules set yet
    return NextResponse.json({
      season_id: seasonId,
      scores_per_event: 4,
      meets_for_standings: 5,
    });
  }

  return NextResponse.json(data);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> }
) {
  const { seasonId } = await params;

  let body: { scores_per_event?: number; meets_for_standings?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { scores_per_event, meets_for_standings } = body;

  if (
    (scores_per_event !== undefined && (scores_per_event < 1 || scores_per_event > 10)) ||
    (meets_for_standings !== undefined && (meets_for_standings < 1 || meets_for_standings > 20))
  ) {
    return NextResponse.json({ error: 'Values out of range' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('scoring_rules')
    .upsert(
      {
        season_id: seasonId,
        ...(scores_per_event !== undefined && { scores_per_event }),
        ...(meets_for_standings !== undefined && { meets_for_standings }),
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
