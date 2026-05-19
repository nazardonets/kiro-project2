import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { CyclePhase, NotificationLog, NotificationStatus, NotificationType } from '@/lib/types';

import {
  checkPartnerReminderEligibility,
  PartnerReminderCheckParams,
} from '../notification-service';

/**
 * Property 30: Reminder Rate Limit
 *
 * *For any* Partner_User on any given day, at most one reminder notification SHALL
 * be delivered, regardless of how many trigger conditions are met.
 *
 * **Validates: Requirements 18.4**
 */
describe('Property 30: Reminder Rate Limit', () => {
  /** High-energy phases where reminders are eligible */
  const highEnergyPhaseArb = fc.constantFrom(CyclePhase.OVULATION, CyclePhase.FOLLICULAR);

  /** Generate a NotificationLog representing a sent reminder */
  function makeSentReminderLog(): NotificationLog {
    return {
      id: crypto.randomUUID(),
      partner_user_id: 'partner-1',
      type: NotificationType.REMINDER,
      status: NotificationStatus.SENT,
      retry_count: 0,
      sent_at: new Date().toISOString(),
      next_retry_at: null,
    };
  }

  it('at most one reminder is sent regardless of how many attempts are made on the same day', () => {
    fc.assert(
      fc.property(
        // Generate 1-20 reminder attempts on the same day
        fc.integer({ min: 1, max: 20 }),
        highEnergyPhaseArb,
        (numAttempts, phase) => {
          const todayReminderLogs: NotificationLog[] = [];
          let sentCount = 0;

          for (let i = 0; i < numAttempts; i++) {
            const params: PartnerReminderCheckParams = {
              phase,
              reminders_enabled: true,
              partner_reminders: true,
              todayReminderLogs: [...todayReminderLogs],
            };

            const result = checkPartnerReminderEligibility(params);

            if (result.sent) {
              sentCount++;
              // Accumulate the log as if the reminder was actually sent
              todayReminderLogs.push(makeSentReminderLog());
            }
          }

          // At most ONE reminder should be marked as sent
          expect(sentCount).toBeLessThanOrEqual(1);
          // Exactly one should be sent (since all conditions are met for the first attempt)
          expect(sentCount).toBe(1);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('subsequent attempts after the first success return sent=false with reason about rate limit', () => {
    fc.assert(
      fc.property(
        // Generate 2-15 reminder attempts (need at least 2 to test subsequent)
        fc.integer({ min: 2, max: 15 }),
        highEnergyPhaseArb,
        (numAttempts, phase) => {
          // First attempt should succeed (no logs yet)
          const firstResult = checkPartnerReminderEligibility({
            phase,
            reminders_enabled: true,
            partner_reminders: true,
            todayReminderLogs: [],
          });

          expect(firstResult.sent).toBe(true);

          // Record the successful send
          const todayReminderLogs: NotificationLog[] = [makeSentReminderLog()];

          // All subsequent attempts should be rejected
          for (let i = 1; i < numAttempts; i++) {
            const result = checkPartnerReminderEligibility({
              phase,
              reminders_enabled: true,
              partner_reminders: true,
              todayReminderLogs: [...todayReminderLogs],
            });

            expect(result.sent).toBe(false);
            // Reason should mention that a reminder was already sent
            expect(result.reason).toBeDefined();
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            expect(result.reason!.toLowerCase()).toContain('already');
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('rate limit applies regardless of how many trigger conditions are met simultaneously', () => {
    fc.assert(
      fc.property(
        // Generate multiple trigger conditions (simulated as attempts with varying phases)
        fc.array(highEnergyPhaseArb, { minLength: 1, maxLength: 10 }),
        (phases) => {
          const todayReminderLogs: NotificationLog[] = [];
          let totalSent = 0;

          for (const phase of phases) {
            const result = checkPartnerReminderEligibility({
              phase,
              reminders_enabled: true,
              partner_reminders: true,
              todayReminderLogs: [...todayReminderLogs],
            });

            if (result.sent) {
              totalSent++;
              todayReminderLogs.push(makeSentReminderLog());
            }
          }

          // Regardless of how many triggers, at most one reminder per day
          expect(totalSent).toBeLessThanOrEqual(1);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('once a reminder log exists for today, no further reminders are eligible', () => {
    fc.assert(
      fc.property(
        // Generate 1-10 additional attempts after an existing log
        fc.integer({ min: 1, max: 10 }),
        highEnergyPhaseArb,
        (numAdditionalAttempts, phase) => {
          // Start with an existing sent reminder log (simulating one already sent today)
          const todayReminderLogs: NotificationLog[] = [makeSentReminderLog()];

          for (let i = 0; i < numAdditionalAttempts; i++) {
            const result = checkPartnerReminderEligibility({
              phase,
              reminders_enabled: true,
              partner_reminders: true,
              todayReminderLogs: [...todayReminderLogs],
            });

            // Every attempt should be blocked
            expect(result.sent).toBe(false);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('the first attempt on a day with no prior reminder logs is eligible', () => {
    fc.assert(
      fc.property(highEnergyPhaseArb, (phase) => {
        const result = checkPartnerReminderEligibility({
          phase,
          reminders_enabled: true,
          partner_reminders: true,
          todayReminderLogs: [],
        });

        // With all conditions met and no prior logs, should be eligible
        expect(result.sent).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});
