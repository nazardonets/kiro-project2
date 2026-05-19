import { NextRequest, NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole } from '@/lib/types';
import { adminOverrideSchema, updateOverrideSchema } from '@/lib/validation/admin.schemas';
import { AuthService } from '@/services/auth-service';

/**
 * POST /api/admin/cycles/:id/override - Create an override for a cycle phase.
 * Body: { cycle_record_id: string, phase: CyclePhase, replacement_content: string }
 *
 * The :id param is the cycle_record_id. The body's cycle_record_id must match.
 * The original system-generated content is preserved for revert capability.
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

    const { id: cycleRecordId } = params;
    const body = await request.json();

    // Use the URL param as the cycle_record_id
    const input = { ...body, cycle_record_id: cycleRecordId };

    // Validate input
    const parsed = adminOverrideSchema.safeParse(input);
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
        { code: 'VALIDATION_ERROR', message: 'Invalid override data', fields: fieldErrors },
        { status: 400 },
      );
    }

    // Verify cycle record exists
    const { data: cycleRecord, error: cycleError } = await supabase
      .from('cycle_record')
      .select('id')
      .eq('id', cycleRecordId)
      .single();

    if (cycleError || !cycleRecord) {
      return NextResponse.json(
        { code: 'CYCLE_NOT_FOUND', message: 'Cycle record not found' },
        { status: 404 },
      );
    }

    // Check if an override already exists for this cycle + phase
    const { data: existingOverride } = await supabase
      .from('admin_override')
      .select('id')
      .eq('cycle_record_id', cycleRecordId)
      .eq('phase', parsed.data.phase)
      .single();

    if (existingOverride) {
      return NextResponse.json(
        {
          code: 'OVERRIDE_EXISTS',
          message: 'An override already exists for this cycle phase. Use PUT to update it.',
        },
        { status: 409 },
      );
    }

    // Preserve original content (the system-generated content for this phase).
    // In a full implementation, this would fetch the actual generated content.
    // For now, we store a placeholder that indicates the original was system-generated.
    const originalContent = body.original_content ?? '[system-generated content]';

    // Create override
    const { data: override, error: insertError } = await supabase
      .from('admin_override')
      .insert({
        admin_user_id: contextResult.data.userId,
        cycle_record_id: cycleRecordId,
        phase: parsed.data.phase,
        replacement_content: parsed.data.replacement_content,
        original_content: originalContent,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { code: 'INSERT_FAILED', message: 'Failed to create override' },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: 'Override created successfully', data: override },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/cycles/:id/override - Update an existing override.
 * Body: { override_id: string, replacement_content: string }
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

    const { id: cycleRecordId } = params;
    const body = await request.json();
    const overrideId = body.override_id;

    if (!overrideId) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: 'override_id is required' },
        { status: 400 },
      );
    }

    // Validate replacement content
    const parsed = updateOverrideSchema.safeParse({
      replacement_content: body.replacement_content,
    });
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
        { code: 'VALIDATION_ERROR', message: 'Invalid override data', fields: fieldErrors },
        { status: 400 },
      );
    }

    // Verify override exists and belongs to this cycle record
    const { data: existing, error: fetchError } = await supabase
      .from('admin_override')
      .select('id')
      .eq('id', overrideId)
      .eq('cycle_record_id', cycleRecordId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { code: 'OVERRIDE_NOT_FOUND', message: 'Override not found for this cycle record' },
        { status: 404 },
      );
    }

    // Update override
    const { data: updated, error: updateError } = await supabase
      .from('admin_override')
      .update({
        replacement_content: parsed.data.replacement_content,
        updated_at: new Date().toISOString(),
      })
      .eq('id', overrideId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { code: 'UPDATE_FAILED', message: 'Failed to update override' },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: 'Override updated successfully', data: updated },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/cycles/:id/override - Delete an override (revert to original content).
 * Body: { override_id: string }
 *
 * Deleting an override restores the original system-generated content.
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

    const { id: cycleRecordId } = params;
    const body = await request.json();
    const overrideId = body.override_id;

    if (!overrideId) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: 'override_id is required' },
        { status: 400 },
      );
    }

    // Verify override exists and belongs to this cycle record
    const { data: existing, error: fetchError } = await supabase
      .from('admin_override')
      .select('id, original_content')
      .eq('id', overrideId)
      .eq('cycle_record_id', cycleRecordId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { code: 'OVERRIDE_NOT_FOUND', message: 'Override not found for this cycle record' },
        { status: 404 },
      );
    }

    // Delete override (reverts to original content)
    const { error: deleteError } = await supabase
      .from('admin_override')
      .delete()
      .eq('id', overrideId);

    if (deleteError) {
      return NextResponse.json(
        { code: 'DELETE_FAILED', message: 'Failed to delete override' },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        message: 'Override reverted successfully. Original content restored.',
        original_content: existing.original_content,
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
