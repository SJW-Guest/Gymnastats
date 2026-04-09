// src/app/meet/new/page.tsx
'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import CreateMeetForm from './CreateMeetForm'
import MeetCreationStep2 from './MeetCreationStep2'

function MeetNewInner() {
  const searchParams = useSearchParams()
  const meetId = searchParams.get('meetId')

  if (meetId) {
    return <MeetCreationStep2 />
  }

  return <CreateMeetForm />
}

export default function NewMeetPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading...</div>}>
      <MeetNewInner />
    </Suspense>
  )
}
