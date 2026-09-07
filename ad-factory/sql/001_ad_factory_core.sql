create extension if not exists pgcrypto;

create table if not exists adf_brand (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  voice jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists adf_product (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references adf_brand(id) on delete cascade,
  external_key text,
  name text not null,
  description text not null default '',
  benefits jsonb not null default '[]'::jsonb,
  pain_points jsonb not null default '[]'::jsonb,
  objections jsonb not null default '[]'::jsonb,
  offer jsonb not null default '{}'::jsonb,
  source jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, external_key)
);

create table if not exists adf_asset (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references adf_brand(id) on delete cascade,
  product_id uuid references adf_product(id) on delete set null,
  kind text not null check (kind in ('image','video','audio','thumbnail','caption')),
  provider text,
  provider_asset_id text,
  storage_key text,
  mime_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists adf_creative (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references adf_brand(id) on delete cascade,
  product_id uuid not null references adf_product(id) on delete cascade,
  parent_creative_id uuid references adf_creative(id) on delete set null,
  platform text not null,
  persona text not null,
  hook text not null,
  angle text not null,
  cta text not null,
  script text not null,
  brief jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  generation integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists adf_creative_asset (
  creative_id uuid not null references adf_creative(id) on delete cascade,
  asset_id uuid not null references adf_asset(id) on delete cascade,
  role text not null,
  primary key (creative_id, asset_id, role)
);

create table if not exists adf_publication (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references adf_creative(id) on delete cascade,
  platform text not null,
  external_id text,
  external_url text,
  status text not null default 'pending',
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists adf_metric_snapshot (
  id bigserial primary key,
  publication_id uuid not null references adf_publication(id) on delete cascade,
  captured_at timestamptz not null default now(),
  impressions bigint,
  clicks bigint,
  spend numeric(14,4),
  conversions numeric(14,4),
  revenue numeric(14,4),
  views_3s bigint,
  views_25pct bigint,
  views_50pct bigint,
  views_75pct bigint,
  views_95pct bigint,
  raw jsonb not null default '{}'::jsonb
);

create table if not exists adf_experiment (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references adf_brand(id) on delete cascade,
  name text not null,
  hypothesis text not null,
  variable text not null,
  state text not null default 'draft',
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists adf_experiment_creative (
  experiment_id uuid not null references adf_experiment(id) on delete cascade,
  creative_id uuid not null references adf_creative(id) on delete cascade,
  variant text not null,
  primary key (experiment_id, creative_id)
);

create table if not exists adf_creative_score (
  creative_id uuid primary key references adf_creative(id) on delete cascade,
  score numeric(8,4) not null,
  reasons jsonb not null default '[]'::jsonb,
  mutate boolean not null default false,
  scored_at timestamptz not null default now()
);

create index if not exists adf_creative_product_idx on adf_creative(product_id, created_at desc);
create index if not exists adf_publication_creative_idx on adf_publication(creative_id, created_at desc);
create index if not exists adf_metric_publication_idx on adf_metric_snapshot(publication_id, captured_at desc);
