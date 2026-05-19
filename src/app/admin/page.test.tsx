import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import AdminUsersPage from './page';

// ─── Mock Data ──────────────────────────────────────────────────────────────

const mockSearchResults = {
  data: [
    {
      id: 'user-1',
      email: 'alice@example.com',
      role: 'primary',
      status: 'active',
      suspension_reason: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-15T00:00:00Z',
      partner_link: {
        status: 'active',
        partner_user_id: 'partner-1',
        linked_at: '2024-01-05T00:00:00Z',
      },
    },
    {
      id: 'user-2',
      email: 'bob@example.com',
      role: 'partner',
      status: 'suspended',
      suspension_reason: 'Violated terms of service',
      created_at: '2024-02-01T00:00:00Z',
      updated_at: '2024-02-10T00:00:00Z',
      partner_link: null,
    },
  ],
  count: 2,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AdminUsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('renders the search form (Requirement 5.2)', () => {
    render(<AdminUsersPage />);

    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByText('Search Users')).toBeInTheDocument();
    expect(screen.getByTestId('admin-user-search-input')).toBeInTheDocument();
    expect(screen.getByTestId('admin-user-search-button')).toBeInTheDocument();
  });

  it('shows error when searching with empty query', async () => {
    render(<AdminUsersPage />);

    fireEvent.click(screen.getByTestId('admin-user-search-button'));

    await waitFor(() => {
      expect(
        screen.getByText('Please enter an email address or account ID to search.'),
      ).toBeInTheDocument();
    });
  });

  it('displays search results after successful search (Requirement 5.2)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSearchResults,
    });

    render(<AdminUsersPage />);

    const input = screen.getByTestId('admin-user-search-input');
    fireEvent.change(input, { target: { value: 'alice' } });
    fireEvent.click(screen.getByTestId('admin-user-search-button'));

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    expect(screen.getByText('Results (2)')).toBeInTheDocument();
  });

  it('shows no results message when search returns empty', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [], count: 0 }),
    });

    render(<AdminUsersPage />);

    const input = screen.getByTestId('admin-user-search-input');
    fireEvent.change(input, { target: { value: 'nonexistent@example.com' } });
    fireEvent.click(screen.getByTestId('admin-user-search-button'));

    await waitFor(() => {
      expect(screen.getByText('No users found matching your query.')).toBeInTheDocument();
    });
  });

  it('displays account details when a user is selected (Requirement 5.3)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSearchResults,
    });

    render(<AdminUsersPage />);

    const input = screen.getByTestId('admin-user-search-input');
    fireEvent.change(input, { target: { value: 'alice' } });
    fireEvent.click(screen.getByTestId('admin-user-search-button'));

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    // Click on the first user
    fireEvent.click(screen.getByTestId('admin-user-row-user-1'));

    await waitFor(() => {
      expect(screen.getByTestId('admin-user-details')).toBeInTheDocument();
    });

    // Verify account details are shown
    expect(screen.getByText('Account Details')).toBeInTheDocument();
    expect(screen.getByText('user-1')).toBeInTheDocument();
    expect(screen.getByText('primary')).toBeInTheDocument();
    expect(screen.getByText('partner-1')).toBeInTheDocument();
  });

  it('shows suspend button for active accounts (Requirement 5.4)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSearchResults,
    });

    render(<AdminUsersPage />);

    const input = screen.getByTestId('admin-user-search-input');
    fireEvent.change(input, { target: { value: 'alice' } });
    fireEvent.click(screen.getByTestId('admin-user-search-button'));

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('admin-user-row-user-1'));

    await waitFor(() => {
      expect(screen.getByTestId('admin-suspend-button')).toBeInTheDocument();
    });
  });

  it('opens suspend dialog and requires reason (Requirement 5.4)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSearchResults,
    });

    render(<AdminUsersPage />);

    const input = screen.getByTestId('admin-user-search-input');
    fireEvent.change(input, { target: { value: 'alice' } });
    fireEvent.click(screen.getByTestId('admin-user-search-button'));

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('admin-user-row-user-1'));

    await waitFor(() => {
      expect(screen.getByTestId('admin-suspend-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('admin-suspend-button'));

    await waitFor(() => {
      expect(screen.getByTestId('admin-suspend-confirm-button')).toBeInTheDocument();
    });

    // Confirm button should be disabled when reason is empty
    expect(screen.getByTestId('admin-suspend-confirm-button')).toBeDisabled();

    // Enter a reason
    const reasonInput = screen.getByTestId('admin-suspend-reason-input');
    fireEvent.change(reasonInput, { target: { value: 'Violated community guidelines' } });

    // Confirm button should now be enabled
    expect(screen.getByTestId('admin-suspend-confirm-button')).not.toBeDisabled();
  });

  it('opens delete confirmation dialog (Requirement 5.5)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSearchResults,
    });

    render(<AdminUsersPage />);

    const input = screen.getByTestId('admin-user-search-input');
    fireEvent.change(input, { target: { value: 'alice' } });
    fireEvent.click(screen.getByTestId('admin-user-search-button'));

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('admin-user-row-user-1'));

    await waitFor(() => {
      expect(screen.getByTestId('admin-delete-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('admin-delete-button'));

    await waitFor(() => {
      expect(screen.getByTestId('admin-delete-confirm-button')).toBeInTheDocument();
    });

    expect(screen.getByText(/this action is permanent and cannot be undone/i)).toBeInTheDocument();
  });

  it('shows link partner button when no partner is linked (Requirement 5.6)', async () => {
    const noPartnerResults = {
      data: [
        {
          id: 'user-3',
          email: 'carol@example.com',
          role: 'primary',
          status: 'active',
          suspension_reason: null,
          created_at: '2024-03-01T00:00:00Z',
          updated_at: '2024-03-01T00:00:00Z',
          partner_link: null,
        },
      ],
      count: 1,
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => noPartnerResults,
    });

    render(<AdminUsersPage />);

    const input = screen.getByTestId('admin-user-search-input');
    fireEvent.change(input, { target: { value: 'carol' } });
    fireEvent.click(screen.getByTestId('admin-user-search-button'));

    await waitFor(() => {
      expect(screen.getByText('carol@example.com')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('admin-user-row-user-3'));

    await waitFor(() => {
      expect(screen.getByTestId('admin-link-button')).toBeInTheDocument();
    });

    expect(screen.getByText('No active partner link')).toBeInTheDocument();
  });

  it('shows unlink partner button when partner is linked (Requirement 5.6)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSearchResults,
    });

    render(<AdminUsersPage />);

    const input = screen.getByTestId('admin-user-search-input');
    fireEvent.change(input, { target: { value: 'alice' } });
    fireEvent.click(screen.getByTestId('admin-user-search-button'));

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('admin-user-row-user-1'));

    await waitFor(() => {
      expect(screen.getByTestId('admin-unlink-button')).toBeInTheDocument();
    });
  });

  it('handles search API error gracefully', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Internal server error' }),
    });

    render(<AdminUsersPage />);

    const input = screen.getByTestId('admin-user-search-input');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.click(screen.getByTestId('admin-user-search-button'));

    await waitFor(() => {
      expect(screen.getByText('Internal server error')).toBeInTheDocument();
    });
  });

  it('indicates max limit reached when 50 results returned', async () => {
    const fiftyResults = {
      data: Array.from({ length: 50 }, (_, i) => ({
        id: `user-${i}`,
        email: `user${i}@example.com`,
        role: 'primary',
        status: 'active',
        suspension_reason: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        partner_link: null,
      })),
      count: 50,
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => fiftyResults,
    });

    render(<AdminUsersPage />);

    const input = screen.getByTestId('admin-user-search-input');
    fireEvent.change(input, { target: { value: 'user' } });
    fireEvent.click(screen.getByTestId('admin-user-search-button'));

    await waitFor(() => {
      expect(screen.getByText(/50 — max limit reached/)).toBeInTheDocument();
    });
  });
});
