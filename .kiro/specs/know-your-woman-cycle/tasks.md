# Implementation Plan: Know Your Woman Cycle

## Overview

This plan implements a full-stack Next.js 14 application with Supabase (PostgreSQL + Auth), Resend email, and Vercel Cron. Tasks are ordered by dependency: database schema and core types first, then service layer, then API routes, then UI components, then notifications and scheduled jobs. Property-based tests validate the 34 correctness properties defined in the design.

## Tasks

- [x] 1. Project setup and database schema
  - [x] 1.1 Initialize Next.js 14 project with App Router, Tailwind CSS, shadcn/ui, and configure Supabase client, Resend, Zod, vitest, and fast-check
    - Create Next.js 14 app with TypeScript
    - Install dependencies: @supabase/supabase-js, @supabase/ssr, resend, zod, vitest, fast-check, @testing-library/react
    - Configure vitest with fast-check support
    - Set up environment variables structure (.env.local.example)
    - _Requirements: 4.1, 4.2_

  - [x] 1.2 Create Supabase database migration with all tables, constraints, enums, and RLS policies
    - Define enums: user_role, user_status, invite_status, partner_link_status, cycle_phase, notification_type, notification_status, notification_frequency, delivery_time, date_request_status
    - Create tables: user, partner_link, secure_invite, cycle_record, phase_customization, personal_note, sharing_preferences, survey_response, daily_summary, date_request, notification_preferences, notification_log, admin_annotation, admin_override
    - Add check constraints (password length, note length, retry count, date range)
    - Add unique constraints (one active partner link per primary user, unique invite token)
    - Implement RLS policies for data access control
    - _Requirements: 1.1, 1.5, 2.1, 2.2, 5.1, 6.7, 7.1_

  - [x] 1.3 Define TypeScript interfaces and Zod schemas for all data models
    - Create types for User, PartnerLink, SecureInvite, CycleRecord, PhaseCustomization, PersonalNote, SharingPreferences, SurveyResponse, DailySummary, DateRequest, NotificationPreferences, NotificationLog, AdminAnnotation, AdminOverride
    - Create Zod validation schemas for all API inputs
    - Define shared enums and constants (phase durations, limits)
    - _Requirements: 1.1, 7.1, 9.1, 9.4, 11.2, 11.3, 11.5_

  - [x] 1.4 Configure code quality tooling and engineering standards
    - Configure ESLint with @typescript-eslint/strict ruleset and Next.js recommended rules
    - Configure Prettier (2-space indent, single quotes, trailing commas, 100 char line width)
    - Enable TypeScript strict mode (strict: true in tsconfig.json)
    - Configure ESLint import ordering rules (external → internal → relative)
    - Set up Husky with lint-staged for pre-commit hooks (lint + format check)
    - Configure vitest coverage reporting with 80% minimum threshold for services/ and lib/ directories
    - Create README.md with setup instructions, architecture overview, environment variables, and development workflows
    - _Requirements: 21.1, 21.2, 21.6, 21.7, 22.1, 22.3, 23.5, 24.1, 24.2, 24.3, 24.4, 24.5, 24.6_

- [x] 2. Validation layer and core utilities
  - [x] 2.1 Implement password validation function with detailed error messages
    - Validate length 8-128 characters, at least one uppercase, one lowercase, one digit
    - Return field-specific error messages indicating which requirements are not met
    - _Requirements: 1.1, 1.7_

  - [x] 2.2 Write property test for password validation
    - **Property 1: Password Validation Correctness**
    - **Validates: Requirements 1.1, 1.7**

  - [x] 2.3 Implement cycle start date validation function
    - Accept dates within [today - 365 days, today]
    - Reject future dates and dates older than 365 days
    - Return appropriate validation error messages
    - _Requirements: 7.1, 7.4_

  - [x] 2.4 Write property test for cycle start date validation
    - **Property 14: Cycle Start Date Range Validation**
    - **Validates: Requirements 7.1, 7.4**

  - [x] 2.5 Implement phase duration customization validation
    - Validate each duration is between 1 and 14 days
    - Validate sum of all durations equals total cycle length
    - Return specific error messages for constraint violations
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 2.6 Write property test for phase duration validation
    - **Property 20: Phase Duration Customization Validation**
    - **Validates: Requirements 9.1, 9.2, 9.3**

  - [x] 2.7 Implement text field length validation utility
    - Validate personal notes (max 500 chars), location/mood (max 200 chars), annotations/overrides (1-2000 chars), suspension reason (1-500 chars), behavioral prompts (max 280 chars)
    - Return field-specific constraint violation messages
    - _Requirements: 9.4, 11.2, 11.3, 11.5, 6.3, 6.5, 5.4_

  - [x] 2.8 Write property test for text field length validation
    - **Property 21: Text Field Length Validation**
    - **Validates: Requirements 9.4, 11.2, 11.3, 11.5, 6.3, 6.5, 5.4**

  - [x] 2.9 Implement survey response validation
    - Validate Questions 1, 2, 3, 5, 6 have exactly one selected response
    - Validate Question 4 has one or more selected responses
    - Validate free-text field max 200 characters for Question 4 "Other"
    - _Requirements: 20.8_

  - [x] 2.10 Write property test for survey selection constraints
    - **Property 32: Survey Selection Constraints**
    - **Validates: Requirements 20.8**

