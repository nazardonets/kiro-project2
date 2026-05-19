'use client';

import { useEffect, useState } from 'react';

import { NavigationErrorBoundary } from '@/components/layout/navigation-error-boundary';
import { ResponsiveLayout, adminNavItems } from '@/components/layout/responsive-layout';
import { createClient } from '@/lib/supabase/client';

// ─── Types ──────────────────────────────────────────────────────────────────

type AuthState =
  | { type: 'loading' }
  | { type: 'unauthorized'; reason: string }
  | { type: 'authorized' };

// ─── Admin Layout ───────────────────────────────────────────────────────────

/**
 * Admin layout with authentication gate.
 * Verifies the user has admin role before granting access.
 * Navigation shell renders only after authorization succeeds.
 *
 * Validates: Requirement 5.1, 4.3
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({ type: 'loading' });

  useEffect(() => {
    async function checkAdminAuth() {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          setAuthState({
            type: 'unauthorized',
            reason: 'You must be logged in to access the admin panel.',
          });
          return;
        }

        const role = user.user_metadata?.role;
        if (role !== 'admin') {
          setAuthState({
            type: 'unauthorized',
            reason: 'Only admin users can access this resource.',
          });
          return;
        }

        setAuthState({ type: 'authorized' });
      } catch {
        setAuthState({
          type: 'unauthorized',
          reason: 'Unable to verify admin access. Please try again.',
        });
      }
    }

    checkAdminAuth();
  }, []);

  if (authState.type === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Verifying admin access...</p>
      </div>
    );
  }

  if (authState.type === 'unauthorized') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
          <p className="mt-2 text-muted-foreground">{authState.reason}</p>
        </div>
      </div>
    );
  }

  return (
    <NavigationErrorBoundary homeHref="/admin">
      <ResponsiveLayout navItems={adminNavItems} activeMatchStrategy="prefix">
        {children}
      </ResponsiveLayout>
    </NavigationErrorBoundary>
  );
}
