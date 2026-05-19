import { NextRequest, NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole } from '@/lib/types';
import { AdminService } from '@/services/admin-service';
import { AuthService } from '@/services/auth-service';

import { createAdminRepository, createAdminEmailService } from '../../../_shared';

/**
 * POST /api/admin/users/:id/suspend - Suspend a user account.
 * Requires { reason: string } in the request body (1-500 chars).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabaseClient();

    // Verify authentication and admin role
    const authService = new AuthService(supabase);
    const contextResult = await authService.getUserContext();

    if (!contextResult.success || !contextResult.data) {
      return NextResponse.json(
        { code: 'UNAUTHENTICATED', message: 'You must be logged in to access the admin panel.' },
        { status: 401 },
      );
    }

    if (contextResult.data.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { code: 'FORBIDDEN', message: 'Only admin users can access this resource.' },
        { status: 403 },
      );
    }

    const { id } = params;
    const body = await request.json();
    const reason = body.reason ?? '';

    const repository = createAdminRepository(supabase);
    const emailService = createAdminEmailService();
    const adminService = new AdminService(repository, emailService);

    const result = await adminService.suspendAccount(id, reason);

    if (!result.success) {
      const statusMap: Record<string, number> = {
        VALIDATION_ERROR: 400,
        USER_NOT_FOUND: 404,
        ALREADY_SUSPENDED: 409,
        ALREADY_DELETED: 409,
      };
      const statusCode = statusMap[result.error?.code ?? ''] ?? 400;
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
        message: 'Account suspended successfully',
        data: result.data,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}
