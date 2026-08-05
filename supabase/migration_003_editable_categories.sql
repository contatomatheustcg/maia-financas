-- Migração 003: permite editar/excluir categorias (inclusive as padrão)
-- Rode isso no SQL Editor do Supabase depois da migration_002.

-- Marca se as categorias padrão já foram copiadas pra dentro do banco desse usuário.
-- Sem isso não dá pra diferenciar "ainda não semeado" de "usuário excluiu a categoria padrão".
alter table public.settings
  add column if not exists categories_seeded boolean not null default false;
