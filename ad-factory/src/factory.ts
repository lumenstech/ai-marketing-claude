import type { CreativeBrief, ProductInput } from './types.js';
import { planCreatives, type PlanOptions } from './planner.js';

export interface FactoryRepository {
  createCreative(input: {
    brandId: string;
    productId: string;
    brief: CreativeBrief;
    parentCreativeId?: string;
    generation?: number;
  }): Promise<any>;
  createOrGetJob(input: {
    idempotencyKey: string;
    kind: string;
    creativeId?: string;
    payload?: unknown;
  }): Promise<any>;
}

export interface FactoryRunInput {
  product: ProductInput;
  brandSlug: string;
  options?: PlanOptions;
  queueImageGeneration?: boolean;
}

function safeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

export async function runFactory(repo: FactoryRepository, input: FactoryRunInput) {
  const briefs = planCreatives(input.product, input.options);
  const created: Array<{ creative: any; job: any | null }> = [];
  const queueImages = input.queueImageGeneration !== false;

  for (let index = 0; index < briefs.length; index++) {
    const brief = briefs[index];
    const creative = await repo.createCreative({
      brandId: input.product.brandId,
      productId: input.product.id,
      brief,
      generation: 0
    });

    let job = null;
    if (queueImages) {
      const idempotencyKey = [
        'adf',
        safeKey(input.brandSlug),
        input.product.id,
        creative.id,
        'source-image',
        String(index)
      ].join(':');
      job = await repo.createOrGetJob({
        idempotencyKey,
        kind: 'generate-image',
        creativeId: creative.id,
        payload: {
          brandId: input.product.brandId,
          brandSlug: input.brandSlug,
          productId: input.product.id,
          creativeId: creative.id,
          brief
        }
      });
    }

    created.push({ creative, job });
  }

  return {
    productId: input.product.id,
    brandId: input.product.brandId,
    planned: briefs.length,
    queued: created.filter((item) => item.job).length,
    creatives: created
  };
}
