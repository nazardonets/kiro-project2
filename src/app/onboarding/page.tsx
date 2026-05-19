'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Survey question definitions with prompts and response options.
 * Uses supportive, non-clinical language per Requirement 19.
 */
const SURVEY_QUESTIONS = [
  {
    number: 1,
    prompt: 'How would you describe your typical cycle experience?',
    type: 'single' as const,
    options: [
      'Very predictable (I usually notice clear patterns each month)',
      'Somewhat predictable (I notice patterns, but they vary)',
      'Unpredictable (each cycle feels different)',
      'Not sure yet',
    ],
  },
  {
    number: 2,
    prompt: 'During your cycle, how much do your emotions tend to change?',
    type: 'single' as const,
    options: [
      'Slightly (subtle shifts, still stable overall)',
      'Moderately (noticeable mood changes)',
      'Strongly (clear emotional shifts across phases)',
      'Very strongly (emotions feel significantly different day to day)',
    ],
  },
  {
    number: 3,
    prompt: 'How does your social energy typically change during your cycle?',
    type: 'single' as const,
    options: [
      'Mostly consistent across all phases',
      'I need more alone time in certain phases',
      'I become significantly more social in some phases',
      'It varies a lot and is hard to predict',
    ],
  },
  {
    number: 4,
    prompt: 'What tends to affect your mood most during sensitive phases?',
    type: 'multi' as const,
    options: [
      'Feeling unheard or not understood',
      'Stress / workload / fatigue',
      'Social situations or overstimulation',
      'Relationship dynamics or communication tone',
      "I don't notice clear triggers",
      'Other',
    ],
  },
  {
    number: 5,
    prompt: 'When you\u2019re feeling low or sensitive, what kind of support helps most?',
    type: 'single' as const,
    options: [
      'Space and minimal interaction',
      'Emotional reassurance and empathy',
      'Practical help (tasks, comfort, routines)',
      'Distraction / fun activities',
      'I prefer different things depending on the day',
    ],
  },
  {
    number: 6,
    prompt: 'How would you like your partner to engage with you during difficult phases?',
    type: 'single' as const,
    options: [
      "Check in gently, but don't push for deep conversation",
      'Be direct and ask what I need',
      'Give me space unless I initiate contact',
      'Stay emotionally present but low-pressure',
      'It depends on the situation',
    ],
  },
] as const;

const FREE_TEXT_MAX = 200;

interface SurveyResponses {
  [questionNumber: number]: string[];
}

