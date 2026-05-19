import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the route
const mockGetUserContext = vi.fn();
const mockGenerateInvite = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => ({})),
}));

vi.mock('@/services/auth-service', () => ({
  AuthService: class MockAuthService {
    getUserContext = mockGetUserContext;
  },
}));

vi.mock('@/services/invite-service', () => ({
  InviteService: class MockInviteService {
    generateInvite = mockGenerateInvite;
  },
}));

import { UserRole } from '@/lib/types';

import { POST } from './route';

describe('POST /api/auth/invite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when user is not authenticated', async () => {
    mockGetUserContext.mockResolvedValue({
      success: false,
      error: { code: 'UNAUTHENTICATED', message: 'No authenticated user' },
    });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe('UNAUTHENTICATED');
  });

  it('should return 403 when user is not a Primary_User', async () => {
    mockGetUserContext.mockResolvedValue({
      success: true,
      data: {
        userId: 'partner-123',
        email: 'partner@example.com',
        role: UserRole.PARTNER,
        linkedPartnerId: null,
      },
    });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.code).toBe('FORBIDDEN');
  });

  it('should return 201 on successful invite generation', async () => {
    mockGetUserContext.mockResolvedValue({
      success: true,
      data: {
        userId: 'primary-123',
        email: 'primary@example.com',
        role: UserRole.PRIMARY,
        linkedPartnerId: null,
      },
    });
    mockGenerateInvite.mockResolvedValue({
      success: true,
      data: { id: 'invite-1', token: 'unique-token', expiresAt: '2025-01-01T00:00:00Z' },
    });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.message).toBe('Invitation generated successfully');
    expect(data.invite.token).toBe('unique-token');
    expect(data.invite.expiresAt).toBe('2025-01-01T00:00:00Z');
    expect(mockGenerateInvite).toHaveBeenCalledWith('primary-123');
  });

  it('should return 409 when partner is already linked', async () => {
    mockGetUserContext.mockResolvedValue({
      success: true,
      data: {
        userId: 'primary-123',
        email: 'primary@example.com',
        role: UserRole.PRIMARY,
        linkedPartnerId: 'partner-456',
      },
    });
    mockGenerateInvite.mockResolvedValue({
      success: false,
      error: {
        code: 'PARTNER_ALREADY_LINKED',
        message: 'You already have an active partner link.',
      },
    });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.code).toBe('PARTNER_ALREADY_LINKED');
  });

  it('should return 500 for invite service errors without PARTNER_ALREADY_LINKED code', async () => {
    mockGetUserContext.mockResolvedValue({
      success: true,
      data: {
        userId: 'primary-123',
        email: 'primary@example.com',
        role: UserRole.PRIMARY,
        linkedPartnerId: null,
      },
    });
    mockGenerateInvite.mockResolvedValue({
      success: false,
      error: { code: 'INVITE_CREATION_FAILED', message: 'Failed to create invitation.' },
    });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.code).toBe('INVITE_CREATION_FAILED');
  });

  it('should return 500 for unexpected errors', async () => {
    mockGetUserContext.mockRejectedValue(new Error('Unexpected'));

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.code).toBe('INTERNAL_ERROR');
  });
});
