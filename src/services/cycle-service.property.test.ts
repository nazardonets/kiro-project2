import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { DEFAULT_CYCLE_LENGTH, MAX_HISTORICAL_RECORDS } from '@/lib/constants';
import { CycleRecord } from '@/lib/types';

import {
  CycleRepository,
  CycleService,
  detectCycleOverlap,
  getEffectiveCycleLength,
} from './cycle-service';

/**
 * In-memory implementation of CycleRepository for property testing.
 */
class InMemoryCycleRepository implements CycleRepository {
  private records: CycleRecord[] = [];
  private nextId = 1;

  async getCycleRecords(userId: string): Promise<CycleRecord[]> {
    return this.records
      .filter((r) => r.primary_user_id === userId)
      .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
  }

  async getCycleRecordById(id: string): Promise<CycleRecord | null> {
    return this.records.find((r) => r.id === id) ?? null;
  }

  async createCycleRecord(record: Omit<CycleRecord, 'id' | 'created_at'>): Promise<CycleRecord> {
    const newRecord: CycleRecord = {
      ...record,
      id: String(this.nextId++),
      created_at: new Date().toISOString(),
    };
    this.records.push(newRecord);
    return newRecord;
  }

  async deleteCycleRecord(id: string): Promise<void> {
    this.records = this.records.filter((r) => r.id !== id);
  }

  /** Get the current count of records for a user */
  getRecordCount(userId: string): number {
    return this.records.filter((r) => r.primary_user_id === userId).length;
  }
}

/**
 * Helper to create a date string N days ago from today.
 */
