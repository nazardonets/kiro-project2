import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BackLink } from './back-link';

describe('BackLink', () => {
  it('renders a link with the correct href', () => {
    render(<BackLink href="/admin" label="Back to Users" />);
    const link = screen.getByRole('link', { name: /navigate back to back to users/i });
    expect(link).toHaveAttribute('href', '/admin');
  });

  it('renders the label text', () => {
    render(<BackLink href="/admin" label="Back to Users" />);
    expect(screen.getByText('Back to Users')).toBeInTheDocument();
  });

  it('renders a left arrow icon that is hidden from assistive technology', () => {
    render(<BackLink href="/admin" label="Back to Users" />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('has an accessible aria-label describing the navigation', () => {
    render(<BackLink href="/dashboard" label="Dashboard" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('aria-label', 'Navigate back to Dashboard');
  });

  it('applies additional className when provided', () => {
    render(<BackLink href="/admin" label="Back" className="mt-4" />);
    const link = screen.getByRole('link');
    expect(link.className).toContain('mt-4');
  });
});
