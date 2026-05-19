import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { NavigationErrorBoundary } from './navigation-error-boundary';

// ─── Helper: A component that throws on render ──────────────────────────────

function ThrowingChild({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('ResponsiveLayout render failure');
  }
  return <div data-testid="child-content">Navigation content</div>;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('NavigationErrorBoundary (Requirement 5.5)', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Suppress React's console.error for caught errors in error boundaries
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children normally when no error is thrown', () => {
    render(
      <NavigationErrorBoundary homeHref="/dashboard">
        <ThrowingChild shouldThrow={false} />
      </NavigationErrorBoundary>,
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.queryByText('Return to home')).not.toBeInTheDocument();
  });

  it('renders fallback link within 3 seconds when child throws', () => {
    const startTime = performance.now();

    render(
      <NavigationErrorBoundary homeHref="/dashboard">
        <ThrowingChild />
      </NavigationErrorBoundary>,
    );

    const endTime = performance.now();

    // Fallback should be rendered
    const fallbackLink = screen.getByRole('link', { name: 'Return to home' });
    expect(fallbackLink).toBeInTheDocument();

    // Verify it rendered within 3 seconds
    expect(endTime - startTime).toBeLessThan(3000);
  });

  it('fallback link points to the correct home page for dashboard', () => {
    render(
      <NavigationErrorBoundary homeHref="/dashboard">
        <ThrowingChild />
      </NavigationErrorBoundary>,
    );

    const fallbackLink = screen.getByRole('link', { name: 'Return to home' });
    expect(fallbackLink).toHaveAttribute('href', '/dashboard');
  });

  it('fallback link points to the correct home page for partner', () => {
    render(
      <NavigationErrorBoundary homeHref="/partner">
        <ThrowingChild />
      </NavigationErrorBoundary>,
    );

    const fallbackLink = screen.getByRole('link', { name: 'Return to home' });
    expect(fallbackLink).toHaveAttribute('href', '/partner');
  });

  it('fallback link points to the correct home page for admin', () => {
    render(
      <NavigationErrorBoundary homeHref="/admin">
        <ThrowingChild />
      </NavigationErrorBoundary>,
    );

    const fallbackLink = screen.getByRole('link', { name: 'Return to home' });
    expect(fallbackLink).toHaveAttribute('href', '/admin');
  });

  it('fallback renders within a navigation landmark with aria-label', () => {
    render(
      <NavigationErrorBoundary homeHref="/dashboard">
        <ThrowingChild />
      </NavigationErrorBoundary>,
    );

    const nav = screen.getByRole('navigation', { name: 'Fallback navigation' });
    expect(nav).toBeInTheDocument();
    expect(nav).toContainElement(screen.getByRole('link', { name: 'Return to home' }));
  });
});
