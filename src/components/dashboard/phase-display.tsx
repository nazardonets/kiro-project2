'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CyclePhase } from '@/lib/types';

interface PhaseDisplayProps {
  phase: CyclePhase;
  dayInPhase: number;
  isOverdue: boolean;
  totalCycleLength: number;
  elapsedDays: number;
}

const PHASE_LABELS: Record<CyclePhase, string> = {
  [CyclePhase.MENSTRUAL]: 'Menstrual Phase',
  [CyclePhase.FOLLICULAR]: 'Follicular Phase',
  [CyclePhase.OVULATION]: 'Ovulation Phase',
  [CyclePhase.EARLY_LUTEAL]: 'Early Luteal Phase',
  [CyclePhase.LATE_LUTEAL]: 'Late Luteal Phase',
};

const PHASE_COLORS: Record<CyclePhase, string> = {
  [CyclePhase.MENSTRUAL]: 'bg-red-100 text-red-800 border-red-200',
  [CyclePhase.FOLLICULAR]: 'bg-green-100 text-green-800 border-green-200',
  [CyclePhase.OVULATION]: 'bg-purple-100 text-purple-800 border-purple-200',
  [CyclePhase.EARLY_LUTEAL]: 'bg-blue-100 text-blue-800 border-blue-200',
  [CyclePhase.LATE_LUTEAL]: 'bg-amber-100 text-amber-800 border-amber-200',
};

export function PhaseDisplay({
  phase,
  dayInPhase,
  isOverdue,
  totalCycleLength,
  elapsedDays,
}: PhaseDisplayProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Current Phase</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          <div
            className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-sm font-medium ${PHASE_COLORS[phase]}`}
          >
            {PHASE_LABELS[phase]}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">Day {dayInPhase}</span>
            <span className="text-sm text-muted-foreground">of this phase</span>
          </div>
          {isOverdue && (
            <p className="text-sm text-amber-600">
              Cycle is overdue (Day {elapsedDays} of expected {totalCycleLength}-day cycle)
            </p>
          )}
          {!isOverdue && (
            <p className="text-sm text-muted-foreground">
              Cycle day {elapsedDays} of {totalCycleLength}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
