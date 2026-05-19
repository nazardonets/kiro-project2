import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import PartnerLayout from './layout';

// ─── Mock next/navigation ───────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  usePathname: () => '/partner',
}));

// ─── Tests: Partner Layout (Requirements 4.2, 4.5) ─────────────────────────

describe('Partner Layout', () => {
  it('renders ResponsiveLayout with 2 partner nav items (Insights, Settings)', () => {
    render(
      <PartnerLayout>
        <p>Partner content</p>
      </PartnerLayout>,
    );

    // The desktop navigation should contain exactly the 2 partner nav items
    const desktopNav = screen.getByLabelText('Main navigation');
    const insightsLink = desktopNav.querySelector('a[href="/partner"]');
    const settingsLink = desktopNav.querySelector('a[href="/partner/settings"]');

    expect(insightsLink).toBeInTheDocument();
    expect(insightsLink).toHaveTextContent('Insights');
    expect(settingsLink).toBeInTheDocument();
    expect(settingsLink).toHaveTextContent('Settings');

    // Verify exactly 2 nav items in the desktop nav
    const navLinks = desktopNav.querySelectorAll('a[href]');
    expect(navLinks).toHaveLength(2);
  });

  it('renders children inside the main content area', () => {
    render(
      <PartnerLayout>
        <p data-testid="child-content">Partner child content</p>
      </PartnerLayout>,
    );

    // Children should be rendered inside the main content area
    const mainContent = screen.getByRole('main');
    const childContent = screen.getByTestId('child-content');

    expect(mainContent).toContainElement(childContent);
    expect(childContent).toHaveTextContent('Partner child content');
  });
});
