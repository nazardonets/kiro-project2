'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CyclePhase } from '@/lib/types';

interface PredictionSegment {
  phase: CyclePhase;
  start_date: string;
  end_date: string;
  start_day: number;
  end_day: number;
}

interface PredictionsDisplayProps {
  predictions: PredictionSegment[];
  cycleStartDate: string;
}

const PHASE_LABELS: Record<CyclePhase, string> = {
  [CyclePhase.MENSTRUAL]: 'Menstrual',
  [CyclePhase.FOLLICULAR]: 'Follicular',
  [CyclePhase.OVULATION]: 'Ovulation',
  [CyclePhase.EARLY_LUTEAL]: 'Early Luteal',
  [CyclePhase.LATE_LUTEAL]: 'Late Luteal',
};

const PHASE_DOT_COLORS: Record<CyclePhase, string> = {
  [CyclePhase.MENSTRUAL]: 'bg-red-400',
  [CyclePhase.FOLLICULAR]: 'bg-green-400',
  [CyclePhase.OVULATION]: 'bg-purple-400',
  [CyclePhase.EARLY_LUTEAL]: 'bg-blue-400',
  [CyclePhase.LATE_LUTEAL]: 'bg-amber-400',
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function PredictionsDisplay({ predictions }: PredictionsDisplayProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Upcoming Phases (60 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {predictions.map((prediction, index) => (
            <div
              key={`${prediction.phase}-${prediction.start_day}-${index}`}
              className="flex items-center gap-3 rounded-md border p-3"
            >
              <div className={`h-3 w-3 shrink-0 rounded-full ${PHASE_DOT_COLORS[prediction.phase]}`} />
              <div className="flex flex-1 flex-col sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium">{PHASE_LABELS[prediction.phase]}</span>
                <span className="text-sm text-muted-foreground">
                  {formatDate(prediction.start_date)} – {formatDate(prediction.end_date)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
