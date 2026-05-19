import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ADMIN_SEARCH_RESULT_LIMIT } from '@/lib/constants';
import { UserStatus, PartnerLinkStatus } from '@/lib/types';

import {
  AdminService,
  AdminRepository,
  AdminEmailService,
  AdminAccountDetails,
  AdminErrorCode,
} from './admin-service';

// ─── Mock Helpers ────────────────────────────────────────────────────────────

function createMockRepository(): AdminRepository {
  return {
    searchUsers: vi.fn().mockResolvedValue([]),
    getUserById: vi.fn().mockResolvedValue(null),
    getUserBasicInfo: vi.fn().mockResolvedValue(null),
    suspendUser: vi.fn().mockResolvedValue(undefined),
    getActivePartnerLink: vi.fn().mockResolvedValue(null),
    revokePartnerLink: vi.fn().mockResolvedValue(undefined),
    disableSharingPreferences: vi.fn().mockResolvedValue(undefined),
    revokeUserSessions: vi.fn().mockResolvedValue(undefined),
    deleteCycleRecords: vi.fn().mockResolvedValue(0),
    deletePersonalNotes: vi.fn().mockResolvedValue(0),
    deleteSurveyResponses: vi.fn().mockResolvedValue(0),
    deleteSharingPreferences: vi.fn().mockResolvedValue(0),
    deleteDailySummaries: vi.fn().mockResolvedValue(0),
    deleteDateRequests: vi.fn().mockResolvedValue(0),
    deactivatePartner: vi.fn().mockResolvedValue(undefined),
    deleteUser: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockEmailService(): AdminEmailService {
  return {
    sendSuspensionNotification: vi.fn().mockResolvedValue(true),
  };
}

function createMockAccountDetails(overrides?: Partial<AdminAccountDetails>): AdminAccountDetails {
  return {
    id: 'user-123',
    email: 'test@example.com',
    role: 'primary',
    status: UserStatus.ACTIVE,
    suspension_reason: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    partner_link: null,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AdminService', () => {
  let service: AdminService;
  let repository: AdminRepository;
  let emailService: AdminEmailService;

  beforeEach(() => {
    repository = createMockRepository();
    emailService = createMockEmailService();
    service = new AdminService(repository, emailService);
  });

  // ─── searchUsers ─────────────────────────────────────────────────────────

  describe('searchUsers', () => {
    it('should search users by query and return results', async () => {
      const mockResults = [
        createMockAccountDetails({ id: 'user-1', email: 'alice@example.com' }),
        createMockAccountDetails({ id: 'user-2', email: 'bob@example.com' }),
      ];
      vi.mocked(repository.searchUsers).mockResolvedValue(mockResults);

      const result = await service.searchUsers('example.com');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(repository.searchUsers).toHaveBeenCalledWith('example.com', ADMIN_SEARCH_RESULT_LIMIT);
    });

    it('should respect custom limit up to max 50', async () => {
      vi.mocked(repository.searchUsers).mockResolvedValue([]);

      await service.searchUsers('test', 10);

      expect(repository.searchUsers).toHaveBeenCalledWith('test', 10);
    });

    it('should cap limit at 50 even if higher value is passed', async () => {
      vi.mocked(repository.searchUsers).mockResolvedValue([]);

      const result = await service.searchUsers('test', 100);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminErrorCode.VALIDATION_ERROR);
    });

    it('should reject empty query', async () => {
      const result = await service.searchUsers('');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminErrorCode.VALIDATION_ERROR);
    });

    it('should return empty array when no users match', async () => {
      vi.mocked(repository.searchUsers).mockResolvedValue([]);

      const result = await service.searchUsers('nonexistent@example.com');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  // ─── getAccountDetails ───────────────────────────────────────────────────

  describe('getAccountDetails', () => {
    it('should return account details for existing user', async () => {
      const mockUser = createMockAccountDetails({
        partner_link: {
          status: PartnerLinkStatus.ACTIVE,
          partner_user_id: 'partner-456',
          linked_at: '2024-02-01T00:00:00Z',
        },
      });
      vi.mocked(repository.getUserById).mockResolvedValue(mockUser);

      const result = await service.getAccountDetails('user-123');

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('user-123');
      expect(result.data?.status).toBe(UserStatus.ACTIVE);
      expect(result.data?.partner_link?.status).toBe(PartnerLinkStatus.ACTIVE);
    });

    it('should return error when user not found', async () => {
      vi.mocked(repository.getUserById).mockResolvedValue(null);

      const result = await service.getAccountDetails('nonexistent-id');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminErrorCode.USER_NOT_FOUND);
    });
  });

  // ─── suspendAccount ──────────────────────────────────────────────────────

  describe('suspendAccount', () => {
    it('should suspend an active user account', async () => {
      vi.mocked(repository.getUserBasicInfo).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: UserStatus.ACTIVE,
      });

      const result = await service.suspendAccount('user-123', 'Violation of terms of service');

      expect(result.success).toBe(true);
      expect(result.data?.suspended).toBe(true);
      expect(result.data?.emailSent).toBe(true);
      expect(repository.suspendUser).toHaveBeenCalledWith(
        'user-123',
        'Violation of terms of service',
      );
      expect(repository.revokeUserSessions).toHaveBeenCalledWith('user-123');
    });

    it('should revoke partner access when suspending a primary user with linked partner', async () => {
      vi.mocked(repository.getUserBasicInfo).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: UserStatus.ACTIVE,
      });
      vi.mocked(repository.getActivePartnerLink).mockResolvedValue({
        partner_user_id: 'partner-456',
        status: PartnerLinkStatus.ACTIVE,
      });

      const result = await service.suspendAccount('user-123', 'Account review required');

      expect(result.success).toBe(true);
      expect(repository.revokePartnerLink).toHaveBeenCalledWith('user-123');
      expect(repository.disableSharingPreferences).toHaveBeenCalledWith('user-123');
      expect(repository.revokeUserSessions).toHaveBeenCalledWith('partner-456');
    });

    it('should disable sharing preferences to block partner access to Insights_Dashboard and Guidance_Panel', async () => {
      vi.mocked(repository.getUserBasicInfo).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: UserStatus.ACTIVE,
      });
      vi.mocked(repository.getActivePartnerLink).mockResolvedValue({
        partner_user_id: 'partner-456',
        status: PartnerLinkStatus.ACTIVE,
      });

      await service.suspendAccount('user-123', 'Policy violation');

      // Verify the cascading order: revoke link, disable sharing, revoke sessions
      expect(repository.revokePartnerLink).toHaveBeenCalledWith('user-123');
      expect(repository.disableSharingPreferences).toHaveBeenCalledWith('user-123');
      expect(repository.revokeUserSessions).toHaveBeenCalledWith('partner-456');
    });

    it('should not revoke partner access when no partner link exists', async () => {
      vi.mocked(repository.getUserBasicInfo).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: UserStatus.ACTIVE,
      });
      vi.mocked(repository.getActivePartnerLink).mockResolvedValue(null);

      const result = await service.suspendAccount('user-123', 'Some reason');

      expect(result.success).toBe(true);
      expect(repository.revokePartnerLink).not.toHaveBeenCalled();
      expect(repository.disableSharingPreferences).not.toHaveBeenCalled();
    });

    it('should send suspension notification email', async () => {
      vi.mocked(repository.getUserBasicInfo).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: UserStatus.ACTIVE,
      });

      await service.suspendAccount('user-123', 'Policy violation');

      expect(emailService.sendSuspensionNotification).toHaveBeenCalledWith(
        'test@example.com',
        'Policy violation',
      );
    });

    it('should succeed even if email sending fails', async () => {
      vi.mocked(repository.getUserBasicInfo).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: UserStatus.ACTIVE,
      });
      vi.mocked(emailService.sendSuspensionNotification).mockRejectedValue(
        new Error('Email service unavailable'),
      );

      const result = await service.suspendAccount('user-123', 'Policy violation');

      expect(result.success).toBe(true);
      expect(result.data?.emailSent).toBe(false);
    });

    it('should reject empty suspension reason', async () => {
      const result = await service.suspendAccount('user-123', '');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminErrorCode.VALIDATION_ERROR);
    });

    it('should reject suspension reason exceeding 500 characters', async () => {
      const longReason = 'a'.repeat(501);

      const result = await service.suspendAccount('user-123', longReason);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminErrorCode.VALIDATION_ERROR);
    });

    it('should accept suspension reason of exactly 500 characters', async () => {
      vi.mocked(repository.getUserBasicInfo).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: UserStatus.ACTIVE,
      });
      const reason = 'a'.repeat(500);

      const result = await service.suspendAccount('user-123', reason);

      expect(result.success).toBe(true);
    });

    it('should accept suspension reason of exactly 1 character', async () => {
      vi.mocked(repository.getUserBasicInfo).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: UserStatus.ACTIVE,
      });

      const result = await service.suspendAccount('user-123', 'X');

      expect(result.success).toBe(true);
    });

    it('should reject suspending an already suspended user', async () => {
      vi.mocked(repository.getUserBasicInfo).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: UserStatus.SUSPENDED,
      });

      const result = await service.suspendAccount('user-123', 'Another reason');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminErrorCode.ALREADY_SUSPENDED);
    });

    it('should reject suspending a deleted user', async () => {
      vi.mocked(repository.getUserBasicInfo).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: UserStatus.DELETED,
      });

      const result = await service.suspendAccount('user-123', 'Some reason');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminErrorCode.ALREADY_DELETED);
    });

    it('should return error when user not found', async () => {
      vi.mocked(repository.getUserBasicInfo).mockResolvedValue(null);

      const result = await service.suspendAccount('nonexistent', 'Some reason');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminErrorCode.USER_NOT_FOUND);
    });
  });

  // ─── deleteAccount ───────────────────────────────────────────────────────

  describe('deleteAccount', () => {
    it('should delete account with cascade when confirmed', async () => {
      vi.mocked(repository.getUserBasicInfo).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: UserStatus.ACTIVE,
      });
      vi.mocked(repository.deleteCycleRecords).mockResolvedValue(5);
      vi.mocked(repository.deletePersonalNotes).mockResolvedValue(3);
      vi.mocked(repository.deleteSurveyResponses).mockResolvedValue(6);
      vi.mocked(repository.deleteSharingPreferences).mockResolvedValue(1);
      vi.mocked(repository.deleteDailySummaries).mockResolvedValue(10);
      vi.mocked(repository.deleteDateRequests).mockResolvedValue(2);

      const result = await service.deleteAccount('user-123', true);

      expect(result.success).toBe(true);
      expect(result.data?.userId).toBe('user-123');
      expect(result.data?.cycleRecordsDeleted).toBe(5);
      expect(result.data?.personalNotesDeleted).toBe(3);
      expect(result.data?.surveyResponsesDeleted).toBe(6);
      expect(result.data?.sharingPreferencesDeleted).toBe(1);
      expect(result.data?.dailySummariesDeleted).toBe(10);
      expect(result.data?.dateRequestsDeleted).toBe(2);
      expect(result.data?.partnerAccessRevoked).toBe(false);
      expect(repository.deleteUser).toHaveBeenCalledWith('user-123');
    });

    it('should revoke partner access on primary user deletion', async () => {
      vi.mocked(repository.getUserBasicInfo).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: UserStatus.ACTIVE,
      });
      vi.mocked(repository.getActivePartnerLink).mockResolvedValue({
        partner_user_id: 'partner-456',
        status: PartnerLinkStatus.ACTIVE,
      });

      const result = await service.deleteAccount('user-123', true);

      expect(result.success).toBe(true);
      expect(result.data?.partnerAccessRevoked).toBe(true);
      expect(repository.deactivatePartner).toHaveBeenCalledWith('partner-456');
    });

    it('should reject deletion without confirmation', async () => {
      const result = await service.deleteAccount('user-123', false);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminErrorCode.DELETION_NOT_CONFIRMED);
    });

    it('should return error when user not found', async () => {
      vi.mocked(repository.getUserBasicInfo).mockResolvedValue(null);

      const result = await service.deleteAccount('nonexistent', true);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminErrorCode.USER_NOT_FOUND);
    });

    it('should reject deleting an already deleted user', async () => {
      vi.mocked(repository.getUserBasicInfo).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: UserStatus.DELETED,
      });

      const result = await service.deleteAccount('user-123', true);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminErrorCode.ALREADY_DELETED);
    });

    it('should cascade all associated data on deletion', async () => {
      vi.mocked(repository.getUserBasicInfo).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: UserStatus.ACTIVE,
      });

      await service.deleteAccount('user-123', true);

      expect(repository.deleteCycleRecords).toHaveBeenCalledWith('user-123');
      expect(repository.deletePersonalNotes).toHaveBeenCalledWith('user-123');
      expect(repository.deleteSurveyResponses).toHaveBeenCalledWith('user-123');
      expect(repository.deleteSharingPreferences).toHaveBeenCalledWith('user-123');
      expect(repository.deleteDailySummaries).toHaveBeenCalledWith('user-123');
      expect(repository.deleteDateRequests).toHaveBeenCalledWith('user-123');
      expect(repository.deleteUser).toHaveBeenCalledWith('user-123');
    });
  });
});
