'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_CYCLE_LENGTH, DEFAULT_PHASE_DURATIONS, PERSONAL_NOTE_MAX_LENGTH } from '@/lib/constants';
import { CyclePhase } from '@/lib/types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PhaseDurations {
  menstrual_days: number;
  follicular_days: number;
  ovulation_days: number;
  early_luteal_days: number;
  late_luteal_days: number;
}

interface PhaseNote {
  phase: CyclePhase;
  content: string;
}

interface ValidationError {
  code: string;
  fields?: Record<string, { message: string; constraint: string }>;
  message?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PHASE_CONFIG = [
  { key: 'menstrual_days' as const, label: 'Menstrual', phase: CyclePhase.MENSTRUAL },
  { key: 'follicular_days' as const, label: 'Follicular', phase: CyclePhase.FOLLICULAR },
  { key: 'ovulation_days' as const, label: 'Ovulation', phase: CyclePhase.OVULATION },
  { key: 'early_luteal_days' as const, label: 'Early Luteal', phase: CyclePhase.EARLY_LUTEAL },
  { key: 'late_luteal_days' as const, label: 'Late Luteal', phase: CyclePhase.LATE_LUTEAL },
];

// ─── Page Component ─────────────────────────────────────────────────────────

export default function CustomizePage() {
  // Phase durations state
  const [durations, setDurations] = useState<PhaseDurations>({
    menstrual_days: DEFAULT_PHASE_DURATIONS[CyclePhase.MENSTRUAL],
    follicular_days: DEFAULT_PHASE_DURATIONS[CyclePhase.FOLLICULAR],
    ovulation_days: DEFAULT_PHASE_DURATIONS[CyclePhase.OVULATION],
    early_luteal_days: DEFAULT_PHASE_DURATIONS[CyclePhase.EARLY_LUTEAL],
    late_luteal_days: DEFAULT_PHASE_DURATIONS[CyclePhase.LATE_LUTEAL],
  });

  // Personal notes state
  const [notes, setNotes] = useState<Record<CyclePhase, string>>({
    [CyclePhase.MENSTRUAL]: '',
    [CyclePhase.FOLLICULAR]: '',
    [CyclePhase.OVULATION]: '',
    [CyclePhase.EARLY_LUTEAL]: '',
    [CyclePhase.LATE_LUTEAL]: '',
  });

  // UI state
  const [cycleLength, setCycleLength] = useState<number>(DEFAULT_CYCLE_LENGTH);
  const [isLoadingDurations, setIsLoadingDurations] = useState(true);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [isSavingDurations, setIsSavingDurations] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState<CyclePhase | null>(null);
  const [durationError, setDurationError] = useState<string | null>(null);
  const [durationSuccess, setDurationSuccess] = useState<string | null>(null);
  const [noteSuccess, setNoteSuccess] = useState<Record<CyclePhase, string | null>>({
    [CyclePhase.MENSTRUAL]: null,
    [CyclePhase.FOLLICULAR]: null,
    [CyclePhase.OVULATION]: null,
    [CyclePhase.EARLY_LUTEAL]: null,
    [CyclePhase.LATE_LUTEAL]: null,
  });
  const [noteError, setNoteError] = useState<Record<CyclePhase, string | null>>({
    [CyclePhase.MENSTRUAL]: null,
    [CyclePhase.FOLLICULAR]: null,
    [CyclePhase.OVULATION]: null,
    [CyclePhase.EARLY_LUTEAL]: null,
    [CyclePhase.LATE_LUTEAL]: null,
  });

  // ─── Data Loading ───────────────────────────────────────────────────────────

  const fetchCycleLength = useCallback(async () => {
    try {
      const response = await fetch('/api/cycle/phase');
      if (response.ok) {
        const data = await response.json();
        if (data.total_cycle_length) {
          setCycleLength(data.total_cycle_length);
        }
      }
    } catch {
      // Use default cycle length if fetch fails
    }
  }, []);

  const fetchCustomization = useCallback(async () => {
    try {
      const response = await fetch('/api/cycle/customize');
      if (response.ok) {
        const data = await response.json();
        if (data.customization) {
          setDurations({
            menstrual_days: data.customization.menstrual_days,
            follicular_days: data.customization.follicular_days,
            ovulation_days: data.customization.ovulation_days,
            early_luteal_days: data.customization.early_luteal_days,
            late_luteal_days: data.customization.late_luteal_days,
          });
        }
      }
    } catch {
      // Use defaults if fetch fails
    } finally {
      setIsLoadingDurations(false);
    }
  }, []);

  const fetchNotes = useCallback(async () => {
    try {
      const response = await fetch('/api/cycle/notes');
      if (response.ok) {
        const data = await response.json();
        if (data.notes && Array.isArray(data.notes)) {
          const notesMap: Record<CyclePhase, string> = {
            [CyclePhase.MENSTRUAL]: '',
            [CyclePhase.FOLLICULAR]: '',
            [CyclePhase.OVULATION]: '',
            [CyclePhase.EARLY_LUTEAL]: '',
            [CyclePhase.LATE_LUTEAL]: '',
          };
          for (const note of data.notes as PhaseNote[]) {
            if (note.phase in notesMap) {
              notesMap[note.phase] = note.content;
            }
          }
          setNotes(notesMap);
        }
      }
    } catch {
      // Use empty notes if fetch fails
    } finally {
      setIsLoadingNotes(false);
    }
  }, []);

  useEffect(() => {
    fetchCycleLength();
    fetchCustomization();
    fetchNotes();
  }, [fetchCycleLength, fetchCustomization, fetchNotes]);

  // ─── Computed Values ────────────────────────────────────────────────────────

  const totalDuration = Object.values(durations).reduce((sum, val) => sum + val, 0);
  const isValidSum = totalDuration === cycleLength;

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleDurationChange = (key: keyof PhaseDurations, value: string) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) return;

