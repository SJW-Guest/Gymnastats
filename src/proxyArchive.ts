// src/middleware.ts
// Handles auth + role-based routing for all protected pages
//
// Routes:
//   maga_admin  → /dashboard        (MAGA admin dashboard)
//   club_staff  → /club/dashboard   (Club dashboard)
//   parent      → /scores           (Score viewing)
//   unauthenticated → /auth/login

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/auth/login', '/auth/callback', '/auth/signout'];

const ROLE_HOME: Record<string, string> = {
  maga_admin: '/dashboard',
  club_staff: '/club/dashboard',
  parent:     '/scores',
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths through
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow API routes to handle their own auth
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const res = NextResponse.next();

  // Create Supabase SSR client using cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Not logged in → redirect to login
  if (!user) {
    const loginUrl = new URL('/auth/login', req.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Get user role from users table
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role as string | undefined;
  const homeRoute = role ? ROLE_HOME[role] : '/auth/login';

  // If user is at root, redirect to their home
  if (pathname === '/') {
    return NextResponse.redirect(new URL(homeRoute, req.url));
  }

  // If club_staff tries to access MAGA dashboard, redirect
  if (pathname.startsWith('/dashboard') && role !== 'maga_admin') {
    return NextResponse.redirect(new URL(homeRoute, req.url));
  }

  // If maga_admin tries to access club dashboard, redirect
  if (pathname.startsWith('/club/dashboard') && role !== 'club_staff') {
    return NextResponse.redirect(new URL(homeRoute, req.url));
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