- [x] 3. Checkpoint - Ensure all validation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. PhaseEngine service - core cycle calculation logic
  - [x] 4.1 Implement PhaseEngine with standard phase calculation
    - Calculate current phase from start date and elapsed days using standard boundaries (Menstrual 1-5, Follicular 6-13, Ovulation 14, Early Luteal 15-21, Late Luteal 22-28)
    - Handle overdue cycles (elapsed > cycle length) by returning Late Luteal with overdue indicator
    - Support custom phase durations when provided
    - _Requirements: 8.1, 8.6_

  - [x] 4.2 Write property test for phase calculation correctness
    - **Property 17: Phase Calculation Correctness**
    - **Validates: Requirements 8.1, 8.6**

  - [x] 4.3 Implement phase duration scaling based on historical cycle data
    - Calculate average cycle length from 2+ historical records
    - Proportionally scale each phase duration relative to 28-day default
    - Ensure scaled durations sum exactly to average cycle length
    - _Requirements: 8.2_

  - [x] 4.4 Write property test for phase duration scaling
    - **Property 18: Phase Duration Scaling Preserves Total**
    - **Validates: Requirements 8.2**

  - [x] 4.5 Implement 60-day phase prediction generator
    - Generate predictions covering exactly 60 days from current date
    - Use standard 28-day durations when fewer than 2 historical records exist
    - Use scaled durations when 2+ records available
    - Ensure no gaps or overlaps between predicted phases
    - _Requirements: 8.4_

  - [x] 4.6 Write property test for 60-day prediction coverage
    - **Property 19: 60-Day Prediction Coverage**
    - **Validates: Requirements 8.4**

- [x] 5. CycleService - cycle data management
  - [x] 5.1 Implement CycleService with CRUD operations for cycle records
    - Create new cycle records with validation
    - Enforce max 12 historical records per user
    - Implement cycle overlap conflict detection based on average cycle length or 28-day default
    - _Requirements: 7.2, 7.3, 7.5_

  - [x] 5.2 Write property test for historical cycle record limit
    - **Property 15: Historical Cycle Record Limit**
    - **Validates: Requirements 7.3**

  - [x] 5.3 Write property test for cycle overlap conflict detection
    - **Property 16: Cycle Overlap Conflict Detection**
    - **Validates: Requirements 7.5**

- [x] 6. Authentication and invite system
  - [x] 6.1 Implement Supabase Auth integration with registration and login
    - Primary_User registration with email and validated password
    - Partner_User registration via invite acceptance
    - Session management with Edge Middleware
    - _Requirements: 1.1, 1.3, 1.6_

  - [x] 6.2 Implement Secure Invite generation and acceptance
    - Generate unique token with 72-hour expiry (expires_at = created_at + 72h)
    - Validate invite on acceptance (not expired, not already used)
    - Create Partner_User account and PartnerLink on acceptance
    - Enforce one active partner link per Primary_User
    - _Requirements: 1.2, 1.4, 1.5_

  - [x] 6.3 Write property test for secure invite expiry
    - **Property 2: Secure Invite Expiry**
    - **Validates: Requirements 1.2**

  - [x] 6.4 Write property test for one active partner link invariant
    - **Property 3: One Active Partner Link Invariant**
    - **Validates: Requirements 1.5**

