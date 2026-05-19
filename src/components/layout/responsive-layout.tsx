'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useFocusTrap } from '@/hooks/useFocusTrap';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export type ActiveMatchStrategy = 'prefix' | 'exact';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  navItems?: NavItem[];
  /** Optional header content (e.g., logo, user menu) */
  headerContent?: React.ReactNode;
  /** Whether to show the mobile bottom navigation */
  showMobileNav?: boolean;
  /** Strategy for determining the active nav item. Defaults to 'prefix'. */
  activeMatchStrategy?: ActiveMatchStrategy;
}

// ─── Active Match Functions ─────────────────────────────────────────────────

/**
 * Prefix match: for root paths (e.g., '/dashboard') returns exact match only,
 * for other items returns true if pathname starts with the href.
 */
export function isActiveByPrefix(pathname: string, href: string): boolean {
  // Root-level items (no sub-path after the section) use exact match
  // e.g., '/dashboard' should only match '/dashboard', not '/dashboard/cycle'
  const segments = href.split('/').filter(Boolean);
  if (segments.length <= 1) {
    return pathname === href;
  }
  return pathname.startsWith(href);
}

/**
 * Exact match: returns true only if pathname strictly equals href.
 */
export function isActiveByExact(pathname: string, href: string): boolean {
  return pathname === href;
}

// ─── Icons (inline SVG for minimal dependencies) ────────────────────────────

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-5 w-5', className)}
      aria-hidden="true"
    >
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-5 w-5', className)}
      aria-hidden="true"
    >
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-5 w-5', className)}
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

// ─── Responsive Layout Component ────────────────────────────────────────────

/**
 * Responsive layout shell that provides:
 * - No horizontal scrolling (320px-2560px)
 * - Mobile bottom navigation below 768px
 * - Hamburger menu for mobile
 * - Skip-to-content link for keyboard users
 * - WCAG 2.1 AA compliant focus management
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 4.8
 */
export function ResponsiveLayout({
  children,
  navItems = [],
  headerContent,
  showMobileNav = true,
  activeMatchStrategy = 'prefix',
}: ResponsiveLayoutProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLElement>(null);
  const hamburgerButtonRef = useRef<HTMLButtonElement>(null);

  // Determine if a nav item is active based on the chosen strategy
  const isActive = (href: string): boolean => {
    if (activeMatchStrategy === 'exact') {
      return isActiveByExact(pathname, href);
    }
    return isActiveByPrefix(pathname, href);
  };

  // Callback to close the mobile menu (used by focus trap on Escape)
  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  // Focus trap for hamburger menu (Requirements 6.5, 6.6)
  useFocusTrap(mobileMenuRef, mobileMenuOpen, {
    triggerRef: hamburgerButtonRef,
    onEscape: closeMobileMenu,
  });

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Close mobile menu on outside tap/click
  useEffect(() => {
    if (!mobileMenuOpen) return;

    function handleOutsideClick(e: MouseEvent) {
      const target = e.target as Node;
      const isInsideMenu = mobileMenuRef.current?.contains(target);
      const isHamburgerButton = hamburgerButtonRef.current?.contains(target);

      if (!isInsideMenu && !isHamburgerButton) {
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [mobileMenuOpen]);

  return (
    <div className="relative min-h-screen w-full max-w-[100vw] overflow-x-hidden">
      {/* Skip to main content - keyboard accessibility */}
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>

      {/* Desktop header navigation */}
      <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-content-wide items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo / Brand */}
          <div className="flex items-center gap-2">{headerContent}</div>

          {/* Desktop navigation */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  'inline-flex min-h-tap-target items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive(item.href)
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground',
                )}
                aria-current={isActive(item.href) ? 'page' : undefined}
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Mobile hamburger menu button */}
          <button
            ref={hamburgerButtonRef}
            type="button"
            className={cn(
              'inline-flex min-h-tap-target min-w-tap-target items-center justify-center rounded-md md:hidden',
              'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            )}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>

        {/* Mobile slide-down menu */}
        {mobileMenuOpen && (
          <nav
            ref={mobileMenuRef}
            id="mobile-menu"
            className="border-t bg-background md:hidden"
            aria-label="Mobile navigation menu"
          >
            <div className="space-y-1 px-4 py-3">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex min-h-tap-target items-center gap-3 rounded-md px-3 py-2 text-base font-medium transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    isActive(item.href)
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground',
                  )}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                >
                  {item.icon}
                  {item.label}
                </a>
              ))}
            </div>
          </nav>
        )}
      </header>

      {/* Main content area */}
      <main
        id="main-content"
        className={cn(
          'mx-auto w-full max-w-content-wide px-4 py-6 sm:px-6 lg:px-8',
          /* Add bottom padding on mobile to account for bottom nav */
          showMobileNav && navItems.length > 0 ? 'pb-20 md:pb-6' : '',
        )}
        tabIndex={-1}
      >
        {children}
      </main>

      {/* Mobile bottom navigation (below 768px) */}
      {showMobileNav && navItems.length > 0 && (
        <nav className="mobile-bottom-nav md:hidden" aria-label="Bottom navigation">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(isActive(item.href) ? 'text-primary' : '')}
              aria-current={isActive(item.href) ? 'page' : undefined}
              aria-label={item.label}
            >
              {item.icon}
              <span className="text-[11px]">{item.label}</span>
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}

// ─── Default Navigation Items ───────────────────────────────────────────────

export const primaryNavItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: <HomeIcon />,
  },
  {
    href: '/dashboard/cycle',
    label: 'Cycle',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    href: '/dashboard/sharing',
    label: 'Sharing',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" x2="12" y1="2" y2="15" />
      </svg>
    ),
  },
  {
    href: '/dashboard/customize',
    label: 'Customize',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    href: '/dashboard/date-request',
    label: 'Date Request',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
        <path d="M8 14h.01" />
        <path d="M12 14h.01" />
        <path d="M16 14h.01" />
        <path d="M8 18h.01" />
        <path d="M12 18h.01" />
        <path d="M16 18h.01" />
      </svg>
    ),
  },
];

export const partnerNavItems: NavItem[] = [
  {
    href: '/partner',
    label: 'Insights',
    icon: <HomeIcon />,
  },
  {
    href: '/partner/settings',
    label: 'Settings',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
];

export const adminNavItems: NavItem[] = [
  {
    href: '/admin',
    label: 'Users',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: '/admin/cycles',
    label: 'Cycles',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
];
