import { neon } from '@neondatabase/serverless';
import type { CreativeBrief } from './types.js';

export interface DatabaseEnv {
  DATABASE_URL: string;
}

export function createRepository(databaseUrl: string) {
  const sql = neon(databaseUrl);

  return {
    async health() {
      const rows = await sql`select 1 as ok`;
      return rows[0]?.ok === 1;
    },

    async upsertBrand(input: { slug: string; name: string; voice?: unknown }) {
      const rows = await sql`
        insert into adf_brand (slug, name, voice)
        values (${input.slug}, ${input.name}, ${JSON.stringify(input.voice ?? {})}::jsonb)
        on conflict (slug) do update set
          name = excluded.name,
          voice = excluded.voice
        returning id, slug, name, voice, created_at
      `;
      return rows[0];
    },

    async upsertProduct(input: {
      brandId: string;
      externalKey?: string;
      name: string;
      description?: string;
      benefits?: string[];
      painPoints?: string[];
      objections?: string[];
      offer?: unknown;
      source?: unknown;
    }) {
      const rows = await sql`
        insert into adf_product (
          brand_id, external_key, name, description, benefits,
          pain_points, objections, offer, source
        ) values (
          ${input.brandId}, ${input.externalKey ?? null}, ${input.name},
          ${input.description ?? ''}, ${JSON.stringify(input.benefits ?? [])}::jsonb,
          ${JSON.stringify(input.painPoints ?? [])}::jsonb,
          ${JSON.stringify(input.objections ?? [])}::jsonb,
          ${JSON.stringify(input.offer ?? {})}::jsonb,
          ${JSON.stringify(input.source ?? {})}::jsonb
        )
        on conflict (brand_id, external_key) do update set
          name = excluded.name,
          description = excluded.description,
          benefits = excluded.benefits,
          pain_points = excluded.pain_points,
          objections = excluded.objections,
          offer = excluded.offer,
          source = excluded.source,
          updated_at = now()
        returning *
      `;
      return rows[0];
    },

    async createCreative(input: {
      brandId: string;
      productId: string;
      brief: CreativeBrief;
      parentCreativeId?: string;
      generation?: number;
    }) {
      const b = input.brief;
      const rows = await sql`
        insert into adf_creative (
          brand_id, product_id, parent_creative_id, platform, persona,
          hook, angle, cta, script, brief, generation
        ) values (
          ${input.brandId}, ${input.productId}, ${input.parentCreativeId ?? null},
          ${b.platform}, ${b.persona}, ${b.hook}, ${b.angle}, ${b.cta},
          ${b.script}, ${JSON.stringify(b)}::jsonb, ${input.generation ?? 0}
        ) returning *
      `;
      return rows[0];
    },

    async attachAsset(input: {
      brandId: string;
      productId?: string;
      creativeId?: string;
      kind: 'image' | 'video' | 'audio' | 'thumbnail' | 'caption';
      role?: string;
      provider?: string;
      providerAssetId?: string;
      storageKey?: string;
      mimeType?: string;
      metadata?: unknown;
    }) {
      const rows = await sql`
        insert into adf_asset (
          brand_id, product_id, kind, provider, provider_asset_id,
          storage_key, mime_type, metadata
        ) values (
          ${input.brandId}, ${input.productId ?? null}, ${input.kind},
          ${input.provider ?? null}, ${input.providerAssetId ?? null},
          ${input.storageKey ?? null}, ${input.mimeType ?? null},
          ${JSON.stringify(input.metadata ?? {})}::jsonb
        ) returning *
      `;
      const asset = rows[0];
      if (input.creativeId && input.role) {
        await sql`
          insert into adf_creative_asset (creative_id, asset_id, role)
          values (${input.creativeId}, ${asset.id}, ${input.role})
          on conflict do nothing
        `;
      }
      return asset;
    },

    async recordScore(input: { creativeId: string; score: number; reasons: string[]; mutate: boolean }) {
      const rows = await sql`
        insert into adf_creative_score (creative_id, score, reasons, mutate, scored_at)
        values (${input.creativeId}, ${input.score}, ${JSON.stringify(input.reasons)}::jsonb, ${input.mutate}, now())
        on conflict (creative_id) do update set
          score = excluded.score,
          reasons = excluded.reasons,
          mutate = excluded.mutate,
          scored_at = now()
        returning *
      `;
      return rows[0];
    }
  };
}
