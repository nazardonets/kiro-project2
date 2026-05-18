import {
  DEFAULT_CYCLE_LENGTH,
  MAX_HISTORICAL_RECORDS,
  CYCLE_DATE_MAX_AGE_DAYS,
} from '@/lib/constants';
import { CycleRecord } from '@/lib/types';

/**
 * Typed interface for database access (dependency injection).
 * Allows the CycleService to remain framework-agnostic.
 */
export interface CycleRepository {
  /** Get all cycle records for a user, ordered by start_date descending */
  getCycleRecords(userId: string): Promise<CycleRecord[]>;
  /** Get a single cycle record by ID */
  getCycleRecordById(id: string): Promise<CycleRecord | null>;
  /** Insert a new cycle record and return it */
  createCycleRecord(record: Omit<CycleRecord, 'id' | 'created_at'>): Promise<CycleRecord>;
  /** Delete a cycle record by ID */
  deleteCycleRecord(id: string): Promise<void>;
}

/**
 * Result of a conflict detection check.
 */
export interface ConflictCheckResult {
  /** Whether a conflict was detected */
  hasConflict: boolean;
  /** The conflicting record, if any */
  conflictingRecord?: CycleRecord;
  /** Human-readable message describing the conflict */
  message?: string;
}

/**
 * Result of creating a cycle record.
 */
export interface CreateCycleRecordResult {
  success: boolean;
  record?: CycleRecord;
  error?: string;
  conflict?: ConflictCheckResult;
}

/**
 * Calculates the average cycle length from existing cycle records.
 * Requires at least 2 records to produce a meaningful average.
 * Returns DEFAULT_CYCLE_LENGTH (28) if fewer than 2 records exist.
 */
export function getEffectiveCycleLength(records: CycleRecord[]): number {
  if (records.length < 2) {
    return DEFAULT_CYCLE_LENGTH;
  }

  const sum = records.reduce((acc, r) => acc + r.cycle_length_days, 0);
  return Math.round(sum / records.length);
}

/**
 * Detects whether a new start date conflicts with an existing cycle record.
 *
 * A conflict exists when the new date falls within the cycle duration
 * (based on average cycle length from existing records, or 28 days if
 * fewer than 2 records exist) of an existing cycle record's start date.
 *
 * @param newStartDate - The proposed new cycle start date
 * @param existingRecords - All existing cycle records for the user
 * @returns ConflictCheckResult indicating whether a conflict was found
 */
export function detectCycleOverlap(
  newStartDate: string,
  existingRecords: CycleRecord[],
): ConflictCheckResult {
  if (existingRecords.length === 0) {
    return { hasConflict: false };
  }

  const effectiveCycleLength = getEffectiveCycleLength(existingRecords);
  const newDate = new Date(newStartDate);
  newDate.setHours(0, 0, 0, 0);

  for (const record of existingRecords) {
    const existingDate = new Date(record.start_date);
    existingDate.setHours(0, 0, 0, 0);

    // Calculate the end of the existing cycle's duration
    const cycleEndDate = new Date(existingDate);
    cycleEndDate.setDate(cycleEndDate.getDate() + effectiveCycleLength - 1);

    // Check if the new date falls within [existingDate, existingDate + cycleLength - 1]
    if (newDate >= existingDate && newDate <= cycleEndDate) {
      return {
        hasConflict: true,
        conflictingRecord: record,
        message:
          `The submitted date (${newStartDate}) falls within the cycle duration ` +
          `of an existing record starting on ${record.start_date} ` +
          `(cycle length: ${effectiveCycleLength} days).`,
      };
    }
  }

  return { hasConflict: false };
}

/**
 * CycleService handles CRUD operations for cycle records,
 * conflict detection, and history management.
 *
 * It is framework-agnostic — database access is injected via the CycleRepository interface.
 */
export class CycleService {
  constructor(private readonly repository: CycleRepository) {}

