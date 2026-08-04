-- Schema inicial para o M.A.I.A no Supabase
-- Rode isso no SQL Editor do painel do Supabase (Database > SQL Editor)

create table if not exists public.income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  category text not null,
  amount_cents integer not null,
  date text,
  receipt_date date,
  received boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  category text not null,
  amount_cents integer not null,
  date text,
  installment_current integer,
  installment_total integer,
  subscription boolean default false,
  due_day integer,
  payment_date date,
  paid boolean default false,
  deferred boolean default false,
  late_from_previous_month boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.variable_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  category text not null,
  amount_cents integer not null,
  date text,
  payment_date date,
  paid boolean default false,
  deferred boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.invest_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  category text not null,
  amount_cents integer not null,
  date text,
  created_at timestamptz default now()
);

create table if not exists public.variable_categories (
  id text not null,
  user_id uuid references auth.users not null default auth.uid(),
  label text not null,
  color text not null,
  primary key (id, user_id)
);

create table if not exists public.fixed_categories (
  id text not null,
  user_id uuid references auth.users not null default auth.uid(),
  label text not null,
  color text not null,
  primary key (id, user_id)
);

create table if not exists public.settings (
  user_id uuid references auth.users primary key default auth.uid(),
  invest_percent integer default 0,
  category_budgets jsonb default '{}'::jsonb
);

-- Row Level Security: cada usuário só vê e mexe nos próprios dados
alter table public.income enable row level security;
alter table public.fixed_expenses enable row level security;
alter table public.variable_expenses enable row level security;
alter table public.invest_allocations enable row level security;
alter table public.variable_categories enable row level security;
alter table public.fixed_categories enable row level security;
alter table public.settings enable row level security;

create policy "own rows" on public.income for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.fixed_expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.variable_expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.invest_allocations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.variable_categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.fixed_categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
