-- Familles partagées par code (ZEN-XXXXXX). Payload JSON = état de l'app.
create table if not exists families (
  code text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
