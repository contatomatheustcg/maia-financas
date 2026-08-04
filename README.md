# M.A.I.A — Controle Financeiro

Projeto React (Vite + Tailwind) gerado a partir do protótipo. Este README é o passo a passo pra:
1. Subir o código pro GitHub
2. Criar o banco de dados no Supabase
3. Publicar no Vercel

---

## 0. Rodar localmente primeiro (recomendado)

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`. Confirma que tudo funciona igual ao protótipo antes de publicar.

> **Nota sobre o Supabase:** o app hoje guarda os dados só na memória do navegador (state do React) — é o que você testou até agora. Criei a base do banco (`supabase/schema.sql`) e o cliente (`src/lib/supabaseClient.js`) prontos, mas ligar cada tela (receitas, despesas, investimentos) ao banco é um passo de código à parte, que a gente faz depois que o deploy básico estiver no ar. Por enquanto, o Supabase fica configurado e disponível, mas os dados continuam "resetando" ao recarregar a página até essa próxima etapa.

---

## 1. Subir pro GitHub

```bash
cd maia-financas
git init
git add .
git commit -m "Primeira versão do M.A.I.A"
```

Depois:
1. Cria um repositório novo em https://github.com/new (pode deixar privado)
2. Não marca nenhuma opção de "adicionar README" (você já tem um)
3. Copia os comandos que o GitHub mostra na tela "…or push an existing repository", algo como:

```bash
git remote add origin https://github.com/SEU-USUARIO/maia-financas.git
git branch -M main
git push -u origin main
```

---

## 2. Criar o banco no Supabase

1. Cria conta em https://supabase.com e clica em **New project**
2. Escolhe nome, senha do banco e região (South America se quiser menor latência)
3. Espera o projeto terminar de provisionar (~2 min)
4. Vai em **SQL Editor** (menu lateral) → **New query**
5. Cola o conteúdo do arquivo `supabase/schema.sql` deste projeto e clica em **Run**
   — isso cria as tabelas de receitas, despesas fixas/variáveis, investimentos, categorias e ativa a segurança por usuário (RLS)
6. Vai em **Authentication → Providers** e confirma que **Email** está habilitado (é o método mais simples pra usar com o login que você já tem)
7. Vai em **Settings → API** e copia dois valores:
   - **Project URL**
   - **anon public key**

Cola esses dois valores no arquivo `.env` (copie `.env.example` para `.env` primeiro):

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

---

## 3. Publicar no Vercel

1. Cria conta em https://vercel.com (dá pra entrar direto com GitHub)
2. Clica em **Add New → Project**
3. Escolhe o repositório `maia-financas` que você acabou de subir
4. Em **Framework Preset**, o Vercel já deve detectar **Vite** automaticamente
5. Antes de clicar em Deploy, abre **Environment Variables** e adiciona as mesmas duas do `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Clica em **Deploy** e espera o build terminar (~1 min)
7. Pronto — o Vercel te dá uma URL tipo `maia-financas.vercel.app`

Depois disso, qualquer novo `git push` pra branch `main` publica automaticamente uma nova versão.

---

## Próximos passos (quando quiser)

- **Ligar o app ao Supabase de verdade**: trocar os `useState` de receitas/despesas/investimentos por leitura e escrita nas tabelas criadas, e trocar o login fake por `supabase.auth.signInWithPassword` / `signUp`. Esse é o próximo pedido natural.
- **Domínio próprio**: em Vercel → Project → Settings → Domains.
