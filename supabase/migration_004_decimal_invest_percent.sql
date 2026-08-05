-- Migração 004: permite percentual de investimento fracionado
-- Rode isso no SQL Editor do Supabase depois da migration_003.

alter table public.settings
  alter column invest_percent type numeric(6,3) using invest_percent::numeric(6,3);
