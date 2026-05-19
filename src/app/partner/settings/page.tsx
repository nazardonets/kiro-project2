'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DeliveryTime, NotificationFrequency } from '@/lib/types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface NotificationSettings {
  frequency: NotificationFrequency;
  delivery_time: DeliveryTime;
  reminders_enabled: boolean;
  reminder_time: string;
  timezone: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const FREQUENCY_OPTIONS = [
  {
    value: NotificationFrequency.DAILY,
    label: 'Daily',
    description: 'Receive one notification every day at your configured delivery time.',
  },
  {
    value: NotificationFrequency.PHASE_BASED,
    label: 'Phase-based',
    description: 'Receive a notification only when the cycle transitions to a new phase.',
  },
  {
    value: NotificationFrequency.CUSTOM,
    label: 'Custom timing',
    description: 'Choose a specific delivery window (morning or evening digest).',
  },
];

const DELIVERY_TIME_OPTIONS = [
  {
    value: DeliveryTime.MORNING,
    label: 'Morning (6–9 AM)',
    description: 'Delivered between 6:00 AM and 9:00 AM in your local timezone.',
  },
  {
    value: DeliveryTime.EVENING,
    label: 'Evening (6–9 PM)',
    description: 'Delivered between 6:00 PM and 9:00 PM in your local timezone.',
  },
];

const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { value: 'America/Anchorage', label: 'Alaska' },
  { value: 'Pacific/Honolulu', label: 'Hawaii' },
  { value: 'America/Toronto', label: 'Eastern Time (Canada)' },
  { value: 'America/Vancouver', label: 'Pacific Time (Canada)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central European Time' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'Europe/Moscow', label: 'Moscow' },
  { value: 'Europe/Kyiv', label: 'Kyiv' },
  { value: 'Asia/Dubai', label: 'Dubai' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Shanghai', label: 'China Standard Time' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)' },
  { value: 'Asia/Seoul', label: 'Korea (KST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST)' },
  { value: 'Pacific/Auckland', label: 'New Zealand (NZST)' },
  { value: 'UTC', label: 'UTC' },
];

const REMINDER_TIME_OPTIONS = [
  { value: '06:00', label: '6:00 AM' },
  { value: '07:00', label: '7:00 AM' },
  { value: '08:00', label: '8:00 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '13:00', label: '1:00 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '16:00', label: '4:00 PM' },
  { value: '17:00', label: '5:00 PM' },
  { value: '18:00', label: '6:00 PM' },
  { value: '19:00', label: '7:00 PM' },
  { value: '20:00', label: '8:00 PM' },
  { value: '21:00', label: '9:00 PM' },
];

