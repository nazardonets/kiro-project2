import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { acceptInviteSchema } from '@/lib/validation';
import { AuthService } from '@/services/auth-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate input with Zod
    const parsed = acceptInviteSchema.safeParse(body);
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

    const { token, email, password } = parsed.data;

    // Call AuthService to handle invite acceptance
    const supabase = createServerSupabaseClient();
    const authService = new AuthService(supabase);
    const result = await authService.registerPartnerViaInvite(token, email, password);

    if (!result.success) {
      const statusCodeMap: Record<string, number> = {
        VALIDATION_ERROR: 400,
        INVALID_INVITE: 404,
        INVITE_ALREADY_USED: 409,
        INVITE_EXPIRED: 410,
        EMAIL_IN_USE: 409,
        LINK_ERROR: 409,
      };
      const statusCode = statusCodeMap[result.error?.code || ''] || 400;

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
        message: 'Partner account created successfully',
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
