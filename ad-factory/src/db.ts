import { neon } from '@neondatabase/serverless';
import type { CreativeBrief, PerformanceMetrics } from './types.js';
import type { PlannedMutation } from './mutation.js';

export function createRepository(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return {
    async health() { const rows = await sql`select 1 as ok`; return rows[0]?.ok === 1; },
    async upsertBrand(input: { slug: string; name: string; voice?: unknown }) {
      const rows = await sql`insert into adf_brand (slug,name,voice) values (${input.slug},${input.name},${JSON.stringify(input.voice ?? {})}::jsonb) on conflict (slug) do update set name=excluded.name, voice=excluded.voice returning *`;
      return rows[0];
    },
    async upsertProduct(input: { brandId:string; externalKey?:string; name:string; description?:string; benefits?:string[]; painPoints?:string[]; objections?:string[]; offer?:unknown; source?:unknown }) {
      const rows = await sql`insert into adf_product (brand_id,external_key,name,description,benefits,pain_points,objections,offer,source) values (${input.brandId},${input.externalKey ?? null},${input.name},${input.description ?? ''},${JSON.stringify(input.benefits ?? [])}::jsonb,${JSON.stringify(input.painPoints ?? [])}::jsonb,${JSON.stringify(input.objections ?? [])}::jsonb,${JSON.stringify(input.offer ?? {})}::jsonb,${JSON.stringify(input.source ?? {})}::jsonb) on conflict (brand_id,external_key) do update set name=excluded.name,description=excluded.description,benefits=excluded.benefits,pain_points=excluded.pain_points,objections=excluded.objections,offer=excluded.offer,source=excluded.source,updated_at=now() returning *`;
      return rows[0];
    },
    async createCreative(input: { brandId:string; productId:string; brief:CreativeBrief; parentCreativeId?:string; generation?:number }) {
      const b=input.brief;
      const rows=await sql`insert into adf_creative (brand_id,product_id,parent_creative_id,platform,persona,hook,angle,cta,script,brief,generation) values (${input.brandId},${input.productId},${input.parentCreativeId ?? null},${b.platform},${b.persona},${b.hook},${b.angle},${b.cta},${b.script},${JSON.stringify(b)}::jsonb,${input.generation ?? 0}) returning *`;
      return rows[0];
    },
    async getCreative(id:string) {
      const rows=await sql`select * from adf_creative where id=${id}`;
      return rows[0] ?? null;
    },
    async attachAsset(input:{brandId:string;productId?:string;creativeId?:string;kind:'image'|'video'|'audio'|'thumbnail'|'caption';role?:string;provider?:string;providerAssetId?:string;storageKey?:string;mimeType?:string;metadata?:unknown}) {
      const rows=await sql`insert into adf_asset (brand_id,product_id,kind,provider,provider_asset_id,storage_key,mime_type,metadata) values (${input.brandId},${input.productId ?? null},${input.kind},${input.provider ?? null},${input.providerAssetId ?? null},${input.storageKey ?? null},${input.mimeType ?? null},${JSON.stringify(input.metadata ?? {})}::jsonb) returning *`;
      const asset=rows[0];
      if(input.creativeId && input.role) await sql`insert into adf_creative_asset (creative_id,asset_id,role) values (${input.creativeId},${asset.id},${input.role}) on conflict do nothing`;
      return asset;
    },
    async recordScore(input:{creativeId:string;score:number;reasons:string[];mutate:boolean}) {
      const rows=await sql`insert into adf_creative_score (creative_id,score,reasons,mutate,scored_at) values (${input.creativeId},${input.score},${JSON.stringify(input.reasons)}::jsonb,${input.mutate},now()) on conflict (creative_id) do update set score=excluded.score,reasons=excluded.reasons,mutate=excluded.mutate,scored_at=now() returning *`;
      return rows[0];
    },
    async recordMetricSnapshot(input:{publicationId:string;metrics:PerformanceMetrics;raw?:unknown}) {
      const m=input.metrics;
      const rows=await sql`insert into adf_metric_snapshot (publication_id,impressions,clicks,spend,conversions,revenue,views_3s,views_25pct,views_50pct,views_75pct,views_95pct,raw) values (${input.publicationId},${m.impressions ?? null},${m.clicks ?? null},${m.spend ?? null},${m.conversions ?? null},${m.revenue ?? null},${m.videoViews3s ?? null},${m.videoViews25Pct ?? null},${m.videoViews50Pct ?? null},${m.videoViews75Pct ?? null},${m.videoViews95Pct ?? null},${JSON.stringify(input.raw ?? {})}::jsonb) returning *`;
      return rows[0];
    },
    async createOrGetJob(input:{idempotencyKey:string;kind:string;creativeId?:string;payload?:unknown}) {
      const rows=await sql`insert into adf_job (idempotency_key,kind,creative_id,payload) values (${input.idempotencyKey},${input.kind},${input.creativeId ?? null},${JSON.stringify(input.payload ?? {})}::jsonb) on conflict (idempotency_key) do update set idempotency_key=excluded.idempotency_key returning *`;
      return rows[0];
    },
    async completeJob(input:{id:string;result?:unknown;error?:string}) {
      const status=input.error ? 'failed':'completed';
      const rows=await sql`update adf_job set status=${status},result=${JSON.stringify(input.result ?? {})}::jsonb,error=${input.error ?? null},updated_at=now() where id=${input.id} returning *`;
      return rows[0];
    },
    async enqueueMutation(input:{creativeId:string;reason:string;generation:number}) {
      const rows=await sql`insert into adf_mutation_queue (creative_id,reason,generation) values (${input.creativeId},${input.reason},${input.generation}) on conflict (creative_id,generation) do update set reason=excluded.reason returning *`;
      return rows[0];
    },
    async claimNextMutation() {
      const rows=await sql`
        with next as (
          select id from adf_mutation_queue
          where status='queued' or (status='processing' and lease_expires_at < now())
          order by requested_at asc
          for update skip locked
          limit 1
        )
        update adf_mutation_queue q
        set status='processing', attempts=q.attempts+1, lease_expires_at=now()+interval '5 minutes', last_error=null
        from next
        where q.id=next.id
        returning q.*
      `;
      return rows[0] ?? null;
    },
    async createMutationExperiment(input:{queueId:string;parentCreative:any;generation:number;mutation:PlannedMutation}) {
      const existing=await sql`select mv.*, c.* from adf_mutation_variant mv join adf_creative c on c.id=mv.child_creative_id where mv.queue_id=${input.queueId} and mv.variable=${input.mutation.variable}`;
      if(existing[0]) return existing[0];
      const expRows=await sql`insert into adf_experiment (brand_id,name,hypothesis,variable,state,rules) values (${input.parentCreative.brand_id},${`Generation ${input.generation}: ${input.mutation.variable}`},${input.mutation.description},${input.mutation.variable},'draft',${JSON.stringify({ parentCreativeId:input.parentCreative.id,generation:input.generation,oneVariableAtATime:true })}::jsonb) returning *`;
      const experiment=expRows[0];
      await sql`insert into adf_experiment_creative (experiment_id,creative_id,variant) values (${experiment.id},${input.parentCreative.id},'control') on conflict do nothing`;
      const childRows=await sql`insert into adf_creative (brand_id,product_id,parent_creative_id,platform,persona,hook,angle,cta,script,brief,status,generation) values (${input.parentCreative.brand_id},${input.parentCreative.product_id},${input.parentCreative.id},${input.mutation.brief.platform},${input.mutation.brief.persona},${input.mutation.brief.hook},${input.mutation.brief.angle},${input.mutation.brief.cta},${input.mutation.brief.script},${JSON.stringify(input.mutation.brief)}::jsonb,'draft',${input.generation}) returning *`;
      const child=childRows[0];
      await sql`insert into adf_experiment_creative (experiment_id,creative_id,variant) values (${experiment.id},${child.id},'challenger')`;
      await sql`insert into adf_mutation_variant (queue_id,variable,experiment_id,child_creative_id,mutation) values (${input.queueId},${input.mutation.variable},${experiment.id},${child.id},${JSON.stringify({description:input.mutation.description})}::jsonb)`;
      return { experiment, child, variable:input.mutation.variable };
    },
    async completeMutation(input:{queueId:string;error?:string}) {
      const rows=await sql`update adf_mutation_queue set status=${input.error ? 'failed':'completed'}, processed_at=${input.error ? null : new Date().toISOString()}, lease_expires_at=null, last_error=${input.error ?? null} where id=${input.queueId} returning *`;
      return rows[0];
    }
  };
}
