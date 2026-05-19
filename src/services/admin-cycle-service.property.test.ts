import * as fc from 'fast-check';
import { describe, it, expect, beforeEach } from 'vitest';

import { AdminAnnotation, AdminOverride, CyclePhase, CycleRecord } from '@/lib/types';

import { AdminCycleService, AdminCycleRepository } from './admin-cycle-service';

// ─── In-Memory Repository That Tracks Cycle Record Modifications ─────────────

/**
 * An in-memory repository implementation that tracks whether cycle records
 * are ever modified. This allows the property test to verify that admin
 * operations (annotations, overrides) never mutate original cycle data.
 */
class TrackingAdminCycleRepository implements AdminCycleRepository {
  private cycleRecords: Map<string, CycleRecord> = new Map();
  private annotations: Map<string, AdminAnnotation> = new Map();
  private overrides: Map<string, AdminOverride> = new Map();

  /** Tracks whether any cycle record was ever modified */
  public cycleRecordModified = false;

  /** Stores snapshots of cycle records at creation time for comparison */
  private originalSnapshots: Map<string, string> = new Map();

  private nextAnnotationId = 1;
  private nextOverrideId = 1;

  /** Add a cycle record to the repository */
  addCycleRecord(record: CycleRecord): void {
    this.cycleRecords.set(record.id, { ...record });
    this.originalSnapshots.set(record.id, JSON.stringify(record));
  }

  /** Check if any cycle record has been modified from its original state */
  verifyCycleRecordsUnmodified(): boolean {
    for (const [id, record] of this.cycleRecords) {
      const original = this.originalSnapshots.get(id);
      if (original !== JSON.stringify(record)) {
        return false;
      }
    }
    return true;
  }

  async getCycleRecordsByUser(userId: string): Promise<CycleRecord[]> {
    return Array.from(this.cycleRecords.values())
      .filter((r) => r.primary_user_id === userId)
      .sort((a, b) => b.start_date.localeCompare(a.start_date));
  }

  async getCycleRecordById(cycleRecordId: string): Promise<CycleRecord | null> {
    return this.cycleRecords.get(cycleRecordId) ?? null;
  }

  async getAnnotationsByCycleRecord(cycleRecordId: string): Promise<AdminAnnotation[]> {
    return Array.from(this.annotations.values()).filter((a) => a.cycle_record_id === cycleRecordId);
  }

  async getAnnotationById(annotationId: string): Promise<AdminAnnotation | null> {
    return this.annotations.get(annotationId) ?? null;
  }

