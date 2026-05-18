import { DEFAULT_PHASE_DURATIONS, DEFAULT_CYCLE_LENGTH, PREDICTION_DAYS } from '@/lib/constants';
import { CyclePhase, PhaseCustomization } from '@/lib/types';

/** Standard phase durations as an ordered array (menstrual, follicular, ovulation, earlyLuteal, lateLuteal) */
const STANDARD_DURATIONS = [5, 8, 1, 7, 7] as const;

/**
 * Result of a phase calculation.
 */
export interface PhaseCalculationResult {
  /** The current cycle phase */
  phase: CyclePhase;
  /** The day number within the current phase (1-based) */
  dayInPhase: number;
  /** Whether the cycle has exceeded its expected length */
  isOverdue: boolean;
  /** The total cycle length used for calculation */
  totalCycleLength: number;
  /** The total number of elapsed days since cycle start (1-based) */
  elapsedDays: number;
}

/**
 * Custom phase durations input. Each value represents the number of days
 * for that phase (must be between 1 and 14).
 */
export interface PhaseDurations {
  menstrual: number;
  follicular: number;
  ovulation: number;
  earlyLuteal: number;
  lateLuteal: number;
}

/** Ordered list of phases for iteration */
const PHASE_ORDER: CyclePhase[] = [
  CyclePhase.MENSTRUAL,
  CyclePhase.FOLLICULAR,
  CyclePhase.OVULATION,
  CyclePhase.EARLY_LUTEAL,
  CyclePhase.LATE_LUTEAL,
];

/**
 * Converts a PhaseCustomization record to PhaseDurations.
 */
export function customizationToDurations(
  customization: Pick<
    PhaseCustomization,
    | 'menstrual_days'
    | 'follicular_days'
    | 'ovulation_days'
    | 'early_luteal_days'
    | 'late_luteal_days'
  >,
): PhaseDurations {
  return {
    menstrual: customization.menstrual_days,
    follicular: customization.follicular_days,
    ovulation: customization.ovulation_days,
    earlyLuteal: customization.early_luteal_days,
    lateLuteal: customization.late_luteal_days,
  };
}

/**
 * Gets the ordered array of phase durations from either custom durations
 * or the standard defaults.
 */
function getOrderedDurations(customDurations?: PhaseDurations): number[] {
  if (customDurations) {
    return [
      customDurations.menstrual,
      customDurations.follicular,
      customDurations.ovulation,
      customDurations.earlyLuteal,
      customDurations.lateLuteal,
    ];
  }

  return PHASE_ORDER.map((phase) => DEFAULT_PHASE_DURATIONS[phase]);
}

/**
 * Calculates the number of days elapsed since the cycle start date.
 * Day 1 is the start date itself.
 */
export function calculateElapsedDays(startDate: Date, currentDate: Date): number {
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const current = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
  );

  const diffMs = current.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Day 1 is the start date itself
  return diffDays + 1;
}

/**
 * Calculates the current cycle phase based on elapsed days and phase durations.
 *
 * Standard phase boundaries (28-day cycle):
 * - Menstrual: Days 1-5
 * - Follicular: Days 6-13
 * - Ovulation: Day 14
 * - Early Luteal: Days 15-21
 * - Late Luteal: Days 22-28
 *
 * When elapsed days exceed the total cycle length, returns Late Luteal
 * with an overdue indicator.
 *
 * @param startDate - The start date of the current cycle
 * @param currentDate - The date to calculate the phase for (defaults to today)
 * @param customDurations - Optional custom phase durations
 * @returns The phase calculation result
 */
export function calculateCurrentPhase(
  startDate: Date,
  currentDate: Date = new Date(),
  customDurations?: PhaseDurations,
): PhaseCalculationResult {
  const elapsedDays = calculateElapsedDays(startDate, currentDate);
  return calculatePhaseFromElapsedDays(elapsedDays, customDurations);
}

/**
 * Calculates the current cycle phase from a given number of elapsed days.
 * This is the core calculation function that can be used independently
 * of date arithmetic.
 *
 * @param elapsedDays - Number of days elapsed (1-based, day 1 = start date)
 * @param customDurations - Optional custom phase durations
 * @returns The phase calculation result
 */
