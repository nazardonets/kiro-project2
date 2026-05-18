// ─── Enums ───────────────────────────────────────────────────────────────────

export enum UserRole {
  PRIMARY = 'primary',
  PARTNER = 'partner',
  ADMIN = 'admin',
}

export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

export enum CyclePhase {
  MENSTRUAL = 'menstrual',
  FOLLICULAR = 'follicular',
  OVULATION = 'ovulation',
  EARLY_LUTEAL = 'early_luteal',
  LATE_LUTEAL = 'late_luteal',
}

export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
}

export enum PartnerLinkStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
  UNLINKED = 'unlinked',
}

export enum NotificationType {
  DAILY_SUMMARY = 'daily_summary',
  PHASE_ALERT = 'phase_alert',
  REMINDER = 'reminder',
  DATE_REQUEST = 'date_request',
}

export enum NotificationStatus {
  SENT = 'sent',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

export enum NotificationFrequency {
  DAILY = 'daily',
  PHASE_BASED = 'phase_based',
  CUSTOM = 'custom',
}

export enum DeliveryTime {
  MORNING = 'morning',
  EVENING = 'evening',
}

export enum DateRequestStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
}

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  status: UserStatus;
  suspension_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartnerLink {
  id: string;
  primary_user_id: string;
  partner_user_id: string;
  status: PartnerLinkStatus;
  linked_at: string;
  revoked_at: string | null;
}

export interface SecureInvite {
  id: string;
  primary_user_id: string;
  token: string;
  expires_at: string;
  status: InviteStatus;
  created_at: string;
}

export interface CycleRecord {
  id: string;
  primary_user_id: string;
  start_date: string;
  cycle_length_days: number;
  created_at: string;
}

export interface PhaseCustomization {
  id: string;
  primary_user_id: string;
  menstrual_days: number;
  follicular_days: number;
  ovulation_days: number;
  early_luteal_days: number;
  late_luteal_days: number;
  updated_at: string;
}

export interface PersonalNote {
  id: string;
  primary_user_id: string;
  phase: CyclePhase;
  content: string;
  updated_at: string;
}

export interface SharingPreferences {
  id: string;
  primary_user_id: string;
  emotional_tendencies: boolean;
  behavioral_patterns: boolean;
  energy_levels: boolean;
  communication_guidance: boolean;
  daily_summaries: boolean;
  phase_alerts: boolean;
  partner_reminders: boolean;
  email_notifications_enabled: boolean;
  updated_at: string;
}

export interface SurveyResponse {
  id: string;
  primary_user_id: string;
  question_number: number;
  selected_options: string[];
  free_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailySummary {
  id: string;
  primary_user_id: string;
  summary_date: string;
  todays_state: string;
  best_approach: string[];
  avoid_this: string[];
  phase_at_generation: CyclePhase;
  generated_at: string;
}

export interface DateRequest {
  id: string;
  primary_user_id: string;
  location: string | null;
  mood: string | null;
  preferred_date: string | null;
  window_start: string | null;
  window_end: string | null;
  personal_notes: string | null;
  status: DateRequestStatus;
  created_at: string;
}

export interface NotificationPreferences {
  id: string;
  partner_user_id: string;
  frequency: NotificationFrequency;
  delivery_time: DeliveryTime;
  reminders_enabled: boolean;
  reminder_time: string;
  timezone: string;
  updated_at: string;
}

export interface NotificationLog {
  id: string;
  partner_user_id: string;
  type: NotificationType;
  status: NotificationStatus;
  retry_count: number;
  sent_at: string;
  next_retry_at: string | null;
}

export interface AdminAnnotation {
  id: string;
  admin_user_id: string;
  cycle_record_id: string;
  phase: CyclePhase | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface AdminOverride {
  id: string;
  admin_user_id: string;
  cycle_record_id: string;
  phase: CyclePhase;
  replacement_content: string;
  original_content: string;
  created_at: string;
  updated_at: string;
}
