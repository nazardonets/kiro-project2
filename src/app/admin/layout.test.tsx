import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import AdminLayout from './layout';

// ─── Mock next/navigation ───────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
}));

// ─── Mock Supabase client ───────────────────────────────────────────────────

const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AdminLayout auth gate + navigation (Requirement 4.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loading state does NOT render navigation shell', () => {
    // Never resolve the getUser call to keep the component in loading state
    mockGetUser.mockReturnValue(new Promise(() => {}));

    render(
      <AdminLayout>
        <div>Admin content</div>
      </AdminLayout>,
    );

    // Loading indicator should be visible
    expect(screen.getByText('Verifying admin access...')).toBeInTheDocument();

    // Navigation shell should NOT be rendered
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });

  it('unauthorized state does NOT render navigation shell', async () => {
    // Simulate a non-admin user
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          user_metadata: { role: 'primary' },
        },
      },
      error: null,
    });

    render(
      <AdminLayout>
        <div>Admin content</div>
      </AdminLayout>,
    );

    await waitFor(() => {
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    });

    expect(screen.getByText('Only admin users can access this resource.')).toBeInTheDocument();

    // Navigation shell should NOT be rendered
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });

  it('authorized state renders ResponsiveLayout with admin nav items', async () => {
    // Simulate an admin user
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'admin-1',
          user_metadata: { role: 'admin' },
        },
      },
      error: null,
    });

    render(
      <AdminLayout>
        <div data-testid="admin-child">Admin content</div>
      </AdminLayout>,
    );

    // Wait for auth to resolve and navigation to render
    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    });

    // Admin nav items should be rendered within the main navigation
    const mainNav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(mainNav).getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/admin');
    expect(within(mainNav).getByRole('link', { name: 'Cycles' })).toHaveAttribute(
      'href',
      '/admin/cycles',
    );

    // Children should be rendered inside the main content area
    const mainContent = screen.getByRole('main');
    const childContent = screen.getByTestId('admin-child');
    expect(mainContent).toContainElement(childContent);
  });
});
