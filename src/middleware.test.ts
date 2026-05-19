import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { middleware } from './middleware';

// Mock @supabase/ssr
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  }),
}));

function createRequest(pathname: string, options?: { cookies?: Record<string, string> }) {
  const url = `http://localhost:3000${pathname}`;
  const req = new NextRequest(url);
  if (options?.cookies) {
    for (const [name, value] of Object.entries(options.cookies)) {
      req.cookies.set(name, value);
    }
  }
  return req;
}

function setupMockChain(data: unknown) {
  mockSingle.mockResolvedValue({ data, error: null });
  mockEq.mockReturnValue({ eq: mockEq, single: mockSingle });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
}

describe('Edge Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  describe('Static assets', () => {
    it('should pass through static assets without auth check', async () => {
      const request = createRequest('/_next/static/chunk.js');
      const response = await middleware(request);
      expect(response.status).toBe(200);
      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it('should pass through image files', async () => {
      const request = createRequest('/logo.png');
      const response = await middleware(request);
      expect(response.status).toBe(200);
      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it('should pass through favicon', async () => {
      const request = createRequest('/favicon.ico');
      const response = await middleware(request);
      expect(response.status).toBe(200);
      expect(mockGetUser).not.toHaveBeenCalled();
    });
  });

  describe('Public routes', () => {
    it('should allow unauthenticated access to /auth/login', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const request = createRequest('/auth/login');
      const response = await middleware(request);
      expect(response.status).toBe(200);
    });

    it('should allow unauthenticated access to /auth/register', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const request = createRequest('/auth/register');
      const response = await middleware(request);
      expect(response.status).toBe(200);
    });

    it('should allow unauthenticated access to /auth/accept-invite', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const request = createRequest('/auth/accept-invite');
      const response = await middleware(request);
      expect(response.status).toBe(200);
    });

    it('should allow unauthenticated access to /api/auth/register', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const request = createRequest('/api/auth/register');
      const response = await middleware(request);
      expect(response.status).toBe(200);
    });

    it('should redirect authenticated primary user from /auth/login to /dashboard', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'user-1', email: 'test@test.com', user_metadata: { role: 'primary' } },
        },
      });
      const request = createRequest('/auth/login');
      const response = await middleware(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/dashboard');
    });

    it('should redirect authenticated partner user from /auth/login to /partner', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'user-1', email: 'test@test.com', user_metadata: { role: 'partner' } },
        },
      });
      const request = createRequest('/auth/login');
      const response = await middleware(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/partner');
    });

    it('should redirect authenticated admin user from /auth/register to /admin', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'admin@test.com', user_metadata: { role: 'admin' } } },
      });
      const request = createRequest('/auth/register');
      const response = await middleware(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/admin');
    });
  });

  describe('Unauthenticated access to protected routes', () => {
    it('should redirect unauthenticated user to /auth/login from /dashboard', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const request = createRequest('/dashboard');
      const response = await middleware(request);
      expect(response.status).toBe(307);
      const location = response.headers.get('location') || '';
      expect(location).toContain('/auth/login');
      expect(location).toContain('redirectTo=%2Fdashboard');
    });

    it('should redirect unauthenticated user to /auth/login from /partner', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const request = createRequest('/partner/insights');
      const response = await middleware(request);
      expect(response.status).toBe(307);
      const location = response.headers.get('location') || '';
      expect(location).toContain('/auth/login');
      expect(location).toContain('redirectTo=%2Fpartner%2Finsights');
    });

    it('should redirect unauthenticated user to /auth/login from /admin', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const request = createRequest('/admin');
      const response = await middleware(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location') || '').toContain('/auth/login');
    });

    it('should redirect unauthenticated user to /auth/login from /api/admin', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const request = createRequest('/api/admin/users');
      const response = await middleware(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location') || '').toContain('/auth/login');
    });

    it('should redirect unauthenticated user to /auth/login from /onboarding', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const request = createRequest('/onboarding');
      const response = await middleware(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location') || '').toContain('/auth/login');
    });
  });

  describe('Role-based route protection', () => {
    it('should allow primary user to access /dashboard', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'user-1', email: 'primary@test.com', user_metadata: { role: 'primary' } },
        },
      });
      setupMockChain(null);
      const request = createRequest('/dashboard');
      const response = await middleware(request);
      expect(response.status).toBe(200);
    });

    it('should redirect partner user from /dashboard to /partner', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'user-1', email: 'partner@test.com', user_metadata: { role: 'partner' } },
        },
      });
      const request = createRequest('/dashboard');
      const response = await middleware(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/partner');
    });

    it('should allow partner user to access /partner', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'user-2', email: 'partner@test.com', user_metadata: { role: 'partner' } },
        },
      });
      setupMockChain(null);
      const request = createRequest('/partner');
      const response = await middleware(request);
      expect(response.status).toBe(200);
    });

    it('should redirect primary user from /partner to /dashboard', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'user-1', email: 'primary@test.com', user_metadata: { role: 'primary' } },
        },
      });
      const request = createRequest('/partner');
      const response = await middleware(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/dashboard');
    });

    it('should allow admin user to access /admin', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'admin-1', email: 'admin@test.com', user_metadata: { role: 'admin' } },
        },
      });
      setupMockChain(null);
      const request = createRequest('/admin');
      const response = await middleware(request);
      expect(response.status).toBe(200);
    });

    it('should redirect primary user from /admin to /dashboard', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'user-1', email: 'primary@test.com', user_metadata: { role: 'primary' } },
        },
      });
      const request = createRequest('/admin');
      const response = await middleware(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/dashboard');
    });

    it('should allow admin user to access /api/admin/users', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'admin-1', email: 'admin@test.com', user_metadata: { role: 'admin' } },
        },
      });
      setupMockChain(null);
      const request = createRequest('/api/admin/users');
      const response = await middleware(request);
      expect(response.status).toBe(200);
    });

    it('should redirect partner user from /api/admin/users to /partner', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'user-2', email: 'partner@test.com', user_metadata: { role: 'partner' } },
        },
      });
      const request = createRequest('/api/admin/users');
      const response = await middleware(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/partner');
    });

    it('should redirect primary user from /api/admin/cycles to /dashboard', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'user-1', email: 'primary@test.com', user_metadata: { role: 'primary' } },
        },
      });
      const request = createRequest('/api/admin/cycles/user/123');
      const response = await middleware(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/dashboard');
    });
  });

  describe('Onboarding routes', () => {
    it('should allow any authenticated user to access /onboarding', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'new@test.com', user_metadata: { role: 'primary' } } },
      });
      const request = createRequest('/onboarding');
      const response = await middleware(request);
      expect(response.status).toBe(200);
      expect(response.headers.get('x-user-id')).toBe('user-1');
      expect(response.headers.get('x-user-role')).toBe('primary');
    });

    it('should allow partner user to access /onboarding/step-2', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'user-2', email: 'partner@test.com', user_metadata: { role: 'partner' } },
        },
      });
      const request = createRequest('/onboarding/step-2');
      const response = await middleware(request);
      expect(response.status).toBe(200);
      expect(response.headers.get('x-user-role')).toBe('partner');
    });
  });

  describe('User context headers', () => {
    it('should attach user ID, role, and email headers for primary user', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'user-1', email: 'primary@test.com', user_metadata: { role: 'primary' } },
        },
      });
      setupMockChain(null);
      const request = createRequest('/dashboard');
      const response = await middleware(request);
      expect(response.headers.get('x-user-id')).toBe('user-1');
      expect(response.headers.get('x-user-role')).toBe('primary');
      expect(response.headers.get('x-user-email')).toBe('primary@test.com');
    });

    it('should attach linked partner ID for primary user with active partner', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'user-1', email: 'primary@test.com', user_metadata: { role: 'primary' } },
        },
      });

      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        callCount++;
        if (table === 'partner_link' || callCount === 1) {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: () =>
                    Promise.resolve({
                      data: { partner_user_id: 'partner-1' },
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        // sharing_preferences
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    emotional_tendencies: true,
                    behavioral_patterns: true,
                    energy_levels: false,
                    communication_guidance: true,
                    daily_summaries: true,
                    phase_alerts: false,
                    partner_reminders: true,
                  },
                  error: null,
                }),
            }),
          }),
        };
      });

      const request = createRequest('/dashboard');
      const response = await middleware(request);
      expect(response.headers.get('x-linked-partner-id')).toBe('partner-1');
      const permissions = JSON.parse(response.headers.get('x-sharing-permissions') || '{}');
      expect(permissions.emotional_tendencies).toBe(true);
      expect(permissions.energy_levels).toBe(false);
    });

    it('should attach linked primary ID for partner user with active link', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'partner-1', email: 'partner@test.com', user_metadata: { role: 'partner' } },
        },
      });

      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        callCount++;
        if (table === 'partner_link' || callCount === 1) {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: () =>
                    Promise.resolve({
                      data: { primary_user_id: 'user-1' },
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        // sharing_preferences
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    emotional_tendencies: true,
                    behavioral_patterns: false,
                    energy_levels: true,
                    communication_guidance: true,
                    daily_summaries: false,
                    phase_alerts: true,
                    partner_reminders: false,
                  },
                  error: null,
                }),
            }),
          }),
        };
      });

      const request = createRequest('/partner');
      const response = await middleware(request);
      expect(response.headers.get('x-linked-partner-id')).toBe('user-1');
      const permissions = JSON.parse(response.headers.get('x-sharing-permissions') || '{}');
      expect(permissions.behavioral_patterns).toBe(false);
      expect(permissions.phase_alerts).toBe(true);
    });

    it('should not attach partner headers when no active link exists', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'user-1', email: 'primary@test.com', user_metadata: { role: 'primary' } },
        },
      });
      setupMockChain(null);
      const request = createRequest('/dashboard');
      const response = await middleware(request);
      expect(response.headers.get('x-linked-partner-id')).toBeNull();
      expect(response.headers.get('x-sharing-permissions')).toBeNull();
    });

    it('should not attach partner headers for admin users', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'admin-1', email: 'admin@test.com', user_metadata: { role: 'admin' } },
        },
      });
      setupMockChain(null);
      const request = createRequest('/admin');
      const response = await middleware(request);
      expect(response.headers.get('x-user-role')).toBe('admin');
      expect(response.headers.get('x-linked-partner-id')).toBeNull();
      expect(response.headers.get('x-sharing-permissions')).toBeNull();
    });
  });

  describe('Missing environment variables', () => {
    it('should pass through when Supabase env vars are missing', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const request = createRequest('/dashboard');
      const response = await middleware(request);
      expect(response.status).toBe(200);
    });
  });

  describe('Database error resilience', () => {
    it('should continue with basic context when database queries fail', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'user-1', email: 'primary@test.com', user_metadata: { role: 'primary' } },
        },
      });
      mockFrom.mockImplementation(() => {
        throw new Error('Database connection failed');
      });
      const request = createRequest('/dashboard');
      const response = await middleware(request);
      expect(response.status).toBe(200);
      expect(response.headers.get('x-user-id')).toBe('user-1');
      expect(response.headers.get('x-user-role')).toBe('primary');
      expect(response.headers.get('x-linked-partner-id')).toBeNull();
    });
  });

  describe('Default role handling', () => {
    it('should default to primary role when user_metadata has no role', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'test@test.com', user_metadata: {} } },
      });
      setupMockChain(null);
      const request = createRequest('/dashboard');
      const response = await middleware(request);
      expect(response.status).toBe(200);
      expect(response.headers.get('x-user-role')).toBe('primary');
    });
  });
});
