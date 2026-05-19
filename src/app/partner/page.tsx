'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { GuidancePanel, GuidancePanelData } from '@/components/dashboard/guidance-panel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CyclePhase } from '@/lib/types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DailySummaryData {
  todaysState: string;
  bestApproach: string[];
  avoidThis: string[];
  phase: CyclePhase;
  summaryDate: string;
}

interface PhaseInfo {
  currentPhase: CyclePhase;
  dayInPhase: number;
  isOverdue: boolean;
}

interface EnergyIndicator {
  level: string;
  summary: string;
}

interface InsightsData {
  phase: CyclePhase;
  emotionalTendencies: string[];
  cognitiveTendencies: string[];
  behavioralTendencies: string[];
  energyLevel: EnergyIndicator | null;
  communicationTendencies: string[];
}

interface DailySummaryResponse {
  dailySummary: DailySummaryData;
  phaseInfo: PhaseInfo;
}

type DashboardState =
  | { type: 'loading' }
  | { type: 'error'; message: string }
  | { type: 'empty'; reason: 'no_cycle_data' | 'sharing_revoked' | 'all_disabled' }
  | {
      type: 'loaded';
      dailySummary: DailySummaryData | null;
      insights: InsightsData | null;
      personalNote: string | null;
      phaseInfo: PhaseInfo;
      guidanceData: GuidancePanelData | null;
    };

// ─── Constants ──────────────────────────────────────────────────────────────

/** Polling interval for phase change detection (60 seconds per Requirement 12.6) */
const POLL_INTERVAL_MS = 60_000;

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

// ─── Partner Dashboard Page ─────────────────────────────────────────────────

