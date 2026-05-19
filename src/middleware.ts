import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * User context extracted from session and database.
 * Attached to request headers for downstream consumption.
 */
interface UserContext {
  id: string;
  email: string;
  role: string;
  linkedPartnerId: string | null;
  sharingPermissions: SharingPermissions | null;
}

interface SharingPermissions {
  emotional_tendencies: boolean;
  behavioral_patterns: boolean;
  energy_levels: boolean;
  communication_guidance: boolean;
  daily_summaries: boolean;
  phase_alerts: boolean;
  partner_reminders: boolean;
}

/** Routes that don't require authentication */
const PUBLIC_ROUTES = ['/auth', '/api/auth/register', '/api/auth/login', '/api/auth/accept-invite'];

/** Role-based route protection configuration */
const ROLE_ROUTES: { prefix: string; allowedRoles: string[] }[] = [
  { prefix: '/dashboard', allowedRoles: ['primary'] },
  { prefix: '/partner', allowedRoles: ['partner'] },
  { prefix: '/admin', allowedRoles: ['admin'] },
  { prefix: '/api/admin', allowedRoles: ['admin'] },
];

/** Routes that require authentication but no specific role */
const AUTHENTICATED_ROUTES = ['/onboarding'];

/** Role-based home pages for redirect */
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

function isAuthenticatedOnlyRoute(pathname: string): boolean {
  return AUTHENTICATED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/'),
  );
}

function getRoleForRoute(pathname: string): string[] | null {
  for (const { prefix, allowedRoles } of ROLE_ROUTES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return allowedRoles;
    }
  }
  return null;
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

  // Refresh session and validate token
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Allow public routes without authentication
  if (isPublicRoute(pathname)) {
    // If user is already authenticated and trying to access auth pages, redirect to their home
    if (user && pathname.startsWith('/auth')) {
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

  // Authenticated-only routes (like /onboarding) - any authenticated user can access
  if (isAuthenticatedOnlyRoute(pathname)) {
    supabaseResponse.headers.set('x-user-id', user.id);
    supabaseResponse.headers.set('x-user-role', role);
    supabaseResponse.headers.set('x-user-email', user.email || '');
    return supabaseResponse;
  }

  // Check role-based route access
  const allowedRoles = getRoleForRoute(pathname);
  if (allowedRoles && !allowedRoles.includes(role)) {
    // Redirect to the user's appropriate home page
    const homePath = ROLE_HOME[role] || '/dashboard';
    const url = request.nextUrl.clone();
    url.pathname = homePath;
    return NextResponse.redirect(url);
  }

  // Fetch user context: linked partner ID and sharing permissions
  const userContext = await fetchUserContext(supabase, user.id, role);

  // Attach user context headers for downstream use
  supabaseResponse.headers.set('x-user-id', user.id);
  supabaseResponse.headers.set('x-user-role', role);
  supabaseResponse.headers.set('x-user-email', user.email || '');

  if (userContext.linkedPartnerId) {
    supabaseResponse.headers.set('x-linked-partner-id', userContext.linkedPartnerId);
  }

  if (userContext.sharingPermissions) {
    supabaseResponse.headers.set(
      'x-sharing-permissions',
      JSON.stringify(userContext.sharingPermissions),
    );
  }

  return supabaseResponse;
}

/**
 * Fetches user context from the database including linked partner ID
 * and sharing permissions.
 */
async function fetchUserContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  role: string,
): Promise<UserContext> {
  const context: UserContext = {
    id: userId,
    email: '',
    role,
    linkedPartnerId: null,
    sharingPermissions: null,
  };

  try {
    if (role === 'primary') {
      // For primary users, find their linked partner
      const { data: partnerLink } = await supabase
        .from('partner_link')
        .select('partner_user_id')
        .eq('primary_user_id', userId)
        .eq('status', 'active')
        .single();

      if (partnerLink) {
        context.linkedPartnerId = partnerLink.partner_user_id;
      }

      // Fetch sharing preferences for primary user
      const { data: sharingPrefs } = await supabase
        .from('sharing_preferences')
        .select(
          'emotional_tendencies, behavioral_patterns, energy_levels, communication_guidance, daily_summaries, phase_alerts, partner_reminders',
        )
        .eq('primary_user_id', userId)
        .single();

      if (sharingPrefs) {
        context.sharingPermissions = sharingPrefs;
      }
    } else if (role === 'partner') {
      // For partner users, find their linked primary user
      const { data: partnerLink } = await supabase
        .from('partner_link')
        .select('primary_user_id')
        .eq('partner_user_id', userId)
        .eq('status', 'active')
        .single();

      if (partnerLink) {
        context.linkedPartnerId = partnerLink.primary_user_id;

        // Fetch sharing preferences from the linked primary user
        const { data: sharingPrefs } = await supabase
          .from('sharing_preferences')
          .select(
            'emotional_tendencies, behavioral_patterns, energy_levels, communication_guidance, daily_summaries, phase_alerts, partner_reminders',
          )
          .eq('primary_user_id', partnerLink.primary_user_id)
          .single();

        if (sharingPrefs) {
          context.sharingPermissions = sharingPrefs;
        }
      }
    }
    // Admin users don't need partner link or sharing permissions
  } catch {
    // If database queries fail, continue with basic context
    // The route handlers will handle missing context gracefully
  }

  return context;
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
