import { NextRequest, NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole } from '@/lib/types';
import { sharingNotificationsSchema } from '@/lib/validation/sharing.schemas';
import { AuthService } from '@/services/auth-service';
import { SupabaseSharingRepository } from '@/services/sharing-repository';
import { SharingService } from '@/services/sharing-service';

/**
 * PUT /api/sharing/notifications
 *
 * Toggle notification types independently.
 * Only Primary_User can modify sharing preferences.
 *
 * Validates: Requirements 3.3, 3.4
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
    const parseResult = sharingNotificationsSchema.safeParse(body);

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
    const result = await sharingService.updateNotifications(
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
        message: 'Notification preferences updated successfully.',
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
