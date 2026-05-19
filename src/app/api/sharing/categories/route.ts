import { NextRequest, NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole } from '@/lib/types';
import { sharingCategoriesSchema } from '@/lib/validation/sharing.schemas';
import { AuthService } from '@/services/auth-service';
import { SupabaseSharingRepository } from '@/services/sharing-repository';
import { SharingService } from '@/services/sharing-service';

/**
 * GET /api/sharing/categories
 *
 * Retrieve current sharing preferences for the Primary_User.
 * Returns all category and notification toggles.
 *
 * Validates: Requirements 3.1, 3.2
 */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    // Authenticate and verify role
    const authService = new AuthService(supabase);
    const contextResult = await authService.getUserContext();

    if (!contextResult.success || !contextResult.data) {
      return NextResponse.json(
        {
          code: 'UNAUTHENTICATED',
          message: 'You must be logged in to view sharing preferences.',
        },
        { status: 401 },
      );
    }

    if (contextResult.data.role !== UserRole.PRIMARY) {
      return NextResponse.json(
        {
          code: 'FORBIDDEN',
          message: 'Only the Primary_User can view sharing preferences.',
        },
        { status: 403 },
      );
    }

    // Fetch sharing preferences
    const repository = new SupabaseSharingRepository(supabase);
    const sharingService = new SharingService(repository);
    const result = await sharingService.getPreferences(contextResult.data.userId);

    if (!result.success) {
      // No preferences found — return defaults (all enabled)
      return NextResponse.json(
        {
          preferences: {
            emotional_tendencies: true,
            behavioral_patterns: true,
            energy_levels: true,
            communication_guidance: true,
            daily_summaries: true,
            phase_alerts: true,
            partner_reminders: true,
            email_notifications_enabled: true,
          },
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        preferences: result.data,
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

/**
 * PUT /api/sharing/categories
 *
 * Toggle individual insight categories independently.
 * Only Primary_User can modify sharing preferences.
 *
 * Validates: Requirements 3.1, 3.2, 3.4
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();

    // Authenticate and verify role
    const authService = new AuthService(supabase);
    const contextResult = await authService.getUserContext();

    if (!contextResult.success || !contextResult.data) {
      return NextResponse.json(
        {
          code: 'UNAUTHENTICATED',
          message: 'You must be logged in to modify sharing preferences.',
        },
        { status: 401 },
      );
    }

    if (contextResult.data.role !== UserRole.PRIMARY) {
      return NextResponse.json(
        {
          code: 'FORBIDDEN',
          message: 'Only the Primary_User can modify sharing preferences.',
        },
        { status: 403 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parseResult = sharingCategoriesSchema.safeParse(body);

    if (!parseResult.success) {
      const fields: Record<string, { message: string; constraint: string }> = {};
      for (const issue of parseResult.error.issues) {
        const fieldName = issue.path.join('.');
        fields[fieldName] = {
          message: issue.message,
          constraint: issue.code,
        };
      }

      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          fields,
        },
        { status: 400 },
      );
    }

    // Call SharingService
    const repository = new SupabaseSharingRepository(supabase);
    const sharingService = new SharingService(repository);
    const result = await sharingService.updateCategories(
      contextResult.data.userId,
      parseResult.data,
    );

    if (!result.success) {
      const statusCode = result.error?.code === 'NO_ACTIVE_PARTNER' ? 409 : 500;
      return NextResponse.json(
        {
          code: result.error?.code,
          message: result.error?.message,
        },
        { status: statusCode },
      );
    }

    return NextResponse.json(
      {
        message: 'Sharing categories updated successfully.',
        preferences: result.data,
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
