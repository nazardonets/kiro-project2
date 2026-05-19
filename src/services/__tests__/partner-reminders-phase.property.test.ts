import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { CyclePhase, NotificationLog, NotificationStatus, NotificationType } from '@/lib/types';

import {
  checkPartnerReminderEligibility,
  isHighEnergyPhase,
  PartnerReminderCheckParams,
} from '../notification-service';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate any of the 5 cycle phases */
const cyclePhaseArb = fc.constantFrom(
  CyclePhase.MENSTRUAL,
  CyclePhase.FOLLICULAR,
  CyclePhase.OVULATION,
  CyclePhase.EARLY_LUTEAL,
  CyclePhase.LATE_LUTEAL,
);

/** Generate a notification log entry representing a reminder sent today */
const reminderLogArb: fc.Arbitrary<NotificationLog> = fc.record({
  id: fc.uuid(),
  partner_user_id: fc.uuid(),
  type: fc.constant(NotificationType.REMINDER),
  status: fc.constant(NotificationStatus.SENT),
  retry_count: fc.constant(0),
  sent_at: fc.constant(new Date().toISOString()),
  next_retry_at: fc.constant(null),
});

/** Generate today's reminder logs — either empty (no reminder sent) or with existing reminders */
const todayReminderLogsArb: fc.Arbitrary<NotificationLog[]> = fc.oneof(
  fc.constant([] as NotificationLog[]),
  fc.array(reminderLogArb, { minLength: 1, maxLength: 3 }),
);

/** Generate full PartnerReminderCheckParams with arbitrary combinations */
const partnerReminderParamsArb: fc.Arbitrary<PartnerReminderCheckParams> = fc.record({
  phase: cyclePhaseArb,
  reminders_enabled: fc.boolean(),
  partner_reminders: fc.boolean(),
  todayReminderLogs: todayReminderLogsArb,
});

// ─── Property 29: Reminders Only During High-Energy Phases ───────────────────

/**
 * **Validates: Requirements 18.1, 18.5, 18.6**
 *
 * Property 29: Reminders Only During High-Energy Phases
 *
 * For any day, partner reminders SHALL be sent if and only if the current
 * Cycle_Phase is Ovulation_Phase or Follicular_Phase, the Partner_User has
 * reminders enabled, AND the Primary_User has not disabled partner reminders
 * via sharing controls.
 */
describe('Property 29: Reminders Only During High-Energy Phases', () => {
  it('reminders are sent ONLY when ALL conditions are met: high-energy phase, reminders enabled, partner reminders enabled, and no reminder already sent today', () => {
    fc.assert(
      fc.property(partnerReminderParamsArb, (params) => {
        const result = checkPartnerReminderEligibility(params);

        const allConditionsMet =
          isHighEnergyPhase(params.phase) &&
          params.reminders_enabled === true &&
          params.partner_reminders === true &&
          params.todayReminderLogs.length === 0;

        if (allConditionsMet) {
          expect(result.sent).toBe(true);
        } else {
          expect(result.sent).toBe(false);
        }
      }),
      { numRuns: 1000 },
    );
  });

  it('reminders are NOT sent when the phase is not Ovulation or Follicular', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(CyclePhase.MENSTRUAL, CyclePhase.EARLY_LUTEAL, CyclePhase.LATE_LUTEAL),
        fc.boolean(),
        fc.boolean(),
        todayReminderLogsArb,
        (phase, remindersEnabled, partnerReminders, todayLogs) => {
          const result = checkPartnerReminderEligibility({
            phase,
            reminders_enabled: remindersEnabled,
            partner_reminders: partnerReminders,
            todayReminderLogs: todayLogs,
          });

          expect(result.sent).toBe(false);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('reminders are NOT sent when partner has reminders disabled', () => {
    fc.assert(
      fc.property(
        cyclePhaseArb,
        fc.boolean(),
        todayReminderLogsArb,
        (phase, partnerReminders, todayLogs) => {
          const result = checkPartnerReminderEligibility({
            phase,
            reminders_enabled: false,
            partner_reminders: partnerReminders,
            todayReminderLogs: todayLogs,
          });

          expect(result.sent).toBe(false);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('reminders are NOT sent when primary user has disabled partner reminders via sharing controls', () => {
    fc.assert(
      fc.property(
        cyclePhaseArb,
        fc.boolean(),
        todayReminderLogsArb,
        (phase, remindersEnabled, todayLogs) => {
          const result = checkPartnerReminderEligibility({
            phase,
            reminders_enabled: remindersEnabled,
            partner_reminders: false,
            todayReminderLogs: todayLogs,
          });

          expect(result.sent).toBe(false);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('reminders are NOT sent when a reminder was already sent today', () => {
    fc.assert(
      fc.property(
        cyclePhaseArb,
        fc.boolean(),
        fc.boolean(),
        fc.array(reminderLogArb, { minLength: 1, maxLength: 3 }),
        (phase, remindersEnabled, partnerReminders, todayLogs) => {
          const result = checkPartnerReminderEligibility({
            phase,
            reminders_enabled: remindersEnabled,
            partner_reminders: partnerReminders,
            todayReminderLogs: todayLogs,
          });

          expect(result.sent).toBe(false);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('isHighEnergyPhase returns true only for Ovulation and Follicular phases', () => {
    fc.assert(
      fc.property(cyclePhaseArb, (phase) => {
        const result = isHighEnergyPhase(phase);
        const expected = phase === CyclePhase.OVULATION || phase === CyclePhase.FOLLICULAR;
        expect(result).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  it('when all conditions are met, result.sent is true (positive case)', () => {
    fc.assert(
      fc.property(fc.constantFrom(CyclePhase.OVULATION, CyclePhase.FOLLICULAR), (phase) => {
        const result = checkPartnerReminderEligibility({
          phase,
          reminders_enabled: true,
          partner_reminders: true,
          todayReminderLogs: [],
        });

        expect(result.sent).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
