'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'signin' | 'reset'>('signin')
  const [resetSent, setResetSent] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      window.location.href = '/dashboard'
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setResetSent(true)
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={styles.logoMark}>G</div>
          <div>
            <div style={styles.logoName}>Gymnastats</div>
            <div style={styles.logoSub}>MAGA Scoring Platform</div>
          </div>
        </div>

        {mode === 'signin' ? (
          <>
            <h1 style={styles.heading}>Welcome back</h1>
            <p style={styles.subheading}>Sign in to your account</p>
            <form onSubmit={handleSignIn} style={styles.form}>
              <div style={styles.field}>
                <label style={styles.label}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  style={styles.input}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={styles.input}
                />
              </div>
              {error && <div style={styles.error}>{error}</div>}
              <button type="submit" disabled={loading} style={styles.btn}>
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
            <button
              onClick={() => setMode('reset')}
              style={styles.link}
            >
              Forgot your password?
            </button>
          </>
        ) : (
          <>
            <h1 style={styles.heading}>Reset password</h1>
            <p style={styles.subheading}>We&apos;ll send you a reset link</p>
            {resetSent ? (
              <div style={styles.success}>
                Check your email for a password reset link.
              </div>
            ) : (
              <form onSubmit={handleReset} style={styles.form}>
                <div style={styles.field}>
                  <label style={styles.label}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    style={styles.input}
                  />
                </div>
                {error && <div style={styles.error}>{error}</div>}
                <button type="submit" disabled={loading} style={styles.btn}>
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
              </form>
            )}
            <button onClick={() => setMode('signin')} style={styles.link}>
              Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0f1e',
    fontFamily: "'Georgia', serif",
    padding: '1rem',
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    padding: '2.5rem',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '2rem',
  },
  logoMark: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    background: '#0a0f1e',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    fontWeight: '700',
    fontFamily: 'Georgia, serif',
  },
  logoName: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#0a0f1e',
    letterSpacing: '-0.3px',
  },
  logoSub: {
    fontSize: '11px',
    color: '#888',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  heading: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#0a0f1e',
    margin: '0 0 4px',
    letterSpacing: '-0.5px',
  },
  subheading: {
    fontSize: '14px',
    color: '#666',
    margin: '0 0 1.5rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#333',
    fontFamily: 'system-ui, sans-serif',
  },
  input: {
    padding: '10px 12px',
    border: '1.5px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: '15px',
    outline: 'none',
    fontFamily: 'system-ui, sans-serif',
    transition: 'border-color 0.15s',
    color: '#0a0f1e',
  },
  btn: {
    marginTop: '8px',
    padding: '12px',
    background: '#0a0f1e',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
    transition: 'opacity 0.15s',
  },
  error: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '10px 12px',
    fontSize: '13px',
    color: '#dc2626',
    fontFamily: 'system-ui, sans-serif',
  },
  success: {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '6px',
    padding: '12px',
    fontSize: '14px',
    color: '#16a34a',
    fontFamily: 'system-ui, sans-serif',
    marginBottom: '1rem',
  },
  link: {
    background: 'none',
    border: 'none',
    color: '#666',
    fontSize: '13px',
    cursor: 'pointer',
    marginTop: '1rem',
    textDecoration: 'underline',
    display: 'block',
    textAlign: 'center',
    fontFamily: 'system-ui, sans-serif',
  },
}
