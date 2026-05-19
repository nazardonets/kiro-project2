'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { EmptyState } from '@/components/dashboard/empty-state';
import { InsightsDisplay } from '@/components/dashboard/insights-display';
import { PhaseDisplay } from '@/components/dashboard/phase-display';
import { PredictionsDisplay } from '@/components/dashboard/predictions-display';
import { SelfCareDisplay } from '@/components/dashboard/self-care-display';
import { Button } from '@/components/ui/button';
import { CyclePhase } from '@/lib/types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PhaseData {
  phase: CyclePhase;
  day_in_phase: number;
  is_overdue: boolean;
  total_cycle_length: number;
  elapsed_days: number;
  cycle_start_date: string;
}

interface PredictionSegment {
  phase: CyclePhase;
  start_date: string;
  end_date: string;
  start_day: number;
  end_day: number;
}

interface PredictionsData {
  predictions: PredictionSegment[];
  cycle_start_date: string;
  generated_at: string;
}

interface EnergyIndicator {
  level: string;
  summary: string;
}

interface InsightsData {
  insights: {
    phase: CyclePhase;
    emotionalTendencies: string[];
    cognitiveTendencies: string[];
    behavioralTendencies: string[];
    energyLevel: EnergyIndicator;
    communicationTendencies: string[];
  };
  personalNote: string | null;
  phaseInfo: {
    currentPhase: CyclePhase;
    dayInPhase: number;
    isOverdue: boolean;
  };
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Polling interval for phase change detection (60 seconds per Requirement 10.5) */
const POLL_INTERVAL_MS = 60_000;

// ─── Dashboard Page ─────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [phaseData, setPhaseData] = useState<PhaseData | null>(null);
  const [predictionsData, setPredictionsData] = useState<PredictionsData | null>(null);
  const [insightsData, setInsightsData] = useState<InsightsData | null>(null);
  const [isEmpty, setIsEmpty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const previousPhaseRef = useRef<CyclePhase | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPhaseData = useCallback(async (): Promise<PhaseData | null> => {
    const response = await fetch('/api/cycle/phase');
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error('Failed to fetch phase data');
    }
    return response.json();
  }, []);

