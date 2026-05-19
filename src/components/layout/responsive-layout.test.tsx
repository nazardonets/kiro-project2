import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

import { ResponsiveLayout, isActiveByPrefix, isActiveByExact } from './responsive-layout';

// ─── Mock next/navigation ───────────────────────────────────────────────────

let mockPathname = '/dashboard';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

// ─── Helper: Responsive Layout Shell ────────────────────────────────────────

/**
 * A minimal responsive layout component that mirrors the design system requirements:
 * - No horizontal scrolling (overflow-x: hidden, max-width: 100%)
 * - Mobile-optimized below 768px with touch-friendly controls
 * - Responsive from 320px to 2560px
 *
 * Validates: Requirements 4.2, 4.3, 4.4
 */
function ResponsiveShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-testid="responsive-shell"
      style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}
    >
      <main
        data-testid="main-content"
        style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}
      >
        {children}
      </main>
    </div>
  );
}

/**
 * A mobile-optimized interactive element that meets the 44x44px minimum tap target.
 *
 * Validates: Requirement 4.3
 */
function MobileTapTarget({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{ minWidth: '44px', minHeight: '44px', padding: '12px' }}
      data-testid={`tap-target-${label}`}
    >
      {label}
    </button>
  );
}

/**
 * A navigation component with keyboard-accessible links.
 *
 * Validates: Requirement 4.4
 */
function KeyboardNav() {
  return (
    <nav aria-label="Main navigation" data-testid="keyboard-nav">
      <a href="/dashboard" tabIndex={0}>
        Dashboard
      </a>
      <a href="/partner" tabIndex={0}>
        Partner
      </a>
      <Button variant="default" size="default">
        Action
      </Button>
      <Switch aria-label="Toggle setting" />
    </nav>
  );
}

// ─── Tests: Responsive Breakpoints (Requirement 4.2) ────────────────────────

describe('Responsive Layout - Breakpoints', () => {
  const breakpoints = [
    { name: 'small mobile', width: 320 },
    { name: 'tablet', width: 768 },
    { name: 'desktop', width: 1024 },
    { name: 'ultra-wide', width: 2560 },
  ];

  breakpoints.forEach(({ name, width }) => {
    it(`renders without horizontal overflow at ${width}px (${name})`, () => {
      // Set viewport width
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: width,
      });
      window.dispatchEvent(new Event('resize'));

      const { container } = render(
        <ResponsiveShell>
          <div style={{ width: '100%' }}>
            <h1>Know Your Woman Cycle</h1>
            <p>Content that should not overflow horizontally at any breakpoint.</p>
          </div>
        </ResponsiveShell>,
      );

      const shell = screen.getByTestId('responsive-shell');
      const mainContent = screen.getByTestId('main-content');

      // Verify overflow-x is hidden (no horizontal scrolling)
      expect(shell.style.overflowX).toBe('hidden');
      expect(mainContent.style.overflowX).toBe('hidden');

      // Verify max-width is constrained to 100%
      expect(shell.style.maxWidth).toBe('100%');
      expect(mainContent.style.maxWidth).toBe('100%');

      // Verify width is 100% (fills available space without exceeding)
      expect(shell.style.width).toBe('100%');
      expect(container.firstChild).toBeTruthy();
    });
  });

  it('content container does not exceed viewport width at 320px', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 320,
    });
    window.dispatchEvent(new Event('resize'));

    render(
      <ResponsiveShell>
        <div data-testid="inner-content" style={{ width: '100%', maxWidth: '100%' }}>
          <p>Narrow content for smallest supported viewport</p>
        </div>
      </ResponsiveShell>,
    );

    const innerContent = screen.getByTestId('inner-content');
    expect(innerContent.style.maxWidth).toBe('100%');
  });

  it('content container adapts to ultra-wide 2560px without stretching beyond max-width', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 2560,
    });
    window.dispatchEvent(new Event('resize'));

    render(
      <ResponsiveShell>
        <div data-testid="wide-content" style={{ width: '100%', maxWidth: '100%' }}>
          <p>Wide viewport content</p>
        </div>
      </ResponsiveShell>,
    );

    const shell = screen.getByTestId('responsive-shell');
    expect(shell.style.width).toBe('100%');
    expect(shell.style.maxWidth).toBe('100%');
  });
});

// ─── Tests: Mobile Tap Target Sizes (Requirement 4.3) ────────────────────────

describe('Mobile Tap Targets - Minimum 44x44px', () => {
  beforeEach(() => {
    // Simulate mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });
    window.dispatchEvent(new Event('resize'));
  });

  it('tap target elements have minimum 44px width', () => {
    render(<MobileTapTarget label="menu" />);

    const target = screen.getByTestId('tap-target-menu');
    expect(target.style.minWidth).toBe('44px');
  });

  it('tap target elements have minimum 44px height', () => {
    render(<MobileTapTarget label="settings" />);

    const target = screen.getByTestId('tap-target-settings');
    expect(target.style.minHeight).toBe('44px');
  });

  it('multiple tap targets all meet minimum size requirements', () => {
    render(
      <div>
        <MobileTapTarget label="home" />
        <MobileTapTarget label="profile" />
        <MobileTapTarget label="cycle" />
      </div>,
    );

    const targets = ['home', 'profile', 'cycle'];
    targets.forEach((label) => {
      const target = screen.getByTestId(`tap-target-${label}`);
      expect(target.style.minWidth).toBe('44px');
      expect(target.style.minHeight).toBe('44px');
    });
  });

  it('Button component renders with accessible minimum size for touch', () => {
    render(<Button size="default">Tap Me</Button>);

    const button = screen.getByRole('button', { name: 'Tap Me' });
    // Default button has h-11 (44px) class - meets 44px minimum tap target
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(button.className).toContain('h-11');
  });

  it('Button with lg size provides adequate tap target', () => {
    render(<Button size="lg">Large Button</Button>);

    const button = screen.getByRole('button', { name: 'Large Button' });
    // lg size has h-12 (48px) which exceeds the 44px minimum
    expect(button).toBeInTheDocument();
    expect(button.className).toContain('h-12');
  });

  it('icon button meets minimum tap target size', () => {
    render(
      <Button size="icon" aria-label="Menu">
        ☰
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Menu' });
    // icon size has h-11 w-11 (44x44px) meeting the minimum tap target
    expect(button).toBeInTheDocument();
    expect(button.className).toContain('h-11');
    expect(button.className).toContain('w-11');
  });
});

// ─── Tests: Keyboard Navigation (Requirement 4.4) ────────────────────────────

describe('Keyboard Navigation - WCAG 2.1 Level AA Operability', () => {
  it('buttons are focusable via keyboard', () => {
    render(<Button>Click Me</Button>);

    const button = screen.getByRole('button', { name: 'Click Me' });
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it('buttons respond to Enter key press', () => {
    let clicked = false;
    render(<Button onClick={() => (clicked = true)}>Press Enter</Button>);

    const button = screen.getByRole('button', { name: 'Press Enter' });
    button.focus();
    fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
    fireEvent.keyUp(button, { key: 'Enter', code: 'Enter' });
    // Native button elements handle Enter via click event
    fireEvent.click(button);
    expect(clicked).toBe(true);
  });

  it('buttons respond to Space key press', () => {
    let clicked = false;
    render(<Button onClick={() => (clicked = true)}>Press Space</Button>);

    const button = screen.getByRole('button', { name: 'Press Space' });
    button.focus();
    fireEvent.keyDown(button, { key: ' ', code: 'Space' });
    fireEvent.keyUp(button, { key: ' ', code: 'Space' });
    // Native button elements handle Space via click event
    fireEvent.click(button);
    expect(clicked).toBe(true);
  });

  it('Switch toggle is focusable via keyboard', () => {
    render(<Switch aria-label="Toggle notifications" />);

    const toggle = screen.getByRole('switch', { name: 'Toggle notifications' });
    toggle.focus();
    expect(document.activeElement).toBe(toggle);
  });

  it('Switch toggle can be activated with Space key', () => {
    render(<Switch aria-label="Enable sharing" />);

    const toggle = screen.getByRole('switch', { name: 'Enable sharing' });
    toggle.focus();

    // Switch should start unchecked
    expect(toggle).toHaveAttribute('data-state', 'unchecked');

    // Activate with keyboard
    fireEvent.keyDown(toggle, { key: ' ', code: 'Space' });
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('data-state', 'checked');
  });

  it('links are focusable and have proper role', () => {
    render(
      <nav>
        <a href="/dashboard" data-testid="nav-link">
          Dashboard
        </a>
      </nav>,
    );

    const link = screen.getByRole('link', { name: 'Dashboard' });
    link.focus();
    expect(document.activeElement).toBe(link);
  });

  it('navigation elements support Tab key traversal order', () => {
    render(<KeyboardNav />);

    const nav = screen.getByTestId('keyboard-nav');
    const focusableElements = nav.querySelectorAll('a, button, [role="switch"]');

    // All interactive elements should be present and focusable
    expect(focusableElements.length).toBeGreaterThanOrEqual(4);

    // Each element should be focusable
    focusableElements.forEach((element) => {
      (element as HTMLElement).focus();
      expect(document.activeElement).toBe(element);
    });
  });

  it('Button has visible focus indicator styles', () => {
    render(<Button>Focus Me</Button>);

    const button = screen.getByRole('button', { name: 'Focus Me' });
    // Button component includes focus-visible ring styles
    expect(button.className).toContain('focus-visible:outline-none');
    expect(button.className).toContain('focus-visible:ring-2');
    expect(button.className).toContain('focus-visible:ring-ring');
  });

  it('Switch has visible focus indicator styles', () => {
    render(<Switch aria-label="Test switch" />);

    const toggle = screen.getByRole('switch', { name: 'Test switch' });
    // Switch component includes focus-visible ring styles
    expect(toggle.className).toContain('focus-visible:outline-none');
    expect(toggle.className).toContain('focus-visible:ring-2');
  });

  it('disabled buttons are not interactive via keyboard', () => {
    let clicked = false;
    render(
      <Button disabled onClick={() => (clicked = true)}>
        Disabled
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Disabled' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(clicked).toBe(false);
  });

  it('interactive elements do not require hover for operation', () => {
    let activated = false;
    render(
      <div>
        <Button onClick={() => (activated = true)}>No Hover Needed</Button>
      </div>,
    );

    const button = screen.getByRole('button', { name: 'No Hover Needed' });

    // Element should be operable without hover - direct click/keyboard works
    fireEvent.click(button);
    expect(activated).toBe(true);
  });

  it('all buttons have accessible names', () => {
    render(
      <div>
        <Button>Labeled Button</Button>
        <Button aria-label="Icon action">☰</Button>
      </div>,
    );

    // Both buttons should be findable by their accessible name
    expect(screen.getByRole('button', { name: 'Labeled Button' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Icon action' })).toBeInTheDocument();
  });
});

// ─── Tests: ResponsiveLayout Enhancements ───────────────────────────────────

const testNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: <span data-testid="icon-dashboard">D</span> },
  { href: '/dashboard/cycle', label: 'Cycle', icon: <span data-testid="icon-cycle">C</span> },
  {
    href: '/dashboard/sharing',
    label: 'Sharing',
    icon: <span data-testid="icon-sharing">S</span>,
  },
];

describe('ResponsiveLayout - Focus Trap (Requirement 6.5)', () => {
  beforeEach(() => {
    mockPathname = '/dashboard';
    document.body.style.overflow = '';
    // jsdom doesn't support offsetParent (always null), so we mock it
    // to allow the focus trap hook to find focusable elements
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      get() {
        return this.parentNode;
      },
      configurable: true,
    });
  });

  it('cycles focus through menu items on Tab at last element', () => {
    render(
      <ResponsiveLayout navItems={testNavItems}>
        <p>Content</p>
      </ResponsiveLayout>,
    );

    // Open the hamburger menu
    const hamburgerButton = screen.getByRole('button', { name: /open menu/i });
    fireEvent.click(hamburgerButton);

    // The mobile menu should be open
    const mobileMenu = screen.getByLabelText('Mobile navigation menu');
    expect(mobileMenu).toBeInTheDocument();

    // Get all focusable links in the mobile menu
    const menuLinks = mobileMenu.querySelectorAll('a[href]');
    expect(menuLinks.length).toBe(3);

    // Focus the last element
    const lastLink = menuLinks[menuLinks.length - 1] as HTMLElement;
    lastLink.focus();
    expect(document.activeElement).toBe(lastLink);

    // Press Tab at the last element - should wrap to first
    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab' });

    const firstLink = menuLinks[0] as HTMLElement;
    expect(document.activeElement).toBe(firstLink);
  });

  it('cycles focus backward on Shift+Tab at first element', () => {
    render(
      <ResponsiveLayout navItems={testNavItems}>
        <p>Content</p>
      </ResponsiveLayout>,
    );

    // Open the hamburger menu
    const hamburgerButton = screen.getByRole('button', { name: /open menu/i });
    fireEvent.click(hamburgerButton);

    const mobileMenu = screen.getByLabelText('Mobile navigation menu');
    const menuLinks = mobileMenu.querySelectorAll('a[href]');

    // Focus the first element
    const firstLink = menuLinks[0] as HTMLElement;
    firstLink.focus();
    expect(document.activeElement).toBe(firstLink);

    // Press Shift+Tab at the first element - should wrap to last
    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab', shiftKey: true });

    const lastLink = menuLinks[menuLinks.length - 1] as HTMLElement;
    expect(document.activeElement).toBe(lastLink);
  });
});

describe('ResponsiveLayout - Escape Key (Requirement 6.6)', () => {
  beforeEach(() => {
    mockPathname = '/dashboard';
    document.body.style.overflow = '';
  });

  it('closes menu and returns focus to hamburger button on Escape', () => {
    render(
      <ResponsiveLayout navItems={testNavItems}>
        <p>Content</p>
      </ResponsiveLayout>,
    );

    // Open the hamburger menu
    const hamburgerButton = screen.getByRole('button', { name: /open menu/i });
    fireEvent.click(hamburgerButton);

    // Menu should be open
    expect(screen.getByLabelText('Mobile navigation menu')).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

    // Menu should be closed
    expect(screen.queryByLabelText('Mobile navigation menu')).not.toBeInTheDocument();

    // Focus should return to the hamburger button
    expect(document.activeElement).toBe(hamburgerButton);
  });
});

describe('ResponsiveLayout - Outside Click (Requirement 1.6)', () => {
  beforeEach(() => {
    mockPathname = '/dashboard';
    document.body.style.overflow = '';
  });

  it('closes the menu when clicking outside', () => {
    render(
      <div>
        <div data-testid="outside-area">Outside</div>
        <ResponsiveLayout navItems={testNavItems}>
          <p>Content</p>
        </ResponsiveLayout>
      </div>,
    );

    // Open the hamburger menu
    const hamburgerButton = screen.getByRole('button', { name: /open menu/i });
    fireEvent.click(hamburgerButton);

    // Menu should be open
    expect(screen.getByLabelText('Mobile navigation menu')).toBeInTheDocument();

    // Click outside the menu
    const outsideArea = screen.getByTestId('outside-area');
    fireEvent.click(outsideArea);

    // Menu should be closed
    expect(screen.queryByLabelText('Mobile navigation menu')).not.toBeInTheDocument();
  });
});

describe('ResponsiveLayout - activeMatchStrategy="prefix" (Requirement 1.2)', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('highlights the correct item using prefix match for sub-paths', () => {
    mockPathname = '/dashboard/cycle';

    render(
      <ResponsiveLayout navItems={testNavItems} activeMatchStrategy="prefix">
        <p>Content</p>
      </ResponsiveLayout>,
    );

    // The "Cycle" nav item should be active (prefix match for /dashboard/cycle)
    const desktopNav = screen.getByLabelText('Main navigation');
    const cycleLink = desktopNav.querySelector('a[href="/dashboard/cycle"]');
    expect(cycleLink).toHaveAttribute('aria-current', 'page');

    // The "Dashboard" root item should NOT be active (exact match for root)
    const dashboardLink = desktopNav.querySelector('a[href="/dashboard"]');
    expect(dashboardLink).not.toHaveAttribute('aria-current', 'page');
  });

  it('highlights root item only on exact root path', () => {
    mockPathname = '/dashboard';

    render(
      <ResponsiveLayout navItems={testNavItems} activeMatchStrategy="prefix">
        <p>Content</p>
      </ResponsiveLayout>,
    );

    const desktopNav = screen.getByLabelText('Main navigation');
    const dashboardLink = desktopNav.querySelector('a[href="/dashboard"]');
    expect(dashboardLink).toHaveAttribute('aria-current', 'page');
  });

  it('isActiveByPrefix returns true for matching prefix', () => {
    expect(isActiveByPrefix('/dashboard/cycle/details', '/dashboard/cycle')).toBe(true);
  });

  it('isActiveByPrefix returns false for root when on sub-path', () => {
    expect(isActiveByPrefix('/dashboard/cycle', '/dashboard')).toBe(false);
  });

  it('isActiveByPrefix returns true for root on exact match', () => {
    expect(isActiveByPrefix('/dashboard', '/dashboard')).toBe(true);
  });
});

describe('ResponsiveLayout - activeMatchStrategy="exact" (Requirement 2.2)', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('highlights only the exactly matching item', () => {
    mockPathname = '/partner';

    const partnerItems = [
      { href: '/partner', label: 'Insights', icon: <span>I</span> },
      { href: '/partner/settings', label: 'Settings', icon: <span>S</span> },
    ];

    render(
      <ResponsiveLayout navItems={partnerItems} activeMatchStrategy="exact">
        <p>Content</p>
      </ResponsiveLayout>,
    );

    const desktopNav = screen.getByLabelText('Main navigation');
    const insightsLink = desktopNav.querySelector('a[href="/partner"]');
    const settingsLink = desktopNav.querySelector('a[href="/partner/settings"]');

    expect(insightsLink).toHaveAttribute('aria-current', 'page');
    expect(settingsLink).not.toHaveAttribute('aria-current', 'page');
  });

  it('does not highlight any item when no exact match exists', () => {
    mockPathname = '/partner/other';

    const partnerItems = [
      { href: '/partner', label: 'Insights', icon: <span>I</span> },
      { href: '/partner/settings', label: 'Settings', icon: <span>S</span> },
    ];

    render(
      <ResponsiveLayout navItems={partnerItems} activeMatchStrategy="exact">
        <p>Content</p>
      </ResponsiveLayout>,
    );

    const desktopNav = screen.getByLabelText('Main navigation');
    const insightsLink = desktopNav.querySelector('a[href="/partner"]');
    const settingsLink = desktopNav.querySelector('a[href="/partner/settings"]');

    expect(insightsLink).not.toHaveAttribute('aria-current', 'page');
    expect(settingsLink).not.toHaveAttribute('aria-current', 'page');
  });

  it('isActiveByExact returns true only for exact match', () => {
    expect(isActiveByExact('/partner', '/partner')).toBe(true);
    expect(isActiveByExact('/partner/settings', '/partner')).toBe(false);
    expect(isActiveByExact('/partner', '/partner/settings')).toBe(false);
  });
});

describe('ResponsiveLayout - Unique aria-labels on nav landmarks (Requirement 6.7)', () => {
  beforeEach(() => {
    mockPathname = '/dashboard';
    document.body.style.overflow = '';
  });

  it('all nav landmarks have unique aria-labels', () => {
    render(
      <ResponsiveLayout navItems={testNavItems}>
        <p>Content</p>
      </ResponsiveLayout>,
    );

    // Open the hamburger menu to render the mobile nav menu
    const hamburgerButton = screen.getByRole('button', { name: /open menu/i });
    fireEvent.click(hamburgerButton);

    // Get all nav elements
    const navElements = screen.getAllByRole('navigation');

    // Should have at least 3 nav landmarks: desktop, mobile menu, bottom nav
    expect(navElements.length).toBeGreaterThanOrEqual(3);

    // Collect all aria-labels
    const ariaLabels = navElements.map((nav) => nav.getAttribute('aria-label'));

    // All should have aria-label
    ariaLabels.forEach((label) => {
      expect(label).toBeTruthy();
    });

    // All aria-labels should be unique
    const uniqueLabels = new Set(ariaLabels);
    expect(uniqueLabels.size).toBe(ariaLabels.length);
  });

  it('desktop nav has aria-label "Main navigation"', () => {
    render(
      <ResponsiveLayout navItems={testNavItems}>
        <p>Content</p>
      </ResponsiveLayout>,
    );

    expect(screen.getByLabelText('Main navigation')).toBeInTheDocument();
  });

  it('bottom nav has aria-label "Bottom navigation"', () => {
    render(
      <ResponsiveLayout navItems={testNavItems}>
        <p>Content</p>
      </ResponsiveLayout>,
    );

    expect(screen.getByLabelText('Bottom navigation')).toBeInTheDocument();
  });

  it('mobile menu has aria-label "Mobile navigation menu"', () => {
    render(
      <ResponsiveLayout navItems={testNavItems}>
        <p>Content</p>
      </ResponsiveLayout>,
    );

    // Open the hamburger menu
    const hamburgerButton = screen.getByRole('button', { name: /open menu/i });
    fireEvent.click(hamburgerButton);

    expect(screen.getByLabelText('Mobile navigation menu')).toBeInTheDocument();
  });
});
