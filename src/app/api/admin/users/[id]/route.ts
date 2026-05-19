import { NextRequest, NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole } from '@/lib/types';
import { AdminService } from '@/services/admin-service';
import { AuthService } from '@/services/auth-service';

import { createAdminRepository, createAdminEmailService } from '../../_shared';

/**
 * GET /api/admin/users/:id - View account details for a specific user.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
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
    const repository = createAdminRepository(supabase);
    const emailService = createAdminEmailService();
    const adminService = new AdminService(repository, emailService);

    const result = await adminService.getAccountDetails(id);

    if (!result.success) {
      const statusCode = result.error?.code === 'USER_NOT_FOUND' ? 404 : 400;
      return NextResponse.json(
        { code: result.error?.code, message: result.error?.message },
        { status: statusCode },
      );
    }

    return NextResponse.json({ data: result.data }, { status: 200 });
  } catch {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/users/:id - Update user account (e.g., role, status).
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Verify user exists
    const repository = createAdminRepository(supabase);
    const user = await repository.getUserById(id);

    if (!user) {
      return NextResponse.json(
        { code: 'USER_NOT_FOUND', message: 'User account not found' },
        { status: 404 },
      );
    }

    // Update allowed fields (email, role, status)
    const updateData: Record<string, unknown> = {};
    if (body.email !== undefined) updateData.email = body.email;
    if (body.role !== undefined) updateData.role = body.role;
    if (body.status !== undefined) updateData.status = body.status;
    updateData.updated_at = new Date().toISOString();

    const { error } = await supabase.from('user').update(updateData).eq('id', id);

    if (error) {
      return NextResponse.json(
        { code: 'UPDATE_FAILED', message: 'Failed to update user account' },
        { status: 500 },
      );
    }

    // Fetch updated user
    const updatedUser = await repository.getUserById(id);

    return NextResponse.json({ data: updatedUser }, { status: 200 });
  } catch {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/users/:id - Delete user account with cascade.
 * Requires { confirmed: true } in the request body.
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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
    const confirmed = body.confirmed === true;

    const repository = createAdminRepository(supabase);
    const emailService = createAdminEmailService();
    const adminService = new AdminService(repository, emailService);

    const result = await adminService.deleteAccount(id, confirmed);

    if (!result.success) {
      const statusMap: Record<string, number> = {
        DELETION_NOT_CONFIRMED: 400,
        USER_NOT_FOUND: 404,
        ALREADY_DELETED: 409,
      };
      const statusCode = statusMap[result.error?.code ?? ''] ?? 400;
      return NextResponse.json(
        { code: result.error?.code, message: result.error?.message },
        { status: statusCode },
      );
    }

    return NextResponse.json(
      { message: 'Account deleted successfully', data: result.data },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}
