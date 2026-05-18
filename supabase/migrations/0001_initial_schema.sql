-- Migration: 0001_initial_schema.sql
-- Description: Initial database schema for Know Your Woman Cycle
-- Creates all enums, tables, constraints, indexes, and RLS policies

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE user_role AS ENUM ('primary', 'partner', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'expired');
CREATE TYPE partner_link_status AS ENUM ('active', 'revoked', 'unlinked');
CREATE TYPE cycle_phase AS ENUM ('menstrual', 'follicular', 'ovulation', 'early_luteal', 'late_luteal');
CREATE TYPE notification_type AS ENUM ('daily_summary', 'phase_alert', 'reminder', 'date_request');
CREATE TYPE notification_status AS ENUM ('sent', 'failed', 'retrying');
CREATE TYPE notification_frequency AS ENUM ('daily', 'phase_based', 'custom');
CREATE TYPE delivery_time AS ENUM ('morning', 'evening');
CREATE TYPE date_request_status AS ENUM ('pending', 'sent', 'failed');

-- ============================================================================
-- TABLES
-- ============================================================================

-- User table
-- Note: password_hash is managed by Supabase Auth; this table extends auth.users
CREATE TABLE "user" (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role user_role NOT NULL DEFAULT 'primary',
    status user_status NOT NULL DEFAULT 'active',
    suspension_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Suspension reason must be 1-500 chars when provided
    CONSTRAINT chk_suspension_reason_length
        CHECK (suspension_reason IS NULL OR (char_length(suspension_reason) >= 1 AND char_length(suspension_reason) <= 500))
);

-- Partner Link table
CREATE TABLE partner_link (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    partner_user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    status partner_link_status NOT NULL DEFAULT 'active',
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,

    -- Ensure primary and partner are different users
    CONSTRAINT chk_different_users CHECK (primary_user_id != partner_user_id)
);

-- Unique constraint: one active partner link per primary user
CREATE UNIQUE INDEX idx_one_active_partner_per_primary
    ON partner_link (primary_user_id)
    WHERE status = 'active';

-- Secure Invite table
CREATE TABLE secure_invite (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    status invite_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Invite expires in 72 hours: expires_at = created_at + interval '72 hours'
    CONSTRAINT chk_invite_expiry CHECK (expires_at = created_at + INTERVAL '72 hours')
);

-- Cycle Record table
-- Note: Application-level validation enforces max 12 historical records per user
CREATE TABLE cycle_record (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    cycle_length_days INTEGER NOT NULL DEFAULT 28,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Cycle start dates must be in the past (today or earlier)
    CONSTRAINT chk_start_date_not_future CHECK (start_date <= CURRENT_DATE)
);

-- Phase Customization table
CREATE TABLE phase_customization (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE UNIQUE,
    menstrual_days INTEGER NOT NULL DEFAULT 5,
    follicular_days INTEGER NOT NULL DEFAULT 8,
    ovulation_days INTEGER NOT NULL DEFAULT 1,
    early_luteal_days INTEGER NOT NULL DEFAULT 7,
    late_luteal_days INTEGER NOT NULL DEFAULT 7,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Each phase duration must be between 1 and 14 days
    CONSTRAINT chk_menstrual_days CHECK (menstrual_days BETWEEN 1 AND 14),
    CONSTRAINT chk_follicular_days CHECK (follicular_days BETWEEN 1 AND 14),
    CONSTRAINT chk_ovulation_days CHECK (ovulation_days BETWEEN 1 AND 14),
    CONSTRAINT chk_early_luteal_days CHECK (early_luteal_days BETWEEN 1 AND 14),
    CONSTRAINT chk_late_luteal_days CHECK (late_luteal_days BETWEEN 1 AND 14)
);

-- Personal Note table
CREATE TABLE personal_note (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    phase cycle_phase NOT NULL,
    content TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Personal notes max 500 characters
    CONSTRAINT chk_note_content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 500),

    -- One note per user per phase
    CONSTRAINT uq_user_phase_note UNIQUE (primary_user_id, phase)
);

