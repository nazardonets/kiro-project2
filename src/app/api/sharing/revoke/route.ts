import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { PartnerLinkStatus, UserRole } from '@/lib/types';
import { AuthService } from '@/services/auth-service';
import { SupabaseSharingRepository } from '@/services/sharing-repository';
import { SharingService } from '@/services/sharing-service';

/**
 * POST /api/sharing/revoke
 *
 * Revoke all sharing — disables all insight categories and notification types.
 * The partner link remains active but all content is hidden from the partner.
 * Only Primary_User can revoke sharing.
 *
 * Validates: Requirements 2.3, 3.1, 3.5
 */
export async function POST() {
  try {
    const supabase = createServerSupabaseClient();

    // Authenticate and verify role
    const authService = new AuthService(supabase);
    const contextResult = await authService.getUserContext();

    if (!contextResult.success || !contextResult.data) {
      return NextResponse.json(
        {
          code: 'UNAUTHENTICATED',
          message: 'You must be logged in to revoke sharing.',
        },
        { status: 401 },
      );
    }

    if (contextResult.data.role !== UserRole.PRIMARY) {
      return NextResponse.json(
        {
          code: 'FORBIDDEN',
          message: 'Only the Primary_User can revoke sharing.',
        },
        { status: 403 },
      );
    }

    // Wire up the service
    const repository = new SupabaseSharingRepository(supabase);
    const sharingService = new SharingService(repository);

    // Verify there is an active partner link
    const hasPartner = await repository.hasActivePartnerLink(contextResult.data.userId);
    if (!hasPartner) {
      return NextResponse.json(
        {
          code: 'NO_ACTIVE_PARTNER',
          message: 'No active partner link found. Cannot revoke sharing.',
        },
        { status: 409 },
      );
    }

    // Disable all categories and notifications
    const result = await sharingService.updateCategories(contextResult.data.userId, {
      emotional_tendencies: false,
      behavioral_patterns: false,
      energy_levels: false,
      communication_guidance: false,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          code: result.error?.code,
          message: result.error?.message,
        },
        { status: 500 },
      );
    }

    // Also disable all notification types
    const notifResult = await sharingService.updateNotifications(contextResult.data.userId, {
      daily_summaries: false,
      phase_alerts: false,
      partner_reminders: false,
      email_notifications_enabled: false,
    });

    if (!notifResult.success) {
      return NextResponse.json(
        {
          code: notifResult.error?.code,
          message: notifResult.error?.message,
        },
        { status: 500 },
      );
    }

    // Update partner link status to 'revoked'
    await repository.updatePartnerLinkStatus(contextResult.data.userId, PartnerLinkStatus.REVOKED);

    return NextResponse.json(
      {
        message: 'All sharing has been revoked. Partner access has been removed.',
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
