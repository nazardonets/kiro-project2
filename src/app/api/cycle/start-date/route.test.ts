import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock('@/services/auth-service', () => {
  return {
    AuthService: vi.fn(function () {
      return {};
    }),
  };
});

vi.mock('@/services/cycle-service', () => {
  return {
    CycleService: vi.fn(function () {
      return {};
    }),
  };
});

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole } from '@/lib/types';
import { AuthService } from '@/services/auth-service';
import { CycleService } from '@/services/cycle-service';

import { POST } from './route';

const mockCreateServerSupabaseClient = vi.mocked(createServerSupabaseClient);
const MockAuthService = vi.mocked(AuthService);
const MockCycleService = vi.mocked(CycleService);

describe('POST /api/cycle/start-date', () => {
  let mockAuthServiceInstance: { getUserContext: ReturnType<typeof vi.fn> };
  let mockCycleServiceInstance: { createCycleRecord: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthServiceInstance = {
      getUserContext: vi.fn(),
    };
    mockCycleServiceInstance = {
      createCycleRecord: vi.fn(),
    };
    MockAuthService.mockImplementation(function () {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return mockAuthServiceInstance as any;
    });
    MockCycleService.mockImplementation(function () {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return mockCycleServiceInstance as any;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateServerSupabaseClient.mockReturnValue({} as any);
  });

  it('should return 401 when user is not authenticated', async () => {
    mockAuthServiceInstance.getUserContext.mockResolvedValue({
      success: false,
      error: { code: 'UNAUTHENTICATED', message: 'No authenticated user' },
    });

    const request = new Request('http://localhost/api/cycle/start-date', {
      method: 'POST',
      body: JSON.stringify({ start_date: '2024-01-15' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe('UNAUTHENTICATED');
  });

  it('should return 403 when user is not a Primary_User', async () => {
    mockAuthServiceInstance.getUserContext.mockResolvedValue({
      success: true,
      data: {
        userId: 'partner-123',
        email: 'partner@example.com',
        role: UserRole.PARTNER,
        linkedPartnerId: null,
      },
    });

    const request = new Request('http://localhost/api/cycle/start-date', {
      method: 'POST',
      body: JSON.stringify({ start_date: '2024-01-15' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.code).toBe('FORBIDDEN');
  });

  it('should return 400 for invalid date format', async () => {
    mockAuthServiceInstance.getUserContext.mockResolvedValue({
      success: true,
      data: {
        userId: 'primary-123',
        email: 'primary@example.com',
        role: UserRole.PRIMARY,
        linkedPartnerId: null,
      },
    });

    const request = new Request('http://localhost/api/cycle/start-date', {
      method: 'POST',
      body: JSON.stringify({ start_date: 'not-a-date' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for future dates', async () => {
    mockAuthServiceInstance.getUserContext.mockResolvedValue({
      success: true,
      data: {
        userId: 'primary-123',
        email: 'primary@example.com',
        role: UserRole.PRIMARY,
        linkedPartnerId: null,
      },
    });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const request = new Request('http://localhost/api/cycle/start-date', {
      method: 'POST',
      body: JSON.stringify({ start_date: futureDateStr }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('should return 201 on successful cycle record creation', async () => {
    mockAuthServiceInstance.getUserContext.mockResolvedValue({
      success: true,
      data: {
        userId: 'primary-123',
        email: 'primary@example.com',
        role: UserRole.PRIMARY,
        linkedPartnerId: null,
      },
    });

    const today = new Date().toISOString().split('T')[0];
    mockCycleServiceInstance.createCycleRecord.mockResolvedValue({
      success: true,
      record: {
        id: 'record-1',
        primary_user_id: 'primary-123',
        start_date: today,
        cycle_length_days: 28,
        created_at: new Date().toISOString(),
      },
    });

    const request = new Request('http://localhost/api/cycle/start-date', {
      method: 'POST',
      body: JSON.stringify({ start_date: today }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.message).toBe('Cycle record saved successfully');
    expect(data.record.id).toBe('record-1');
  });

  it('should return 409 when cycle overlap conflict is detected', async () => {
    mockAuthServiceInstance.getUserContext.mockResolvedValue({
      success: true,
      data: {
        userId: 'primary-123',
        email: 'primary@example.com',
        role: UserRole.PRIMARY,
        linkedPartnerId: null,
      },
    });

    const today = new Date().toISOString().split('T')[0];
    mockCycleServiceInstance.createCycleRecord.mockResolvedValue({
      success: false,
      error: 'Cycle overlap conflict detected',
      conflict: {
        hasConflict: true,
        conflictingRecord: {
          id: 'existing-1',
          start_date: today,
          primary_user_id: 'primary-123',
          cycle_length_days: 28,
          created_at: new Date().toISOString(),
        },
        message: 'Overlap detected',
      },
    });

    const request = new Request('http://localhost/api/cycle/start-date', {
      method: 'POST',
      body: JSON.stringify({ start_date: today }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.code).toBe('CONFLICT');
  });

  it('should return 500 for unexpected errors', async () => {
    mockAuthServiceInstance.getUserContext.mockRejectedValue(new Error('Unexpected'));

    const request = new Request('http://localhost/api/cycle/start-date', {
      method: 'POST',
      body: JSON.stringify({ start_date: '2024-01-15' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.code).toBe('INTERNAL_ERROR');
  });
});