-- Sharing Preferences table
CREATE TABLE sharing_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE UNIQUE,
    emotional_tendencies BOOLEAN NOT NULL DEFAULT TRUE,
    behavioral_patterns BOOLEAN NOT NULL DEFAULT TRUE,
    energy_levels BOOLEAN NOT NULL DEFAULT TRUE,
    communication_guidance BOOLEAN NOT NULL DEFAULT TRUE,
    daily_summaries BOOLEAN NOT NULL DEFAULT TRUE,
    phase_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    partner_reminders BOOLEAN NOT NULL DEFAULT TRUE,
    email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Survey Response table
CREATE TABLE survey_response (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    selected_options TEXT[] NOT NULL,
    free_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Question number must be 1-6
    CONSTRAINT chk_question_number CHECK (question_number BETWEEN 1 AND 6),

    -- Free text max 200 characters
    CONSTRAINT chk_free_text_length CHECK (free_text IS NULL OR char_length(free_text) <= 200),

    -- One response per user per question
    CONSTRAINT uq_user_question UNIQUE (primary_user_id, question_number)
);

-- Daily Summary table
CREATE TABLE daily_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    summary_date DATE NOT NULL,
    todays_state TEXT NOT NULL,
    best_approach JSONB NOT NULL,
    avoid_this JSONB NOT NULL,
    phase_at_generation cycle_phase NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One summary per user per date
    CONSTRAINT uq_user_summary_date UNIQUE (primary_user_id, summary_date)
);

-- Date Request table
CREATE TABLE date_request (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    location TEXT,
    mood TEXT,
    preferred_date DATE,
    window_start DATE,
    window_end DATE,
    personal_notes TEXT,
    status date_request_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Location max 200 characters
    CONSTRAINT chk_location_length CHECK (location IS NULL OR char_length(location) <= 200),

    -- Mood max 200 characters
    CONSTRAINT chk_mood_length CHECK (mood IS NULL OR char_length(mood) <= 200),

    -- Personal notes max 500 characters
    CONSTRAINT chk_date_request_notes_length CHECK (personal_notes IS NULL OR char_length(personal_notes) <= 500),

    -- Window end must be >= window start when both provided
    CONSTRAINT chk_date_window_range CHECK (
        window_start IS NULL OR window_end IS NULL OR window_end >= window_start
    )
);

-- Notification Preferences table
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE UNIQUE,
    frequency notification_frequency NOT NULL DEFAULT 'daily',
    delivery_time delivery_time NOT NULL DEFAULT 'morning',
    reminders_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_time TIME NOT NULL DEFAULT '09:00',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification Log table
CREATE TABLE notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    status notification_status NOT NULL DEFAULT 'sent',
    retry_count INTEGER NOT NULL DEFAULT 0,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    next_retry_at TIMESTAMPTZ,

    -- Notification retry max 3
    CONSTRAINT chk_retry_count CHECK (retry_count >= 0 AND retry_count <= 3)
);

-- Admin Annotation table
CREATE TABLE admin_annotation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    cycle_record_id UUID NOT NULL REFERENCES cycle_record(id) ON DELETE CASCADE,
    phase cycle_phase,  -- NULL means cycle-level annotation
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Annotations must be 1-2000 characters
    CONSTRAINT chk_annotation_content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 2000)
);