    setDurations((prev) => ({
      ...prev,
      [key]: numValue,
    }));
    setDurationError(null);
    setDurationSuccess(null);
  };

  const handleSaveDurations = async () => {
    setIsSavingDurations(true);
    setDurationError(null);
    setDurationSuccess(null);

    try {
      const response = await fetch('/api/cycle/customize', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(durations),
      });

      if (!response.ok) {
        const errorData: ValidationError = await response.json();
        if (errorData.code === 'VALIDATION_ERROR' && errorData.fields) {
          const messages = Object.values(errorData.fields).map((f) => f.message);
          setDurationError(messages.join('. '));
        } else {
          setDurationError(errorData.message || 'Failed to save phase durations.');
        }
        return;
      }

      setDurationSuccess('Phase durations updated successfully.');
    } catch {
      setDurationError('Something went wrong. Please try again.');
    } finally {
      setIsSavingDurations(false);
    }
  };

  const handleNoteChange = (phase: CyclePhase, content: string) => {
    setNotes((prev) => ({
      ...prev,
      [phase]: content,
    }));
    setNoteError((prev) => ({ ...prev, [phase]: null }));
    setNoteSuccess((prev) => ({ ...prev, [phase]: null }));
  };

  const handleSaveNote = async (phase: CyclePhase) => {
    setIsSavingNote(phase);
    setNoteError((prev) => ({ ...prev, [phase]: null }));
    setNoteSuccess((prev) => ({ ...prev, [phase]: null }));

    try {
      const response = await fetch('/api/cycle/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase, content: notes[phase] }),
      });

      if (!response.ok) {
        const errorData: ValidationError = await response.json();
        if (errorData.code === 'VALIDATION_ERROR' && errorData.fields) {
          const messages = Object.values(errorData.fields).map((f) => f.message);
          setNoteError((prev) => ({ ...prev, [phase]: messages.join('. ') }));
        } else {
          setNoteError((prev) => ({
            ...prev,
            [phase]: errorData.message || 'Failed to save note.',
          }));
        }
        return;
      }

      setNoteSuccess((prev) => ({ ...prev, [phase]: 'Note saved successfully.' }));
    } catch {
      setNoteError((prev) => ({ ...prev, [phase]: 'Something went wrong. Please try again.' }));
    } finally {
      setIsSavingNote(null);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (isLoadingDurations || isLoadingNotes) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading customization settings...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <h1 className="text-2xl font-bold">Customize Your Cycle</h1>
      <p className="text-muted-foreground">
        Adjust phase durations to match your individual patterns and add personal notes for each
        phase.
      </p>

      {/* Phase Duration Customization */}
      <Card>
        <CardHeader>
          <CardTitle>Phase Durations</CardTitle>
          <CardDescription>
            Adjust the number of days for each phase. Each phase must be between 1 and 14 days, and
            the total must equal your cycle length of {cycleLength} days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PHASE_CONFIG.map(({ key, label }) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    type="number"
                    min={1}
                    max={14}
                    value={durations[key]}
                    onChange={(e) => handleDurationChange(key, e.target.value)}
                    aria-describedby={`${key}-description`}
                  />
                  <p id={`${key}-description`} className="text-xs text-muted-foreground">
                    1–14 days
                  </p>
                </div>
              ))}
            </div>

            {/* Total and validation */}
            <div className="flex items-center gap-4 rounded-md border p-3">
              <span className="text-sm font-medium">Total:</span>
              <span
                className={`text-sm font-bold ${isValidSum ? 'text-green-600' : 'text-destructive'}`}
                data-testid="duration-total"
              >
                {totalDuration} / {cycleLength} days
              </span>
              {!isValidSum && (
                <span className="text-sm text-destructive" role="alert">
                  Phase durations must sum to {cycleLength} days
                </span>
              )}
            </div>

            {/* Error/Success messages */}
            {durationError && (
              <p className="text-sm text-destructive" role="alert" data-testid="duration-error">
                {durationError}
              </p>
            )}
            {durationSuccess && (
              <p className="text-sm text-green-600" role="status" data-testid="duration-success">
                {durationSuccess}
              </p>
            )}

            <Button
              onClick={handleSaveDurations}
              disabled={!isValidSum || isSavingDurations}
              className="w-full sm:w-auto"
            >
              {isSavingDurations ? 'Saving...' : 'Save Phase Durations'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Personal Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Notes</CardTitle>
          <CardDescription>
            Add notes about your emotional or behavioral patterns for each phase. These notes can be
            shared with your partner when sharing is enabled (max {PERSONAL_NOTE_MAX_LENGTH}{' '}
            characters each).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {PHASE_CONFIG.map(({ phase, label }) => (
              <div key={phase} className="space-y-2">
                <Label htmlFor={`note-${phase}`}>{label} Phase Notes</Label>
                <Textarea
                  id={`note-${phase}`}
                  value={notes[phase]}
                  onChange={(e) => handleNoteChange(phase, e.target.value)}
                  placeholder={`Add personal notes about your ${label.toLowerCase()} phase patterns...`}
                  maxLength={PERSONAL_NOTE_MAX_LENGTH}
                  aria-describedby={`note-${phase}-count`}
                  rows={3}
                />
                <div className="flex items-center justify-between">
                  <p
                    id={`note-${phase}-count`}
                    className="text-xs text-muted-foreground"
                    aria-live="polite"
                  >
                    {notes[phase].length}/{PERSONAL_NOTE_MAX_LENGTH} characters
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSaveNote(phase)}
                    disabled={isSavingNote === phase || notes[phase].length === 0}
                  >
                    {isSavingNote === phase ? 'Saving...' : 'Save Note'}
                  </Button>
                </div>
                {noteError[phase] && (
                  <p
                    className="text-sm text-destructive"
                    role="alert"
                    data-testid={`note-error-${phase}`}
                  >
                    {noteError[phase]}
                  </p>
                )}
                {noteSuccess[phase] && (
                  <p
                    className="text-sm text-green-600"
                    role="status"
                    data-testid={`note-success-${phase}`}
                  >
                    {noteSuccess[phase]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