export function calculatePhaseFromElapsedDays(
  elapsedDays: number,
  customDurations?: PhaseDurations,
): PhaseCalculationResult {
  const durations = getOrderedDurations(customDurations);
  const totalCycleLength = durations.reduce((sum, d) => sum + d, 0);

  // Handle overdue cycles
  if (elapsedDays > totalCycleLength) {
    const lastPhaseDuration = durations[durations.length - 1];
    // Calculate how many days into the "overdue" period
    // The last phase starts at (totalCycleLength - lastPhaseDuration + 1)
    const lastPhaseStart = totalCycleLength - lastPhaseDuration + 1;
    const dayInPhase = elapsedDays - lastPhaseStart + 1;

    return {
      phase: CyclePhase.LATE_LUTEAL,
      dayInPhase,
      isOverdue: true,
      totalCycleLength,
      elapsedDays,
    };
  }

  // Find the current phase based on elapsed days
  let dayCounter = 0;
  for (let i = 0; i < PHASE_ORDER.length; i++) {
    const phaseDuration = durations[i];
    if (elapsedDays <= dayCounter + phaseDuration) {
      return {
        phase: PHASE_ORDER[i],
        dayInPhase: elapsedDays - dayCounter,
        isOverdue: false,
        totalCycleLength,
        elapsedDays,
      };
    }
    dayCounter += phaseDuration;
  }

  // Fallback (should not reach here with valid input)
  return {
    phase: CyclePhase.LATE_LUTEAL,
    dayInPhase: elapsedDays - (totalCycleLength - durations[durations.length - 1]),
    isOverdue: true,
    totalCycleLength,
    elapsedDays,
  };
}

/**
 * Calculates the average cycle length from an array of historical cycle lengths.
 * Requires at least 2 entries to produce a meaningful average.
 *
 * @param cycleLengths - Array of cycle lengths in days (must have 2+ entries)
 * @returns The average cycle length rounded to the nearest integer
 * @throws Error if fewer than 2 cycle lengths are provided
 */
export function calculateAverageCycleLength(cycleLengths: number[]): number {
  if (cycleLengths.length < 2) {
    throw new Error('At least 2 historical cycle records are required to calculate average');
  }

  const sum = cycleLengths.reduce((acc, len) => acc + len, 0);
  return Math.round(sum / cycleLengths.length);
}

/**
 * Proportionally scales each standard phase duration relative to the 28-day default
 * based on the given average cycle length.
 *
 * Uses integer rounding for each phase, then adjusts the last phase (lateLuteal)
 * to ensure the sum equals exactly the average cycle length.
 *
 * @param averageCycleLength - The calculated average cycle length
 * @returns PhaseDurations with scaled values that sum exactly to averageCycleLength
 */
export function scalePhaseDurations(averageCycleLength: number): PhaseDurations {
  const scaleFactor = averageCycleLength / DEFAULT_CYCLE_LENGTH;

  // Scale each phase proportionally with rounding
  const menstrual = Math.round(STANDARD_DURATIONS[0] * scaleFactor);
  const follicular = Math.round(STANDARD_DURATIONS[1] * scaleFactor);
  const ovulation = Math.round(STANDARD_DURATIONS[2] * scaleFactor);
  const earlyLuteal = Math.round(STANDARD_DURATIONS[3] * scaleFactor);

  // Adjust lateLuteal to ensure the sum equals exactly the average cycle length
  const lateLuteal = averageCycleLength - (menstrual + follicular + ovulation + earlyLuteal);

  return {
    menstrual,
    follicular,
    ovulation,
    earlyLuteal,
    lateLuteal,
  };
}

/**
 * A predicted phase within the 60-day prediction window.
 */
export interface PhasePrediction {
  /** The cycle phase */
  phase: CyclePhase;
  /** Start date of this prediction segment */
  startDate: Date;
  /** End date of this prediction segment */
  endDate: Date;
  /** Day number from prediction start (1-based) */
  startDay: number;
  /** Day number from prediction start (1-based) */
  endDay: number;
}

/**
 * Adds a number of days to a date, returning a new Date object.
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Generates phase predictions for exactly 60 days from the current date.
 *
 * The function calculates where in the cycle the current date falls (based on
 * the startDate of the most recent cycle), then generates predictions forward
 * for PREDICTION_DAYS (60) days.
 *
 * Priority for durations:
 * 1. customDurations (if provided)
 * 2. Scaled durations from historicalCycleLengths (if 2+ records)
 * 3. Standard 28-day durations (default)
 *
 * @param startDate - The start date of the most recent cycle
 * @param currentDate - The date from which to generate 60 days of predictions
 * @param options - Optional custom durations or historical cycle lengths
 * @returns Array of PhasePrediction objects covering exactly 60 days with no gaps or overlaps
 */
export function generatePredictions(
  startDate: Date,
  currentDate: Date,
  options?: { customDurations?: PhaseDurations; historicalCycleLengths?: number[] },
): PhasePrediction[] {
  // Determine which durations to use
  let durations: PhaseDurations;

  if (options?.customDurations) {
    durations = options.customDurations;
  } else if (options?.historicalCycleLengths && options.historicalCycleLengths.length >= 2) {
    const avgLength = calculateAverageCycleLength(options.historicalCycleLengths);
    durations = scalePhaseDurations(avgLength);
  } else {
    // Standard 28-day durations
    durations = {
      menstrual: DEFAULT_PHASE_DURATIONS[CyclePhase.MENSTRUAL],
      follicular: DEFAULT_PHASE_DURATIONS[CyclePhase.FOLLICULAR],
      ovulation: DEFAULT_PHASE_DURATIONS[CyclePhase.OVULATION],
      earlyLuteal: DEFAULT_PHASE_DURATIONS[CyclePhase.EARLY_LUTEAL],
      lateLuteal: DEFAULT_PHASE_DURATIONS[CyclePhase.LATE_LUTEAL],
    };
  }

  const orderedDurations = [
    durations.menstrual,
    durations.follicular,
    durations.ovulation,
    durations.earlyLuteal,
    durations.lateLuteal,
  ];
  const totalCycleLength = orderedDurations.reduce((sum, d) => sum + d, 0);

  // Calculate elapsed days from cycle start to current date
  const elapsedDays = calculateElapsedDays(startDate, currentDate);

  // Determine position within the cycle (wrapping for overdue cycles)
  // Use modulo to find position within repeating cycles
  const positionInCycle = ((elapsedDays - 1) % totalCycleLength) + 1;

  // Find which phase and how many days remain in that phase
  let dayCounter = 0;
  let currentPhaseIndex = 0;
  let daysRemainingInPhase = 0;

  for (let i = 0; i < PHASE_ORDER.length; i++) {
    if (positionInCycle <= dayCounter + orderedDurations[i]) {
      currentPhaseIndex = i;
      daysRemainingInPhase = dayCounter + orderedDurations[i] - positionInCycle + 1;
      break;
    }
    dayCounter += orderedDurations[i];
  }

  // Generate predictions for exactly PREDICTION_DAYS days
  const predictions: PhasePrediction[] = [];
  let daysCovered = 0;
  let phaseIndex = currentPhaseIndex;
  let remainingInCurrentPhase = daysRemainingInPhase;

  // Normalize currentDate to midnight
  const predictionStart = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
  );

  while (daysCovered < PREDICTION_DAYS) {
    const daysToAdd = Math.min(remainingInCurrentPhase, PREDICTION_DAYS - daysCovered);

    const segmentStartDay = daysCovered + 1;
    const segmentEndDay = daysCovered + daysToAdd;
    const segmentStartDate = addDays(predictionStart, daysCovered);
    const segmentEndDate = addDays(predictionStart, daysCovered + daysToAdd - 1);

    predictions.push({
      phase: PHASE_ORDER[phaseIndex],
      startDate: segmentStartDate,
      endDate: segmentEndDate,
      startDay: segmentStartDay,
      endDay: segmentEndDay,
    });

    daysCovered += daysToAdd;

    // Move to next phase (wrapping around)
    phaseIndex = (phaseIndex + 1) % PHASE_ORDER.length;
    remainingInCurrentPhase = orderedDurations[phaseIndex];
  }

  return predictions;
}
