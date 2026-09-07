alter table adf_publication
  add column if not exists metrics_platform text,
  add column if not exists metrics_synced_at timestamptz,
  add column if not exists metrics_sync_error text;

create index if not exists adf_publication_metrics_sync_idx
  on adf_publication(metrics_platform, metrics_synced_at)
  where external_id is not null;