-- Admin Override table
CREATE TABLE admin_override (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    cycle_record_id UUID NOT NULL REFERENCES cycle_record(id) ON DELETE CASCADE,
    phase cycle_phase NOT NULL,
    replacement_content TEXT NOT NULL,
    original_content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Replacement content must be 1-2000 characters
    CONSTRAINT chk_override_replacement_length CHECK (char_length(replacement_content) >= 1 AND char_length(replacement_content) <= 2000),

    -- One override per cycle record per phase
    CONSTRAINT uq_override_cycle_phase UNIQUE (cycle_record_id, phase)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_partner_link_primary ON partner_link(primary_user_id);
CREATE INDEX idx_partner_link_partner ON partner_link(partner_user_id);
CREATE INDEX idx_secure_invite_primary ON secure_invite(primary_user_id);
CREATE INDEX idx_secure_invite_token ON secure_invite(token);
CREATE INDEX idx_cycle_record_primary ON cycle_record(primary_user_id);
CREATE INDEX idx_cycle_record_start_date ON cycle_record(primary_user_id, start_date DESC);
CREATE INDEX idx_personal_note_primary ON personal_note(primary_user_id);
CREATE INDEX idx_survey_response_primary ON survey_response(primary_user_id);
CREATE INDEX idx_daily_summary_primary_date ON daily_summary(primary_user_id, summary_date DESC);
CREATE INDEX idx_date_request_primary ON date_request(primary_user_id);
CREATE INDEX idx_notification_log_partner ON notification_log(partner_user_id);
CREATE INDEX idx_notification_log_status ON notification_log(status) WHERE status = 'retrying';
CREATE INDEX idx_admin_annotation_cycle ON admin_annotation(cycle_record_id);
CREATE INDEX idx_admin_override_cycle ON admin_override(cycle_record_id);
CREATE INDEX idx_user_email ON "user"(email);
CREATE INDEX idx_user_status ON "user"(status);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE secure_invite ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase_customization ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_note ENABLE ROW LEVEL SECURITY;
ALTER TABLE sharing_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_response ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE date_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_annotation ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_override ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- --------------------------------------------------------------------------
-- USER table policies
-- --------------------------------------------------------------------------

-- Users can read their own profile
CREATE POLICY user_select_own ON "user"
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY user_update_own ON "user"
    FOR UPDATE USING (auth.uid() = id);

-- Admin users have full read access to all users
CREATE POLICY user_admin_select ON "user"
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM "user" WHERE id = auth.uid() AND role = 'admin')
    );

-- Admin users can update any user
CREATE POLICY user_admin_update ON "user"
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM "user" WHERE id = auth.uid() AND role = 'admin')
    );

-- Admin users can delete any user
CREATE POLICY user_admin_delete ON "user"
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM "user" WHERE id = auth.uid() AND role = 'admin')
    );

-- Allow insert during registration (service role handles this)
CREATE POLICY user_insert ON "user"
    FOR INSERT WITH CHECK (auth.uid() = id);

-- --------------------------------------------------------------------------
-- PARTNER_LINK table policies
-- --------------------------------------------------------------------------

-- Primary users can view their own partner links
CREATE POLICY partner_link_primary_select ON partner_link
    FOR SELECT USING (auth.uid() = primary_user_id);

-- Partner users can view links they are part of
CREATE POLICY partner_link_partner_select ON partner_link
    FOR SELECT USING (auth.uid() = partner_user_id);

-- Primary users can manage their own partner links
CREATE POLICY partner_link_primary_manage ON partner_link
    FOR ALL USING (auth.uid() = primary_user_id);

-- Admin full access to partner links
CREATE POLICY partner_link_admin ON partner_link
    FOR ALL USING (
        EXISTS (SELECT 1 FROM "user" WHERE id = auth.uid() AND role = 'admin')
    );

-- --------------------------------------------------------------------------
-- SECURE_INVITE table policies
-- --------------------------------------------------------------------------

-- Primary users can manage their own invites
CREATE POLICY secure_invite_primary ON secure_invite
    FOR ALL USING (auth.uid() = primary_user_id);

-- Allow reading invites by token (for acceptance - handled via service role)
-- Admin full access
CREATE POLICY secure_invite_admin ON secure_invite
    FOR ALL USING (
        EXISTS (SELECT 1 FROM "user" WHERE id = auth.uid() AND role = 'admin')
    );

-- --------------------------------------------------------------------------
-- CYCLE_RECORD table policies
-- --------------------------------------------------------------------------

-- Primary users can only access their own cycle data
CREATE POLICY cycle_record_owner ON cycle_record
    FOR ALL USING (auth.uid() = primary_user_id);

-- Partners can read cycle records when sharing is active (read-only)
CREATE POLICY cycle_record_partner_read ON cycle_record
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM partner_link pl
            WHERE pl.partner_user_id = auth.uid()
            AND pl.primary_user_id = cycle_record.primary_user_id
            AND pl.status = 'active'
        )
    );

-- Admin users have full read access to cycle records
CREATE POLICY cycle_record_admin ON cycle_record
    FOR ALL USING (
        EXISTS (SELECT 1 FROM "user" WHERE id = auth.uid() AND role = 'admin')
    );