- [x] 7. Checkpoint - Ensure core services and auth tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. SharingService and access control
  - [x] 8.1 Implement SharingService with category toggles and notification type toggles
    - Toggle individual insight categories independently
    - Toggle notification types independently (daily summaries, phase alerts, partner reminders)
    - Default all categories and notifications to enabled on partner linking
    - Propagate changes via Supabase Realtime within 5 seconds
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 8.2 Write property test for independent sharing toggle
    - **Property 7: Independent Sharing Toggle**
    - **Validates: Requirements 3.1, 3.3**

  - [x] 8.3 Write property test for sharing category round trip
    - **Property 8: Sharing Category Round Trip**
    - **Validates: Requirements 3.2**

  - [x] 8.4 Implement data access control enforcement
    - Block Partner_User from modifying any Cycle_Data
    - Enforce RLS policies for cycle data ownership
    - Return appropriate error messages for unauthorized access attempts
    - _Requirements: 2.1, 2.2_

  - [x] 8.5 Write property test for cycle data access control
    - **Property 4: Cycle Data Access Control**
    - **Validates: Requirements 2.1, 2.2**

  - [x] 8.6 Implement account deletion with cascade cleanup
    - Delete all associated records (CycleRecords, PersonalNotes, SurveyResponses, SharingPreferences, DailySummaries, DateRequests)
    - Deactivate linked Partner_User access
    - Require explicit confirmation step
    - _Requirements: 2.4, 2.5_

  - [x] 8.7 Write property test for account deletion cascade
    - **Property 5: Account Deletion Cascade**
    - **Validates: Requirements 2.5, 5.8**

  - [x] 8.8 Implement partner unlinking (preserves primary data, revokes partner access)
    - Remove Partner_User access to Insights_Dashboard and Guidance_Panel
    - Preserve all Primary_User data unchanged
    - Update PartnerLink status to 'unlinked'
    - _Requirements: 2.6_

  - [x] 8.9 Write property test for unlink preserves primary data
    - **Property 6: Unlink Preserves Primary Data**
    - **Validates: Requirements 2.6**

- [x] 9. SurveyService - onboarding survey and calibration
  - [x] 9.1 Implement SurveyService with survey storage and response management
    - Store responses for all 6 questions
    - Support updating responses at any time
    - Trigger recalibration within 60 seconds of update
    - _Requirements: 20.1, 20.9, 20.17, 20.18_

  - [x] 9.2 Implement survey calibration engine
    - Q1 → confidence level (high/low confidence framing)
    - Q2 → emotional emphasis (reduced/heightened)
    - Q3 → social energy recommendations (give space/engage more)
    - Q4 → avoidance triggers (prioritize in "Avoid This" content)
    - Q5 → support style (align "Best Approach" suggestions)
    - Q6 → communication approach (check-in frequency, conversation depth)
    - _Requirements: 20.10, 20.11, 20.12, 20.13, 20.14, 20.15, 20.16_

  - [x] 9.3 Write property test for survey calibration correctness
    - **Property 33: Survey Calibration Correctness**
    - **Validates: Requirements 20.10, 20.11, 20.12, 20.13, 20.14, 20.15, 20.16**

  - [x] 9.4 Write property test for survey response privacy
    - **Property 34: Survey Response Privacy**
    - **Validates: Requirements 20.20**

- [x] 10. InsightsService - phase-based content generation
  - [x] 10.1 Implement InsightsService generating phase-based insights content
    - Generate emotional tendencies (at least 3 per phase)
    - Generate cognitive tendencies (at least 2 per phase)
    - Generate behavioral tendencies (at least 2 per phase)
    - Generate energy level indicator with descriptive summary
    - Generate communication tendencies (at least 2 per phase)
    - Ensure consistent structure across all 5 phases
    - Apply survey calibration modifiers
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.7, 13.8_

  - [x] 10.2 Write property test for phase content structure completeness
    - **Property 23: Phase Content Structure Completeness**
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.5, 13.7**

