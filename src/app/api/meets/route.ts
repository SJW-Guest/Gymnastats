// src/app/api/meets/route.ts
// App Router API route — handles POST to create a meet + invite teams

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { CreateMeetFormData } from '@/types/meet.types'

async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: CreateMeetFormData
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const {
    name,
    meet_date,
    location,
    lineup_due_date,
    num_judges,
    counts_for_state,
    results_visibility,
    invited_team_ids,
  } = body

  // Validate required fields
  if (!name?.trim() || !meet_date) {
    return NextResponse.json(
      { error: 'Meet name and date are required' },
      { status: 400 }
    )
  }

  // Get the user's club and active season
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('club_id, association_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.club_id) {
    return NextResponse.json(
      { error: 'Could not find your club. Make sure your profile has a club assigned.' },
      { status: 400 }
    )
  }

  let seasonQuery = supabase
    .from('seasons')
    .select('id')
    .eq('is_active', true)

  if (profile.association_id) {
    seasonQuery = seasonQuery.eq('association_id', profile.association_id)
  }

  const { data: season, error: seasonError } = await seasonQuery
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (seasonError || !season) {
    return NextResponse.json(
      { error: 'No active season found. Ask your MAGA admin to set an active season.' },
      { status: 400 }
    )
  }

  // Create the meet
  const { data: meet, error: meetError } = await supabase
    .from('meets')
    .insert({
      name: name.trim(),
      meet_date,
      location: location?.trim() || null,
      lineup_due_date: lineup_due_date || null,
      num_judges: num_judges || null,
      counts_for_state: counts_for_state ?? false,
      results_visibility: results_visibility || 'members_only',
      status: 'setup',
      host_club_id: profile.club_id,
      season_id: season.id,
      created_by: user.id,
    })
    .select()
    .single()

  if (meetError) {
    console.error('Error creating meet:', meetError)
    return NextResponse.json(
      { error: 'Failed to create meet', details: meetError.message },
      { status: 500 }
    )
  }

  // Invite teams if any were selected
  if (invited_team_ids && invited_team_ids.length > 0) {
    const invitations = invited_team_ids.map((team_id) => ({
      meet_id: meet.id,
      team_id,
      status: 'invited',
      invited_by: user.id,
      invited_at: new Date().toISOString(),
    }))

    const { error: inviteError } = await supabase
      .from('meet_teams')
      .insert(invitations)

    if (inviteError) {
      console.error('Error inviting teams:', inviteError)
      // Meet was created — return success but flag the invite issue
      return NextResponse.json({
        meet,
        warning: 'Meet created but some team invitations failed. You can re-invite from the meet page.',
        inviteError: inviteError.message,
      }, { status: 207 })
    }
  }

  return NextResponse.json({ meet, invited: invited_team_ids?.length ?? 0 }, { status: 201 })
}

// GET — fetch meets for the current user's club
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const clubId = searchParams.get('club_id')

  let query = supabase
    .from('meets')
    .select(`
      *,
      meet_teams(count)
    `)
    .order('meet_date', { ascending: true })

  if (clubId) {
    query = query.eq('host_club_id', clubId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ meets: data })
}
