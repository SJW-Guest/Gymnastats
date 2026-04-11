'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import Papa from 'papaparse'

// ── Types ──────────────────────────────────────────────────────────────────────

type ImportStatus = 'new' | 'exists' | 'error'
type PageView     = 'list' | 'upload' | 'preview' | 'importing' | 'complete'
type FilterTab    = 'all'  | 'new'    | 'exists'  | 'error'

interface JudgePoolEntry {
  id:         string
  first_name: string
  last_name:  string
  email:      string
  phone:      string | null
  status:     string
  user_id:    string | null
  invited_at: string
}

interface ParsedRow {
  first_name:   string
  last_name:    string
  email:        string
  phone:        string
  importStatus: ImportStatus
  errors:       string[]   // names of missing fields e.g. 'first name', 'email'
  rowIndex:     number
}

interface ImportRow {
  first_name: string
  last_name:  string
  email:      string
  phone:      string
}

interface ImportResult {
  created:   number
  emailed:   number
  skipped:   number
  errors:    number
  errorRows: ImportRow[]
}

// ── Pill colour maps ───────────────────────────────────────────────────────────

const STATUS_PILL: Record<string, React.CSSProperties> = {
  invite_sent:   { backgroundColor: '#fef3c7', color: '#d97706' },
  pending_login: { backgroundColor: '#dbeafe', color: '#1d4ed8' },
  active:        { backgroundColor: '#dcfce7', color: '#16a34a' },
}

const IMPORT_PILL: Record<ImportStatus, React.CSSProperties> = {
  new:    { backgroundColor: '#dbeafe', color: '#1d4ed8' },
  exists: { backgroundColor: '#dcfce7', color: '#16a34a' },
  error:  { backgroundColor: '#fee2e2', color: '#dc2626' },
}

// ── Pure helpers ───────────────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function escapeCsvField(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

