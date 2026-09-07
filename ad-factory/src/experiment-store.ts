import { neon } from '@neondatabase/serverless';
import type { AggregateMetrics, ExperimentEvaluation } from './evaluation.js';

export function createExperimentStore(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return {
    async getExperiment(experimentId: string) {
      const rows = await sql`select * from adf_experiment where id=${experimentId}`;
      return rows[0] ?? null;
    },

    async getVariantMetrics(experimentId: string, variant: 'control' | 'challenger'): Promise<{ creativeId: string; metrics: AggregateMetrics } | null> {
      const creativeRows = await sql`
        select creative_id from adf_experiment_creative
        where experiment_id=${experimentId} and variant=${variant}
        limit 1
      `;
      const creativeId = creativeRows[0]?.creative_id as string | undefined;
      if (!creativeId) return null;

      const rows = await sql`
        with latest as (
          select distinct on (p.id)
            p.id as publication_id,
            coalesce(m.impressions,0)::bigint as impressions,
            coalesce(m.clicks,0)::bigint as clicks,
            coalesce(m.spend,0)::numeric as spend,
            coalesce(m.conversions,0)::numeric as conversions,
            coalesce(m.revenue,0)::numeric as revenue
          from adf_publication p
          left join adf_metric_snapshot m on m.publication_id=p.id
          where p.creative_id=${creativeId}
          order by p.id, m.captured_at desc nulls last
        )
        select
          coalesce(sum(impressions),0)::bigint as impressions,
          coalesce(sum(clicks),0)::bigint as clicks,
          coalesce(sum(spend),0)::numeric as spend,
          coalesce(sum(conversions),0)::numeric as conversions,
          coalesce(sum(revenue),0)::numeric as revenue
        from latest
      `;
      const r = rows[0];
      return {
        creativeId,
        metrics: {
          impressions: Number(r?.impressions ?? 0),
          clicks: Number(r?.clicks ?? 0),
          spend: Number(r?.spend ?? 0),
          conversions: Number(r?.conversions ?? 0),
          revenue: Number(r?.revenue ?? 0)
        }
      };
    },

    async saveEvaluation(experimentId: string, evaluation: ExperimentEvaluation, control: AggregateMetrics, challenger: AggregateMetrics) {
      const rows = await sql`
        insert into adf_experiment_evaluation (
          experiment_id,outcome,confidence,control_metrics,challenger_metrics,relative_lift,reasons,evaluated_at
        ) values (
          ${experimentId},${evaluation.outcome},${evaluation.confidence},
          ${JSON.stringify(control)}::jsonb,${JSON.stringify(challenger)}::jsonb,
          ${evaluation.relativeLift},${JSON.stringify(evaluation.reasons)}::jsonb,now()
        )
        on conflict (experiment_id) do update set
          outcome=excluded.outcome,
          confidence=excluded.confidence,
          control_metrics=excluded.control_metrics,
          challenger_metrics=excluded.challenger_metrics,
          relative_lift=excluded.relative_lift,
          reasons=excluded.reasons,
          evaluated_at=now()
        returning *
      `;
      return rows[0];
    },

    async applyOutcome(input: { experimentId:string; outcome:'challenger_win'|'control_win'|'inconclusive'; controlCreativeId:string; challengerCreativeId:string }) {
      if (input.outcome === 'challenger_win') {
        await sql`update adf_creative set status='retired' where id=${input.controlCreativeId}`;
        await sql`update adf_creative set status='approved' where id=${input.challengerCreativeId}`;
        await sql`update adf_experiment set state='completed' where id=${input.experimentId}`;
        return;
      }
      if (input.outcome === 'control_win') {
        await sql`update adf_creative set status='approved' where id=${input.controlCreativeId}`;
        await sql`update adf_creative set status='retired' where id=${input.challengerCreativeId}`;
        await sql`update adf_experiment set state='completed' where id=${input.experimentId}`;
        return;
      }
      await sql`update adf_experiment set state='running' where id=${input.experimentId}`;
    }
  };
}
