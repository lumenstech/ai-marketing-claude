alter table adf_job
  add column if not exists attempts integer not null default 0,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists started_at timestamptz;

create index if not exists adf_job_lease_idx
  on adf_job(kind, status, lease_expires_at, created_at);
