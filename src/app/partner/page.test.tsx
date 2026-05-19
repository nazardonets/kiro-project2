import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import PartnerDashboardPage from './page';

// ─── Mock Data ──────────────────────────────────────────────────────────────

const mockInsightsResponse = {
  insights: {
    phase: 'follicular',
    emotionalTendencies: [
      'She may feel a renewed sense of optimism and emotional lightness.',
      'Common tendencies include increased curiosity and openness to new experiences.',
      'She might notice growing confidence and emotional resilience.',
    ],
    cognitiveTendencies: [
      'Thought patterns may become more creative and solution-oriented.',
      'She might find it easier to learn new things and absorb information.',
    ],
    behavioralTendencies: [
      'She may be more inclined to try new activities or explore new places.',
      'Common behaviors include increased social engagement and planning ahead.',
    ],
    energyLevel: {
      level: 'Moderate',
      summary:
        'Energy typically builds gradually during this phase. She may feel increasingly capable and motivated.',
    },
    communicationTendencies: [
      'She may be more open to longer conversations and sharing ideas.',
      'Communication style might become more enthusiastic and future-oriented.',
    ],
  },
  personalNote: 'I tend to feel more creative and social during this phase.',
  phaseInfo: {
    currentPhase: 'follicular',
    dayInPhase: 4,
    isOverdue: false,
  },
};

const mockDailySummaryResponse = {
  dailySummary: {
    todaysState:
      'Currently in the Follicular Phase. Energy may be building gradually with increased curiosity and openness.',
    bestApproach: [
      'Consider suggesting a new activity or outing together.',
      'You might try engaging in longer, idea-sharing conversations.',
    ],
    avoidThis: [
      'Avoid being overly cautious or restrictive about plans.',
      'Try not to dismiss new ideas or suggestions she brings up.',
    ],
    phase: 'follicular',
    summaryDate: '2024-01-08',
  },
  phaseInfo: {
    currentPhase: 'follicular',
    dayInPhase: 4,
    isOverdue: false,
  },
};

