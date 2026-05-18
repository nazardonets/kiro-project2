import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { FREE_TEXT_MAX_LENGTH } from '@/lib/constants';

import { surveyResponseSchema, submitSurveySchema } from './survey.schemas';

describe('surveyResponseSchema', () => {
  describe('single-select questions (1, 2, 3, 5, 6)', () => {
    it('accepts exactly one selected option', () => {
      const result = surveyResponseSchema.safeParse({
        question_number: 1,
        selected_options: ['option_a'],
        free_text: null,
      });
      expect(result.success).toBe(true);
    });

    it('rejects zero selected options', () => {
      const result = surveyResponseSchema.safeParse({
        question_number: 2,
        selected_options: [],
        free_text: null,
      });
      expect(result.success).toBe(false);
    });

    it('rejects multiple selected options for single-select questions', () => {
      const result = surveyResponseSchema.safeParse({
        question_number: 3,
        selected_options: ['option_a', 'option_b'],
        free_text: null,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        expect(messages).toContain('Question 3 must have exactly one selected response');
      }
    });

    it('rejects free text for non-Q4 questions', () => {
      const result = surveyResponseSchema.safeParse({
        question_number: 1,
        selected_options: ['option_a'],
        free_text: 'some text',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        expect(messages).toContain('Free text is only allowed for Question 4');
      }
    });
  });

  describe('multi-select question (4)', () => {
    it('accepts one selected option', () => {
      const result = surveyResponseSchema.safeParse({
        question_number: 4,
        selected_options: ['option_a'],
        free_text: null,
      });
      expect(result.success).toBe(true);
    });

    it('accepts multiple selected options', () => {
      const result = surveyResponseSchema.safeParse({
        question_number: 4,
        selected_options: ['option_a', 'option_b', 'option_c'],
        free_text: null,
      });
      expect(result.success).toBe(true);
    });

    it('rejects zero selected options', () => {
      const result = surveyResponseSchema.safeParse({
        question_number: 4,
        selected_options: [],
        free_text: null,
      });
      expect(result.success).toBe(false);
    });

    it('accepts free text within max length', () => {
      const result = surveyResponseSchema.safeParse({
        question_number: 4,
        selected_options: ['other'],
        free_text: 'My custom answer',
      });
      expect(result.success).toBe(true);
    });

    it('rejects free text exceeding 200 characters', () => {
      const result = surveyResponseSchema.safeParse({
        question_number: 4,
        selected_options: ['other'],
        free_text: 'a'.repeat(201),
      });
      expect(result.success).toBe(false);
    });

    it('accepts null free text', () => {
      const result = surveyResponseSchema.safeParse({
        question_number: 4,
        selected_options: ['option_a'],
        free_text: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('question number validation', () => {
    it('rejects question number 0', () => {
      const result = surveyResponseSchema.safeParse({
        question_number: 0,
        selected_options: ['option_a'],
        free_text: null,
      });
      expect(result.success).toBe(false);
    });

    it('rejects question number 7', () => {
      const result = surveyResponseSchema.safeParse({
        question_number: 7,
        selected_options: ['option_a'],
        free_text: null,
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('submitSurveySchema', () => {
  const validSubmission = {
    responses: [
      { question_number: 1, selected_options: ['option_a'], free_text: null },
      { question_number: 2, selected_options: ['option_b'], free_text: null },
      { question_number: 3, selected_options: ['option_c'], free_text: null },
      {
        question_number: 4,
        selected_options: ['option_d', 'option_e'],
        free_text: null,
      },
      { question_number: 5, selected_options: ['option_f'], free_text: null },
      { question_number: 6, selected_options: ['option_g'], free_text: null },
    ],
  };

  it('accepts a valid complete submission', () => {
    const result = submitSurveySchema.safeParse(validSubmission);
    expect(result.success).toBe(true);
  });

  it('rejects submission with fewer than 6 responses', () => {
    const result = submitSurveySchema.safeParse({
      responses: validSubmission.responses.slice(0, 5),
    });
    expect(result.success).toBe(false);
  });

  it('rejects submission with more than 6 responses', () => {
    const result = submitSurveySchema.safeParse({
      responses: [
        ...validSubmission.responses,
        {
          question_number: 1,
          selected_options: ['option_x'],
          free_text: null,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects submission with duplicate question numbers', () => {
    const result = submitSurveySchema.safeParse({
      responses: [
        {
          question_number: 1,
          selected_options: ['option_a'],
          free_text: null,
        },
        {
          question_number: 1,
          selected_options: ['option_b'],
          free_text: null,
        },
        {
          question_number: 3,
          selected_options: ['option_c'],
          free_text: null,
        },
        {
          question_number: 4,
          selected_options: ['option_d'],
          free_text: null,
        },
        {
          question_number: 5,
          selected_options: ['option_f'],
          free_text: null,
        },
        {
          question_number: 6,
          selected_options: ['option_g'],
          free_text: null,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects submission with missing question number', () => {
    const result = submitSurveySchema.safeParse({
      responses: [
        {
          question_number: 1,
          selected_options: ['option_a'],
          free_text: null,
        },
        {
          question_number: 2,
          selected_options: ['option_b'],
          free_text: null,
        },
        {
          question_number: 3,
          selected_options: ['option_c'],
          free_text: null,
        },
        {
          question_number: 4,
          selected_options: ['option_d'],
          free_text: null,
        },
        {
          question_number: 5,
          selected_options: ['option_f'],
          free_text: null,
        },
        // Missing question 6, has duplicate 5 instead
        {
          question_number: 5,
          selected_options: ['option_g'],
          free_text: null,
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe('Survey validation properties', () => {
  /**
   * **Validates: Requirements 20.8**
   * Property: Questions 1, 2, 3, 5, 6 with exactly one option always pass validation
   */
  it('single-select questions with exactly one option always pass', () => {
    const singleSelectQuestions = [1, 2, 3, 5, 6];

    fc.assert(
      fc.property(
        fc.constantFrom(...singleSelectQuestions),
        fc.string({ minLength: 1, maxLength: 50 }),
        (questionNumber, option) => {
          const result = surveyResponseSchema.safeParse({
            question_number: questionNumber,
            selected_options: [option],
            free_text: null,
          });
          return result.success === true;
        },
      ),
    );
  });

  /**
   * **Validates: Requirements 20.8**
   * Property: Questions 1, 2, 3, 5, 6 with zero options always fail validation
   */
  it('single-select questions with zero options always fail', () => {
    const singleSelectQuestions = [1, 2, 3, 5, 6];

    fc.assert(
      fc.property(fc.constantFrom(...singleSelectQuestions), (questionNumber) => {
        const result = surveyResponseSchema.safeParse({
          question_number: questionNumber,
          selected_options: [],
          free_text: null,
        });
        return result.success === false;
      }),
    );
  });

  /**
   * **Validates: Requirements 20.8**
   * Property: Questions 1, 2, 3, 5, 6 with more than one option always fail validation
   */
  it('single-select questions with multiple options always fail', () => {
    const singleSelectQuestions = [1, 2, 3, 5, 6];

    fc.assert(
      fc.property(
        fc.constantFrom(...singleSelectQuestions),
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
          minLength: 2,
          maxLength: 10,
        }),
        (questionNumber, options) => {
          const result = surveyResponseSchema.safeParse({
            question_number: questionNumber,
            selected_options: options,
            free_text: null,
          });
          return result.success === false;
        },
      ),
    );
  });

  /**
   * **Validates: Requirements 20.8**
   * Property: Question 4 with one or more options always passes validation
   */
  it('question 4 with one or more options always passes', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
          minLength: 1,
          maxLength: 10,
        }),
        (options) => {
          const result = surveyResponseSchema.safeParse({
            question_number: 4,
            selected_options: options,
            free_text: null,
          });
          return result.success === true;
        },
      ),
    );
  });

  /**
   * **Validates: Requirements 20.8**
   * Property: Question 4 with zero options always fails validation
   */
  it('question 4 with zero options always fails', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ minLength: 0, maxLength: FREE_TEXT_MAX_LENGTH }), {
          nil: null,
        }),
        (freeText) => {
          const result = surveyResponseSchema.safeParse({
            question_number: 4,
            selected_options: [],
            free_text: freeText,
          });
          return result.success === false;
        },
      ),
    );
  });

  /**
   * **Validates: Requirements 20.8**
   * Property: Free text exceeding 200 characters for Q4 always fails
   */
  it('free text exceeding max length always fails for Q4', () => {
    fc.assert(
      fc.property(
        fc.string({
          minLength: FREE_TEXT_MAX_LENGTH + 1,
          maxLength: FREE_TEXT_MAX_LENGTH + 100,
        }),
        (freeText) => {
          const result = surveyResponseSchema.safeParse({
            question_number: 4,
            selected_options: ['other'],
            free_text: freeText,
          });
          return result.success === false;
        },
      ),
    );
  });

  /**
   * **Validates: Requirements 20.8**
   * Property: Free text within max length for Q4 always passes
   */
  it('free text within max length always passes for Q4', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: FREE_TEXT_MAX_LENGTH }), (freeText) => {
        const result = surveyResponseSchema.safeParse({
          question_number: 4,
          selected_options: ['other'],
          free_text: freeText,
        });
        return result.success === true;
      }),
    );
  });

  /**
   * **Validates: Requirements 20.8**
   * Property: A valid full submission with correct constraints always passes
   */
  it('valid full submission always passes', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
          minLength: 1,
          maxLength: 5,
        }),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (q1Opt, q2Opt, q3Opt, q4Opts, q5Opt, q6Opt) => {
          const result = submitSurveySchema.safeParse({
            responses: [
              {
                question_number: 1,
                selected_options: [q1Opt],
                free_text: null,
              },
              {
                question_number: 2,
                selected_options: [q2Opt],
                free_text: null,
              },
              {
                question_number: 3,
                selected_options: [q3Opt],
                free_text: null,
              },
              {
                question_number: 4,
                selected_options: q4Opts,
                free_text: null,
              },
              {
                question_number: 5,
                selected_options: [q5Opt],
                free_text: null,
              },
              {
                question_number: 6,
                selected_options: [q6Opt],
                free_text: null,
              },
            ],
          });
          return result.success === true;
        },
      ),
    );
  });
});
