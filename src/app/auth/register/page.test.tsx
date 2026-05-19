import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import RegisterPage from './page';

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('renders the registration form', () => {
    render(<RegisterPage />);
    expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('shows email validation error on blur with empty email', () => {
    render(<RegisterPage />);
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.blur(emailInput);
    expect(screen.getByText('Email is required')).toBeInTheDocument();
  });

  it('shows email format error for invalid email', () => {
    render(<RegisterPage />);
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'notanemail' } });
    fireEvent.blur(emailInput);
    expect(screen.getByText('Invalid email address')).toBeInTheDocument();
  });

  it('shows password validation errors on blur with weak password', () => {
    render(<RegisterPage />);
    const passwordInput = screen.getByLabelText(/password/i);
    fireEvent.change(passwordInput, { target: { value: 'short' } });
    fireEvent.blur(passwordInput);
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/at least one uppercase letter/i)).toBeInTheDocument();
    expect(screen.getByText(/at least one digit/i)).toBeInTheDocument();
  });

  it('shows only missing requirements for password', () => {
    render(<RegisterPage />);
    const passwordInput = screen.getByLabelText(/password/i);
    fireEvent.change(passwordInput, { target: { value: 'longpassword' } });
    fireEvent.blur(passwordInput);
    // Has lowercase and length, but missing uppercase and digit
    expect(screen.queryByText(/at least 8 characters/i)).not.toBeInTheDocument();
    expect(screen.getByText(/at least one uppercase letter/i)).toBeInTheDocument();
    expect(screen.getByText(/at least one digit/i)).toBeInTheDocument();
  });

  it('does not submit form with validation errors', async () => {
    render(<RegisterPage />);
    const submitButton = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(submitButton);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('submits form and redirects on success', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Account created successfully', user: { id: '1' } }),
    });

    render(<RegisterPage />);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'ValidPass1' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'ValidPass1' }),
      });
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/onboarding');
    });
  });

  it('shows email in use error from API', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ code: 'EMAIL_IN_USE', message: 'Email already in use' }),
    });

    render(<RegisterPage />);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(emailInput, { target: { value: 'taken@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'ValidPass1' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('This email is already in use')).toBeInTheDocument();
    });
  });

  it('has a link to the login page', () => {
    render(<RegisterPage />);
    const loginLink = screen.getByRole('link', { name: /log in/i });
    expect(loginLink).toHaveAttribute('href', '/auth/login');
  });
});
