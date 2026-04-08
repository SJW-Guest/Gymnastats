// src/proxy.ts

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/auth/login', '/auth/callback', '/auth/signout'];

const ROLE_HOME: Record<string, string> = {
  maga_admin: '/dashboard',
  club_staff:  '/club/dashboard',
  parent:      '/scores',
};

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.next();
  if (pathname.startsWith('/_next/') || pathname.includes('.')) return NextResponse.next();

  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL('/auth/login', req.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role as string | undefined;
  const homeRoute = role ? (ROLE_HOME[role] ?? '/auth/login') : '/auth/login';

  if (pathname === '/') return NextResponse.redirect(new URL(homeRoute, req.url));

  if (pathname.startsWith('/dashboard') && role !== 'maga_admin') {
    return NextResponse.redirect(new URL(homeRoute, req.url));
  }

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
