import { describe, it, expect, beforeEach } from 'vitest';

import { SurveyResponse } from '@/lib/types';
import { SurveyResponseInput } from '@/lib/validation/survey.schemas';

import { SurveyService, SurveyRepository, RecalibrationTrigger } from './survey-service';

/**
 * In-memory implementation of SurveyRepository for testing.
 */
class InMemorySurveyRepository implements SurveyRepository {
  private responses: Map<string, SurveyResponse[]> = new Map();

  async getSurveyResponses(primaryUserId: string): Promise<SurveyResponse[]> {
    return this.responses.get(primaryUserId) ?? [];
  }

  async getSurveyResponse(
    primaryUserId: string,
    questionNumber: number,
  ): Promise<SurveyResponse | null> {
    const responses = this.responses.get(primaryUserId) ?? [];
    return responses.find((r) => r.question_number === questionNumber) ?? null;
  }

  async createSurveyResponse(
    primaryUserId: string,
    input: SurveyResponseInput,
  ): Promise<SurveyResponse> {
    const now = new Date().toISOString();
    const response: SurveyResponse = {
      id: crypto.randomUUID(),
      primary_user_id: primaryUserId,
      question_number: input.question_number,
      selected_options: input.selected_options,
      free_text: input.free_text ?? null,
      created_at: now,
      updated_at: now,
    };

    const existing = this.responses.get(primaryUserId) ?? [];
    existing.push(response);
    this.responses.set(primaryUserId, existing);

    return response;
  }

  async updateSurveyResponse(
    primaryUserId: string,
    questionNumber: number,
    input: Omit<SurveyResponseInput, 'question_number'>,
  ): Promise<SurveyResponse> {
    const responses = this.responses.get(primaryUserId) ?? [];
    const index = responses.findIndex((r) => r.question_number === questionNumber);

    if (index === -1) {
      throw new Error(`Response for question ${questionNumber} not found`);
    }

    const updated: SurveyResponse = {
      ...responses[index],
      selected_options: input.selected_options,
      free_text: input.free_text ?? null,
      updated_at: new Date().toISOString(),
    };

    responses[index] = updated;
    this.responses.set(primaryUserId, responses);

    return updated;
  }

  async upsertSurveyResponses(
    primaryUserId: string,
    inputs: SurveyResponseInput[],
  ): Promise<SurveyResponse[]> {
    const results: SurveyResponse[] = [];

    for (const input of inputs) {
      const existing = await this.getSurveyResponse(primaryUserId, input.question_number);
      if (existing) {
        const updated = await this.updateSurveyResponse(primaryUserId, input.question_number, {
          selected_options: input.selected_options,
          free_text: input.free_text,
        });
        results.push(updated);
      } else {
        const created = await this.createSurveyResponse(primaryUserId, input);
        results.push(created);
      }
    }

    return results;
  }
}

/**
 * Mock recalibration trigger that tracks calls.
 */
class MockRecalibrationTrigger implements RecalibrationTrigger {
  public calls: string[] = [];
  public lastCalledAt: number | null = null;

  async triggerRecalibration(primaryUserId: string): Promise<void> {
    this.calls.push(primaryUserId);
    this.lastCalledAt = Date.now();
  }
}

/**
 * Helper to create a valid set of 6 survey responses.
 */
function createValidSurveyResponses(): SurveyResponseInput[] {
  return [
    { question_number: 1, selected_options: ['Very predictable'], free_text: null },
    { question_number: 2, selected_options: ['Moderately'], free_text: null },
    {
      question_number: 3,
      selected_options: ['Mostly consistent across all phases'],
      free_text: null,
    },
    {
      question_number: 4,
      selected_options: ['Stress / workload / fatigue', 'Feeling unheard or not understood'],
      free_text: null,
    },
    {
      question_number: 5,
      selected_options: ['Emotional reassurance and empathy'],
      free_text: null,
    },
    {
      question_number: 6,
      selected_options: ["Check in gently, but don't push for deep conversation"],
      free_text: null,
    },
  ];
}

