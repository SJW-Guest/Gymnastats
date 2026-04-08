// src/proxy.ts
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

// Paths that handle their own auth client-side
const BYPASS_PATHS = [
  '/auth/login',
  '/auth/callback',
  '/auth/signout',
  '/dashboard',
  '/club/dashboard',
  '/roster',
  '/lineup',
  '/scores',
  '/standings',
  '/meet',
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Let these through — they handle auth themselves
  if (BYPASS_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.next();
  if (pathname.startsWith('/_next/') || pathname.includes('.')) return NextResponse.next();

  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    const loginUrl = new URL('/auth/login', req.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
