'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { LOCATION_MAX_LENGTH, MOOD_MAX_LENGTH, PERSONAL_NOTE_MAX_LENGTH } from '@/lib/constants';

// ─── Types ──────────────────────────────────────────────────────────────────

type TimingMode = 'none' | 'specific' | 'window';

interface FormState {
  location: string;
  mood: string;
  timingMode: TimingMode;
  preferredDate: Date | undefined;
  windowStart: Date | undefined;
  windowEnd: Date | undefined;
  personalNotes: string;
}

interface FieldErrors {
  location?: string;
  mood?: string;
  preferred_date?: string;
  window_start?: string;
  window_end?: string;
  personal_notes?: string;
}

type SubmissionStatus = 'idle' | 'submitting' | 'success' | 'error' | 'no_partner' | 'failed_delivery';

// ─── Preset Options ─────────────────────────────────────────────────────────

const LOCATION_PRESETS = ['Restaurant', 'Outdoor activity', 'Home setting'];
const MOOD_PRESETS = ['Relaxed evening', 'Romantic', 'Fun', 'Low-energy'];

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function DateRequestPage() {
  const [form, setForm] = useState<FormState>({
    location: '',
    mood: '',
    timingMode: 'none',
    preferredDate: undefined,
    windowStart: undefined,
    windowEnd: undefined,
    personalNotes: '',
  });

  const [status, setStatus] = useState<SubmissionStatus>('idle');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preferredDateOpen, setPreferredDateOpen] = useState(false);
  const [windowStartOpen, setWindowStartOpen] = useState(false);
  const [windowEndOpen, setWindowEndOpen] = useState(false);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleLocationPreset = (preset: string) => {
    setForm((prev) => ({ ...prev, location: preset }));
    setFieldErrors((prev) => ({ ...prev, location: undefined }));
  };

  const handleMoodPreset = (preset: string) => {
    setForm((prev) => ({ ...prev, mood: preset }));
    setFieldErrors((prev) => ({ ...prev, mood: undefined }));
  };

  const handleTimingModeChange = (mode: TimingMode) => {
    setForm((prev) => ({
      ...prev,
      timingMode: mode,
      preferredDate: mode === 'specific' ? prev.preferredDate : undefined,
      windowStart: mode === 'window' ? prev.windowStart : undefined,
      windowEnd: mode === 'window' ? prev.windowEnd : undefined,
    }));
    setFieldErrors((prev) => ({
      ...prev,
      preferred_date: undefined,
      window_start: undefined,
      window_end: undefined,
    }));
  };

  const handleSubmit = useCallback(async () => {
    setStatus('submitting');
    setFieldErrors({});
    setErrorMessage(null);

    // Build request body
    const body: Record<string, string | null> = {
      location: form.location.trim() || null,
      mood: form.mood.trim() || null,
      preferred_date: form.timingMode === 'specific' && form.preferredDate
        ? formatDate(form.preferredDate)
        : null,
      window_start: form.timingMode === 'window' && form.windowStart
        ? formatDate(form.windowStart)
        : null,
      window_end: form.timingMode === 'window' && form.windowEnd
        ? formatDate(form.windowEnd)
        : null,
      personal_notes: form.personalNotes.trim() || null,
    };

    try {
      const response = await fetch('/api/date-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        return;
      }

      // Handle validation errors
      if (response.status === 400 && data.code === 'VALIDATION_ERROR') {
        const errors: FieldErrors = {};
        if (data.fields) {
          for (const [field, info] of Object.entries(data.fields)) {
            errors[field as keyof FieldErrors] = (info as { message: string }).message;
          }
        }
        setFieldErrors(errors);
        setStatus('error');
        setErrorMessage('Please fix the errors below and try again.');
        return;
      }

      // Handle no partner linked or sharing revoked
      if (response.status === 422) {
        if (data.code === 'NO_PARTNER_LINKED' || data.code === 'SHARING_REVOKED') {
          setStatus('no_partner');
          setErrorMessage(
            data.message || 'Your date request cannot be sent. No partner is linked or sharing has been revoked.',
          );
          return;
        }
      }

      // Handle email delivery failure
      if (response.status === 502 && data.code === 'EMAIL_DELIVERY_FAILED') {
        setStatus('failed_delivery');
        setErrorMessage(
          data.message || 'The date request could not be delivered. Please try again.',
        );
        return;
      }

      // Generic error
      setStatus('error');
      setErrorMessage(data.message || 'Something went wrong. Please try again.');
    } catch {
      setStatus('error');
      setErrorMessage('Network error. Please check your connection and try again.');
    }
  }, [form]);

  const handleRetry = () => {
    handleSubmit();
  };

  // ─── Render: Success State ────────────────────────────────────────────────

  if (status === 'success') {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <h2 className="text-xl font-semibold text-green-700">Date Request Sent!</h2>
              <p className="text-muted-foreground">
                Your date request has been sent to your partner via email.
              </p>
              <Link href="/dashboard">
                <Button variant="outline" className="mt-4">
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Render: Form ─────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold">Request a Date</h1>
        <p className="text-muted-foreground mt-1">
          Send a date request to your partner. All fields are optional — share as much or as little
          as you like.
        </p>
      </div>

      {/* No partner / sharing revoked message */}
      {status === 'no_partner' && errorMessage && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <p className="text-sm text-amber-800" role="alert" data-testid="no-partner-message">
              {errorMessage}
            </p>
            <p className="text-sm text-amber-700 mt-2">
              Your details have been retained. You can resubmit once a partner is linked and sharing
              is active.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Email delivery failure message */}
      {status === 'failed_delivery' && errorMessage && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-sm text-red-800" role="alert" data-testid="delivery-failed-message">
              {errorMessage}
            </p>
            <Button
              onClick={handleRetry}
              variant="outline"
              className="mt-3"
              data-testid="retry-button"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Generic error message */}
      {status === 'error' && errorMessage && !Object.keys(fieldErrors).length && (
        <p className="text-sm text-destructive" role="alert" data-testid="generic-error">
          {errorMessage}
        </p>
      )}

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
          <CardDescription>Where would you like to go? (optional)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {LOCATION_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={form.location === preset ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleLocationPreset(preset)}
                  data-testid={`location-preset-${preset.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {preset}
                </Button>
              ))}
            </div>
            <div>
              <Label htmlFor="location-input" className="sr-only">
                Custom location
              </Label>
              <Input
                id="location-input"
                placeholder="Or type a custom location..."
                value={form.location}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, location: e.target.value }));
                  setFieldErrors((prev) => ({ ...prev, location: undefined }));
                }}
                maxLength={LOCATION_MAX_LENGTH}
                aria-describedby="location-count"
              />
              <div className="flex justify-between mt-1">
                {fieldErrors.location && (
                  <p className="text-sm text-destructive" role="alert">
                    {fieldErrors.location}
                  </p>
                )}
                <p id="location-count" className="text-xs text-muted-foreground ml-auto">
                  {form.location.length}/{LOCATION_MAX_LENGTH}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mood / Vibe */}
      <Card>
        <CardHeader>
          <CardTitle>Mood / Vibe</CardTitle>
          <CardDescription>What kind of vibe are you looking for? (optional)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {MOOD_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={form.mood === preset ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleMoodPreset(preset)}
                  data-testid={`mood-preset-${preset.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {preset}
                </Button>
              ))}
            </div>
            <div>
              <Label htmlFor="mood-input" className="sr-only">
                Custom mood
              </Label>
              <Input
                id="mood-input"
                placeholder="Or describe your ideal vibe..."
                value={form.mood}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, mood: e.target.value }));
                  setFieldErrors((prev) => ({ ...prev, mood: undefined }));
                }}
                maxLength={MOOD_MAX_LENGTH}
                aria-describedby="mood-count"
              />
              <div className="flex justify-between mt-1">
                {fieldErrors.mood && (
                  <p className="text-sm text-destructive" role="alert">
                    {fieldErrors.mood}
                  </p>
                )}
                <p id="mood-count" className="text-xs text-muted-foreground ml-auto">
                  {form.mood.length}/{MOOD_MAX_LENGTH}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timing */}
      <Card>
        <CardHeader>
          <CardTitle>Timing</CardTitle>
          <CardDescription>When works for you? (optional)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={form.timingMode === 'none' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTimingModeChange('none')}
                data-testid="timing-none"
              >
                No preference
              </Button>
              <Button
                type="button"
                variant={form.timingMode === 'specific' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTimingModeChange('specific')}
                data-testid="timing-specific"
              >
                Specific date
              </Button>
              <Button
                type="button"
                variant={form.timingMode === 'window' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTimingModeChange('window')}
                data-testid="timing-window"
              >
                Flexible window
              </Button>
            </div>

            {form.timingMode === 'specific' && (
              <div className="space-y-2">
                <Label htmlFor="preferred-date">Preferred date</Label>
                <Popover open={preferredDateOpen} onOpenChange={setPreferredDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="preferred-date"
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="preferred-date-trigger"
                    >
                      {form.preferredDate
                        ? formatDisplayDate(form.preferredDate)
                        : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.preferredDate}
                      onSelect={(date) => {
                        setForm((prev) => ({ ...prev, preferredDate: date }));
                        setPreferredDateOpen(false);
                        setFieldErrors((prev) => ({ ...prev, preferred_date: undefined }));
                      }}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      data-testid="preferred-date-calendar"
                    />
                  </PopoverContent>
                </Popover>
                {fieldErrors.preferred_date && (
                  <p className="text-sm text-destructive" role="alert">
                    {fieldErrors.preferred_date}
                  </p>
                )}
              </div>
            )}

            {form.timingMode === 'window' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="window-start">From</Label>
                  <Popover open={windowStartOpen} onOpenChange={setWindowStartOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="window-start"
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="window-start-trigger"
                      >
                        {form.windowStart
                          ? formatDisplayDate(form.windowStart)
                          : 'Start date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={form.windowStart}
                        onSelect={(date) => {
                          setForm((prev) => ({ ...prev, windowStart: date }));
                          setWindowStartOpen(false);
                          setFieldErrors((prev) => ({ ...prev, window_start: undefined }));
                        }}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        data-testid="window-start-calendar"
                      />
                    </PopoverContent>
                  </Popover>
                  {fieldErrors.window_start && (
                    <p className="text-sm text-destructive" role="alert">
                      {fieldErrors.window_start}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="window-end">To</Label>
                  <Popover open={windowEndOpen} onOpenChange={setWindowEndOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="window-end"
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="window-end-trigger"
                      >
                        {form.windowEnd
                          ? formatDisplayDate(form.windowEnd)
                          : 'End date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={form.windowEnd}
                        onSelect={(date) => {
                          setForm((prev) => ({ ...prev, windowEnd: date }));
                          setWindowEndOpen(false);
                          setFieldErrors((prev) => ({ ...prev, window_end: undefined }));
                        }}
                        disabled={(date) => {
                          const today = new Date(new Date().setHours(0, 0, 0, 0));
                          if (date < today) return true;
                          if (form.windowStart && date < form.windowStart) return true;
                          return false;
                        }}
                        data-testid="window-end-calendar"
                      />
                    </PopoverContent>
                  </Popover>
                  {fieldErrors.window_end && (
                    <p className="text-sm text-destructive" role="alert">
                      {fieldErrors.window_end}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Personal Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Notes</CardTitle>
          <CardDescription>
            Any thoughts or intentions you want to share? (optional)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <Label htmlFor="personal-notes" className="sr-only">
              Personal notes
            </Label>
            <Textarea
              id="personal-notes"
              placeholder="Share what's on your mind..."
              value={form.personalNotes}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, personalNotes: e.target.value }));
                setFieldErrors((prev) => ({ ...prev, personal_notes: undefined }));
              }}
              maxLength={PERSONAL_NOTE_MAX_LENGTH}
              rows={4}
              aria-describedby="notes-count"
            />
            <div className="flex justify-between mt-1">
              {fieldErrors.personal_notes && (
                <p className="text-sm text-destructive" role="alert">
                  {fieldErrors.personal_notes}
                </p>
              )}
              <p id="notes-count" className="text-xs text-muted-foreground ml-auto">
                {form.personalNotes.length}/{PERSONAL_NOTE_MAX_LENGTH}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex gap-3">
        <Button
          onClick={handleSubmit}
          disabled={status === 'submitting'}
          className="flex-1 sm:flex-none"
          data-testid="submit-date-request"
        >
          {status === 'submitting' ? 'Sending...' : 'Send Date Request'}
        </Button>
        <Link href="/dashboard">
          <Button variant="ghost">Cancel</Button>
        </Link>
      </div>
    </div>
  );
}
