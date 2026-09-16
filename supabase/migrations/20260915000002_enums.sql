-- 0002 — enums (DATA-MODEL §3). Cada type guardado por "if not exists" em pg_type.

do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'user_role') then
    create type public.user_role as enum ('admin', 'collaborator');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'profile_status') then
    create type public.profile_status as enum ('active', 'inactive', 'pending');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'job_title') then
    create type public.job_title as enum ('sdr', 'closer', 'social_seller', 'supervisor', 'manager');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'metric_type') then
    create type public.metric_type as enum ('sale', 'meeting_scheduled', 'meeting_held', 'call', 'crm_update', 'lead_recovery', 'upsell', 'amount_step', 'weekly_goal', 'monthly_goal', 'activity', 'custom');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'rule_trigger_kind') then
    create type public.rule_trigger_kind as enum ('manual', 'auto_amount_step', 'auto_goal');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'entry_source') then
    create type public.entry_source as enum ('rule', 'manual', 'system', 'mission', 'challenge', 'wheel', 'reward', 'achievement');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'mission_kind') then
    create type public.mission_kind as enum ('daily', 'weekly', 'special', 'lightning');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'mission_target_kind') then
    create type public.mission_target_kind as enum ('count', 'amount');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'mission_audience') then
    create type public.mission_audience as enum ('all', 'selected');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'challenge_kind') then
    create type public.challenge_kind as enum ('duel', 'team');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'challenge_metric') then
    create type public.challenge_metric as enum ('meetings_held', 'sales_count', 'revenue', 'points', 'activities');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'challenge_status') then
    create type public.challenge_status as enum ('draft', 'active', 'finished', 'cancelled');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'wheel_kind') then
    create type public.wheel_kind as enum ('classic', 'premium');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'prize_kind') then
    create type public.prize_kind as enum ('points', 'coins', 'cash', 'voucher', 'extra_spin', 'multiplier', 'mystery', 'custom');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'queue_status') then
    create type public.queue_status as enum ('waiting', 'active', 'done', 'removed');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'queue_source') then
    create type public.queue_source as enum ('manual', 'earned');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'spin_status') then
    create type public.spin_status as enum ('pending', 'approved', 'rejected');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'redemption_source') then
    create type public.redemption_source as enum ('store', 'wheel');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'redemption_status') then
    create type public.redemption_status as enum ('requested', 'approved', 'delivered', 'cancelled');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'achievement_criteria') then
    create type public.achievement_criteria as enum ('first_sale', 'streak_days', 'sales_total', 'monthly_goal', 'rank_first', 'points_total', 'missions_completed');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'achievement_scope') then
    create type public.achievement_scope as enum ('lifetime', 'season');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'feed_kind') then
    create type public.feed_kind as enum ('sale', 'achievement', 'wheel_prize', 'level_up', 'mission_completed', 'challenge_finished', 'season_closed');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'notification_kind') then
    create type public.notification_kind as enum ('ranking', 'mission', 'reward', 'wheel', 'challenge', 'achievement', 'level', 'event', 'season', 'system');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'audit_action') then
    create type public.audit_action as enum ('insert', 'update', 'delete', 'rpc');
  end if;
end $$;
