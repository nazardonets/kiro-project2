import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Routes that don't require authentication */
const PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/register',
  '/auth/accept-invite',
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/accept-invite',
];

/** Routes that require specific roles */
const ROLE_ROUTES: Record<string, string[]> = {
  '/dashboard': ['primary'],
  '/partner': ['partner'],
  '/admin': ['admin'],
};

/** Role-based home pages for redirect after login */
const ROLE_HOME: Record<string, string> = {
  primary: '/dashboard',
  partner: '/partner',
  admin: '/admin',
};

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'));
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image') ||
    pathname === '/favicon.ico' ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/.test(pathname)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets
  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // If env vars are missing, allow the request through (will fail at API level)
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Refresh session token
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Allow public routes without authentication
  if (isPublicRoute(pathname)) {
    // If user is already authenticated and trying to access auth pages, redirect to their home
    if (user && (pathname.startsWith('/auth/login') || pathname.startsWith('/auth/register'))) {
      const role = (user.user_metadata?.role as string) || 'primary';
      const homePath = ROLE_HOME[role] || '/dashboard';
      const url = request.nextUrl.clone();
      url.pathname = homePath;
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // For protected routes, redirect unauthenticated users to login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }

  // Get user role from metadata
  const role = (user.user_metadata?.role as string) || 'primary';

  // Check role-based route access
  for (const [routePrefix, allowedRoles] of Object.entries(ROLE_ROUTES)) {
    if (pathname.startsWith(routePrefix)) {
      if (!allowedRoles.includes(role)) {
        // Redirect to the user's appropriate home page
        const homePath = ROLE_HOME[role] || '/dashboard';
        const url = request.nextUrl.clone();
        url.pathname = homePath;
        return NextResponse.redirect(url);
      }
      break;
    }
  }

  // Attach user context headers for downstream use
  supabaseResponse.headers.set('x-user-id', user.id);
  supabaseResponse.headers.set('x-user-role', role);
  supabaseResponse.headers.set('x-user-email', user.email || '');

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
