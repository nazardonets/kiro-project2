import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import DateRequestPage from './page';

const mockFetch = vi.fn();

describe('DateRequestPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  it('renders the page heading and description', () => {
    render(<DateRequestPage />);

    expect(screen.getByText('Request a Date')).toBeInTheDocument();
    expect(
      screen.getByText(/send a date request to your partner/i),
    ).toBeInTheDocument();
  });

  it('displays location presets (Requirement 11.2)', () => {
    render(<DateRequestPage />);

    expect(screen.getByTestId('location-preset-restaurant')).toBeInTheDocument();
    expect(screen.getByTestId('location-preset-outdoor-activity')).toBeInTheDocument();
    expect(screen.getByTestId('location-preset-home-setting')).toBeInTheDocument();
  });

  it('displays mood presets (Requirement 11.3)', () => {
    render(<DateRequestPage />);

    expect(screen.getByTestId('mood-preset-relaxed-evening')).toBeInTheDocument();
    expect(screen.getByTestId('mood-preset-romantic')).toBeInTheDocument();
    expect(screen.getByTestId('mood-preset-fun')).toBeInTheDocument();
    expect(screen.getByTestId('mood-preset-low-energy')).toBeInTheDocument();
  });

  it('allows selecting a location preset', () => {
    render(<DateRequestPage />);

    const restaurantBtn = screen.getByTestId('location-preset-restaurant');
    fireEvent.click(restaurantBtn);

    const input = screen.getByPlaceholderText(/or type a custom location/i);
    expect(input).toHaveValue('Restaurant');
  });

  it('allows typing a custom location', () => {
    render(<DateRequestPage />);

    const input = screen.getByPlaceholderText(/or type a custom location/i);
    fireEvent.change(input, { target: { value: 'My favorite cafe' } });

    expect(input).toHaveValue('My favorite cafe');
  });

  it('allows selecting a mood preset', () => {
    render(<DateRequestPage />);

    const romanticBtn = screen.getByTestId('mood-preset-romantic');
    fireEvent.click(romanticBtn);

    const input = screen.getByPlaceholderText(/or describe your ideal vibe/i);
    expect(input).toHaveValue('Romantic');
  });

  it('allows typing custom mood', () => {
    render(<DateRequestPage />);

    const input = screen.getByPlaceholderText(/or describe your ideal vibe/i);
    fireEvent.change(input, { target: { value: 'Cozy and quiet' } });

    expect(input).toHaveValue('Cozy and quiet');
  });

  it('displays timing mode options (Requirement 11.4)', () => {
    render(<DateRequestPage />);

    expect(screen.getByTestId('timing-none')).toBeInTheDocument();
    expect(screen.getByTestId('timing-specific')).toBeInTheDocument();
    expect(screen.getByTestId('timing-window')).toBeInTheDocument();
  });

  it('shows specific date picker when "Specific date" is selected', () => {
    render(<DateRequestPage />);

    fireEvent.click(screen.getByTestId('timing-specific'));

    expect(screen.getByTestId('preferred-date-trigger')).toBeInTheDocument();
  });

  it('shows window date pickers when "Flexible window" is selected', () => {
    render(<DateRequestPage />);

    fireEvent.click(screen.getByTestId('timing-window'));

    expect(screen.getByTestId('window-start-trigger')).toBeInTheDocument();
    expect(screen.getByTestId('window-end-trigger')).toBeInTheDocument();
  });

  it('allows typing personal notes (Requirement 11.5)', () => {
    render(<DateRequestPage />);

    const textarea = screen.getByPlaceholderText(/share what's on your mind/i);
    fireEvent.change(textarea, { target: { value: 'I miss spending time together' } });

    expect(textarea).toHaveValue('I miss spending time together');
  });

  it('shows character count for personal notes', () => {
    render(<DateRequestPage />);

    expect(screen.getByText('0/500')).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/share what's on your mind/i);
    fireEvent.change(textarea, { target: { value: 'Hello' } });

    expect(screen.getByText('5/500')).toBeInTheDocument();
  });

  it('shows character count for location', () => {
    render(<DateRequestPage />);

    const input = screen.getByPlaceholderText(/or type a custom location/i);
    fireEvent.change(input, { target: { value: 'Park' } });

    expect(screen.getByText('4/200')).toBeInTheDocument();
  });

  it('shows character count for mood', () => {
    render(<DateRequestPage />);

    const input = screen.getByPlaceholderText(/or describe your ideal vibe/i);
    fireEvent.change(input, { target: { value: 'Chill' } });

    expect(screen.getByText('5/200')).toBeInTheDocument();
  });

  it('submits the form and shows success (Requirement 11.6)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        message: 'Date request sent successfully',
        data: { id: '123', status: 'sent' },
      }),
    });

    render(<DateRequestPage />);

    // Fill in some fields
    const locationInput = screen.getByPlaceholderText(/or type a custom location/i);
    fireEvent.change(locationInput, { target: { value: 'Italian restaurant' } });

    const moodInput = screen.getByPlaceholderText(/or describe your ideal vibe/i);
    fireEvent.change(moodInput, { target: { value: 'Romantic' } });

    // Submit
    fireEvent.click(screen.getByTestId('submit-date-request'));

    await waitFor(() => {
      expect(screen.getByText('Date Request Sent!')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/date-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'Italian restaurant',
        mood: 'Romantic',
        preferred_date: null,
        window_start: null,
        window_end: null,
        personal_notes: null,
      }),
    });
  });

  it('shows "Sending..." while submitting', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<DateRequestPage />);

    fireEvent.click(screen.getByTestId('submit-date-request'));

    expect(screen.getByText('Sending...')).toBeInTheDocument();
    expect(screen.getByTestId('submit-date-request')).toBeDisabled();
  });

  it('handles no-partner-linked state (Requirement 11.9)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        code: 'NO_PARTNER_LINKED',
        message: 'No partner is currently linked to your account.',
        retainedDetails: { location: 'Park', mood: null },
      }),
    });

    render(<DateRequestPage />);

    const locationInput = screen.getByPlaceholderText(/or type a custom location/i);
    fireEvent.change(locationInput, { target: { value: 'Park' } });

    fireEvent.click(screen.getByTestId('submit-date-request'));

    await waitFor(() => {
      expect(screen.getByTestId('no-partner-message')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/no partner is currently linked/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/your details have been retained/i),
    ).toBeInTheDocument();

    // Form fields should still be visible for resubmission
    expect(locationInput).toHaveValue('Park');
  });

  it('handles sharing-revoked state (Requirement 11.9)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        code: 'SHARING_REVOKED',
        message: 'Sharing permissions have been revoked.',
      }),
    });

    render(<DateRequestPage />);

    fireEvent.click(screen.getByTestId('submit-date-request'));

    await waitFor(() => {
      expect(screen.getByTestId('no-partner-message')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/sharing permissions have been revoked/i),
    ).toBeInTheDocument();
  });

  it('handles email delivery failure with retry (Requirement 11.10)', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({
          code: 'EMAIL_DELIVERY_FAILED',
          message: 'The date request could not be delivered.',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          message: 'Date request sent successfully',
          data: { id: '123', status: 'sent' },
        }),
      });

    render(<DateRequestPage />);

    fireEvent.click(screen.getByTestId('submit-date-request'));

    await waitFor(() => {
      expect(screen.getByTestId('delivery-failed-message')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/could not be delivered/i),
    ).toBeInTheDocument();

    // Retry button should be visible
    const retryButton = screen.getByTestId('retry-button');
    expect(retryButton).toBeInTheDocument();

    // Click retry
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Date Request Sent!')).toBeInTheDocument();
    });
  });

  it('handles validation errors from the API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        code: 'VALIDATION_ERROR',
        fields: {
          location: { message: 'Location must be at most 200 characters', constraint: 'max_length' },
        },
      }),
    });

    render(<DateRequestPage />);

    fireEvent.click(screen.getByTestId('submit-date-request'));

    await waitFor(() => {
      expect(
        screen.getByText('Location must be at most 200 characters'),
      ).toBeInTheDocument();
    });
  });

  it('handles network errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<DateRequestPage />);

    fireEvent.click(screen.getByTestId('submit-date-request'));

    await waitFor(() => {
      expect(screen.getByTestId('generic-error')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/network error/i),
    ).toBeInTheDocument();
  });

  it('has a cancel link back to dashboard', () => {
    render(<DateRequestPage />);

    const cancelLink = screen.getByText('Cancel').closest('a');
    expect(cancelLink).toHaveAttribute('href', '/dashboard');
  });

  it('shows "Back to Dashboard" link after successful submission', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        message: 'Date request sent successfully',
        data: { id: '123', status: 'sent' },
      }),
    });

    render(<DateRequestPage />);

    fireEvent.click(screen.getByTestId('submit-date-request'));

    await waitFor(() => {
      expect(screen.getByText('Date Request Sent!')).toBeInTheDocument();
    });

    const backLink = screen.getByText('Back to Dashboard').closest('a');
    expect(backLink).toHaveAttribute('href', '/dashboard');
  });

  it('submits with all empty optional fields as null', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        message: 'Date request sent successfully',
        data: { id: '123', status: 'sent' },
      }),
    });

    render(<DateRequestPage />);

    fireEvent.click(screen.getByTestId('submit-date-request'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/date-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: null,
          mood: null,
          preferred_date: null,
          window_start: null,
          window_end: null,
          personal_notes: null,
        }),
      });
    });
  });
});
