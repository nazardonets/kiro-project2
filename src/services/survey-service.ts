import { SurveyResponse } from '@/lib/types';
import { SurveyResponseInput } from '@/lib/validation/survey.schemas';

/**
 * Typed interface for database access (dependency injection).
 * Allows the SurveyService to remain framework-agnostic.
 */
export interface SurveyRepository {
  /** Get all survey responses for a primary user */
  getSurveyResponses(primaryUserId: string): Promise<SurveyResponse[]>;

  /** Get a single survey response by user and question number */
  getSurveyResponse(primaryUserId: string, questionNumber: number): Promise<SurveyResponse | null>;

  /** Create a new survey response */
  createSurveyResponse(primaryUserId: string, input: SurveyResponseInput): Promise<SurveyResponse>;

  /** Update an existing survey response */
  updateSurveyResponse(
    primaryUserId: string,
    questionNumber: number,
    input: Omit<SurveyResponseInput, 'question_number'>,
  ): Promise<SurveyResponse>;

  /** Create or update multiple survey responses in a batch */
  upsertSurveyResponses(
    primaryUserId: string,
    inputs: SurveyResponseInput[],
  ): Promise<SurveyResponse[]>;
}

/**
 * Interface for the recalibration trigger.
 * When survey responses are updated, recalibration must occur within 60 seconds.
 */
export interface RecalibrationTrigger {
  /** Trigger recalibration of partner-facing guidance based on updated survey responses */
  triggerRecalibration(primaryUserId: string): Promise<void>;
}

/**
 * Result type for SurveyService operations.
 */
export interface SurveyServiceResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/** Total number of survey questions */
export const TOTAL_SURVEY_QUESTIONS = 6;

/**
 * SurveyService manages the onboarding survey storage and response management.
 *
 * Responsibilities:
 * - Store responses for all 6 questions
 * - Support updating responses at any time
 * - Trigger recalibration within 60 seconds of update
 *
 * Framework-agnostic: database access is injected via the SurveyRepository interface.
 *
 * Validates: Requirements 20.1, 20.9, 20.17, 20.18
 */
export class SurveyService {
  constructor(
    private readonly repository: SurveyRepository,
    private readonly recalibrationTrigger: RecalibrationTrigger,
  ) {}

  /**
   * Submit all 6 survey responses at once (initial onboarding).
   * Stores all responses and triggers initial calibration.
   *
   * @param primaryUserId - The primary user's ID
   * @param responses - Array of 6 survey response inputs
   * @returns The stored survey responses
   *
   * Validates: Requirements 20.1, 20.9
   */
  async submitSurvey(
    primaryUserId: string,
    responses: SurveyResponseInput[],
  ): Promise<SurveyServiceResult<SurveyResponse[]>> {
    // Validate that exactly 6 responses are provided
    if (responses.length !== TOTAL_SURVEY_QUESTIONS) {
      return {
        success: false,
        error: {
          code: 'INVALID_RESPONSE_COUNT',
          message: `Expected ${TOTAL_SURVEY_QUESTIONS} responses, received ${responses.length}`,
        },
      };
    }

    // Validate all question numbers are present (1-6)
    const questionNumbers = new Set(responses.map((r) => r.question_number));
    for (let q = 1; q <= TOTAL_SURVEY_QUESTIONS; q++) {
      if (!questionNumbers.has(q)) {
        return {
          success: false,
          error: {
            code: 'MISSING_QUESTION',
            message: `Missing response for question ${q}`,
          },
        };
      }
    }

    // Check for duplicate question numbers
    if (questionNumbers.size !== responses.length) {
      return {
        success: false,
        error: {
          code: 'DUPLICATE_QUESTION',
          message: 'Duplicate question numbers are not allowed',
        },
      };
    }

    // Check if survey has already been submitted
    const existing = await this.repository.getSurveyResponses(primaryUserId);
    if (existing.length > 0) {
      return {
        success: false,
        error: {
          code: 'SURVEY_ALREADY_SUBMITTED',
          message:
            'Survey has already been submitted. Use updateResponse to modify individual answers.',
        },
      };
    }

    // Store all responses
    const stored = await this.repository.upsertSurveyResponses(primaryUserId, responses);

    // Trigger initial calibration
    await this.recalibrationTrigger.triggerRecalibration(primaryUserId);

    return {
      success: true,
      data: stored,
    };
  }

  /**
   * Get all survey responses for a primary user.
   *
   * @param primaryUserId - The primary user's ID
   * @returns All stored survey responses
   */
  async getResponses(primaryUserId: string): Promise<SurveyServiceResult<SurveyResponse[]>> {
    const responses = await this.repository.getSurveyResponses(primaryUserId);

    return {
      success: true,
      data: responses,
    };
  }

  /**
   * Get a single survey response by question number.
   *
   * @param primaryUserId - The primary user's ID
   * @param questionNumber - The question number (1-6)
   * @returns The survey response or error if not found
   */
  async getResponse(
    primaryUserId: string,
    questionNumber: number,
  ): Promise<SurveyServiceResult<SurveyResponse>> {
    if (questionNumber < 1 || questionNumber > TOTAL_SURVEY_QUESTIONS) {
      return {
        success: false,
        error: {
          code: 'INVALID_QUESTION_NUMBER',
          message: `Question number must be between 1 and ${TOTAL_SURVEY_QUESTIONS}`,
        },
      };
    }

    const response = await this.repository.getSurveyResponse(primaryUserId, questionNumber);

    if (!response) {
      return {
        success: false,
        error: {
          code: 'RESPONSE_NOT_FOUND',
          message: `No response found for question ${questionNumber}`,
        },
      };
    }

    return {
      success: true,
      data: response,
    };
  }

  /**
   * Update a single survey response at any time.
   * Triggers recalibration within 60 seconds of the update.
   *
   * @param primaryUserId - The primary user's ID
   * @param input - The updated survey response input
   * @returns The updated survey response
   *
   * Validates: Requirements 20.17, 20.18
   */
  async updateResponse(
    primaryUserId: string,
    input: SurveyResponseInput,
  ): Promise<SurveyServiceResult<SurveyResponse>> {
    const { question_number } = input;

    // Verify the response exists (survey must have been submitted first)
    const existing = await this.repository.getSurveyResponse(primaryUserId, question_number);
    if (!existing) {
      return {
        success: false,
        error: {
          code: 'RESPONSE_NOT_FOUND',
          message: `No existing response found for question ${question_number}. Submit the survey first.`,
        },
      };
    }

    // Update the response
    const updated = await this.repository.updateSurveyResponse(primaryUserId, question_number, {
      selected_options: input.selected_options,
      free_text: input.free_text ?? null,
    });

    // Trigger recalibration within 60 seconds (Requirement 20.18)
    await this.recalibrationTrigger.triggerRecalibration(primaryUserId);

    return {
      success: true,
      data: updated,
    };
  }

  /**
   * Check if the survey has been completed (all 6 questions answered).
   *
   * @param primaryUserId - The primary user's ID
   * @returns Whether the survey is complete
   */
  async isSurveyComplete(primaryUserId: string): Promise<SurveyServiceResult<boolean>> {
    const responses = await this.repository.getSurveyResponses(primaryUserId);

    return {
      success: true,
      data: responses.length === TOTAL_SURVEY_QUESTIONS,
    };
  }
}
