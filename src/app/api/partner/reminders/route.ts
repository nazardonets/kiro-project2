import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole } from '@/lib/types';
import { toggleRemindersSchema } from '@/lib/validation';
import { AuthService } from '@/services/auth-service';

/**
 * PUT /api/partner/reminders
 *
 * Toggles and configures partner reminders (enable/disable, set reminder time).
 * Reminders are disabled by default until the Partner_User explicitly enables them.
 *
 * Only accessible by Partner_User.
 *
 * Validates: Requirements 18.2, 18.3
 */
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
          message: 'You must be logged in to configure reminders.',
        },
        { status: 401 },
      );
    }

    if (contextResult.data.role !== UserRole.PARTNER) {
      return NextResponse.json(
        {
          code: 'FORBIDDEN',
          message: 'Only Partner_Users can configure reminders.',
        },
        { status: 403 },
      );
    }

    const partnerId = contextResult.data.userId;

    const body = await request.json();

    // Validate input with Zod
    const parsed = toggleRemindersSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, { message: string; constraint: string }> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.join('.') || 'unknown';
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

    const { reminders_enabled, reminder_time } = parsed.data;

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      reminders_enabled,
      updated_at: new Date().toISOString(),
    };

    // Only update reminder_time if provided
    if (reminder_time !== undefined) {
      updatePayload.reminder_time = reminder_time;
    }

    // Upsert notification preferences
    const { data: existing } = await supabase
      .from('notification_preferences')
      .select('id')
      .eq('partner_user_id', partnerId)
      .single();

    let result;
    if (existing) {
      // Update existing preferences
      const { data, error } = await supabase
        .from('notification_preferences')
        .update(updatePayload)
        .eq('partner_user_id', partnerId)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new preferences with defaults
      const { data, error } = await supabase
        .from('notification_preferences')
        .insert({
          partner_user_id: partnerId,
          frequency: 'daily',
          delivery_time: 'morning',
          reminders_enabled,
          reminder_time: reminder_time ?? '09:00',
          timezone: 'UTC',
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return NextResponse.json(
      {
        message: reminders_enabled
          ? 'Reminders enabled successfully.'
          : 'Reminders disabled successfully.',
        preferences: {
          reminders_enabled: result.reminders_enabled,
          reminder_time: result.reminder_time,
        },
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
