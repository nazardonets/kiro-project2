import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CustomizePage from './page';

// Mock fetch globally
const mockFetch = vi.fn();

describe('CustomizePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  const setupDefaultMocks = (overrides?: {
    phaseData?: object | null;
    customization?: object | null;
    notes?: object[] | null;
  }) => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/cycle/phase')) {
        if (overrides?.phaseData === null) {
          return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () =>
            overrides?.phaseData || { total_cycle_length: 28 },
        });
      }
      if (url.includes('/api/cycle/customize')) {
        if (overrides?.customization === null) {
          return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            customization: overrides?.customization || {
              menstrual_days: 5,
              follicular_days: 8,
              ovulation_days: 1,
              early_luteal_days: 7,
              late_luteal_days: 7,
            },
          }),
        });
      }
      if (url.includes('/api/cycle/notes')) {
        if (overrides?.notes === null) {
          return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            notes: overrides?.notes || [],
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });
  };

  it('shows loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    render(<CustomizePage />);
    expect(screen.getByText('Loading customization settings...')).toBeInTheDocument();
  });

  it('displays phase duration inputs for all five phases (Requirement 9.1)', async () => {
    setupDefaultMocks();
    render(<CustomizePage />);

    await waitFor(() => {
      expect(screen.getByText('Phase Durations')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Menstrual')).toBeInTheDocument();
    expect(screen.getByLabelText('Follicular')).toBeInTheDocument();
    expect(screen.getByLabelText('Ovulation')).toBeInTheDocument();
    expect(screen.getByLabelText('Early Luteal')).toBeInTheDocument();
    expect(screen.getByLabelText('Late Luteal')).toBeInTheDocument();
  });

  it('shows each phase input with min=1 and max=14 (Requirement 9.1)', async () => {
    setupDefaultMocks();
    render(<CustomizePage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Menstrual')).toBeInTheDocument();
    });

    const menstrualInput = screen.getByLabelText('Menstrual') as HTMLInputElement;
    expect(menstrualInput.min).toBe('1');
    expect(menstrualInput.max).toBe('14');
    expect(menstrualInput.type).toBe('number');
  });

  it('displays the total duration and cycle length (Requirement 9.2)', async () => {
    setupDefaultMocks();
    render(<CustomizePage />);

    await waitFor(() => {
      expect(screen.getByTestId('duration-total')).toBeInTheDocument();
    });

    expect(screen.getByTestId('duration-total')).toHaveTextContent('28 / 28 days');
  });

  it('shows validation error when sum does not match cycle length (Requirement 9.3)', async () => {
    setupDefaultMocks({
      customization: {
        menstrual_days: 5,
        follicular_days: 8,
        ovulation_days: 1,
        early_luteal_days: 7,
        late_luteal_days: 7,
      },
    });
    render(<CustomizePage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Menstrual')).toBeInTheDocument();
    });

    // Change menstrual to 10 (total becomes 33, not 28)
    const menstrualInput = screen.getByLabelText('Menstrual');
    fireEvent.change(menstrualInput, { target: { value: '10' } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Phase durations must sum to 28 days',
      );
    });

    // Save button should be disabled
    const saveButton = screen.getByRole('button', { name: /save phase durations/i });
    expect(saveButton).toBeDisabled();
  });

  it('enables save button when sum matches cycle length (Requirement 9.2)', async () => {
    setupDefaultMocks();
    render(<CustomizePage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Menstrual')).toBeInTheDocument();
    });

    // Default values sum to 28, which matches cycle length
    const saveButton = screen.getByRole('button', { name: /save phase durations/i });
    expect(saveButton).not.toBeDisabled();
  });

  it('calls PUT /api/cycle/customize on save (Requirement 9.2)', async () => {
    setupDefaultMocks();
    render(<CustomizePage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Menstrual')).toBeInTheDocument();
    });

    // Mock the PUT response
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/cycle/customize') && options?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            message: 'Phase durations updated successfully',
            customization: {
              menstrual_days: 5,
              follicular_days: 8,
              ovulation_days: 1,
              early_luteal_days: 7,
              late_luteal_days: 7,
            },
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    const saveButton = screen.getByRole('button', { name: /save phase durations/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByTestId('duration-success')).toHaveTextContent(
        'Phase durations updated successfully.',
      );
    });
  });

  it('displays server validation error on failed save (Requirement 9.3)', async () => {
    setupDefaultMocks();
    render(<CustomizePage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Menstrual')).toBeInTheDocument();
    });

    // Mock the PUT response with validation error
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/cycle/customize') && options?.method === 'PUT') {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({
            code: 'VALIDATION_ERROR',
            fields: {
              total: {
                message: 'Phase durations must sum to 28 days (currently 30)',
                constraint: 'sum_equals_cycle_length',
              },
            },
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    const saveButton = screen.getByRole('button', { name: /save phase durations/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByTestId('duration-error')).toHaveTextContent(
        'Phase durations must sum to 28 days (currently 30)',
      );
    });
  });

  it('displays personal notes textarea for each phase (Requirement 9.4)', async () => {
    setupDefaultMocks();
    render(<CustomizePage />);

    await waitFor(() => {
      expect(screen.getByText('Personal Notes')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Menstrual Phase Notes')).toBeInTheDocument();
    expect(screen.getByLabelText('Follicular Phase Notes')).toBeInTheDocument();
    expect(screen.getByLabelText('Ovulation Phase Notes')).toBeInTheDocument();
    expect(screen.getByLabelText('Early Luteal Phase Notes')).toBeInTheDocument();
    expect(screen.getByLabelText('Late Luteal Phase Notes')).toBeInTheDocument();
  });

  it('shows character count for personal notes (Requirement 9.4)', async () => {
    setupDefaultMocks();
    render(<CustomizePage />);

    await waitFor(() => {
      expect(screen.getByText('Personal Notes')).toBeInTheDocument();
    });

    // All notes start empty, so character count should show 0/500
    const charCounts = screen.getAllByText('0/500 characters');
    expect(charCounts.length).toBe(5);
  });

  it('updates character count as user types (Requirement 9.4)', async () => {
    setupDefaultMocks();
    render(<CustomizePage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Menstrual Phase Notes')).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText('Menstrual Phase Notes');
    fireEvent.change(textarea, { target: { value: 'Hello world' } });

    expect(screen.getByText('11/500 characters')).toBeInTheDocument();
  });

  it('enforces maxLength on textarea (Requirement 9.4)', async () => {
    setupDefaultMocks();
    render(<CustomizePage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Menstrual Phase Notes')).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText('Menstrual Phase Notes') as HTMLTextAreaElement;
    expect(textarea.maxLength).toBe(500);
  });

  it('calls PUT /api/cycle/notes on save note (Requirement 9.4)', async () => {
    setupDefaultMocks();
    render(<CustomizePage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Menstrual Phase Notes')).toBeInTheDocument();
    });

    // Type a note
    const textarea = screen.getByLabelText('Menstrual Phase Notes');
    fireEvent.change(textarea, { target: { value: 'I feel tired during this phase' } });

    // Mock the PUT response
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/cycle/notes') && options?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            message: 'Personal note updated successfully',
            note: { phase: 'menstrual', content: 'I feel tired during this phase' },
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    // Find the save button for menstrual notes (first "Save Note" button)
    const saveButtons = screen.getAllByRole('button', { name: /save note/i });
    fireEvent.click(saveButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('note-success-menstrual')).toHaveTextContent(
        'Note saved successfully.',
      );
    });
  });

  it('disables save note button when note is empty', async () => {
    setupDefaultMocks();
    render(<CustomizePage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Menstrual Phase Notes')).toBeInTheDocument();
    });

    // All notes start empty, so all save buttons should be disabled
    const saveButtons = screen.getAllByRole('button', { name: /save note/i });
    for (const button of saveButtons) {
      expect(button).toBeDisabled();
    }
  });

  it('loads existing customization data', async () => {
    setupDefaultMocks({
      customization: {
        menstrual_days: 4,
        follicular_days: 9,
        ovulation_days: 2,
        early_luteal_days: 6,
        late_luteal_days: 7,
      },
    });
    render(<CustomizePage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Menstrual')).toHaveValue(4);
    });

    expect(screen.getByLabelText('Follicular')).toHaveValue(9);
    expect(screen.getByLabelText('Ovulation')).toHaveValue(2);
    expect(screen.getByLabelText('Early Luteal')).toHaveValue(6);
    expect(screen.getByLabelText('Late Luteal')).toHaveValue(7);
  });

  it('loads existing personal notes', async () => {
    setupDefaultMocks({
      notes: [
        { phase: 'menstrual', content: 'I need extra rest' },
        { phase: 'follicular', content: 'Feeling energetic' },
      ],
    });
    render(<CustomizePage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Menstrual Phase Notes')).toHaveValue('I need extra rest');
    });

    expect(screen.getByLabelText('Follicular Phase Notes')).toHaveValue('Feeling energetic');
    expect(screen.getByLabelText('Ovulation Phase Notes')).toHaveValue('');
  });

  it('displays description about sharing notes with partner (Requirement 9.5)', async () => {
    setupDefaultMocks();
    render(<CustomizePage />);

    await waitFor(() => {
      expect(screen.getByText('Personal Notes')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/shared with your partner when sharing is enabled/i),
    ).toBeInTheDocument();
  });

  it('shows note save error from server', async () => {
    setupDefaultMocks();
    render(<CustomizePage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Menstrual Phase Notes')).toBeInTheDocument();
    });

    // Type a note
    const textarea = screen.getByLabelText('Menstrual Phase Notes');
    fireEvent.change(textarea, { target: { value: 'Test note' } });

    // Mock the PUT response with error
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/cycle/notes') && options?.method === 'PUT') {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({
            code: 'VALIDATION_ERROR',
            fields: {
              content: {
                message: 'Note must be at most 500 characters',
                constraint: 'max_length',
              },
            },
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    const saveButtons = screen.getAllByRole('button', { name: /save note/i });
    fireEvent.click(saveButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('note-error-menstrual')).toHaveTextContent(
        'Note must be at most 500 characters',
      );
    });
  });
});
