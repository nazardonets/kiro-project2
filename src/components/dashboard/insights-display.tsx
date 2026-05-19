'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface EnergyIndicator {
  level: string;
  summary: string;
}

interface InsightsDisplayProps {
  emotionalTendencies: string[];
  cognitiveTendencies: string[];
  behavioralTendencies: string[];
  energyLevel: EnergyIndicator;
  communicationTendencies: string[];
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

export function InsightsDisplay({
  emotionalTendencies,
  cognitiveTendencies,
  behavioralTendencies,
  energyLevel,
  communicationTendencies,
}: InsightsDisplayProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Phase Tendencies</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          <TendencyList items={emotionalTendencies} label="Emotional" />
          <TendencyList items={cognitiveTendencies} label="Cognitive" />
          <TendencyList items={behavioralTendencies} label="Behavioral" />

          {energyLevel && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground">Energy Level</h4>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                  {energyLevel.level}
                </span>
                <span className="text-sm leading-relaxed">{energyLevel.summary}</span>
              </div>
            </div>
          )}

          <TendencyList items={communicationTendencies} label="Communication" />
        </div>
      </CardContent>
    </Card>
  );
}