- [x] 11. GuidanceService - partner guidance and daily summaries
  - [x] 11.1 Implement GuidanceService generating contextual guidance content
    - Generate 3-5 recommended supportive actions per phase
    - Generate 2-4 triggers to avoid per phase
    - Generate 2-4 communication strategies per phase
    - Generate 2-4 discouraged language patterns per phase
    - Apply survey calibration for personalization
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [x] 11.2 Write property test for guidance content count bounds
    - **Property 24: Guidance Content Count Bounds**
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4**

  - [x] 11.3 Implement Daily Summary generation
    - Generate "Today's State" section (phase name, max 3 sentences)
    - Generate "Best Approach" section (1-3 items)
    - Generate "Avoid This" section (1-3 items)
    - Incorporate survey calibration for triggers and support style
    - _Requirements: 15.1, 15.2, 15.3_

  - [x] 11.4 Write property test for daily summary structure
    - **Property 25: Daily Summary Structure**
    - **Validates: Requirements 15.1, 15.2, 15.3**

  - [x] 11.5 Implement decision support layer (behavioral prompts and situational recommendations)
    - Generate 3-5 behavioral prompts per phase (max 280 chars, max 2 sentences each)
    - Generate 2-4 situational recommendations per phase
    - _Requirements: 16.1, 16.2, 16.3_

  - [x] 11.6 Write property test for decision support content bounds
    - **Property 26: Decision Support Content Bounds**
    - **Validates: Requirements 16.1, 16.2, 16.3**

- [x] 12. Tone and language compliance layer
  - [x] 12.1 Implement tone validation utility for all generated content
    - Check for zero deterministic language ("she will feel", "always", "never", "definitely", "certainly")
    - Verify at least one probabilistic qualifier per emotional/behavioral statement
    - Verify second-person collaborative framing ("you might", "consider") not directive ("you must", "you need to")
    - Verify at least one individual variation acknowledgment per phase description
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 13.6, 14.5, 14.6_

  - [x] 12.2 Write property test for tone and language compliance
    - **Property 31: Tone and Language Compliance**
    - **Validates: Requirements 19.1, 19.2, 19.3, 19.4, 19.5, 13.6, 14.5, 14.6**

- [x] 13. Checkpoint - Ensure all service layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. NotificationService - email notifications and retry logic
  - [x] 14.1 Implement NotificationService with email composition and dispatch via Resend
    - Compose email with: phase name + summary (max 3 sentences), 1-3 emotional/behavioral insights, 1-3 "Do" recommendations, 1-3 "Don't" recommendations, interaction guidance (max 2 sentences)
    - Support notification frequency: daily, phase-based, custom timing
    - Respect Primary_User enable/disable of email notifications
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.10_

  - [x] 14.2 Write property test for email notification content structure
    - **Property 27: Email Notification Content Structure**
    - **Validates: Requirements 17.1, 17.2, 17.3, 17.4**

  - [x] 14.3 Implement email delivery retry logic (3 retries, 5-minute intervals)
    - Retry failed deliveries up to 3 times
    - Wait 5 minutes between retries
    - Mark as failed after 3 unsuccessful attempts
    - Show undelivered indicator on dashboard
    - _Requirements: 17.11_

  - [x] 14.4 Write property test for notification retry logic
    - **Property 28: Notification Retry Logic**
    - **Validates: Requirements 17.11**

  - [x] 14.5 Implement partner reminders (high-energy phases only)
    - Send reminders only during Ovulation_Phase or Follicular_Phase
    - Respect Partner_User enable/disable setting (disabled by default)
    - Respect Primary_User sharing control for partner reminders
    - Deliver at configurable time (default 9:00 AM partner timezone)
    - Limit to max one reminder per day
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

  - [x] 14.6 Write property test for reminders only during high-energy phases
    - **Property 29: Reminders Only During High-Energy Phases**
    - **Validates: Requirements 18.1, 18.5, 18.6**

  - [x] 14.7 Write property test for reminder rate limit
    - **Property 30: Reminder Rate Limit**
    - **Validates: Requirements 18.4**

- [x] 15. Date Request feature
  - [x] 15.1 Implement Date Request submission and email formatting
    - Allow optional fields: location (max 200 chars), mood (max 200 chars), timing (specific date or window), personal notes (max 500 chars)
    - Format email with labeled sections for each specified field
    - Include phase-context section with current cycle phase tendencies
    - Apply tone and language guidelines
    - Handle case where no partner is linked or sharing is revoked
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10_

  - [x] 15.2 Write property test for date request email structure
    - **Property 22: Date Request Email Structure**
    - **Validates: Requirements 11.7**

