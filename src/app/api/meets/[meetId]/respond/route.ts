// src/app/api/meets/[meetId]/respond/route.ts
// POST — accept or decline a meet invitation for a specific team

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase'
import { cookies } from 'next/headers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetId: string }> }
) {
  const { meetId } = await params

  // Auth check
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: { team_id: string; action: 'confirm' | 'decline' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { team_id, action } = body

  if (!team_id || !['confirm', 'decline'].includes(action)) {
    return NextResponse.json({ error: 'team_id and action (confirm|decline) are required' }, { status: 400 })
  }

  // Verify the user's club owns this team
  const { data: userRecord } = await supabaseAdmin
    .from('users')
    .select('club_id')
    .eq('id', user.id)
    .single()

  if (!userRecord?.club_id) {
    return NextResponse.json({ error: 'No club associated with your account' }, { status: 403 })
  }

  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('id, club_id')
    .eq('id', team_id)
    .single()

  if (!team || team.club_id !== userRecord.club_id) {
    return NextResponse.json({ error: 'You can only respond for teams in your club' }, { status: 403 })
  }

  // Update the meet_teams row
  const newStatus = action === 'confirm' ? 'confirmed' : 'declined'

  const { error: updateError } = await supabaseAdmin
    .from('meet_teams')
    .update({
      status: newStatus,
      confirmed_at: action === 'confirm' ? new Date().toISOString() : null,
      confirmed_by: action === 'confirm' ? user.id : null,
    })
    .eq('meet_id', meetId)
    .eq('team_id', team_id)

  if (updateError) {
    console.error('[respond] Update error:', updateError)
    return NextResponse.json({ error: 'Failed to update invitation status' }, { status: 500 })
  }

  return NextResponse.json({ success: true, status: newStatus })
}
