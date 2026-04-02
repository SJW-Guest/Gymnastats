import { NextRequest, NextResponse } from 'next/server'
import { createServerClientInstance } from '@/lib/supabase'
import { validateScore } from '@/types'
import type { Event, DncReason } from '@/types'

// POST /api/scores — submit or update a score for one event
export async function POST(req: NextRequest) {
  const supabase = await createServerClientInstance()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, club_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role === 'parent') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { meet_id, gymnast_id, event, score, dnc, dnc_reason } = body as {
    meet_id: string
    gymnast_id: string
    event: Event
    score?: number
    dnc?: boolean
    dnc_reason?: DncReason
  }

  // Validate inputs
  if (!meet_id || !gymnast_id || !event) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Validate score range if provided
  if (score != null && !dnc) {
    const validation = validateScore(score)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
  }

  // Check meet is active (not finalized or setup)
  const { data: meet } = await supabase
    .from('meets')
    .select('status')
    .eq('id', meet_id)
    .single()

  if (!meet || meet.status !== 'active') {
    return NextResponse.json(
      { error: 'Scores can only be entered for active meets' },
      { status: 400 }
    )
  }

  // Check gymnast is in lineup and not scratched
  const { data: lineup } = await supabase
    .from('meet_lineups')
    .select('status')
    .eq('meet_id', meet_id)
    .eq('gymnast_id', gymnast_id)
    .single()

  if (!lineup) {
    return NextResponse.json(
      { error: 'Gymnast not in lineup for this meet' },
      { status: 400 }
    )
  }

  if (lineup.status === 'scratched') {
    return NextResponse.json(
      { error: 'Cannot enter scores for a scratched gymnast' },
      { status: 400 }
    )
  }

  // Build the update payload for the specific event
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (dnc) {
    // Mark as did not compete — clear any existing score
    updatePayload[event] = null
    updatePayload[`${event}_dnc`] = true
    updatePayload[`${event}_dnc_reason`] = dnc_reason ?? null
    updatePayload[`${event}_entered_by`] = user.id
    updatePayload[`${event}_entered_at`] = new Date().toISOString()
  } else if (score != null) {
    // Enter a score — clear any DNC flag
    updatePayload[event] = score
    updatePayload[`${event}_dnc`] = false
    updatePayload[`${event}_dnc_reason`] = null
    updatePayload[`${event}_entered_by`] = user.id
    updatePayload[`${event}_entered_at`] = new Date().toISOString()
  } else {
    return NextResponse.json(
      { error: 'Must provide either a score or dnc=true' },
      { status: 400 }
    )
  }

  // Upsert the score row
  const { data, error } = await supabase
    .from('scores')
    .upsert(
      {
        meet_id,
        gymnast_id,
        ...updatePayload,
      },
      {
        onConflict: 'meet_id,gymnast_id',
        ignoreDuplicates: false,
      }
    )
    .select()
    .single()

  if (error) {
    console.error('Score upsert error:', error)
    return NextResponse.json({ error: 'Failed to save score' }, { status: 500 })
  }

  return NextResponse.json({ score: data })
}

// PATCH /api/scores — MAGA admin score correction (post-finalization)
export async function PATCH(req: NextRequest) {
  const supabase = await createServerClientInstance()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  // Only MAGA admins can correct finalized scores
  if (!profile || profile.role !== 'maga_admin') {
    return NextResponse.json({ error: 'Only MAGA admins can correct scores' }, { status: 403 })
  }

  const body = await req.json()
  const { score_id, event, new_value, reason } = body as {
    score_id: string
    event: Event
    new_value: number
    reason?: string
  }

  // Validate new score
  const validation = validateScore(new_value)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  // Get existing score for audit trail
  const { data: existing } = await supabase
    .from('scores')
    .select(`id, meet_id, gymnast_id, team_id, ${event}`)
    .eq('id', score_id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Score record not found' }, { status: 404 })
  }

  // Apply correction
  const { error: updateError } = await supabase
    .from('scores')
    .update({
      [event]: new_value,
      [`${event}_dnc`]: false,
      [`${event}_dnc_reason`]: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', score_id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to apply correction' }, { status: 500 })
  }

  // Log correction for audit trail
  const { error: auditError } = await supabase
    .from('score_corrections')
    .insert({
      score_id,
      meet_id: existing.meet_id,
      gymnast_id: existing.gymnast_id,
      corrected_by: user.id,
      event,
      old_value: existing[event],
      new_value,
      reason: reason ?? null,
    })

  if (auditError) {
    console.error('Audit log error:', auditError)
    // Don't fail the request — correction saved, audit log is secondary
  }

  // TODO: trigger email notification to club (phase 1.1)
  // await notifyClubOfCorrection({ existing, event, old_value: existing[event], new_value })

  return NextResponse.json({ success: true })
}
