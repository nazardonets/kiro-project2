import { CyclePhase } from './types';

/** Default phase durations in days (standard 28-day cycle) */
export const DEFAULT_PHASE_DURATIONS: Record<CyclePhase, number> = {
  [CyclePhase.MENSTRUAL]: 5,
  [CyclePhase.FOLLICULAR]: 8,
  [CyclePhase.OVULATION]: 1,
  [CyclePhase.EARLY_LUTEAL]: 7,
  [CyclePhase.LATE_LUTEAL]: 7,
};

/** Default total cycle length in days */
export const DEFAULT_CYCLE_LENGTH = 28;

/** Maximum number of historical cycle records per user */
export const MAX_HISTORICAL_RECORDS = 12;

/** Invite expiration time in hours */
export const INVITE_EXPIRY_HOURS = 72;

/** Password constraints */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** Text field length limits */
export const PERSONAL_NOTE_MAX_LENGTH = 500;
export const LOCATION_MAX_LENGTH = 200;
export const MOOD_MAX_LENGTH = 200;
export const ANNOTATION_MIN_LENGTH = 1;
export const ANNOTATION_MAX_LENGTH = 2000;
export const SUSPENSION_REASON_MAX_LENGTH = 500;
export const BEHAVIORAL_PROMPT_MAX_LENGTH = 280;
export const FREE_TEXT_MAX_LENGTH = 200;

/** Notification retry configuration */
export const MAX_NOTIFICATION_RETRIES = 3;
export const RETRY_INTERVAL_MINUTES = 5;

/** Admin search result limit */
export const ADMIN_SEARCH_RESULT_LIMIT = 50;

/** Prediction coverage in days */
export const PREDICTION_DAYS = 60;

/** Cycle start date range: max days in the past */
export const CYCLE_DATE_MAX_AGE_DAYS = 365;
