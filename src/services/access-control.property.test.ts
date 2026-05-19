import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { UserRole } from '@/lib/types';

import {
  canAccessOwnCycleRecord,
  canModifyCycleData,
  CycleDataAccessControl,
  OwnershipRepository,
  UserContext,
} from './access-control';

// ─── In-Memory Ownership Repository ─────────────────────────────────────────

class InMemoryOwnershipRepository implements OwnershipRepository {
  private owners: Map<string, string> = new Map();

  async getCycleRecordOwner(cycleRecordId: string): Promise<string | null> {
    return this.owners.get(cycleRecordId) ?? null;
  }

  setOwner(cycleRecordId: string, ownerId: string): void {
    this.owners.set(cycleRecordId, ownerId);
  }
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const userIdArb = fc.uuid();
const roleArb = fc.constantFrom(UserRole.PRIMARY, UserRole.PARTNER, UserRole.ADMIN);
const recordIdArb = fc.uuid();

const _userContextArb: fc.Arbitrary<UserContext> = fc.record({
  userId: userIdArb,
  role: roleArb,
});

// ─── Property 4: Cycle Data Access Control ───────────────────────────────────

/**
 * **Validates: Requirements 2.1, 2.2**
 *
 * Property 4: Cycle Data Access Control
 *
 * For any user who is not the owning Primary_User, any attempt to create, update,
 * or delete Cycle_Data SHALL be rejected. Only the Primary_User who owns the data
 * SHALL have modification permissions.
 */
describe('Property 4: Cycle Data Access Control', () => {
  describe('Partner_User is ALWAYS rejected for any modification', () => {
    it('Partner_User is always rejected by canModifyCycleData', () => {
      fc.assert(
        fc.property(userIdArb, (userId) => {
          const user: UserContext = { userId, role: UserRole.PARTNER };
          const result = canModifyCycleData(user);
          expect(result.allowed).toBe(false);
        }),
        { numRuns: 200 },
      );
    });

    it('Partner_User is always rejected by canAccessOwnCycleRecord regardless of ownership', () => {
      fc.assert(
        fc.property(userIdArb, userIdArb, (partnerId, ownerId) => {
          const user: UserContext = { userId: partnerId, role: UserRole.PARTNER };
          const result = canAccessOwnCycleRecord(user, ownerId);
          expect(result.allowed).toBe(false);
        }),
        { numRuns: 200 },
      );
    });

    it('Partner_User is always rejected for create operations', () => {
      fc.assert(
        fc.property(userIdArb, (userId) => {
          const repository = new InMemoryOwnershipRepository();
          const accessControl = new CycleDataAccessControl(repository);
          const user: UserContext = { userId, role: UserRole.PARTNER };

          const result = accessControl.canCreate(user);
          expect(result.allowed).toBe(false);
        }),
        { numRuns: 200 },
      );
    });

    it('Partner_User is always rejected for update operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          userIdArb,
          recordIdArb,
          async (partnerId, ownerId, recordId) => {
            const repository = new InMemoryOwnershipRepository();
            repository.setOwner(recordId, ownerId);
            const accessControl = new CycleDataAccessControl(repository);
            const user: UserContext = { userId: partnerId, role: UserRole.PARTNER };

            const result = await accessControl.canUpdate(user, recordId);
            expect(result.allowed).toBe(false);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('Partner_User is always rejected for delete operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          userIdArb,
          recordIdArb,
          async (partnerId, ownerId, recordId) => {
            const repository = new InMemoryOwnershipRepository();
            repository.setOwner(recordId, ownerId);
            const accessControl = new CycleDataAccessControl(repository);
            const user: UserContext = { userId: partnerId, role: UserRole.PARTNER };

            const result = await accessControl.canDelete(user, recordId);
            expect(result.allowed).toBe(false);
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  describe('Primary_User is allowed only for their own records', () => {
    it('Primary_User can always create cycle data', () => {
      fc.assert(
        fc.property(userIdArb, (userId) => {
          const repository = new InMemoryOwnershipRepository();
          const accessControl = new CycleDataAccessControl(repository);
          const user: UserContext = { userId, role: UserRole.PRIMARY };

          const result = accessControl.canCreate(user);
          expect(result.allowed).toBe(true);
        }),
        { numRuns: 200 },
      );
    });

    it('Primary_User is allowed to update their own records', async () => {
      await fc.assert(
        fc.asyncProperty(userIdArb, recordIdArb, async (userId, recordId) => {
          const repository = new InMemoryOwnershipRepository();
          repository.setOwner(recordId, userId);
          const accessControl = new CycleDataAccessControl(repository);
          const user: UserContext = { userId, role: UserRole.PRIMARY };

          const result = await accessControl.canUpdate(user, recordId);
          expect(result.allowed).toBe(true);
        }),
        { numRuns: 200 },
      );
    });

    it('Primary_User is allowed to delete their own records', async () => {
      await fc.assert(
        fc.asyncProperty(userIdArb, recordIdArb, async (userId, recordId) => {
          const repository = new InMemoryOwnershipRepository();
          repository.setOwner(recordId, userId);
          const accessControl = new CycleDataAccessControl(repository);
          const user: UserContext = { userId, role: UserRole.PRIMARY };

          const result = await accessControl.canDelete(user, recordId);
          expect(result.allowed).toBe(true);
        }),
        { numRuns: 200 },
      );
    });
  });

  describe('Primary_User is rejected for records they do not own', () => {
    it('Primary_User is rejected for updating another users record', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          userIdArb,
          recordIdArb,
          async (userId, otherOwnerId, recordId) => {
            // Ensure the user is not the owner
            fc.pre(userId !== otherOwnerId);

            const repository = new InMemoryOwnershipRepository();
            repository.setOwner(recordId, otherOwnerId);
            const accessControl = new CycleDataAccessControl(repository);
            const user: UserContext = { userId, role: UserRole.PRIMARY };

            const result = await accessControl.canUpdate(user, recordId);
            expect(result.allowed).toBe(false);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('Primary_User is rejected for deleting another users record', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          userIdArb,
          recordIdArb,
          async (userId, otherOwnerId, recordId) => {
            // Ensure the user is not the owner
            fc.pre(userId !== otherOwnerId);

            const repository = new InMemoryOwnershipRepository();
            repository.setOwner(recordId, otherOwnerId);
            const accessControl = new CycleDataAccessControl(repository);
            const user: UserContext = { userId, role: UserRole.PRIMARY };

            const result = await accessControl.canDelete(user, recordId);
            expect(result.allowed).toBe(false);
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  describe('Admin_User is always allowed', () => {
    it('Admin_User is always allowed by canModifyCycleData', () => {
      fc.assert(
        fc.property(userIdArb, (userId) => {
          const user: UserContext = { userId, role: UserRole.ADMIN };
          const result = canModifyCycleData(user);
          expect(result.allowed).toBe(true);
        }),
        { numRuns: 200 },
      );
    });

    it('Admin_User is always allowed for create operations', () => {
      fc.assert(
        fc.property(userIdArb, (userId) => {
          const repository = new InMemoryOwnershipRepository();
          const accessControl = new CycleDataAccessControl(repository);
          const user: UserContext = { userId, role: UserRole.ADMIN };

          const result = accessControl.canCreate(user);
          expect(result.allowed).toBe(true);
        }),
        { numRuns: 200 },
      );
    });

    it('Admin_User is always allowed for update operations regardless of ownership', async () => {
      await fc.assert(
        fc.asyncProperty(userIdArb, userIdArb, recordIdArb, async (adminId, ownerId, recordId) => {
          const repository = new InMemoryOwnershipRepository();
          repository.setOwner(recordId, ownerId);
          const accessControl = new CycleDataAccessControl(repository);
          const user: UserContext = { userId: adminId, role: UserRole.ADMIN };

          const result = await accessControl.canUpdate(user, recordId);
          expect(result.allowed).toBe(true);
        }),
        { numRuns: 200 },
      );
    });

    it('Admin_User is always allowed for delete operations regardless of ownership', async () => {
      await fc.assert(
        fc.asyncProperty(userIdArb, userIdArb, recordIdArb, async (adminId, ownerId, recordId) => {
          const repository = new InMemoryOwnershipRepository();
          repository.setOwner(recordId, ownerId);
          const accessControl = new CycleDataAccessControl(repository);
          const user: UserContext = { userId: adminId, role: UserRole.ADMIN };

          const result = await accessControl.canDelete(user, recordId);
          expect(result.allowed).toBe(true);
        }),
        { numRuns: 200 },
      );
    });
  });
});