// ─── Page Component ─────────────────────────────────────────────────────────

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings>({
    frequency: NotificationFrequency.DAILY,
    delivery_time: DeliveryTime.MORNING,
    reminders_enabled: false,
    reminder_time: '09:00',
    timezone: 'UTC',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [savedSettings, setSavedSettings] = useState<NotificationSettings | null>(null);

  // ─── Data Loading ───────────────────────────────────────────────────────────

  const fetchSettings = useCallback(async () => {
    try {
      setError(null);

      const response = await fetch('/api/partner/notifications', { method: 'GET' });

      if (response.ok) {
        const data = await response.json();
        if (data.preferences) {
          const loaded: NotificationSettings = {
            frequency: data.preferences.frequency ?? NotificationFrequency.DAILY,
            delivery_time: data.preferences.delivery_time ?? DeliveryTime.MORNING,
            reminders_enabled: data.preferences.reminders_enabled ?? false,
            reminder_time: data.preferences.reminder_time ?? '09:00',
            timezone: data.preferences.timezone ?? 'UTC',
          };
          setSettings(loaded);
          setSavedSettings(loaded);
        }
      }
      // If 404 or other non-ok, use defaults
    } catch {
      // Use defaults on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // ─── Change Detection ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!savedSettings) {
      setHasChanges(false);
      return;
    }
    const changed =
      settings.frequency !== savedSettings.frequency ||
      settings.delivery_time !== savedSettings.delivery_time ||
      settings.reminders_enabled !== savedSettings.reminders_enabled ||
      settings.reminder_time !== savedSettings.reminder_time ||
      settings.timezone !== savedSettings.timezone;
    setHasChanges(changed);
  }, [settings, savedSettings]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const updateField = <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSuccessMessage(null);
    setError(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Update notification preferences (frequency, delivery_time, timezone)
      const notifResponse = await fetch('/api/partner/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frequency: settings.frequency,
          delivery_time: settings.delivery_time,
          timezone: settings.timezone,
        }),
      });

      if (!notifResponse.ok) {
        const errorData = await notifResponse.json();
        if (errorData.code === 'VALIDATION_ERROR' && errorData.fields) {
          const fieldMessages = Object.values(errorData.fields)
            .map((f) => (f as { message: string }).message)
            .join('. ');
          setError(fieldMessages || 'Invalid notification settings.');
        } else {
          setError(errorData.message || 'Failed to update notification preferences.');
        }
        return;
      }

      // Update reminder settings
      const reminderResponse = await fetch('/api/partner/reminders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reminders_enabled: settings.reminders_enabled,
          reminder_time: settings.reminder_time,
        }),
      });

      if (!reminderResponse.ok) {
        const errorData = await reminderResponse.json();
        if (errorData.code === 'VALIDATION_ERROR' && errorData.fields) {
          const fieldMessages = Object.values(errorData.fields)
            .map((f) => (f as { message: string }).message)
            .join('. ');
          setError(fieldMessages || 'Invalid reminder settings.');
        } else {
          setError(errorData.message || 'Failed to update reminder settings.');
        }
        return;
      }

      setSavedSettings({ ...settings });
      setHasChanges(false);
      setSuccessMessage('Notification settings saved successfully.');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading notification settings...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <h1 className="text-2xl font-bold">Notification Settings</h1>
      <p className="text-muted-foreground">
        Configure how and when you receive cycle insights and reminders.
      </p>

      {error && (
        <p className="text-sm text-destructive" role="alert" data-testid="settings-error">
          {error}
        </p>
      )}

      {successMessage && (
        <p className="text-sm text-green-600" role="status" data-testid="settings-success">
          {successMessage}
        </p>
      )}

      {/* Notification Frequency */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Frequency</CardTitle>
          <CardDescription>
            Choose how often you want to receive cycle insight notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <fieldset className="space-y-4">
            <legend className="sr-only">Notification frequency</legend>
            {FREQUENCY_OPTIONS.map(({ value, label, description }) => (
              <label
                key={value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                  settings.frequency === value
                    ? 'border-primary bg-primary/5'
                    : 'border-input hover:bg-accent/50'
                }`}
                htmlFor={`frequency-${value}`}
              >
                <input
                  type="radio"
                  id={`frequency-${value}`}
                  name="frequency"
                  value={value}
                  checked={settings.frequency === value}
                  onChange={() => updateField('frequency', value)}
                  className="mt-1 h-4 w-4 accent-primary"
                  aria-describedby={`frequency-${value}-desc`}
                />
                <div className="space-y-0.5">
                  <span className="text-base font-medium">{label}</span>
                  <p id={`frequency-${value}-desc`} className="text-sm text-muted-foreground">
                    {description}
                  </p>
                </div>
              </label>
            ))}
          </fieldset>
        </CardContent>
      </Card>

      {/* Delivery Time */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Time</CardTitle>
          <CardDescription>
            Choose when notifications are delivered in your local timezone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <fieldset className="space-y-4">
            <legend className="sr-only">Delivery time</legend>
            {DELIVERY_TIME_OPTIONS.map(({ value, label, description }) => (
              <label
                key={value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                  settings.delivery_time === value
                    ? 'border-primary bg-primary/5'
                    : 'border-input hover:bg-accent/50'
                }`}
                htmlFor={`delivery-time-${value}`}
              >
                <input
                  type="radio"
                  id={`delivery-time-${value}`}
                  name="delivery_time"
                  value={value}
                  checked={settings.delivery_time === value}
                  onChange={() => updateField('delivery_time', value)}
                  className="mt-1 h-4 w-4 accent-primary"
                  aria-describedby={`delivery-time-${value}-desc`}
                />
                <div className="space-y-0.5">
                  <span className="text-base font-medium">{label}</span>
                  <p id={`delivery-time-${value}-desc`} className="text-sm text-muted-foreground">
                    {description}
                  </p>
                </div>
              </label>
            ))}
          </fieldset>
        </CardContent>
      </Card>

      {/* Timezone */}
      <Card>
        <CardHeader>
          <CardTitle>Timezone</CardTitle>
          <CardDescription>
            Select your timezone so notifications arrive at the right time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="timezone-select">Your timezone</Label>
            <select
              id="timezone-select"
              value={settings.timezone}
              onChange={(e) => updateField('timezone', e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Select timezone"
            >
              {COMMON_TIMEZONES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Reminders */}
      <Card>
        <CardHeader>
          <CardTitle>Reminders</CardTitle>
          <CardDescription>
            Receive gentle reminders during high-energy phases (Follicular and Ovulation) to help
            you be more present and supportive.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="reminders-toggle" className="text-base font-medium">
                  Enable reminders
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get a daily reminder during high-energy phases with supportive suggestions.
                </p>
              </div>
              <Switch
                id="reminders-toggle"
                checked={settings.reminders_enabled}
                onCheckedChange={(checked) => updateField('reminders_enabled', checked)}
                aria-label="Toggle reminders"
              />
            </div>

            {settings.reminders_enabled && (
              <div className="space-y-2">
                <Label htmlFor="reminder-time-select">Reminder time</Label>
                <select
                  id="reminder-time-select"
                  value={settings.reminder_time}
                  onChange={(e) => updateField('reminder_time', e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="Select reminder time"
                >
                  {REMINDER_TIME_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-muted-foreground">
                  Reminders are delivered at this time in your selected timezone.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={!hasChanges || isSaving} data-testid="save-button">
          {isSaving ? 'Saving...' : 'Save settings'}
        </Button>
        {hasChanges && <p className="text-sm text-muted-foreground">You have unsaved changes.</p>}
      </div>
    </div>
  );
}