function triggerCsvDownload(rows: ImportRow[], filename: string) {
  const header = 'first_name,last_name,email,phone'
  const body   = rows
    .map(r =>
      [r.first_name, r.last_name, r.email, r.phone]
        .map(escapeCsvField)
        .join(',')
    )
    .join('\n')
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function JudgePoolPage() {
  const router   = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // View state
  const [view,    setView]    = useState<PageView>('list')
  const [loading, setLoading] = useState(true)

  // Data
  const [judges,         setJudges]         = useState<JudgePoolEntry[]>([])
  const [existingEmails, setExistingEmails] = useState<Set<string>>(new Set())
  const [currentUserId,  setCurrentUserId]  = useState<string | null>(null)

  // Upload / preview
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [filterTab,  setFilterTab]  = useState<FilterTab>('all')
  const [isDragging, setIsDragging] = useState(false)
  const [fileName,   setFileName]   = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Import result
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  // Single-add form
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm,     setAddForm]     = useState<ImportRow>({ first_name: '', last_name: '', email: '', phone: '' })
  const [addError,    setAddError]    = useState('')
  const [addSuccess,  setAddSuccess]  = useState('')
  const [addLoading,  setAddLoading]  = useState(false)

  // ── Auth + initial load ────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'maga_admin') { router.push('/dashboard'); return }

      setCurrentUserId(user.id)
      await loadJudges()
    }
    init()
  }, [])

  async function loadJudges() {
    setLoading(true)
    const { data } = await supabase
      .from('judge_pool')
      .select('id, first_name, last_name, email, phone, status, user_id, invited_at')
      .order('last_name', { ascending: true })

    const rows = (data as JudgePoolEntry[] | null) ?? []
    setJudges(rows)
    setExistingEmails(new Set(rows.map(j => j.email.toLowerCase())))
    setLoading(false)
  }

  // ── CSV helpers ────────────────────────────────────────────────

  function handleDownloadTemplate() {
    const blob = new Blob(['first_name,last_name,email,phone\n'], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'judge_import_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function processFile(file: File) {
    setFileName(file.name)
    Papa.parse<Record<string, string>>(file, {
      header:          true,
      skipEmptyLines:  true,
      complete: ({ data }) => {
        const rows: ParsedRow[] = data.map((raw, i) => {
          const first_name = (raw['first_name'] ?? '').trim()
          const last_name  = (raw['last_name']  ?? '').trim()
          const email      = (raw['email']      ?? '').trim().toLowerCase()
          const phone      = (raw['phone']      ?? '').trim()

          const errors: string[] = []
          if (!first_name)               errors.push('first name')
          if (!last_name)                errors.push('last name')
          if (!email)                    errors.push('email')
          else if (!isValidEmail(email)) errors.push('valid email')

          const importStatus: ImportStatus =
            errors.length > 0          ? 'error'  :
            existingEmails.has(email)  ? 'exists' : 'new'

          return { first_name, last_name, email, phone, importStatus, errors, rowIndex: i + 1 }
        })
        setParsedRows(rows)
        setFilterTab('all')
        setView('preview')
      },
    })
  }

  function handleDragOver(e: React.DragEvent)  { e.preventDefault(); setIsDragging(true) }
  function handleDragLeave(e: React.DragEvent) { e.preventDefault(); setIsDragging(false) }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  // ── Bulk import ────────────────────────────────────────────────

  async function handleImport() {
    const newRows = parsedRows.filter(r => r.importStatus === 'new')
    const skipped = parsedRows.filter(r => r.importStatus === 'exists').length
    setView('importing')
    try {
      const res  = await fetch('/api/judges/import', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          rows:       newRows.map(r => ({ first_name: r.first_name, last_name: r.last_name, email: r.email, phone: r.phone })),
          invited_by: currentUserId,
        }),
      })
      const data: { created: number; emailed: number; errors: number; errorRows: ImportRow[] } = await res.json()
      setImportResult({
        created:   data.created,
        emailed:   data.emailed,
        skipped,
        errors:    data.errors,
        errorRows: data.errorRows ?? [],
      })
      await loadJudges()
    } catch {
      setImportResult({
        created: 0, emailed: 0, skipped,
        errors:    newRows.length,
        errorRows: newRows.map(r => ({ first_name: r.first_name, last_name: r.last_name, email: r.email, phone: r.phone })),
      })
    }
    setView('complete')
  }

  // ── Single add ─────────────────────────────────────────────────

  async function handleSingleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddError('')
    setAddSuccess('')

    if (!addForm.first_name.trim() || !addForm.last_name.trim()) {
      setAddError('First and last name are required.')
      return
    }
    if (!addForm.email.trim() || !isValidEmail(addForm.email)) {
      setAddError('A valid email address is required.')
      return
    }
    if (existingEmails.has(addForm.email.trim().toLowerCase())) {
      setAddError('A judge with this email already exists in the pool.')
      return
    }

    setAddLoading(true)
    try {
      const res  = await fetch('/api/judges/import', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          rows: [{ first_name: addForm.first_name.trim(), last_name: addForm.last_name.trim(), email: addForm.email.trim().toLowerCase(), phone: addForm.phone.trim() }],
          invited_by: currentUserId,
        }),
      })
      const data: { created: number; errors: number } = await res.json()
      if (!res.ok || data.errors > 0) {
        setAddError('Failed to add judge. The email may already have a Supabase account.')
      } else {
        setAddSuccess(`${addForm.first_name.trim()} ${addForm.last_name.trim()} added — invite email sent.`)
        setAddForm({ first_name: '', last_name: '', email: '', phone: '' })
        await loadJudges()
      }
    } catch {
      setAddError('Something went wrong. Please try again.')
    } finally {
      setAddLoading(false)
    }
  }

  // ── Derived values ─────────────────────────────────────────────

  const newCount    = parsedRows.filter(r => r.importStatus === 'new').length
  const existsCount = parsedRows.filter(r => r.importStatus === 'exists').length
  const errorCount  = parsedRows.filter(r => r.importStatus === 'error').length

  const filteredRows: ParsedRow[] =
    filterTab === 'all'
      ? parsedRows
      : parsedRows.filter(r => r.importStatus === (filterTab as ImportStatus))

  const previewErrorRows: ImportRow[] = parsedRows
    .filter(r => r.importStatus === 'error')
    .map(r => ({ first_name: r.first_name, last_name: r.last_name, email: r.email, phone: r.phone }))

  // ── Early return ───────────────────────────────────────────────

  if (loading) return (
    <div style={s.page}>
      <div style={s.center}><div style={s.spinner} /></div>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div style={s.page}>

      {/* ── Top bar ── */}
      <div style={s.topBar}>
        <div style={s.topBarInner}>
          <div style={s.logo}>G</div>
          <span style={s.logoText}>Gymnastats</span>
          <div style={{ flex: 1 }} />
          <span style={s.topBarRole}>MAGA Administrator</span>
          <button style={s.navBtn} onClick={() => router.push('/dashboard')}>← Dashboard</button>
        </div>
      </div>

      <div style={s.layout}>

        {/* ── Sidebar ── */}
        <aside style={s.sidebar}>
          <p style={s.sidebarTitle}>Judge Pool</p>
          <p style={s.sidebarSub}>MAGA Administrator</p>
          <div style={s.sidebarStats}>
            {([
              [judges.length,                                          'Total'],
              [judges.filter(j => j.status === 'active').length,      'Active'],
              [judges.filter(j => j.status === 'invite_sent').length, 'Invited'],
            ] as [number, string][]).map(([val, label]) => (
              <div key={label} style={s.sidebarStat}>
                <span style={s.sidebarStatNum}>{val}</span>
                <span style={s.sidebarStatLabel}>{label}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Main ── */}
        <main style={s.main}>

          {/* ════ LIST ════ */}
          {view === 'list' && (
            <>
              <div style={s.pageHeader}>
                <h1 style={s.pageTitle}>Judge Pool</h1>
                <div style={s.headerBtns}>
                  <button style={s.outlineBtn} onClick={handleDownloadTemplate}>Download CSV template</button>
                  <button style={s.primaryBtn} onClick={() => setView('upload')}>Import via CSV</button>
                </div>
              </div>

              {/* Single-add form */}
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <h2 style={s.cardTitle}>Add single judge</h2>
                  <button style={s.ghostBtn} onClick={() => { setShowAddForm(f => !f); setAddError(''); setAddSuccess('') }}>
                    {showAddForm ? 'Cancel' : '+ Add judge'}
                  </button>
                </div>
                {showAddForm && (
                  <form onSubmit={handleSingleAdd} style={{ marginTop: 16 }}>
                    {addError   && <div style={s.errorBanner}>{addError}</div>}
                    {addSuccess && <div style={s.successBanner}>{addSuccess}</div>}
                    <div style={s.formGrid}>
                      <div>
                        <label style={s.label}>First name *</label>
                        <input style={s.input} value={addForm.first_name} onChange={e => setAddForm(f => ({ ...f, first_name: e.target.value }))} />
                      </div>
                      <div>
                        <label style={s.label}>Last name *</label>
                        <input style={s.input} value={addForm.last_name} onChange={e => setAddForm(f => ({ ...f, last_name: e.target.value }))} />
                      </div>
                      <div>
                        <label style={s.label}>Email *</label>
                        <input type="email" style={s.input} value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} />
                      </div>
                      <div>
                        <label style={s.label}>Phone <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
                        <input style={s.input} value={addForm.phone} placeholder="555-555-5555" onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                      <button type="submit" style={s.saveBtn} disabled={addLoading}>
                        {addLoading ? 'Adding...' : 'Add & send invite'}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Judge list */}
              <div style={s.card}>
                <h2 style={{ ...s.cardTitle, marginBottom: 14 }}>All judges ({judges.length})</h2>
                {judges.length === 0 ? (
                  <p style={s.empty}>No judges in the pool yet. Add one above or import via CSV.</p>
                ) : (
                  <>
                    <div style={s.tblHead}>
                      <span>Name</span><span>Email</span><span>Phone</span><span>Status</span>
                    </div>
                    {judges.map(j => (
                      <div key={j.id} style={s.tblRow}>
                        <span style={s.tblName}>{j.first_name} {j.last_name}</span>
                        <span style={s.tblMuted}>{j.email}</span>
                        <span style={s.tblMuted}>{j.phone ?? '—'}</span>
                        <span style={{ ...s.pill, ...(STATUS_PILL[j.status] ?? STATUS_PILL.invite_sent) }}>
                          {j.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </>
          )}

          {/* ════ UPLOAD ════ */}
          {view === 'upload' && (
            <div style={s.centeredWrap}>
              <div style={s.uploadCard}>
                <button style={s.backLink} onClick={() => setView('list')}>← Back to judge pool</button>
                <h1 style={s.uploadTitle}>Import judges via CSV</h1>
                <p style={s.uploadSub}>
                  Required columns: <code style={s.code}>first_name, last_name, email</code>
                  {' '}— phone is optional. Extra columns are ignored.
                </p>

                <div
                  style={{ ...s.dropZone, ...(isDragging ? s.dropZoneActive : {}) }}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div style={s.dropIcon}>📁</div>
                  <p style={s.dropMain}>
                    Drag & drop your CSV here, or{' '}
                    <span style={s.dropBrowse}>browse</span>
                  </p>
                  <p style={s.dropHint}>.csv files only</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    style={{ display: 'none' }}
                    onChange={handleFileInput}
                  />
                </div>

                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <button style={s.outlineBtn} onClick={handleDownloadTemplate}>
                    Download blank template
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ════ PREVIEW ════ */}
          {view === 'preview' && (
            <>
              <div style={s.pageHeader}>
                <div>
                  <button style={s.backLink} onClick={() => setView('upload')}>← Back</button>
                  <h1 style={{ ...s.pageTitle, marginTop: 6 }}>Preview — {fileName}</h1>
                </div>
              </div>

              {/* Summary pills */}
              <div style={s.summaryRow}>
                <div style={{ ...s.summaryPill, backgroundColor: '#dbeafe', color: '#1d4ed8' }}>
                  <strong>{newCount}</strong>&nbsp;new
                </div>
                <div style={{ ...s.summaryPill, backgroundColor: '#dcfce7', color: '#16a34a' }}>
                  <strong>{existsCount}</strong>&nbsp;already exists
                </div>
                {errorCount > 0 && (
                  <div style={{ ...s.summaryPill, backgroundColor: '#fee2e2', color: '#dc2626' }}>
                    <strong>{errorCount}</strong>&nbsp;{errorCount === 1 ? 'error' : 'errors'}
                  </div>
                )}
              </div>

              {/* Filter tabs */}
              <div style={s.filterRow}>
                {([
                  ['all',    `All (${parsedRows.length})`],
                  ['new',    `New (${newCount})`],
                  ['exists', `Already exists (${existsCount})`],
                  ['error',  `Errors (${errorCount})`],
                ] as [FilterTab, string][]).map(([tab, label]) => (
                  <button
                    key={tab}
                    style={{ ...s.filterTab, ...(filterTab === tab ? s.filterTabActive : {}) }}
                    onClick={() => setFilterTab(tab)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Preview table */}
              <div style={s.card}>
                <div style={s.previewHead}>
                  <span>#</span>
                  <span>First name</span>
                  <span>Last name</span>
                  <span>Email</span>
                  <span>Phone</span>
                  <span>Status</span>
                </div>
                {filteredRows.length === 0 ? (
                  <p style={s.empty}>No rows match this filter.</p>
                ) : (
                  filteredRows.map(row => {
                    const badFirst = row.errors.includes('first name')
                    const badLast  = row.errors.includes('last name')
                    const badEmail = row.errors.includes('email') || row.errors.includes('valid email')
                    return (
                      <div
                        key={row.rowIndex}
                        style={{ ...s.previewRow, ...(row.importStatus === 'error' ? s.previewRowErr : {}) }}
                      >
                        <span style={s.rowNum}>{row.rowIndex}</span>
                        <span style={{ ...s.cell, ...(badFirst ? s.cellBad : {}) }}>
                          {row.first_name || <em style={{ color: '#dc2626' }}>missing</em>}
                        </span>
                        <span style={{ ...s.cell, ...(badLast ? s.cellBad : {}) }}>
                          {row.last_name || <em style={{ color: '#dc2626' }}>missing</em>}
                        </span>
                        <span style={{ ...s.cell, ...(badEmail ? s.cellBad : {}) }}>
                          {row.email || <em style={{ color: '#dc2626' }}>missing</em>}
                        </span>
                        <span style={s.cell}>{row.phone || '—'}</span>
                        <span style={{ ...s.pill, ...IMPORT_PILL[row.importStatus] }}>
                          {row.importStatus === 'new'    ? 'New'
                           : row.importStatus === 'exists' ? 'Already exists'
                           : 'Error'}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Action row */}
              <div style={s.actionRow}>
                {errorCount > 0 && (
                  <button
                    style={s.outlineBtn}
                    onClick={() => triggerCsvDownload(previewErrorRows, 'judge_import_errors.csv')}
                  >
                    Download error rows ({errorCount})
                  </button>
                )}
                <div style={{ flex: 1 }} />
                <button
                  style={{ ...s.importBtn, ...(newCount === 0 ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }}
                  disabled={newCount === 0}
                  onClick={handleImport}
                >
                  Import {newCount} new judge{newCount !== 1 ? 's' : ''}
                </button>
              </div>
            </>
          )}

          {/* ════ IMPORTING ════ */}
          {view === 'importing' && (
            <div style={s.center}>
              <div style={s.spinner} />
              <p style={s.importingText}>Importing judges and sending invite emails…</p>
            </div>
          )}

          {/* ════ COMPLETE ════ */}
          {view === 'complete' && importResult !== null && (
            <div style={s.centeredWrap}>
              <div style={s.uploadCard}>
                <div style={s.completeIcon}>{importResult.errors > 0 ? '⚠️' : '✅'}</div>
                <h1 style={s.uploadTitle}>Import complete</h1>

                <div style={s.completeGrid}>
                  <div style={s.completeCard}>
                    <span style={s.completeNum}>{importResult.created}</span>
                    <span style={s.completeLabel}>Accounts created</span>
                  </div>
                  <div style={s.completeCard}>
                    <span style={s.completeNum}>{importResult.emailed}</span>
                    <span style={s.completeLabel}>Invite emails sent</span>
                  </div>
                  <div style={s.completeCard}>
                    <span style={{ ...s.completeNum, ...(importResult.skipped > 0 ? { color: '#6b7280' } : {}) }}>
                      {importResult.skipped}
                    </span>
                    <span style={s.completeLabel}>Already existed (skipped)</span>
                  </div>
                  <div style={s.completeCard}>
                    <span style={{ ...s.completeNum, ...(importResult.errors > 0 ? { color: '#dc2626' } : {}) }}>
                      {importResult.errors}
                    </span>
                    <span style={s.completeLabel}>Errors</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
                  {importResult.errors > 0 && importResult.errorRows.length > 0 && (
                    <button
                      style={s.outlineBtn}
                      onClick={() => triggerCsvDownload(importResult.errorRows, 'judge_import_errors.csv')}
                    >
                      Download error rows ({importResult.errors})
                    </button>
                  )}
                  <button
                    style={s.primaryBtn}
                    onClick={() => { setView('list'); setImportResult(null); setParsedRows([]) }}
                  >
                    Back to judge pool
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page:            { minHeight: '100vh', backgroundColor: '#f8f9fb', fontFamily: "'DM Sans', sans-serif" },
  center:          { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 52px)', gap: 16 },
  spinner:         { width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#111827', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },

  // Top bar
  topBar:          { backgroundColor: '#111827', padding: '0 24px' },
  topBarInner:     { maxWidth: 1200, margin: '0 auto', height: 52, display: 'flex', alignItems: 'center', gap: 10 },
  logo:            { width: 28, height: 28, borderRadius: 6, backgroundColor: '#fff', color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 },
  logoText:        { color: '#fff', fontWeight: 600, fontSize: 15 },
  topBarRole:      { color: '#9ca3af', fontSize: 13 },
  navBtn:          { marginLeft: 12, background: 'none', border: '1px solid #374151', borderRadius: 6, color: '#9ca3af', padding: '5px 12px', fontSize: 13, cursor: 'pointer' },

  // Layout
  layout:          { maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 'calc(100vh - 52px)' },
  sidebar:         { backgroundColor: '#fff', borderRight: '1px solid #e5e7eb', padding: '28px 20px' },
  sidebarTitle:    { fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 2px' },
  sidebarSub:      { fontSize: 12, color: '#9ca3af', margin: '0 0 24px' },
  sidebarStats:    { display: 'flex', flexDirection: 'column', gap: 10 },
  sidebarStat:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: '#f9fafb', borderRadius: 8 },
  sidebarStatNum:  { fontSize: 20, fontWeight: 700, color: '#111827' },
  sidebarStatLabel:{ fontSize: 12, color: '#6b7280' },
  main:            { padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 16 },

  // Page header
  pageHeader:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  pageTitle:       { fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 },
  headerBtns:      { display: 'flex', gap: 10 },

  // Cards
  card:            { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' },
  cardHeader:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle:       { fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 },

  // Form
  formGrid:        { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  label:           { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 },
  input:           { width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 11px', fontSize: 14, color: '#111827', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff' },

  // Judge list table
  tblHead:         { display: 'grid', gridTemplateColumns: '2fr 3fr 1.5fr 1.2fr', gap: 12, padding: '6px 10px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' },
  tblRow:          { display: 'grid', gridTemplateColumns: '2fr 3fr 1.5fr 1.2fr', gap: 12, padding: '11px 10px', borderTop: '1px solid #f3f4f6', alignItems: 'center' },
  tblName:         { fontSize: 14, fontWeight: 500, color: '#111827' },
  tblMuted:        { fontSize: 13, color: '#6b7280' },
  pill:            { display: 'inline-block', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 600 },
  empty:           { fontSize: 14, color: '#9ca3af', textAlign: 'center', padding: '24px 0', margin: 0 },

  // Buttons
  primaryBtn:      { backgroundColor: '#111827', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  outlineBtn:      { backgroundColor: '#fff', color: '#374151', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  saveBtn:         { backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  importBtn:       { backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  ghostBtn:        { background: 'none', border: 'none', fontSize: 13, color: '#2563eb', cursor: 'pointer', fontWeight: 500, padding: 0 },
  backLink:        { background: 'none', border: 'none', fontSize: 13, color: '#6b7280', cursor: 'pointer', padding: 0, display: 'block' },

  // Banners
  errorBanner:     { backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '9px 14px', color: '#dc2626', fontSize: 13, marginBottom: 14 },
  successBanner:   { backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '9px 14px', color: '#16a34a', fontSize: 13, marginBottom: 14 },

  // Upload view
  centeredWrap:    { display: 'flex', justifyContent: 'center', paddingTop: 40 },
  uploadCard:      { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '36px 40px', width: '100%', maxWidth: 520 },
  uploadTitle:     { fontSize: 22, fontWeight: 700, color: '#111827', margin: '12px 0 8px', textAlign: 'center' },
  uploadSub:       { fontSize: 13, color: '#6b7280', textAlign: 'center', margin: '0 0 24px', lineHeight: 1.6 },
  code:            { fontFamily: 'monospace', backgroundColor: '#f3f4f6', padding: '1px 5px', borderRadius: 4, fontSize: 12 },
  dropZone:        { border: '2px dashed #d1d5db', borderRadius: 12, padding: '40px 24px', textAlign: 'center', cursor: 'pointer' },
  dropZoneActive:  { borderColor: '#111827', backgroundColor: '#f9fafb' },
  dropIcon:        { fontSize: 32, marginBottom: 10 },
  dropMain:        { fontSize: 15, color: '#374151', margin: '0 0 4px' },
  dropBrowse:      { color: '#2563eb', fontWeight: 600 },
  dropHint:        { fontSize: 12, color: '#9ca3af', margin: 0 },

  // Preview
  summaryRow:      { display: 'flex', gap: 10, flexWrap: 'wrap' },
  summaryPill:     { borderRadius: 99, padding: '6px 16px', fontSize: 14, fontWeight: 500 },
  filterRow:       { display: 'flex', gap: 4, backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 4, width: 'fit-content' },
  filterTab:       { background: 'none', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 13, color: '#6b7280', cursor: 'pointer', whiteSpace: 'nowrap' },
  filterTabActive: { backgroundColor: '#111827', color: '#fff', fontWeight: 600 },
  previewHead:     { display: 'grid', gridTemplateColumns: '36px 1.5fr 1.5fr 2fr 1.2fr 1.4fr', gap: 10, padding: '6px 10px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' },
  previewRow:      { display: 'grid', gridTemplateColumns: '36px 1.5fr 1.5fr 2fr 1.2fr 1.4fr', gap: 10, padding: '10px 10px', borderTop: '1px solid #f3f4f6', alignItems: 'center' },
  previewRowErr:   { backgroundColor: '#fff7f7' },
  rowNum:          { fontSize: 12, color: '#9ca3af', fontWeight: 600 },
  cell:            { fontSize: 13, color: '#374151' },
  cellBad:         { color: '#dc2626', fontWeight: 500 },
  actionRow:       { display: 'flex', alignItems: 'center', gap: 12 },

  // Importing
  importingText:   { fontSize: 15, color: '#6b7280', margin: 0 },

  // Complete
  completeIcon:    { fontSize: 40, textAlign: 'center' },
  completeGrid:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20 },
  completeCard:    { backgroundColor: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 10, padding: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4 },
  completeNum:     { fontSize: 28, fontWeight: 700, color: '#111827' },
  completeLabel:   { fontSize: 12, color: '#6b7280' },
}
