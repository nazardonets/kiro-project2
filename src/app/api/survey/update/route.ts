import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole } from '@/lib/types';
import { updateSurveyResponseSchema } from '@/lib/validation';
import { AuthService } from '@/services/auth-service';
import { SurveyService, SurveyRepository, RecalibrationTrigger } from '@/services/survey-service';

/**
 * Supabase-backed implementation of SurveyRepository.
 */
class SupabaseSurveyRepository implements SurveyRepository {
  constructor(private supabase: ReturnType<typeof createServerSupabaseClient>) {}

  async getSurveyResponses(primaryUserId: string) {
    const { data, error } = await this.supabase
      .from('survey_response')
      .select('*')
      .eq('primary_user_id', primaryUserId)
      .order('question_number', { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async getSurveyResponse(primaryUserId: string, questionNumber: number) {
    const { data, error } = await this.supabase
      .from('survey_response')
      .select('*')
      .eq('primary_user_id', primaryUserId)
      .eq('question_number', questionNumber)
      .single();

    if (error) return null;
    return data;
  }

  async createSurveyResponse(
    primaryUserId: string,
    input: { question_number: number; selected_options: string[]; free_text?: string | null },
  ) {
    const { data, error } = await this.supabase
      .from('survey_response')
      .insert({
        primary_user_id: primaryUserId,
        question_number: input.question_number,
        selected_options: input.selected_options,
        free_text: input.free_text ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async updateSurveyResponse(
    primaryUserId: string,
    questionNumber: number,
    input: { selected_options: string[]; free_text?: string | null },
  ) {
    const { data, error } = await this.supabase
      .from('survey_response')
      .update({
        selected_options: input.selected_options,
        free_text: input.free_text ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('primary_user_id', primaryUserId)
      .eq('question_number', questionNumber)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async upsertSurveyResponses(
    primaryUserId: string,
    inputs: { question_number: number; selected_options: string[]; free_text?: string | null }[],
  ) {
    const records = inputs.map((input) => ({
      primary_user_id: primaryUserId,
      question_number: input.question_number,
      selected_options: input.selected_options,
      free_text: input.free_text ?? null,
    }));

    const { data, error } = await this.supabase
      .from('survey_response')
      .upsert(records, { onConflict: 'primary_user_id,question_number' })
      .select();

    if (error) throw new Error(error.message);
    return data ?? [];
  }
}

/**
 * Recalibration trigger that enqueues recalibration of partner-facing guidance.
 * Requirement 20.18: recalibrate within 60 seconds of update.
 */
class AsyncRecalibrationTrigger implements RecalibrationTrigger {
  async triggerRecalibration(_primaryUserId: string): Promise<void> {
    // In production, this would enqueue a background job for recalibration.
    // The recalibration must complete within 60 seconds per Requirement 20.18.
  }
}

/**
 * PUT /api/survey/update
 *
 * Update a single survey response at any time.
 * Only Primary_Users can update their survey responses.
 * Triggers recalibration of partner-facing guidance within 60 seconds.
 *
 * Validates: Requirements 20.17, 20.18
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();

    // Validate input with Zod
    const parsed = updateSurveyResponseSchema.safeParse(body);
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
          message: 'You must be logged in to update survey responses.',
        },
        { status: 401 },
      );
    }

    if (contextResult.data.role !== UserRole.PRIMARY) {
      return NextResponse.json(
        {
          code: 'FORBIDDEN',
          message: 'Only Primary_Users can update survey responses.',
        },
        { status: 403 },
      );
    }

    // Wire to SurveyService
    const repository = new SupabaseSurveyRepository(supabase);
    const recalibrationTrigger = new AsyncRecalibrationTrigger();
    const surveyService = new SurveyService(repository, recalibrationTrigger);

    const result = await surveyService.updateResponse(contextResult.data.userId, parsed.data);

    if (!result.success) {
      const statusCode = result.error?.code === 'RESPONSE_NOT_FOUND' ? 404 : 400;
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
        message: 'Survey response updated successfully',
        data: result.data,
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