-- --------------------------------------------------------------------------
-- PHASE_CUSTOMIZATION table policies
-- --------------------------------------------------------------------------

-- Primary users can manage their own phase customization
CREATE POLICY phase_customization_owner ON phase_customization
    FOR ALL USING (auth.uid() = primary_user_id);

-- Admin read access
CREATE POLICY phase_customization_admin ON phase_customization
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM "user" WHERE id = auth.uid() AND role = 'admin')
    );

-- --------------------------------------------------------------------------
-- PERSONAL_NOTE table policies
-- --------------------------------------------------------------------------

-- Primary users can manage their own personal notes
CREATE POLICY personal_note_owner ON personal_note
    FOR ALL USING (auth.uid() = primary_user_id);

-- Partners can read personal notes when sharing is active
CREATE POLICY personal_note_partner_read ON personal_note
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM partner_link pl
            JOIN sharing_preferences sp ON sp.primary_user_id = pl.primary_user_id
            WHERE pl.partner_user_id = auth.uid()
            AND pl.primary_user_id = personal_note.primary_user_id
            AND pl.status = 'active'
        )
    );

-- Admin read access
CREATE POLICY personal_note_admin ON personal_note
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM "user" WHERE id = auth.uid() AND role = 'admin')
    );

-- --------------------------------------------------------------------------
-- SHARING_PREFERENCES table policies
-- --------------------------------------------------------------------------

-- Primary users can manage their own sharing preferences
CREATE POLICY sharing_preferences_owner ON sharing_preferences
    FOR ALL USING (auth.uid() = primary_user_id);

-- Partners can read sharing preferences (to know what's shared)
CREATE POLICY sharing_preferences_partner_read ON sharing_preferences
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM partner_link pl
            WHERE pl.partner_user_id = auth.uid()
            AND pl.primary_user_id = sharing_preferences.primary_user_id
            AND pl.status = 'active'
        )
    );

-- Admin read access
CREATE POLICY sharing_preferences_admin ON sharing_preferences
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM "user" WHERE id = auth.uid() AND role = 'admin')
    );

-- --------------------------------------------------------------------------
-- SURVEY_RESPONSE table policies
-- --------------------------------------------------------------------------

-- Primary users can manage their own survey responses
CREATE POLICY survey_response_owner ON survey_response
    FOR ALL USING (auth.uid() = primary_user_id);

-- Admin read access
CREATE POLICY survey_response_admin ON survey_response
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM "user" WHERE id = auth.uid() AND role = 'admin')
    );

-- Partners CANNOT access survey responses (privacy requirement)

-- --------------------------------------------------------------------------
-- DAILY_SUMMARY table policies
-- --------------------------------------------------------------------------

-- Primary users can read their own daily summaries
CREATE POLICY daily_summary_owner ON daily_summary
    FOR SELECT USING (auth.uid() = primary_user_id);

-- Partners can read daily summaries when sharing is active and daily_summaries enabled
CREATE POLICY daily_summary_partner_read ON daily_summary
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM partner_link pl
            JOIN sharing_preferences sp ON sp.primary_user_id = pl.primary_user_id
            WHERE pl.partner_user_id = auth.uid()
            AND pl.primary_user_id = daily_summary.primary_user_id
            AND pl.status = 'active'
            AND sp.daily_summaries = TRUE
        )
    );

-- Allow insert/update for system (cron jobs use service role)
CREATE POLICY daily_summary_system_write ON daily_summary
    FOR INSERT WITH CHECK (auth.uid() = primary_user_id);

CREATE POLICY daily_summary_system_update ON daily_summary
    FOR UPDATE USING (auth.uid() = primary_user_id);

-- Admin read access
CREATE POLICY daily_summary_admin ON daily_summary
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM "user" WHERE id = auth.uid() AND role = 'admin')
    );

-- --------------------------------------------------------------------------
-- DATE_REQUEST table policies
-- --------------------------------------------------------------------------

-- Primary users can manage their own date requests
CREATE POLICY date_request_owner ON date_request
    FOR ALL USING (auth.uid() = primary_user_id);

-- Admin read access
CREATE POLICY date_request_admin ON date_request
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM "user" WHERE id = auth.uid() AND role = 'admin')
    );

