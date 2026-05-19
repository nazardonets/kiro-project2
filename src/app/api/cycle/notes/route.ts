import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole } from '@/lib/types';
import { personalNoteSchema } from '@/lib/validation';
import { AuthService } from '@/services/auth-service';

/**
 * GET /api/cycle/notes
 *
 * Retrieve all personal notes for the Primary_User.
 *
 * Validates: Requirements 9.4, 9.5
 */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    // Verify authentication and role
    const authService = new AuthService(supabase);
    const contextResult = await authService.getUserContext();

    if (!contextResult.success || !contextResult.data) {
      return NextResponse.json(
        {
          code: 'UNAUTHENTICATED',
          message: 'You must be logged in to view personal notes.',
        },
        { status: 401 },
      );
    }

    if (contextResult.data.role !== UserRole.PRIMARY) {
      return NextResponse.json(
        {
          code: 'FORBIDDEN',
          message: 'Only Primary_Users can access personal notes.',
        },
        { status: 403 },
      );
    }

    const userId = contextResult.data.userId;

    const { data: notes, error } = await supabase
      .from('personal_note')
      .select('*')
      .eq('primary_user_id', userId);

    if (error) {
      return NextResponse.json(
        {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve personal notes.',
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        notes: notes ?? [],
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

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient();

    // Verify authentication and role
    const authService = new AuthService(supabase);
    const contextResult = await authService.getUserContext();

    if (!contextResult.success || !contextResult.data) {
      return NextResponse.json(
        {
          code: 'UNAUTHENTICATED',
          message: 'You must be logged in to add notes.',
        },
        { status: 401 },
      );
    }

    if (contextResult.data.role !== UserRole.PRIMARY) {
      return NextResponse.json(
        {
          code: 'FORBIDDEN',
          message: 'Only Primary_Users can add personal notes.',
        },
        { status: 403 },
      );
    }

    const userId = contextResult.data.userId;
    const body = await request.json();

    // Validate input with Zod
    const parsed = personalNoteSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, { message: string; constraint: string }> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.join('.') || 'content';
        fieldErrors[field] = {
          message: issue.message,
          constraint: issue.code,
        };
      }

      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          fields: fieldErrors,
        },
        { status: 400 },
      );
    }

    const { phase, content } = parsed.data;

    // Check if a note already exists for this phase
    const { data: existing } = await supabase
      .from('personal_note')
      .select('id')
      .eq('primary_user_id', userId)
      .eq('phase', phase)
      .single();

    if (existing) {
      // Note already exists for this phase - use PUT to update
      return NextResponse.json(
        {
          code: 'CONFLICT',
          message: `A note already exists for the ${phase} phase. Use PUT to update it.`,
        },
        { status: 409 },
      );
    }

    // Create new note
    const { data: note, error } = await supabase
      .from('personal_note')
      .insert({
        primary_user_id: userId,
        phase,
        content,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        {
          code: 'INTERNAL_ERROR',
          message: 'Failed to save personal note.',
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        message: 'Personal note saved successfully',
        note,
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

export async function PUT(request: Request) {
  try {
    const supabase = createServerSupabaseClient();

    // Verify authentication and role
    const authService = new AuthService(supabase);
    const contextResult = await authService.getUserContext();

    if (!contextResult.success || !contextResult.data) {
      return NextResponse.json(
        {
          code: 'UNAUTHENTICATED',
          message: 'You must be logged in to update notes.',
        },
        { status: 401 },
      );
    }

    if (contextResult.data.role !== UserRole.PRIMARY) {
      return NextResponse.json(
        {
          code: 'FORBIDDEN',
          message: 'Only Primary_Users can update personal notes.',
        },
        { status: 403 },
      );
    }

    const userId = contextResult.data.userId;
    const body = await request.json();

    // Validate input with Zod
    const parsed = personalNoteSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, { message: string; constraint: string }> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.join('.') || 'content';
        fieldErrors[field] = {
          message: issue.message,
          constraint: issue.code,
        };
      }

      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          fields: fieldErrors,
        },
        { status: 400 },
      );
    }

    const { phase, content } = parsed.data;

    // Upsert: update if exists, create if not
    const { data: existing } = await supabase
      .from('personal_note')
      .select('id')
      .eq('primary_user_id', userId)
      .eq('phase', phase)
      .single();

    let note;
    if (existing) {
      const { data, error } = await supabase
        .from('personal_note')
        .update({
          content,
          updated_at: new Date().toISOString(),
        })
        .eq('primary_user_id', userId)
        .eq('phase', phase)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          {
            code: 'INTERNAL_ERROR',
            message: 'Failed to update personal note.',
          },
          { status: 500 },
        );
      }
      note = data;
    } else {
      const { data, error } = await supabase
        .from('personal_note')
        .insert({
          primary_user_id: userId,
          phase,
          content,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          {
            code: 'INTERNAL_ERROR',
            message: 'Failed to save personal note.',
          },
          { status: 500 },
        );
      }
      note = data;
    }

    return NextResponse.json(
      {
        message: 'Personal note updated successfully',
        note,
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
