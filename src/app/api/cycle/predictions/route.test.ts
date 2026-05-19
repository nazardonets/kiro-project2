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
  generatePredictions: vi.fn(),
  customizationToDurations: vi.fn(),
}));

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole, CyclePhase } from '@/lib/types';
import { AuthService } from '@/services/auth-service';
import { generatePredictions } from '@/services/phase-engine';

import { GET } from './route';

const mockCreateServerSupabaseClient = vi.mocked(createServerSupabaseClient);
const MockAuthService = vi.mocked(AuthService);
const mockGeneratePredictions = vi.mocked(generatePredictions);

describe('GET /api/cycle/predictions', () => {
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

  it('should return 200 with 60-day predictions', async () => {
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

    mockGeneratePredictions.mockReturnValue([
      {
        phase: CyclePhase.MENSTRUAL,
        startDate: new Date('2024-06-15'),
        endDate: new Date('2024-06-19'),
        startDay: 1,
        endDay: 5,
      },
      {
        phase: CyclePhase.FOLLICULAR,
        startDate: new Date('2024-06-20'),
        endDate: new Date('2024-06-27'),
        startDay: 6,
        endDay: 13,
      },
    ]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.predictions).toHaveLength(2);
    expect(data.predictions[0].phase).toBe(CyclePhase.MENSTRUAL);
    expect(data.predictions[0].start_date).toBe('2024-06-15');
    expect(data.predictions[0].end_date).toBe('2024-06-19');
    expect(data.cycle_start_date).toBe('2024-06-01');
    expect(data.generated_at).toBeDefined();
  });

  it('should return 500 for unexpected errors', async () => {
    mockAuthServiceInstance.getUserContext.mockRejectedValue(new Error('Unexpected'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.code).toBe('INTERNAL_ERROR');
  });
});
