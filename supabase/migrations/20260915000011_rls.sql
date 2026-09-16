-- 0011 — RLS: enable + policies (DATA-MODEL §10) + varredura final de privilégios (§2.2) + grants explícitos (§6.1/§7.9/§10).
-- me = (select auth.uid()); member = (select public.is_active_member()); admin = (select public.is_admin()).
-- Toda policy "própria" é member and (...). Única exceção: SELECT da própria linha em profiles (member or id = me).

-- =============================================================================
-- enable RLS em todas as tabelas de public
-- =============================================================================
do $$
declare t record;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' loop
    execute format('alter table public.%I enable row level security', t.relname);
  end loop;
end $$;

-- =============================================================================
-- policies
-- =============================================================================
-- app_settings
drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings for select to authenticated using ((select public.is_active_member()));
drop policy if exists app_settings_update on public.app_settings;
create policy app_settings_update on public.app_settings for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- app_secrets
drop policy if exists app_secrets_select on public.app_secrets;
create policy app_secrets_select on public.app_secrets for select to authenticated using ((select public.is_admin()));
drop policy if exists app_secrets_update on public.app_secrets;
create policy app_secrets_update on public.app_secrets for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- seasons
drop policy if exists seasons_select on public.seasons;
create policy seasons_select on public.seasons for select to authenticated using ((select public.is_active_member()));

-- season_goals
drop policy if exists season_goals_select on public.season_goals;
create policy season_goals_select on public.season_goals for select to authenticated
  using ((select public.is_active_member()) and (profile_id = (select auth.uid()) or (select public.is_admin())));
drop policy if exists season_goals_insert on public.season_goals;
create policy season_goals_insert on public.season_goals for insert to authenticated with check ((select public.is_admin()));
drop policy if exists season_goals_update on public.season_goals;
create policy season_goals_update on public.season_goals for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- season_results
drop policy if exists season_results_select on public.season_results;
create policy season_results_select on public.season_results for select to authenticated
  using ((select public.is_active_member()) and (profile_id = (select auth.uid()) or (select public.is_admin())));

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using ((select public.is_active_member()) or id = (select auth.uid()));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using ((select public.is_active_member()) and (id = (select auth.uid()) or (select public.is_admin())))
  with check ((select public.is_active_member()) and (id = (select auth.uid()) or (select public.is_admin())));

-- profile_private
drop policy if exists profile_private_select on public.profile_private;
create policy profile_private_select on public.profile_private for select to authenticated
  using ((select public.is_active_member()) and (profile_id = (select auth.uid()) or (select public.is_admin())));
drop policy if exists profile_private_update on public.profile_private;
create policy profile_private_update on public.profile_private for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- profile_season_stats
drop policy if exists profile_season_stats_select on public.profile_season_stats;
create policy profile_season_stats_select on public.profile_season_stats for select to authenticated using ((select public.is_active_member()));

-- profile_lifetime_stats
drop policy if exists profile_lifetime_stats_select on public.profile_lifetime_stats;
create policy profile_lifetime_stats_select on public.profile_lifetime_stats for select to authenticated
  using ((select public.is_active_member()) and (profile_id = (select auth.uid()) or (select public.is_admin())));

-- point_rules
drop policy if exists point_rules_select on public.point_rules;
create policy point_rules_select on public.point_rules for select to authenticated using ((select public.is_active_member()));
drop policy if exists point_rules_insert on public.point_rules;
create policy point_rules_insert on public.point_rules for insert to authenticated with check ((select public.is_admin()));
drop policy if exists point_rules_update on public.point_rules;
create policy point_rules_update on public.point_rules for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- point_entries
drop policy if exists point_entries_select on public.point_entries;
create policy point_entries_select on public.point_entries for select to authenticated
  using ((select public.is_active_member()) and (profile_id = (select auth.uid()) or (select public.is_admin())));
drop policy if exists point_entries_insert on public.point_entries;
create policy point_entries_insert on public.point_entries for insert to authenticated with check ((select public.is_admin()));

-- milestone_awards
drop policy if exists milestone_awards_select on public.milestone_awards;
create policy milestone_awards_select on public.milestone_awards for select to authenticated
  using ((select public.is_active_member()) and (profile_id = (select auth.uid()) or (select public.is_admin())));

