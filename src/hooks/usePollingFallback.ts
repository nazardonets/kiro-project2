'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Polling fallback hook for when Supabase Realtime is unavailable.
 * Polls at a configurable interval (default 30 seconds per design spec).
 *
 * Validates: Design - Graceful Degradation (Supabase Realtime unavailable → Fall back to polling every 30 seconds)
 */

/** Default polling interval: 30 seconds */
const DEFAULT_POLL_INTERVAL_MS = 30_000;

interface UsePollingFallbackOptions {
  /** Callback to execute on each poll tick */
  onPoll: () => void | Promise<void>;
  /** Whether polling is enabled (typically true when Realtime is disconnected) */
  enabled: boolean;
  /** Polling interval in milliseconds (default: 30000) */
  intervalMs?: number;
}

export function usePollingFallback({
  onPoll,
  enabled,
  intervalMs = DEFAULT_POLL_INTERVAL_MS,
}: UsePollingFallbackOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onPollRef = useRef(onPoll);

  // Keep the callback ref up to date without re-triggering the effect
  useEffect(() => {
    onPollRef.current = onPoll;
  }, [onPoll]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      onPollRef.current();
    }, intervalMs);
  }, [intervalMs]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, startPolling, stopPolling]);

  return { isPolling: enabled && intervalRef.current !== null };
}
