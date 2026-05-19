'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CyclePhase } from '@/lib/types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SituationalRecommendation {
  scenario: string;
  recommendation: string;
}

export interface GuidancePanelData {
  guidance: {
    phase: CyclePhase;
    supportiveActions: string[];
    triggersToAvoid: string[];
    communicationStrategies: string[];
    discouragedPatterns: string[];
  };
  decisionSupport: {
    behavioralPrompts: string[];
    situationalRecommendations: SituationalRecommendation[];
  };
  phaseInfo: {
    currentPhase: CyclePhase;
    dayInPhase: number;
    isOverdue: boolean;
  };
}

interface GuidancePanelProps {
  data: GuidancePanelData;
}

// ─── Phase Labels ───────────────────────────────────────────────────────────

const PHASE_LABELS: Record<CyclePhase, string> = {
  [CyclePhase.MENSTRUAL]: 'Menstrual Phase',
  [CyclePhase.FOLLICULAR]: 'Follicular Phase',
  [CyclePhase.OVULATION]: 'Ovulation Phase',
  [CyclePhase.EARLY_LUTEAL]: 'Early Luteal Phase',
  [CyclePhase.LATE_LUTEAL]: 'Late Luteal Phase',
};

// ─── Section Component ──────────────────────────────────────────────────────

function GuidanceSection({
  title,
  items,
  variant = 'default',
}: {
  title: string;
  items: string[];
  variant?: 'default' | 'caution';
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-muted-foreground">{title}</h4>
      <ul className="space-y-1.5">
        {items.map((item, index) => (
          <li
            key={index}
            className={`text-sm leading-relaxed ${variant === 'caution' ? 'text-amber-700' : ''}`}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Guidance Panel Component ───────────────────────────────────────────────

/**
 * Guidance Panel for the Partner Dashboard.
 *
 * Displays contextual guidance for the partner based on the current cycle phase:
 * - 3-5 recommended supportive actions
 * - 2-4 triggers/mistakes to avoid
 * - 2-4 communication strategies with tone/language examples
 * - 2-4 discouraged language/tone patterns
 *
 * Uses suggestion-oriented language ("consider", "you might try") and
 * probabilistic framing per Requirements 14.1-14.9.
 *
 * Hidden when communication guidance category is disabled (handled by parent).
 */
export function GuidancePanel({ data }: GuidancePanelProps) {
  const { guidance, decisionSupport, phaseInfo } = data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Guidance — {PHASE_LABELS[phaseInfo.currentPhase]}
          </CardTitle>
          {phaseInfo.isOverdue && (
            <p className="text-sm text-amber-600">
              Cycle may be overdue — guidance is based on the Late Luteal phase.
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            <GuidanceSection title="Supportive Actions" items={guidance.supportiveActions} />

            <GuidanceSection
              title="Triggers to Avoid"
              items={guidance.triggersToAvoid}
              variant="caution"
            />

            <GuidanceSection
              title="Communication Strategies"
              items={guidance.communicationStrategies}
            />

            <GuidanceSection
              title="Discouraged Patterns"
              items={guidance.discouragedPatterns}
              variant="caution"
            />
          </div>
        </CardContent>
      </Card>

      {decisionSupport.behavioralPrompts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              <GuidanceSection
                title="Behavioral Prompts"
                items={decisionSupport.behavioralPrompts}
              />

              {decisionSupport.situationalRecommendations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground">
                    Situational Recommendations
                  </h4>
                  <ul className="space-y-3">
                    {decisionSupport.situationalRecommendations.map((rec, index) => (
                      <li key={index} className="space-y-0.5">
                        <p className="text-sm font-medium">{rec.scenario}</p>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {rec.recommendation}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
