import { UserRole } from '@/lib/types';

/**
 * Error codes for access control violations.
 */
export enum AccessControlErrorCode {
  UNAUTHORIZED_MODIFICATION = 'UNAUTHORIZED_MODIFICATION',
  NOT_DATA_OWNER = 'NOT_DATA_OWNER',
  INSUFFICIENT_ROLE = 'INSUFFICIENT_ROLE',
}

/**
 * Result of an access control check.
 */
export interface AccessControlResult {
  /** Whether the action is allowed */
  allowed: boolean;
  /** Error code when action is denied */
  errorCode?: AccessControlErrorCode;
  /** Human-readable error message when action is denied */
  message?: string;
}

/**
 * Context about the user attempting an action.
 */
export interface UserContext {
  /** The user's unique ID */
  userId: string;
  /** The user's role */
  role: UserRole;
}

/**
 * Typed interface for looking up cycle data ownership.
 * Allows the access control module to remain framework-agnostic.
 */
export interface OwnershipRepository {
  /** Get the owner (primary_user_id) of a cycle record by its ID */
  getCycleRecordOwner(cycleRecordId: string): Promise<string | null>;
}

/**
 * Checks whether a user is allowed to modify cycle data.
 *
 * Only Primary_Users can create, update, or delete Cycle_Data.
 * Partner_Users and any non-primary role are blocked with an appropriate message.
 *
 * This is an application-level enforcement that works alongside
 * database RLS policies as a defense-in-depth approach.
 *
 * @param user - The user context (id and role)
 * @returns AccessControlResult indicating whether the action is allowed
 */
export function canModifyCycleData(user: UserContext): AccessControlResult {
  if (user.role === UserRole.PARTNER) {
    return {
      allowed: false,
      errorCode: AccessControlErrorCode.UNAUTHORIZED_MODIFICATION,
      message: 'Only the Primary User can modify Cycle Data',
    };
  }

  if (user.role !== UserRole.PRIMARY && user.role !== UserRole.ADMIN) {
    return {
      allowed: false,
      errorCode: AccessControlErrorCode.INSUFFICIENT_ROLE,
      message: 'You do not have permission to modify Cycle Data',
    };
  }

  return { allowed: true };
}

/**
 * Checks whether a user owns a specific cycle record.
 *
 * Enforces that only the Primary_User who created the cycle record
 * can modify or delete it. Admin users are also allowed.
 *
 * @param user - The user context (id and role)
 * @param cycleRecordOwnerId - The primary_user_id of the cycle record
 * @returns AccessControlResult indicating whether the action is allowed
 */
export function canAccessOwnCycleRecord(
  user: UserContext,
  cycleRecordOwnerId: string,
): AccessControlResult {
  // Admin users have full access
  if (user.role === UserRole.ADMIN) {
    return { allowed: true };
  }

  // Partners cannot modify any cycle data
  if (user.role === UserRole.PARTNER) {
    return {
      allowed: false,
      errorCode: AccessControlErrorCode.UNAUTHORIZED_MODIFICATION,
      message: 'Only the Primary User can modify Cycle Data',
    };
  }

  // Primary users can only access their own records
  if (user.userId !== cycleRecordOwnerId) {
    return {
      allowed: false,
      errorCode: AccessControlErrorCode.NOT_DATA_OWNER,
      message: 'You can only modify your own Cycle Data',
    };
  }

  return { allowed: true };
}

/**
 * CycleDataAccessControl provides a higher-level API for enforcing
 * access control on cycle data operations. It combines role-based checks
 * with ownership verification using the repository.
 *
 * This service works as a defense-in-depth layer alongside database RLS policies.
 */
export class CycleDataAccessControl {
  constructor(private readonly ownershipRepo: OwnershipRepository) {}

  /**
   * Checks if a user can create a new cycle record.
   * Only Primary_Users can create cycle data.
   *
   * @param user - The user context
   * @returns AccessControlResult
   */
  canCreate(user: UserContext): AccessControlResult {
    return canModifyCycleData(user);
  }

  /**
   * Checks if a user can update an existing cycle record.
   * Verifies both role and ownership.
   *
   * @param user - The user context
   * @param cycleRecordId - The ID of the cycle record to update
   * @returns AccessControlResult
   */
  async canUpdate(user: UserContext, cycleRecordId: string): Promise<AccessControlResult> {
    // First check role-based access
    const roleCheck = canModifyCycleData(user);
    if (!roleCheck.allowed) {
      return roleCheck;
    }

    // Admin users bypass ownership check
    if (user.role === UserRole.ADMIN) {
      return { allowed: true };
    }

    // Verify ownership
    const ownerId = await this.ownershipRepo.getCycleRecordOwner(cycleRecordId);
    if (ownerId === null) {
      return {
        allowed: false,
        errorCode: AccessControlErrorCode.NOT_DATA_OWNER,
        message: 'Cycle record not found',
      };
    }

    return canAccessOwnCycleRecord(user, ownerId);
  }

  /**
   * Checks if a user can delete an existing cycle record.
   * Verifies both role and ownership.
   *
   * @param user - The user context
   * @param cycleRecordId - The ID of the cycle record to delete
   * @returns AccessControlResult
   */
  async canDelete(user: UserContext, cycleRecordId: string): Promise<AccessControlResult> {
    // Same logic as update — role check + ownership verification
    return this.canUpdate(user, cycleRecordId);
  }
}
