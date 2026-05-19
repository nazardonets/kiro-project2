import { NextRequest, NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole } from '@/lib/types';
import { adminAnnotationSchema, updateAnnotationSchema } from '@/lib/validation/admin.schemas';
import { AuthService } from '@/services/auth-service';

/**
 * POST /api/admin/cycles/:id/annotate - Add an annotation to a cycle instance.
 * Body: { cycle_record_id: string, phase?: CyclePhase | null, content: string }
 *
 * Note: The :id param is the cycle_record_id for consistency with the URL structure.
 * The body's cycle_record_id must match the URL param.
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
    const parsed = adminAnnotationSchema.safeParse(input);
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
        { code: 'VALIDATION_ERROR', message: 'Invalid annotation data', fields: fieldErrors },
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

    // Create annotation
    const { data: annotation, error: insertError } = await supabase
      .from('admin_annotation')
      .insert({
        admin_user_id: contextResult.data.userId,
        cycle_record_id: cycleRecordId,
        phase: parsed.data.phase ?? null,
        content: parsed.data.content,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { code: 'INSERT_FAILED', message: 'Failed to create annotation' },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: 'Annotation created successfully', data: annotation },
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
 * PUT /api/admin/cycles/:id/annotate - Update an existing annotation.
 * Body: { annotation_id: string, content: string }
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
    const annotationId = body.annotation_id;

    if (!annotationId) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: 'annotation_id is required' },
        { status: 400 },
      );
    }

    // Validate content
    const parsed = updateAnnotationSchema.safeParse({ content: body.content });
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
        { code: 'VALIDATION_ERROR', message: 'Invalid annotation data', fields: fieldErrors },
        { status: 400 },
      );
    }

    // Verify annotation exists and belongs to this cycle record
    const { data: existing, error: fetchError } = await supabase
      .from('admin_annotation')
      .select('id')
      .eq('id', annotationId)
      .eq('cycle_record_id', cycleRecordId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { code: 'ANNOTATION_NOT_FOUND', message: 'Annotation not found for this cycle record' },
        { status: 404 },
      );
    }

    // Update annotation
    const { data: updated, error: updateError } = await supabase
      .from('admin_annotation')
      .update({
        content: parsed.data.content,
        updated_at: new Date().toISOString(),
      })
      .eq('id', annotationId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { code: 'UPDATE_FAILED', message: 'Failed to update annotation' },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: 'Annotation updated successfully', data: updated },
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
 * DELETE /api/admin/cycles/:id/annotate - Delete an annotation.
 * Body: { annotation_id: string }
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
    const annotationId = body.annotation_id;

    if (!annotationId) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: 'annotation_id is required' },
        { status: 400 },
      );
    }

    // Verify annotation exists and belongs to this cycle record
    const { data: existing, error: fetchError } = await supabase
      .from('admin_annotation')
      .select('id')
      .eq('id', annotationId)
      .eq('cycle_record_id', cycleRecordId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { code: 'ANNOTATION_NOT_FOUND', message: 'Annotation not found for this cycle record' },
        { status: 404 },
      );
    }

    // Delete annotation
    const { error: deleteError } = await supabase
      .from('admin_annotation')
      .delete()
      .eq('id', annotationId);

    if (deleteError) {
      return NextResponse.json(
        { code: 'DELETE_FAILED', message: 'Failed to delete annotation' },
        { status: 500 },
      );
    }

    return NextResponse.json({ message: 'Annotation deleted successfully' }, { status: 200 });
  } catch {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}