function daysAgoStr(daysAgo: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * **Validates: Requirements 7.3**
 *
 * Property 15: Historical Cycle Record Limit
 *
 * For any Primary_User, the total number of historical cycle records
 * SHALL never exceed 12.
 */
describe('Property 15: Historical Cycle Record Limit', () => {
  it('for any sequence of creation attempts, stored records never exceed 12', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a sequence of 1 to 30 date offsets (days ago) to attempt creating records
        fc.array(fc.integer({ min: 0, max: 364 }), { minLength: 1, maxLength: 30 }),
        async (dateOffsets) => {
          const repo = new InMemoryCycleRepository();
          const svc = new CycleService(repo);
          const userId = 'user-prop-test';

          for (const offset of dateOffsets) {
            const dateStr = daysAgoStr(offset);
            // Use forceCreate=true to bypass overlap detection and focus on the record limit
            await svc.createCycleRecord(userId, dateStr, 28, true);
          }

          // Invariant: the number of stored records must never exceed MAX_HISTORICAL_RECORDS
          const storedCount = repo.getRecordCount(userId);
          expect(storedCount).toBeLessThanOrEqual(MAX_HISTORICAL_RECORDS);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('attempting to add a 13th record always fails with appropriate error', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate exactly 13 unique date offsets (spaced to avoid overlap)
        fc.uniqueArray(fc.integer({ min: 0, max: 364 }), {
          minLength: 13,
          maxLength: 13,
        }),
        async (dateOffsets) => {
          const repo = new InMemoryCycleRepository();
          const svc = new CycleService(repo);
          const userId = 'user-prop-test';

          // Create the first 12 records with forceCreate to bypass overlap
          for (let i = 0; i < 12; i++) {
            await svc.createCycleRecord(userId, daysAgoStr(dateOffsets[i]), 28, true);
          }

          // The 13th attempt should always fail
          const result = await svc.createCycleRecord(userId, daysAgoStr(dateOffsets[12]), 28, true);
          expect(result.success).toBe(false);
          expect(result.error).toContain(`${MAX_HISTORICAL_RECORDS}`);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('record count is monotonically non-decreasing up to the limit for valid inputs', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a sequence of unique offsets to avoid overlap issues
        fc.uniqueArray(fc.integer({ min: 0, max: 364 }), {
          minLength: 1,
          maxLength: 15,
        }),
        async (dateOffsets) => {
          const repo = new InMemoryCycleRepository();
          const svc = new CycleService(repo);
          const userId = 'user-prop-test';

          let previousCount = 0;

          for (const offset of dateOffsets) {
            const result = await svc.createCycleRecord(userId, daysAgoStr(offset), 28, true);

            const currentCount = repo.getRecordCount(userId);

            if (result.success) {
              // If creation succeeded, count should have increased by 1
              expect(currentCount).toBe(previousCount + 1);
            } else {
              // If creation failed (hit limit), count should remain unchanged
              expect(currentCount).toBe(previousCount);
            }

            // Invariant always holds
            expect(currentCount).toBeLessThanOrEqual(MAX_HISTORICAL_RECORDS);
            previousCount = currentCount;
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

/**
 * **Validates: Requirements 7.5**
 *
 * Property 16: Cycle Overlap Conflict Detection
 *
 * For any new cycle start date submitted by a Primary_User, if the date falls
 * within the calculated duration of an existing cycle record (based on average
 * cycle length or 28-day default), the system SHALL flag a conflict.
 */
describe('Property 16: Cycle Overlap Conflict Detection', () => {
  /**
   * Helper to create a date string from a base date plus an offset in days.
   */
  function dateFromOffset(baseDaysAgo: number, offsetDays: number): string {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - baseDaysAgo + offsetDays);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Helper to create a CycleRecord for testing.
   */
  function makeCycleRecord(
    startDate: string,
    cycleLengthDays: number,
    id: string = '1',
  ): CycleRecord {
    return {
      id,
      primary_user_id: 'user-test',
      start_date: startDate,
      cycle_length_days: cycleLengthDays,
      created_at: new Date().toISOString(),
    };
  }

  it('getEffectiveCycleLength returns DEFAULT_CYCLE_LENGTH when fewer than 2 records exist', () => {
    fc.assert(
      fc.property(fc.integer({ min: 20, max: 40 }), (cycleLengthDays) => {
        // 0 records
        expect(getEffectiveCycleLength([])).toBe(DEFAULT_CYCLE_LENGTH);

        // 1 record
        const singleRecord = makeCycleRecord('2024-01-01', cycleLengthDays);
        expect(getEffectiveCycleLength([singleRecord])).toBe(DEFAULT_CYCLE_LENGTH);
      }),
      { numRuns: 100 },
    );
  });

  it('getEffectiveCycleLength returns the average when 2+ records exist', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 20, max: 40 }), { minLength: 2, maxLength: 12 }),
        (cycleLengths) => {
          const records = cycleLengths.map((len, i) =>
            makeCycleRecord(`2024-01-${String(i + 1).padStart(2, '0')}`, len, String(i + 1)),
          );

          const expectedAvg = Math.round(
            cycleLengths.reduce((sum, l) => sum + l, 0) / cycleLengths.length,
          );

          expect(getEffectiveCycleLength(records)).toBe(expectedAvg);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('a new date within [existingStart, existingStart + effectiveCycleLength - 1] SHALL flag a conflict', () => {
    fc.assert(
      fc.property(
        // Random start date as days-ago offset (within 30-364)
        fc.integer({ min: 30, max: 364 }),
        // Random offset within the cycle window [0, effectiveCycleLength - 1]
        fc.integer({ min: 0, max: 27 }),
        (startDaysAgo, withinOffset) => {
          const existingStartDate = dateFromOffset(startDaysAgo, 0);
          const record = makeCycleRecord(existingStartDate, DEFAULT_CYCLE_LENGTH);
          const records = [record];

          // Effective cycle length is DEFAULT (28) since only 1 record
          const effectiveLength = getEffectiveCycleLength(records);
          // Clamp the offset to be within [0, effectiveLength - 1]
          const clampedOffset = withinOffset % effectiveLength;

          // New date is clampedOffset days AFTER the existing start date
          // dateFromOffset(startDaysAgo, +offset) moves toward today
          const newDate = dateFromOffset(startDaysAgo, clampedOffset);
          const result = detectCycleOverlap(newDate, records);

          expect(result.hasConflict).toBe(true);
          expect(result.conflictingRecord).toBeDefined();
        },
      ),
      { numRuns: 200 },
    );
  });

  it('a new date after the last day of the cycle window SHALL NOT flag a conflict', () => {
    fc.assert(
      fc.property(
        // Random start date as days-ago offset (within 60-364 to leave room)
        fc.integer({ min: 60, max: 364 }),
        // Random offset beyond the cycle window [1, 100] days past the end
        fc.integer({ min: 1, max: 100 }),
        (startDaysAgo, beyondOffset) => {
          const existingStartDate = dateFromOffset(startDaysAgo, 0);
          const record = makeCycleRecord(existingStartDate, DEFAULT_CYCLE_LENGTH);
          const records = [record];

          // Effective cycle length is DEFAULT (28) since only 1 record
          const effectiveLength = getEffectiveCycleLength(records);

          // New date is effectiveLength - 1 + beyondOffset days after the existing start
          // This places it beyond the cycle window
          const newDate = dateFromOffset(startDaysAgo, effectiveLength - 1 + beyondOffset);
          const result = detectCycleOverlap(newDate, records);

          expect(result.hasConflict).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('conflict detection uses average cycle length when 2+ records exist', () => {
    fc.assert(
      fc.property(
        // Generate 2-5 cycle lengths to compute average
        fc.array(fc.integer({ min: 24, max: 35 }), { minLength: 2, maxLength: 5 }),
        // Random start date as days-ago for the first record
        fc.integer({ min: 60, max: 300 }),
        // Random offset within the average cycle window
        fc.integer({ min: 0, max: 34 }),
        (cycleLengths, startDaysAgo, withinOffset) => {
          // Create records with spaced-out start dates to avoid inter-record conflicts
          const records = cycleLengths.map((len, i) =>
            makeCycleRecord(dateFromOffset(startDaysAgo + i * 40, 0), len, String(i + 1)),
          );

          const effectiveLength = getEffectiveCycleLength(records);
          // Clamp offset to be within [0, effectiveLength - 1]
          const clampedOffset = withinOffset % effectiveLength;

          // Target the first record's window: offset forward from its start date
          const newDate = dateFromOffset(startDaysAgo, clampedOffset);
          const result = detectCycleOverlap(newDate, records);

          expect(result.hasConflict).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('no conflict when no existing records exist', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 364 }), (daysAgo) => {
        const newDate = dateFromOffset(daysAgo, 0);
        const result = detectCycleOverlap(newDate, []);

        expect(result.hasConflict).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
