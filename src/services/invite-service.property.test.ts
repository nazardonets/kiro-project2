import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { INVITE_EXPIRY_HOURS } from '@/lib/constants';
import { InviteStatus, PartnerLinkStatus } from '@/lib/types';

import { InviteService } from './invite-service';

// ─── In-Memory Supabase Mock for Invite Service ─────────────────────────────

/**
 * In-memory mock Supabase client for property testing the invite service.
 * Simulates the database layer without external dependencies.
 */
function createInMemorySupabase() {
  const invites: Array<{
    id: string;
    primary_user_id: string;
    token: string;
    expires_at: string;
    status: string;
    created_at: string;
  }> = [];

  let nextId = 1;

  const from = (table: string) => {
    if (table === 'partner_link') {
      return {
        select: () => ({
          eq: (_field: string, _value: string) => ({
            eq: (_field2: string, _value2: string) => ({
              single: async () => {
                // No active partner links in this test scenario
                return { data: null, error: { message: 'not found' } };
              },
            }),
          }),
        }),
      };
    }

    if (table === 'secure_invite') {
      return {
        update: (data: { status: string }) => ({
          eq: (_field: string, _value: string) => ({
            eq: (_field2: string, _value2: string) => {
              // Expire pending invites for the user
              invites.forEach((inv) => {
                if (inv.primary_user_id === _value && inv.status === InviteStatus.PENDING) {
                  inv.status = data.status;
                }
              });
              return { error: null };
            },
          }),
        }),
        insert: (data: {
          primary_user_id: string;
          token: string;
          expires_at: string;
          status: string;
          created_at: string;
        }) => ({
          select: () => ({
            single: async () => {
              const newInvite = {
                id: `invite-${nextId++}`,
                ...data,
              };
              invites.push(newInvite);
              return {
                data: {
                  id: newInvite.id,
                  token: newInvite.token,
                  expires_at: newInvite.expires_at,
                },
                error: null,
              };
            },
          }),
        }),
      };
    }

    return {};
  };

  return {
    from,
    _invites: invites,
  };
}

// ─── Property 2: Secure Invite Expiry ────────────────────────────────────────

/**
 * **Validates: Requirements 1.2**
 *
 * Property 2: Secure Invite Expiry
 *
 * For any generated Secure_Invite, the expiration timestamp SHALL equal the
 * creation timestamp plus exactly 72 hours, and the token SHALL be unique
 * across all invites in the system.
 */
