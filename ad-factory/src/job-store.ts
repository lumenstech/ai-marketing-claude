import { neon } from '@neondatabase/serverless';

export function createJobStore(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return {
    async claimNext(kind = 'generate-image') {
      const rows = await sql`
        with next as (
          select id from adf_job
          where kind=${kind}
            and (
              status='queued'
              or (status='processing' and lease_expires_at < now())
              or (status='failed' and attempts < 3)
            )
          order by created_at asc
          for update skip locked
          limit 1
        )
        update adf_job j
        set status='processing',
            attempts=j.attempts+1,
            started_at=coalesce(j.started_at,now()),
            lease_expires_at=now()+interval '5 minutes',
            error=null,
            updated_at=now()
        from next
        where j.id=next.id
        returning j.*
      `;
      return rows[0] ?? null;
    },

    async complete(id: string, result: unknown) {
      const rows = await sql`
        update adf_job
        set status='completed',result=${JSON.stringify(result)}::jsonb,error=null,lease_expires_at=null,updated_at=now()
        where id=${id}
        returning *
      `;
      return rows[0] ?? null;
    },

    async fail(id: string, error: string) {
      const rows = await sql`
        update adf_job
        set status='failed',error=${error},lease_expires_at=null,updated_at=now()
        where id=${id}
        returning *
      `;
      return rows[0] ?? null;
    },

    async markCreativeGenerated(creativeId: string) {
      await sql`update adf_creative set status='generated' where id=${creativeId} and status='draft'`;
    }
  };
}
