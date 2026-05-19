import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ANNOTATION_MAX_LENGTH } from '@/lib/constants';
import { AdminAnnotation, AdminOverride, CyclePhase, CycleRecord } from '@/lib/types';

import {
  AdminCycleService,
  AdminCycleRepository,
  AdminCycleErrorCode,
} from './admin-cycle-service';

// ─── Constants ───────────────────────────────────────────────────────────────

const MOCK_CYCLE_ID = '550e8400-e29b-41d4-a716-446655440000';
const MOCK_CYCLE_ID_2 = '550e8400-e29b-41d4-a716-446655440010';
const MOCK_CYCLE_ID_3 = '550e8400-e29b-41d4-a716-446655440020';
const MOCK_USER_ID = '660e8400-e29b-41d4-a716-446655440001';
const MOCK_ADMIN_ID = '770e8400-e29b-41d4-a716-446655440002';
const MOCK_ANNOTATION_ID = '880e8400-e29b-41d4-a716-446655440003';
const MOCK_OVERRIDE_ID = '990e8400-e29b-41d4-a716-446655440004';

// ─── Mock Helpers ────────────────────────────────────────────────────────────

function createMockRepository(): AdminCycleRepository {
  return {
    getCycleRecordsByUser: vi.fn().mockResolvedValue([]),
    getCycleRecordById: vi.fn().mockResolvedValue(null),
    getAnnotationsByCycleRecord: vi.fn().mockResolvedValue([]),
    getAnnotationById: vi.fn().mockResolvedValue(null),
    createAnnotation: vi.fn().mockResolvedValue(null),
    updateAnnotation: vi.fn().mockResolvedValue(null),
    deleteAnnotation: vi.fn().mockResolvedValue(undefined),
    getOverridesByCycleRecord: vi.fn().mockResolvedValue([]),
    getOverrideById: vi.fn().mockResolvedValue(null),
    getOverrideByPhase: vi.fn().mockResolvedValue(null),
    createOverride: vi.fn().mockResolvedValue(null),
    updateOverride: vi.fn().mockResolvedValue(null),
    deleteOverride: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockCycleRecord(overrides?: Partial<CycleRecord>): CycleRecord {
  return {
    id: MOCK_CYCLE_ID,
    primary_user_id: MOCK_USER_ID,
    start_date: '2024-03-01',
    cycle_length_days: 28,
    created_at: '2024-03-01T00:00:00Z',
    ...overrides,
  };
}

function createMockAnnotation(overrides?: Partial<AdminAnnotation>): AdminAnnotation {
  return {
    id: MOCK_ANNOTATION_ID,
    admin_user_id: MOCK_ADMIN_ID,
    cycle_record_id: MOCK_CYCLE_ID,
    phase: null,
    content: 'Test annotation content',
    created_at: '2024-03-01T00:00:00Z',
    updated_at: '2024-03-01T00:00:00Z',
    ...overrides,
  };
}

function createMockOverride(overrides?: Partial<AdminOverride>): AdminOverride {
  return {
    id: MOCK_OVERRIDE_ID,
    admin_user_id: MOCK_ADMIN_ID,
    cycle_record_id: MOCK_CYCLE_ID,
    phase: CyclePhase.MENSTRUAL,
    replacement_content: 'Custom admin content',
    original_content: 'Original system-generated content',
    created_at: '2024-03-01T00:00:00Z',
    updated_at: '2024-03-01T00:00:00Z',
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AdminCycleService', () => {
  let service: AdminCycleService;
  let repository: AdminCycleRepository;

  beforeEach(() => {
    repository = createMockRepository();
    service = new AdminCycleService(repository);
  });

  // ─── listCycleInstances ──────────────────────────────────────────────────

  describe('listCycleInstances', () => {
    it('should return cycle records ordered by start_date descending', async () => {
      const records = [
        createMockCycleRecord({ id: MOCK_CYCLE_ID_3, start_date: '2024-03-01' }),
        createMockCycleRecord({ id: MOCK_CYCLE_ID_2, start_date: '2024-02-01' }),
        createMockCycleRecord({ id: MOCK_CYCLE_ID, start_date: '2024-01-01' }),
      ];
      vi.mocked(repository.getCycleRecordsByUser).mockResolvedValue(records);

      const result = await service.listCycleInstances(MOCK_USER_ID);

      expect(result.success).toBe(true);
      const data = result.data ?? [];
      expect(data).toHaveLength(3);
      expect(data[0].start_date).toBe('2024-03-01');
      expect(data[1].start_date).toBe('2024-02-01');
      expect(data[2].start_date).toBe('2024-01-01');
      expect(repository.getCycleRecordsByUser).toHaveBeenCalledWith(MOCK_USER_ID);
    });

    it('should return empty array when user has no cycle records', async () => {
      vi.mocked(repository.getCycleRecordsByUser).mockResolvedValue([]);

      const result = await service.listCycleInstances(MOCK_USER_ID);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should reject empty user ID', async () => {
      const result = await service.listCycleInstances('');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminCycleErrorCode.VALIDATION_ERROR);
    });

    it('should reject whitespace-only user ID', async () => {
      const result = await service.listCycleInstances('   ');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminCycleErrorCode.VALIDATION_ERROR);
    });
  });

  // ─── getCycleInstanceDetails ─────────────────────────────────────────────

  describe('getCycleInstanceDetails', () => {
    it('should return cycle record with annotations and overrides', async () => {
      const cycleRecord = createMockCycleRecord();
      const annotations = [createMockAnnotation()];
      const overrides = [createMockOverride()];

      vi.mocked(repository.getCycleRecordById).mockResolvedValue(cycleRecord);
      vi.mocked(repository.getAnnotationsByCycleRecord).mockResolvedValue(annotations);
      vi.mocked(repository.getOverridesByCycleRecord).mockResolvedValue(overrides);

      const result = await service.getCycleInstanceDetails(MOCK_CYCLE_ID);

      expect(result.success).toBe(true);
      expect(result.data?.cycle_record).toEqual(cycleRecord);
      expect(result.data?.annotations).toEqual(annotations);
      expect(result.data?.overrides).toEqual(overrides);
    });

    it('should return error when cycle record not found', async () => {
      vi.mocked(repository.getCycleRecordById).mockResolvedValue(null);

      const result = await service.getCycleInstanceDetails('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminCycleErrorCode.CYCLE_RECORD_NOT_FOUND);
    });

    it('should return empty arrays when no annotations or overrides exist', async () => {
      vi.mocked(repository.getCycleRecordById).mockResolvedValue(createMockCycleRecord());
      vi.mocked(repository.getAnnotationsByCycleRecord).mockResolvedValue([]);
      vi.mocked(repository.getOverridesByCycleRecord).mockResolvedValue([]);

      const result = await service.getCycleInstanceDetails(MOCK_CYCLE_ID);

      expect(result.success).toBe(true);
      expect(result.data?.annotations).toEqual([]);
      expect(result.data?.overrides).toEqual([]);
    });
  });

  // ─── addAnnotation ───────────────────────────────────────────────────────

  describe('addAnnotation', () => {
    it('should create a cycle-level annotation', async () => {
      const cycleRecord = createMockCycleRecord();
      const createdAnnotation = createMockAnnotation({
        content: 'Important observation about this cycle',
      });

      vi.mocked(repository.getCycleRecordById).mockResolvedValue(cycleRecord);
      vi.mocked(repository.createAnnotation).mockResolvedValue(createdAnnotation);

      const result = await service.addAnnotation(
        MOCK_ADMIN_ID,
        MOCK_CYCLE_ID,
        'Important observation about this cycle',
        null,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(createdAnnotation);
      expect(repository.createAnnotation).toHaveBeenCalledWith({
        admin_user_id: MOCK_ADMIN_ID,
        cycle_record_id: MOCK_CYCLE_ID,
        phase: null,
        content: 'Important observation about this cycle',
      });
    });

    it('should create a phase-level annotation', async () => {
      const cycleRecord = createMockCycleRecord();
      const createdAnnotation = createMockAnnotation({
        phase: CyclePhase.OVULATION,
        content: 'Phase-specific note',
      });

      vi.mocked(repository.getCycleRecordById).mockResolvedValue(cycleRecord);
      vi.mocked(repository.createAnnotation).mockResolvedValue(createdAnnotation);

      const result = await service.addAnnotation(
        MOCK_ADMIN_ID,
        MOCK_CYCLE_ID,
        'Phase-specific note',
        CyclePhase.OVULATION,
      );

      expect(result.success).toBe(true);
      expect(repository.createAnnotation).toHaveBeenCalledWith({
        admin_user_id: MOCK_ADMIN_ID,
        cycle_record_id: MOCK_CYCLE_ID,
        phase: CyclePhase.OVULATION,
        content: 'Phase-specific note',
      });
    });

    it('should reject annotation with empty content', async () => {
      const result = await service.addAnnotation(MOCK_ADMIN_ID, MOCK_CYCLE_ID, '', null);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminCycleErrorCode.VALIDATION_ERROR);
    });

    it('should reject annotation exceeding 2000 characters', async () => {
      const longContent = 'a'.repeat(ANNOTATION_MAX_LENGTH + 1);

      const result = await service.addAnnotation(MOCK_ADMIN_ID, MOCK_CYCLE_ID, longContent, null);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminCycleErrorCode.VALIDATION_ERROR);
    });

    it('should accept annotation of exactly 1 character', async () => {
      const cycleRecord = createMockCycleRecord();
      const createdAnnotation = createMockAnnotation({ content: 'X' });

      vi.mocked(repository.getCycleRecordById).mockResolvedValue(cycleRecord);
      vi.mocked(repository.createAnnotation).mockResolvedValue(createdAnnotation);

      const result = await service.addAnnotation(MOCK_ADMIN_ID, MOCK_CYCLE_ID, 'X', null);

      expect(result.success).toBe(true);
    });

    it('should accept annotation of exactly 2000 characters', async () => {
      const cycleRecord = createMockCycleRecord();
      const content = 'a'.repeat(ANNOTATION_MAX_LENGTH);
      const createdAnnotation = createMockAnnotation({ content });

      vi.mocked(repository.getCycleRecordById).mockResolvedValue(cycleRecord);
      vi.mocked(repository.createAnnotation).mockResolvedValue(createdAnnotation);

      const result = await service.addAnnotation(MOCK_ADMIN_ID, MOCK_CYCLE_ID, content, null);

      expect(result.success).toBe(true);
    });

    it('should reject annotation with invalid cycle record ID', async () => {
      const result = await service.addAnnotation(
        MOCK_ADMIN_ID,
        'not-a-uuid',
        'Valid content',
        null,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminCycleErrorCode.VALIDATION_ERROR);
    });

    it('should return error when cycle record not found', async () => {
      vi.mocked(repository.getCycleRecordById).mockResolvedValue(null);

      const result = await service.addAnnotation(
        MOCK_ADMIN_ID,
        MOCK_CYCLE_ID,
        'Valid content',
        null,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminCycleErrorCode.CYCLE_RECORD_NOT_FOUND);
    });
  });

  // ─── editAnnotation ──────────────────────────────────────────────────────

  describe('editAnnotation', () => {
    it('should update annotation content', async () => {
      const existing = createMockAnnotation();
      const updated = createMockAnnotation({ content: 'Updated content' });

      vi.mocked(repository.getAnnotationById).mockResolvedValue(existing);
      vi.mocked(repository.updateAnnotation).mockResolvedValue(updated);

      const result = await service.editAnnotation(MOCK_ANNOTATION_ID, 'Updated content');

      expect(result.success).toBe(true);
      expect(result.data?.content).toBe('Updated content');
      expect(repository.updateAnnotation).toHaveBeenCalledWith(
        MOCK_ANNOTATION_ID,
        'Updated content',
      );
    });

    it('should reject empty content', async () => {
      const result = await service.editAnnotation(MOCK_ANNOTATION_ID, '');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminCycleErrorCode.VALIDATION_ERROR);
    });

    it('should reject content exceeding 2000 characters', async () => {
      const longContent = 'a'.repeat(ANNOTATION_MAX_LENGTH + 1);

      const result = await service.editAnnotation(MOCK_ANNOTATION_ID, longContent);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminCycleErrorCode.VALIDATION_ERROR);
    });

    it('should return error when annotation not found', async () => {
      vi.mocked(repository.getAnnotationById).mockResolvedValue(null);

      const result = await service.editAnnotation('nonexistent', 'New content');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminCycleErrorCode.ANNOTATION_NOT_FOUND);
    });
  });

  // ─── deleteAnnotation ────────────────────────────────────────────────────

  describe('deleteAnnotation', () => {
    it('should delete an existing annotation', async () => {
      vi.mocked(repository.getAnnotationById).mockResolvedValue(createMockAnnotation());

      const result = await service.deleteAnnotation(MOCK_ANNOTATION_ID);

      expect(result.success).toBe(true);
      expect(result.data?.deleted).toBe(true);
      expect(repository.deleteAnnotation).toHaveBeenCalledWith(MOCK_ANNOTATION_ID);
    });

    it('should return error when annotation not found', async () => {
      vi.mocked(repository.getAnnotationById).mockResolvedValue(null);

      const result = await service.deleteAnnotation('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminCycleErrorCode.ANNOTATION_NOT_FOUND);
    });
  });

  // ─── addOverride ─────────────────────────────────────────────────────────

  describe('addOverride', () => {
    it('should create an override for a phase', async () => {
      const cycleRecord = createMockCycleRecord();
      const createdOverride = createMockOverride();

      vi.mocked(repository.getCycleRecordById).mockResolvedValue(cycleRecord);
      vi.mocked(repository.getOverrideByPhase).mockResolvedValue(null);
      vi.mocked(repository.createOverride).mockResolvedValue(createdOverride);

      const result = await service.addOverride(
        MOCK_ADMIN_ID,
        MOCK_CYCLE_ID,
        CyclePhase.MENSTRUAL,
        'Custom admin content',
        'Original system-generated content',
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(createdOverride);
      expect(repository.createOverride).toHaveBeenCalledWith({
        admin_user_id: MOCK_ADMIN_ID,
        cycle_record_id: MOCK_CYCLE_ID,
        phase: CyclePhase.MENSTRUAL,
        replacement_content: 'Custom admin content',
        original_content: 'Original system-generated content',
      });
    });

    it('should reject override with empty replacement content', async () => {
      const result = await service.addOverride(
        MOCK_ADMIN_ID,
        MOCK_CYCLE_ID,
        CyclePhase.MENSTRUAL,
        '',
        'Original content',
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminCycleErrorCode.VALIDATION_ERROR);
    });

    it('should reject override exceeding 2000 characters', async () => {
      const longContent = 'a'.repeat(ANNOTATION_MAX_LENGTH + 1);

      const result = await service.addOverride(
        MOCK_ADMIN_ID,
        MOCK_CYCLE_ID,
        CyclePhase.MENSTRUAL,
        longContent,
        'Original content',
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminCycleErrorCode.VALIDATION_ERROR);
    });

    it('should accept override of exactly 2000 characters', async () => {
      const cycleRecord = createMockCycleRecord();
      const content = 'a'.repeat(ANNOTATION_MAX_LENGTH);
      const createdOverride = createMockOverride({ replacement_content: content });

      vi.mocked(repository.getCycleRecordById).mockResolvedValue(cycleRecord);
      vi.mocked(repository.getOverrideByPhase).mockResolvedValue(null);
      vi.mocked(repository.createOverride).mockResolvedValue(createdOverride);

      const result = await service.addOverride(
        MOCK_ADMIN_ID,
        MOCK_CYCLE_ID,
        CyclePhase.MENSTRUAL,
        content,
        'Original content',
      );

      expect(result.success).toBe(true);
    });

    it('should reject when cycle record not found', async () => {
      vi.mocked(repository.getCycleRecordById).mockResolvedValue(null);

      const result = await service.addOverride(
        MOCK_ADMIN_ID,
        MOCK_CYCLE_ID,
        CyclePhase.MENSTRUAL,
        'Replacement',
        'Original',
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminCycleErrorCode.CYCLE_RECORD_NOT_FOUND);
    });

    it('should reject when override already exists for the phase', async () => {
      const cycleRecord = createMockCycleRecord();
      const existingOverride = createMockOverride();

      vi.mocked(repository.getCycleRecordById).mockResolvedValue(cycleRecord);
      vi.mocked(repository.getOverrideByPhase).mockResolvedValue(existingOverride);

      const result = await service.addOverride(
        MOCK_ADMIN_ID,
        MOCK_CYCLE_ID,
        CyclePhase.MENSTRUAL,
        'New replacement',
        'Original',
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminCycleErrorCode.OVERRIDE_ALREADY_EXISTS);
    });

    it('should reject override with invalid cycle record ID', async () => {
      const result = await service.addOverride(
        MOCK_ADMIN_ID,
        'not-a-uuid',
        CyclePhase.MENSTRUAL,
        'Replacement',
        'Original',
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminCycleErrorCode.VALIDATION_ERROR);
    });
  });

  // ─── editOverride ────────────────────────────────────────────────────────

  describe('editOverride', () => {
    it('should update override replacement content', async () => {
      const existing = createMockOverride();
      const updated = createMockOverride({ replacement_content: 'Updated replacement' });

      vi.mocked(repository.getOverrideById).mockResolvedValue(existing);
      vi.mocked(repository.updateOverride).mockResolvedValue(updated);

      const result = await service.editOverride(MOCK_OVERRIDE_ID, 'Updated replacement');

      expect(result.success).toBe(true);
      expect(result.data?.replacement_content).toBe('Updated replacement');
      expect(repository.updateOverride).toHaveBeenCalledWith(
        MOCK_OVERRIDE_ID,
        'Updated replacement',
      );
    });

    it('should reject empty replacement content', async () => {
      const result = await service.editOverride(MOCK_OVERRIDE_ID, '');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminCycleErrorCode.VALIDATION_ERROR);
    });

    it('should reject replacement content exceeding 2000 characters', async () => {
      const longContent = 'a'.repeat(ANNOTATION_MAX_LENGTH + 1);

      const result = await service.editOverride(MOCK_OVERRIDE_ID, longContent);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminCycleErrorCode.VALIDATION_ERROR);
    });

    it('should return error when override not found', async () => {
      vi.mocked(repository.getOverrideById).mockResolvedValue(null);

      const result = await service.editOverride('nonexistent', 'New content');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminCycleErrorCode.OVERRIDE_NOT_FOUND);
    });
  });

  // ─── revertOverride ──────────────────────────────────────────────────────

  describe('revertOverride', () => {
    it('should revert override and return original content', async () => {
      const existing = createMockOverride({
        original_content: 'Original system-generated content',
      });

      vi.mocked(repository.getOverrideById).mockResolvedValue(existing);

      const result = await service.revertOverride(MOCK_OVERRIDE_ID);

      expect(result.success).toBe(true);
      expect(result.data?.reverted).toBe(true);
      expect(result.data?.original_content).toBe('Original system-generated content');
      expect(repository.deleteOverride).toHaveBeenCalledWith(MOCK_OVERRIDE_ID);
    });

    it('should return error when override not found', async () => {
      vi.mocked(repository.getOverrideById).mockResolvedValue(null);

      const result = await service.revertOverride('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AdminCycleErrorCode.OVERRIDE_NOT_FOUND);
    });
  });

  // ─── Data Preservation (Req 6.7) ────────────────────────────────────────

  describe('data preservation', () => {
    it('should not modify cycle record when adding annotation', async () => {
      const cycleRecord = createMockCycleRecord({
        start_date: '2024-03-01',
        cycle_length_days: 28,
      });
      const createdAnnotation = createMockAnnotation();

      vi.mocked(repository.getCycleRecordById).mockResolvedValue(cycleRecord);
      vi.mocked(repository.createAnnotation).mockResolvedValue(createdAnnotation);

      await service.addAnnotation(MOCK_ADMIN_ID, MOCK_CYCLE_ID, 'Annotation text', null);

      // Verify the cycle record was only read, never modified
      expect(repository.getCycleRecordById).toHaveBeenCalledWith(MOCK_CYCLE_ID);
      // The repository should not have any update/modify methods called on cycle records
      expect(repository.getCycleRecordsByUser).not.toHaveBeenCalled();
    });

    it('should not modify cycle record when adding override', async () => {
      const cycleRecord = createMockCycleRecord({
        start_date: '2024-03-01',
        cycle_length_days: 28,
      });
      const createdOverride = createMockOverride();

      vi.mocked(repository.getCycleRecordById).mockResolvedValue(cycleRecord);
      vi.mocked(repository.getOverrideByPhase).mockResolvedValue(null);
      vi.mocked(repository.createOverride).mockResolvedValue(createdOverride);

      await service.addOverride(
        MOCK_ADMIN_ID,
        MOCK_CYCLE_ID,
        CyclePhase.MENSTRUAL,
        'Replacement',
        'Original',
      );

      // Verify the cycle record was only read, never modified
      expect(repository.getCycleRecordById).toHaveBeenCalledWith(MOCK_CYCLE_ID);
    });

    it('should preserve original content in override record', async () => {
      const cycleRecord = createMockCycleRecord();
      const originalContent = 'This is the original system-generated content';
      const createdOverride = createMockOverride({
        original_content: originalContent,
        replacement_content: 'Admin replacement',
      });

      vi.mocked(repository.getCycleRecordById).mockResolvedValue(cycleRecord);
      vi.mocked(repository.getOverrideByPhase).mockResolvedValue(null);
      vi.mocked(repository.createOverride).mockResolvedValue(createdOverride);

      const result = await service.addOverride(
        MOCK_ADMIN_ID,
        MOCK_CYCLE_ID,
        CyclePhase.MENSTRUAL,
        'Admin replacement',
        originalContent,
      );

      expect(result.success).toBe(true);
      expect(repository.createOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          original_content: originalContent,
        }),
      );
    });
  });
});