  const fetchPredictions = useCallback(async (): Promise<PredictionsData | null> => {
    const response = await fetch('/api/cycle/predictions');
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error('Failed to fetch predictions');
    }
    return response.json();
  }, []);

  const fetchInsights = useCallback(async (): Promise<InsightsData | null> => {
    const response = await fetch('/api/cycle/insights');
    if (!response.ok) {
      return null;
    }
    return response.json();
  }, []);

  const loadDashboardData = useCallback(async () => {
    try {
      setError(null);

      const phase = await fetchPhaseData();

      if (!phase) {
        setIsEmpty(true);
        setIsLoading(false);
        return;
      }

      setIsEmpty(false);
      setPhaseData(phase);

      // Check if phase changed — if so, refresh all data
      const phaseChanged =
        previousPhaseRef.current !== null && previousPhaseRef.current !== phase.phase;
      previousPhaseRef.current = phase.phase;

      // Fetch predictions and insights in parallel
      const [predictions, insights] = await Promise.all([fetchPredictions(), fetchInsights()]);

      if (predictions) {
        setPredictionsData(predictions);
      }

      if (insights) {
        setInsightsData(insights);
      }

      // If phase changed, data is already refreshed above
      if (phaseChanged) {
        // Data already refreshed
      }
    } catch {
      setError('Unable to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchPhaseData, fetchPredictions, fetchInsights]);

  useEffect(() => {
    loadDashboardData();

    // Set up polling every 60 seconds to detect phase changes (Requirement 10.5)
    pollIntervalRef.current = setInterval(() => {
      loadDashboardData();
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [loadDashboardData]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading your dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">{error}</p>
          <button
            onClick={() => {
              setIsLoading(true);
              loadDashboardData();
            }}
            className="mt-4 text-sm text-primary underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return <EmptyState />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your Dashboard</h1>
        <Link href="/dashboard/date-request">
          <Button data-testid="request-a-date-button">Request a Date</Button>
        </Link>
      </div>

      {phaseData && (
        <PhaseDisplay
          phase={phaseData.phase}
          dayInPhase={phaseData.day_in_phase}
          isOverdue={phaseData.is_overdue}
          totalCycleLength={phaseData.total_cycle_length}
          elapsedDays={phaseData.elapsed_days}
        />
      )}

      {insightsData && (
        <InsightsDisplay
          emotionalTendencies={insightsData.insights.emotionalTendencies}
          cognitiveTendencies={insightsData.insights.cognitiveTendencies}
          behavioralTendencies={insightsData.insights.behavioralTendencies}
          energyLevel={insightsData.insights.energyLevel}
          communicationTendencies={insightsData.insights.communicationTendencies}
        />
      )}

      {phaseData && !insightsData && <InsightsDisplayFromPhase phase={phaseData.phase} />}

      {phaseData && <SelfCareDisplay phase={phaseData.phase} />}

      {predictionsData && (
        <PredictionsDisplay
          predictions={predictionsData.predictions}
          cycleStartDate={predictionsData.cycle_start_date}
        />
      )}
    </div>
  );
}

// ─── Fallback Insights Component ────────────────────────────────────────────

/**
 * When the partner insights endpoint is not available (primary user context),
 * we generate insights client-side using the InsightsService content.
 * This component uses the same base content structure.
 */
function InsightsDisplayFromPhase({ phase }: { phase: CyclePhase }) {
  const insights = getBaseInsightsForPhase(phase);

  return (
    <InsightsDisplay
      emotionalTendencies={insights.emotionalTendencies}
      cognitiveTendencies={insights.cognitiveTendencies}
      behavioralTendencies={insights.behavioralTendencies}
      energyLevel={insights.energyLevel}
      communicationTendencies={insights.communicationTendencies}
    />
  );
}

/**
 * Client-side base insights content matching the InsightsService output.
 * This mirrors the server-side content for when the API endpoint is not accessible.
 */
function getBaseInsightsForPhase(phase: CyclePhase) {
  const content: Record<
    CyclePhase,
    {
      emotionalTendencies: string[];
      cognitiveTendencies: string[];
      behavioralTendencies: string[];
      energyLevel: { level: string; summary: string };
      communicationTendencies: string[];
    }
  > = {
    [CyclePhase.MENSTRUAL]: {
      emotionalTendencies: [
        'You may experience a desire for quiet reflection and emotional withdrawal.',
        'Common tendencies include heightened sensitivity and a need for comfort.',
        'You might feel more introspective and emotionally vulnerable during this time.',
      ],
      cognitiveTendencies: [
        'Thought patterns may lean toward introspection and self-evaluation.',
        'You might find it harder to concentrate on complex tasks and prefer simpler activities.',
      ],
      behavioralTendencies: [
        'You may prefer staying home and engaging in low-key activities.',
        'Common behaviors include seeking physical comfort like warm drinks or soft blankets.',
      ],
      energyLevel: {
        level: 'Low',
        summary:
          'Energy tends to be at its lowest during this phase. You may need more rest and gentler pacing throughout the day.',
      },
      communicationTendencies: [
        'You may prefer shorter, gentler conversations without pressure to engage deeply.',
        'Communication style might lean toward quiet presence rather than active discussion.',
      ],
    },
    [CyclePhase.FOLLICULAR]: {
      emotionalTendencies: [
        'You may feel a renewed sense of optimism and emotional lightness.',
        'Common tendencies include increased curiosity and openness to new experiences.',
        'You might notice growing confidence and emotional resilience.',
      ],
      cognitiveTendencies: [
        'Thought patterns may become more creative and solution-oriented.',
        'You might find it easier to learn new things and absorb information.',
      ],
      behavioralTendencies: [
        'You may be more inclined to try new activities or explore new places.',
        'Common behaviors include increased social engagement and planning ahead.',
      ],
      energyLevel: {
        level: 'Moderate',
        summary:
          'Energy typically builds gradually during this phase. You may feel increasingly capable and motivated as the days progress.',
      },
      communicationTendencies: [
        'You may be more open to longer conversations and sharing ideas.',
        'Communication style might become more enthusiastic and future-oriented.',
      ],
    },
    [CyclePhase.OVULATION]: {
      emotionalTendencies: [
        'You may experience heightened confidence and emotional expressiveness.',
        'Common tendencies include feeling more socially connected and outgoing.',
        'You might feel more emotionally generous and empathetic toward others.',
      ],
      cognitiveTendencies: [
        'Thought patterns may be more outward-focused and communicative.',
        'You might find verbal expression comes more naturally and fluidly.',
      ],
      behavioralTendencies: [
        'You may seek out social gatherings and enjoy being around others.',
        'Common behaviors include increased physical activity and expressiveness.',
      ],
      energyLevel: {
        level: 'High',
        summary:
          'Energy often peaks around ovulation. You may feel vibrant, social, and ready for activity.',
      },
      communicationTendencies: [
        'You may communicate more openly and expressively than usual.',
        'Communication style might be warm, engaging, and emotionally generous.',
      ],
    },
    [CyclePhase.EARLY_LUTEAL]: {
      emotionalTendencies: [
        'You may experience a shift toward focused, task-oriented emotional energy.',
        'Common tendencies include a desire for productivity and accomplishment.',
        'You might feel more emotionally steady but less socially driven.',
      ],
      cognitiveTendencies: [
        'Thought patterns may become more detail-oriented and analytical.',
        'You might prefer structured planning and completing existing projects.',
      ],
      behavioralTendencies: [
        'You may focus on completing tasks and organizing your environment.',
        'Common behaviors include nesting activities and attention to detail.',
      ],
      energyLevel: {
        level: 'Moderate',
        summary:
          'Energy may remain steady but shift toward focused productivity. You might prefer channeling energy into specific tasks.',
      },
      communicationTendencies: [
        'You may prefer clear, direct communication without ambiguity.',
        'Communication style might be more task-focused and practical.',
      ],
    },
    [CyclePhase.LATE_LUTEAL]: {
      emotionalTendencies: [
        'You may experience heightened emotional sensitivity and intensity.',
        'Common tendencies include feeling more easily overwhelmed or frustrated.',
        'You might notice increased emotional reactivity to everyday situations.',
      ],
      cognitiveTendencies: [
        'Thought patterns may become more ruminative or self-critical.',
        'You might find it harder to let go of worries or perceived slights.',
      ],
      behavioralTendencies: [
        'You may withdraw from social situations and prefer solitude.',
        'Common behaviors include comfort-seeking and reduced tolerance for disruption.',
      ],
      energyLevel: {
        level: 'Low',
        summary:
          'Energy often dips during this phase. You may tire more easily and benefit from a slower pace.',
      },
      communicationTendencies: [
        'You may be more sensitive to tone and word choice in conversations.',
        'Communication style might require extra gentleness and patience.',
      ],
    },
  };

  return content[phase];
}