-- --------------------------------------------------------------------------
-- NOTIFICATION_PREFERENCES table policies
-- --------------------------------------------------------------------------

-- Partner users can manage their own notification preferences
CREATE POLICY notification_preferences_owner ON notification_preferences
    FOR ALL USING (auth.uid() = partner_user_id);

-- Admin read access
CREATE POLICY notification_preferences_admin ON notification_preferences
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM "user" WHERE id = auth.uid() AND role = 'admin')
    );

-- --------------------------------------------------------------------------
-- NOTIFICATION_LOG table policies
-- --------------------------------------------------------------------------

-- Partner users can read their own notification logs
CREATE POLICY notification_log_owner ON notification_log
    FOR SELECT USING (auth.uid() = partner_user_id);

-- Admin read access
CREATE POLICY notification_log_admin ON notification_log
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM "user" WHERE id = auth.uid() AND role = 'admin')
    );

-- System can insert/update notification logs (service role)
CREATE POLICY notification_log_insert ON notification_log
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM partner_link pl
            WHERE pl.partner_user_id = notification_log.partner_user_id
            AND pl.primary_user_id = auth.uid()
            AND pl.status = 'active'
        )
        OR EXISTS (SELECT 1 FROM "user" WHERE id = auth.uid() AND role = 'admin')
    );

-- --------------------------------------------------------------------------
-- ADMIN_ANNOTATION table policies
-- --------------------------------------------------------------------------

-- Only admin users can manage annotations
CREATE POLICY admin_annotation_admin ON admin_annotation
    FOR ALL USING (
        EXISTS (SELECT 1 FROM "user" WHERE id = auth.uid() AND role = 'admin')
    );

-- Primary users can read annotations on their own cycle records
CREATE POLICY admin_annotation_owner_read ON admin_annotation
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM cycle_record cr
            WHERE cr.id = admin_annotation.cycle_record_id
            AND cr.primary_user_id = auth.uid()
        )
    );

-- Partners can read annotations when sharing is active
CREATE POLICY admin_annotation_partner_read ON admin_annotation
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM cycle_record cr
            JOIN partner_link pl ON pl.primary_user_id = cr.primary_user_id
            WHERE cr.id = admin_annotation.cycle_record_id
            AND pl.partner_user_id = auth.uid()
            AND pl.status = 'active'
        )
    );

-- --------------------------------------------------------------------------
-- ADMIN_OVERRIDE table policies
-- --------------------------------------------------------------------------

-- Only admin users can manage overrides
CREATE POLICY admin_override_admin ON admin_override
    FOR ALL USING (
        EXISTS (SELECT 1 FROM "user" WHERE id = auth.uid() AND role = 'admin')
    );

-- Primary users can read overrides on their own cycle records
CREATE POLICY admin_override_owner_read ON admin_override
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM cycle_record cr
            WHERE cr.id = admin_override.cycle_record_id
            AND cr.primary_user_id = auth.uid()
        )
    );

-- Partners can read overrides when sharing is active
CREATE POLICY admin_override_partner_read ON admin_override
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM cycle_record cr
            JOIN partner_link pl ON pl.primary_user_id = cr.primary_user_id
            WHERE cr.id = admin_override.cycle_record_id
            AND pl.partner_user_id = auth.uid()
            AND pl.status = 'active'
        )
    );

-- ============================================================================
-- TRIGGERS FOR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_updated_at
    BEFORE UPDATE ON "user"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_phase_customization_updated_at
    BEFORE UPDATE ON phase_customization
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_personal_note_updated_at
    BEFORE UPDATE ON personal_note
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_sharing_preferences_updated_at
    BEFORE UPDATE ON sharing_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_survey_response_updated_at
    BEFORE UPDATE ON survey_response
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_admin_annotation_updated_at
    BEFORE UPDATE ON admin_annotation
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_admin_override_updated_at
    BEFORE UPDATE ON admin_override
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ENABLE REALTIME for tables that need live updates
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE sharing_preferences;
ALTER PUBLICATION supabase_realtime ADD TABLE daily_summary;
ALTER PUBLICATION supabase_realtime ADD TABLE cycle_record;
ALTER PUBLICATION supabase_realtime ADD TABLE partner_link;
