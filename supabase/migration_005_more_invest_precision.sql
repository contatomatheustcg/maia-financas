-- Migração 005: mais casas decimais no percentual de investimento
-- Rode isso no SQL Editor do Supabase depois da migration_004.
-- 2 casas decimais ainda deixava uma sobra de alguns centavos ao digitar
-- um valor exato; com 6 casas essa sobra fica menor que 1 centavo.

alter table public.settings
  alter column invest_percent type numeric(12,6) using invest_percent::numeric(12,6);
