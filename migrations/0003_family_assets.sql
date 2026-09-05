-- Photos et documents du planning partagé (hors payload JSON).
create table if not exists family_assets (
  id           text primary key,
  family_code  text not null,
  mime_type    text not null default 'image/jpeg',
  data_url     text not null,
  updated_at   timestamptz not null default now()
);

create index if not exists family_assets_code_idx on family_assets (family_code);
