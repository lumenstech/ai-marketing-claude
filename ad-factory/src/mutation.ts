import type { CreativeBrief } from './types.js';

export type MutationVariable = 'hook' | 'opening_visual' | 'persona' | 'proof' | 'cta';

export interface PlannedMutation {
  variable: MutationVariable;
  brief: CreativeBrief;
  description: string;
}

function cloneBrief(brief: CreativeBrief): CreativeBrief {
  return {
    ...brief,
    product: {
      ...brief.product,
      benefits: [...brief.product.benefits],
      painPoints: [...brief.product.painPoints],
      objections: [...brief.product.objections],
      sourceUrls: brief.product.sourceUrls ? [...brief.product.sourceUrls] : undefined,
      imageUrls: brief.product.imageUrls ? [...brief.product.imageUrls] : undefined
    },
    visualInstructions: [...brief.visualInstructions]
  };
}

function nextHook(brief: CreativeBrief): string {
  const pain = brief.product.painPoints[0];
  const benefit = brief.product.benefits[0];
  if (pain) return `If ${pain}, try this instead.`;
  if (benefit) return `A simpler way to get ${benefit}.`;
  return `See ${brief.product.name} in action before you decide.`;
}

function nextCta(current: string): string {
  const options = ['Learn More', 'Shop Now', 'Get Offer', 'Book Now', 'See How'];
  return options.find((option) => option.toLowerCase() !== current.trim().toLowerCase()) ?? 'Learn More';
}

export function planMutations(parent: CreativeBrief): PlannedMutation[] {
  const hook = cloneBrief(parent);
  hook.hook = nextHook(parent);

  const openingVisual = cloneBrief(parent);
  openingVisual.visualInstructions = [
    'Open within the first second on a tight product-in-hand or product-in-use shot; show the core use before any logo.',
    ...parent.visualInstructions
  ];

  const persona = cloneBrief(parent);
  persona.persona = `${parent.persona} comparing alternatives`;

  const proof = cloneBrief(parent);
  proof.script = `${parent.script}\n\nProof beat: show only a verified, source-backed customer quote, rating, test result, or measured outcome. If no verified proof exists, use an additional product demonstration instead.`;
  proof.visualInstructions = [
    ...parent.visualInstructions,
    'For the proof beat, use only verified source-backed evidence supplied with the product. Never invent a quote, rating, test result, customer, or performance number.'
  ];

  const cta = cloneBrief(parent);
  cta.cta = nextCta(parent.cta);

  return [
    { variable: 'hook', brief: hook, description: 'Test a new opening hook while preserving the rest of the winning creative.' },
    { variable: 'opening_visual', brief: openingVisual, description: 'Test a faster product-first opening visual while preserving copy and audience.' },
    { variable: 'persona', brief: persona, description: 'Test a comparison-minded version of the winning audience persona.' },
    { variable: 'proof', brief: proof, description: 'Test verified proof placement without inventing claims or testimonials.' },
    { variable: 'cta', brief: cta, description: 'Test an alternate call to action while preserving the creative body.' }
  ];
}
