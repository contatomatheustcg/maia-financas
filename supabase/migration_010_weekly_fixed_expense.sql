-- Migração 010: despesa fixa semanal (dia da semana em vez de dia do mês)
-- Rode isso no SQL Editor do Supabase depois da migration_009.
-- weekday: 0=domingo, 1=segunda, ... 6=sábado. Nulo pra despesas fixo/parcelado/assinatura.

alter table public.fixed_expenses
  add column if not exists weekday smallint;
