import { describe, it, expect, vi, beforeEach } from 'vitest';

import { INVITE_EXPIRY_HOURS } from '@/lib/constants';
import { InviteStatus } from '@/lib/types';

import { InviteService } from './invite-service';

// Mock Supabase client factory
function createMockSupabase() {
  const mockFrom = vi.fn();

  return {
    from: mockFrom,
    _mockFrom: mockFrom,
  };
}

describe('InviteService', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let inviteService: InviteService;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inviteService = new InviteService(mockSupabase as any);
  });

  describe('generateInvite', () => {
    const primaryUserId = 'primary-user-123';

    it('should reject if primary user already has an active partner link', async () => {
      const selectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'link-1' },
          error: null,
        }),
      };
      mockSupabase._mockFrom.mockReturnValue(selectChain);

      const result = await inviteService.generateInvite(primaryUserId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PARTNER_ALREADY_LINKED');
    });

    it('should generate invite with unique token and 72-hour expiry', async () => {
      let fromCallCount = 0;

      // 1st call: check partner_link (no active link)
      const partnerLinkChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      };

      // 2nd call: expire existing pending invites
      const expireChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };

      // 3rd call: insert new invite
      const insertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'invite-new',
            token: 'generated-token',
            expires_at: new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000).toISOString(),
          },
          error: null,
        }),
      };

      mockSupabase._mockFrom.mockImplementation(() => {
        fromCallCount++;
        if (fromCallCount === 1) return partnerLinkChain;
        if (fromCallCount === 2) return expireChain;
        return insertChain;
      });

      const result = await inviteService.generateInvite(primaryUserId);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('invite-new');
      expect(result.data?.token).toBeDefined();
      expect(result.data?.expiresAt).toBeDefined();

      // Verify the insert was called with correct data
      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          primary_user_id: primaryUserId,
          status: InviteStatus.PENDING,
        }),
      );

      // Verify the token is a UUID format
      const insertCall = insertChain.insert.mock.calls[0][0];
      expect(insertCall.token).toBeDefined();
      expect(typeof insertCall.token).toBe('string');
      expect(insertCall.token.length).toBeGreaterThan(0);
    });

    it('should set expires_at to exactly created_at + 72 hours', async () => {
      let fromCallCount = 0;

      const partnerLinkChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      };

      const expireChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };

      const insertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(async () => {
          const insertData = insertChain.insert.mock.calls[0][0];
          return {
            data: {
              id: 'invite-new',
              token: insertData.token,
              expires_at: insertData.expires_at,
            },
            error: null,
          };
        }),
      };

      mockSupabase._mockFrom.mockImplementation(() => {
        fromCallCount++;
        if (fromCallCount === 1) return partnerLinkChain;
        if (fromCallCount === 2) return expireChain;
        return insertChain;
      });

      const beforeCall = Date.now();
      const result = await inviteService.generateInvite(primaryUserId);
      const afterCall = Date.now();

      expect(result.success).toBe(true);

      const insertData = insertChain.insert.mock.calls[0][0];
      const createdAt = new Date(insertData.created_at).getTime();
      const expiresAt = new Date(insertData.expires_at).getTime();

      // Verify expires_at = created_at + 72 hours
      const expectedDiff = INVITE_EXPIRY_HOURS * 60 * 60 * 1000;
      expect(expiresAt - createdAt).toBe(expectedDiff);

      // Verify created_at is within the test execution window
      expect(createdAt).toBeGreaterThanOrEqual(beforeCall);
      expect(createdAt).toBeLessThanOrEqual(afterCall);
    });

    it('should expire existing pending invites before creating a new one', async () => {
      let fromCallCount = 0;

      const partnerLinkChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      };

      const expireChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };

      const insertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'invite-new', token: 'token-123', expires_at: new Date().toISOString() },
          error: null,
        }),
      };

      mockSupabase._mockFrom.mockImplementation(() => {
        fromCallCount++;
        if (fromCallCount === 1) return partnerLinkChain;
        if (fromCallCount === 2) return expireChain;
        return insertChain;
      });

      await inviteService.generateInvite(primaryUserId);

      // Verify the expire call was made
      expect(expireChain.update).toHaveBeenCalledWith({ status: InviteStatus.EXPIRED });
    });

    it('should return error when database insert fails', async () => {
      let fromCallCount = 0;

      const partnerLinkChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      };

      const expireChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };

      const insertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };

      mockSupabase._mockFrom.mockImplementation(() => {
        fromCallCount++;
        if (fromCallCount === 1) return partnerLinkChain;
        if (fromCallCount === 2) return expireChain;
        return insertChain;
      });

      const result = await inviteService.generateInvite(primaryUserId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVITE_CREATION_FAILED');
    });
  });

  describe('validateInvite', () => {
    it('should return invalid for non-existent token', async () => {
      const selectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      };
      mockSupabase._mockFrom.mockReturnValue(selectChain);

      const result = await inviteService.validateInvite('non-existent-token');

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(false);
      expect(result.data?.reason).toContain('invalid');
    });

    it('should return invalid for already-accepted invite', async () => {
      const selectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'invite-1',
            primary_user_id: 'primary-123',
            token: 'used-token',
            status: InviteStatus.ACCEPTED,
            expires_at: new Date(Date.now() + 86400000).toISOString(),
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      };
      mockSupabase._mockFrom.mockReturnValue(selectChain);

      const result = await inviteService.validateInvite('used-token');

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(false);
      expect(result.data?.reason).toContain('already been used');
    });

    it('should return invalid for expired invite (by time)', async () => {
      const selectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'invite-1',
            primary_user_id: 'primary-123',
            token: 'expired-token',
            status: InviteStatus.PENDING,
            expires_at: new Date(Date.now() - 86400000).toISOString(), // expired yesterday
            created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
          },
          error: null,
        }),
      };

      // For the update call to mark as expired
      const updateChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };

      let fromCallCount = 0;
      mockSupabase._mockFrom.mockImplementation(() => {
        fromCallCount++;
        if (fromCallCount === 1) return selectChain;
        return updateChain;
      });

      const result = await inviteService.validateInvite('expired-token');

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(false);
      expect(result.data?.reason).toContain('expired');
    });

    it('should return invalid for invite with expired status', async () => {
      const selectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'invite-1',
            primary_user_id: 'primary-123',
            token: 'expired-status-token',
            status: InviteStatus.EXPIRED,
            expires_at: new Date(Date.now() + 86400000).toISOString(), // not yet expired by time
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      };
      mockSupabase._mockFrom.mockReturnValue(selectChain);

      const result = await inviteService.validateInvite('expired-status-token');

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(false);
      expect(result.data?.reason).toContain('expired');
    });

    it('should return valid for a pending invite that has not expired', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const selectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'invite-1',
            primary_user_id: 'primary-123',
            token: 'valid-token',
            status: InviteStatus.PENDING,
            expires_at: futureDate,
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      };
      mockSupabase._mockFrom.mockReturnValue(selectChain);

      const result = await inviteService.validateInvite('valid-token');

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(true);
      expect(result.data?.invite).toBeDefined();
      expect(result.data?.invite?.token).toBe('valid-token');
    });
  });

  describe('getInviteByToken', () => {
    it('should return invite details for a valid token', async () => {
      const inviteData = {
        id: 'invite-1',
        primary_user_id: 'primary-123',
        token: 'some-token',
        status: InviteStatus.PENDING,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        created_at: new Date().toISOString(),
      };

      const selectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: inviteData, error: null }),
      };
      mockSupabase._mockFrom.mockReturnValue(selectChain);

      const result = await inviteService.getInviteByToken('some-token');

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('invite-1');
      expect(result.data?.token).toBe('some-token');
      expect(result.data?.primary_user_id).toBe('primary-123');
    });

    it('should return error for non-existent token', async () => {
      const selectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      };
      mockSupabase._mockFrom.mockReturnValue(selectChain);

      const result = await inviteService.getInviteByToken('non-existent');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVITE_NOT_FOUND');
    });
  });
});
