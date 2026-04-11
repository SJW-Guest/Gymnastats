// src/app/api/judges/import/route.ts
// Server-side judge import — uses service role to inviteUserByEmail,
// then creates users + judge_pool rows.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface ImportRow {
  first_name: string
  last_name:  string
  email:      string
  phone:      string
}

interface RequestBody {
  rows:       ImportRow[]
  invited_by: string | null
}

export async function POST(req: NextRequest) {
  let body: RequestBody
  try {
    body = await req.json() as RequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { rows, invited_by } = body

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }

  let created   = 0
  let emailed   = 0
  const errorRows: ImportRow[] = []

  for (const row of rows) {
    try {
      // 1. Create auth account + send invite email
      const { data: inviteData, error: inviteError } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(row.email, {
          data: {
            first_name: row.first_name,
            last_name:  row.last_name,
            role:       'judge',
          },
        })

      if (inviteError || !inviteData.user) {
        errorRows.push(row)
        continue
      }

      const userId = inviteData.user.id

      // 2. Mirror into users table (role-based auth pattern)
      const { error: userError } = await supabaseAdmin.from('users').insert({
        id:        userId,
        email:     row.email,
        full_name: `${row.first_name} ${row.last_name}`,
        role:      'judge',
        club_id:   null,
        is_active: true,
      })

      if (userError) {
        errorRows.push(row)
        continue
      }

      // 3. Create judge_pool management record
      const { error: poolError } = await supabaseAdmin.from('judge_pool').insert({
        first_name: row.first_name,
        last_name:  row.last_name,
        email:      row.email,
        phone:      row.phone || null,
        status:     'invite_sent',
        user_id:    userId,
        invited_by: invited_by ?? null,
      })

      if (poolError) {
        errorRows.push(row)
        continue
      }

      created++
      emailed++
    } catch {
      errorRows.push(row)
    }
  }

  return NextResponse.json({ created, emailed, errors: errorRows.length, errorRows })
}