export default function PartnerDashboardPage() {
  const [state, setState] = useState<DashboardState>({ type: 'loading' });
  const previousPhaseRef = useRef<CyclePhase | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      // Fetch daily summary, insights, and guidance in parallel
      const [summaryRes, insightsRes, guidanceRes] = await Promise.all([
        fetch('/api/partner/daily-summary'),
        fetch('/api/partner/insights'),
        fetch('/api/partner/guidance'),
      ]);

      // Handle insights response
      const insightsBody = await insightsRes.json();

      if (insightsRes.status === 401) {
        setState({ type: 'error', message: 'Please log in to view your partner dashboard.' });
        return;
      }

      // Check for no cycle data (200 with code)
      if (insightsBody.code === 'NO_CYCLE_DATA') {
        setState({ type: 'empty', reason: 'no_cycle_data' });
        return;
      }

      // Check for sharing revoked / no active link
      if (insightsBody.code === 'NO_ACTIVE_LINK' || insightsBody.code === 'SHARING_UNAVAILABLE') {
        setState({ type: 'empty', reason: 'sharing_revoked' });
        return;
      }

      // Check for all categories disabled
      if (insightsBody.code === 'SHARING_DISABLED') {
        setState({ type: 'empty', reason: 'all_disabled' });
        return;
      }

      if (insightsRes.status === 403 && !insightsBody.insights) {
        setState({ type: 'empty', reason: 'sharing_revoked' });
        return;
      }

      // Handle daily summary response
      let dailySummary: DailySummaryData | null = null;
      if (summaryRes.ok) {
        const summaryBody: DailySummaryResponse = await summaryRes.json();
        if (summaryBody.dailySummary) {
          dailySummary = summaryBody.dailySummary;
        }
      }

      // Handle guidance response — hidden when communication_guidance is disabled (Req 14.8, 14.9)
      let guidanceData: GuidancePanelData | null = null;
      if (guidanceRes.ok) {
        const guidanceBody = await guidanceRes.json();
        if (guidanceBody.guidance) {
          guidanceData = guidanceBody;
        }
      }
      // If guidance returns 403 with SHARING_DISABLED, it means communication_guidance
      // category is disabled — we simply don't show the panel (guidanceData stays null)

      // Determine phase info from insights or summary
      const phaseInfo: PhaseInfo = insightsBody.phaseInfo;

      // Track phase changes
      if (
        previousPhaseRef.current !== null &&
        previousPhaseRef.current !== phaseInfo.currentPhase
      ) {
        // Phase changed — data is already refreshed
      }
      previousPhaseRef.current = phaseInfo.currentPhase;

      setState({
        type: 'loaded',
        dailySummary,
        insights: insightsBody.insights || null,
        personalNote: insightsBody.personalNote || null,
        phaseInfo,
        guidanceData,
      });
    } catch {
      setState({ type: 'error', message: 'Unable to load dashboard data. Please try again.' });
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Set up polling every 60 seconds to detect phase changes (Requirement 12.6)
    pollIntervalRef.current = setInterval(() => {
      fetchData();
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchData]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (state.type === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading partner dashboard...</p>
      </div>
    );
  }

  if (state.type === 'error') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">{state.message}</p>
          <button
            onClick={() => {
              setState({ type: 'loading' });
              fetchData();
            }}
            className="mt-4 text-sm text-primary underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (state.type === 'empty') {
    return <PartnerEmptyState reason={state.reason} />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <h1 className="text-2xl font-bold">Partner Dashboard</h1>

      {/* Daily Summary — first visible section, no scrolling required (Requirement 15.6) */}
      {state.dailySummary && (
        <DailySummaryCard summary={state.dailySummary} phaseInfo={state.phaseInfo} />
      )}

      {/* Current Phase Display */}
      <PartnerPhaseCard phaseInfo={state.phaseInfo} />

      {/* Insights sections */}
      {state.insights && <PartnerInsightsCard insights={state.insights} />}

      {/* Guidance Panel — hidden when communication guidance is disabled (Req 14.8, 14.9) */}
      {state.guidanceData && <GuidancePanel data={state.guidanceData} />}

      {/* Personal Notes */}
      {state.personalNote && <PersonalNoteCard note={state.personalNote} />}
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function PartnerEmptyState({
  reason,
}: {
  reason: 'no_cycle_data' | 'sharing_revoked' | 'all_disabled';
}) {
  const messages = {
    no_cycle_data: {
      title: 'Cycle Data Not Yet Available',
      description:
        'Your partner has not yet submitted cycle data. Once they do, insights will appear here automatically.',
    },
    sharing_revoked: {
      title: 'Sharing Not Active',
      description:
        'Your partner has not enabled sharing or the partner link is no longer active. Please reach out to your partner if you believe this is an error.',
    },
    all_disabled: {
      title: 'No Shared Content Available',
      description:
        'Your partner has chosen not to share any insight categories at this time. Content will appear here when sharing is re-enabled.',
    },
  };

  const { title, description } = messages[reason];

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md text-center">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function DailySummaryCard({
  summary,
  phaseInfo,
}: {
  summary: DailySummaryData;
  phaseInfo: PhaseInfo;
}) {
  return (
    <Card data-testid="daily-summary-card">
      <CardHeader>
        <CardTitle className="text-lg">Daily Summary</CardTitle>
        <p className="text-sm text-muted-foreground">
          {PHASE_LABELS[phaseInfo.currentPhase]} — Day {phaseInfo.dayInPhase}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Today's State */}
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-muted-foreground">Today&apos;s State</h4>
            <p className="text-sm leading-relaxed">{summary.todaysState}</p>
          </div>

          {/* Best Approach */}
          {summary.bestApproach.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-green-700">Best Approach</h4>
              <ul className="space-y-1">
                {summary.bestApproach.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm leading-relaxed">
                    <span className="mt-0.5 text-green-600">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Avoid This */}
          {summary.avoidThis.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-red-700">Avoid This</h4>
              <ul className="space-y-1">
                {summary.avoidThis.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm leading-relaxed">
                    <span className="mt-0.5 text-red-600">✗</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PartnerPhaseCard({ phaseInfo }: { phaseInfo: PhaseInfo }) {
  return (
    <Card data-testid="phase-card">
      <CardHeader>
        <CardTitle className="text-lg">Current Phase</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          <div
            className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-sm font-medium ${PHASE_COLORS[phaseInfo.currentPhase]}`}
          >
            {PHASE_LABELS[phaseInfo.currentPhase]}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">Day {phaseInfo.dayInPhase}</span>
            <span className="text-sm text-muted-foreground">of this phase</span>
          </div>
          {phaseInfo.isOverdue && (
            <p className="text-sm text-amber-600">Cycle may be running longer than expected</p>
          )}
          <p className="text-xs text-muted-foreground">
            Remember, every person is unique — these phases may vary from individual to individual.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function TendencyList({ items, label }: { items: string[]; label: string }) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-muted-foreground">{label}</h4>
      <ul className="space-y-1.5">
        {items.map((item, index) => (
          <li key={index} className="text-sm leading-relaxed">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PartnerInsightsCard({ insights }: { insights: InsightsData }) {
  const hasContent =
    insights.emotionalTendencies.length > 0 ||
    insights.behavioralTendencies.length > 0 ||
    insights.energyLevel !== null;

  if (!hasContent) return null;

  return (
    <Card data-testid="insights-card">
      <CardHeader>
        <CardTitle className="text-lg">Phase Tendencies</CardTitle>
        <p className="text-xs text-muted-foreground">
          These are common tendencies — your partner may experience some, all, or none of these.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          <TendencyList items={insights.emotionalTendencies} label="Emotional Tendencies" />
          <TendencyList items={insights.cognitiveTendencies} label="Cognitive Patterns" />
          <TendencyList items={insights.behavioralTendencies} label="Behavioral Patterns" />

          {insights.energyLevel && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground">Energy Level</h4>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                  {insights.energyLevel.level}
                </span>
                <span className="text-sm leading-relaxed">{insights.energyLevel.summary}</span>
              </div>
            </div>
          )}

          <TendencyList items={insights.communicationTendencies} label="Communication Style" />
        </div>
      </CardContent>
    </Card>
  );
}

function PersonalNoteCard({ note }: { note: string }) {
  return (
    <Card data-testid="personal-note-card">
      <CardHeader>
        <CardTitle className="text-lg">Personal Note from Your Partner</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed italic">&ldquo;{note}&rdquo;</p>
      </CardContent>
    </Card>
  );
}
