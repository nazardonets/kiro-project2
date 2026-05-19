import { NextRequest, NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole } from '@/lib/types';
import { adminSearchSchema } from '@/lib/validation/admin.schemas';
import { AdminService, AdminRepository, AdminEmailService } from '@/services/admin-service';
import { AuthService } from '@/services/auth-service';

import { createAdminRepository, createAdminEmailService } from '../_shared';

/**
 * GET /api/admin/users - Search users by email or account ID.
 * Returns max 50 results per query.
 *
 * Query params:
 *   - query: search string (required)
 *   - limit: max results (optional, default 50, max 50)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();

    // Verify authentication and admin role
    const authService = new AuthService(supabase);
    const contextResult = await authService.getUserContext();

    if (!contextResult.success || !contextResult.data) {
      return NextResponse.json(
        {
          code: 'UNAUTHENTICATED',
          message: 'You must be logged in to access the admin panel.',
        },
        { status: 401 },
      );
    }

    if (contextResult.data.role !== UserRole.ADMIN) {
      return NextResponse.json(
        {
          code: 'FORBIDDEN',
          message: 'Only admin users can access this resource.',
        },
        { status: 403 },
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query') ?? '';
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    // Validate input
    const parsed = adminSearchSchema.safeParse({ query, limit });
    if (!parsed.success) {
      const fieldErrors: Record<string, { message: string; constraint: string }> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.join('.');
        fieldErrors[field] = {
          message: issue.message,
          constraint: issue.code,
        };
      }
      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid search parameters',
          fields: fieldErrors,
        },
        { status: 400 },
      );
    }

    // Call AdminService
    const repository: AdminRepository = createAdminRepository(supabase);
    const emailService: AdminEmailService = createAdminEmailService();
    const adminService = new AdminService(repository, emailService);

    const result = await adminService.searchUsers(parsed.data.query, parsed.data.limit);

    if (!result.success) {
      return NextResponse.json(
        {
          code: result.error?.code,
          message: result.error?.message,
          fields: result.error?.fields,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        data: result.data,
        count: result.data?.length ?? 0,
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
