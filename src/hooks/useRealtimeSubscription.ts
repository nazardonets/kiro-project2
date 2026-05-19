'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

import { usePollingFallback } from './usePollingFallback';

/**
 * Supabase Realtime subscription hook for live dashboard updates.
 *
 * Subscribes to:
 * - sharing_preferences table changes (filtered by primary_user_id)
 * - cycle_record table changes (filtered by primary_user_id)
 *
 * When a change is detected, triggers a re-fetch of dashboard data.
 * Falls back to 30-second polling when Realtime connection is unavailable.
 *
 * Validates: Requirements 2.3, 3.4, 12.6
 * - Requirement 2.3: Remove Partner_User's access within 5 seconds of revocation
 * - Requirement 3.4: Apply sharing preference changes within 5 seconds
 * - Requirement 12.6: Update Insights_Dashboard within 60 seconds of phase transition
 */

/** Polling fallback interval when Realtime is unavailable (30 seconds per design spec) */
const FALLBACK_POLL_INTERVAL_MS = 30_000;

/** Maximum reconnection attempts before falling back to polling */
const MAX_RECONNECT_ATTEMPTS = 5;

export type RealtimeConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseRealtimeSubscriptionOptions {
  /** The primary_user_id to filter Realtime events for (the linked partner's primary user) */
  primaryUserId: string | null;
  /** Callback triggered when sharing preferences change */
  onSharingChange: () => void | Promise<void>;
  /** Callback triggered when cycle data changes */
  onCycleDataChange: () => void | Promise<void>;
  /** Whether the subscription should be active */
  enabled?: boolean;
}

interface UseRealtimeSubscriptionReturn {
  /** Current connection status */
  connectionStatus: RealtimeConnectionStatus;
  /** Whether the hook is using polling fallback instead of Realtime */
  isUsingFallback: boolean;
}

export function useRealtimeSubscription({
  primaryUserId,
  onSharingChange,
  onCycleDataChange,
  enabled = true,
}: UseRealtimeSubscriptionOptions): UseRealtimeSubscriptionReturn {
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>('connecting');
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  const reconnectAttemptsRef = useRef(0);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  // Keep callback refs stable to avoid re-subscribing on every render
  const onSharingChangeRef = useRef(onSharingChange);
  const onCycleDataChangeRef = useRef(onCycleDataChange);

  useEffect(() => {
    onSharingChangeRef.current = onSharingChange;
  }, [onSharingChange]);

  useEffect(() => {
    onCycleDataChangeRef.current = onCycleDataChange;
  }, [onCycleDataChange]);

  // Combined fallback callback that triggers both data refreshes
  const handleFallbackPoll = useCallback(() => {
    onSharingChangeRef.current();
    onCycleDataChangeRef.current();
  }, []);

  // Polling fallback — active only when Realtime is unavailable
  usePollingFallback({
    onPoll: handleFallbackPoll,
    enabled: isUsingFallback && enabled,
    intervalMs: FALLBACK_POLL_INTERVAL_MS,
  });

  useEffect(() => {
    if (!enabled || !primaryUserId) {
      setConnectionStatus('disconnected');
      return;
    }

    // Create Supabase client for Realtime
    const supabase = createClient();
    supabaseRef.current = supabase;

    // Create a single channel that listens to both tables
    const channelName = `partner-dashboard-${primaryUserId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sharing_preferences',
          filter: `primary_user_id=eq.${primaryUserId}`,
        },
        () => {
          // Sharing preferences changed — trigger re-fetch (Req 2.3, 3.4)
          onSharingChangeRef.current();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cycle_record',
          filter: `primary_user_id=eq.${primaryUserId}`,
        },
        () => {
          // Cycle data changed — trigger re-fetch (Req 12.6)
          onCycleDataChangeRef.current();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'partner_link',
          filter: `primary_user_id=eq.${primaryUserId}`,
        },
        () => {
          // Partner link status changed (e.g., revoked) — trigger sharing re-fetch (Req 2.3)
          onSharingChangeRef.current();
        },
      );

    // Subscribe and handle connection status
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setConnectionStatus('connected');
        setIsUsingFallback(false);
        reconnectAttemptsRef.current = 0;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reconnectAttemptsRef.current += 1;

        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          // Exceeded max reconnection attempts — fall back to polling
          setConnectionStatus('error');
          setIsUsingFallback(true);
        } else {
          setConnectionStatus('connecting');
        }
      } else if (status === 'CLOSED') {
        setConnectionStatus('disconnected');
        setIsUsingFallback(true);
      }
    });

    channelRef.current = channel;

    // Cleanup on unmount or when dependencies change
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [primaryUserId, enabled]);

  return {
    connectionStatus,
    isUsingFallback,
  };
}
