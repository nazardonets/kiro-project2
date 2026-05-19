import { SupabaseClient } from '@supabase/supabase-js';

import { INVITE_EXPIRY_HOURS } from '@/lib/constants';
import { InviteStatus, PartnerLinkStatus, SecureInvite } from '@/lib/types';

export interface InviteServiceResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface GenerateInviteResult {
  id: string;
  token: string;
  expiresAt: string;
}

export interface ValidateInviteResult {
  valid: boolean;
  invite: SecureInvite | null;
  reason?: string;
}

/**
 * InviteService handles Secure_Invite generation and validation.
 * Framework-agnostic: receives a Supabase client instance via dependency injection.
 */
export class InviteService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Generate a Secure_Invite for a Primary_User.
   * - Enforces one active partner link per Primary_User (Req 1.5)
   * - Generates a unique token with 72-hour expiry (Req 1.2)
   * - Stores invite in secure_invite table with status 'pending'
   */
  async generateInvite(primaryUserId: string): Promise<InviteServiceResult<GenerateInviteResult>> {
    // Check if the primary user already has an active partner link
    const { data: existingLink } = await this.supabase
      .from('partner_link')
      .select('id')
      .eq('primary_user_id', primaryUserId)
      .eq('status', PartnerLinkStatus.ACTIVE)
      .single();

    if (existingLink) {
      return {
        success: false,
        error: {
          code: 'PARTNER_ALREADY_LINKED',
          message:
            'You already have an active partner link. Only one partner is allowed at a time.',
        },
      };
    }

    // Expire any existing pending invites for this user
    await this.supabase
      .from('secure_invite')
      .update({ status: InviteStatus.EXPIRED })
      .eq('primary_user_id', primaryUserId)
      .eq('status', InviteStatus.PENDING);

    // Generate unique token
    const token = crypto.randomUUID();

    // Calculate expiry: created_at + 72 hours
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);

    // Store invite in database
    const { data: invite, error } = await this.supabase
      .from('secure_invite')
      .insert({
        primary_user_id: primaryUserId,
        token,
        expires_at: expiresAt.toISOString(),
        status: InviteStatus.PENDING,
        created_at: createdAt.toISOString(),
      })
      .select('id, token, expires_at')
      .single();

    if (error || !invite) {
      return {
        success: false,
        error: {
          code: 'INVITE_CREATION_FAILED',
          message: 'Failed to create invitation. Please try again.',
        },
      };
    }

    return {
      success: true,
      data: {
        id: invite.id,
        token: invite.token,
        expiresAt: invite.expires_at,
      },
    };
  }

  /**
   * Validate a Secure_Invite token.
   * Checks if the invite exists, is not expired, and has not already been used.
   * Returns validation result with reason if invalid (Req 1.4).
   */
  async validateInvite(token: string): Promise<InviteServiceResult<ValidateInviteResult>> {
    const { data: invite, error } = await this.supabase
      .from('secure_invite')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !invite) {
      return {
        success: true,
        data: {
          valid: false,
          invite: null,
          reason: 'The invitation token is invalid.',
        },
      };
    }

    // Check if already accepted
    if (invite.status === InviteStatus.ACCEPTED) {
      return {
        success: true,
        data: {
          valid: false,
          invite: invite as SecureInvite,
          reason: 'This invitation has already been used.',
        },
      };
    }

    // Check if expired by status or time
    const now = new Date();
    const expiresAt = new Date(invite.expires_at);
    if (now > expiresAt || invite.status === InviteStatus.EXPIRED) {
      // Update status to expired if it was still pending
      if (invite.status === InviteStatus.PENDING) {
        await this.supabase
          .from('secure_invite')
          .update({ status: InviteStatus.EXPIRED })
          .eq('id', invite.id);
      }

      return {
        success: true,
        data: {
          valid: false,
          invite: invite as SecureInvite,
          reason: 'This invitation has expired. Please ask the Primary_User to generate a new one.',
        },
      };
    }

    return {
      success: true,
      data: {
        valid: true,
        invite: invite as SecureInvite,
      },
    };
  }

  /**
   * Retrieve invite details by token for display purposes.
   */
  async getInviteByToken(token: string): Promise<InviteServiceResult<SecureInvite>> {
    const { data: invite, error } = await this.supabase
      .from('secure_invite')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !invite) {
      return {
        success: false,
        error: {
          code: 'INVITE_NOT_FOUND',
          message: 'Invitation not found.',
        },
      };
    }

    return {
      success: true,
      data: invite as SecureInvite,
    };
  }
}
