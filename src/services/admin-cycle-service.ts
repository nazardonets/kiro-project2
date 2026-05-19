import { AdminAnnotation, AdminOverride, CyclePhase, CycleRecord } from '@/lib/types';
import {
  adminAnnotationSchema,
  adminOverrideSchema,
  updateAnnotationSchema,
  updateOverrideSchema,
} from '@/lib/validation/admin.schemas';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Result type for AdminCycleService operations.
 */
export interface AdminCycleServiceResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    fields?: Record<string, { message: string; constraint: string }>;
  };
}

/**
 * Cycle instance with associated annotations and overrides for admin view.
 */
export interface CycleInstanceDetails {
  cycle_record: CycleRecord;
  annotations: AdminAnnotation[];
  overrides: AdminOverride[];
}

/**
 * Typed interface for database access (dependency injection).
 * Allows the AdminCycleService to remain framework-agnostic.
 */
export interface AdminCycleRepository {
  /** Get all cycle records for a user, ordered by start_date descending */
  getCycleRecordsByUser(userId: string): Promise<CycleRecord[]>;

  /** Get a single cycle record by ID */
  getCycleRecordById(cycleRecordId: string): Promise<CycleRecord | null>;

  /** Get all annotations for a cycle record */
  getAnnotationsByCycleRecord(cycleRecordId: string): Promise<AdminAnnotation[]>;

  /** Get a single annotation by ID */
  getAnnotationById(annotationId: string): Promise<AdminAnnotation | null>;

