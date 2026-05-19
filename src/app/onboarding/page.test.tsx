import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import OnboardingPage from './page';

describe('OnboardingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the first question on initial load', () => {
    render(<OnboardingPage />);

    expect(
      screen.getByRole('heading', {
        name: 'How would you describe your typical cycle experience?',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Question 1 of 6')).toBeInTheDocument();
  });

  it('displays all options for Q1 as radio buttons', () => {
    render(<OnboardingPage />);

    expect(
      screen.getByText('Very predictable (I usually notice clear patterns each month)'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Somewhat predictable (I notice patterns, but they vary)'),
    ).toBeInTheDocument();
    expect(screen.getByText('Unpredictable (each cycle feels different)')).toBeInTheDocument();
    expect(screen.getByText('Not sure yet')).toBeInTheDocument();

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
  });

  it('disables Continue button when no option is selected', () => {
    render(<OnboardingPage />);

    const continueBtn = screen.getByRole('button', { name: /go to next question/i });
    expect(continueBtn).toBeDisabled();
  });

  it('enables Continue button after selecting an option', () => {
    render(<OnboardingPage />);

    const option = screen.getByLabelText(
      'Very predictable (I usually notice clear patterns each month)',
    );
    fireEvent.click(option);

    const continueBtn = screen.getByRole('button', { name: /go to next question/i });
    expect(continueBtn).not.toBeDisabled();
  });

  it('navigates to Q2 when Continue is clicked', () => {
    render(<OnboardingPage />);

    fireEvent.click(screen.getByLabelText('Not sure yet'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    expect(
      screen.getByRole('heading', {
        name: 'During your cycle, how much do your emotions tend to change?',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Question 2 of 6')).toBeInTheDocument();
  });

  it('navigates back to Q1 when Back is clicked from Q2', () => {
    render(<OnboardingPage />);

    // Go to Q2
    fireEvent.click(screen.getByLabelText('Not sure yet'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    // Go back
    fireEvent.click(screen.getByRole('button', { name: /go to previous question/i }));

    expect(
      screen.getByRole('heading', {
        name: 'How would you describe your typical cycle experience?',
      }),
    ).toBeInTheDocument();
  });

  it('disables Back button on the first question', () => {
    render(<OnboardingPage />);

    const backBtn = screen.getByRole('button', { name: /go to previous question/i });
    expect(backBtn).toBeDisabled();
  });

  it('renders Q4 as multi-select with checkboxes', () => {
    render(<OnboardingPage />);

    // Navigate to Q4
    fireEvent.click(screen.getByLabelText('Not sure yet'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    fireEvent.click(screen.getByLabelText('Slightly (subtle shifts, still stable overall)'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    fireEvent.click(screen.getByLabelText('Mostly consistent across all phases'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    // Now on Q4
    expect(
      screen.getByRole('heading', {
        name: 'What tends to affect your mood most during sensitive phases?',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Select all that apply')).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(6);
  });

  it('allows multiple selections on Q4', () => {
    render(<OnboardingPage />);

    // Navigate to Q4
    fireEvent.click(screen.getByLabelText('Not sure yet'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));
    fireEvent.click(screen.getByLabelText('Slightly (subtle shifts, still stable overall)'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));
    fireEvent.click(screen.getByLabelText('Mostly consistent across all phases'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    // Select multiple options on Q4
    fireEvent.click(screen.getByLabelText('Feeling unheard or not understood'));
    fireEvent.click(screen.getByLabelText('Stress / workload / fatigue'));

    const continueBtn = screen.getByRole('button', { name: /go to next question/i });
    expect(continueBtn).not.toBeDisabled();
  });

  it('shows free-text field when "Other" is selected on Q4', () => {
    render(<OnboardingPage />);

    // Navigate to Q4
    fireEvent.click(screen.getByLabelText('Not sure yet'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));
    fireEvent.click(screen.getByLabelText('Slightly (subtle shifts, still stable overall)'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));
    fireEvent.click(screen.getByLabelText('Mostly consistent across all phases'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    // Select "Other"
    fireEvent.click(screen.getByLabelText('Other'));

    expect(screen.getByLabelText('Tell us more (optional)')).toBeInTheDocument();
    expect(screen.getByText('0/200 characters')).toBeInTheDocument();
  });

  it('limits free-text field to 200 characters', () => {
    render(<OnboardingPage />);

    // Navigate to Q4
    fireEvent.click(screen.getByLabelText('Not sure yet'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));
    fireEvent.click(screen.getByLabelText('Slightly (subtle shifts, still stable overall)'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));
    fireEvent.click(screen.getByLabelText('Mostly consistent across all phases'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    // Select "Other" and type
    fireEvent.click(screen.getByLabelText('Other'));
    const textarea = screen.getByLabelText('Tell us more (optional)');
    expect(textarea).toHaveAttribute('maxLength', '200');
  });

  it('shows Complete button on the last question (Q6)', () => {
    render(<OnboardingPage />);

    // Navigate through all questions
    fireEvent.click(screen.getByLabelText('Not sure yet'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    fireEvent.click(screen.getByLabelText('Slightly (subtle shifts, still stable overall)'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    fireEvent.click(screen.getByLabelText('Mostly consistent across all phases'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    fireEvent.click(screen.getByLabelText('Feeling unheard or not understood'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    fireEvent.click(screen.getByLabelText('Space and minimal interaction'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    // Now on Q6
    expect(
      screen.getByRole('heading', {
        name: 'How would you like your partner to engage with you during difficult phases?',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit survey/i })).toBeInTheDocument();
  });

  it('submits survey and redirects to /dashboard on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Survey submitted successfully' }),
    });

    render(<OnboardingPage />);

    // Navigate through all questions with selections
    fireEvent.click(screen.getByLabelText('Not sure yet'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    fireEvent.click(screen.getByLabelText('Slightly (subtle shifts, still stable overall)'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    fireEvent.click(screen.getByLabelText('Mostly consistent across all phases'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    fireEvent.click(screen.getByLabelText('Feeling unheard or not understood'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    fireEvent.click(screen.getByLabelText('Space and minimal interaction'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    fireEvent.click(screen.getByLabelText("Check in gently, but don't push for deep conversation"));
    fireEvent.click(screen.getByRole('button', { name: /submit survey/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/survey/submit',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('displays error message when submission fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Only Primary_Users can submit the onboarding survey.' }),
    });

    render(<OnboardingPage />);

    // Navigate through all questions
    fireEvent.click(screen.getByLabelText('Not sure yet'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    fireEvent.click(screen.getByLabelText('Slightly (subtle shifts, still stable overall)'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    fireEvent.click(screen.getByLabelText('Mostly consistent across all phases'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    fireEvent.click(screen.getByLabelText('Feeling unheard or not understood'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    fireEvent.click(screen.getByLabelText('Space and minimal interaction'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    fireEvent.click(screen.getByLabelText("Check in gently, but don't push for deep conversation"));
    fireEvent.click(screen.getByRole('button', { name: /submit survey/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Only Primary_Users can submit the onboarding survey.'),
      ).toBeInTheDocument();
    });
  });

  it('sends correct payload format on submission', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Survey submitted successfully' }),
    });

    render(<OnboardingPage />);

    // Navigate through all questions
    fireEvent.click(screen.getByLabelText('Not sure yet'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    fireEvent.click(screen.getByLabelText('Slightly (subtle shifts, still stable overall)'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    fireEvent.click(screen.getByLabelText('Mostly consistent across all phases'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    // Q4: select multiple + Other with text
    fireEvent.click(screen.getByLabelText('Feeling unheard or not understood'));
    fireEvent.click(screen.getByLabelText('Other'));
    const textarea = screen.getByLabelText('Tell us more (optional)');
    fireEvent.change(textarea, { target: { value: 'Noise sensitivity' } });
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    fireEvent.click(screen.getByLabelText('Space and minimal interaction'));
    fireEvent.click(screen.getByRole('button', { name: /go to next question/i }));

    fireEvent.click(screen.getByLabelText("Check in gently, but don't push for deep conversation"));
    fireEvent.click(screen.getByRole('button', { name: /submit survey/i }));

    await waitFor(() => {
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.responses).toHaveLength(6);
      expect(callBody.responses[0]).toEqual({
        question_number: 1,
        selected_options: ['Not sure yet'],
        free_text: null,
      });
      expect(callBody.responses[3]).toEqual({
        question_number: 4,
        selected_options: ['Feeling unheard or not understood', 'Other'],
        free_text: 'Noise sensitivity',
      });
    });
  });

  it('has proper accessibility attributes', () => {
    render(<OnboardingPage />);

    // Progress bar has proper ARIA attributes
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '1');
    expect(progressBar).toHaveAttribute('aria-valuemin', '1');
    expect(progressBar).toHaveAttribute('aria-valuemax', '6');

    // Heading displays the question prompt
    expect(
      screen.getByRole('heading', {
        name: 'How would you describe your typical cycle experience?',
      }),
    ).toBeInTheDocument();
  });
});