-- special_events
drop policy if exists special_events_select on public.special_events;
create policy special_events_select on public.special_events for select to authenticated using ((select public.is_active_member()));
drop policy if exists special_events_insert on public.special_events;
create policy special_events_insert on public.special_events for insert to authenticated with check ((select public.is_admin()));
drop policy if exists special_events_update on public.special_events;
create policy special_events_update on public.special_events for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- profile_boosts
drop policy if exists profile_boosts_select on public.profile_boosts;
create policy profile_boosts_select on public.profile_boosts for select to authenticated
  using ((select public.is_active_member()) and (profile_id = (select auth.uid()) or (select public.is_admin())));

-- missions
drop policy if exists missions_select on public.missions;
create policy missions_select on public.missions for select to authenticated using ((select public.is_active_member()));
drop policy if exists missions_insert on public.missions;
create policy missions_insert on public.missions for insert to authenticated with check ((select public.is_admin()));
drop policy if exists missions_update on public.missions;
create policy missions_update on public.missions for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- mission_participants
drop policy if exists mission_participants_select on public.mission_participants;
create policy mission_participants_select on public.mission_participants for select to authenticated using ((select public.is_active_member()));
drop policy if exists mission_participants_insert on public.mission_participants;
create policy mission_participants_insert on public.mission_participants for insert to authenticated with check ((select public.is_admin()));
drop policy if exists mission_participants_delete on public.mission_participants;
create policy mission_participants_delete on public.mission_participants for delete to authenticated using ((select public.is_admin()));

-- mission_progress
drop policy if exists mission_progress_select on public.mission_progress;
create policy mission_progress_select on public.mission_progress for select to authenticated using ((select public.is_active_member()));

-- challenges
drop policy if exists challenges_select on public.challenges;
create policy challenges_select on public.challenges for select to authenticated using ((select public.is_active_member()));
drop policy if exists challenges_insert on public.challenges;
create policy challenges_insert on public.challenges for insert to authenticated with check ((select public.is_admin()));
drop policy if exists challenges_update on public.challenges;
create policy challenges_update on public.challenges for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- challenge_participants
drop policy if exists challenge_participants_select on public.challenge_participants;
create policy challenge_participants_select on public.challenge_participants for select to authenticated using ((select public.is_active_member()));
drop policy if exists challenge_participants_insert on public.challenge_participants;
create policy challenge_participants_insert on public.challenge_participants for insert to authenticated with check ((select public.is_admin()));
drop policy if exists challenge_participants_delete on public.challenge_participants;
create policy challenge_participants_delete on public.challenge_participants for delete to authenticated using ((select public.is_admin()));

-- challenge_results
drop policy if exists challenge_results_select on public.challenge_results;
create policy challenge_results_select on public.challenge_results for select to authenticated using ((select public.is_active_member()));

-- wheels
drop policy if exists wheels_select on public.wheels;
create policy wheels_select on public.wheels for select to authenticated using ((select public.is_active_member()));
drop policy if exists wheels_update on public.wheels;
create policy wheels_update on public.wheels for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- wheel_prizes
drop policy if exists wheel_prizes_select on public.wheel_prizes;
create policy wheel_prizes_select on public.wheel_prizes for select to authenticated using ((select public.is_active_member()));
drop policy if exists wheel_prizes_insert on public.wheel_prizes;
create policy wheel_prizes_insert on public.wheel_prizes for insert to authenticated with check ((select public.is_admin()));
drop policy if exists wheel_prizes_update on public.wheel_prizes;
create policy wheel_prizes_update on public.wheel_prizes for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- wheel_queue
drop policy if exists wheel_queue_select on public.wheel_queue;
create policy wheel_queue_select on public.wheel_queue for select to authenticated using ((select public.is_active_member()));

-- wheel_spins
drop policy if exists wheel_spins_select on public.wheel_spins;
create policy wheel_spins_select on public.wheel_spins for select to authenticated
  using ((select public.is_active_member()) and (status in ('approved', 'pending') or profile_id = (select auth.uid()) or (select public.is_admin())));

