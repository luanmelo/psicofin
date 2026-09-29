# PsicoFin

Agenda e controle financeiro para psicólogos, construído com Next.js e Supabase.

## Backend Supabase

O Supabase é responsável por:

- cadastro e login com email e senha;
- hash e armazenamento seguro da senha pelo Supabase Auth;
- perfil com o nome do psicólogo;
- pacientes, sessões recorrentes ou avulsas e status dos atendimentos;
- isolamento dos dados de cada usuário com Row Level Security (RLS).

A aplicação não cria uma coluna de senha e nunca recebe o hash armazenado pelo Supabase.

## Configuração

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra o SQL Editor do projeto.
3. Execute o conteúdo de `supabase/migrations/20260928000000_initial_schema.sql`.
4. Copie `.env.example` para `.env.local`.
5. No painel do Supabase, abra **Connect** e informe no `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_sua_chave
```

Use somente a chave publicável no frontend. Nunca adicione uma chave `secret` ou `service_role` ao projeto web.

Em projetos que já executaram a migração inicial, execute também as migrações posteriores, em ordem. Para adicionar o status de cancelamento, use `supabase/migrations/20260929000000_add_cancelled_occurrence_status.sql`.

Por padrão, o Supabase pode exigir confirmação por email no cadastro. Essa opção pode ser alterada em **Authentication > Providers > Email**.

## Desenvolvimento

```bash
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Produção local

```bash
npm run build
npm run start -- --hostname 0.0.0.0
```
