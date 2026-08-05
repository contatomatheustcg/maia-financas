-- Migração 007: status de pago/em aberto pra aportes de investimento
-- Rode isso no SQL Editor do Supabase depois da migration_006.
-- Default true preserva o comportamento anterior dos aportes já cadastrados
-- (todos contavam como "feitos"); novos aportes usam o status escolhido no app.

alter table public.invest_allocations
  add column if not exists paid boolean not null default true,
  add column if not exists payment_date date;
