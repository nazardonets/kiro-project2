import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CyclePhase, DateRequestStatus, PartnerLinkStatus, UserRole } from '@/lib/types';
import { dateRequestSchema } from '@/lib/validation';
import { AuthService } from '@/services/auth-service';
import {
  DateRequestService,
  DateRequestRepository,
  DateRequestSubmission,
} from '@/services/date-request-service';
import type { EmailProvider } from '@/services/notification-service';

/**
 * Supabase-backed implementation of DateRequestRepository.
 */
class SupabaseDateRequestRepository implements DateRequestRepository {
  constructor(private supabase: ReturnType<typeof createServerSupabaseClient>) {}

  async getActivePartnerLink(primaryUserId: string) {
    const { data, error } = await this.supabase
      .from('partner_link')
      .select('*')
      .eq('primary_user_id', primaryUserId)
      .eq('status', PartnerLinkStatus.ACTIVE)
      .single();

    if (error) return null;
    return data;
  }

  async getSharingPreferences(primaryUserId: string) {
    const { data, error } = await this.supabase
      .from('sharing_preferences')
      .select('*')
      .eq('primary_user_id', primaryUserId)
      .single();

    if (error) return null;
    return data;
  }

  async getPartnerEmail(partnerUserId: string) {
    const { data, error } = await this.supabase.auth.admin.getUserById(partnerUserId);

    if (error || !data?.user?.email) {
      // Fallback: try to get from user metadata or a users table
      const { data: userData, error: userError } = await this.supabase
        .from('user')
        .select('email')
        .eq('id', partnerUserId)
        .single();

      if (userError || !userData) return null;
      return userData.email;
    }

    return data.user.email;
  }

  async getCurrentCyclePhase(primaryUserId: string): Promise<CyclePhase | null> {
    // Get the most recent cycle record
    const { data: cycleRecord, error } = await this.supabase
      .from('cycle_record')
      .select('*')
      .eq('primary_user_id', primaryUserId)
      .order('start_date', { ascending: false })
      .limit(1)
      .single();

    if (error || !cycleRecord) return null;

    // Calculate days elapsed since cycle start
    const startDate = new Date(cycleRecord.start_date);
    const today = new Date();
    const daysElapsed =
      Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Determine phase based on standard 28-day cycle boundaries
    if (daysElapsed >= 1 && daysElapsed <= 5) return CyclePhase.MENSTRUAL;
    if (daysElapsed >= 6 && daysElapsed <= 13) return CyclePhase.FOLLICULAR;
    if (daysElapsed === 14) return CyclePhase.OVULATION;
    if (daysElapsed >= 15 && daysElapsed <= 21) return CyclePhase.EARLY_LUTEAL;
    return CyclePhase.LATE_LUTEAL;
  }

  async createDateRequest(request: Omit<import('@/lib/types').DateRequest, 'id' | 'created_at'>) {
    const { data, error } = await this.supabase
      .from('date_request')
      .insert({
        primary_user_id: request.primary_user_id,
        location: request.location,
        mood: request.mood,
        preferred_date: request.preferred_date,
        window_start: request.window_start,
        window_end: request.window_end,
        personal_notes: request.personal_notes,
        status: request.status,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async updateDateRequestStatus(requestId: string, status: DateRequestStatus) {
    const { error } = await this.supabase
      .from('date_request')
      .update({ status })
      .eq('id', requestId);

    if (error) throw new Error(error.message);
  }

  async createNotificationLog(log: Omit<import('@/lib/types').NotificationLog, 'id'>) {
    const { data, error } = await this.supabase
      .from('notification_log')
      .insert({
        partner_user_id: log.partner_user_id,
        type: log.type,
        status: log.status,
        retry_count: log.retry_count,
        sent_at: log.sent_at,
        next_retry_at: log.next_retry_at,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}

/**
 * Email provider implementation using Resend.
 * In production, this would use the Resend SDK.
 */
class ResendEmailProvider implements EmailProvider {
  async sendEmail(options: { to: string; subject: string; html: string }) {
    try {
      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) {
        return { success: false, error: 'Resend API key not configured' };
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? 'noreply@knowyourwomancycle.com',
          to: options.to,
          subject: options.subject,
          html: options.html,
        }),
      });

      if (!response.ok) {
        return { success: false, error: `Email delivery failed: ${response.statusText}` };
      }

      return { success: true };
    } catch {
      return { success: false, error: 'Email delivery failed' };
    }
  }
}

/**
 * POST /api/date-request
 *
 * Submit a date request that sends a structured email notification to the partner.
 * Only Primary_Users can submit date requests.
 *
 * Optional fields:
 * - location: max 200 characters
 * - mood: max 200 characters
 * - preferred_date: specific date
 * - window_start / window_end: flexible date window
 * - personal_notes: max 500 characters
 *
 * Validates: Requirements 11.1, 11.6
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate input with Zod
    const parsed = dateRequestSchema.safeParse(body);
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
          fields: fieldErrors,
        },
        { status: 400 },
      );
    }

    // Authenticate and authorize
    const supabase = createServerSupabaseClient();
    const authService = new AuthService(supabase);
    const contextResult = await authService.getUserContext();

    if (!contextResult.success || !contextResult.data) {
      return NextResponse.json(
        {
          code: 'UNAUTHENTICATED',
          message: 'You must be logged in to submit a date request.',
        },
        { status: 401 },
      );
    }

    if (contextResult.data.role !== UserRole.PRIMARY) {
      return NextResponse.json(
        {
          code: 'FORBIDDEN',
          message: 'Only Primary_Users can submit date requests.',
        },
        { status: 403 },
      );
    }

    // Build submission from validated input
    const submission: DateRequestSubmission = {
      primaryUserId: contextResult.data.userId,
      location: parsed.data.location ?? null,
      mood: parsed.data.mood ?? null,
      preferredDate: parsed.data.preferred_date ?? null,
      windowStart: parsed.data.window_start ?? null,
      windowEnd: parsed.data.window_end ?? null,
      personalNotes: parsed.data.personal_notes ?? null,
    };

    // Wire to DateRequestService
    const repository = new SupabaseDateRequestRepository(supabase);
    const emailProvider = new ResendEmailProvider();
    const dateRequestService = new DateRequestService(repository, emailProvider);

    const result = await dateRequestService.submitDateRequest(submission);

    if (!result.success) {
      // Determine appropriate status code
      let statusCode = 400;
      if (result.error?.code === 'NO_PARTNER_LINKED' || result.error?.code === 'SHARING_REVOKED') {
        statusCode = 422;
      } else if (result.error?.code === 'EMAIL_DELIVERY_FAILED') {
        statusCode = 502;
      }

      return NextResponse.json(
        {
          code: result.error?.code,
          message: result.error?.message,
          retainedDetails: result.error?.retainedDetails,
        },
        { status: statusCode },
      );
    }

    return NextResponse.json(
      {
        message: 'Date request sent successfully',
        data: result.dateRequest,
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
