import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the route
const mockRegisterPrimaryUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => ({})),
}));

vi.mock('@/services/auth-service', () => ({
  AuthService: class MockAuthService {
    registerPrimaryUser = mockRegisterPrimaryUser;
  },
}));

import { POST } from './route';

function createMockRequest(body: unknown): Request {
  return new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 with VALIDATION_ERROR for invalid email', async () => {
    const request = createMockRequest({ email: 'not-an-email', password: 'ValidPass1' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.fields.email).toBeDefined();
  });

  it('should return 400 with VALIDATION_ERROR for missing password', async () => {
    const request = createMockRequest({ email: 'test@example.com' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.fields.password).toBeDefined();
  });

  it('should return 400 with VALIDATION_ERROR for weak password', async () => {
    const request = createMockRequest({ email: 'test@example.com', password: 'weak' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.fields.password).toBeDefined();
  });

  it('should return 201 on successful registration', async () => {
    mockRegisterPrimaryUser.mockResolvedValue({
      success: true,
      data: { userId: 'user-123', email: 'test@example.com', role: 'primary' },
    });

    const request = createMockRequest({ email: 'test@example.com', password: 'ValidPass1' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.message).toBe('Account created successfully');
    expect(data.user.userId).toBe('user-123');
    expect(data.user.email).toBe('test@example.com');
    expect(data.user.role).toBe('primary');
  });

  it('should return 409 when email is already in use', async () => {
    mockRegisterPrimaryUser.mockResolvedValue({
      success: false,
      error: { code: 'EMAIL_IN_USE', message: 'An account with this email already exists' },
    });

    const request = createMockRequest({ email: 'existing@example.com', password: 'ValidPass1' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.code).toBe('EMAIL_IN_USE');
  });

  it('should return 400 for other auth service errors', async () => {
    mockRegisterPrimaryUser.mockResolvedValue({
      success: false,
      error: { code: 'AUTH_ERROR', message: 'Something failed' },
    });

    const request = createMockRequest({ email: 'test@example.com', password: 'ValidPass1' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('AUTH_ERROR');
  });

  it('should return 500 for unexpected errors', async () => {
    mockRegisterPrimaryUser.mockRejectedValue(new Error('Unexpected'));

    const request = createMockRequest({ email: 'test@example.com', password: 'ValidPass1' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.code).toBe('INTERNAL_ERROR');
  });
});
