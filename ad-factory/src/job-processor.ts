import { createRepository } from './db.js';
import { createJobStore } from './job-store.js';
import { NanoBananaProvider } from './nano-banana.js';
import { persistGeneratedAsset, type ObjectBucket } from './storage.js';
import type { CreativeBrief } from './types.js';

export interface GenerationEnv {
  DATABASE_URL: string;
  GEMINI_API_KEY?: string;
  NANO_BANANA_MODEL?: string;
  ASSETS?: ObjectBucket;
}

type ImagePayload = {
  brandId: string;
  brandSlug: string;
  productId: string;
  creativeId: string;
  brief: CreativeBrief;
};

export async function processImageJobs(env: GenerationEnv, limit = 5) {
  if (!env.GEMINI_API_KEY) return { processed: 0, skipped: 'nano_banana_not_configured' };
  if (!env.ASSETS) return { processed: 0, skipped: 'asset_storage_not_configured' };

  const jobs = createJobStore(env.DATABASE_URL);
  const repo = createRepository(env.DATABASE_URL);
  const provider = new NanoBananaProvider({ apiKey: env.GEMINI_API_KEY, model: env.NANO_BANANA_MODEL });
  const results: unknown[] = [];
  const count = Math.max(1, Math.min(limit, 20));

  for (let i = 0; i < count; i++) {
    const job = await jobs.claimNext('generate-image');
    if (!job) break;
    try {
      const payload = job.payload as ImagePayload;
      if (!payload?.brandId || !payload?.productId || !payload?.creativeId || !payload?.brandSlug || !payload?.brief) throw new Error('invalid_generation_payload');
      const generated = await provider.generateImage(payload.brief);
      const stored = await persistGeneratedAsset(env.ASSETS, { brandSlug: payload.brandSlug, creativeId: payload.creativeId, asset: generated });
      const asset = await repo.attachAsset({
        brandId: payload.brandId,
        productId: payload.productId,
        creativeId: payload.creativeId,
        kind: 'image',
        role: 'source-image',
        provider: generated.provider,
        providerAssetId: generated.providerAssetId,
        storageKey: stored.storageKey,
        mimeType: generated.mimeType,
        metadata: { ...generated.metadata, byteLength: stored.byteLength, jobId: job.id }
      });
      await jobs.markCreativeGenerated(payload.creativeId);
      await jobs.complete(job.id, { assetId: asset.id, creativeId: payload.creativeId });
      results.push({ jobId: job.id, creativeId: payload.creativeId, assetId: asset.id, status: 'completed' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'generation_failed';
      await jobs.fail(job.id, message);
      results.push({ jobId: job.id, status: 'failed', error: message });
    }
  }

  return { processed: results.length, results };
}