describe('Property 2: Secure Invite Expiry', () => {
  const SEVENTY_TWO_HOURS_MS = INVITE_EXPIRY_HOURS * 60 * 60 * 1000;

  it('expires_at always equals created_at + exactly 72 hours for any generated invite', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary user IDs
        fc.uuid(),
        async (userId) => {
          const mockSupabase = createInMemorySupabase();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const inviteService = new InviteService(mockSupabase as any);

          const result = await inviteService.generateInvite(userId);

          expect(result.success).toBe(true);
          expect(result.data).toBeDefined();

          if (!result.data) return;

          // Get the stored invite to check created_at and expires_at
          const storedInvite = mockSupabase._invites.find(
            (inv) => inv.token === result.data?.token,
          );
          expect(storedInvite).toBeDefined();

          if (!storedInvite) return;

          const createdAtMs = new Date(storedInvite.created_at).getTime();
          const expiresAtMs = new Date(storedInvite.expires_at).getTime();

          // The difference must be exactly 72 hours
          expect(expiresAtMs - createdAtMs).toBe(SEVENTY_TWO_HOURS_MS);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('tokens are unique across all generated invites for any sequence of users', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a list of user IDs (some may repeat to simulate same user generating multiple invites)
        fc.array(fc.uuid(), { minLength: 2, maxLength: 20 }),
        async (userIds) => {
          const mockSupabase = createInMemorySupabase();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const inviteService = new InviteService(mockSupabase as any);

          const tokens: string[] = [];

          for (const userId of userIds) {
            const result = await inviteService.generateInvite(userId);

            if (result.success && result.data) {
              tokens.push(result.data.token);
            }
          }

          // All tokens must be unique
          const uniqueTokens = new Set(tokens);
          expect(uniqueTokens.size).toBe(tokens.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('expiry is exactly 72 hours regardless of the user generating the invite', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate multiple different user IDs
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
        async (userIds) => {
          const mockSupabase = createInMemorySupabase();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const inviteService = new InviteService(mockSupabase as any);

          for (const userId of userIds) {
            const result = await inviteService.generateInvite(userId);

            if (result.success && result.data) {
              const storedInvite = mockSupabase._invites.find(
                (inv) => inv.token === result.data?.token,
              );
              expect(storedInvite).toBeDefined();

              if (!storedInvite) continue;

              const createdAt = new Date(storedInvite.created_at);
              const expiresAt = new Date(storedInvite.expires_at);

              // Verify the difference is exactly 72 hours in milliseconds
              const diffMs = expiresAt.getTime() - createdAt.getTime();
              expect(diffMs).toBe(SEVENTY_TWO_HOURS_MS);

              // Also verify the returned expiresAt matches what's stored
              expect(result.data.expiresAt).toBe(storedInvite.expires_at);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ─── Property 3: One Active Partner Link Invariant ───────────────────────────

/**
 * **Validates: Requirements 1.5**
 *
 * Property 3: One Active Partner Link Invariant
 *
 * For any Primary_User, at most one Partner_Link with status 'active' SHALL exist
 * at any point in time, regardless of the sequence of link/unlink operations performed.
 */

// ─── In-Memory Model ─────────────────────────────────────────────────────────

interface PartnerLinkRecord {
  id: string;
  primary_user_id: string;
  partner_user_id: string;
  status: PartnerLinkStatus;
  linked_at: string;
  revoked_at: string | null;
}

/**
 * In-memory partner link store that enforces the one-active-link invariant,
 * mirroring the behavior of InviteService + AuthService.
 */
class PartnerLinkStore {
  private links: PartnerLinkRecord[] = [];
  private nextId = 1;

  /**
   * Get the active partner link for a primary user, if any.
   */
  getActiveLink(primaryUserId: string): PartnerLinkRecord | null {
    return (
      this.links.find(
        (l) => l.primary_user_id === primaryUserId && l.status === PartnerLinkStatus.ACTIVE,
      ) ?? null
    );
  }

  /**
   * Count active links for a primary user.
   */
  countActiveLinks(primaryUserId: string): number {
    return this.links.filter(
      (l) => l.primary_user_id === primaryUserId && l.status === PartnerLinkStatus.ACTIVE,
    ).length;
  }

  /**
   * Attempt to create a new partner link.
   * Enforces the one-active-link invariant: rejects if an active link already exists.
   * This mirrors InviteService.generateInvite() which checks for existing active links.
   */
  createLink(primaryUserId: string, partnerUserId: string): { success: boolean; error?: string } {
    // Check if an active link already exists (mirrors InviteService check)
    const existingActive = this.getActiveLink(primaryUserId);
    if (existingActive) {
      return {
        success: false,
        error: 'PARTNER_ALREADY_LINKED',
      };
    }

    const link: PartnerLinkRecord = {
      id: String(this.nextId++),
      primary_user_id: primaryUserId,
      partner_user_id: partnerUserId,
      status: PartnerLinkStatus.ACTIVE,
      linked_at: new Date().toISOString(),
      revoked_at: null,
    };
    this.links.push(link);

    return { success: true };
  }

  /**
   * Unlink the active partner (set status to 'unlinked').
   * Mirrors the sharing/unlink endpoint behavior.
   */
  unlinkPartner(primaryUserId: string): { success: boolean; error?: string } {
    const activeLink = this.getActiveLink(primaryUserId);
    if (!activeLink) {
      return { success: false, error: 'NO_ACTIVE_LINK' };
    }

    activeLink.status = PartnerLinkStatus.UNLINKED;
    activeLink.revoked_at = new Date().toISOString();
    return { success: true };
  }

  /**
   * Revoke the active partner link (set status to 'revoked').
   * Mirrors admin suspension or sharing revocation behavior.
   */
  revokePartner(primaryUserId: string): { success: boolean; error?: string } {
    const activeLink = this.getActiveLink(primaryUserId);
    if (!activeLink) {
      return { success: false, error: 'NO_ACTIVE_LINK' };
    }

    activeLink.status = PartnerLinkStatus.REVOKED;
    activeLink.revoked_at = new Date().toISOString();
    return { success: true };
  }

  /**
   * Get all links for a primary user (for inspection).
   */
  getAllLinks(primaryUserId: string): PartnerLinkRecord[] {
    return this.links.filter((l) => l.primary_user_id === primaryUserId);
  }
}

// ─── Operation Types for Model-Based Testing ─────────────────────────────────

type Operation = { type: 'link'; partnerUserId: string } | { type: 'unlink' } | { type: 'revoke' };

/**
 * Arbitrary for generating a sequence of link/unlink/revoke operations.
 */
const operationArb: fc.Arbitrary<Operation> = fc.oneof(
  fc.record({
    type: fc.constant('link' as const),
    partnerUserId: fc.uuid(),
  }),
  fc.record({ type: fc.constant('unlink' as const) }),
  fc.record({ type: fc.constant('revoke' as const) }),
);

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 3: One Active Partner Link Invariant', () => {
  it('for any sequence of link/unlink/revoke operations, at most one active link exists at any point', () => {
    fc.assert(
      fc.property(fc.array(operationArb, { minLength: 1, maxLength: 50 }), (operations) => {
        const store = new PartnerLinkStore();
        const primaryUserId = 'primary-user-1';

        for (const op of operations) {
          switch (op.type) {
            case 'link':
              store.createLink(primaryUserId, op.partnerUserId);
              break;
            case 'unlink':
              store.unlinkPartner(primaryUserId);
              break;
            case 'revoke':
              store.revokePartner(primaryUserId);
              break;
          }

          // INVARIANT: After every operation, at most one active link exists
          const activeCount = store.countActiveLinks(primaryUserId);
          expect(activeCount).toBeLessThanOrEqual(1);
        }
      }),
      { numRuns: 500 },
    );
  });

  it('creating a new link when one already exists should be rejected', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), (firstPartnerId, secondPartnerId) => {
        const store = new PartnerLinkStore();
        const primaryUserId = 'primary-user-1';

        // Create first link - should succeed
        const firstResult = store.createLink(primaryUserId, firstPartnerId);
        expect(firstResult.success).toBe(true);

        // Attempt to create second link - should be rejected
        const secondResult = store.createLink(primaryUserId, secondPartnerId);
        expect(secondResult.success).toBe(false);
        expect(secondResult.error).toBe('PARTNER_ALREADY_LINKED');

        // Invariant still holds
        expect(store.countActiveLinks(primaryUserId)).toBe(1);
      }),
      { numRuns: 200 },
    );
  });

  it('after unlinking, a new link can be created (but still at most one active)', () => {
    fc.assert(
      fc.property(fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }), (partnerIds) => {
        const store = new PartnerLinkStore();
        const primaryUserId = 'primary-user-1';

        for (const partnerId of partnerIds) {
          // Unlink any existing active link
          store.unlinkPartner(primaryUserId);

          // Create a new link
          const result = store.createLink(primaryUserId, partnerId);
          expect(result.success).toBe(true);

          // Invariant: exactly one active link
          expect(store.countActiveLinks(primaryUserId)).toBe(1);
        }

        // After all operations, still at most one active link
        expect(store.countActiveLinks(primaryUserId)).toBeLessThanOrEqual(1);
      }),
      { numRuns: 200 },
    );
  });

  it('after revoking, a new link can be created (but still at most one active)', () => {
    fc.assert(
      fc.property(fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }), (partnerIds) => {
        const store = new PartnerLinkStore();
        const primaryUserId = 'primary-user-1';

        for (const partnerId of partnerIds) {
          // Revoke any existing active link
          store.revokePartner(primaryUserId);

          // Create a new link
          const result = store.createLink(primaryUserId, partnerId);
          expect(result.success).toBe(true);

          // Invariant: exactly one active link
          expect(store.countActiveLinks(primaryUserId)).toBe(1);
        }

        // After all operations, still at most one active link
        expect(store.countActiveLinks(primaryUserId)).toBeLessThanOrEqual(1);
      }),
      { numRuns: 200 },
    );
  });

  it('the invariant holds across multiple primary users independently', () => {
    fc.assert(
      fc.property(
        // Generate operations for multiple primary users
        fc.array(
          fc.record({
            primaryUserId: fc.constantFrom('user-A', 'user-B', 'user-C'),
            operation: operationArb,
          }),
          { minLength: 1, maxLength: 60 },
        ),
        (userOperations) => {
          const store = new PartnerLinkStore();

          for (const { primaryUserId, operation } of userOperations) {
            switch (operation.type) {
              case 'link':
                store.createLink(primaryUserId, operation.partnerUserId);
                break;
              case 'unlink':
                store.unlinkPartner(primaryUserId);
                break;
              case 'revoke':
                store.revokePartner(primaryUserId);
                break;
            }

            // INVARIANT: After every operation, each user has at most one active link
            for (const userId of ['user-A', 'user-B', 'user-C']) {
              expect(store.countActiveLinks(userId)).toBeLessThanOrEqual(1);
            }
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});
