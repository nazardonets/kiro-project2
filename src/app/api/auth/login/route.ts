import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { loginSchema } from '@/lib/validation';
import { AuthService } from '@/services/auth-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate input with Zod
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, { message: string; constraint: string }[]> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as string;
        if (!fieldErrors[field]) {
          fieldErrors[field] = [];
        }
        fieldErrors[field].push({
          message: issue.message,
          constraint: issue.code,
        });
      }

      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          fields: fieldErrors,
        },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;

    // Call AuthService
    const supabase = createServerSupabaseClient();
    const authService = new AuthService(supabase);
    const result = await authService.login(email, password);

    if (!result.success) {
      return NextResponse.json(
        {
          code: result.error?.code,
          message: result.error?.message,
        },
        { status: 401 },
      );
    }

    const userData = result.data;
    return NextResponse.json(
      {
        message: 'Login successful',
        user: {
          userId: userData?.userId,
          email: userData?.email,
          role: userData?.role,
        },
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
