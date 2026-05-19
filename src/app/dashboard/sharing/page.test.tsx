import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import SharingControlsPage from './page';

// Mock fetch globally
const mockFetch = vi.fn();

describe('SharingControlsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  const mockPreferences = {
    preferences: {
      emotional_tendencies: true,
      behavioral_patterns: true,
      energy_levels: true,
      communication_guidance: true,
      daily_summaries: true,
      phase_alerts: true,
      partner_reminders: true,
    },
  };

  function setupFetchWithPreferences(preferences = mockPreferences) {
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/sharing/categories') && (!options || options.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => preferences,
        });
      }
      if (url.includes('/api/sharing/categories') && options?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ message: 'Sharing categories updated successfully.' }),
        });
      }
      if (url.includes('/api/sharing/notifications') && options?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ message: 'Notification preferences updated successfully.' }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });
  }

  it('shows loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(<SharingControlsPage />);
    expect(screen.getByText('Loading sharing preferences...')).toBeInTheDocument();
  });

  it('displays all insight category toggles (Requirement 3.1)', async () => {
    setupFetchWithPreferences();

    render(<SharingControlsPage />);

    await waitFor(() => {
      expect(screen.getByText('Insight Categories')).toBeInTheDocument();
    });

    expect(screen.getByText('Emotional Tendencies')).toBeInTheDocument();
    expect(screen.getByText('Behavioral Patterns')).toBeInTheDocument();
    expect(screen.getByText('Energy Levels')).toBeInTheDocument();
    expect(screen.getByText('Communication Guidance')).toBeInTheDocument();
  });

  it('displays all notification type toggles (Requirement 3.3)', async () => {
    setupFetchWithPreferences();

    render(<SharingControlsPage />);

    await waitFor(() => {
      expect(screen.getByText('Notification Types')).toBeInTheDocument();
    });

    expect(screen.getByText('Daily Summaries')).toBeInTheDocument();
    expect(screen.getByText('Phase Alerts')).toBeInTheDocument();
    expect(screen.getByText('Partner Reminders')).toBeInTheDocument();
  });

  it('all categories enabled by default on partner linking (Requirement 3.1)', async () => {
    setupFetchWithPreferences();

    render(<SharingControlsPage />);

    await waitFor(() => {
      expect(screen.getByText('Insight Categories')).toBeInTheDocument();
    });

    const emotionalSwitch = screen.getByRole('switch', { name: /toggle emotional tendencies/i });
    const behavioralSwitch = screen.getByRole('switch', { name: /toggle behavioral patterns/i });
    const energySwitch = screen.getByRole('switch', { name: /toggle energy levels/i });
    const communicationSwitch = screen.getByRole('switch', {
      name: /toggle communication guidance/i,
    });

    expect(emotionalSwitch).toHaveAttribute('data-state', 'checked');
    expect(behavioralSwitch).toHaveAttribute('data-state', 'checked');
    expect(energySwitch).toHaveAttribute('data-state', 'checked');
    expect(communicationSwitch).toHaveAttribute('data-state', 'checked');
  });

  it('all notifications enabled by default on partner linking (Requirement 3.3)', async () => {
    setupFetchWithPreferences();

    render(<SharingControlsPage />);

    await waitFor(() => {
      expect(screen.getByText('Notification Types')).toBeInTheDocument();
    });

    const dailySwitch = screen.getByRole('switch', { name: /toggle daily summaries/i });
    const phaseSwitch = screen.getByRole('switch', { name: /toggle phase alerts/i });
    const reminderSwitch = screen.getByRole('switch', { name: /toggle partner reminders/i });

    expect(dailySwitch).toHaveAttribute('data-state', 'checked');
    expect(phaseSwitch).toHaveAttribute('data-state', 'checked');
    expect(reminderSwitch).toHaveAttribute('data-state', 'checked');
  });

  it('calls PUT /api/sharing/categories when toggling a category (Requirement 3.1, 3.4)', async () => {
    setupFetchWithPreferences();

    render(<SharingControlsPage />);

    await waitFor(() => {
      expect(screen.getByText('Insight Categories')).toBeInTheDocument();
    });

    const emotionalSwitch = screen.getByRole('switch', { name: /toggle emotional tendencies/i });
    fireEvent.click(emotionalSwitch);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sharing/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emotional_tendencies: false }),
      });
    });
  });

  it('calls PUT /api/sharing/notifications when toggling a notification (Requirement 3.3, 3.4)', async () => {
    setupFetchWithPreferences();

    render(<SharingControlsPage />);

    await waitFor(() => {
      expect(screen.getByText('Notification Types')).toBeInTheDocument();
    });

    const dailySwitch = screen.getByRole('switch', { name: /toggle daily summaries/i });
    fireEvent.click(dailySwitch);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sharing/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daily_summaries: false }),
      });
    });
  });

  it('shows warning when all categories are disabled (Requirement 3.5)', async () => {
    const allDisabledPreferences = {
      preferences: {
        emotional_tendencies: false,
        behavioral_patterns: false,
        energy_levels: false,
        communication_guidance: false,
        daily_summaries: true,
        phase_alerts: true,
        partner_reminders: true,
      },
    };

    setupFetchWithPreferences(allDisabledPreferences);

    render(<SharingControlsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('all-categories-disabled-warning')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/no shared content is currently available/i),
    ).toBeInTheDocument();
  });

  it('does not show warning when at least one category is enabled', async () => {
    setupFetchWithPreferences();

    render(<SharingControlsPage />);

    await waitFor(() => {
      expect(screen.getByText('Insight Categories')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('all-categories-disabled-warning')).not.toBeInTheDocument();
  });

  it('shows success status after toggling a category', async () => {
    setupFetchWithPreferences();

    render(<SharingControlsPage />);

    await waitFor(() => {
      expect(screen.getByText('Insight Categories')).toBeInTheDocument();
    });

    const energySwitch = screen.getByRole('switch', { name: /toggle energy levels/i });
    fireEvent.click(energySwitch);

    await waitFor(() => {
      expect(screen.getByTestId('category-status')).toHaveTextContent(
        'Sharing preference updated.',
      );
    });
  });

  it('shows success status after toggling a notification', async () => {
    setupFetchWithPreferences();

    render(<SharingControlsPage />);

    await waitFor(() => {
      expect(screen.getByText('Notification Types')).toBeInTheDocument();
    });

    const phaseSwitch = screen.getByRole('switch', { name: /toggle phase alerts/i });
    fireEvent.click(phaseSwitch);

    await waitFor(() => {
      expect(screen.getByTestId('notification-status')).toHaveTextContent(
        'Notification preference updated.',
      );
    });
  });

  it('reverts category toggle and shows error on API failure (Requirement 3.2)', async () => {
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/sharing/categories') && (!options || options.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockPreferences,
        });
      }
      if (url.includes('/api/sharing/categories') && options?.method === 'PUT') {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ message: 'Failed to update sharing preference.' }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    render(<SharingControlsPage />);

    await waitFor(() => {
      expect(screen.getByText('Insight Categories')).toBeInTheDocument();
    });

    const emotionalSwitch = screen.getByRole('switch', { name: /toggle emotional tendencies/i });
    expect(emotionalSwitch).toHaveAttribute('data-state', 'checked');

    fireEvent.click(emotionalSwitch);

    // Should revert back to checked after failure
    await waitFor(() => {
      expect(emotionalSwitch).toHaveAttribute('data-state', 'checked');
    });

    expect(screen.getByTestId('sharing-error')).toHaveTextContent(
      'Failed to update sharing preference.',
    );
  });

  it('reverts notification toggle and shows error on API failure', async () => {
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/sharing/categories') && (!options || options.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockPreferences,
        });
      }
      if (url.includes('/api/sharing/notifications') && options?.method === 'PUT') {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ message: 'Failed to update notification preference.' }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    render(<SharingControlsPage />);

    await waitFor(() => {
      expect(screen.getByText('Notification Types')).toBeInTheDocument();
    });

    const dailySwitch = screen.getByRole('switch', { name: /toggle daily summaries/i });
    expect(dailySwitch).toHaveAttribute('data-state', 'checked');

    fireEvent.click(dailySwitch);

    // Should revert back to checked after failure
    await waitFor(() => {
      expect(dailySwitch).toHaveAttribute('data-state', 'checked');
    });

    expect(screen.getByTestId('sharing-error')).toHaveTextContent(
      'Failed to update notification preference.',
    );
  });

  it('displays page heading and description', async () => {
    setupFetchWithPreferences();

    render(<SharingControlsPage />);

    await waitFor(() => {
      expect(screen.getByText('Sharing Controls')).toBeInTheDocument();
    });

    expect(screen.getByText(/changes apply within 5 seconds/i)).toBeInTheDocument();
  });

  it('loads preferences from API on mount', async () => {
    const customPreferences = {
      preferences: {
        emotional_tendencies: true,
        behavioral_patterns: false,
        energy_levels: true,
        communication_guidance: false,
        daily_summaries: false,
        phase_alerts: true,
        partner_reminders: false,
      },
    };

    setupFetchWithPreferences(customPreferences);

    render(<SharingControlsPage />);

    await waitFor(() => {
      expect(screen.getByText('Insight Categories')).toBeInTheDocument();
    });

    const emotionalSwitch = screen.getByRole('switch', { name: /toggle emotional tendencies/i });
    const behavioralSwitch = screen.getByRole('switch', { name: /toggle behavioral patterns/i });
    const energySwitch = screen.getByRole('switch', { name: /toggle energy levels/i });
    const communicationSwitch = screen.getByRole('switch', {
      name: /toggle communication guidance/i,
    });
    const dailySwitch = screen.getByRole('switch', { name: /toggle daily summaries/i });
    const phaseSwitch = screen.getByRole('switch', { name: /toggle phase alerts/i });
    const reminderSwitch = screen.getByRole('switch', { name: /toggle partner reminders/i });

    expect(emotionalSwitch).toHaveAttribute('data-state', 'checked');
    expect(behavioralSwitch).toHaveAttribute('data-state', 'unchecked');
    expect(energySwitch).toHaveAttribute('data-state', 'checked');
    expect(communicationSwitch).toHaveAttribute('data-state', 'unchecked');
    expect(dailySwitch).toHaveAttribute('data-state', 'unchecked');
    expect(phaseSwitch).toHaveAttribute('data-state', 'checked');
    expect(reminderSwitch).toHaveAttribute('data-state', 'unchecked');
  });
});
