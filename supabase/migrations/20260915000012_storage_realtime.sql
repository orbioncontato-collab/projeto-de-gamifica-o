-- 0012_storage_realtime.sql — DATA-MODEL §11 (Storage) e §12 (Realtime)
-- Bucket único `avatars` (público para leitura direta, sem SVG/GIF), 4 policies em
-- storage.objects e a publication supabase_realtime. Tudo idempotente e guardado
-- para rodar tanto no Supabase quanto no PGlite (harness com shim de storage).

-- ---------------------------------------------------------------------------
-- 11. Storage — bucket `avatars`
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1572864, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- public.avatar_count(uuid) é criada em 0006_helpers.sql (security definer, grant a
-- authenticated). Garantia extra caso a migration seja aplicada isolada:
create or replace function public.avatar_count(p_uid uuid)
returns int language sql stable security definer set search_path = ''
as $$
  select count(*)::int from storage.objects o
  where o.bucket_id = 'avatars' and (storage.foldername(o.name))[1] = p_uid::text;
$$;
revoke execute on function public.avatar_count(uuid) from public, anon;
grant execute on function public.avatar_count(uuid) to authenticated;

-- Policies em storage.objects (nenhuma para anon/public: list/download exigem membro ativo;
-- a leitura direta do objeto em bucket público não passa por policy).
drop policy if exists avatars_select_members on storage.objects;
create policy avatars_select_members on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (select public.is_active_member()));

drop policy if exists avatars_insert_own_or_admin on storage.objects;
create policy avatars_insert_own_or_admin on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (
      (
        (select public.is_active_member())
        and name ~ ('^' || (select auth.uid())::text || '/avatar-[0-9]{10,16}\.(jpg|jpeg|png|webp)$')
        and (select public.avatar_count((select auth.uid()))) < 3
      )
      or (
        (select public.is_admin())
        and name ~ '^[0-9a-f-]{36}/avatar-[0-9]{10,16}\.(jpg|jpeg|png|webp)$'
      )
    )
  );

drop policy if exists avatars_update_own_or_admin on storage.objects;
create policy avatars_update_own_or_admin on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (
        (select public.is_active_member())
        and name ~ ('^' || (select auth.uid())::text || '/avatar-[0-9]{10,16}\.(jpg|jpeg|png|webp)$')
      )
      or (
        (select public.is_admin())
        and name ~ '^[0-9a-f-]{36}/avatar-[0-9]{10,16}\.(jpg|jpeg|png|webp)$'
      )
    )
  )
  with check (
    bucket_id = 'avatars'
    and (
      (
        (select public.is_active_member())
        and name ~ ('^' || (select auth.uid())::text || '/avatar-[0-9]{10,16}\.(jpg|jpeg|png|webp)$')
        and (select public.avatar_count((select auth.uid()))) < 3
      )
      or (
        (select public.is_admin())
        and name ~ '^[0-9a-f-]{36}/avatar-[0-9]{10,16}\.(jpg|jpeg|png|webp)$'
      )
    )
  );

drop policy if exists avatars_delete_own_or_admin on storage.objects;
create policy avatars_delete_own_or_admin on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (select public.is_active_member())
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  );

-- ---------------------------------------------------------------------------
-- 12. Realtime — publication supabase_realtime (guardada: no PGlite pode não existir)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['wheel_queue', 'wheel_spins', 'wheel_prizes', 'notifications', 'feed_events'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

alter table public.wheel_queue replica identity full;
alter table public.wheel_spins replica identity full;
alter table public.wheel_prizes replica identity full;
alter table public.notifications replica identity full;