-- rewards
drop policy if exists rewards_select on public.rewards;
create policy rewards_select on public.rewards for select to authenticated using ((select public.is_active_member()));
drop policy if exists rewards_insert on public.rewards;
create policy rewards_insert on public.rewards for insert to authenticated with check ((select public.is_admin()));
drop policy if exists rewards_update on public.rewards;
create policy rewards_update on public.rewards for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- reward_redemptions
drop policy if exists reward_redemptions_select on public.reward_redemptions;
create policy reward_redemptions_select on public.reward_redemptions for select to authenticated
  using ((select public.is_active_member()) and (profile_id = (select auth.uid()) or (select public.is_admin())));

-- achievements
drop policy if exists achievements_select on public.achievements;
create policy achievements_select on public.achievements for select to authenticated using ((select public.is_active_member()));
drop policy if exists achievements_insert on public.achievements;
create policy achievements_insert on public.achievements for insert to authenticated with check ((select public.is_admin()));
drop policy if exists achievements_update on public.achievements;
create policy achievements_update on public.achievements for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- profile_achievements
drop policy if exists profile_achievements_select on public.profile_achievements;
create policy profile_achievements_select on public.profile_achievements for select to authenticated using ((select public.is_active_member()));

-- feed_events
drop policy if exists feed_events_select on public.feed_events;
create policy feed_events_select on public.feed_events for select to authenticated using ((select public.is_active_member()));

-- notifications
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using ((select public.is_active_member()) and profile_id = (select auth.uid()));
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using ((select public.is_active_member()) and profile_id = (select auth.uid()))
  with check ((select public.is_active_member()) and profile_id = (select auth.uid()));

-- audit_log
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select to authenticated using ((select public.is_admin()));

-- =============================================================================
-- Varredura final de segurança (§2.2): revoga tudo e reaplica só os grants explícitos
-- =============================================================================
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on schema private from public, anon, authenticated;

-- tabelas: select
grant select on public.app_settings, public.app_secrets, public.seasons, public.season_goals, public.season_results, public.profiles,
  public.profile_private, public.profile_season_stats, public.profile_lifetime_stats, public.point_rules, public.point_entries,
  public.milestone_awards, public.special_events, public.profile_boosts, public.missions, public.mission_participants, public.mission_progress,
  public.challenges, public.challenge_participants, public.challenge_results, public.wheels, public.wheel_prizes, public.wheel_queue,
  public.wheel_spins, public.rewards, public.reward_redemptions, public.achievements, public.profile_achievements, public.feed_events,
  public.notifications, public.audit_log
to authenticated;

-- tabelas: insert
grant insert on public.season_goals, public.point_rules, public.point_entries, public.special_events, public.missions, public.mission_participants,
  public.challenges, public.challenge_participants, public.wheel_prizes, public.rewards, public.achievements
to authenticated;

-- tabelas: update (inteiro)
grant update on public.app_settings, public.app_secrets, public.season_goals, public.profile_private, public.point_rules, public.special_events,
  public.missions, public.challenges, public.wheels, public.wheel_prizes, public.rewards, public.achievements
to authenticated;

-- tabelas: update por coluna
grant update (full_name, avatar_path, color, preferences) on public.profiles to authenticated;
grant update (is_read) on public.notifications to authenticated;

-- tabelas: delete (únicas exceções)
grant delete on public.mission_participants, public.challenge_participants to authenticated;

-- views: só select
grant select on public.v_profile_stats, public.v_ranking, public.v_team_stats, public.v_admin_kpis, public.v_sales_timeline, public.v_mission_board,
  public.v_challenge_board, public.v_achievement_board, public.v_wheel_queue, public.v_wheel_history, public.v_redemptions, public.v_wallet,
  public.v_point_entries_history, public.v_activity_feed, public.v_seasons, public.v_special_events
to authenticated;

-- funções de public: todas para authenticated; signup_mode/validate_team_code também para anon
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' loop
    execute format('grant execute on function %s to authenticated', f.sig);
    if f.proname in ('signup_mode', 'validate_team_code') then
      execute format('grant execute on function %s to anon', f.sig);
    end if;
  end loop;
end $$;

-- trigger em auth.users roda como supabase_auth_admin
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant usage on schema private to supabase_auth_admin;
    grant execute on function private.handle_new_user() to supabase_auth_admin;
  end if;
end $$;
