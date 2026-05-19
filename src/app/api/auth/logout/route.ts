import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AuthService } from '@/services/auth-service';

export async function POST() {
  try {
    const supabase = createServerSupabaseClient();
    const authService = new AuthService(supabase);
    const result = await authService.logout();

    if (!result.success) {
      return NextResponse.json(
        {
          code: result.error?.code,
          message: result.error?.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        message: 'Logged out successfully',
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
      },
      { status: 500 },
    );
  }
}