describe('SurveyService', () => {
  let repository: InMemorySurveyRepository;
  let recalibrationTrigger: MockRecalibrationTrigger;
  let service: SurveyService;
  const primaryUserId = 'user-primary-1';

  beforeEach(() => {
    repository = new InMemorySurveyRepository();
    recalibrationTrigger = new MockRecalibrationTrigger();
    service = new SurveyService(repository, recalibrationTrigger);
  });

  describe('submitSurvey', () => {
    it('should store all 6 survey responses', async () => {
      const responses = createValidSurveyResponses();
      const result = await service.submitSurvey(primaryUserId, responses);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data).toHaveLength(6);
      expect(result.data?.[0].primary_user_id).toBe(primaryUserId);
    });

    it('should store correct selected options for each question', async () => {
      const responses = createValidSurveyResponses();
      const result = await service.submitSurvey(primaryUserId, responses);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      const stored = result.data ?? [];

      // Q1: single select
      const q1 = stored.find((r) => r.question_number === 1);
      expect(q1?.selected_options).toEqual(['Very predictable']);

      // Q4: multi select
      const q4 = stored.find((r) => r.question_number === 4);
      expect(q4?.selected_options).toEqual([
        'Stress / workload / fatigue',
        'Feeling unheard or not understood',
      ]);
    });

    it('should trigger recalibration after submission', async () => {
      const responses = createValidSurveyResponses();
      await service.submitSurvey(primaryUserId, responses);

      expect(recalibrationTrigger.calls).toContain(primaryUserId);
      expect(recalibrationTrigger.calls).toHaveLength(1);
    });

    it('should reject submission with fewer than 6 responses', async () => {
      const responses = createValidSurveyResponses().slice(0, 5);
      const result = await service.submitSurvey(primaryUserId, responses);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_RESPONSE_COUNT');
    });

    it('should reject submission with more than 6 responses', async () => {
      const responses = [
        ...createValidSurveyResponses(),
        { question_number: 1, selected_options: ['Duplicate'], free_text: null },
      ];
      const result = await service.submitSurvey(primaryUserId, responses);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_RESPONSE_COUNT');
    });

    it('should reject submission with missing question numbers', async () => {
      const responses = createValidSurveyResponses();
      responses[5] = { question_number: 1, selected_options: ['Duplicate'], free_text: null };
      const result = await service.submitSurvey(primaryUserId, responses);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_QUESTION');
    });

    it('should reject submission with duplicate question numbers', async () => {
      const responses = createValidSurveyResponses();
      // Replace Q6 with a duplicate of Q1 (same question_number)
      responses[5] = { question_number: 1, selected_options: ['Another option'], free_text: null };
      const result = await service.submitSurvey(primaryUserId, responses);

      expect(result.success).toBe(false);
      // Could be MISSING_QUESTION or DUPLICATE_QUESTION depending on order of checks
      expect(result.error?.code).toMatch(/MISSING_QUESTION|DUPLICATE_QUESTION/);
    });

    it('should reject re-submission if survey already submitted', async () => {
      const responses = createValidSurveyResponses();
      await service.submitSurvey(primaryUserId, responses);

      const result = await service.submitSurvey(primaryUserId, responses);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SURVEY_ALREADY_SUBMITTED');
    });

    it('should store free_text for question 4 when provided', async () => {
      const responses = createValidSurveyResponses();
      responses[3] = {
        question_number: 4,
        selected_options: ['Other'],
        free_text: 'Custom trigger description',
      };

      const result = await service.submitSurvey(primaryUserId, responses);
      expect(result.success).toBe(true);

      const q4 = (result.data ?? []).find((r) => r.question_number === 4);
      expect(q4?.free_text).toBe('Custom trigger description');
    });
  });

  describe('getResponses', () => {
    it('should return all stored responses', async () => {
      const responses = createValidSurveyResponses();
      await service.submitSurvey(primaryUserId, responses);

      const result = await service.getResponses(primaryUserId);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(6);
    });

    it('should return empty array when no responses exist', async () => {
      const result = await service.getResponses('non-existent-user');
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('getResponse', () => {
    beforeEach(async () => {
      await service.submitSurvey(primaryUserId, createValidSurveyResponses());
    });

    it('should return a specific response by question number', async () => {
      const result = await service.getResponse(primaryUserId, 3);
      expect(result.success).toBe(true);
      expect(result.data?.question_number).toBe(3);
      expect(result.data?.selected_options).toEqual(['Mostly consistent across all phases']);
    });

    it('should return error for invalid question number (0)', async () => {
      const result = await service.getResponse(primaryUserId, 0);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_QUESTION_NUMBER');
    });

    it('should return error for invalid question number (7)', async () => {
      const result = await service.getResponse(primaryUserId, 7);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_QUESTION_NUMBER');
    });

    it('should return error when response does not exist', async () => {
      const result = await service.getResponse('other-user', 1);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RESPONSE_NOT_FOUND');
    });
  });

  describe('updateResponse', () => {
    beforeEach(async () => {
      await service.submitSurvey(primaryUserId, createValidSurveyResponses());
      // Reset recalibration calls from initial submission
      recalibrationTrigger.calls = [];
    });

    it('should update selected options for a question', async () => {
      const result = await service.updateResponse(primaryUserId, {
        question_number: 1,
        selected_options: ['Unpredictable'],
        free_text: null,
      });

      expect(result.success).toBe(true);
      expect(result.data?.selected_options).toEqual(['Unpredictable']);
      expect(result.data?.question_number).toBe(1);
    });

    it('should trigger recalibration after update', async () => {
      await service.updateResponse(primaryUserId, {
        question_number: 2,
        selected_options: ['Very strongly'],
        free_text: null,
      });

      expect(recalibrationTrigger.calls).toContain(primaryUserId);
      expect(recalibrationTrigger.calls).toHaveLength(1);
    });

    it('should trigger recalibration on every update', async () => {
      await service.updateResponse(primaryUserId, {
        question_number: 1,
        selected_options: ['Unpredictable'],
        free_text: null,
      });

      await service.updateResponse(primaryUserId, {
        question_number: 5,
        selected_options: ['Space and minimal interaction'],
        free_text: null,
      });

      expect(recalibrationTrigger.calls).toHaveLength(2);
    });

    it('should update free_text for question 4', async () => {
      const result = await service.updateResponse(primaryUserId, {
        question_number: 4,
        selected_options: ['Other'],
        free_text: 'Updated trigger info',
      });

      expect(result.success).toBe(true);
      expect(result.data?.free_text).toBe('Updated trigger info');
    });

    it('should return error when response does not exist', async () => {
      const result = await service.updateResponse('non-existent-user', {
        question_number: 1,
        selected_options: ['Unpredictable'],
        free_text: null,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RESPONSE_NOT_FOUND');
    });

    it('should preserve other responses when updating one', async () => {
      await service.updateResponse(primaryUserId, {
        question_number: 1,
        selected_options: ['Unpredictable'],
        free_text: null,
      });

      // Verify other responses are unchanged
      const q2 = await service.getResponse(primaryUserId, 2);
      expect(q2.data?.selected_options).toEqual(['Moderately']);

      const q4 = await service.getResponse(primaryUserId, 4);
      expect(q4.data?.selected_options).toEqual([
        'Stress / workload / fatigue',
        'Feeling unheard or not understood',
      ]);
    });

    it('should update the updated_at timestamp', async () => {
      const before = await service.getResponse(primaryUserId, 1);
      const beforeTimestamp = before.data?.updated_at;

      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await service.updateResponse(primaryUserId, {
        question_number: 1,
        selected_options: ['Unpredictable'],
        free_text: null,
      });

      expect(result.data?.updated_at).not.toBe(beforeTimestamp);
    });
  });

  describe('isSurveyComplete', () => {
    it('should return true when all 6 questions are answered', async () => {
      await service.submitSurvey(primaryUserId, createValidSurveyResponses());

      const result = await service.isSurveyComplete(primaryUserId);
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it('should return false when no responses exist', async () => {
      const result = await service.isSurveyComplete(primaryUserId);
      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });
  });
});
