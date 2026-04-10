'use client'

// src/app/meet/new/CreateMeetForm.tsx
// Step 1 of 2 — collect meet details, create the meet, redirect to step 2
// Step 2 (Teams & Divisions) already exists and expects ?meetId= in the URL

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CreateMeetForm() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    meet_date: '',
    location: '',
    lineup_due_date: '',
    num_judges: '',
    counts_for_state: false,
    results_visibility: 'after_finalized',
  })

  function handleField(key: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.name.trim()) { setError('Meet name is required.'); return }
    if (!form.meet_date) { setError('Meet date is required.'); return }

    setSubmitting(true)

    try {
      const res = await fetch('/api/meets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          num_judges: form.num_judges ? Number(form.num_judges) : null,
          invited_team_ids: [],
        }),
      })

      const data = await res.json()

      if (!res.ok && res.status !== 207) {
        setError(data.error || 'Failed to create meet.')
        setSubmitting(false)
        return
      }

      // Hand off to the existing step 2 page with meetId in the URL
      router.push(`/meet/new?meetId=${data.meet.id}`)

    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 24px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 0' }}>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Meet Setup · Step 1 of 2
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>Meet Details</h1>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px' }}>
        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', color: '#dc2626', marginBottom: 24, fontSize: 14 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, marginBottom: 16 }}>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Meet Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="text" value={form.name} onChange={(e) => handleField('name', e.target.value)}
                placeholder="e.g. Spring Invitational 2026" style={inputStyle} required />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Meet Date <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="date" value={form.meet_date} onChange={(e) => handleField('meet_date', e.target.value)} style={inputStyle} required />
              </div>
              <div>
                <label style={labelStyle}>Lineup Due Date</label>
                <input type="date" value={form.lineup_due_date} onChange={(e) => handleField('lineup_due_date', e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Location</label>
              <input type="text" value={form.location} onChange={(e) => handleField('location', e.target.value)}
                placeholder="e.g. Minneapolis, MN" style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Number of Judges</label>
                <input type="number" min={1} max={10} value={form.num_judges}
                  onChange={(e) => handleField('num_judges', e.target.value)} placeholder="e.g. 3" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Results Visibility</label>
                <select value={form.results_visibility} onChange={(e) => handleField('results_visibility', e.target.value)} style={inputStyle}>
                  <option value="after_finalized">After Finalized</option>
                  <option value="live">Live</option>
                </select>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: '#374151' }}>
              <input type="checkbox" checked={form.counts_for_state}
                onChange={(e) => handleField('counts_for_state', e.target.checked)} style={{ width: 16, height: 16 }} />
              Counts toward state qualifications
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" onClick={() => router.back()}
              style={{ background: 'none', border: 'none', fontSize: 14, color: '#6b7280', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              style={{ backgroundColor: submitting ? '#9ca3af' : '#111827', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer' }}>
              {submitting ? 'Creating...' : 'Continue to Teams & Divisions →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '9px 12px',
  fontSize: 14, color: '#111827', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff',
}
