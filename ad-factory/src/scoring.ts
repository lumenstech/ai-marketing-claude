import type { CreativeScore, PerformanceMetrics } from "./types.js";

function ratio(n?: number, d?: number): number {
  if (!n || !d || d <= 0) return 0;
  return n / d;
}

export function scoreCreative(
  creativeId: string,
  metrics: PerformanceMetrics,
  targets: { ctr?: number; cvr?: number; roas?: number; hookRate?: number } = {}
): CreativeScore {
  const ctr = ratio(metrics.clicks, metrics.impressions);
  const cvr = ratio(metrics.conversions, metrics.clicks);
  const roas = ratio(metrics.revenue, metrics.spend);
  const hookRate = ratio(metrics.videoViews3s, metrics.impressions);

  const ctrTarget = targets.ctr ?? 0.01;
  const cvrTarget = targets.cvr ?? 0.02;
  const roasTarget = targets.roas ?? 2;
  const hookTarget = targets.hookRate ?? 0.25;

  const components = [
    Math.min(2, ctr / ctrTarget),
    Math.min(2, cvr / cvrTarget),
    Math.min(2, roas / roasTarget),
    Math.min(2, hookRate / hookTarget)
  ];

  const score = Math.round((components.reduce((a, b) => a + b, 0) / components.length) * 50 * 100) / 100;
  const reasons = [
    `CTR ${(ctr * 100).toFixed(2)}%`,
    `CVR ${(cvr * 100).toFixed(2)}%`,
    `ROAS ${roas.toFixed(2)}x`,
    `3s hook rate ${(hookRate * 100).toFixed(2)}%`
  ];

  return {
    creativeId,
    score,
    reasons,
    mutate: score >= 65 && (metrics.impressions ?? 0) >= 1000
  };
}
