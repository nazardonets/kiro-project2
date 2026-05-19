import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole } from '@/lib/types';
import { AuthService } from '@/services/auth-service';
import { InviteService } from '@/services/invite-service';

export async function POST() {
  try {
    const supabase = createServerSupabaseClient();

    // Verify the user is authenticated and is a Primary_User
    const authService = new AuthService(supabase);
    const contextResult = await authService.getUserContext();

    if (!contextResult.success || !contextResult.data) {
      return NextResponse.json(
        {
          code: 'UNAUTHENTICATED',
          message: 'You must be logged in to generate an invite.',
        },
        { status: 401 },
      );
    }

    if (contextResult.data.role !== UserRole.PRIMARY) {
      return NextResponse.json(
        {
          code: 'FORBIDDEN',
          message: 'Only Primary_Users can generate partner invitations.',
        },
        { status: 403 },
      );
    }

    // Generate the invite
    const inviteService = new InviteService(supabase);
    const result = await inviteService.generateInvite(contextResult.data.userId);

    if (!result.success) {
      const statusCode = result.error?.code === 'PARTNER_ALREADY_LINKED' ? 409 : 500;
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
        message: 'Invitation generated successfully',
        invite: result.data,
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
