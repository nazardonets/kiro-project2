import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/navigation
const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams('token=valid-token-123');

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

import AcceptInvitePage from './page';

describe('AcceptInvitePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    mockSearchParams = new URLSearchParams('token=valid-token-123');
  });

  it('renders the invite acceptance form when token is present', () => {
    render(<AcceptInvitePage />);
    expect(screen.getByRole('heading', { name: /accept invitation/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create partner account/i })).toBeInTheDocument();
  });

  it('shows invalid state when no token is provided', () => {
    mockSearchParams = new URLSearchParams('');
    render(<AcceptInvitePage />);
    expect(screen.getByRole('heading', { name: /invalid invitation/i })).toBeInTheDocument();
    expect(screen.getByText(/not valid/i)).toBeInTheDocument();
  });

  it('shows email validation error on blur with empty email', () => {
    render(<AcceptInvitePage />);
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.blur(emailInput);
    expect(screen.getByText('Email is required')).toBeInTheDocument();
  });

  it('shows password validation errors for weak password', () => {
    render(<AcceptInvitePage />);
    const passwordInput = screen.getByLabelText(/password/i);
    fireEvent.change(passwordInput, { target: { value: 'weak' } });
    fireEvent.blur(passwordInput);
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/at least one uppercase letter/i)).toBeInTheDocument();
    expect(screen.getByText(/at least one digit/i)).toBeInTheDocument();
  });

  it('does not submit form with validation errors', async () => {
    render(<AcceptInvitePage />);
    const submitButton = screen.getByRole('button', { name: /create partner account/i });
    fireEvent.click(submitButton);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('submits form and redirects on success', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Partner account created successfully', user: { id: '2' } }),
    });

    render(<AcceptInvitePage />);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create partner account/i });

    fireEvent.change(emailInput, { target: { value: 'partner@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'ValidPass1' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'valid-token-123',
          email: 'partner@example.com',
          password: 'ValidPass1',
        }),
      });
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/partner');
    });
  });

  it('shows expired invite state when API returns INVITE_EXPIRED', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ code: 'INVITE_EXPIRED', message: 'Invite has expired' }),
    });

    render(<AcceptInvitePage />);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create partner account/i });

    fireEvent.change(emailInput, { target: { value: 'partner@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'ValidPass1' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /invitation expired/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/ask your partner to generate a new invitation/i)).toBeInTheDocument();
  });

  it('shows already used state when API returns INVITE_ALREADY_USED', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ code: 'INVITE_ALREADY_USED', message: 'Invite already used' }),
    });

    render(<AcceptInvitePage />);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create partner account/i });

    fireEvent.change(emailInput, { target: { value: 'partner@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'ValidPass1' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /invitation already used/i })).toBeInTheDocument();
    });
  });

  it('shows email in use error from API', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ code: 'EMAIL_IN_USE', message: 'Email already in use' }),
    });

    render(<AcceptInvitePage />);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create partner account/i });

    fireEvent.change(emailInput, { target: { value: 'taken@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'ValidPass1' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('This email is already in use')).toBeInTheDocument();
    });
  });

  it('has a link to the login page', () => {
    render(<AcceptInvitePage />);
    const loginLink = screen.getByRole('link', { name: /log in/i });
    expect(loginLink).toHaveAttribute('href', '/auth/login');
  });
});
