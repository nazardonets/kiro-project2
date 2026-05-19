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
import { UserRole, CyclePhase } from '@/lib/types';
import { AuthService } from '@/services/auth-service';

import { POST, PUT } from './route';

const mockCreateServerSupabaseClient = vi.mocked(createServerSupabaseClient);
const MockAuthService = vi.mocked(AuthService);

describe('POST /api/cycle/notes', () => {
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

    const request = new Request('http://localhost/api/cycle/notes', {
      method: 'POST',
      body: JSON.stringify({ phase: CyclePhase.MENSTRUAL, content: 'Test note' }),
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

    const request = new Request('http://localhost/api/cycle/notes', {
      method: 'POST',
      body: JSON.stringify({ phase: CyclePhase.MENSTRUAL, content: 'Test note' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.code).toBe('FORBIDDEN');
  });

  it('should return 400 for invalid input (missing content)', async () => {
    mockAuthServiceInstance.getUserContext.mockResolvedValue({
      success: true,
      data: {
        userId: 'primary-123',
        email: 'primary@example.com',
        role: UserRole.PRIMARY,
        linkedPartnerId: null,
      },
    });

    const request = new Request('http://localhost/api/cycle/notes', {
      method: 'POST',
      body: JSON.stringify({ phase: CyclePhase.MENSTRUAL, content: '' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for invalid phase value', async () => {
    mockAuthServiceInstance.getUserContext.mockResolvedValue({
      success: true,
      data: {
        userId: 'primary-123',
        email: 'primary@example.com',
        role: UserRole.PRIMARY,
        linkedPartnerId: null,
      },
    });

    const request = new Request('http://localhost/api/cycle/notes', {
      method: 'POST',
      body: JSON.stringify({ phase: 'invalid_phase', content: 'Test note' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('should return 201 on successful note creation', async () => {
    mockAuthServiceInstance.getUserContext.mockResolvedValue({
      success: true,
      data: {
        userId: 'primary-123',
        email: 'primary@example.com',
        role: UserRole.PRIMARY,
        linkedPartnerId: null,
      },
    });

    // Mock: no existing note
    const mockSelectChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    };

    // Mock: insert
    const mockInsertChain = {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'note-1',
              primary_user_id: 'primary-123',
              phase: CyclePhase.MENSTRUAL,
              content: 'I feel tired during this phase',
              updated_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      }),
    };

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mockSelectChain;
      return mockInsertChain;
    });

    const request = new Request('http://localhost/api/cycle/notes', {
      method: 'POST',
      body: JSON.stringify({
        phase: CyclePhase.MENSTRUAL,
        content: 'I feel tired during this phase',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.message).toBe('Personal note saved successfully');
    expect(data.note.phase).toBe(CyclePhase.MENSTRUAL);
  });

  it('should return 409 when note already exists for phase', async () => {
    mockAuthServiceInstance.getUserContext.mockResolvedValue({
      success: true,
      data: {
        userId: 'primary-123',
        email: 'primary@example.com',
        role: UserRole.PRIMARY,
        linkedPartnerId: null,
      },
    });

    // Mock: existing note found
    const mockSelectChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'existing-note' }, error: null }),
          }),
        }),
      }),
    };

    mockSupabase.from.mockReturnValue(mockSelectChain);

    const request = new Request('http://localhost/api/cycle/notes', {
      method: 'POST',
      body: JSON.stringify({ phase: CyclePhase.MENSTRUAL, content: 'New note' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.code).toBe('CONFLICT');
  });

  it('should return 500 for unexpected errors', async () => {
    mockAuthServiceInstance.getUserContext.mockRejectedValue(new Error('Unexpected'));

    const request = new Request('http://localhost/api/cycle/notes', {
      method: 'POST',
      body: JSON.stringify({ phase: CyclePhase.MENSTRUAL, content: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.code).toBe('INTERNAL_ERROR');
  });
});

describe('PUT /api/cycle/notes', () => {
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

    const request = new Request('http://localhost/api/cycle/notes', {
      method: 'PUT',
      body: JSON.stringify({ phase: CyclePhase.MENSTRUAL, content: 'Updated note' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe('UNAUTHENTICATED');
  });

  it('should return 200 when updating an existing note', async () => {
    mockAuthServiceInstance.getUserContext.mockResolvedValue({
      success: true,
      data: {
        userId: 'primary-123',
        email: 'primary@example.com',
        role: UserRole.PRIMARY,
        linkedPartnerId: null,
      },
    });

    // Mock: existing note found
    const mockSelectChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'existing-note' }, error: null }),
          }),
        }),
      }),
    };

    // Mock: update
    const mockUpdateChain = {
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'existing-note',
                  primary_user_id: 'primary-123',
                  phase: CyclePhase.MENSTRUAL,
                  content: 'Updated content',
                  updated_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mockSelectChain;
      return mockUpdateChain;
    });

    const request = new Request('http://localhost/api/cycle/notes', {
      method: 'PUT',
      body: JSON.stringify({ phase: CyclePhase.MENSTRUAL, content: 'Updated content' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Personal note updated successfully');
    expect(data.note.content).toBe('Updated content');
  });

  it('should return 200 when creating a note via PUT (upsert)', async () => {
    mockAuthServiceInstance.getUserContext.mockResolvedValue({
      success: true,
      data: {
        userId: 'primary-123',
        email: 'primary@example.com',
        role: UserRole.PRIMARY,
        linkedPartnerId: null,
      },
    });

    // Mock: no existing note
    const mockSelectChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    };

    // Mock: insert
    const mockInsertChain = {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'new-note',
              primary_user_id: 'primary-123',
              phase: CyclePhase.FOLLICULAR,
              content: 'New note via PUT',
              updated_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      }),
    };

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mockSelectChain;
      return mockInsertChain;
    });

    const request = new Request('http://localhost/api/cycle/notes', {
      method: 'PUT',
      body: JSON.stringify({ phase: CyclePhase.FOLLICULAR, content: 'New note via PUT' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Personal note updated successfully');
    expect(data.note.phase).toBe(CyclePhase.FOLLICULAR);
  });

  it('should return 500 for unexpected errors', async () => {
    mockAuthServiceInstance.getUserContext.mockRejectedValue(new Error('Unexpected'));

    const request = new Request('http://localhost/api/cycle/notes', {
      method: 'PUT',
      body: JSON.stringify({ phase: CyclePhase.MENSTRUAL, content: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.code).toBe('INTERNAL_ERROR');
  });
});
