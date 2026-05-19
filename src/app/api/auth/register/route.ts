import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { registerSchema } from '@/lib/validation';
import { AuthService } from '@/services/auth-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate input with Zod
    const parsed = registerSchema.safeParse(body);
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
    const result = await authService.registerPrimaryUser(email, password);

    if (!result.success) {
      const statusCode = result.error?.code === 'EMAIL_IN_USE' ? 409 : 400;
      return NextResponse.json(
        {
          code: result.error?.code,
          message: result.error?.message,
          fields: result.error?.fields,
        },
        { status: statusCode },
      );
    }

    return NextResponse.json(
      {
        message: 'Account created successfully',
        user: result.data,
      },
      { status: 201 },
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
