import assert from "node:assert/strict";
import test from "node:test";
import { scoreCreative } from "../src/scoring.js";

test("marks a proven creative for mutation", () => {
  const result = scoreCreative("creative-1", {
    impressions: 5000,
    clicks: 125,
    spend: 100,
    conversions: 10,
    revenue: 500,
    videoViews3s: 2000
  });

  assert.equal(result.mutate, true);
  assert.ok(result.score >= 65);
});

test("does not mutate before sufficient impressions", () => {
  const result = scoreCreative("creative-2", {
    impressions: 500,
    clicks: 50,
    spend: 10,
    conversions: 5,
    revenue: 100,
    videoViews3s: 250
  });

  assert.equal(result.mutate, false);
});
