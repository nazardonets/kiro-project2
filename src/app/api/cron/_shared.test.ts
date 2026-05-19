import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import {
  verifyCronAuthorization,
  getCurrentHourInTimezone,
  getTimezonesMidnight,
  getTimezonesAtHour,
} from './_shared';

describe('verifyCronAuthorization', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, CRON_SECRET: 'test-secret-123' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns true when Authorization header matches CRON_SECRET', () => {
    const request = new NextRequest('http://localhost/api/cron/test', {
      headers: { authorization: 'Bearer test-secret-123' },
    });

    expect(verifyCronAuthorization(request)).toBe(true);
  });

  it('returns false when Authorization header is missing', () => {
    const request = new NextRequest('http://localhost/api/cron/test');

    expect(verifyCronAuthorization(request)).toBe(false);
  });

  it('returns false when Authorization header does not match', () => {
    const request = new NextRequest('http://localhost/api/cron/test', {
      headers: { authorization: 'Bearer wrong-secret' },
    });

    expect(verifyCronAuthorization(request)).toBe(false);
  });

  it('returns false when CRON_SECRET is not set', () => {
    delete process.env.CRON_SECRET;

    const request = new NextRequest('http://localhost/api/cron/test', {
      headers: { authorization: 'Bearer test-secret-123' },
    });

    expect(verifyCronAuthorization(request)).toBe(false);
  });
});

describe('getCurrentHourInTimezone', () => {
  it('returns the correct hour for UTC', () => {
    // Create a date at a known UTC time
    const date = new Date('2024-01-15T14:30:00Z');
    const hour = getCurrentHourInTimezone('UTC', date);
    expect(hour).toBe(14);
  });

  it('returns the correct hour for a timezone ahead of UTC', () => {
    // Tokyo is UTC+9
    const date = new Date('2024-01-15T14:30:00Z'); // 23:30 in Tokyo
    const hour = getCurrentHourInTimezone('Asia/Tokyo', date);
    expect(hour).toBe(23);
  });

  it('returns the correct hour for a timezone behind UTC', () => {
    // New York is UTC-5 in January (EST)
    const date = new Date('2024-01-15T05:30:00Z'); // 00:30 in New York
    const hour = getCurrentHourInTimezone('America/New_York', date);
    expect(hour).toBe(0);
  });

  it('returns -1 for an invalid timezone', () => {
    const date = new Date('2024-01-15T14:30:00Z');
    const hour = getCurrentHourInTimezone('Invalid/Timezone', date);
    expect(hour).toBe(-1);
  });
});

describe('getTimezonesMidnight', () => {
  it('returns timezones where it is currently midnight', () => {
    // At 05:00 UTC, it's midnight in UTC-5 timezones (e.g., America/New_York in EST)
    const date = new Date('2024-01-15T05:00:00Z');
    const midnightTimezones = getTimezonesMidnight(date);

    // Should include at least one timezone
    expect(midnightTimezones.length).toBeGreaterThan(0);

    // Verify all returned timezones are actually at midnight
    for (const tz of midnightTimezones) {
      const hour = getCurrentHourInTimezone(tz, date);
      expect(hour).toBe(0);
    }
  });

  it('returns timezones at midnight for a given UTC time', () => {
    // At 00:30 UTC, timezones at UTC+0 offset are at hour 0
    const date = new Date('2024-01-15T00:30:00Z');
    const midnightTimezones = getTimezonesMidnight(date);

    // Should include timezones at UTC+0 (e.g., Africa/Abidjan, Atlantic/Reykjavik)
    expect(midnightTimezones.length).toBeGreaterThan(0);

    // Verify all returned timezones are actually at midnight
    for (const tz of midnightTimezones) {
      const hour = getCurrentHourInTimezone(tz, date);
      expect(hour).toBe(0);
    }
  });
});

describe('getTimezonesAtHour', () => {
  it('returns timezones where the current hour matches the target', () => {
    const date = new Date('2024-01-15T14:00:00Z');
    const timezones = getTimezonesAtHour(14, date);

    // Should include timezones at UTC+0 offset
    expect(timezones.length).toBeGreaterThan(0);

    // Verify all returned timezones are at the target hour
    for (const tz of timezones) {
      const hour = getCurrentHourInTimezone(tz, date);
      expect(hour).toBe(14);
    }
  });

  it('returns timezones at morning delivery window (hour 7)', () => {
    const date = new Date('2024-01-15T07:00:00Z');
    const timezones = getTimezonesAtHour(7, date);

    // At 07:00 UTC, timezones at UTC+0 should be at hour 7
    expect(timezones.length).toBeGreaterThan(0);

    // Verify all returned timezones are at hour 7
    for (const tz of timezones) {
      const hour = getCurrentHourInTimezone(tz, date);
      expect(hour).toBe(7);
    }
  });
});
