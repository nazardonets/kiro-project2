import { describe, it, expect, vi, beforeEach } from 'vitest';

import { UserRole, InviteStatus, PartnerLinkStatus } from '@/lib/types';

import { AuthService } from './auth-service';

// Mock Supabase client factory
function createMockSupabase() {
  const mockAuth = {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    getUser: vi.fn(),
  };

  const mockFrom = vi.fn();

  return {
    auth: mockAuth,
    from: mockFrom,
    _mockAuth: mockAuth,
    _mockFrom: mockFrom,
  };
}

describe('AuthService', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let authService: AuthService;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authService = new AuthService(mockSupabase as any);
  });

  describe('registerPrimaryUser', () => {
    it('should reject password that is too short', async () => {
      const result = await authService.registerPrimaryUser('test@example.com', 'Ab1');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.fields?.password).toBeDefined();
      expect(result.error?.fields?.password[0].constraint).toBe('min_length');
    });

    it('should reject password without uppercase letter', async () => {
      const result = await authService.registerPrimaryUser('test@example.com', 'abcdefg1');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.fields?.password).toBeDefined();
      expect(result.error?.fields?.password.some((e) => e.constraint === 'uppercase')).toBe(true);
    });

    it('should reject password without lowercase letter', async () => {
      const result = await authService.registerPrimaryUser('test@example.com', 'ABCDEFG1');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.fields?.password.some((e) => e.constraint === 'lowercase')).toBe(true);
    });

    it('should reject password without digit', async () => {
      const result = await authService.registerPrimaryUser('test@example.com', 'Abcdefgh');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.fields?.password.some((e) => e.constraint === 'digit')).toBe(true);
    });

    it('should successfully register a primary user with valid credentials', async () => {
      mockSupabase._mockAuth.signUp.mockResolvedValue({
        data: {
          user: { id: 'user-123', email: 'test@example.com' },
          session: {},
        },
        error: null,
      });

      const result = await authService.registerPrimaryUser('test@example.com', 'ValidPass1');

      expect(result.success).toBe(true);
      expect(result.data?.userId).toBe('user-123');
      expect(result.data?.email).toBe('test@example.com');
      expect(result.data?.role).toBe(UserRole.PRIMARY);

      expect(mockSupabase._mockAuth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'ValidPass1',
        options: {
          data: { role: UserRole.PRIMARY },
        },
      });
    });

    it('should return EMAIL_IN_USE when email is already registered', async () => {
      mockSupabase._mockAuth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' },
      });

      const result = await authService.registerPrimaryUser('existing@example.com', 'ValidPass1');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EMAIL_IN_USE');
      expect(result.error?.message).toContain('already exists');
    });

    it('should return AUTH_ERROR for other Supabase errors', async () => {
      mockSupabase._mockAuth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Network error' },
      });

      const result = await authService.registerPrimaryUser('test@example.com', 'ValidPass1');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AUTH_ERROR');
    });
  });

  describe('registerPartnerViaInvite', () => {
    const validToken = 'valid-invite-token';
    const validEmail = 'partner@example.com';
    const validPassword = 'PartnerPass1';

    function setupInviteQuery(invite: Record<string, unknown> | null, error?: unknown) {
      const chainMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: invite, error: error || null }),
      };
      mockSupabase._mockFrom.mockReturnValue(chainMock);
      return chainMock;
    }

    it('should reject invalid password for partner registration', async () => {
      const result = await authService.registerPartnerViaInvite(validToken, validEmail, 'weak');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid invite token', async () => {
      setupInviteQuery(null, { message: 'not found' });

      const result = await authService.registerPartnerViaInvite(
        'invalid-token',
        validEmail,
        validPassword,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INVITE');
    });

    it('should reject already-used invite', async () => {
      setupInviteQuery({
        id: 'invite-1',
        primary_user_id: 'primary-123',
        token: validToken,
        status: InviteStatus.ACCEPTED,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      });

      const result = await authService.registerPartnerViaInvite(
        validToken,
        validEmail,
        validPassword,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVITE_ALREADY_USED');
    });

    it('should reject expired invite', async () => {
      setupInviteQuery({
        id: 'invite-1',
        primary_user_id: 'primary-123',
        token: validToken,
        status: InviteStatus.PENDING,
        expires_at: new Date(Date.now() - 86400000).toISOString(), // expired yesterday
      });

      const result = await authService.registerPartnerViaInvite(
        validToken,
        validEmail,
        validPassword,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVITE_EXPIRED');
    });

    it('should successfully register partner with valid invite', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      // First call: select invite
      const selectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'invite-1',
            primary_user_id: 'primary-123',
            token: validToken,
            status: InviteStatus.PENDING,
            expires_at: futureDate,
          },
          error: null,
        }),
      };

      // Insert partner link
      const insertChain = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };

      // Update invite status
      const updateChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };

      let fromCallCount = 0;
      mockSupabase._mockFrom.mockImplementation(() => {
        fromCallCount++;
        if (fromCallCount === 1) return selectChain;
        if (fromCallCount === 2) return insertChain;
        return updateChain;
      });

      mockSupabase._mockAuth.signUp.mockResolvedValue({
        data: {
          user: { id: 'partner-456', email: validEmail },
          session: {},
        },
        error: null,
      });

      const result = await authService.registerPartnerViaInvite(
        validToken,
        validEmail,
        validPassword,
      );

      expect(result.success).toBe(true);
      expect(result.data?.userId).toBe('partner-456');
      expect(result.data?.role).toBe(UserRole.PARTNER);

      expect(mockSupabase._mockAuth.signUp).toHaveBeenCalledWith({
        email: validEmail,
        password: validPassword,
        options: {
          data: {
            role: UserRole.PARTNER,
            linked_primary_id: 'primary-123',
          },
        },
      });

      expect(insertChain.insert).toHaveBeenCalledWith({
        primary_user_id: 'primary-123',
        partner_user_id: 'partner-456',
        status: PartnerLinkStatus.ACTIVE,
        linked_at: expect.any(String),
      });
    });

    it('should return EMAIL_IN_USE when partner email is already registered', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      const selectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'invite-1',
            primary_user_id: 'primary-123',
            token: validToken,
            status: InviteStatus.PENDING,
            expires_at: futureDate,
          },
          error: null,
        }),
      };

      mockSupabase._mockFrom.mockReturnValue(selectChain);

      mockSupabase._mockAuth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' },
      });

      const result = await authService.registerPartnerViaInvite(
        validToken,
        validEmail,
        validPassword,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EMAIL_IN_USE');
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      mockSupabase._mockAuth.signInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            user_metadata: { role: UserRole.PRIMARY },
          },
          session: {
            access_token: 'access-token-123',
            refresh_token: 'refresh-token-123',
          },
        },
        error: null,
      });

      const result = await authService.login('test@example.com', 'ValidPass1');

      expect(result.success).toBe(true);
      expect(result.data?.userId).toBe('user-123');
      expect(result.data?.email).toBe('test@example.com');
      expect(result.data?.role).toBe(UserRole.PRIMARY);
      expect(result.data?.accessToken).toBe('access-token-123');
      expect(result.data?.refreshToken).toBe('refresh-token-123');
    });

    it('should return INVALID_CREDENTIALS for wrong password', async () => {
      mockSupabase._mockAuth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      const result = await authService.login('test@example.com', 'WrongPass1');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return partner role for partner users', async () => {
      mockSupabase._mockAuth.signInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'partner-456',
            email: 'partner@example.com',
            user_metadata: { role: UserRole.PARTNER },
          },
          session: {
            access_token: 'access-token',
            refresh_token: 'refresh-token',
          },
        },
        error: null,
      });

      const result = await authService.login('partner@example.com', 'ValidPass1');

      expect(result.success).toBe(true);
      expect(result.data?.role).toBe(UserRole.PARTNER);
    });
  });

  describe('logout', () => {
    it('should successfully sign out', async () => {
      mockSupabase._mockAuth.signOut.mockResolvedValue({ error: null });

      const result = await authService.logout();

      expect(result.success).toBe(true);
    });

    it('should return error when sign out fails', async () => {
      mockSupabase._mockAuth.signOut.mockResolvedValue({
        error: { message: 'Sign out failed' },
      });

      const result = await authService.logout();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LOGOUT_ERROR');
    });
  });

  describe('getUserContext', () => {
    it('should return user context for authenticated primary user', async () => {
      mockSupabase._mockAuth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            user_metadata: { role: UserRole.PRIMARY },
          },
        },
        error: null,
      });

      const selectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { partner_user_id: 'partner-456' },
          error: null,
        }),
      };
      mockSupabase._mockFrom.mockReturnValue(selectChain);

      const result = await authService.getUserContext();

      expect(result.success).toBe(true);
      expect(result.data?.userId).toBe('user-123');
      expect(result.data?.role).toBe(UserRole.PRIMARY);
      expect(result.data?.linkedPartnerId).toBe('partner-456');
    });

    it('should return user context for authenticated partner user', async () => {
      mockSupabase._mockAuth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'partner-456',
            email: 'partner@example.com',
            user_metadata: { role: UserRole.PARTNER },
          },
        },
        error: null,
      });

      const selectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { primary_user_id: 'user-123' },
          error: null,
        }),
      };
      mockSupabase._mockFrom.mockReturnValue(selectChain);

      const result = await authService.getUserContext();

      expect(result.success).toBe(true);
      expect(result.data?.userId).toBe('partner-456');
      expect(result.data?.role).toBe(UserRole.PARTNER);
      expect(result.data?.linkedPartnerId).toBe('user-123');
    });

    it('should return UNAUTHENTICATED when no user is logged in', async () => {
      mockSupabase._mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const result = await authService.getUserContext();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNAUTHENTICATED');
    });

    it('should return null linkedPartnerId when no partner link exists', async () => {
      mockSupabase._mockAuth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            user_metadata: { role: UserRole.PRIMARY },
          },
        },
        error: null,
      });

      const selectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'not found' },
        }),
      };
      mockSupabase._mockFrom.mockReturnValue(selectChain);

      const result = await authService.getUserContext();

      expect(result.success).toBe(true);
      expect(result.data?.linkedPartnerId).toBeNull();
    });
  });
});
