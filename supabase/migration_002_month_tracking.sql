-- Migração 002: separa lançamentos por mês
-- Rode isso no SQL Editor do Supabase DEPOIS do schema.sql original já ter sido executado.

-- Receita e despesa variável: cada lançamento pertence a um único mês (não recorrem sozinhos)
alter table public.income
  add column if not exists reference_month text not null default to_char(now(), 'YYYY-MM');

alter table public.variable_expenses
  add column if not exists reference_month text not null default to_char(now(), 'YYYY-MM');

-- Despesa fixa: passa a ser uma "definição" recorrente (fixo/assinatura contam todo mês
-- a partir de start_month; parcelado conta até esgotar o número de parcelas).
-- O status de pago por mês fica em paid_months, ex: {"2026-08": {"paid": true, "paymentDate": "2026-08-05"}}
alter table public.fixed_expenses
  add column if not exists start_month text not null default to_char(now(), 'YYYY-MM'),
  add column if not exists paid_months jsonb not null default '{}'::jsonb;

-- Campos antigos de pagamento único por lançamento não fazem mais sentido pra algo recorrente
-- (substituídos por paid_months, que guarda o status de cada mês separadamente)
alter table public.fixed_expenses drop column if exists paid;
alter table public.fixed_expenses drop column if exists payment_date;
alter table public.fixed_expenses drop column if exists deferred;
alter table public.fixed_expenses drop column if exists late_from_previous_month;