- [x] 16. AdminService - user management and cycle instance management
  - [x] 16.1 Implement AdminService with user search, suspension, and deletion
    - Search by email or account ID, max 50 results per query
    - View account details (status, creation date, partner link status)
    - Suspend accounts with recorded reason (1-500 chars)
    - Delete accounts with confirmation and cascade
    - Revoke access within 30 seconds of suspension, notify via email
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [x] 16.2 Write property test for admin search result limit
    - **Property 9: Admin Search Result Limit**
    - **Validates: Requirements 5.2**

  - [x] 16.3 Implement primary suspension cascading to partner access revocation
    - When Primary_User is suspended, revoke linked Partner_User's access to Insights_Dashboard and Guidance_Panel
    - _Requirements: 5.9_

  - [x] 16.4 Write property test for primary suspension cascades to partner
    - **Property 10: Primary Suspension Cascades to Partner**
    - **Validates: Requirements 5.9**

  - [x] 16.5 Implement admin cycle instance management (view, annotate, override)
    - Display cycle instances ordered by start_date descending (most recent first)
    - Add/edit/delete annotations (1-2000 chars) to cycle instances or phases
    - Override system-generated content with replacement text (1-2000 chars)
    - Revert overrides to restore original content
    - Preserve original user-provided data unmodified
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

  - [x] 16.6 Write property test for cycle instance ordering
    - **Property 11: Cycle Instance Ordering**
    - **Validates: Requirements 6.1**

  - [x] 16.7 Write property test for admin annotations preserve original data
    - **Property 12: Admin Annotations Preserve Original Data**
    - **Validates: Requirements 6.7**

  - [x] 16.8 Write property test for admin override revert round trip
    - **Property 13: Admin Override Revert Round Trip**
    - **Validates: Requirements 6.9**

- [x] 17. Checkpoint - Ensure all service and business logic tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. API routes - authentication and cycle management
  - [x] 18.1 Implement auth API routes (register, invite, accept-invite)
    - POST /api/auth/register - create Primary_User account
    - POST /api/auth/invite - generate Secure_Invite
    - POST /api/auth/accept-invite - accept invite, create Partner_User
    - Wire to AuthService and validation layer
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 18.2 Implement cycle API routes (start-date, history, phase, predictions, customize, notes)
    - POST /api/cycle/start-date - submit cycle start date
    - GET /api/cycle/history - retrieve cycle history
    - GET /api/cycle/phase - get current phase calculation
    - GET /api/cycle/predictions - get 60-day predictions
    - PUT /api/cycle/customize - update phase durations
    - POST/PUT /api/cycle/notes - add/update personal notes
    - Wire to CycleService, PhaseEngine, validation layer
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.4, 9.1, 9.2, 9.3, 9.4_

  - [x] 18.3 Implement sharing API routes (categories, notifications, revoke, unlink)
    - PUT /api/sharing/categories - toggle insight categories
    - PUT /api/sharing/notifications - toggle notification types
    - POST /api/sharing/revoke - revoke all sharing
    - POST /api/sharing/unlink - unlink partner
    - Wire to SharingService
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 2.3, 2.6_

  - [x] 18.4 Implement partner API routes (insights, guidance, daily-summary, notifications, reminders)
    - GET /api/partner/insights - get shared insights
    - GET /api/partner/guidance - get guidance panel content
    - GET /api/partner/daily-summary - get daily summary
    - PUT /api/partner/notifications - update notification preferences
    - PUT /api/partner/reminders - toggle/configure reminders
    - Wire to InsightsService, GuidanceService, NotificationService
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 14.1, 15.6, 17.5, 18.2, 18.3_

  - [x] 18.5 Implement survey and date request API routes
    - POST /api/survey/submit - submit onboarding survey
    - PUT /api/survey/update - update survey responses
    - POST /api/date-request - submit date request
    - Wire to SurveyService, DateRequest handling
    - _Requirements: 20.1, 20.8, 20.9, 20.17, 20.18, 11.1, 11.6_

  - [x] 18.6 Implement admin API routes (users, cycles, annotations, overrides)
    - GET /api/admin/users - search users
    - GET/PUT/DELETE /api/admin/users/:id - manage user account
    - POST /api/admin/users/:id/suspend - suspend account
    - GET /api/admin/cycles/:userId - list cycle instances
    - POST/PUT/DELETE /api/admin/cycles/:id/annotate - manage annotations
    - POST/PUT/DELETE /api/admin/cycles/:id/override - manage overrides
    - Wire to AdminService
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

