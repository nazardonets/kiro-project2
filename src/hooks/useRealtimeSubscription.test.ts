import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useRealtimeSubscription } from './useRealtimeSubscription';

// ─── Mock Supabase Client ───────────────────────────────────────────────────

type SubscribeCallback = (status: string) => void;
type PostgresChangesCallback = () => void;

let _mockSubscribeCallback: SubscribeCallback | null = null;
let mockPostgresCallbacks: Map<string, PostgresChangesCallback> = new Map();

const mockRemoveChannel = vi.fn();
const mockSubscribe = vi.fn((callback: SubscribeCallback) => {
  _mockSubscribeCallback = callback;
  // Simulate async subscription
  setTimeout(() => callback('SUBSCRIBED'), 0);
  return mockChannel;
});

const mockOn = vi.fn(
  (_event: string, opts: { table: string }, callback: PostgresChangesCallback) => {
    mockPostgresCallbacks.set(opts.table, callback);
    return mockChannel;
  },
);

const mockChannel = {
  on: mockOn,
  subscribe: mockSubscribe,
};

const mockSupabaseClient = {
  channel: vi.fn(() => mockChannel),
  removeChannel: mockRemoveChannel,
};

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useRealtimeSubscription', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    _mockSubscribeCallback = null;
    mockPostgresCallbacks = new Map();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not subscribe when primaryUserId is null', () => {
    const onSharingChange = vi.fn();
    const onCycleDataChange = vi.fn();

    const { result } = renderHook(() =>
      useRealtimeSubscription({
        primaryUserId: null,
        onSharingChange,
        onCycleDataChange,
      }),
    );

    expect(mockSupabaseClient.channel).not.toHaveBeenCalled();
    expect(result.current.connectionStatus).toBe('disconnected');
  });

  it('does not subscribe when enabled is false', () => {
    const onSharingChange = vi.fn();
    const onCycleDataChange = vi.fn();

    const { result } = renderHook(() =>
      useRealtimeSubscription({
        primaryUserId: 'user-123',
        onSharingChange,
        onCycleDataChange,
        enabled: false,
      }),
    );

    expect(mockSupabaseClient.channel).not.toHaveBeenCalled();
    expect(result.current.connectionStatus).toBe('disconnected');
  });

  it('subscribes to sharing_preferences, cycle_record, and partner_link tables', () => {
    const onSharingChange = vi.fn();
    const onCycleDataChange = vi.fn();

    renderHook(() =>
      useRealtimeSubscription({
        primaryUserId: 'user-123',
        onSharingChange,
        onCycleDataChange,
      }),
    );

    expect(mockSupabaseClient.channel).toHaveBeenCalledWith('partner-dashboard-user-123');
    expect(mockOn).toHaveBeenCalledTimes(3);

    // Verify table subscriptions
    const tableArgs = mockOn.mock.calls.map((call) => call[1].table);
    expect(tableArgs).toContain('sharing_preferences');
    expect(tableArgs).toContain('cycle_record');
    expect(tableArgs).toContain('partner_link');
  });

  it('filters subscriptions by primary_user_id', () => {
    const onSharingChange = vi.fn();
    const onCycleDataChange = vi.fn();

    renderHook(() =>
      useRealtimeSubscription({
        primaryUserId: 'user-456',
        onSharingChange,
        onCycleDataChange,
      }),
    );

    // All subscriptions should filter by primary_user_id
    for (const call of mockOn.mock.calls) {
      expect((call[1] as Record<string, string>).filter).toBe('primary_user_id=eq.user-456');
    }
  });

  it('sets connectionStatus to connected on successful subscription', async () => {
    const onSharingChange = vi.fn();
    const onCycleDataChange = vi.fn();

    const { result } = renderHook(() =>
      useRealtimeSubscription({
        primaryUserId: 'user-123',
        onSharingChange,
        onCycleDataChange,
      }),
    );

    // Initially connecting
    expect(result.current.connectionStatus).toBe('connecting');

    // Flush the setTimeout in the mock subscribe callback
    act(() => {
      vi.runAllTimers();
    });

    expect(result.current.connectionStatus).toBe('connected');
    expect(result.current.isUsingFallback).toBe(false);
  });

  it('triggers onSharingChange when sharing_preferences change', async () => {
    const onSharingChange = vi.fn();
    const onCycleDataChange = vi.fn();

    renderHook(() =>
      useRealtimeSubscription({
        primaryUserId: 'user-123',
        onSharingChange,
        onCycleDataChange,
      }),
    );

    // Simulate successful subscription
    act(() => {
      vi.runAllTimers();
    });

    // Simulate sharing_preferences change
    const sharingCallback = mockPostgresCallbacks.get('sharing_preferences');
    expect(sharingCallback).toBeDefined();

    act(() => {
      if (sharingCallback) sharingCallback();
    });

    expect(onSharingChange).toHaveBeenCalledTimes(1);
  });

  it('triggers onCycleDataChange when cycle_record changes', async () => {
    const onSharingChange = vi.fn();
    const onCycleDataChange = vi.fn();

    renderHook(() =>
      useRealtimeSubscription({
        primaryUserId: 'user-123',
        onSharingChange,
        onCycleDataChange,
      }),
    );

    // Simulate successful subscription
    act(() => {
      vi.runAllTimers();
    });

    // Simulate cycle_record change
    const cycleCallback = mockPostgresCallbacks.get('cycle_record');
    expect(cycleCallback).toBeDefined();

    act(() => {
      if (cycleCallback) cycleCallback();
    });

    expect(onCycleDataChange).toHaveBeenCalledTimes(1);
  });

  it('triggers onSharingChange when partner_link changes (Req 2.3)', async () => {
    const onSharingChange = vi.fn();
    const onCycleDataChange = vi.fn();

    renderHook(() =>
      useRealtimeSubscription({
        primaryUserId: 'user-123',
        onSharingChange,
        onCycleDataChange,
      }),
    );

    // Simulate successful subscription
    act(() => {
      vi.runAllTimers();
    });

    // Simulate partner_link change (e.g., revocation)
    const linkCallback = mockPostgresCallbacks.get('partner_link');
    expect(linkCallback).toBeDefined();

    act(() => {
      if (linkCallback) linkCallback();
    });

    expect(onSharingChange).toHaveBeenCalledTimes(1);
  });

  it('falls back to polling after max reconnection attempts', async () => {
    const onSharingChange = vi.fn();
    const onCycleDataChange = vi.fn();

    // Override subscribe to capture the callback so we can call it multiple times
    let subscribeCallbackRef: SubscribeCallback | null = null;
    mockSubscribe.mockImplementation((callback: SubscribeCallback) => {
      subscribeCallbackRef = callback;
      return mockChannel;
    });

    const { result } = renderHook(() =>
      useRealtimeSubscription({
        primaryUserId: 'user-123',
        onSharingChange,
        onCycleDataChange,
      }),
    );

    expect(subscribeCallbackRef).not.toBeNull();

    // Simulate 5 CHANNEL_ERROR events (MAX_RECONNECT_ATTEMPTS)
    for (let i = 0; i < 5; i++) {
      act(() => {
        if (subscribeCallbackRef) subscribeCallbackRef('CHANNEL_ERROR');
      });
    }

    expect(result.current.connectionStatus).toBe('error');
    expect(result.current.isUsingFallback).toBe(true);
  });

  it('cleans up channel on unmount', async () => {
    const onSharingChange = vi.fn();
    const onCycleDataChange = vi.fn();

    const { unmount } = renderHook(() =>
      useRealtimeSubscription({
        primaryUserId: 'user-123',
        onSharingChange,
        onCycleDataChange,
      }),
    );

    act(() => {
      vi.runAllTimers();
    });

    unmount();

    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
  });

  it('falls back to polling when channel is closed', async () => {
    const onSharingChange = vi.fn();
    const onCycleDataChange = vi.fn();

    // Override subscribe to simulate CLOSED status
    mockSubscribe.mockImplementation((callback: SubscribeCallback) => {
      _mockSubscribeCallback = callback;
      setTimeout(() => callback('CLOSED'), 0);
      return mockChannel;
    });

    const { result } = renderHook(() =>
      useRealtimeSubscription({
        primaryUserId: 'user-123',
        onSharingChange,
        onCycleDataChange,
      }),
    );

    act(() => {
      vi.runAllTimers();
    });

    expect(result.current.connectionStatus).toBe('disconnected');
    expect(result.current.isUsingFallback).toBe(true);
  });
});
