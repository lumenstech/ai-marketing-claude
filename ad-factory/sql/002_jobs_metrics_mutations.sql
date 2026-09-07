create table if not exists adf_job (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  kind text not null,
  status text not null default 'queued',
  creative_id uuid references adf_creative(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists adf_mutation_queue (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references adf_creative(id) on delete cascade,
  reason text not null,
  status text not null default 'queued',
  generation integer not null default 1,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (creative_id, generation)
);

create index if not exists adf_job_status_idx on adf_job(status, created_at);
create index if not exists adf_mutation_status_idx on adf_mutation_queue(status, requested_at);
