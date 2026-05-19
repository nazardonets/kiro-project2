'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ANNOTATION_MAX_LENGTH, ANNOTATION_MIN_LENGTH } from '@/lib/constants';
import { CyclePhase } from '@/lib/types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AdminAnnotation {
  id: string;
  admin_user_id: string;
  cycle_record_id: string;
  phase: CyclePhase | null;
  content: string;
  created_at: string;
  updated_at: string;
}

interface AdminOverride {
  id: string;
  admin_user_id: string;
  cycle_record_id: string;
  phase: CyclePhase;
  replacement_content: string;
  original_content: string;
  created_at: string;
  updated_at: string;
}

interface CycleInstance {
  id: string;
  primary_user_id: string;
  start_date: string;
  cycle_length_days: number;
  created_at: string;
  annotations: AdminAnnotation[];
  overrides: AdminOverride[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<CyclePhase, string> = {
  [CyclePhase.MENSTRUAL]: 'Menstrual',
  [CyclePhase.FOLLICULAR]: 'Follicular',
  [CyclePhase.OVULATION]: 'Ovulation',
  [CyclePhase.EARLY_LUTEAL]: 'Early Luteal',
  [CyclePhase.LATE_LUTEAL]: 'Late Luteal',
};

const PHASE_OPTIONS = Object.values(CyclePhase);

const DEFAULT_PHASE_DURATIONS: Record<CyclePhase, number> = {
  [CyclePhase.MENSTRUAL]: 5,
  [CyclePhase.FOLLICULAR]: 8,
  [CyclePhase.OVULATION]: 1,
  [CyclePhase.EARLY_LUTEAL]: 7,
  [CyclePhase.LATE_LUTEAL]: 7,
};

// ─── Helper Functions ───────────────────────────────────────────────────────

function calculatePhases(startDate: string, cycleLengthDays: number) {
  const totalLength = cycleLengthDays || 28;
  const scale = totalLength / 28;

  return PHASE_OPTIONS.map((phase) => {
    const defaultDuration = DEFAULT_PHASE_DURATIONS[phase];
    const scaledDuration = Math.max(1, Math.round(defaultDuration * scale));
    return { phase, duration: scaledDuration };
  });
}

function calculateCurrentPhase(startDate: string, cycleLengthDays: number) {
  const start = new Date(startDate);
  const today = new Date();
  const elapsed = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const totalLength = cycleLengthDays || 28;

  if (elapsed > totalLength) {
    return { phase: CyclePhase.LATE_LUTEAL, dayInPhase: elapsed - totalLength, isOverdue: true };
  }

  const phases = calculatePhases(startDate, cycleLengthDays);
  let dayCounter = 0;
  for (const { phase, duration } of phases) {
    if (elapsed <= dayCounter + duration) {
      return { phase, dayInPhase: elapsed - dayCounter, isOverdue: false };
    }
    dayCounter += duration;
  }

  return { phase: CyclePhase.LATE_LUTEAL, dayInPhase: 1, isOverdue: false };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function AdminCycleManagementPage() {
  const params = useParams();
  const userId = params.id as string;

  const [cycles, setCycles] = useState<CycleInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Annotation form state
  const [annotationForm, setAnnotationForm] = useState<{
    cycleId: string;
    phase: CyclePhase | null;
    content: string;
    editingId: string | null;
  } | null>(null);

  // Override form state
  const [overrideForm, setOverrideForm] = useState<{
    cycleId: string;
    phase: CyclePhase;
    content: string;
    editingId: string | null;
  } | null>(null);

  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // ─── Data Loading ───────────────────────────────────────────────────────────

  const fetchCycles = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`/api/admin/cycles/user/${userId}`);

      if (!response.ok) {
        const data = await response.json();
        setError(data.message || 'Failed to load cycle instances.');
        return;
      }

      const data = await response.json();
      setCycles(data.data ?? []);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  // ─── Annotation Handlers ──────────────────────────────────────────────────

  const handleAddAnnotation = (cycleId: string) => {
    setAnnotationForm({ cycleId, phase: null, content: '', editingId: null });
    setOverrideForm(null);
    setActionStatus(null);
    setActionError(null);
  };

  const handleEditAnnotation = (annotation: AdminAnnotation) => {
    setAnnotationForm({
      cycleId: annotation.cycle_record_id,
      phase: annotation.phase,
      content: annotation.content,
      editingId: annotation.id,
    });
    setOverrideForm(null);
    setActionStatus(null);
    setActionError(null);
  };

  const handleSaveAnnotation = async () => {
    if (!annotationForm) return;

    const { cycleId, phase, content, editingId } = annotationForm;

    if (content.length < ANNOTATION_MIN_LENGTH || content.length > ANNOTATION_MAX_LENGTH) {
      setActionError(
        `Annotation must be between ${ANNOTATION_MIN_LENGTH} and ${ANNOTATION_MAX_LENGTH} characters.`,
      );
      return;
    }

    setActionError(null);

    try {
      if (editingId) {
        // Update existing annotation
        const response = await fetch(`/api/admin/cycles/${cycleId}/annotate`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ annotation_id: editingId, content }),
        });

        if (!response.ok) {
          const data = await response.json();
          setActionError(data.message || 'Failed to update annotation.');
          return;
        }

        setActionStatus('Annotation updated successfully.');
      } else {
        // Create new annotation
        const response = await fetch(`/api/admin/cycles/${cycleId}/annotate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phase: phase ?? undefined, content }),
        });

        if (!response.ok) {
          const data = await response.json();
          setActionError(data.message || 'Failed to create annotation.');
          return;
        }

        setActionStatus('Annotation added successfully.');
      }

      setAnnotationForm(null);
      await fetchCycles();
    } catch {
      setActionError('Something went wrong. Please try again.');
    }
  };

  const handleDeleteAnnotation = async (cycleId: string, annotationId: string) => {
    setActionError(null);
    setActionStatus(null);

    try {
      const response = await fetch(`/api/admin/cycles/${cycleId}/annotate`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ annotation_id: annotationId }),
      });

      if (!response.ok) {
        const data = await response.json();
        setActionError(data.message || 'Failed to delete annotation.');
        return;
      }

      setActionStatus('Annotation deleted successfully.');
      await fetchCycles();
    } catch {
      setActionError('Something went wrong. Please try again.');
    }
  };

  // ─── Override Handlers ────────────────────────────────────────────────────

  const handleAddOverride = (cycleId: string, phase: CyclePhase) => {
    setOverrideForm({ cycleId, phase, content: '', editingId: null });
    setAnnotationForm(null);
    setActionStatus(null);
    setActionError(null);
  };

  const handleEditOverride = (override: AdminOverride) => {
    setOverrideForm({
      cycleId: override.cycle_record_id,
      phase: override.phase,
      content: override.replacement_content,
      editingId: override.id,
    });
    setAnnotationForm(null);
    setActionStatus(null);
    setActionError(null);
  };

  const handleSaveOverride = async () => {
    if (!overrideForm) return;

    const { cycleId, phase, content, editingId } = overrideForm;

    if (content.length < ANNOTATION_MIN_LENGTH || content.length > ANNOTATION_MAX_LENGTH) {
      setActionError(
        `Override content must be between ${ANNOTATION_MIN_LENGTH} and ${ANNOTATION_MAX_LENGTH} characters.`,
      );
      return;
    }

    setActionError(null);

    try {
      if (editingId) {
        // Update existing override
        const response = await fetch(`/api/admin/cycles/${cycleId}/override`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ override_id: editingId, replacement_content: content }),
        });

        if (!response.ok) {
          const data = await response.json();
          setActionError(data.message || 'Failed to update override.');
          return;
        }

        setActionStatus('Override updated successfully.');
      } else {
        // Create new override
        const response = await fetch(`/api/admin/cycles/${cycleId}/override`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phase, replacement_content: content }),
        });

        if (!response.ok) {
          const data = await response.json();
          setActionError(data.message || 'Failed to create override.');
          return;
        }

        setActionStatus('Override created successfully.');
      }

      setOverrideForm(null);
      await fetchCycles();
    } catch {
      setActionError('Something went wrong. Please try again.');
    }
  };

  const handleRevertOverride = async (cycleId: string, overrideId: string) => {
    setActionError(null);
    setActionStatus(null);

    try {
      const response = await fetch(`/api/admin/cycles/${cycleId}/override`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ override_id: overrideId }),
      });

      if (!response.ok) {
        const data = await response.json();
        setActionError(data.message || 'Failed to revert override.');
        return;
      }

      setActionStatus('Override reverted. Original content restored.');
      await fetchCycles();
    } catch {
      setActionError('Something went wrong. Please try again.');
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading cycle instances...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
        <Link href="/admin" className="text-sm text-primary hover:underline">
          ← Back to Admin Panel
        </Link>
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="text-center">
            <p className="text-destructive">{error}</p>
            <button
              onClick={() => {
                setIsLoading(true);
                fetchCycles();
              }}
              className="mt-4 text-sm text-primary underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-sm text-primary hover:underline">
            ← Back to Admin Panel
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Cycle Instance Management</h1>
          <p className="text-sm text-muted-foreground">User ID: {userId}</p>
        </div>
      </div>

      {actionStatus && (
        <p className="text-sm text-green-600" role="status" data-testid="action-status">
          {actionStatus}
        </p>
      )}

      {actionError && (
        <p className="text-sm text-destructive" role="alert" data-testid="action-error">
          {actionError}
        </p>
      )}

      {cycles.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-[200px] items-center justify-center">
            <p className="text-muted-foreground">No cycle instances found for this user.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {cycles.map((cycle) => (
            <CycleInstanceCard
              key={cycle.id}
              cycle={cycle}
              onAddAnnotation={handleAddAnnotation}
              onEditAnnotation={handleEditAnnotation}
              onDeleteAnnotation={handleDeleteAnnotation}
              onAddOverride={handleAddOverride}
              onEditOverride={handleEditOverride}
              onRevertOverride={handleRevertOverride}
              annotationForm={annotationForm?.cycleId === cycle.id ? annotationForm : null}
              overrideForm={overrideForm?.cycleId === cycle.id ? overrideForm : null}
              onAnnotationFormChange={setAnnotationForm}
              onOverrideFormChange={setOverrideForm}
              onSaveAnnotation={handleSaveAnnotation}
              onSaveOverride={handleSaveOverride}
              onCancelForm={() => {
                setAnnotationForm(null);
                setOverrideForm(null);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Cycle Instance Card Component ─────────────────────────────────────────

interface CycleInstanceCardProps {
  cycle: CycleInstance;
  onAddAnnotation: (cycleId: string) => void;
  onEditAnnotation: (annotation: AdminAnnotation) => void;
  onDeleteAnnotation: (cycleId: string, annotationId: string) => void;
  onAddOverride: (cycleId: string, phase: CyclePhase) => void;
  onEditOverride: (override: AdminOverride) => void;
  onRevertOverride: (cycleId: string, overrideId: string) => void;
  annotationForm: {
    cycleId: string;
    phase: CyclePhase | null;
    content: string;
    editingId: string | null;
  } | null;
  overrideForm: {
    cycleId: string;
    phase: CyclePhase;
    content: string;
    editingId: string | null;
  } | null;
  onAnnotationFormChange: (
    form: {
      cycleId: string;
      phase: CyclePhase | null;
      content: string;
      editingId: string | null;
    } | null,
  ) => void;
  onOverrideFormChange: (
    form: {
      cycleId: string;
      phase: CyclePhase;
      content: string;
      editingId: string | null;
    } | null,
  ) => void;
  onSaveAnnotation: () => void;
  onSaveOverride: () => void;
  onCancelForm: () => void;
}

function CycleInstanceCard({
  cycle,
  onAddAnnotation,
  onEditAnnotation,
  onDeleteAnnotation,
  onAddOverride,
  onEditOverride,
  onRevertOverride,
  annotationForm,
  overrideForm,
  onAnnotationFormChange,
  onOverrideFormChange,
  onSaveAnnotation,
  onSaveOverride,
  onCancelForm,
}: CycleInstanceCardProps) {
  const phases = calculatePhases(cycle.start_date, cycle.cycle_length_days);
  const currentPhaseInfo = calculateCurrentPhase(cycle.start_date, cycle.cycle_length_days);

  const hasOverrides = cycle.overrides.length > 0;

  return (
    <Card
      data-testid={`cycle-instance-${cycle.id}`}
      className={hasOverrides ? 'border-amber-300' : ''}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Cycle starting {formatDate(cycle.start_date)}</CardTitle>
            <CardDescription>
              Length: {cycle.cycle_length_days || 28} days • Created: {formatDate(cycle.created_at)}
            </CardDescription>
          </div>
          {hasOverrides && (
            <span
              className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800"
              data-testid={`override-badge-${cycle.id}`}
            >
              Overridden
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Phase Info */}
        <div className="rounded-md bg-muted/50 p-3">
          <p className="text-sm font-medium">
            Current Phase:{' '}
            <span className="text-primary">{PHASE_LABELS[currentPhaseInfo.phase]}</span>
            {currentPhaseInfo.isOverdue && (
              <span className="ml-2 text-xs text-amber-600">(Overdue)</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Day {currentPhaseInfo.dayInPhase} in phase
          </p>
        </div>

        {/* Phase Breakdown */}
        <div>
          <h4 className="mb-2 text-sm font-medium">Phases</h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {phases.map(({ phase, duration }) => {
              const override = cycle.overrides.find((o) => o.phase === phase);
              return (
                <div
                  key={phase}
                  className={`rounded-md border p-2 text-center text-xs ${
                    override ? 'border-amber-300 bg-amber-50' : 'border-border bg-background'
                  }`}
                >
                  <p className="font-medium">{PHASE_LABELS[phase]}</p>
                  <p className="text-muted-foreground">{duration} days</p>
                  {override && (
                    <span className="mt-1 inline-block text-[10px] text-amber-700">overridden</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Overrides Section */}
        {cycle.overrides.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-medium">Active Overrides</h4>
            <div className="space-y-2">
              {cycle.overrides.map((override) => (
                <div
                  key={override.id}
                  className="rounded-md border border-amber-200 bg-amber-50 p-3"
                  data-testid={`override-${override.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-amber-800">
                        {PHASE_LABELS[override.phase]} — Admin Override
                      </p>
                      <p className="mt-1 text-sm">{override.replacement_content}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Original: {override.original_content}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditOverride(override)}
                        aria-label={`Edit override for ${PHASE_LABELS[override.phase]}`}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRevertOverride(cycle.id, override.id)}
                        aria-label={`Revert override for ${PHASE_LABELS[override.phase]}`}
                      >
                        Revert
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Annotations Section */}
        {cycle.annotations.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-medium">Annotations</h4>
            <div className="space-y-2">
              {cycle.annotations.map((annotation) => (
                <div
                  key={annotation.id}
                  className="rounded-md border p-3"
                  data-testid={`annotation-${annotation.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {annotation.phase
                          ? `${PHASE_LABELS[annotation.phase]} Phase`
                          : 'Cycle-level'}{' '}
                        • {formatDate(annotation.updated_at)}
                      </p>
                      <p className="mt-1 text-sm">{annotation.content}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditAnnotation(annotation)}
                        aria-label="Edit annotation"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => onDeleteAnnotation(cycle.id, annotation.id)}
                        aria-label="Delete annotation"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddAnnotation(cycle.id)}
            data-testid={`add-annotation-${cycle.id}`}
          >
            Add Annotation
          </Button>
          <OverridePhaseDropdown
            cycleId={cycle.id}
            existingOverrides={cycle.overrides}
            onAddOverride={onAddOverride}
          />
        </div>

        {/* Annotation Form */}
        {annotationForm && (
          <div className="rounded-md border bg-muted/30 p-4" data-testid="annotation-form">
            <h4 className="mb-3 text-sm font-medium">
              {annotationForm.editingId ? 'Edit Annotation' : 'Add Annotation'}
            </h4>
            <div className="space-y-3">
              <div>
                <Label htmlFor="annotation-phase" className="text-sm">
                  Phase (optional)
                </Label>
                <select
                  id="annotation-phase"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={annotationForm.phase ?? ''}
                  onChange={(e) =>
                    onAnnotationFormChange({
                      ...annotationForm,
                      phase: e.target.value ? (e.target.value as CyclePhase) : null,
                    })
                  }
                >
                  <option value="">Cycle-level (no specific phase)</option>
                  {PHASE_OPTIONS.map((phase) => (
                    <option key={phase} value={phase}>
                      {PHASE_LABELS[phase]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="annotation-content" className="text-sm">
                  Content ({annotationForm.content.length}/{ANNOTATION_MAX_LENGTH})
                </Label>
                <Textarea
                  id="annotation-content"
                  value={annotationForm.content}
                  onChange={(e) =>
                    onAnnotationFormChange({
                      ...annotationForm,
                      content: e.target.value,
                    })
                  }
                  placeholder="Enter annotation content (1-2000 characters)..."
                  maxLength={ANNOTATION_MAX_LENGTH}
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={onSaveAnnotation}>
                  {annotationForm.editingId ? 'Update' : 'Save'}
                </Button>
                <Button variant="outline" size="sm" onClick={onCancelForm}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Override Form */}
        {overrideForm && (
          <div
            className="rounded-md border border-amber-200 bg-amber-50/50 p-4"
            data-testid="override-form"
          >
            <h4 className="mb-3 text-sm font-medium">
              {overrideForm.editingId ? 'Edit Override' : 'Add Override'} —{' '}
              {PHASE_LABELS[overrideForm.phase]}
            </h4>
            <div className="space-y-3">
              <div>
                <Label htmlFor="override-content" className="text-sm">
                  Replacement Content ({overrideForm.content.length}/{ANNOTATION_MAX_LENGTH})
                </Label>
                <Textarea
                  id="override-content"
                  value={overrideForm.content}
                  onChange={(e) =>
                    onOverrideFormChange({
                      ...overrideForm,
                      content: e.target.value,
                    })
                  }
                  placeholder="Enter replacement content (1-2000 characters)..."
                  maxLength={ANNOTATION_MAX_LENGTH}
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={onSaveOverride}>
                  {overrideForm.editingId ? 'Update Override' : 'Apply Override'}
                </Button>
                <Button variant="outline" size="sm" onClick={onCancelForm}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Override Phase Dropdown ─────────────────────────────────────────────────

interface OverridePhaseDropdownProps {
  cycleId: string;
  existingOverrides: AdminOverride[];
  onAddOverride: (cycleId: string, phase: CyclePhase) => void;
}

function OverridePhaseDropdown({
  cycleId,
  existingOverrides,
  onAddOverride,
}: OverridePhaseDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const overriddenPhases = new Set(existingOverrides.map((o) => o.phase));
  const availablePhases = PHASE_OPTIONS.filter((p) => !overriddenPhases.has(p));

  if (availablePhases.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled>
        All Phases Overridden
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        data-testid={`add-override-${cycleId}`}
      >
        Override Phase ▾
      </Button>
      {isOpen && (
        <div className="absolute left-0 top-full z-10 mt-1 rounded-md border bg-background shadow-md">
          {availablePhases.map((phase) => (
            <button
              key={phase}
              className="block w-full px-4 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                onAddOverride(cycleId, phase);
                setIsOpen(false);
              }}
            >
              {PHASE_LABELS[phase]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
