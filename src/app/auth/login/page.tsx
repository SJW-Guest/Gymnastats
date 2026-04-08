// v2 - role-based redirect
'use client'
import { useState } from 'react'

export const dynamic = 'force-dynamic'

const ROLE_HOME: Record<string, string> = {
  maga_admin: '/dashboard',
  club_staff:  '/club/dashboard',
  parent:      '/scores',
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { createBrowserClient } = await import('@supabase/ssr')
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      // Sign in
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }

      // Look up role from users table
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', authData.user.id)
        .single()

      const role = profile?.role as string | undefined
      const destination = role ? (ROLE_HOME[role] ?? '/dashboard') : '/dashboard'
      window.location.href = destination

    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0f1e',padding:'1rem'}}>
      <div style={{background:'#fff',borderRadius:'16px',padding:'2.5rem',width:'100%',maxWidth:'400px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'2rem'}}>
          <div style={{width:'44px',height:'44px',borderRadius:'10px',background:'#0a0f1e',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'22px',fontWeight:'700',fontFamily:'Georgia,serif'}}>G</div>
          <div>
            <div style={{fontSize:'18px',fontWeight:'700',color:'#0a0f1e'}}>Gymnastats</div>
            <div style={{fontSize:'11px',color:'#888',textTransform:'uppercase' as const,letterSpacing:'.05em'}}>MAGA Scoring Platform</div>
          </div>
        </div>
        <h1 style={{fontSize:'24px',fontWeight:'700',color:'#0a0f1e',margin:'0 0 4px'}}>Welcome back</h1>
        <p style={{fontSize:'14px',color:'#666',margin:'0 0 1.5rem'}}>Sign in to your account</p>
        <form onSubmit={handleSignIn} style={{display:'flex',flexDirection:'column' as const,gap:'1rem'}}>
          <div style={{display:'flex',flexDirection:'column' as const,gap:'5px'}}>
            <label style={{fontSize:'13px',fontWeight:600,color:'#333'}}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e=>setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{padding:'10px 12px',border:'1.5px solid #e0e0e0',borderRadius:'8px',fontSize:'15px',color:'#0a0f1e',outline:'none'}}
            />
          </div>
          <div style={{display:'flex',flexDirection:'column' as const,gap:'5px'}}>
            <label style={{fontSize:'13px',fontWeight:600,color:'#333'}}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e=>setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{padding:'10px 12px',border:'1.5px solid #e0e0e0',borderRadius:'8px',fontSize:'15px',color:'#0a0f1e',outline:'none'}}
            />
          </div>
          {error && (
            <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:'6px',padding:'10px',fontSize:'13px',color:'#dc2626'}}>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{padding:'12px',background:'#0a0f1e',color:'#fff',border:'none',borderRadius:'8px',fontSize:'15px',fontWeight:600,cursor:'pointer'}}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
