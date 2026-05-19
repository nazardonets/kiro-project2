import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { usePollingFallback } from './usePollingFallback';

describe('usePollingFallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not poll when disabled', () => {
    const onPoll = vi.fn();

    renderHook(() =>
      usePollingFallback({
        onPoll,
        enabled: false,
        intervalMs: 30_000,
      }),
    );

    vi.advanceTimersByTime(60_000);
    expect(onPoll).not.toHaveBeenCalled();
  });

  it('polls at the specified interval when enabled', () => {
    const onPoll = vi.fn();

    renderHook(() =>
      usePollingFallback({
        onPoll,
        enabled: true,
        intervalMs: 30_000,
      }),
    );

    expect(onPoll).not.toHaveBeenCalled();

    vi.advanceTimersByTime(30_000);
    expect(onPoll).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);
    expect(onPoll).toHaveBeenCalledTimes(2);
  });

  it('uses default 30-second interval when intervalMs is not specified', () => {
    const onPoll = vi.fn();

    renderHook(() =>
      usePollingFallback({
        onPoll,
        enabled: true,
      }),
    );

    vi.advanceTimersByTime(29_999);
    expect(onPoll).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onPoll).toHaveBeenCalledTimes(1);
  });

  it('stops polling when disabled after being enabled', () => {
    const onPoll = vi.fn();

    const { rerender } = renderHook(
      ({ enabled }) =>
        usePollingFallback({
          onPoll,
          enabled,
          intervalMs: 30_000,
        }),
      { initialProps: { enabled: true } },
    );

    vi.advanceTimersByTime(30_000);
    expect(onPoll).toHaveBeenCalledTimes(1);

    // Disable polling
    rerender({ enabled: false });

    vi.advanceTimersByTime(60_000);
    expect(onPoll).toHaveBeenCalledTimes(1); // No additional calls
  });

  it('resumes polling when re-enabled', () => {
    const onPoll = vi.fn();

    const { rerender } = renderHook(
      ({ enabled }) =>
        usePollingFallback({
          onPoll,
          enabled,
          intervalMs: 30_000,
        }),
      { initialProps: { enabled: false } },
    );

    vi.advanceTimersByTime(60_000);
    expect(onPoll).not.toHaveBeenCalled();

    // Enable polling
    rerender({ enabled: true });

    vi.advanceTimersByTime(30_000);
    expect(onPoll).toHaveBeenCalledTimes(1);
  });

  it('cleans up interval on unmount', () => {
    const onPoll = vi.fn();

    const { unmount } = renderHook(() =>
      usePollingFallback({
        onPoll,
        enabled: true,
        intervalMs: 30_000,
      }),
    );

    unmount();

    vi.advanceTimersByTime(60_000);
    expect(onPoll).not.toHaveBeenCalled();
  });

  it('uses the latest onPoll callback without restarting the interval', () => {
    let callCount = 0;
    const onPoll1 = vi.fn(() => {
      callCount = 1;
    });
    const onPoll2 = vi.fn(() => {
      callCount = 2;
    });

    const { rerender } = renderHook(
      ({ onPoll }) =>
        usePollingFallback({
          onPoll,
          enabled: true,
          intervalMs: 30_000,
        }),
      { initialProps: { onPoll: onPoll1 } },
    );

    // Update callback mid-interval
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    rerender({ onPoll: onPoll2 });

    // Complete the interval — should use the new callback
    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(callCount).toBe(2);
    expect(onPoll2).toHaveBeenCalledTimes(1);
  });
});
