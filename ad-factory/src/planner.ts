import type { CreativeBrief, Platform, ProductInput } from './types.js';

const HOOKS = [
  (p: ProductInput) => `Still dealing with ${p.painPoints[0] ?? 'the old way'}?`,
  (p: ProductInput) => `What if ${p.benefits[0] ?? p.name} took less effort?`,
  (p: ProductInput) => `Before you buy another ${p.name}, watch this.`,
  (p: ProductInput) => `The fastest way to improve ${p.benefits[0] ?? 'your result'}.`,
  (p: ProductInput) => `${p.name}: the part nobody shows you.`
];

const ANGLES = ['pain-point','direct-benefit','demo','comparison','objection'];
const CTAS = ['See how it works','Learn more','Get started','See the demo','Check availability'];

export interface PlanOptions {
  platforms?: Platform[];
  personas?: string[];
  variantsPerPersona?: number;
  durationSeconds?: number;
}

function visualInstructions(product: ProductInput, angle: string): string[] {
  const firstBenefit = product.benefits[0] ?? 'core benefit';
  const firstPain = product.painPoints[0] ?? 'common frustration';
  return [
    `Open with a native-looking vertical shot showing ${firstPain}`,
    `Introduce ${product.name} naturally within the first 5 seconds`,
    `Show a clear product-in-use demonstration focused on ${firstBenefit}`,
    angle === 'comparison' ? 'Use a neutral old-way versus new-way comparison without unsupported competitor claims' : 'Use fast visual proof through demonstration, not fabricated claims',
    'End on a clean product frame with safe text-overlay space for CTA'
  ];
}

function scriptFor(product: ProductInput, persona: string, hook: string, angle: string, cta: string): string {
  const benefit = product.benefits[0] ?? 'make the task easier';
  const pain = product.painPoints[0] ?? 'the usual hassle';
  const objection = product.objections[0];
  const objectionLine = objection ? `If you're wondering about ${objection}, show the product handling that concern directly.` : 'Show the result directly instead of making a broad claim.';
  return [
    `HOOK: ${hook}`,
    `PROBLEM: For ${persona}, ${pain} gets old fast.`,
    `DEMO: Show ${product.name} being used to ${benefit}.`,
    `PROOF: ${objectionLine}`,
    `CTA: ${cta}.`
  ].join('\n');
}

export function planCreatives(product: ProductInput, options: PlanOptions = {}): CreativeBrief[] {
  const platforms = options.platforms ?? ['tiktok','instagram','facebook'];
  const personas = options.personas?.length ? options.personas : ['primary customer'];
  const count = Math.max(1, Math.min(options.variantsPerPersona ?? 3, 10));
  const durationSeconds = options.durationSeconds ?? 20;
  const briefs: CreativeBrief[] = [];

  for (const platform of platforms) {
    for (const persona of personas) {
      for (let i = 0; i < count; i++) {
        const hook = HOOKS[i % HOOKS.length](product);
        const angle = ANGLES[i % ANGLES.length];
        const cta = CTAS[i % CTAS.length];
        briefs.push({
          product,
          persona,
          hook,
          angle,
          platform,
          durationSeconds,
          cta,
          script: scriptFor(product, persona, hook, angle, cta),
          visualInstructions: visualInstructions(product, angle)
        });
      }
    }
  }
  return briefs;
}
