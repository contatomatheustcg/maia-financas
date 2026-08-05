-- Migração 006: permite receita recorrente (mesmo modelo da despesa fixa)
-- Rode isso no SQL Editor do Supabase depois da migration_005.

alter table public.income
  add column if not exists recurring boolean not null default false,
  add column if not exists start_month text,
  add column if not exists received_months jsonb not null default '{}'::jsonb;
