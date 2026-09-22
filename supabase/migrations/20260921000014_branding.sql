-- =============================================================================
-- 14. Marca (white-label): nome da plataforma, preset de cor, logo e tema padrão
--     em app_settings + RPC pública get_branding() para a tela de login (anon).
-- =============================================================================

alter table public.app_settings
  add column if not exists platform_name text not null default 'Sales League'
    check (length(platform_name) between 1 and 40),
  add column if not exists brand_preset text not null default 'esmeralda'
    check (brand_preset in ('esmeralda', 'safira', 'ametista', 'ambar', 'coral', 'ciano', 'rosa')),
  -- data-URL (PNG/JPEG/WebP/SVG) de até ~200 KB: fica na própria linha, sem bucket no Storage
  add column if not exists logo_data_url text
    check (logo_data_url is null or (logo_data_url ~ '^data:image/(png|jpeg|webp|svg\+xml);base64,' and length(logo_data_url) <= 280000)),
  add column if not exists default_theme text not null default 'dark'
    check (default_theme in ('dark', 'light'));

-- 14.1 update_app_settings: aceita os campos novos (logo_data_url pode ser apagado com null)
create or replace function public.update_app_settings(p_patch jsonb)
returns public.app_settings language plpgsql security definer set search_path = ''
as $$
declare
  v_key text;
  v_row public.app_settings;
  v_tz text;
begin
  perform private.assert_admin();
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    perform private.fail('INVALID_PATCH_KEY', 'Campo não permitido: (patch inválido).');
  end if;
  for v_key in select jsonb_object_keys(p_patch) loop
    if v_key not in ('company_name', 'xp_per_level', 'currency', 'timezone', 'target_conversion_pct', 'target_attendance_pct',
                     'target_crm_pct', 'target_activities_count', 'rank_admins', 'auto_approve_members',
                     'platform_name', 'brand_preset', 'logo_data_url', 'default_theme') then
      perform private.fail('INVALID_PATCH_KEY', 'Campo não permitido: ' || v_key || '.');
    end if;
  end loop;
  if p_patch ? 'timezone' then
    select a.timezone into v_tz from public.app_settings a where a.id = 1;
    if (p_patch ->> 'timezone') is distinct from v_tz and exists (select 1 from public.point_entries) then
      perform private.fail('TIMEZONE_LOCKED', 'O fuso só pode ser alterado antes do primeiro lançamento.');
    end if;
  end if;
  update public.app_settings a set
    company_name = coalesce(p_patch ->> 'company_name', a.company_name),
    xp_per_level = coalesce((p_patch ->> 'xp_per_level')::int, a.xp_per_level),
    currency = coalesce(p_patch ->> 'currency', a.currency),
    timezone = coalesce(p_patch ->> 'timezone', a.timezone),
    target_conversion_pct = coalesce((p_patch ->> 'target_conversion_pct')::numeric, a.target_conversion_pct),
    target_attendance_pct = coalesce((p_patch ->> 'target_attendance_pct')::numeric, a.target_attendance_pct),
    target_crm_pct = coalesce((p_patch ->> 'target_crm_pct')::numeric, a.target_crm_pct),
    target_activities_count = coalesce((p_patch ->> 'target_activities_count')::int, a.target_activities_count),
    rank_admins = coalesce((p_patch ->> 'rank_admins')::boolean, a.rank_admins),
    auto_approve_members = coalesce((p_patch ->> 'auto_approve_members')::boolean, a.auto_approve_members),
    platform_name = coalesce(p_patch ->> 'platform_name', a.platform_name),
    brand_preset = coalesce(p_patch ->> 'brand_preset', a.brand_preset),
    logo_data_url = case when p_patch ? 'logo_data_url' then p_patch ->> 'logo_data_url' else a.logo_data_url end,
    default_theme = coalesce(p_patch ->> 'default_theme', a.default_theme)
  where a.id = 1
  returning a.* into v_row;
  -- a logo (até 280 KB) não vai para o audit: só o fato de ter mudado
  perform private.audit('rpc', 'update_app_settings', '1', null,
    case when p_patch ? 'logo_data_url'
      then (p_patch - 'logo_data_url') || jsonb_build_object('logo_data_url', case when p_patch ->> 'logo_data_url' is null then null else '<logo>' end)
      else p_patch end);
  return v_row;
exception when data_exception or integrity_constraint_violation then
  -- Nota de implementação: nunca vazar SQLSTATE cru de uma RPC de escrita (§9)
  declare v_diag_col text; v_diag_con text; v_diag_msg text;
  begin
    get stacked diagnostics v_diag_col = column_name, v_diag_con = constraint_name, v_diag_msg = message_text;
    perform private.fail_invalid(sqlstate, v_diag_col, v_diag_con, v_diag_msg);
  end;
end $$;

-- 14.2 get_branding(): só o que a tela de login precisa mostrar antes de autenticar.
--      Executável por anon. Nunca expõe metas, fuso, código de equipe ou qualquer outra coluna.
create or replace function public.get_branding()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'company_name', a.company_name,
    'platform_name', a.platform_name,
    'brand_preset', a.brand_preset,
    'logo_data_url', a.logo_data_url,
    'default_theme', a.default_theme
  )
  from public.app_settings a where a.id = 1;
$$;

revoke execute on function public.get_branding() from public;
grant execute on function public.get_branding() to anon, authenticated;
