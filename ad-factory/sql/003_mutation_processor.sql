alter table adf_mutation_queue
  add column if not exists attempts integer not null default 0,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists last_error text;

create table if not exists adf_mutation_variant (
  queue_id uuid not null references adf_mutation_queue(id) on delete cascade,
  variable text not null check (variable in ('hook','opening_visual','persona','proof','cta')),
  experiment_id uuid not null references adf_experiment(id) on delete cascade,
  child_creative_id uuid not null references adf_creative(id) on delete cascade,
  mutation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (queue_id, variable)
);

create index if not exists adf_mutation_variant_child_idx on adf_mutation_variant(child_creative_id);
create index if not exists adf_mutation_lease_idx on adf_mutation_queue(status, lease_expires_at, requested_at);