  async createAnnotation(
    annotation: Omit<AdminAnnotation, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<AdminAnnotation> {
    const id = `annotation-${this.nextAnnotationId++}`;
    const now = new Date().toISOString();
    const created: AdminAnnotation = {
      ...annotation,
      id,
      created_at: now,
      updated_at: now,
    };
    this.annotations.set(id, created);
    return created;
  }

  async updateAnnotation(annotationId: string, content: string): Promise<AdminAnnotation> {
    const existing = this.annotations.get(annotationId);
    if (!existing) throw new Error(`Annotation ${annotationId} not found`);
    const updated: AdminAnnotation = {
      ...existing,
      content,
      updated_at: new Date().toISOString(),
    };
    this.annotations.set(annotationId, updated);
    return updated;
  }

  async deleteAnnotation(annotationId: string): Promise<void> {
    this.annotations.delete(annotationId);
  }

  async getOverridesByCycleRecord(cycleRecordId: string): Promise<AdminOverride[]> {
    return Array.from(this.overrides.values()).filter((o) => o.cycle_record_id === cycleRecordId);
  }

  async getOverrideById(overrideId: string): Promise<AdminOverride | null> {
    return this.overrides.get(overrideId) ?? null;
  }

  async getOverrideByPhase(
    cycleRecordId: string,
    phase: CyclePhase,
  ): Promise<AdminOverride | null> {
    return (
      Array.from(this.overrides.values()).find(
        (o) => o.cycle_record_id === cycleRecordId && o.phase === phase,
      ) ?? null
    );
  }

  async createOverride(
    override: Omit<AdminOverride, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<AdminOverride> {
    const id = `override-${this.nextOverrideId++}`;
    const now = new Date().toISOString();
    const created: AdminOverride = {
      ...override,
      id,
      created_at: now,
      updated_at: now,
    };
    this.overrides.set(id, created);
    return created;
  }

  async updateOverride(overrideId: string, replacementContent: string): Promise<AdminOverride> {
    const existing = this.overrides.get(overrideId);
    if (!existing) throw new Error(`Override ${overrideId} not found`);
    const updated: AdminOverride = {
      ...existing,
      replacement_content: replacementContent,
      updated_at: new Date().toISOString(),
    };
    this.overrides.set(overrideId, updated);
    return updated;
  }

  async deleteOverride(overrideId: string): Promise<void> {
    this.overrides.delete(overrideId);
  }
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Arbitrary for valid annotation content (1-2000 chars) */
const annotationContentArb = fc.string({ minLength: 1, maxLength: 2000 });

/** Arbitrary for valid override replacement content (1-2000 chars) */
const overrideContentArb = fc.string({ minLength: 1, maxLength: 2000 });

/** Arbitrary for CyclePhase enum values */
const cyclePhaseArb = fc.constantFrom(
  CyclePhase.MENSTRUAL,
  CyclePhase.FOLLICULAR,
  CyclePhase.OVULATION,
  CyclePhase.EARLY_LUTEAL,
  CyclePhase.LATE_LUTEAL,
);

/** Arbitrary for optional phase (null means cycle-level) */
const optionalPhaseArb = fc.oneof(fc.constant(null), cyclePhaseArb);

/** Arbitrary for cycle_length_days (realistic range) */
const cycleLengthArb = fc.integer({ min: 21, max: 45 });

/** Arbitrary for start_date (ISO date string within past year) */
const startDateArb = fc
  .date({
    min: new Date('2023-01-01'),
    max: new Date('2024-12-31'),
  })
  .map((d) => d.toISOString().split('T')[0]);

/** Operation types that can be performed on a cycle instance */
type AdminOperation =
  | { type: 'addAnnotation'; content: string; phase: CyclePhase | null }
  | { type: 'editAnnotation'; content: string }
  | { type: 'deleteAnnotation' }
  | { type: 'addOverride'; phase: CyclePhase; content: string; originalContent: string }
  | { type: 'editOverride'; content: string }
  | { type: 'revertOverride' };

/** Arbitrary for a sequence of admin operations */
const adminOperationArb: fc.Arbitrary<AdminOperation> = fc.oneof(
  fc.record({
    type: fc.constant('addAnnotation' as const),
    content: annotationContentArb,
    phase: optionalPhaseArb,
  }),
  fc.record({
    type: fc.constant('editAnnotation' as const),
    content: annotationContentArb,
  }),
  fc.record({
    type: fc.constant('deleteAnnotation' as const),
  }),
  fc.record({
    type: fc.constant('addOverride' as const),
    phase: cyclePhaseArb,
    content: overrideContentArb,
    originalContent: overrideContentArb,
  }),
  fc.record({
    type: fc.constant('editOverride' as const),
    content: overrideContentArb,
  }),
  fc.record({
    type: fc.constant('revertOverride' as const),
  }),
);

/** Arbitrary for a sequence of 1-10 admin operations */
const operationSequenceArb = fc.array(adminOperationArb, { minLength: 1, maxLength: 10 });

// ─── Property 12: Admin Annotations Preserve Original Data ──────────────────

/**
 * **Validates: Requirements 6.7**
 *
 * Property 12: Admin Annotations Preserve Original Data
 *
 * For any combination of Admin_Annotations and Admin_Overrides applied to a
 * Cycle_Instance, the original user-provided Cycle_Data (start_date, cycle records)
 * SHALL remain unmodified.
 */
describe('Property 12: Admin Annotations Preserve Original Data', () => {
  let repository: TrackingAdminCycleRepository;
  let service: AdminCycleService;

  const ADMIN_USER_ID = '770e8400-e29b-41d4-a716-446655440002';
  const USER_ID = '660e8400-e29b-41d4-a716-446655440001';
  const CYCLE_RECORD_ID = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    repository = new TrackingAdminCycleRepository();
    service = new AdminCycleService(repository);
  });

  it('original cycle record data remains unchanged after any sequence of annotation and override operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        startDateArb,
        cycleLengthArb,
        operationSequenceArb,
        async (startDate, cycleLength, operations) => {
          // Reset repository for each test case
          repository = new TrackingAdminCycleRepository();
          service = new AdminCycleService(repository);

          // Set up the cycle record with the generated data
          const cycleRecord: CycleRecord = {
            id: CYCLE_RECORD_ID,
            primary_user_id: USER_ID,
            start_date: startDate,
            cycle_length_days: cycleLength,
            created_at: '2024-01-01T00:00:00Z',
          };
          repository.addCycleRecord(cycleRecord);

          // Snapshot the original cycle record for comparison
          const originalStartDate = cycleRecord.start_date;
          const originalCycleLength = cycleRecord.cycle_length_days;
          const originalCreatedAt = cycleRecord.created_at;
          const originalUserId = cycleRecord.primary_user_id;

          // Track created annotation/override IDs for edit/delete operations
          const annotationIds: string[] = [];
          const overrideIds: string[] = [];

          // Execute the sequence of operations
          for (const op of operations) {
            switch (op.type) {
              case 'addAnnotation': {
                const result = await service.addAnnotation(
                  ADMIN_USER_ID,
                  CYCLE_RECORD_ID,
                  op.content,
                  op.phase,
                );
                if (result.success && result.data) {
                  annotationIds.push(result.data.id);
                }
                break;
              }
              case 'editAnnotation': {
                if (annotationIds.length > 0) {
                  const id = annotationIds[annotationIds.length - 1];
                  await service.editAnnotation(id, op.content);
                }
                break;
              }
              case 'deleteAnnotation': {
                if (annotationIds.length > 0) {
                  const id = annotationIds.pop() as string;
                  await service.deleteAnnotation(id);
                }
                break;
              }
              case 'addOverride': {
                const result = await service.addOverride(
                  ADMIN_USER_ID,
                  CYCLE_RECORD_ID,
                  op.phase,
                  op.content,
                  op.originalContent,
                );
                if (result.success && result.data) {
                  overrideIds.push(result.data.id);
                }
                break;
              }
              case 'editOverride': {
                if (overrideIds.length > 0) {
                  const id = overrideIds[overrideIds.length - 1];
                  await service.editOverride(id, op.content);
                }
                break;
              }
              case 'revertOverride': {
                if (overrideIds.length > 0) {
                  const id = overrideIds.pop() as string;
                  await service.revertOverride(id);
                }
                break;
              }
            }
          }

          // Verify the original cycle record data is unchanged
          const currentRecord = await repository.getCycleRecordById(CYCLE_RECORD_ID);
          expect(currentRecord).not.toBeNull();
          const record = currentRecord as CycleRecord;
          expect(record.start_date).toBe(originalStartDate);
          expect(record.cycle_length_days).toBe(originalCycleLength);
          expect(record.created_at).toBe(originalCreatedAt);
          expect(record.primary_user_id).toBe(originalUserId);
          expect(record.id).toBe(CYCLE_RECORD_ID);

          // Also verify via the tracking mechanism
          expect(repository.verifyCycleRecordsUnmodified()).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ─── Property 11: Cycle Instance Ordering ────────────────────────────────────

/** Arbitrary for a date string (YYYY-MM-DD) within a reasonable range (~3 years) */
const orderingDateArb = fc.integer({ min: 0, max: 1094 }).map((daysOffset) => {
  const base = new Date('2022-01-01T00:00:00Z');
  base.setUTCDate(base.getUTCDate() + daysOffset);
  const year = base.getUTCFullYear();
  const month = String(base.getUTCMonth() + 1).padStart(2, '0');
  const day = String(base.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
});

/** Arbitrary for the number of records to generate (various sizes) */
const recordCountArb = fc.oneof(
  fc.constant(0),
  fc.constant(1),
  fc.constant(2),
  fc.constant(5),
  fc.constant(12),
);

/** Arbitrary for a set of cycle records with random start dates for a given user */
const cycleRecordsForUserArb = (userId: string) =>
  recordCountArb.chain((count) =>
    fc.array(orderingDateArb, { minLength: count, maxLength: count }).map((dates) =>
      dates.map(
        (date, i): CycleRecord => ({
          id: `cycle-${i}`,
          primary_user_id: userId,
          start_date: date,
          cycle_length_days: 28,
          created_at: new Date().toISOString(),
        }),
      ),
    ),
  );

/**
 * **Validates: Requirements 6.1**
 *
 * Property 11: Cycle Instance Ordering
 *
 * For any set of Cycle_Instances belonging to a Primary_User, the admin display
 * order SHALL be descending by start_date (most recent first).
 */
describe('Property 11: Cycle Instance Ordering', () => {
  let repository: TrackingAdminCycleRepository;
  let service: AdminCycleService;

  const TEST_USER_ID = 'user-ordering-test-001';

  beforeEach(() => {
    repository = new TrackingAdminCycleRepository();
    service = new AdminCycleService(repository);
  });

  it('listCycleInstances always returns records in descending order by start_date', async () => {
    await fc.assert(
      fc.asyncProperty(cycleRecordsForUserArb(TEST_USER_ID), async (records) => {
        // Reset repository for each test case
        repository = new TrackingAdminCycleRepository();
        service = new AdminCycleService(repository);

        // Add records to the repository in arbitrary order
        for (const record of records) {
          repository.addCycleRecord(record);
        }

        // Call the service method
        const result = await service.listCycleInstances(TEST_USER_ID);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();

        const data = result.data ?? [];

        // Verify all records are returned
        expect(data.length).toBe(records.length);

        // Verify the result is in descending order by start_date
        for (let i = 0; i < data.length - 1; i++) {
          expect(data[i].start_date >= data[i + 1].start_date).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });
});
