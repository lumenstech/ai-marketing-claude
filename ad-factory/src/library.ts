import { neon } from '@neondatabase/serverless';

export function createCreativeLibrary(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return {
    async list(input: { brandId?:string; productId?:string; status?:string; limit?:number } = {}) {
      const limit = Math.max(1, Math.min(input.limit ?? 50, 200));
      const rows = await sql`
        select
          c.id,c.brand_id,c.product_id,c.parent_creative_id,c.platform,c.persona,c.hook,c.angle,c.cta,c.script,c.brief,c.status,c.generation,c.created_at,
          coalesce(jsonb_agg(jsonb_build_object(
            'id',a.id,'kind',a.kind,'role',ca.role,'provider',a.provider,'storageKey',a.storage_key,'mimeType',a.mime_type,'metadata',a.metadata
          )) filter (where a.id is not null),'[]'::jsonb) as assets
        from adf_creative c
        left join adf_creative_asset ca on ca.creative_id=c.id
        left join adf_asset a on a.id=ca.asset_id
        where (${input.brandId ?? null}::uuid is null or c.brand_id=${input.brandId ?? null})
          and (${input.productId ?? null}::uuid is null or c.product_id=${input.productId ?? null})
          and (${input.status ?? null}::text is null or c.status=${input.status ?? null})
        group by c.id
        order by c.created_at desc
        limit ${limit}
      `;
      return rows;
    },

    async get(creativeId: string) {
      const rows = await sql`
        select
          c.*,
          coalesce(jsonb_agg(jsonb_build_object(
            'id',a.id,'kind',a.kind,'role',ca.role,'provider',a.provider,'storageKey',a.storage_key,'mimeType',a.mime_type,'metadata',a.metadata
          )) filter (where a.id is not null),'[]'::jsonb) as assets
        from adf_creative c
        left join adf_creative_asset ca on ca.creative_id=c.id
        left join adf_asset a on a.id=ca.asset_id
        where c.id=${creativeId}
        group by c.id
      `;
      return rows[0] ?? null;
    }
  };
}
