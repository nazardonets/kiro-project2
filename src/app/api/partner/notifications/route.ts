import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole } from '@/lib/types';
import { updateNotificationPreferencesSchema } from '@/lib/validation';
import { AuthService } from '@/services/auth-service';

/**
 * GET /api/partner/notifications
 *
 * Retrieves the Partner_User's current notification preferences.
 * Only accessible by Partner_User.
 *
 * Validates: Requirements 17.5, 17.10
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
          message: 'You must be logged in to view notification preferences.',
        },
        { status: 401 },
      );
    }

    if (contextResult.data.role !== UserRole.PARTNER) {
      return NextResponse.json(
        {
          code: 'FORBIDDEN',
          message: 'Only Partner_Users can view notification preferences.',
        },
        { status: 403 },
      );
    }

    const partnerId = contextResult.data.userId;

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('partner_user_id', partnerId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) {
      // Return defaults when no preferences exist yet
      return NextResponse.json(
        {
          preferences: {
            frequency: 'daily',
            delivery_time: 'morning',
            reminders_enabled: false,
            reminder_time: '09:00',
            timezone: 'UTC',
          },
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        preferences: data,
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

/**
 * PUT /api/partner/notifications
 *
 * Updates the Partner_User's notification preferences (frequency, delivery time, timezone).
 * Only accessible by Partner_User.
 *
 * Validates: Requirements 17.5, 18.2, 18.3
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
          message: 'You must be logged in to update notification preferences.',
        },
        { status: 401 },
      );
    }

    if (contextResult.data.role !== UserRole.PARTNER) {
      return NextResponse.json(
        {
          code: 'FORBIDDEN',
          message: 'Only Partner_Users can update notification preferences.',
        },
        { status: 403 },
      );
    }

    const partnerId = contextResult.data.userId;

    const body = await request.json();

    // Validate input with Zod
    const parsed = updateNotificationPreferencesSchema.safeParse(body);
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

    const updates = parsed.data;

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
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('partner_user_id', partnerId)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new preferences with defaults for unspecified fields
      const { data, error } = await supabase
        .from('notification_preferences')
        .insert({
          partner_user_id: partnerId,
          frequency: updates.frequency ?? 'daily',
          delivery_time: updates.delivery_time ?? 'morning',
          reminders_enabled: updates.reminders_enabled ?? false,
          reminder_time: updates.reminder_time ?? '09:00',
          timezone: updates.timezone ?? 'UTC',
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return NextResponse.json(
      {
        message: 'Notification preferences updated successfully.',
        preferences: result,
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