/**
 * Onboarding survey page presented to Primary_Users after account creation.
 * Collects 6 questions to calibrate partner guidance.
 *
 * Validates: Requirements 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.19
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<SurveyResponses>({});
  const [freeText, setFreeText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentQuestion = SURVEY_QUESTIONS[currentStep];
  const totalSteps = SURVEY_QUESTIONS.length;
  const isLastStep = currentStep === totalSteps - 1;

  const currentSelection = responses[currentQuestion.number] ?? [];

  /** Handle single-select option click */
  function handleSingleSelect(option: string) {
    setResponses((prev) => ({
      ...prev,
      [currentQuestion.number]: [option],
    }));
  }

  /** Handle multi-select option toggle */
  function handleMultiSelect(option: string) {
    setResponses((prev) => {
      const current = prev[currentQuestion.number] ?? [];
      const isSelected = current.includes(option);

      if (isSelected) {
        return {
          ...prev,
          [currentQuestion.number]: current.filter((o) => o !== option),
        };
      }

      return {
        ...prev,
        [currentQuestion.number]: [...current, option],
      };
    });
  }

  /** Check if the current question has a valid selection */
  function isCurrentValid(): boolean {
    const selection = responses[currentQuestion.number] ?? [];
    if (selection.length === 0) return false;

    // For Q4 with "Other" selected, free text is optional but if provided must be <= 200 chars
    if (currentQuestion.number === 4 && selection.includes('Other')) {
      if (freeText.length > FREE_TEXT_MAX) return false;
    }

    return true;
  }

  /** Move to the next question */
  function handleNext() {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  }

  /** Move to the previous question */
  function handleBack() {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }

  /** Submit all survey responses */
  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        responses: SURVEY_QUESTIONS.map((q) => ({
          question_number: q.number,
          selected_options: responses[q.number] ?? [],
          free_text:
            q.number === 4 && (responses[4] ?? []).includes('Other') && freeText.trim()
              ? freeText.trim()
              : null,
        })),
      };

      const res = await fetch('/api/survey/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Something went wrong. Please try again.');
        return;
      }

      // Redirect to dashboard on success
      router.push('/dashboard');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-rose-50 to-white px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">
            Help us understand your experience
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Your answers help us tailor supportive guidance for your partner. There are no right or
            wrong answers — just share what feels true for you.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              Question {currentStep + 1} of {totalSteps}
            </span>
            <span>{Math.round(((currentStep + 1) / totalSteps) * 100)}%</span>
          </div>
          <div
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200"
            role="progressbar"
            aria-valuenow={currentStep + 1}
            aria-valuemin={1}
            aria-valuemax={totalSteps}
            aria-label={`Question ${currentStep + 1} of ${totalSteps}`}
          >
            <div
              className="h-full rounded-full bg-rose-400 transition-all duration-300"
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Question card */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-medium text-gray-900">{currentQuestion.prompt}</h2>
          <p className="mb-5 text-sm text-gray-500">
            {currentQuestion.type === 'multi'
              ? 'Select all that apply'
              : 'Choose the option that feels closest to your experience'}
          </p>

          {/* Options */}
          <fieldset>
            <legend className="sr-only">{currentQuestion.prompt}</legend>
            <div
              className="space-y-3"
              role={currentQuestion.type === 'single' ? 'radiogroup' : 'group'}
            >
              {currentQuestion.options.map((option) => {
                const isSelected = currentSelection.includes(option);

                return (
                  <label
                    key={option}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
                      isSelected
                        ? 'border-rose-300 bg-rose-50 ring-1 ring-rose-300'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                    )}
                  >
                    <input
                      type={currentQuestion.type === 'single' ? 'radio' : 'checkbox'}
                      name={`question-${currentQuestion.number}`}
                      value={option}
                      checked={isSelected}
                      onChange={() =>
                        currentQuestion.type === 'single'
                          ? handleSingleSelect(option)
                          : handleMultiSelect(option)
                      }
                      className="mt-0.5 h-4 w-4 shrink-0 accent-rose-500"
                      aria-label={option}
                    />
                    <span className="text-sm text-gray-700">{option}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Free text field for Q4 "Other" option */}
          {currentQuestion.number === 4 && currentSelection.includes('Other') && (
            <div className="mt-4">
              <label htmlFor="other-text" className="block text-sm font-medium text-gray-700">
                Tell us more (optional)
              </label>
              <textarea
                id="other-text"
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                maxLength={FREE_TEXT_MAX}
                rows={3}
                placeholder="Share anything else that feels relevant..."
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
                aria-describedby="other-text-count"
              />
              <p id="other-text-count" className="mt-1 text-right text-xs text-gray-400">
                {freeText.length}/{FREE_TEXT_MAX} characters
              </p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          {/* Navigation buttons */}
          <div className="mt-6 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 0}
              aria-label="Go to previous question"
            >
              Back
            </Button>

            {isLastStep ? (
              <Button
                onClick={handleSubmit}
                disabled={!isCurrentValid() || isSubmitting}
                aria-label="Submit survey"
              >
                {isSubmitting ? 'Submitting...' : 'Complete'}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!isCurrentValid()}
                aria-label="Go to next question"
              >
                Continue
              </Button>
            )}
          </div>
        </div>

        {/* Reassurance text */}
        <p className="mt-4 text-center text-xs text-gray-400">
          Your responses are private and only used to personalize guidance for your partner. You can
          update them anytime from your profile settings.
        </p>
      </div>
    </main>
  );
}
