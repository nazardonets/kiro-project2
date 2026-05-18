import { describe, it, expect, beforeEach } from 'vitest';

import { DEFAULT_CYCLE_LENGTH, MAX_HISTORICAL_RECORDS } from '@/lib/constants';
import { CycleRecord } from '@/lib/types';

import {
  CycleRepository,
  CycleService,
  detectCycleOverlap,
  getEffectiveCycleLength,
} from './cycle-service';

/**
 * In-memory implementation of CycleRepository for testing.
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

  /** Helper to seed records for testing */
  seed(records: CycleRecord[]): void {
    this.records = [...records];
  }
}

function makeRecord(overrides: Partial<CycleRecord> = {}): CycleRecord {
  return {
    id: '1',
    primary_user_id: 'user-1',
    start_date: '2024-01-01',
    cycle_length_days: 28,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('getEffectiveCycleLength', () => {
  it('returns DEFAULT_CYCLE_LENGTH when fewer than 2 records', () => {
    expect(getEffectiveCycleLength([])).toBe(DEFAULT_CYCLE_LENGTH);
    expect(getEffectiveCycleLength([makeRecord()])).toBe(DEFAULT_CYCLE_LENGTH);
  });

  it('returns average cycle length when 2+ records exist', () => {
    const records = [
      makeRecord({ id: '1', cycle_length_days: 26 }),
      makeRecord({ id: '2', cycle_length_days: 30 }),
    ];
    expect(getEffectiveCycleLength(records)).toBe(28);
  });

  it('rounds to nearest integer', () => {
    const records = [
      makeRecord({ id: '1', cycle_length_days: 27 }),
      makeRecord({ id: '2', cycle_length_days: 30 }),
      makeRecord({ id: '3', cycle_length_days: 29 }),
    ];
    // (27 + 30 + 29) / 3 = 28.67 → 29
    expect(getEffectiveCycleLength(records)).toBe(29);
  });
});

describe('detectCycleOverlap', () => {
  it('returns no conflict when no existing records', () => {
    const result = detectCycleOverlap('2024-03-01', []);
    expect(result.hasConflict).toBe(false);
  });

  it('detects conflict when new date falls within existing cycle duration (default 28 days)', () => {
    const existing = [makeRecord({ start_date: '2024-01-01', cycle_length_days: 28 })];
    // Day 15 of a 28-day cycle starting Jan 1 → Jan 15 is within [Jan 1, Jan 28]
    const result = detectCycleOverlap('2024-01-15', existing);
    expect(result.hasConflict).toBe(true);
    expect(result.conflictingRecord).toEqual(existing[0]);
    expect(result.message).toContain('2024-01-01');
  });

  it('detects conflict on the last day of the cycle', () => {
    const existing = [makeRecord({ start_date: '2024-01-01', cycle_length_days: 28 })];
    // Jan 28 is the last day of a 28-day cycle starting Jan 1
    const result = detectCycleOverlap('2024-01-28', existing);
    expect(result.hasConflict).toBe(true);
  });

  it('returns no conflict when new date is after existing cycle ends', () => {
    const existing = [makeRecord({ start_date: '2024-01-01', cycle_length_days: 28 })];
    // Jan 29 is one day after the 28-day cycle ends
    const result = detectCycleOverlap('2024-01-29', existing);
    expect(result.hasConflict).toBe(false);
  });

  it('returns no conflict when new date is before existing cycle starts', () => {
    const existing = [makeRecord({ start_date: '2024-02-01', cycle_length_days: 28 })];
    const result = detectCycleOverlap('2024-01-15', existing);
    expect(result.hasConflict).toBe(false);
  });

  it('uses average cycle length when 2+ records exist', () => {
    const existing = [
      makeRecord({ id: '1', start_date: '2024-01-01', cycle_length_days: 30 }),
      makeRecord({ id: '2', start_date: '2024-02-01', cycle_length_days: 32 }),
    ];
    // Average = (30 + 32) / 2 = 31
    // Cycle starting Feb 1 with length 31 covers Feb 1 - Mar 2
    const result = detectCycleOverlap('2024-03-02', existing);
    expect(result.hasConflict).toBe(true);

    // Mar 3 should be outside
    const result2 = detectCycleOverlap('2024-03-03', existing);
    expect(result2.hasConflict).toBe(false);
  });

  it('detects conflict on the start date itself', () => {
    const existing = [makeRecord({ start_date: '2024-01-01', cycle_length_days: 28 })];
    const result = detectCycleOverlap('2024-01-01', existing);
    expect(result.hasConflict).toBe(true);
  });
});

describe('CycleService', () => {
  let repository: InMemoryCycleRepository;
  let service: CycleService;

  beforeEach(() => {
    repository = new InMemoryCycleRepository();
    service = new CycleService(repository);
  });

  describe('createCycleRecord', () => {
    it('creates a valid cycle record', async () => {
      // Use today's date to ensure it's always valid
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = today.toISOString().split('T')[0];

      const result = await service.createCycleRecord('user-1', startDate);
      expect(result.success).toBe(true);
      expect(result.record).toBeDefined();
      expect(result.record?.primary_user_id).toBe('user-1');
      expect(result.record?.start_date).toBe(startDate);
      expect(result.record?.cycle_length_days).toBe(DEFAULT_CYCLE_LENGTH);
    });

    it('rejects invalid date format', async () => {
      const result = await service.createCycleRecord('user-1', 'not-a-date');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid date format');
    });

    it('rejects future dates', async () => {
      const tomorrow = new Date();
      tomorrow.setHours(0, 0, 0, 0);
      tomorrow.setDate(tomorrow.getDate() + 2);
      // Format as YYYY-MM-DD to avoid timezone issues
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');
      const futureDate = `${year}-${month}-${day}`;

      const result = await service.createCycleRecord('user-1', futureDate);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Start date must be today or earlier');
    });

    it('rejects dates older than 365 days', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 366);
      const dateStr = oldDate.toISOString().split('T')[0];

      const result = await service.createCycleRecord('user-1', dateStr);
      expect(result.success).toBe(false);
      expect(result.error).toContain('365 days');
    });

    it('enforces max 12 historical records', async () => {
      // Seed 12 records
      const records: CycleRecord[] = [];
      for (let i = 0; i < MAX_HISTORICAL_RECORDS; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (i * 30 + 1));
        records.push(
          makeRecord({
            id: String(i + 1),
            start_date: date.toISOString().split('T')[0],
          }),
        );
      }
      repository.seed(records);

      const today = new Date();
      const startDate = today.toISOString().split('T')[0];
      const result = await service.createCycleRecord('user-1', startDate);
      expect(result.success).toBe(false);
      expect(result.error).toContain(`${MAX_HISTORICAL_RECORDS}`);
    });

    it('returns conflict info when overlap detected', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existingDate = new Date(today);
      existingDate.setDate(existingDate.getDate() - 10);
      const existingDateStr = existingDate.toISOString().split('T')[0];

      repository.seed([makeRecord({ start_date: existingDateStr, cycle_length_days: 28 })]);

      // Try to create a record within the existing cycle
      const newDate = new Date(existingDate);
      newDate.setDate(newDate.getDate() + 5);
      const newDateStr = newDate.toISOString().split('T')[0];

      const result = await service.createCycleRecord('user-1', newDateStr);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cycle overlap conflict detected');
      expect(result.conflict).toBeDefined();
      expect(result.conflict?.hasConflict).toBe(true);
    });

    it('creates record when forceCreate is true despite conflict', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existingDate = new Date(today);
      existingDate.setDate(existingDate.getDate() - 10);
      const existingDateStr = existingDate.toISOString().split('T')[0];

      repository.seed([makeRecord({ start_date: existingDateStr, cycle_length_days: 28 })]);

      // Create within the existing cycle with forceCreate
      const newDate = new Date(existingDate);
      newDate.setDate(newDate.getDate() + 5);
      const newDateStr = newDate.toISOString().split('T')[0];

      const result = await service.createCycleRecord('user-1', newDateStr, 28, true);
      expect(result.success).toBe(true);
      expect(result.record).toBeDefined();
    });

    it('accepts custom cycle length', async () => {
      const today = new Date();
      const startDate = today.toISOString().split('T')[0];

      const result = await service.createCycleRecord('user-1', startDate, 32);
      expect(result.success).toBe(true);
      expect(result.record?.cycle_length_days).toBe(32);
    });
  });

  describe('getCycleRecords', () => {
    it('returns records for the specified user', async () => {
      const today = new Date();
      const date1 = new Date(today);
      date1.setDate(date1.getDate() - 30);
      const date2 = new Date(today);
      date2.setDate(date2.getDate() - 60);

      repository.seed([
        makeRecord({
          id: '1',
          primary_user_id: 'user-1',
          start_date: date1.toISOString().split('T')[0],
        }),
        makeRecord({
          id: '2',
          primary_user_id: 'user-1',
          start_date: date2.toISOString().split('T')[0],
        }),
        makeRecord({
          id: '3',
          primary_user_id: 'user-2',
          start_date: date1.toISOString().split('T')[0],
        }),
      ]);

      const records = await service.getCycleRecords('user-1');
      expect(records).toHaveLength(2);
      expect(records.every((r) => r.primary_user_id === 'user-1')).toBe(true);
    });

    it('returns records ordered by start_date descending', async () => {
      const today = new Date();
      const date1 = new Date(today);
      date1.setDate(date1.getDate() - 60);
      const date2 = new Date(today);
      date2.setDate(date2.getDate() - 30);

      repository.seed([
        makeRecord({ id: '1', start_date: date1.toISOString().split('T')[0] }),
        makeRecord({ id: '2', start_date: date2.toISOString().split('T')[0] }),
      ]);

      const records = await service.getCycleRecords('user-1');
      expect(new Date(records[0].start_date).getTime()).toBeGreaterThan(
        new Date(records[1].start_date).getTime(),
      );
    });

    it('returns empty array for user with no records', async () => {
      const records = await service.getCycleRecords('user-no-records');
      expect(records).toEqual([]);
    });
  });

  describe('getCycleRecordById', () => {
    it('returns the record when found', async () => {
      repository.seed([makeRecord({ id: 'rec-1' })]);
      const record = await service.getCycleRecordById('rec-1');
      expect(record).not.toBeNull();
      expect(record?.id).toBe('rec-1');
    });

    it('returns null when not found', async () => {
      const record = await service.getCycleRecordById('nonexistent');
      expect(record).toBeNull();
    });
  });

  describe('deleteCycleRecord', () => {
    it('removes the record', async () => {
      repository.seed([makeRecord({ id: 'rec-1' })]);
      await service.deleteCycleRecord('rec-1');
      const record = await service.getCycleRecordById('rec-1');
      expect(record).toBeNull();
    });
  });

  describe('getEffectiveCycleLength', () => {
    it('returns default when user has fewer than 2 records', async () => {
      const length = await service.getEffectiveCycleLength('user-1');
      expect(length).toBe(DEFAULT_CYCLE_LENGTH);
    });

    it('returns average when user has 2+ records', async () => {
      repository.seed([
        makeRecord({ id: '1', cycle_length_days: 26 }),
        makeRecord({ id: '2', cycle_length_days: 30 }),
      ]);
      const length = await service.getEffectiveCycleLength('user-1');
      expect(length).toBe(28);
    });
  });

  describe('checkConflict', () => {
    it('returns no conflict when no records exist', async () => {
      const result = await service.checkConflict('user-1', '2024-03-01');
      expect(result.hasConflict).toBe(false);
    });

    it('detects conflict with existing records', async () => {
      const today = new Date();
      const existingDate = new Date(today);
      existingDate.setDate(existingDate.getDate() - 10);
      const existingDateStr = existingDate.toISOString().split('T')[0];

      repository.seed([makeRecord({ start_date: existingDateStr, cycle_length_days: 28 })]);

      // Check a date within the existing cycle
      const checkDate = new Date(existingDate);
      checkDate.setDate(checkDate.getDate() + 5);
      const checkDateStr = checkDate.toISOString().split('T')[0];

      const result = await service.checkConflict('user-1', checkDateStr);
      expect(result.hasConflict).toBe(true);
    });
  });
});
