import assert from 'node:assert/strict';
import test from 'node:test';
import { planMutations } from '../src/mutation.js';
import type { CreativeBrief } from '../src/types.js';

const base: CreativeBrief = {
  product: {
    id: 'p1',
    brandId: 'b1',
    name: 'Demo Product',
    description: 'A test product',
    benefits: ['faster setup'],
    painPoints: ['setup takes too long'],
    objections: ['too complicated']
  },
  persona: 'busy owner',
  hook: 'Old hook',
  angle: 'speed',
  platform: 'tiktok',
  durationSeconds: 20,
  cta: 'Learn More',
  script: 'Show product and explain benefit.',
  visualInstructions: ['Show the product clearly.']
};

test('plans exactly five controlled mutation dimensions', () => {
  const planned = planMutations(base);
  assert.deepEqual(planned.map((x) => x.variable), ['hook','opening_visual','persona','proof','cta']);
});

test('hook mutation changes hook but preserves core variables', () => {
  const mutation = planMutations(base).find((x) => x.variable === 'hook')!;
  assert.notEqual(mutation.brief.hook, base.hook);
  assert.equal(mutation.brief.persona, base.persona);
  assert.equal(mutation.brief.cta, base.cta);
  assert.equal(mutation.brief.script, base.script);
  assert.deepEqual(mutation.brief.visualInstructions, base.visualInstructions);
});

test('proof mutation explicitly forbids invented evidence', () => {
  const mutation = planMutations(base).find((x) => x.variable === 'proof')!;
  assert.match(mutation.brief.script, /verified, source-backed/i);
  assert.match(mutation.brief.visualInstructions.join(' '), /Never invent/i);
});

test('cta mutation changes only the CTA among copy fields', () => {
  const mutation = planMutations(base).find((x) => x.variable === 'cta')!;
  assert.notEqual(mutation.brief.cta, base.cta);
  assert.equal(mutation.brief.hook, base.hook);
  assert.equal(mutation.brief.persona, base.persona);
  assert.equal(mutation.brief.angle, base.angle);
  assert.equal(mutation.brief.script, base.script);
});
