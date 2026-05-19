import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { MAX_NOTIFICATION_RETRIES, RETRY_INTERVAL_MINUTES } from '@/lib/constants';
import { NotificationStatus } from '@/lib/types';

import { calculateRetryState } from '../notification-service';

/**
 * Property 28: Notification Retry Logic
 *
 * *For any* failed Email_Notification delivery, the system SHALL retry up to 3 times
 * with 5-minute intervals between retries, and SHALL never exceed 3 retry attempts.
 *
 * **Validates: Requirements 17.11**
 */
describe('Property 28: Notification Retry Logic', () => {
  // Generate valid dates as timestamps to avoid NaN date issues
  const validDateArb = fc
    .integer({
      min: new Date('2020-01-01').getTime(),
      max: new Date('2030-12-31').getTime(),
    })
    .map((ts) => new Date(ts));

  it('retry_count never exceeds MAX_NOTIFICATION_RETRIES (3) for any input retry count', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary retry counts from 0 to well beyond the max
        fc.integer({ min: 0, max: 100 }),
        validDateArb,
        (currentRetryCount, currentTime) => {
          const result = calculateRetryState(currentRetryCount, currentTime);
          expect(result.retry_count).toBeLessThanOrEqual(MAX_NOTIFICATION_RETRIES);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('after 3 retries, status is "failed" and next_retry_at is null', () => {
    fc.assert(
      fc.property(
        // Generate retry counts at or above the max (2 means the next attempt is the 3rd)
        fc.integer({ min: MAX_NOTIFICATION_RETRIES - 1, max: 100 }),
        validDateArb,
        (currentRetryCount, currentTime) => {
          const result = calculateRetryState(currentRetryCount, currentTime);
          expect(result.status).toBe(NotificationStatus.FAILED);
          expect(result.next_retry_at).toBeNull();
          expect(result.retry_count).toBe(MAX_NOTIFICATION_RETRIES);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('before 3 retries, next_retry_at is exactly 5 minutes from currentTime', () => {
    fc.assert(
      fc.property(
        // Generate retry counts that are below the threshold (0 or 1 means retries remain)
        fc.integer({ min: 0, max: MAX_NOTIFICATION_RETRIES - 2 }),
        validDateArb,
        (currentRetryCount, currentTime) => {
          const result = calculateRetryState(currentRetryCount, currentTime);

          expect(result.next_retry_at).not.toBeNull();

          const expectedNextRetry = new Date(
            currentTime.getTime() + RETRY_INTERVAL_MINUTES * 60 * 1000,
          );
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          expect(result.next_retry_at!.getTime()).toBe(expectedNextRetry.getTime());
        },
      ),
      { numRuns: 200 },
    );
  });

  it('status transitions correctly: retrying when under limit, failed when at/over limit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        validDateArb,
        (currentRetryCount, currentTime) => {
          const result = calculateRetryState(currentRetryCount, currentTime);
          const newRetryCount = Math.min(currentRetryCount + 1, MAX_NOTIFICATION_RETRIES);

          if (newRetryCount >= MAX_NOTIFICATION_RETRIES) {
            // At or over limit: status must be 'failed'
            expect(result.status).toBe(NotificationStatus.FAILED);
          } else {
            // Under limit: status must be 'retrying'
            expect(result.status).toBe(NotificationStatus.RETRYING);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('retry interval is always exactly RETRY_INTERVAL_MINUTES (5) minutes when retries remain', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_NOTIFICATION_RETRIES - 2 }),
        validDateArb,
        (currentRetryCount, currentTime) => {
          const result = calculateRetryState(currentRetryCount, currentTime);

          expect(result.next_retry_at).not.toBeNull();

          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const intervalMs = result.next_retry_at!.getTime() - currentTime.getTime();
          const expectedIntervalMs = RETRY_INTERVAL_MINUTES * 60 * 1000;
          expect(intervalMs).toBe(expectedIntervalMs);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('sequential retry attempts eventually reach failed status after exactly 3 retries', () => {
    fc.assert(
      fc.property(validDateArb, (startTime) => {
        let currentRetryCount = 0;
        let currentTime = startTime;
        let result;

        // Simulate sequential retry attempts
        for (let attempt = 0; attempt < MAX_NOTIFICATION_RETRIES; attempt++) {
          result = calculateRetryState(currentRetryCount, currentTime);
          currentRetryCount = result.retry_count;

          if (result.next_retry_at) {
            currentTime = result.next_retry_at;
          }
        }

        // After exactly 3 attempts, should be permanently failed
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(result!.status).toBe(NotificationStatus.FAILED);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(result!.next_retry_at).toBeNull();
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(result!.retry_count).toBe(MAX_NOTIFICATION_RETRIES);
      }),
      { numRuns: 200 },
    );
  });
});
