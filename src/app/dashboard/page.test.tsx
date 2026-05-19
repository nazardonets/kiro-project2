import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import DashboardPage from './page';

const mockPhaseData = {
  phase: 'follicular',
  day_in_phase: 3,
  is_overdue: false,
  total_cycle_length: 28,
  elapsed_days: 8,
  cycle_start_date: '2024-01-01',
};

const mockPredictionsData = {
  predictions: [
    {
      phase: 'follicular',
      start_date: '2024-01-08',
      end_date: '2024-01-13',
      start_day: 1,
      end_day: 6,
    },
    {
      phase: 'ovulation',
      start_date: '2024-01-14',
      end_date: '2024-01-14',
      start_day: 7,
      end_day: 7,
    },
    {
      phase: 'early_luteal',
      start_date: '2024-01-15',
      end_date: '2024-01-21',
      start_day: 8,
      end_day: 14,
    },
  ],
  cycle_start_date: '2024-01-01',
  generated_at: '2024-01-08T12:00:00Z',
};

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('shows loading state initially', () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    render(<DashboardPage />);
    expect(screen.getByText('Loading your dashboard...')).toBeInTheDocument();
  });

  it('shows empty state when no cycle data exists (Requirement 10.6)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/cycle/phase')) {
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ code: 'NO_CYCLE_DATA', message: 'No cycle records found.' }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Welcome to Your Dashboard')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/input your cycle start date/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /input cycle start date/i })).toHaveAttribute(
      'href',
      '/dashboard/cycle',
    );
  });

  it('displays current phase name and day number (Requirement 10.1)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/cycle/phase')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockPhaseData,
        });
      }
      if (url.includes('/api/cycle/predictions')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockPredictionsData,
        });
      }
      return Promise.resolve({ ok: false, status: 403, json: async () => ({}) });
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Follicular Phase')).toBeInTheDocument();
    });

    expect(screen.getByText('Day 3')).toBeInTheDocument();
    expect(screen.getByText(/of this phase/i)).toBeInTheDocument();
  });

  it('displays 60-day predicted upcoming phases (Requirement 10.2)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/cycle/phase')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockPhaseData,
        });
      }
      if (url.includes('/api/cycle/predictions')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockPredictionsData,
        });
      }
      return Promise.resolve({ ok: false, status: 403, json: async () => ({}) });
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Upcoming Phases (60 Days)')).toBeInTheDocument();
    });

    expect(screen.getByText('Follicular')).toBeInTheDocument();
    expect(screen.getByText('Ovulation')).toBeInTheDocument();
    expect(screen.getByText('Early Luteal')).toBeInTheDocument();
  });

  it('displays emotional, cognitive, and behavioral tendencies (Requirement 10.3)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/cycle/phase')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockPhaseData,
        });
      }
      if (url.includes('/api/cycle/predictions')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockPredictionsData,
        });
      }
      return Promise.resolve({ ok: false, status: 403, json: async () => ({}) });
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Phase Tendencies')).toBeInTheDocument();
    });

    // Check that tendency category headers are present
    expect(screen.getByText('Emotional')).toBeInTheDocument();
    expect(screen.getByText('Cognitive')).toBeInTheDocument();
    expect(screen.getByText('Behavioral')).toBeInTheDocument();
    expect(screen.getByText('Energy Level')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();
  });

  it('displays self-care suggestions and energy management (Requirement 10.4)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/cycle/phase')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockPhaseData,
        });
      }
      if (url.includes('/api/cycle/predictions')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockPredictionsData,
        });
      }
      return Promise.resolve({ ok: false, status: 403, json: async () => ({}) });
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Self-Care & Energy/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Self-Care Suggestions')).toBeInTheDocument();
    expect(screen.getByText('Energy Management')).toBeInTheDocument();
  });

  it('shows overdue indicator when cycle is overdue', async () => {
    const overduePhaseData = {
      ...mockPhaseData,
      phase: 'late_luteal',
      is_overdue: true,
      elapsed_days: 35,
      day_in_phase: 14,
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/cycle/phase')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => overduePhaseData,
        });
      }
      if (url.includes('/api/cycle/predictions')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockPredictionsData,
        });
      }
      return Promise.resolve({ ok: false, status: 403, json: async () => ({}) });
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/cycle is overdue/i)).toBeInTheDocument();
    });
  });

  it('shows error state and retry option on fetch failure', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => {
      return Promise.reject(new Error('Network error'));
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/unable to load dashboard data/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('displays "Request a Date" button linking to /dashboard/date-request (Requirement 11.1)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/cycle/phase')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockPhaseData,
        });
      }
      if (url.includes('/api/cycle/predictions')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockPredictionsData,
        });
      }
      return Promise.resolve({ ok: false, status: 403, json: async () => ({}) });
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('request-a-date-button')).toBeInTheDocument();
    });

    const dateButton = screen.getByTestId('request-a-date-button');
    const link = dateButton.closest('a');
    expect(link).toHaveAttribute('href', '/dashboard/date-request');
  });
});
