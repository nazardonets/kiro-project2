import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CyclePhase } from '@/lib/types';

import { GuidancePanel, GuidancePanelData } from './guidance-panel';

// ─── Test Data ──────────────────────────────────────────────────────────────

const mockGuidanceData: GuidancePanelData = {
  guidance: {
    phase: CyclePhase.MENSTRUAL,
    supportiveActions: [
      'Consider offering a warm drink or preparing a cozy space without being asked.',
      'You might try handling a few extra household tasks to lighten her load.',
      'A gentle check-in like "Is there anything I can do for you?" may be appreciated.',
    ],
    triggersToAvoid: [
      'Pushing for social plans or high-energy activities may feel overwhelming right now.',
      'Commenting on her energy level or mood could come across as dismissive.',
    ],
    communicationStrategies: [
      'Consider using a softer, quieter tone — she may appreciate gentleness over enthusiasm.',
      'Short, caring messages like "Thinking of you" may feel more supportive than long conversations.',
    ],
    discouragedPatterns: [
      'Avoid phrases like "You should just..." which may feel dismissive of her experience.',
      'Language that minimizes her feelings, such as "It\'s not that bad," may feel invalidating.',
    ],
  },
  decisionSupport: {
    behavioralPrompts: [
      'Consider offering a warm drink or cozy blanket without being asked. Small gestures of comfort can mean a lot right now.',
      'You might keep conversations light and brief today. She may appreciate quiet companionship over active engagement.',
      'Try giving her extra space for rest without taking it personally. Her need for solitude likely reflects her energy, not your relationship.',
    ],
    situationalRecommendations: [
      {
        scenario: 'Planning an evening together',
        recommendation:
          'Consider a quiet night in with her favorite comfort food and a low-key movie.',
      },
      {
        scenario: 'Handling a disagreement',
        recommendation: 'You might gently suggest revisiting the conversation in a day or two.',
      },
    ],
  },
  phaseInfo: {
    currentPhase: CyclePhase.MENSTRUAL,
    dayInPhase: 3,
    isOverdue: false,
  },
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GuidancePanel', () => {
  it('renders the guidance panel with phase label', () => {
    render(<GuidancePanel data={mockGuidanceData} />);

    expect(screen.getByText('Guidance — Menstrual Phase')).toBeInTheDocument();
  });

  it('displays 3-5 supportive actions', () => {
    render(<GuidancePanel data={mockGuidanceData} />);

    expect(screen.getByText('Supportive Actions')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Consider offering a warm drink or preparing a cozy space without being asked.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('You might try handling a few extra household tasks to lighten her load.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'A gentle check-in like "Is there anything I can do for you?" may be appreciated.',
      ),
    ).toBeInTheDocument();
  });

  it('displays 2-4 triggers to avoid', () => {
    render(<GuidancePanel data={mockGuidanceData} />);

    expect(screen.getByText('Triggers to Avoid')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Pushing for social plans or high-energy activities may feel overwhelming right now.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Commenting on her energy level or mood could come across as dismissive.'),
    ).toBeInTheDocument();
  });

  it('displays 2-4 communication strategies', () => {
    render(<GuidancePanel data={mockGuidanceData} />);

    expect(screen.getByText('Communication Strategies')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Consider using a softer, quieter tone — she may appreciate gentleness over enthusiasm.',
      ),
    ).toBeInTheDocument();
  });

  it('displays 2-4 discouraged patterns', () => {
    render(<GuidancePanel data={mockGuidanceData} />);

    expect(screen.getByText('Discouraged Patterns')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Avoid phrases like "You should just..." which may feel dismissive of her experience.',
      ),
    ).toBeInTheDocument();
  });

  it('displays behavioral prompts in decision support section', () => {
    render(<GuidancePanel data={mockGuidanceData} />);

    expect(screen.getByText('Quick Tips')).toBeInTheDocument();
    expect(screen.getByText('Behavioral Prompts')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Consider offering a warm drink or cozy blanket without being asked. Small gestures of comfort can mean a lot right now.',
      ),
    ).toBeInTheDocument();
  });

  it('displays situational recommendations with scenario and recommendation', () => {
    render(<GuidancePanel data={mockGuidanceData} />);

    expect(screen.getByText('Situational Recommendations')).toBeInTheDocument();
    expect(screen.getByText('Planning an evening together')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Consider a quiet night in with her favorite comfort food and a low-key movie.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Handling a disagreement')).toBeInTheDocument();
  });

  it('shows overdue indicator when cycle is overdue', () => {
    const overdueData: GuidancePanelData = {
      ...mockGuidanceData,
      phaseInfo: {
        currentPhase: CyclePhase.LATE_LUTEAL,
        dayInPhase: 10,
        isOverdue: true,
      },
    };

    render(<GuidancePanel data={overdueData} />);

    expect(
      screen.getByText('Cycle may be overdue — guidance is based on the Late Luteal phase.'),
    ).toBeInTheDocument();
  });

  it('does not show overdue indicator when cycle is not overdue', () => {
    render(<GuidancePanel data={mockGuidanceData} />);

    expect(
      screen.queryByText('Cycle may be overdue — guidance is based on the Late Luteal phase.'),
    ).not.toBeInTheDocument();
  });

  it('does not render Quick Tips card when no behavioral prompts exist', () => {
    const noPromptsData: GuidancePanelData = {
      ...mockGuidanceData,
      decisionSupport: {
        behavioralPrompts: [],
        situationalRecommendations: [],
      },
    };

    render(<GuidancePanel data={noPromptsData} />);

    expect(screen.queryByText('Quick Tips')).not.toBeInTheDocument();
  });

  it('uses suggestion-oriented language in content', () => {
    render(<GuidancePanel data={mockGuidanceData} />);

    // Verify suggestion-oriented language is present
    const allText = document.body.textContent || '';
    expect(allText).toContain('Consider');
    expect(allText).toContain('You might');
    expect(allText).toContain('may');
  });

  it('renders correctly for different phases', () => {
    const follicularData: GuidancePanelData = {
      ...mockGuidanceData,
      guidance: {
        ...mockGuidanceData.guidance,
        phase: CyclePhase.FOLLICULAR,
      },
      phaseInfo: {
        currentPhase: CyclePhase.FOLLICULAR,
        dayInPhase: 5,
        isOverdue: false,
      },
    };

    render(<GuidancePanel data={follicularData} />);

    expect(screen.getByText('Guidance — Follicular Phase')).toBeInTheDocument();
  });
});
