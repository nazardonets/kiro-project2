import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the route
const mockRegisterPartnerViaInvite = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => ({})),
}));

vi.mock('@/services/auth-service', () => ({
  AuthService: class MockAuthService {
    registerPartnerViaInvite = mockRegisterPartnerViaInvite;
  },
}));

import { POST } from './route';

function createMockRequest(body: unknown): Request {
  return new Request('http://localhost/api/auth/accept-invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/accept-invite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 with VALIDATION_ERROR for missing token', async () => {
    const request = createMockRequest({ email: 'partner@example.com', password: 'ValidPass1' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.fields.token).toBeDefined();
  });

  it('should return 400 with VALIDATION_ERROR for invalid email', async () => {
    const request = createMockRequest({
      token: 'valid-token',
      email: 'not-email',
      password: 'ValidPass1',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.fields.email).toBeDefined();
  });

  it('should return 400 with VALIDATION_ERROR for weak password', async () => {
    const request = createMockRequest({
      token: 'valid-token',
      email: 'partner@example.com',
      password: 'weak',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.fields.password).toBeDefined();
  });

  it('should return 201 on successful partner registration', async () => {
    mockRegisterPartnerViaInvite.mockResolvedValue({
      success: true,
      data: { userId: 'partner-456', email: 'partner@example.com', role: 'partner' },
    });

    const request = createMockRequest({
      token: 'valid-token',
      email: 'partner@example.com',
      password: 'ValidPass1',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.message).toBe('Partner account created successfully');
    expect(data.user.userId).toBe('partner-456');
    expect(data.user.role).toBe('partner');
    expect(mockRegisterPartnerViaInvite).toHaveBeenCalledWith(
      'valid-token',
      'partner@example.com',
      'ValidPass1',
    );
  });

  it('should return 404 for invalid invite token', async () => {
    mockRegisterPartnerViaInvite.mockResolvedValue({
      success: false,
      error: { code: 'INVALID_INVITE', message: 'The invitation token is invalid' },
    });

    const request = createMockRequest({
      token: 'invalid-token',
      email: 'partner@example.com',
      password: 'ValidPass1',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.code).toBe('INVALID_INVITE');
  });

  it('should return 410 for expired invite', async () => {
    mockRegisterPartnerViaInvite.mockResolvedValue({
      success: false,
      error: { code: 'INVITE_EXPIRED', message: 'This invitation has expired.' },
    });

    const request = createMockRequest({
      token: 'expired-token',
      email: 'partner@example.com',
      password: 'ValidPass1',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(410);
    expect(data.code).toBe('INVITE_EXPIRED');
  });

  it('should return 409 for already-used invite', async () => {
    mockRegisterPartnerViaInvite.mockResolvedValue({
      success: false,
      error: { code: 'INVITE_ALREADY_USED', message: 'This invitation has already been used' },
    });

    const request = createMockRequest({
      token: 'used-token',
      email: 'partner@example.com',
      password: 'ValidPass1',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.code).toBe('INVITE_ALREADY_USED');
  });

  it('should return 409 for email already in use', async () => {
    mockRegisterPartnerViaInvite.mockResolvedValue({
      success: false,
      error: { code: 'EMAIL_IN_USE', message: 'An account with this email already exists' },
    });

    const request = createMockRequest({
      token: 'valid-token',
      email: 'existing@example.com',
      password: 'ValidPass1',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.code).toBe('EMAIL_IN_USE');
  });

  it('should return 409 for partner link error', async () => {
    mockRegisterPartnerViaInvite.mockResolvedValue({
      success: false,
      error: { code: 'LINK_ERROR', message: 'Failed to create partner link.' },
    });

    const request = createMockRequest({
      token: 'valid-token',
      email: 'partner@example.com',
      password: 'ValidPass1',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.code).toBe('LINK_ERROR');
  });

  it('should return 500 for unexpected errors', async () => {
    mockRegisterPartnerViaInvite.mockRejectedValue(new Error('Unexpected'));

    const request = createMockRequest({
      token: 'valid-token',
      email: 'partner@example.com',
      password: 'ValidPass1',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.code).toBe('INTERNAL_ERROR');
  });
});
