import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateExperiment } from '../src/evaluation.js';

const control = { impressions: 5000, clicks: 150, spend: 500, conversions: 50, revenue: 2000 };

test('promotes a statistically credible challenger with practical lift', () => {
  const result = evaluateExperiment(control, {
    impressions: 5000,
    clicks: 180,
    spend: 510,
    conversions: 70,
    revenue: 2600
  });
  assert.equal(result.outcome, 'challenger_win');
  assert.ok(result.confidence >= 0.95);
});

test('keeps experiment inconclusive without enough evidence', () => {
  const result = evaluateExperiment(
    { impressions: 600, clicks: 20, spend: 50, conversions: 4, revenue: 100 },
    { impressions: 600, clicks: 22, spend: 50, conversions: 5, revenue: 110 }
  );
  assert.equal(result.outcome, 'inconclusive');
});

test('retains control when challenger materially loses', () => {
  const result = evaluateExperiment(control, {
    impressions: 5000,
    clicks: 120,
    spend: 480,
    conversions: 30,
    revenue: 1100
  });
  assert.equal(result.outcome, 'control_win');
});
