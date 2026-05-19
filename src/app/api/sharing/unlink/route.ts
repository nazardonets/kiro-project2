import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole } from '@/lib/types';
import { AuthService } from '@/services/auth-service';
import { SupabaseSharingRepository } from '@/services/sharing-repository';
import { SharingService } from '@/services/sharing-service';

/**
 * POST /api/sharing/unlink
 *
 * Unlink the Partner_User from the Primary_User.
 * Removes partner access without deleting Primary_User data.
 * Only Primary_User can unlink.
 *
 * Validates: Requirements 2.6
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
          message: 'You must be logged in to unlink a partner.',
        },
        { status: 401 },
      );
    }

    if (contextResult.data.role !== UserRole.PRIMARY) {
      return NextResponse.json(
        {
          code: 'FORBIDDEN',
          message: 'Only the Primary_User can unlink a partner.',
        },
        { status: 403 },
      );
    }

    // Call SharingService to unlink
    const repository = new SupabaseSharingRepository(supabase);
    const sharingService = new SharingService(repository);
    const result = await sharingService.unlinkPartner(contextResult.data.userId);

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
        message: 'Partner has been unlinked successfully. All partner access has been removed.',
        unlinkedPartnerId: result.data?.unlinkedPartnerId,
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
