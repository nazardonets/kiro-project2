import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Auth callback route that handles email confirmation redirects from Supabase.
 * When a user clicks the confirmation link in their email, Supabase redirects
 * them here with a code that we exchange for a session.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/onboarding';

  if (code) {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  // If there's no code or the exchange failed, redirect to login with an error
  return NextResponse.redirect(new URL('/auth/login?error=confirmation_failed', request.url));
}
