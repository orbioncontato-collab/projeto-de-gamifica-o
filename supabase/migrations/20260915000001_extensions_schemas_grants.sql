-- 0001 — schemas, extensões e default privileges (DATA-MODEL §2.1–2.2)
-- Roda como postgres (owner de tudo). Idempotente.

create schema if not exists private;
create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- private: só triggers e funções definer (owner postgres) chegam aqui.
revoke all on schema private from public, anon, authenticated;

-- Desfaz os default privileges do Supabase (grant all ... to anon, authenticated, service_role)
-- para o role postgres: toda tabela/view/função/sequence nova nasce SEM privilégio para
-- anon/authenticated; só os grants explícitos de 0011 valem. service_role mantém os defaults.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, public;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema private revoke all on functions from anon, authenticated, public;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;
revoke all on all sequences in schema public from anon, authenticated;
