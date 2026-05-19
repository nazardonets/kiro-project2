import { describe, it, expect, beforeEach } from 'vitest';

import { UserRole } from '@/lib/types';

import {
  AccessControlErrorCode,
  canAccessOwnCycleRecord,
  canModifyCycleData,
  CycleDataAccessControl,
  OwnershipRepository,
  UserContext,
} from './access-control';

/**
 * In-memory implementation of OwnershipRepository for testing.
 */
class InMemoryOwnershipRepository implements OwnershipRepository {
  private owners: Map<string, string> = new Map();

  async getCycleRecordOwner(cycleRecordId: string): Promise<string | null> {
    return this.owners.get(cycleRecordId) ?? null;
  }

  /** Helper to seed ownership data */
  setOwner(cycleRecordId: string, ownerId: string): void {
    this.owners.set(cycleRecordId, ownerId);
  }
}

describe('canModifyCycleData', () => {
  it('allows Primary_User to modify cycle data', () => {
    const user: UserContext = { userId: 'user-1', role: UserRole.PRIMARY };
    const result = canModifyCycleData(user);
    expect(result.allowed).toBe(true);
    expect(result.errorCode).toBeUndefined();
    expect(result.message).toBeUndefined();
  });

  it('blocks Partner_User from modifying cycle data', () => {
    const user: UserContext = { userId: 'partner-1', role: UserRole.PARTNER };
    const result = canModifyCycleData(user);
    expect(result.allowed).toBe(false);
    expect(result.errorCode).toBe(AccessControlErrorCode.UNAUTHORIZED_MODIFICATION);
    expect(result.message).toBe('Only the Primary User can modify Cycle Data');
  });

  it('allows Admin_User to modify cycle data', () => {
    const user: UserContext = { userId: 'admin-1', role: UserRole.ADMIN };
    const result = canModifyCycleData(user);
    expect(result.allowed).toBe(true);
  });
});

describe('canAccessOwnCycleRecord', () => {
  it('allows Primary_User to access their own record', () => {
    const user: UserContext = { userId: 'user-1', role: UserRole.PRIMARY };
    const result = canAccessOwnCycleRecord(user, 'user-1');
    expect(result.allowed).toBe(true);
  });

  it('blocks Primary_User from accessing another users record', () => {
    const user: UserContext = { userId: 'user-1', role: UserRole.PRIMARY };
    const result = canAccessOwnCycleRecord(user, 'user-2');
    expect(result.allowed).toBe(false);
    expect(result.errorCode).toBe(AccessControlErrorCode.NOT_DATA_OWNER);
    expect(result.message).toBe('You can only modify your own Cycle Data');
  });

  it('blocks Partner_User from accessing any cycle record', () => {
    const user: UserContext = { userId: 'partner-1', role: UserRole.PARTNER };
    const result = canAccessOwnCycleRecord(user, 'user-1');
    expect(result.allowed).toBe(false);
    expect(result.errorCode).toBe(AccessControlErrorCode.UNAUTHORIZED_MODIFICATION);
    expect(result.message).toBe('Only the Primary User can modify Cycle Data');
  });

  it('allows Admin_User to access any cycle record', () => {
    const user: UserContext = { userId: 'admin-1', role: UserRole.ADMIN };
    const result = canAccessOwnCycleRecord(user, 'user-1');
    expect(result.allowed).toBe(true);
  });
});

describe('CycleDataAccessControl', () => {
  let repository: InMemoryOwnershipRepository;
  let accessControl: CycleDataAccessControl;

  beforeEach(() => {
    repository = new InMemoryOwnershipRepository();
    accessControl = new CycleDataAccessControl(repository);
    repository.setOwner('record-1', 'user-1');
    repository.setOwner('record-2', 'user-2');
  });

  describe('canCreate', () => {
    it('allows Primary_User to create cycle records', () => {
      const user: UserContext = { userId: 'user-1', role: UserRole.PRIMARY };
      const result = accessControl.canCreate(user);
      expect(result.allowed).toBe(true);
    });

    it('blocks Partner_User from creating cycle records', () => {
      const user: UserContext = { userId: 'partner-1', role: UserRole.PARTNER };
      const result = accessControl.canCreate(user);
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe(AccessControlErrorCode.UNAUTHORIZED_MODIFICATION);
      expect(result.message).toBe('Only the Primary User can modify Cycle Data');
    });

    it('allows Admin_User to create cycle records', () => {
      const user: UserContext = { userId: 'admin-1', role: UserRole.ADMIN };
      const result = accessControl.canCreate(user);
      expect(result.allowed).toBe(true);
    });
  });

  describe('canUpdate', () => {
    it('allows Primary_User to update their own record', async () => {
      const user: UserContext = { userId: 'user-1', role: UserRole.PRIMARY };
      const result = await accessControl.canUpdate(user, 'record-1');
      expect(result.allowed).toBe(true);
    });

    it('blocks Primary_User from updating another users record', async () => {
      const user: UserContext = { userId: 'user-1', role: UserRole.PRIMARY };
      const result = await accessControl.canUpdate(user, 'record-2');
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe(AccessControlErrorCode.NOT_DATA_OWNER);
    });

    it('blocks Partner_User from updating any record', async () => {
      const user: UserContext = { userId: 'partner-1', role: UserRole.PARTNER };
      const result = await accessControl.canUpdate(user, 'record-1');
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe(AccessControlErrorCode.UNAUTHORIZED_MODIFICATION);
      expect(result.message).toBe('Only the Primary User can modify Cycle Data');
    });

    it('allows Admin_User to update any record', async () => {
      const user: UserContext = { userId: 'admin-1', role: UserRole.ADMIN };
      const result = await accessControl.canUpdate(user, 'record-1');
      expect(result.allowed).toBe(true);
    });

    it('returns error when cycle record does not exist', async () => {
      const user: UserContext = { userId: 'user-1', role: UserRole.PRIMARY };
      const result = await accessControl.canUpdate(user, 'nonexistent');
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe(AccessControlErrorCode.NOT_DATA_OWNER);
      expect(result.message).toBe('Cycle record not found');
    });
  });

  describe('canDelete', () => {
    it('allows Primary_User to delete their own record', async () => {
      const user: UserContext = { userId: 'user-1', role: UserRole.PRIMARY };
      const result = await accessControl.canDelete(user, 'record-1');
      expect(result.allowed).toBe(true);
    });

    it('blocks Primary_User from deleting another users record', async () => {
      const user: UserContext = { userId: 'user-1', role: UserRole.PRIMARY };
      const result = await accessControl.canDelete(user, 'record-2');
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe(AccessControlErrorCode.NOT_DATA_OWNER);
    });

    it('blocks Partner_User from deleting any record', async () => {
      const user: UserContext = { userId: 'partner-1', role: UserRole.PARTNER };
      const result = await accessControl.canDelete(user, 'record-1');
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe(AccessControlErrorCode.UNAUTHORIZED_MODIFICATION);
      expect(result.message).toBe('Only the Primary User can modify Cycle Data');
    });

    it('allows Admin_User to delete any record', async () => {
      const user: UserContext = { userId: 'admin-1', role: UserRole.ADMIN };
      const result = await accessControl.canDelete(user, 'record-1');
      expect(result.allowed).toBe(true);
    });

    it('returns error when cycle record does not exist', async () => {
      const user: UserContext = { userId: 'user-1', role: UserRole.PRIMARY };
      const result = await accessControl.canDelete(user, 'nonexistent');
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe(AccessControlErrorCode.NOT_DATA_OWNER);
      expect(result.message).toBe('Cycle record not found');
    });
  });
});
