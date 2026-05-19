import { NextRequest } from 'next/server';

/**
 * Verify that the request comes from Vercel Cron by checking the Authorization header.
 * Vercel sends the CRON_SECRET as a Bearer token in the Authorization header.
 *
 * @param request - The incoming request
 * @returns Whether the request is authorized
 */
export function verifyCronAuthorization(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[Cron] CRON_SECRET environment variable is not set');
    return false;
  }

  if (!authHeader) {
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * Get the current UTC hour offset for a given timezone.
 * Returns the current hour (0-23) in the specified timezone.
 *
 * @param timezone - IANA timezone string (e.g., 'America/New_York')
 * @param referenceDate - Optional reference date (defaults to now)
 * @returns The current hour in the specified timezone
 */
export function getCurrentHourInTimezone(timezone: string, referenceDate?: Date): number {
  const date = referenceDate ?? new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const hourPart = parts.find((p) => p.type === 'hour');
    return hourPart ? parseInt(hourPart.value, 10) : -1;
  } catch {
    // Invalid timezone
    return -1;
  }
}

/**
 * Get all supported IANA timezone identifiers.
 * Uses Intl.supportedValuesOf when available, falls back to a representative set.
 */
function getAllTimezones(): string[] {
  if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
    return (Intl as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf('timeZone');
  }

  // Fallback: representative timezones covering all UTC offsets
  return [
    'Pacific/Midway',
    'Pacific/Honolulu',
    'America/Anchorage',
    'America/Los_Angeles',
    'America/Denver',
    'America/Chicago',
    'America/New_York',
    'America/Sao_Paulo',
    'Atlantic/South_Georgia',
    'Atlantic/Azores',
    'Africa/Abidjan',
    'Europe/London',
    'Europe/Paris',
    'Europe/Helsinki',
    'Africa/Nairobi',
    'Asia/Dubai',
    'Asia/Karachi',
    'Asia/Kolkata',
    'Asia/Dhaka',
    'Asia/Bangkok',
    'Asia/Shanghai',
    'Asia/Tokyo',
    'Australia/Sydney',
    'Pacific/Auckland',
  ];
}

/**
 * Get all IANA timezones where the current hour is midnight (0).
 * Used to bucket users by timezone for midnight-based cron jobs.
 *
 * @param referenceDate - Optional reference date (defaults to now)
 * @returns Array of timezone strings where it's currently midnight
 */
export function getTimezonesMidnight(referenceDate?: Date): string[] {
  const allTimezones = getAllTimezones();

  return allTimezones.filter((tz: string) => {
    const hour = getCurrentHourInTimezone(tz, referenceDate);
    return hour === 0;
  });
}

/**
 * Get all IANA timezones where the current hour matches the specified hour.
 * Used for notification dispatch at configured delivery times.
 *
 * @param targetHour - The target hour (0-23)
 * @param referenceDate - Optional reference date (defaults to now)
 * @returns Array of timezone strings where the current hour matches
 */
export function getTimezonesAtHour(targetHour: number, referenceDate?: Date): string[] {
  const allTimezones = getAllTimezones();

  return allTimezones.filter((tz: string) => {
    const hour = getCurrentHourInTimezone(tz, referenceDate);
    return hour === targetHour;
  });
}
