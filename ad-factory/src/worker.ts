import { createRepository } from './db.js';
import { NanoBananaProvider } from './nano-banana.js';
import { scoreCreative } from './scoring.js';
import { persistGeneratedAsset, type ObjectBucket } from './storage.js';
import type { CreativeBrief, PerformanceMetrics } from './types.js';

interface Env {
  DATABASE_URL: string;
  AD_FACTORY_TOKEN?: string;
  GEMINI_API_KEY?: string;
  NANO_BANANA_MODEL?: string;
  ASSETS?: ObjectBucket;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}
async function body<T>(request: Request): Promise<T> { return request.json() as Promise<T>; }
function authorized(request: Request, env: Env) {
  if (!env.AD_FACTORY_TOKEN) return false;
  return request.headers.get('authorization') === `Bearer ${env.AD_FACTORY_TOKEN}`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const repo = createRepository(env.DATABASE_URL);

    if (request.method === 'GET' && url.pathname === '/health') {
      const ok = await repo.health();
      return json({ ok, service: 'ad-factory-core', capabilities: { database: ok, auth: Boolean(env.AD_FACTORY_TOKEN), imageGeneration: Boolean(env.GEMINI_API_KEY), assetStorage: Boolean(env.ASSETS) } }, ok ? 200 : 503);
    }
    if (!authorized(request, env)) return json({ error: 'unauthorized' }, 401);

    if (request.method === 'POST' && url.pathname === '/v1/brands') return json(await repo.upsertBrand(await body(request)), 201);
    if (request.method === 'POST' && url.pathname === '/v1/products') return json(await repo.upsertProduct(await body(request)), 201);
    if (request.method === 'POST' && url.pathname === '/v1/creatives') return json(await repo.createCreative(await body(request)), 201);
    if (request.method === 'POST' && url.pathname === '/v1/assets') return json(await repo.attachAsset(await body(request)), 201);

    if (request.method === 'POST' && url.pathname === '/v1/jobs') {
      const input = await body<{ idempotencyKey:string; kind:string; creativeId?:string; payload?:unknown }>(request);
      return json(await repo.createOrGetJob(input), 201);
    }

    if (request.method === 'POST' && url.pathname === '/v1/metrics') {
      const input = await body<{ publicationId:string; metrics:PerformanceMetrics; raw?:unknown }>(request);
      return json(await repo.recordMetricSnapshot(input), 201);
    }

    if (request.method === 'POST' && url.pathname === '/v1/generate/image') {
      if (!env.GEMINI_API_KEY) return json({ error: 'nano_banana_not_configured' }, 503);
      if (!env.ASSETS) return json({ error: 'asset_storage_not_configured' }, 503);
      const input = await body<{ brandId:string; brandSlug:string; productId:string; creativeId:string; brief:CreativeBrief; idempotencyKey?:string }>(request);
      const job = input.idempotencyKey ? await repo.createOrGetJob({ idempotencyKey: input.idempotencyKey, kind:'generate-image', creativeId:input.creativeId, payload:input }) : null;
      if (job && job.status === 'completed') return json(job, 200);
      try {
        const provider = new NanoBananaProvider({ apiKey: env.GEMINI_API_KEY, model: env.NANO_BANANA_MODEL });
        const generated = await provider.generateImage(input.brief);
        const stored = await persistGeneratedAsset(env.ASSETS, { brandSlug: input.brandSlug, creativeId: input.creativeId, asset: generated });
        const asset = await repo.attachAsset({ brandId:input.brandId, productId:input.productId, creativeId:input.creativeId, kind:'image', role:'source-image', provider:generated.provider, providerAssetId:generated.providerAssetId, storageKey:stored.storageKey, mimeType:generated.mimeType, metadata:{ ...generated.metadata, byteLength:stored.byteLength } });
        if (job) await repo.completeJob({ id:job.id, result:{ assetId:asset.id } });
        return json({ asset, generated:{ provider:generated.provider, mimeType:generated.mimeType } }, 201);
      } catch (error) {
        if (job) await repo.completeJob({ id:job.id, error:error instanceof Error ? error.message : 'generation_failed' });
        throw error;
      }
    }

    if (request.method === 'POST' && url.pathname === '/v1/score') {
      const input = await body<{ creativeId:string; metrics:PerformanceMetrics; generation?:number }>(request);
      const result = scoreCreative(input.creativeId, input.metrics);
      const saved = await repo.recordScore(result);
      let mutation = null;
      if (result.mutate) mutation = await repo.enqueueMutation({ creativeId:input.creativeId, reason:result.reasons.join('; '), generation:(input.generation ?? 0)+1 });
      return json({ score:saved, mutation }, 201);
    }

    return json({ error: 'not_found' }, 404);
  }
};
