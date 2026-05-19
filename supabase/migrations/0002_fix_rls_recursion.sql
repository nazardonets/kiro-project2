-- Migration: 0002_fix_rls_recursion.sql
-- Description: Fix infinite recursion in RLS policies on "user" table.
-- The admin policies were querying the "user" table from within its own policies,
-- causing infinite recursion. Fix: use auth.jwt() metadata instead.

-- ============================================================================
-- DROP problematic policies on "user" table
-- ============================================================================

DROP POLICY IF EXISTS user_admin_select ON "user";
DROP POLICY IF EXISTS user_admin_update ON "user";
DROP POLICY IF EXISTS user_admin_delete ON "user";

-- ============================================================================
-- Recreate admin policies using auth.jwt() metadata (no recursion)
-- ============================================================================

-- Admin users have full read access to all users
CREATE POLICY user_admin_select ON "user"
    FOR SELECT USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

-- Admin users can update any user
CREATE POLICY user_admin_update ON "user"
    FOR UPDATE USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

-- Admin users can delete any user
CREATE POLICY user_admin_delete ON "user"
    FOR DELETE USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

-- ============================================================================
-- Fix other tables that reference "user" table in their admin policies
-- These also cause recursion when a non-admin user triggers them
-- ============================================================================

-- partner_link
DROP POLICY IF EXISTS partner_link_admin ON partner_link;
CREATE POLICY partner_link_admin ON partner_link
    FOR ALL USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

-- secure_invite
DROP POLICY IF EXISTS secure_invite_admin ON secure_invite;
CREATE POLICY secure_invite_admin ON secure_invite
    FOR ALL USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

-- cycle_record
DROP POLICY IF EXISTS cycle_record_admin ON cycle_record;
CREATE POLICY cycle_record_admin ON cycle_record
    FOR ALL USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

-- phase_customization
DROP POLICY IF EXISTS phase_customization_admin ON phase_customization;
CREATE POLICY phase_customization_admin ON phase_customization
    FOR SELECT USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

-- personal_note
DROP POLICY IF EXISTS personal_note_admin ON personal_note;
CREATE POLICY personal_note_admin ON personal_note
    FOR SELECT USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

-- sharing_preferences
DROP POLICY IF EXISTS sharing_preferences_admin ON sharing_preferences;
CREATE POLICY sharing_preferences_admin ON sharing_preferences
    FOR SELECT USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

-- survey_response
DROP POLICY IF EXISTS survey_response_admin ON survey_response;
CREATE POLICY survey_response_admin ON survey_response
    FOR SELECT USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

-- daily_summary
DROP POLICY IF EXISTS daily_summary_admin ON daily_summary;
CREATE POLICY daily_summary_admin ON daily_summary
    FOR SELECT USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

-- date_request
DROP POLICY IF EXISTS date_request_admin ON date_request;
CREATE POLICY date_request_admin ON date_request
    FOR SELECT USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

-- notification_preferences
DROP POLICY IF EXISTS notification_preferences_admin ON notification_preferences;
CREATE POLICY notification_preferences_admin ON notification_preferences
    FOR SELECT USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

-- notification_log
DROP POLICY IF EXISTS notification_log_admin ON notification_log;
CREATE POLICY notification_log_admin ON notification_log
    FOR SELECT USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

-- admin_annotation
DROP POLICY IF EXISTS admin_annotation_admin ON admin_annotation;
CREATE POLICY admin_annotation_admin ON admin_annotation
    FOR ALL USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

-- admin_override
DROP POLICY IF EXISTS admin_override_admin ON admin_override;
CREATE POLICY admin_override_admin ON admin_override
    FOR ALL USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

-- notification_log insert policy also references "user" table
DROP POLICY IF EXISTS notification_log_insert ON notification_log;
CREATE POLICY notification_log_insert ON notification_log
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM partner_link pl
            WHERE pl.partner_user_id = notification_log.partner_user_id
            AND pl.primary_user_id = auth.uid()
            AND pl.status = 'active'
        )
        OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );
