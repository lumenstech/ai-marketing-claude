export type ExperimentOutcome = 'challenger_win' | 'control_win' | 'inconclusive';

export interface AggregateMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
}

export interface EvaluationRules {
  minImpressionsPerVariant?: number;
  minConversionsPerVariant?: number;
  confidence?: number;
  minRelativeLift?: number;
  maxRoasRegression?: number;
}

export interface ExperimentEvaluation {
  outcome: ExperimentOutcome;
  confidence: number;
  controlRate: number;
  challengerRate: number;
  relativeLift: number;
  controlRoas: number;
  challengerRoas: number;
  reasons: string[];
}

function safeRatio(n: number, d: number): number {
  return d > 0 ? n / d : 0;
}

function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = 1 - d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x >= 0 ? p : 1 - p;
}

export function evaluateExperiment(
  control: AggregateMetrics,
  challenger: AggregateMetrics,
  rules: EvaluationRules = {}
): ExperimentEvaluation {
  const minImpressions = rules.minImpressionsPerVariant ?? 1000;
  const minConversions = rules.minConversionsPerVariant ?? 5;
  const requiredConfidence = rules.confidence ?? 0.95;
  const minLift = rules.minRelativeLift ?? 0.10;
  const maxRoasRegression = rules.maxRoasRegression ?? 0.15;

  const controlRate = safeRatio(control.conversions, control.impressions);
  const challengerRate = safeRatio(challenger.conversions, challenger.impressions);
  const relativeLift = controlRate > 0 ? (challengerRate - controlRate) / controlRate : challengerRate > 0 ? 1 : 0;
  const controlRoas = safeRatio(control.revenue, control.spend);
  const challengerRoas = safeRatio(challenger.revenue, challenger.spend);

  const reasons: string[] = [];
  if (control.impressions < minImpressions || challenger.impressions < minImpressions) {
    reasons.push(`Need at least ${minImpressions} impressions per variant`);
    return { outcome: 'inconclusive', confidence: 0, controlRate, challengerRate, relativeLift, controlRoas, challengerRoas, reasons };
  }
  if (control.conversions < minConversions || challenger.conversions < minConversions) {
    reasons.push(`Need at least ${minConversions} conversions per variant`);
    return { outcome: 'inconclusive', confidence: 0, controlRate, challengerRate, relativeLift, controlRoas, challengerRoas, reasons };
  }

  const pooled = safeRatio(control.conversions + challenger.conversions, control.impressions + challenger.impressions);
  const standardError = Math.sqrt(pooled * (1 - pooled) * (1 / control.impressions + 1 / challenger.impressions));
  if (!Number.isFinite(standardError) || standardError === 0) {
    reasons.push('Insufficient variance for a credible comparison');
    return { outcome: 'inconclusive', confidence: 0, controlRate, challengerRate, relativeLift, controlRoas, challengerRoas, reasons };
  }

  const z = (challengerRate - controlRate) / standardError;
  const confidence = Math.max(0, Math.min(1, 2 * Math.abs(normalCdf(Math.abs(z)) - 0.5)));
  const roasFloor = controlRoas * (1 - maxRoasRegression);

  reasons.push(`Control conversion rate ${(controlRate * 100).toFixed(2)}%`);
  reasons.push(`Challenger conversion rate ${(challengerRate * 100).toFixed(2)}%`);
  reasons.push(`Relative lift ${(relativeLift * 100).toFixed(1)}%`);
  reasons.push(`Confidence ${(confidence * 100).toFixed(1)}%`);
  reasons.push(`Control ROAS ${controlRoas.toFixed(2)}x; challenger ROAS ${challengerRoas.toFixed(2)}x`);

  if (confidence < requiredConfidence) {
    reasons.push(`Confidence is below ${(requiredConfidence * 100).toFixed(0)}%`);
    return { outcome: 'inconclusive', confidence, controlRate, challengerRate, relativeLift, controlRoas, challengerRoas, reasons };
  }

  if (relativeLift >= minLift && (control.spend <= 0 || challengerRoas >= roasFloor)) {
    reasons.push('Challenger clears lift, confidence, and ROAS guardrails');
    return { outcome: 'challenger_win', confidence, controlRate, challengerRate, relativeLift, controlRoas, challengerRoas, reasons };
  }

  if (relativeLift <= -minLift) {
    reasons.push('Control retains a statistically credible advantage');
    return { outcome: 'control_win', confidence, controlRate, challengerRate, relativeLift, controlRoas, challengerRoas, reasons };
  }

  reasons.push('Difference is statistically credible but below the minimum practical lift');
  return { outcome: 'inconclusive', confidence, controlRate, challengerRate, relativeLift, controlRoas, challengerRoas, reasons };
}
