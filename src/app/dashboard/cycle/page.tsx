'use client';

import { useCallback, useEffect, useState } from 'react';
import { format, subDays } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CycleRecord } from '@/lib/types';

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_HISTORICAL_RECORDS = 12;
const MAX_PAST_DAYS = 365;

// ─── Types ──────────────────────────────────────────────────────────────────

interface ConflictInfo {
  conflicting_record_id: string;
  conflicting_start_date: string;
  details: string;
}

// ─── Cycle Input Page ───────────────────────────────────────────────────────

export default function CycleInputPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [records, setRecords] = useState<CycleRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Date range constraints
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = subDays(today, MAX_PAST_DAYS);

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    try {
      const response = await fetch('/api/cycle/history');
      if (response.ok) {
        const data = await response.json();
        setRecords(data.records ?? []);
      }
    } catch {
      // Silently handle fetch errors for history
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
    setConflict(null);
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    clearMessages();
    setIsPopoverOpen(false);
  };

  const handleSubmit = async (force = false) => {
    if (!selectedDate) {
      setErrorMessage('Please select a date.');
      return;
    }

    // Client-side future date validation (Requirement 7.4)
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (selectedDate > now) {
      setErrorMessage('The date must be today or earlier. Future dates are not allowed.');
      return;
    }

    // Check max records limit (Requirement 7.3)
    if (!force && records.length >= MAX_HISTORICAL_RECORDS) {
      setErrorMessage(
        `You have reached the maximum of ${MAX_HISTORICAL_RECORDS} cycle records. Please delete an existing record before adding a new one.`,
      );
      return;
    }

    setIsSubmitting(true);
    clearMessages();

    try {
      const response = await fetch('/api/cycle/start-date', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: format(selectedDate, 'yyyy-MM-dd'),
          force,
        }),
      });

      const data = await response.json();

      if (response.status === 409) {
        // Conflict detected (Requirement 7.5)
        setConflict(data.conflict);
        setErrorMessage(data.message || 'This date overlaps with an existing cycle record.');
        return;
      }

      if (!response.ok) {
        const message =
          data.message || data.fields?.start_date?.message || 'Failed to save cycle record.';
        setErrorMessage(message);
        return;
      }

      // Success (Requirement 7.2)
      setSuccessMessage('Cycle record saved successfully.');
      setSelectedDate(undefined);
      setConflict(null);
      // Refresh history
      await fetchHistory();
    } catch {
      setErrorMessage('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForceSubmit = async () => {
    await handleSubmit(true);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <h1 className="text-2xl font-bold">Cycle Data</h1>

      {/* Date Input Section */}
      <Card>
        <CardHeader>
          <CardTitle>Record Cycle Start Date</CardTitle>
          <CardDescription>
            Select the start date of your menstrual cycle. You can record up to{' '}
            {MAX_HISTORICAL_RECORDS} historical dates within the past year.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date Picker */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="cycle-date-picker">
              Cycle Start Date
            </label>
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="cycle-date-picker"
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal sm:w-[280px]',
                    !selectedDate && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  disabled={(date) => date > today || date < minDate}
                  initialFocus
                  fromDate={minDate}
                  toDate={today}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Submit Button */}
          <Button onClick={() => handleSubmit(false)} disabled={!selectedDate || isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Cycle Start Date'}
          </Button>

          {/* Success Message (Requirement 7.2) */}
          {successMessage && (
            <div
              className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800"
              role="status"
              aria-live="polite"
            >
              {successMessage}
            </div>
          )}

          {/* Error Message */}
          {errorMessage && !conflict && (
            <div
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          {/* Conflict Warning (Requirement 7.5) */}
          {conflict && (
            <div
              className="rounded-md border border-yellow-200 bg-yellow-50 p-4 text-sm"
              role="alert"
            >
              <p className="font-medium text-yellow-800">Overlap Warning</p>
              <p className="mt-1 text-yellow-700">{conflict.details}</p>
              {conflict.conflicting_start_date && (
                <p className="mt-1 text-yellow-700">
                  Conflicting record start date:{' '}
                  {format(new Date(conflict.conflicting_start_date + 'T00:00:00'), 'PPP')}
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={handleForceSubmit}>
                  Save Anyway
                </Button>
                <Button size="sm" variant="ghost" onClick={clearMessages}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Section */}
      <Card>
        <CardHeader>
          <CardTitle>Cycle History</CardTitle>
          <CardDescription>
            Your recorded cycle start dates ({records.length}/{MAX_HISTORICAL_RECORDS}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (
            <p className="text-sm text-muted-foreground">Loading history...</p>
          ) : records.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No cycle records yet. Use the date picker above to record your first cycle start date.
            </p>
          ) : (
            <div className="space-y-2">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {format(new Date(record.start_date + 'T00:00:00'), 'PPP')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Cycle length: {record.cycle_length_days} days
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Added {format(new Date(record.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Icons ──────────────────────────────────────────────────────────────────

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}
