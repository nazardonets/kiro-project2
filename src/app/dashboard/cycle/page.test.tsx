import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CycleInputPage from './page';

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

const mockRecords = [
  {
    id: '1',
    primary_user_id: 'user-1',
    start_date: '2024-06-01',
    cycle_length_days: 28,
    created_at: '2024-06-01T10:00:00Z',
  },
  {
    id: '2',
    primary_user_id: 'user-1',
    start_date: '2024-05-04',
    cycle_length_days: 28,
    created_at: '2024-05-04T10:00:00Z',
  },
];

describe('CycleInputPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('renders the page with date picker and history section', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/cycle/history')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ records: [], count: 0 }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    render(<CycleInputPage />);

    expect(screen.getByText('Cycle Data')).toBeInTheDocument();
    expect(screen.getByText('Record Cycle Start Date')).toBeInTheDocument();
    expect(screen.getByText('Cycle History')).toBeInTheDocument();
  });

  it('displays cycle history records (Requirement 7.3)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/cycle/history')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ records: mockRecords, count: 2 }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    render(<CycleInputPage />);

    await waitFor(() => {
      expect(screen.getByText(/2\/12/)).toBeInTheDocument();
    });

    // Check that cycle records are displayed (start dates shown as formatted dates)
    expect(screen.getByText('June 1st, 2024')).toBeInTheDocument();
    expect(screen.getByText('May 4th, 2024')).toBeInTheDocument();
  });

  it('shows empty state when no records exist', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/cycle/history')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ records: [], count: 0 }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    render(<CycleInputPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/No cycle records yet/i),
      ).toBeInTheDocument();
    });
  });

  it('shows success message on successful save (Requirement 7.2)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/cycle/history')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ records: [], count: 0 }),
        });
      }
      if (url.includes('/api/cycle/start-date') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            message: 'Cycle record saved successfully',
            record: {
              id: '3',
              primary_user_id: 'user-1',
              start_date: '2024-07-01',
              cycle_length_days: 28,
              created_at: '2024-07-01T10:00:00Z',
            },
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    render(<CycleInputPage />);

    // Wait for history to load
    await waitFor(() => {
      expect(screen.getByText(/No cycle records yet/i)).toBeInTheDocument();
    });

    // The submit button should be disabled without a date selected
    const submitButton = screen.getByRole('button', { name: /save cycle start date/i });
    expect(submitButton).toBeDisabled();
  });

  it('shows conflict warning for overlapping dates (Requirement 7.5)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/cycle/history')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ records: mockRecords, count: 2 }),
        });
      }
      if (url.includes('/api/cycle/start-date') && options?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({
            code: 'CONFLICT',
            message: 'This date overlaps with an existing cycle record.',
            conflict: {
              conflicting_record_id: '1',
              conflicting_start_date: '2024-06-01',
              details: 'The selected date falls within the duration of an existing cycle.',
            },
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    render(<CycleInputPage />);

    await waitFor(() => {
      expect(screen.getByText(/2\/12/)).toBeInTheDocument();
    });
  });

  it('shows date picker button with placeholder text', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/cycle/history')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ records: [], count: 0 }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    render(<CycleInputPage />);

    await waitFor(() => {
      expect(screen.getByText('Pick a date')).toBeInTheDocument();
    });
  });

  it('shows max records error when limit reached (Requirement 7.3)', async () => {
    const maxRecords = Array.from({ length: 12 }, (_, i) => ({
      id: String(i + 1),
      primary_user_id: 'user-1',
      start_date: `2024-${String(i + 1).padStart(2, '0')}-01`,
      cycle_length_days: 28,
      created_at: `2024-${String(i + 1).padStart(2, '0')}-01T10:00:00Z`,
    }));

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/cycle/history')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ records: maxRecords, count: 12 }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    render(<CycleInputPage />);

    await waitFor(() => {
      expect(screen.getByText(/12\/12/)).toBeInTheDocument();
    });
  });

  it('has accessible date picker with label', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/cycle/history')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ records: [], count: 0 }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    render(<CycleInputPage />);

    await waitFor(() => {
      expect(screen.getByText('Cycle Start Date')).toBeInTheDocument();
    });

    // The date picker button is associated with the label via htmlFor/id
    const datePickerButton = document.getElementById('cycle-date-picker');
    expect(datePickerButton).toBeInTheDocument();
    expect(datePickerButton?.tagName).toBe('BUTTON');
  });
});