  /** Create an annotation */
  createAnnotation(
    annotation: Omit<AdminAnnotation, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<AdminAnnotation>;

  /** Update an annotation's content */
  updateAnnotation(annotationId: string, content: string): Promise<AdminAnnotation>;

  /** Delete an annotation */
  deleteAnnotation(annotationId: string): Promise<void>;

  /** Get all overrides for a cycle record */
  getOverridesByCycleRecord(cycleRecordId: string): Promise<AdminOverride[]>;

  /** Get a single override by ID */
  getOverrideById(overrideId: string): Promise<AdminOverride | null>;

  /** Get an override by cycle record and phase */
  getOverrideByPhase(cycleRecordId: string, phase: CyclePhase): Promise<AdminOverride | null>;

  /** Create an override */
  createOverride(
    override: Omit<AdminOverride, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<AdminOverride>;

  /** Update an override's replacement content */
  updateOverride(overrideId: string, replacementContent: string): Promise<AdminOverride>;

  /** Delete an override (revert to original content) */
  deleteOverride(overrideId: string): Promise<void>;
}

// ─── Error Codes ─────────────────────────────────────────────────────────────

export enum AdminCycleErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CYCLE_RECORD_NOT_FOUND = 'CYCLE_RECORD_NOT_FOUND',
  ANNOTATION_NOT_FOUND = 'ANNOTATION_NOT_FOUND',
  OVERRIDE_NOT_FOUND = 'OVERRIDE_NOT_FOUND',
  OVERRIDE_ALREADY_EXISTS = 'OVERRIDE_ALREADY_EXISTS',
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * AdminCycleService handles admin operations for cycle instance management.
 *
 * Responsibilities:
 * - List cycle instances for a user ordered by start_date descending (Req 6.1)
 * - View cycle instance details with annotations and overrides (Req 6.2)
 * - Add/edit/delete annotations to cycle instances or phases (Req 6.3, 6.4, 6.8)
 * - Override system-generated content with replacement text (Req 6.5, 6.6)
 * - Revert overrides to restore original content (Req 6.9)
 * - Preserve original user-provided data unmodified (Req 6.7)
 *
 * Framework-agnostic: database access is injected via the AdminCycleRepository interface.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9
 */
export class AdminCycleService {
  constructor(private readonly repository: AdminCycleRepository) {}

  /**
   * List all cycle instances for a user, ordered by start_date descending.
   *
   * @param userId - The primary user's ID
   * @returns Array of CycleRecord objects ordered by start_date descending
   *
   * Validates: Requirement 6.1
   */
  async listCycleInstances(userId: string): Promise<AdminCycleServiceResult<CycleRecord[]>> {
    if (!userId || userId.trim() === '') {
      return {
        success: false,
        error: {
          code: AdminCycleErrorCode.VALIDATION_ERROR,
          message: 'User ID is required',
        },
      };
    }

    const records = await this.repository.getCycleRecordsByUser(userId);

    return {
      success: true,
      data: records,
    };
  }

  /**
   * Get detailed view of a cycle instance including annotations and overrides.
   *
   * @param cycleRecordId - The cycle record ID
   * @returns Cycle instance details with annotations and overrides
   *
   * Validates: Requirements 6.2, 6.4, 6.6
   */
  async getCycleInstanceDetails(
    cycleRecordId: string,
  ): Promise<AdminCycleServiceResult<CycleInstanceDetails>> {
    const cycleRecord = await this.repository.getCycleRecordById(cycleRecordId);

    if (!cycleRecord) {
      return {
        success: false,
        error: {
          code: AdminCycleErrorCode.CYCLE_RECORD_NOT_FOUND,
          message: 'Cycle record not found',
        },
      };
    }

    const annotations = await this.repository.getAnnotationsByCycleRecord(cycleRecordId);
    const overrides = await this.repository.getOverridesByCycleRecord(cycleRecordId);

    return {
      success: true,
      data: {
        cycle_record: cycleRecord,
        annotations,
        overrides,
      },
    };
  }

  /**
   * Add an annotation to a cycle instance or a specific phase.
   *
   * @param adminUserId - The admin user's ID
   * @param cycleRecordId - The cycle record ID
   * @param content - Annotation content (1-2000 chars)
   * @param phase - Optional phase (null means cycle-level annotation)
   * @returns The created annotation
   *
   * Validates: Requirements 6.3, 6.4
   */
  async addAnnotation(
    adminUserId: string,
    cycleRecordId: string,
    content: string,
    phase?: CyclePhase | null,
  ): Promise<AdminCycleServiceResult<AdminAnnotation>> {
    // Validate input
    const validation = adminAnnotationSchema.safeParse({
      cycle_record_id: cycleRecordId,
      phase: phase ?? null,
      content,
    });

    if (!validation.success) {
      const fieldErrors: Record<string, { message: string; constraint: string }> = {};
      for (const issue of validation.error.issues) {
        const field = issue.path.join('.');
        fieldErrors[field] = {
          message: issue.message,
          constraint: issue.code,
        };
      }
      return {
        success: false,
        error: {
          code: AdminCycleErrorCode.VALIDATION_ERROR,
          message: 'Invalid annotation input',
          fields: fieldErrors,
        },
      };
    }

    // Verify cycle record exists
    const cycleRecord = await this.repository.getCycleRecordById(cycleRecordId);
    if (!cycleRecord) {
      return {
        success: false,
        error: {
          code: AdminCycleErrorCode.CYCLE_RECORD_NOT_FOUND,
          message: 'Cycle record not found',
        },
      };
    }

    const annotation = await this.repository.createAnnotation({
      admin_user_id: adminUserId,
      cycle_record_id: cycleRecordId,
      phase: phase ?? null,
      content: validation.data.content,
    });

    return {
      success: true,
      data: annotation,
    };
  }

  /**
   * Edit an existing annotation's content.
   *
   * @param annotationId - The annotation ID
   * @param content - New annotation content (1-2000 chars)
   * @returns The updated annotation
   *
   * Validates: Requirement 6.8
   */
  async editAnnotation(
    annotationId: string,
    content: string,
  ): Promise<AdminCycleServiceResult<AdminAnnotation>> {
    // Validate input
    const validation = updateAnnotationSchema.safeParse({ content });

    if (!validation.success) {
      const fieldErrors: Record<string, { message: string; constraint: string }> = {};
      for (const issue of validation.error.issues) {
        const field = issue.path.join('.');
        fieldErrors[field] = {
          message: issue.message,
          constraint: issue.code,
        };
      }
      return {
        success: false,
        error: {
          code: AdminCycleErrorCode.VALIDATION_ERROR,
          message: 'Invalid annotation content',
          fields: fieldErrors,
        },
      };
    }

    // Verify annotation exists
    const existing = await this.repository.getAnnotationById(annotationId);
    if (!existing) {
      return {
        success: false,
        error: {
          code: AdminCycleErrorCode.ANNOTATION_NOT_FOUND,
          message: 'Annotation not found',
        },
      };
    }

    const updated = await this.repository.updateAnnotation(annotationId, validation.data.content);

    return {
      success: true,
      data: updated,
    };
  }

  /**
   * Delete an existing annotation.
   *
   * @param annotationId - The annotation ID
   * @returns Success result
   *
   * Validates: Requirement 6.8
   */
  async deleteAnnotation(
    annotationId: string,
  ): Promise<AdminCycleServiceResult<{ deleted: true }>> {
    // Verify annotation exists
    const existing = await this.repository.getAnnotationById(annotationId);
    if (!existing) {
      return {
        success: false,
        error: {
          code: AdminCycleErrorCode.ANNOTATION_NOT_FOUND,
          message: 'Annotation not found',
        },
      };
    }

    await this.repository.deleteAnnotation(annotationId);

    return {
      success: true,
      data: { deleted: true },
    };
  }

  /**
   * Override system-generated content for a specific phase within a cycle instance.
   *
   * @param adminUserId - The admin user's ID
   * @param cycleRecordId - The cycle record ID
   * @param phase - The cycle phase to override
   * @param replacementContent - Replacement text (1-2000 chars)
   * @param originalContent - The original system-generated content being replaced
   * @returns The created override
   *
   * Validates: Requirements 6.5, 6.6
   */
  async addOverride(
    adminUserId: string,
    cycleRecordId: string,
    phase: CyclePhase,
    replacementContent: string,
    originalContent: string,
  ): Promise<AdminCycleServiceResult<AdminOverride>> {
    // Validate input
    const validation = adminOverrideSchema.safeParse({
      cycle_record_id: cycleRecordId,
      phase,
      replacement_content: replacementContent,
    });

    if (!validation.success) {
      const fieldErrors: Record<string, { message: string; constraint: string }> = {};
      for (const issue of validation.error.issues) {
        const field = issue.path.join('.');
        fieldErrors[field] = {
          message: issue.message,
          constraint: issue.code,
        };
      }
      return {
        success: false,
        error: {
          code: AdminCycleErrorCode.VALIDATION_ERROR,
          message: 'Invalid override input',
          fields: fieldErrors,
        },
      };
    }

    // Verify cycle record exists
    const cycleRecord = await this.repository.getCycleRecordById(cycleRecordId);
    if (!cycleRecord) {
      return {
        success: false,
        error: {
          code: AdminCycleErrorCode.CYCLE_RECORD_NOT_FOUND,
          message: 'Cycle record not found',
        },
      };
    }

    // Check if an override already exists for this phase
    const existingOverride = await this.repository.getOverrideByPhase(cycleRecordId, phase);
    if (existingOverride) {
      return {
        success: false,
        error: {
          code: AdminCycleErrorCode.OVERRIDE_ALREADY_EXISTS,
          message: `An override already exists for phase "${phase}" on this cycle record`,
        },
      };
    }

    const override = await this.repository.createOverride({
      admin_user_id: adminUserId,
      cycle_record_id: cycleRecordId,
      phase,
      replacement_content: validation.data.replacement_content,
      original_content: originalContent,
    });

    return {
      success: true,
      data: override,
    };
  }

  /**
   * Update an existing override's replacement content.
   *
   * @param overrideId - The override ID
   * @param replacementContent - New replacement text (1-2000 chars)
   * @returns The updated override
   *
   * Validates: Requirement 6.5
   */
  async editOverride(
    overrideId: string,
    replacementContent: string,
  ): Promise<AdminCycleServiceResult<AdminOverride>> {
    // Validate input
    const validation = updateOverrideSchema.safeParse({ replacement_content: replacementContent });

    if (!validation.success) {
      const fieldErrors: Record<string, { message: string; constraint: string }> = {};
      for (const issue of validation.error.issues) {
        const field = issue.path.join('.');
        fieldErrors[field] = {
          message: issue.message,
          constraint: issue.code,
        };
      }
      return {
        success: false,
        error: {
          code: AdminCycleErrorCode.VALIDATION_ERROR,
          message: 'Invalid override content',
          fields: fieldErrors,
        },
      };
    }

    // Verify override exists
    const existing = await this.repository.getOverrideById(overrideId);
    if (!existing) {
      return {
        success: false,
        error: {
          code: AdminCycleErrorCode.OVERRIDE_NOT_FOUND,
          message: 'Override not found',
        },
      };
    }

    const updated = await this.repository.updateOverride(
      overrideId,
      validation.data.replacement_content,
    );

    return {
      success: true,
      data: updated,
    };
  }

  /**
   * Revert an override to restore original system-generated content.
   * Deletes the override record, effectively restoring the original content.
   *
   * @param overrideId - The override ID to revert
   * @returns The original content that was restored
   *
   * Validates: Requirement 6.9
   */
  async revertOverride(
    overrideId: string,
  ): Promise<AdminCycleServiceResult<{ reverted: true; original_content: string }>> {
    // Verify override exists
    const existing = await this.repository.getOverrideById(overrideId);
    if (!existing) {
      return {
        success: false,
        error: {
          code: AdminCycleErrorCode.OVERRIDE_NOT_FOUND,
          message: 'Override not found',
        },
      };
    }

    await this.repository.deleteOverride(overrideId);

    return {
      success: true,
      data: {
        reverted: true,
        original_content: existing.original_content,
      },
    };
  }
}
