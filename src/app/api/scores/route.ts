import { NextRequest, NextResponse } from 'next/server'
type GEvent = 'vault' | 'bars' | 'beam' | 'floor'
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { meet_id, gymnast_id, event, score, dnc } = body as { meet_id: string; gymnast_id: string; event: GEvent; score?: number; dnc?: boolean }
  if (!meet_id || !gymnast_id || !event) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  if (score != null && !dnc && (score < 0 || score > 10)) return NextResponse.json({ error: 'Invalid score' }, { status: 400 })
  return NextResponse.json({ success: true })
}
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { score_id, event, new_value } = body as { score_id: string; event: GEvent; new_value: number }
  if (!score_id || !event || new_value == null) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  return NextResponse.json({ success: true })
}