  /**
   * Creates a new cycle record with validation.
   *
   * Validates:
   * - Date is within valid range [today - 365 days, today]
   * - User has not exceeded max 12 historical records
   * - No overlap conflict with existing records (returns conflict info if detected)
   *
   * @param userId - The primary user's ID
   * @param startDate - The cycle start date (ISO string, e.g. "2024-01-15")
   * @param cycleLengthDays - The cycle length in days (defaults to DEFAULT_CYCLE_LENGTH)
   * @param forceCreate - If true, create the record even if a conflict is detected
   * @returns CreateCycleRecordResult with the created record or error/conflict info
   */
  async createCycleRecord(
    userId: string,
    startDate: string,
    cycleLengthDays: number = DEFAULT_CYCLE_LENGTH,
    forceCreate: boolean = false,
  ): Promise<CreateCycleRecordResult> {
    // Validate date format
    const parsedDate = new Date(startDate);
    if (isNaN(parsedDate.getTime())) {
      return { success: false, error: 'Invalid date format' };
    }

    // Validate date range: must be [today - 365 days, today]
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dateOnly = new Date(parsedDate);
    dateOnly.setHours(0, 0, 0, 0);

    if (dateOnly > today) {
      return { success: false, error: 'Start date must be today or earlier' };
    }

    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() - CYCLE_DATE_MAX_AGE_DAYS);

    if (dateOnly < minDate) {
      return {
        success: false,
        error: `Start date must be within the last ${CYCLE_DATE_MAX_AGE_DAYS} days`,
      };
    }

    // Get existing records
    const existingRecords = await this.repository.getCycleRecords(userId);

    // Enforce max 12 historical records
    if (existingRecords.length >= MAX_HISTORICAL_RECORDS) {
      return {
        success: false,
        error: `Maximum of ${MAX_HISTORICAL_RECORDS} historical cycle records allowed`,
      };
    }

    // Check for overlap conflicts
    const conflictResult = detectCycleOverlap(startDate, existingRecords);
    if (conflictResult.hasConflict && !forceCreate) {
      return {
        success: false,
        error: 'Cycle overlap conflict detected',
        conflict: conflictResult,
      };
    }

    // Create the record
    const record = await this.repository.createCycleRecord({
      primary_user_id: userId,
      start_date: startDate,
      cycle_length_days: cycleLengthDays,
    });

    return { success: true, record };
  }

  /**
   * Retrieves all cycle records for a user, ordered by start_date descending.
   *
   * @param userId - The primary user's ID
   * @returns Array of CycleRecord objects
   */
  async getCycleRecords(userId: string): Promise<CycleRecord[]> {
    return this.repository.getCycleRecords(userId);
  }

  /**
   * Retrieves a single cycle record by ID.
   *
   * @param id - The cycle record ID
   * @returns The CycleRecord or null if not found
   */
  async getCycleRecordById(id: string): Promise<CycleRecord | null> {
    return this.repository.getCycleRecordById(id);
  }

  /**
   * Deletes a cycle record by ID.
   *
   * @param id - The cycle record ID to delete
   */
  async deleteCycleRecord(id: string): Promise<void> {
    return this.repository.deleteCycleRecord(id);
  }

  /**
   * Returns the effective cycle length for a user based on their existing records.
   * Uses average of existing records if 2+ exist, otherwise returns 28-day default.
   *
   * @param userId - The primary user's ID
   * @returns The effective cycle length in days
   */
  async getEffectiveCycleLength(userId: string): Promise<number> {
    const records = await this.repository.getCycleRecords(userId);
    return getEffectiveCycleLength(records);
  }

  /**
   * Checks if adding a new cycle record would create an overlap conflict.
   *
   * @param userId - The primary user's ID
   * @param startDate - The proposed start date
   * @returns ConflictCheckResult
   */
  async checkConflict(userId: string, startDate: string): Promise<ConflictCheckResult> {
    const existingRecords = await this.repository.getCycleRecords(userId);
    return detectCycleOverlap(startDate, existingRecords);
  }
}
