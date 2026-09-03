-- Family Peps schema
-- Run this in Supabase SQL Editor

create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text,
  created_at timestamptz default now()
);

-- Enable realtime if needed
-- alter publication supabase_realtime add table families;