const mockGuidanceResponse = {
  guidance: {
    phase: 'follicular',
    supportiveActions: [
      'Consider suggesting a new restaurant or activity to try together.',
      'You might try planning something creative or adventurous.',
      'She may appreciate you being open to spontaneous plans.',
    ],
    triggersToAvoid: [
      'Avoid being dismissive of new ideas she brings up.',
      'Try not to be overly rigid with scheduling.',
    ],
    communicationStrategies: [
      'Consider asking open-ended questions about her interests.',
      'You might try sharing your own ideas and plans enthusiastically.',
    ],
    discouragedPatterns: [
      'Avoid shutting down conversations about future plans.',
      'Try not to respond with "we always do that" to new suggestions.',
    ],
  },
  decisionSupport: {
    behavioralPrompts: [
      'Consider planning a date that involves something new.',
      'You might try being more spontaneous today.',
    ],
    situationalRecommendations: [
      {
        scenario: 'Planning an evening together',
        recommendation:
          'Consider trying a new restaurant or activity she has mentioned wanting to explore.',
      },
    ],
  },
  phaseInfo: {
    currentPhase: 'follicular',
    dayInPhase: 4,
    isOverdue: false,
  },
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PartnerDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('shows loading state initially', () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    render(<PartnerDashboardPage />);
    expect(screen.getByText('Loading partner dashboard...')).toBeInTheDocument();
  });

  it('shows empty state when no cycle data exists (Requirement 12.7)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/partner/insights')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            code: 'NO_CYCLE_DATA',
            message: 'Cycle data is not yet available.',
          }),
        });
      }
      if (url.includes('/api/partner/daily-summary')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            code: 'NO_CYCLE_DATA',
            message: 'Cycle data is not yet available.',
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 403, json: async () => ({}) });
    });

    render(<PartnerDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Cycle Data Not Yet Available')).toBeInTheDocument();
    });

    expect(screen.getByText(/your partner has not yet submitted cycle data/i)).toBeInTheDocument();
  });

  it('shows empty state when sharing is revoked (Requirement 12.5)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/partner/insights')) {
        return Promise.resolve({
          ok: false,
          status: 403,
          json: async () => ({
            code: 'NO_ACTIVE_LINK',
            message: 'No active partner link found.',
          }),
        });
      }
      if (url.includes('/api/partner/daily-summary')) {
        return Promise.resolve({
          ok: false,
          status: 403,
          json: async () => ({
            code: 'NO_ACTIVE_LINK',
            message: 'No active partner link found.',
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 403, json: async () => ({}) });
    });

    render(<PartnerDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Sharing Not Active')).toBeInTheDocument();
    });
  });

  it('shows empty state when all insight categories are disabled (Requirement 3.5)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/partner/insights')) {
        return Promise.resolve({
          ok: false,
          status: 403,
          json: async () => ({
            code: 'SHARING_DISABLED',
            message: 'No insight categories are currently shared.',
          }),
        });
      }
      if (url.includes('/api/partner/daily-summary')) {
        return Promise.resolve({
          ok: false,
          status: 403,
          json: async () => ({
            code: 'SHARING_DISABLED',
            message: 'Daily summary sharing is currently disabled.',
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 403, json: async () => ({}) });
    });

    render(<PartnerDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('No Shared Content Available')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/your partner has chosen not to share any insight categories/i),
    ).toBeInTheDocument();
  });

  it('displays Daily Summary as the first visible section (Requirement 15.6)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/partner/insights')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockInsightsResponse,
        });
      }
      if (url.includes('/api/partner/daily-summary')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockDailySummaryResponse,
        });
      }
      if (url.includes('/api/partner/guidance')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockGuidanceResponse,
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    render(<PartnerDashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('daily-summary-card')).toBeInTheDocument();
    });

    // Verify Daily Summary card appears before Phase card in the DOM
    const summaryCard = screen.getByTestId('daily-summary-card');
    const phaseCard = screen.getByTestId('phase-card');
    expect(
      summaryCard.compareDocumentPosition(phaseCard) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('displays current cycle phase name (Requirement 12.1)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/partner/insights')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockInsightsResponse,
        });
      }
      if (url.includes('/api/partner/daily-summary')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockDailySummaryResponse,
        });
      }
      if (url.includes('/api/partner/guidance')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockGuidanceResponse,
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    render(<PartnerDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Follicular Phase')).toBeInTheDocument();
    });

    expect(screen.getByText('Day 4')).toBeInTheDocument();
  });

  it('displays emotional tendencies (Requirement 12.2)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/partner/insights')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockInsightsResponse,
        });
      }
      if (url.includes('/api/partner/daily-summary')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockDailySummaryResponse,
        });
      }
      if (url.includes('/api/partner/guidance')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockGuidanceResponse,
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    render(<PartnerDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Emotional Tendencies')).toBeInTheDocument();
    });

    expect(screen.getByText(/may feel a renewed sense of optimism/i)).toBeInTheDocument();
  });

  it('displays energy levels (Requirement 12.3)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/partner/insights')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockInsightsResponse,
        });
      }
      if (url.includes('/api/partner/daily-summary')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockDailySummaryResponse,
        });
      }
      if (url.includes('/api/partner/guidance')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockGuidanceResponse,
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    render(<PartnerDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Energy Level')).toBeInTheDocument();
    });

    expect(screen.getByText('Moderate')).toBeInTheDocument();
    expect(screen.getByText(/energy typically builds gradually/i)).toBeInTheDocument();
  });

  it('displays behavioral patterns (Requirement 12.4)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/partner/insights')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockInsightsResponse,
        });
      }
      if (url.includes('/api/partner/daily-summary')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockDailySummaryResponse,
        });
      }
      if (url.includes('/api/partner/guidance')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockGuidanceResponse,
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    render(<PartnerDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Behavioral Patterns')).toBeInTheDocument();
    });

    expect(screen.getByText(/may be more inclined to try new activities/i)).toBeInTheDocument();
  });

  it('displays personal notes when shared (Requirement 13.8)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/partner/insights')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockInsightsResponse,
        });
      }
      if (url.includes('/api/partner/daily-summary')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockDailySummaryResponse,
        });
      }
      if (url.includes('/api/partner/guidance')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockGuidanceResponse,
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    render(<PartnerDashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('personal-note-card')).toBeInTheDocument();
    });

    expect(screen.getByText('Personal Note from Your Partner')).toBeInTheDocument();
    expect(
      screen.getByText(/I tend to feel more creative and social during this phase/i),
    ).toBeInTheDocument();
  });

  it('uses probabilistic/tendency language framing (Requirement 12.5, 13.6)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/partner/insights')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockInsightsResponse,
        });
      }
      if (url.includes('/api/partner/daily-summary')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockDailySummaryResponse,
        });
      }
      if (url.includes('/api/partner/guidance')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockGuidanceResponse,
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    render(<PartnerDashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('insights-card')).toBeInTheDocument();
    });

    // Verify probabilistic framing in the UI chrome
    expect(screen.getByText(/these are common tendencies/i)).toBeInTheDocument();
    expect(screen.getByText(/every person is unique/i)).toBeInTheDocument();
  });

  it('shows error state and retry option on fetch failure', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => {
      return Promise.reject(new Error('Network error'));
    });

    render(<PartnerDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/unable to load dashboard data/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it("displays daily summary with Today's State, Best Approach, and Avoid This sections", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/partner/insights')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockInsightsResponse,
        });
      }
      if (url.includes('/api/partner/daily-summary')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockDailySummaryResponse,
        });
      }
      if (url.includes('/api/partner/guidance')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockGuidanceResponse,
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    render(<PartnerDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Daily Summary')).toBeInTheDocument();
    });

    // Today's State
    expect(screen.getByText("Today's State")).toBeInTheDocument();
    expect(screen.getByText(/currently in the follicular phase/i)).toBeInTheDocument();

    // Best Approach
    expect(screen.getByText('Best Approach')).toBeInTheDocument();
    expect(screen.getByText(/consider suggesting a new activity/i)).toBeInTheDocument();

    // Avoid This
    expect(screen.getByText('Avoid This')).toBeInTheDocument();
    expect(screen.getByText(/avoid being overly cautious/i)).toBeInTheDocument();
  });

  it('does not display personal note when not shared', async () => {
    const responseWithoutNote = {
      ...mockInsightsResponse,
      personalNote: null,
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/partner/insights')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => responseWithoutNote,
        });
      }
      if (url.includes('/api/partner/daily-summary')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockDailySummaryResponse,
        });
      }
      if (url.includes('/api/partner/guidance')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockGuidanceResponse,
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    render(<PartnerDashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('insights-card')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('personal-note-card')).not.toBeInTheDocument();
  });
});