- [~] 19. Checkpoint - Ensure all API route tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. Frontend - Auth pages and onboarding survey
  - [~] 20.1 Implement auth pages (login, registration, invite acceptance)
    - Registration form with email and password validation (inline errors)
    - Login form with session management
    - Invite acceptance page with token validation and registration
    - Expired invite handling with re-generation prompt
    - _Requirements: 1.1, 1.3, 1.4, 1.6, 1.7_

  - [~] 20.2 Implement onboarding survey flow (6 questions)
    - Present all 6 questions with correct prompts and response options
    - Single-select for Q1, Q2, Q3, Q5, Q6; multi-select for Q4
    - Free-text field for Q4 "Other" option (max 200 chars)
    - Supportive, non-clinical language per Requirement 19
    - Submit and store responses before granting dashboard access
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.19_

- [ ] 21. Frontend - Primary User Dashboard
  - [~] 21.1 Implement Primary Dashboard with phase display, predictions, and insights
    - Display current phase name and day number within phase
    - Display 60-day predicted upcoming phases
    - Display emotional, cognitive, and behavioral tendencies for current phase
    - Display self-care suggestions and energy management insights
    - Update content within 60 seconds of phase change
    - Empty state with prompt to input cycle start date
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [~] 21.2 Implement cycle data input (date picker) and history view
    - Date picker with selectable range [today - 365 days, today]
    - Confirmation message on successful save
    - Support up to 12 historical cycle start dates
    - Conflict warning for overlapping dates
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [~] 21.3 Implement phase customization UI and personal notes
    - Phase duration adjustment (1-14 days per phase, must sum to cycle length)
    - Validation error display when sum doesn't match
    - Personal notes per phase (max 500 chars)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [~] 21.4 Implement sharing controls UI
    - Toggle individual insight categories (emotional tendencies, behavioral patterns, energy levels, communication guidance)
    - Toggle notification types (daily summaries, phase alerts, partner reminders)
    - All enabled by default on partner linking
    - Real-time propagation within 5 seconds
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [~] 21.5 Implement Date Request form and submission
    - "Request a Date" action on Primary Dashboard
    - Optional fields: location, mood, timing (specific date or window), personal notes
    - Submit and send email to partner
    - Handle no-partner-linked and sharing-revoked states
    - Retry on delivery failure
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.9, 11.10_

- [ ] 22. Frontend - Partner Dashboard
  - [~] 22.1 Implement Partner Insights Dashboard
    - Display current cycle phase (when sharing active)
    - Display emotional tendencies, energy levels, behavioral patterns
    - Display personal notes when shared
    - Probabilistic/tendency language framing
    - Update within 60 seconds of phase change
    - Empty state when no cycle data or sharing revoked
    - Daily Summary as first visible section (no scrolling required)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 13.6, 13.8, 15.6_

  - [~] 22.2 Implement Guidance Panel for Partner
    - Display 3-5 supportive actions, 2-4 triggers to avoid, 2-4 communication strategies, 2-4 discouraged patterns
    - Suggestion-oriented language ("consider", "you might try")
    - Update on phase change
    - Hide when communication guidance category is disabled
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9_

  - [~] 22.3 Implement Partner notification settings UI
    - Configure frequency: daily, phase-based, custom timing
    - Configure delivery time: morning (6-9 AM) or evening (6-9 PM)
    - Enable/disable reminders with configurable time
    - Timezone selection
    - _Requirements: 17.5, 17.10, 18.2, 18.3_

- [ ] 23. Frontend - Admin Panel
  - [~] 23.1 Implement Admin Panel with user management
    - Admin authentication gate
    - User search by email or ID (max 50 results)
    - Account details view (status, creation date, partner link)
    - Suspend with reason, delete with confirmation
    - Manual link/unlink partner accounts
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [~] 23.2 Implement Admin cycle instance management UI
    - Display cycle instances ordered by start_date descending
    - View cycle details (start date, phases, predictions)
    - Add/edit/delete annotations (1-2000 chars)
    - Override/revert system-generated content
    - Visual indicator for overridden content
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

- [ ] 24. Responsive design and accessibility
  - [~] 24.1 Implement responsive layout and design system compliance
    - Consistent design system (16px base font, 1.5 line-height, spacing, color palette)
    - Responsive layout 320px-2560px without horizontal scrolling
    - Mobile-optimized layout below 768px (44x44px tap targets)
    - Mobile-first navigation (bottom nav or hamburger menu)
    - Body text min 16px on mobile, min 14px on desktop
    - WCAG 2.1 Level AA compliance for all interactive elements
    - Keyboard operability without hover dependency
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 4.8_

  - [ ]* 24.2 Write unit tests for responsive breakpoints and accessibility
    - Test layout rendering at key breakpoints (320px, 768px, 1024px, 2560px)
    - Test tap target sizes on mobile
    - Test keyboard navigation
    - _Requirements: 4.2, 4.3, 4.4_

