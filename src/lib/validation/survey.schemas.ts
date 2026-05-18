import { z } from 'zod';

import { FREE_TEXT_MAX_LENGTH } from '@/lib/constants';

/** Question numbers that require exactly one selected response */
const SINGLE_SELECT_QUESTIONS = [1, 2, 3, 5, 6] as const;

/** Question numbers that allow multiple selected responses */
const MULTI_SELECT_QUESTIONS = [4] as const;

/** Individual survey response for one question */
export const surveyResponseSchema = z
  .object({
    question_number: z
      .number()
      .int()
      .min(1, 'Question number must be between 1 and 6')
      .max(6, 'Question number must be between 1 and 6'),
    selected_options: z.array(z.string().min(1)).min(1, 'At least one option must be selected'),
    free_text: z
      .string()
      .max(FREE_TEXT_MAX_LENGTH, `Free text must be at most ${FREE_TEXT_MAX_LENGTH} characters`)
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    const { question_number, selected_options, free_text } = data;

    // Questions 1, 2, 3, 5, 6 must have exactly one selected response
    if ((SINGLE_SELECT_QUESTIONS as readonly number[]).includes(question_number)) {
      if (selected_options.length !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Question ${question_number} must have exactly one selected response`,
          path: ['selected_options'],
        });
      }
    }

    // Question 4 must have one or more selected responses (already enforced by .min(1) but explicit)
    if ((MULTI_SELECT_QUESTIONS as readonly number[]).includes(question_number)) {
      if (selected_options.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Question ${question_number} must have one or more selected responses`,
          path: ['selected_options'],
        });
      }
    }

    // Free text is only allowed for Question 4 (for "Other" option)
    if (question_number !== 4 && free_text != null && free_text.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Free text is only allowed for Question 4',
        path: ['free_text'],
      });
    }
  });

/** Submit all 6 survey responses at once */
export const submitSurveySchema = z
  .object({
    responses: z.array(surveyResponseSchema).length(6, 'All 6 survey questions must be answered'),
  })
  .superRefine((data, ctx) => {
    const questionNumbers = data.responses.map((r) => r.question_number);

    // Ensure all 6 questions are present (1 through 6)
    for (let q = 1; q <= 6; q++) {
      if (!questionNumbers.includes(q)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Missing response for question ${q}`,
          path: ['responses'],
        });
      }
    }

    // Ensure no duplicate question numbers
    const uniqueQuestions = new Set(questionNumbers);
    if (uniqueQuestions.size !== questionNumbers.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Duplicate question numbers are not allowed',
        path: ['responses'],
      });
    }
  });

/** Update a single survey response */
export const updateSurveyResponseSchema = surveyResponseSchema;

export type SurveyResponseInput = z.infer<typeof surveyResponseSchema>;
export type SubmitSurveyInput = z.infer<typeof submitSurveySchema>;
