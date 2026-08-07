-- Migração 009: % de investimento passa a valer por mês, não globalmente
-- Rode isso no SQL Editor do Supabase depois da migration_008.
-- Cada mês resolve pro valor mais recente configurado naquele mês ou antes dele
-- (ex: definiu 8% em setembro, só muda em outubro se você mudar de novo lá).

alter table public.settings
  add column if not exists invest_percent_by_month jsonb not null default '{}'::jsonb;

-- Preserva o % que já estava configurado, valendo a partir do mês atual em diante
update public.settings
  set invest_percent_by_month = jsonb_build_object(to_char(now(), 'YYYY-MM'), invest_percent)
  where invest_percent_by_month = '{}'::jsonb and invest_percent is not null;

alter table public.settings drop column if exists invest_percent;
