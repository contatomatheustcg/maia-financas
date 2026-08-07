-- Migração 008: investimento passa a ser recorrente a partir do mês de lançamento
-- Rode isso no SQL Editor do Supabase depois da migration_007.
-- Mesmo modelo da despesa fixa: recorre todo mês a partir de start_month, com
-- status de pago/aberto por mês em paid_months (substitui paid/payment_date).

alter table public.invest_allocations
  add column if not exists start_month text not null default to_char(now(), 'YYYY-MM'),
  add column if not exists paid_months jsonb not null default '{}'::jsonb;

alter table public.invest_allocations drop column if exists paid;
alter table public.invest_allocations drop column if exists payment_date;