- [~] 25. Checkpoint - Ensure all frontend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 26. Scheduled jobs and real-time updates
  - [~] 26.1 Implement Vercel Cron jobs for daily phase recalculation and summary regeneration
    - Midnight recalculation of current phase (per-user timezone bucketed)
    - Daily summary regeneration at midnight
    - Notification dispatch at configured delivery times
    - _Requirements: 8.3, 8.5, 15.4, 15.5, 17.6_

  - [~] 26.2 Implement Supabase Realtime subscriptions for live dashboard updates
    - Push sharing preference changes to partner dashboard within 5 seconds
    - Push cycle data updates to partner dashboard
    - Fallback to 30-second polling when Realtime unavailable
    - _Requirements: 2.3, 3.4, 12.6_

- [ ] 27. Edge Middleware and error handling
  - [~] 27.1 Implement Edge Middleware for auth validation and role-based routing
    - Validate session token on every request
    - Attach user context (role, linked partner ID, sharing permissions)
    - Route protection based on user role (primary, partner, admin)
    - _Requirements: 2.1, 5.1_

  - [~] 27.2 Implement consistent error handling across all API routes
    - Validation errors with field-specific messages (ValidationError shape)
    - Authentication errors with redirect to login
    - Authorization errors with role-appropriate 403 messages
    - Conflict errors (409) for cycle overlap
    - Rate limit errors (429) with retry-after header
    - Generic 500 for database errors with logging
    - _Requirements: 1.7, 2.2, 7.5_

- [ ] 28. Integration wiring and final assembly
  - [~] 28.1 Wire all services, API routes, and UI components together
    - Ensure all API routes connect to correct services
    - Ensure all UI components fetch from correct API endpoints
    - Ensure Realtime subscriptions are connected
    - Ensure Cron jobs trigger correct service methods
    - Verify end-to-end data flow from input to partner dashboard
    - _Requirements: All_

  - [ ]* 28.2 Write integration tests for critical user flows
    - Auth flow: register → invite → accept → linked accounts
    - Cycle flow: input date → phase calculation → predictions → partner view
    - Sharing flow: toggle category → partner dashboard updates within 5 seconds
    - Notification flow: trigger → compose → send → retry on failure
    - Admin flow: search → suspend → cascade to partner
    - _Requirements: 1.1-1.7, 2.1-2.6, 3.1-3.5, 7.1-7.5, 8.1-8.6_

- [~] 29. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical boundaries
- Property tests validate the 34 universal correctness properties defined in the design document
- Unit tests validate specific examples and edge cases
- The tech stack is: Next.js 14 (App Router), TypeScript, Supabase (PostgreSQL + Auth + Realtime), Resend, Tailwind CSS + shadcn/ui, Zod, vitest, fast-check
- All property-based tests use `fast-check` with minimum 100 iterations per property
- Test tag format: `// Feature: know-your-woman-cycle, Property {N}: {title}`
- Tasks 1-15 are complete (service layer, validation, property tests)
- Remaining work focuses on: AdminService (16), API routes (18), Frontend (20-24), Scheduled jobs (26), Middleware (27), and Integration (28)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["16.1"] },
    { "id": 1, "tasks": ["16.2", "16.3", "16.5"] },
    { "id": 2, "tasks": ["16.4", "16.6", "16.7", "16.8"] },
    { "id": 3, "tasks": ["18.1", "18.2", "18.3", "18.4", "18.5"] },
    { "id": 4, "tasks": ["18.6", "27.1", "27.2"] },
    { "id": 5, "tasks": ["20.1", "20.2"] },
    { "id": 6, "tasks": ["21.1", "21.2", "21.3", "21.4", "21.5"] },
    { "id": 7, "tasks": ["22.1", "22.2", "22.3"] },
    { "id": 8, "tasks": ["23.1", "23.2"] },
    { "id": 9, "tasks": ["24.1", "24.2"] },
    { "id": 10, "tasks": ["26.1", "26.2"] },
    { "id": 11, "tasks": ["28.1"] },
    { "id": 12, "tasks": ["28.2"] }
  ]
}
```
