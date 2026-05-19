import { SupabaseClient } from '@supabase/supabase-js';

import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { UserRole, InviteStatus, PartnerLinkStatus } from '@/lib/types';
import { validatePassword } from '@/lib/validation/auth.schemas';

export interface AuthServiceResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    fields?: Record<string, { message: string; constraint: string }[]>;
  };
}

export interface RegisterResult {
  userId: string;
  email: string;
  role: UserRole;
  needsEmailConfirmation?: boolean;
}

export interface LoginResult {
  userId: string;
  email: string;
  role: UserRole;
  accessToken: string;
  refreshToken: string;
}

export interface UserContext {
  userId: string;
  email: string;
  role: UserRole;
  linkedPartnerId: string | null;
}

/**
 * AuthService handles user registration, login, and session management.
 * Framework-agnostic: receives a Supabase client instance via dependency injection.
 */
export class AuthService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Register a new Primary_User with email and password.
   * Validates password requirements, creates user via Supabase Auth,
   * and sets role to 'primary' in user metadata.
   */
  async registerPrimaryUser(
    email: string,
    password: string,
  ): Promise<AuthServiceResult<RegisterResult>> {
    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.success) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Password does not meet requirements',
          fields: passwordValidation.error.fields,
        },
      };
    }

    // Create user via Supabase Auth
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: UserRole.PRIMARY,
        },
      },
    });

    if (error) {
      // Handle duplicate email
      if (
        error.message.toLowerCase().includes('already registered') ||
        error.message.toLowerCase().includes('already been registered') ||
        error.message.toLowerCase().includes('user already registered')
      ) {
        return {
          success: false,
          error: {
            code: 'EMAIL_IN_USE',
            message: 'An account with this email address already exists',
          },
        };
      }

      return {
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: error.message,
        },
      };
    }

    if (!data.user) {
      return {
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Failed to create user account',
        },
      };
    }

    // When email confirmation is enabled, Supabase returns the user
    // but with empty identities until they confirm their email
    const needsEmailConfirmation =
      data.user.identities?.length === 0 || data.user.confirmed_at === null;

    // Insert into custom "user" table (extends auth.users with role and status)
    // Uses admin client to bypass RLS since session may not be established yet
    try {
      const adminClient = createAdminSupabaseClient();
      const { error: userTableError } = await adminClient.from('user').insert({
        id: data.user.id,
        email: data.user.email ?? email,
        role: UserRole.PRIMARY,
        status: 'active',
      });

      if (userTableError) {
        console.error('Failed to insert into user table:', userTableError.message);
        return {
          success: false,
          error: {
            code: 'USER_TABLE_ERROR',
            message: `Failed to create user profile: ${userTableError.message}`,
          },
        };
      }
    } catch (e) {
      // Admin client may not be available in test environments
      console.error('Could not create admin client for user table insert:', e);
    }

    return {
      success: true,
      data: {
        userId: data.user.id,
        email: data.user.email ?? email,
        role: UserRole.PRIMARY,
        needsEmailConfirmation,
      },
    };
  }

  /**
   * Register a Partner_User via invite acceptance.
   * Validates the invite token, validates password, creates user via Supabase Auth,
   * sets role to 'partner', and creates the partner link.
   */
  async registerPartnerViaInvite(
    token: string,
    email: string,
    password: string,
  ): Promise<AuthServiceResult<RegisterResult>> {
    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.success) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Password does not meet requirements',
          fields: passwordValidation.error.fields,
        },
      };
    }

    // Look up the invite
    const { data: invite, error: inviteError } = await this.supabase
      .from('secure_invite')
      .select('*')
      .eq('token', token)
      .single();

    if (inviteError || !invite) {
      return {
        success: false,
        error: {
          code: 'INVALID_INVITE',
          message: 'The invitation token is invalid',
        },
      };
    }

    // Check if invite is already accepted
    if (invite.status === InviteStatus.ACCEPTED) {
      return {
        success: false,
        error: {
          code: 'INVITE_ALREADY_USED',
          message: 'This invitation has already been used',
        },
      };
    }

    // Check if invite has expired
    const now = new Date();
    const expiresAt = new Date(invite.expires_at);
    if (now > expiresAt || invite.status === InviteStatus.EXPIRED) {
      return {
        success: false,
        error: {
          code: 'INVITE_EXPIRED',
          message: 'This invitation has expired. Please ask for a new one.',
        },
      };
    }

    // Create the partner user via Supabase Auth
    const { data: authData, error: authError } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: UserRole.PARTNER,
          linked_primary_id: invite.primary_user_id,
        },
      },
    });

    if (authError) {
      if (
        authError.message.toLowerCase().includes('already registered') ||
        authError.message.toLowerCase().includes('already been registered') ||
        authError.message.toLowerCase().includes('user already registered')
      ) {
        return {
          success: false,
          error: {
            code: 'EMAIL_IN_USE',
            message: 'An account with this email address already exists',
          },
        };
      }

      return {
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: authError.message,
        },
      };
    }

    if (!authData.user) {
      return {
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Failed to create partner account',
        },
      };
    }

    // When email confirmation is enabled, Supabase returns the user
    // but with empty identities until they confirm their email
    const needsEmailConfirmation =
      authData.user.identities?.length === 0 || authData.user.confirmed_at === null;

    // If email confirmation is required, we still create the partner link
    // so it's ready when they confirm. The link won't be usable until they log in.

    // Insert into custom "user" table (extends auth.users with role and status)
    // Uses admin client to bypass RLS since session may not be established yet
    try {
      const adminClient = createAdminSupabaseClient();
      const { error: userTableError } = await adminClient.from('user').insert({
        id: authData.user.id,
        email: authData.user.email ?? email,
        role: UserRole.PARTNER,
        status: 'active',
      });

      if (userTableError) {
        console.error('Failed to insert into user table:', userTableError.message);
      }
    } catch (e) {
      console.error('Could not create admin client for user table insert:', e);
    }

    // Create the partner link
    const { error: linkError } = await this.supabase.from('partner_link').insert({
      primary_user_id: invite.primary_user_id,
      partner_user_id: authData.user.id,
      status: PartnerLinkStatus.ACTIVE,
      linked_at: new Date().toISOString(),
    });

    if (linkError) {
      return {
        success: false,
        error: {
          code: 'LINK_ERROR',
          message:
            'Failed to create partner link. The primary user may already have a linked partner.',
        },
      };
    }

    // Mark invite as accepted
    await this.supabase
      .from('secure_invite')
      .update({ status: InviteStatus.ACCEPTED })
      .eq('id', invite.id);

    return {
      success: true,
      data: {
        userId: authData.user.id,
        email: authData.user.email ?? email,
        role: UserRole.PARTNER,
        needsEmailConfirmation,
      },
    };
  }

  /**
   * Authenticate a user with email and password.
   */
  async login(email: string, password: string): Promise<AuthServiceResult<LoginResult>> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      };
    }

    if (!data.user || !data.session) {
      return {
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Failed to authenticate',
        },
      };
    }

    const role = (data.user.user_metadata?.role as UserRole) || UserRole.PRIMARY;

    return {
      success: true,
      data: {
        userId: data.user.id,
        email: data.user.email ?? email,
        role,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      },
    };
  }

  /**
   * Sign out the current user.
   */
  async logout(): Promise<AuthServiceResult<void>> {
    const { error } = await this.supabase.auth.signOut();

    if (error) {
      return {
        success: false,
        error: {
          code: 'LOGOUT_ERROR',
          message: 'Failed to sign out',
        },
      };
    }

    return { success: true };
  }

  /**
   * Get the current user's context (role, linked partner ID, sharing permissions).
   * Used by middleware and API routes to attach user context.
   */
  async getUserContext(): Promise<AuthServiceResult<UserContext>> {
    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser();

    if (error || !user) {
      return {
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'No authenticated user',
        },
      };
    }

    const role = (user.user_metadata?.role as UserRole) || UserRole.PRIMARY;
    let linkedPartnerId: string | null = null;

    // For primary users, find their linked partner
    if (role === UserRole.PRIMARY) {
      const { data: link } = await this.supabase
        .from('partner_link')
        .select('partner_user_id')
        .eq('primary_user_id', user.id)
        .eq('status', PartnerLinkStatus.ACTIVE)
        .single();

      linkedPartnerId = link?.partner_user_id || null;
    }

    // For partner users, find their linked primary
    if (role === UserRole.PARTNER) {
      const { data: link } = await this.supabase
        .from('partner_link')
        .select('primary_user_id')
        .eq('partner_user_id', user.id)
        .eq('status', PartnerLinkStatus.ACTIVE)
        .single();

      linkedPartnerId = link?.primary_user_id || null;
    }

    return {
      success: true,
      data: {
        userId: user.id,
        email: user.email ?? '',
        role,
        linkedPartnerId,
      },
    };
  }
}
