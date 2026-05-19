import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import DashboardLayout from './layout';

// ─── Mock next/navigation ───────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('DashboardLayout', () => {
  it('renders ResponsiveLayout with all 5 primary nav items (Requirement 4.1)', () => {
    render(
      <DashboardLayout>
        <div>Page content</div>
      </DashboardLayout>,
    );

    // Query within the desktop "Main navigation" nav landmark
    const desktopNav = screen.getByRole('navigation', { name: 'Main navigation' });

    expect(within(desktopNav).getByText('Dashboard')).toBeInTheDocument();
    expect(within(desktopNav).getByText('Cycle')).toBeInTheDocument();
    expect(within(desktopNav).getByText('Sharing')).toBeInTheDocument();
    expect(within(desktopNav).getByText('Customize')).toBeInTheDocument();
    expect(within(desktopNav).getByText('Date Request')).toBeInTheDocument();

    // Verify exactly 5 nav links in the desktop navigation
    const navLinks = within(desktopNav).getAllByRole('link');
    expect(navLinks).toHaveLength(5);
  });

  it('renders children inside the main content area (Requirement 4.5)', () => {
    render(
      <DashboardLayout>
        <div data-testid="child-content">Dashboard child page</div>
      </DashboardLayout>,
    );

    const mainContent = screen.getByRole('main');
    const childContent = screen.getByTestId('child-content');

    expect(mainContent).toContainElement(childContent);
  });
});
