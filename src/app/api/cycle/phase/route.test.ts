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

vi.mock('@/services/phase-engine', () => ({
  calculateCurrentPhase: vi.fn(),
  customizationToDurations: vi.fn(),
  scalePhaseDurations: vi.fn(),
  calculateAverageCycleLength: vi.fn(),
}));

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole, CyclePhase } from '@/lib/types';
import { AuthService } from '@/services/auth-service';
import { calculateCurrentPhase } from '@/services/phase-engine';

import { GET } from './route';

const mockCreateServerSupabaseClient = vi.mocked(createServerSupabaseClient);
const MockAuthService = vi.mocked(AuthService);
const mockCalculateCurrentPhase = vi.mocked(calculateCurrentPhase);

describe('GET /api/cycle/phase', () => {
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

    const response = await GET();
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

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.code).toBe('FORBIDDEN');
  });

  it('should return 404 when no cycle records exist', async () => {
    mockAuthServiceInstance.getUserContext.mockResolvedValue({
      success: true,
      data: {
        userId: 'primary-123',
        email: 'primary@example.com',
        role: UserRole.PRIMARY,
        linkedPartnerId: null,
      },
    });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.code).toBe('NO_CYCLE_DATA');
  });

  it('should return 200 with phase calculation result', async () => {
    mockAuthServiceInstance.getUserContext.mockResolvedValue({
      success: true,
      data: {
        userId: 'primary-123',
        email: 'primary@example.com',
        role: UserRole.PRIMARY,
        linkedPartnerId: null,
      },
    });

    const mockRecords = [
      {
        id: 'r1',
        primary_user_id: 'primary-123',
        start_date: '2024-06-01',
        cycle_length_days: 28,
        created_at: '2024-06-01T00:00:00Z',
      },
    ];

    // First call: cycle_record query
    const mockCycleRecordChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockRecords, error: null }),
        }),
      }),
    };

    // Second call: phase_customization query
    const mockCustomizationChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'cycle_record') return mockCycleRecordChain;
      if (table === 'phase_customization') return mockCustomizationChain;
      return mockCycleRecordChain;
    });

    mockCalculateCurrentPhase.mockReturnValue({
      phase: CyclePhase.FOLLICULAR,
      dayInPhase: 3,
      isOverdue: false,
      totalCycleLength: 28,
      elapsedDays: 8,
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.phase).toBe(CyclePhase.FOLLICULAR);
    expect(data.day_in_phase).toBe(3);
    expect(data.is_overdue).toBe(false);
    expect(data.total_cycle_length).toBe(28);
    expect(data.elapsed_days).toBe(8);
  });

  it('should return 500 for unexpected errors', async () => {
    mockAuthServiceInstance.getUserContext.mockRejectedValue(new Error('Unexpected'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.code).toBe('INTERNAL_ERROR');
  });
});
