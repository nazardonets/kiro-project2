import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'user-123' }),
}));

import AdminCycleManagementPage from './page';

const mockCyclesResponse = {
  data: [
    {
      id: 'cycle-1',
      primary_user_id: 'user-123',
      start_date: '2024-03-01',
      cycle_length_days: 28,
      created_at: '2024-03-01T10:00:00Z',
      annotations: [
        {
          id: 'ann-1',
          admin_user_id: 'admin-1',
          cycle_record_id: 'cycle-1',
          phase: 'menstrual',
          content: 'Patient reported severe cramps.',
          created_at: '2024-03-02T10:00:00Z',
          updated_at: '2024-03-02T10:00:00Z',
        },
      ],
      overrides: [
        {
          id: 'ovr-1',
          admin_user_id: 'admin-1',
          cycle_record_id: 'cycle-1',
          phase: 'follicular',
          replacement_content: 'Custom guidance for this user.',
          original_content: '[system-generated content]',
          created_at: '2024-03-03T10:00:00Z',
          updated_at: '2024-03-03T10:00:00Z',
        },
      ],
    },
    {
      id: 'cycle-2',
      primary_user_id: 'user-123',
      start_date: '2024-02-01',
      cycle_length_days: 30,
      created_at: '2024-02-01T10:00:00Z',
      annotations: [],
      overrides: [],
    },
  ],
  count: 2,
};

describe('AdminCycleManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('shows loading state initially', () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}));

    render(<AdminCycleManagementPage />);
    expect(screen.getByText('Loading cycle instances...')).toBeInTheDocument();
  });

  it('displays cycle instances ordered by start_date descending (Requirement 6.1)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCyclesResponse,
    });

    render(<AdminCycleManagementPage />);

    await waitFor(() => {
      expect(screen.getByText(/Cycle starting Mar 1, 2024/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Cycle starting Feb 1, 2024/)).toBeInTheDocument();

    // Verify ordering: most recent first
    const cycleCards = screen.getAllByTestId(/^cycle-instance-/);
    expect(cycleCards[0]).toHaveAttribute('data-testid', 'cycle-instance-cycle-1');
    expect(cycleCards[1]).toHaveAttribute('data-testid', 'cycle-instance-cycle-2');
  });

  it('shows cycle details including phases and current phase (Requirement 6.2)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCyclesResponse,
    });

    render(<AdminCycleManagementPage />);

    await waitFor(() => {
      expect(screen.getByText(/Length: 28 days/)).toBeInTheDocument();
    });

    // Phase labels should be visible
    expect(screen.getAllByText('Menstrual').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Follicular').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ovulation').length).toBeGreaterThan(0);
  });

  it('displays visual indicator for overridden content (Requirement 6.6)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCyclesResponse,
    });

    render(<AdminCycleManagementPage />);

    await waitFor(() => {
      expect(screen.getByTestId('override-badge-cycle-1')).toBeInTheDocument();
    });

    expect(screen.getByTestId('override-badge-cycle-1')).toHaveTextContent('Overridden');
  });

  it('displays existing annotations (Requirement 6.4)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCyclesResponse,
    });

    render(<AdminCycleManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Patient reported severe cramps.')).toBeInTheDocument();
    });

    expect(screen.getByTestId('annotation-ann-1')).toBeInTheDocument();
  });

  it('displays existing overrides with original content (Requirement 6.5, 6.6)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCyclesResponse,
    });

    render(<AdminCycleManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Custom guidance for this user.')).toBeInTheDocument();
    });

    expect(screen.getByText(/Original:.*\[system-generated content\]/)).toBeInTheDocument();
    expect(screen.getByTestId('override-ovr-1')).toBeInTheDocument();
  });

  it('opens annotation form when Add Annotation is clicked (Requirement 6.3)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCyclesResponse,
    });

    render(<AdminCycleManagementPage />);

    await waitFor(() => {
      expect(screen.getByTestId('add-annotation-cycle-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('add-annotation-cycle-1'));

    expect(screen.getByTestId('annotation-form')).toBeInTheDocument();
    expect(screen.getByLabelText(/Content/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter annotation content/)).toBeInTheDocument();
  });

  it('shows empty state when no cycles exist', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [], count: 0 }),
    });

    render(<AdminCycleManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('No cycle instances found for this user.')).toBeInTheDocument();
    });
  });

  it('shows error state on fetch failure', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'User not found' }),
    });

    render(<AdminCycleManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('User not found')).toBeInTheDocument();
    });

    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('submits annotation via API when form is saved (Requirement 6.3)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockCyclesResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Annotation created successfully' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockCyclesResponse,
      });

    render(<AdminCycleManagementPage />);

    await waitFor(() => {
      expect(screen.getByTestId('add-annotation-cycle-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('add-annotation-cycle-1'));

    const textarea = screen.getByPlaceholderText(/Enter annotation content/);
    fireEvent.change(textarea, { target: { value: 'New annotation text' } });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Annotation added successfully.')).toBeInTheDocument();
    });

    // Verify the API was called correctly
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/cycles/cycle-1/annotate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ content: 'New annotation text' }),
      }),
    );
  });

  it('calls revert API when Revert button is clicked (Requirement 6.9)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockCyclesResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Override reverted successfully' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockCyclesResponse,
          data: [{ ...mockCyclesResponse.data[0], overrides: [] }, mockCyclesResponse.data[1]],
        }),
      });

    render(<AdminCycleManagementPage />);

    await waitFor(() => {
      expect(screen.getByTestId('override-ovr-1')).toBeInTheDocument();
    });

    const revertButton = screen.getByRole('button', { name: /Revert override for Follicular/ });
    fireEvent.click(revertButton);

    await waitFor(() => {
      expect(screen.getByText('Override reverted. Original content restored.')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/cycles/cycle-1/override',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ override_id: 'ovr-1' }),
      }),
    );
  });

  it('validates annotation content length (Requirement 6.3)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCyclesResponse,
    });

    render(<AdminCycleManagementPage />);

    await waitFor(() => {
      expect(screen.getByTestId('add-annotation-cycle-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('add-annotation-cycle-1'));

    // Try to save with empty content
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(
        screen.getByText(/Annotation must be between 1 and 2000 characters/),
      ).toBeInTheDocument();
    });
  });

  it('shows back link to admin panel', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCyclesResponse,
    });

    render(<AdminCycleManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Back to Users')).toBeInTheDocument();
    });

    const backLink = screen.getByRole('link', { name: /Back to Users/ });
    expect(backLink).toHaveAttribute('href', '/admin');
  });
});
