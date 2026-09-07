create table if not exists adf_experiment_evaluation (
  experiment_id uuid primary key references adf_experiment(id) on delete cascade,
  outcome text not null check (outcome in ('challenger_win','control_win','inconclusive')),
  confidence numeric(8,6) not null default 0,
  control_metrics jsonb not null default '{}'::jsonb,
  challenger_metrics jsonb not null default '{}'::jsonb,
  relative_lift numeric(12,6) not null default 0,
  reasons jsonb not null default '[]'::jsonb,
  evaluated_at timestamptz not null default now()
);

create index if not exists adf_experiment_state_idx on adf_experiment(state, created_at);
