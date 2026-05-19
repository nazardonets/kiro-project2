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

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole } from '@/lib/types';
import { AuthService } from '@/services/auth-service';

import { PUT } from './route';

const mockCreateServerSupabaseClient = vi.mocked(createServerSupabaseClient);
const MockAuthService = vi.mocked(AuthService);

describe('PUT /api/cycle/customize', () => {
  let mockAuthServiceInstance: { getUserContext: ReturnType<typeof vi.fn> };
  let mockSupabase: {
    from: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthServiceInstance = {
      getUserContext: vi.fn(),
    };
    mockSupabase = {
      from: vi.fn(),
    };
    MockAuthService.mockImplementation(function () {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return mockAuthServiceInstance as any;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateServerSupabaseClient.mockReturnValue(mockSupabase as any);
  });

  it('should return 401 when user is not authenticated', async () => {
    mockAuthServiceInstance.getUserContext.mockResolvedValue({
      success: false,
      error: { code: 'UNAUTHENTICATED', message: 'No authenticated user' },
    });

    const request = new Request('http://localhost/api/cycle/customize', {
      method: 'PUT',
      body: JSON.stringify({
        menstrual_days: 5,
        follicular_days: 8,
        ovulation_days: 1,
        early_luteal_days: 7,
        late_luteal_days: 7,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(request);
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

    const request = new Request('http://localhost/api/cycle/customize', {
      method: 'PUT',
      body: JSON.stringify({
        menstrual_days: 5,
        follicular_days: 8,
        ovulation_days: 1,
        early_luteal_days: 7,
        late_luteal_days: 7,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.code).toBe('FORBIDDEN');
  });

  it('should return 400 for invalid phase durations (out of range)', async () => {
    mockAuthServiceInstance.getUserContext.mockResolvedValue({
      success: true,
      data: {
        userId: 'primary-123',
        email: 'primary@example.com',
        role: UserRole.PRIMARY,
        linkedPartnerId: null,
      },
    });

    const request = new Request('http://localhost/api/cycle/customize', {
      method: 'PUT',
      body: JSON.stringify({
        menstrual_days: 0, // Invalid: below minimum
        follicular_days: 8,
        ovulation_days: 1,
        early_luteal_days: 7,
        late_luteal_days: 7,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when phase durations do not sum to cycle length', async () => {
    mockAuthServiceInstance.getUserContext.mockResolvedValue({
      success: true,
      data: {
        userId: 'primary-123',
        email: 'primary@example.com',
        role: UserRole.PRIMARY,
        linkedPartnerId: null,
      },
    });

    // Mock cycle records to establish cycle length of 28
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [{ cycle_length_days: 28 }],
            error: null,
          }),
        }),
      }),
    });

    const request = new Request('http://localhost/api/cycle/customize', {
      method: 'PUT',
      body: JSON.stringify({
        menstrual_days: 5,
        follicular_days: 8,
        ovulation_days: 1,
        early_luteal_days: 7,
        late_luteal_days: 5, // Sum = 26, not 28
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('should return 200 on successful customization update', async () => {
    mockAuthServiceInstance.getUserContext.mockResolvedValue({
      success: true,
      data: {
        userId: 'primary-123',
        email: 'primary@example.com',
        role: UserRole.PRIMARY,
        linkedPartnerId: null,
      },
    });

    const customization = {
      menstrual_days: 5,
      follicular_days: 8,
      ovulation_days: 1,
      early_luteal_days: 7,
      late_luteal_days: 7,
    };

    // Mock cycle records (single record, cycle length 28)
    const mockCycleRecordChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [{ cycle_length_days: 28 }],
            error: null,
          }),
        }),
      }),
    };

    // Mock phase_customization check (no existing)
    const mockCustomizationSelectChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    };

    // Mock insert
    const mockCustomizationInsertChain = {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'cust-1', primary_user_id: 'primary-123', ...customization },
            error: null,
          }),
        }),
      }),
    };

    let phaseCustomizationCallCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'cycle_record') return mockCycleRecordChain;
      if (table === 'phase_customization') {
        phaseCustomizationCallCount++;
        if (phaseCustomizationCallCount === 1) return mockCustomizationSelectChain;
        return mockCustomizationInsertChain;
      }
      return mockCycleRecordChain;
    });

    const request = new Request('http://localhost/api/cycle/customize', {
      method: 'PUT',
      body: JSON.stringify(customization),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Phase durations updated successfully');
    expect(data.customization).toBeDefined();
  });

  it('should return 500 for unexpected errors', async () => {
    mockAuthServiceInstance.getUserContext.mockRejectedValue(new Error('Unexpected'));

    const request = new Request('http://localhost/api/cycle/customize', {
      method: 'PUT',
      body: JSON.stringify({
        menstrual_days: 5,
        follicular_days: 8,
        ovulation_days: 1,
        early_luteal_days: 7,
        late_luteal_days: 7,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.code).toBe('INTERNAL_ERROR');
  });
});
