import type { GeneratedAsset } from './types.js';

export interface ObjectBucket {
  put(key: string, value: ArrayBuffer | Uint8Array | string, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<unknown>;
}

export async function persistGeneratedAsset(bucket: ObjectBucket, input: {
  brandSlug: string;
  creativeId: string;
  asset: GeneratedAsset;
}): Promise<{ storageKey: string; byteLength: number }> {
  if (!input.asset.bytesBase64) throw new Error('Generated asset has no inline bytes to persist');

  const bytes = Uint8Array.from(atob(input.asset.bytesBase64), c => c.charCodeAt(0));
  const ext = input.asset.mimeType.includes('jpeg') ? 'jpg' : input.asset.mimeType.includes('webp') ? 'webp' : input.asset.mimeType.includes('mp4') ? 'mp4' : 'png';
  const key = `${input.brandSlug}/creatives/${input.creativeId}/${crypto.randomUUID()}.${ext}`;

  await bucket.put(key, bytes, {
    httpMetadata: { contentType: input.asset.mimeType },
    customMetadata: { provider: input.asset.provider, kind: input.asset.kind }
  });

  return { storageKey: key, byteLength: bytes.byteLength };
}
