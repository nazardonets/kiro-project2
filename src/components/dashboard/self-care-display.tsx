'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CyclePhase } from '@/lib/types';

interface SelfCareDisplayProps {
  phase: CyclePhase;
}

const PHASE_LABELS: Record<CyclePhase, string> = {
  [CyclePhase.MENSTRUAL]: 'Menstrual Phase',
  [CyclePhase.FOLLICULAR]: 'Follicular Phase',
  [CyclePhase.OVULATION]: 'Ovulation Phase',
  [CyclePhase.EARLY_LUTEAL]: 'Early Luteal Phase',
  [CyclePhase.LATE_LUTEAL]: 'Late Luteal Phase',
};

/**
 * Self-care suggestions and energy management insights for each phase.
 * Uses probabilistic, supportive language per Requirement 19.
 */
const SELF_CARE_CONTENT: Record<
  CyclePhase,
  { suggestions: string[]; energyTips: string[] }
> = {
  [CyclePhase.MENSTRUAL]: {
    suggestions: [
      'Gentle movement like stretching or slow walks may help ease discomfort.',
      'Warm baths or heating pads can offer soothing relief during this time.',
      'Journaling or quiet reflection may feel especially restorative right now.',
      'Prioritizing sleep and rest can support your body through this phase.',
    ],
    energyTips: [
      'Your energy may be at its lowest — consider scaling back commitments where possible.',
      'Short rest breaks throughout the day can help maintain your wellbeing.',
      'Nourishing, warm foods may feel more satisfying than usual.',
    ],
  },
  [CyclePhase.FOLLICULAR]: {
    suggestions: [
      'This may be a great time to try a new workout or physical activity.',
      'Setting intentions or starting new projects could feel especially motivating.',
      'Social activities and creative pursuits may align well with your rising energy.',
      'Experimenting with new recipes or routines might feel exciting right now.',
    ],
    energyTips: [
      'Your energy is likely building — you may feel ready to take on more.',
      'Morning exercise could feel particularly invigorating during this phase.',
      'Planning ahead for the week may come more naturally right now.',
    ],
  },
  [CyclePhase.OVULATION]: {
    suggestions: [
      'Social gatherings and connection-focused activities may feel especially rewarding.',
      'This could be an ideal time for important conversations or presentations.',
      'High-intensity workouts may feel more enjoyable and sustainable right now.',
      'Expressing yourself creatively or verbally may come more naturally.',
    ],
    energyTips: [
      'Your energy is likely at its peak — enjoy the vitality while it lasts.',
      'You may find you can handle more social and physical demands than usual.',
      'Channel this energy into meaningful activities that matter to you.',
    ],
  },
  [CyclePhase.EARLY_LUTEAL]: {
    suggestions: [
      'Organizing your space or completing lingering tasks may feel satisfying.',
      'Moderate exercise like yoga or swimming can support your steady energy.',
      'Meal prepping or establishing routines may feel productive and grounding.',
      'Focused work sessions with clear goals may align well with your mindset.',
    ],
    energyTips: [
      'Your energy may feel steady but more internally focused than outward.',
      'Structured routines can help you make the most of this productive phase.',
      'Balance activity with rest to maintain your energy through the phase.',
    ],
  },
  [CyclePhase.LATE_LUTEAL]: {
    suggestions: [
      'Gentle self-care rituals like skincare or a warm drink may feel comforting.',
      'Reducing social obligations where possible can help manage sensitivity.',
      'Light movement like walking or restorative yoga may ease tension.',
      'Comfort foods and familiar activities may feel more appealing than novelty.',
    ],
    energyTips: [
      'Your energy may dip — be gentle with yourself and lower expectations.',
      'Extra sleep and earlier bedtimes can support your body during this time.',
      'Saying no to non-essential commitments is a valid form of self-care.',
    ],
  },
};

export function SelfCareDisplay({ phase }: SelfCareDisplayProps) {
  const content = SELF_CARE_CONTENT[phase];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Self-Care & Energy — {PHASE_LABELS[phase]}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground">Self-Care Suggestions</h4>
            <ul className="space-y-1.5">
              {content.suggestions.map((suggestion, index) => (
                <li key={index} className="text-sm leading-relaxed">
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground">Energy Management</h4>
            <ul className="space-y-1.5">
              {content.energyTips.map((tip, index) => (
                <li key={index} className="text-sm leading-relaxed">
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
