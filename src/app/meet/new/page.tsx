// src/app/meet/new/page.tsx
// Shows Step 1 (meet details form) if no meetId in URL
// Shows Step 2 (teams & divisions) if ?meetId= is present
// This preserves the existing step 2 component exactly as-is

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import CreateMeetForm from './CreateMeetForm'
import MeetCreationStep2 from './MeetCreationStep2'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ meetId?: string }>
}

export default async function NewMeetPage({ searchParams }: Props) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { meetId } = await searchParams

  // If meetId is in the URL, show step 2 (teams & divisions)
  // Otherwise show step 1 (meet details)
  if (meetId) {
    return <MeetCreationStep2 />
  }

  return <CreateMeetForm />
}
