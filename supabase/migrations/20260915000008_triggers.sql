-- 0008 — triggers (DATA-MODEL §8). Cada um com drop trigger if exists antes do create.

-- auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- app_settings
drop trigger if exists app_settings_validate_tz on public.app_settings;
create trigger app_settings_validate_tz before insert or update on public.app_settings
  for each row execute function private.validate_timezone();
drop trigger if exists app_settings_updated_at on public.app_settings;
create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function private.set_updated_at();
drop trigger if exists app_settings_audit on public.app_settings;
create trigger app_settings_audit after update on public.app_settings
  for each row execute function private.audit_row();

-- app_secrets
drop trigger if exists app_secrets_protect on public.app_secrets;
create trigger app_secrets_protect before update on public.app_secrets
  for each row execute function private.protect_app_secrets();
drop trigger if exists app_secrets_updated_at on public.app_secrets;
create trigger app_secrets_updated_at before update on public.app_secrets
  for each row execute function private.set_updated_at();
drop trigger if exists app_secrets_audit on public.app_secrets;
create trigger app_secrets_audit after update on public.app_secrets
  for each row execute function private.audit_row();

-- seasons
drop trigger if exists seasons_updated_at on public.seasons;
create trigger seasons_updated_at before update on public.seasons
  for each row execute function private.set_updated_at();
drop trigger if exists seasons_stamp_actor on public.seasons;
create trigger seasons_stamp_actor before insert on public.seasons
  for each row execute function private.stamp_actor();
drop trigger if exists seasons_audit on public.seasons;
create trigger seasons_audit after insert or update on public.seasons
  for each row execute function private.audit_row();

-- season_goals
drop trigger if exists season_goals_updated_at on public.season_goals;
create trigger season_goals_updated_at before update on public.season_goals
  for each row execute function private.set_updated_at();
drop trigger if exists season_goals_goal_milestone on public.season_goals;
create trigger season_goals_goal_milestone after update of goal_amount on public.season_goals
  for each row execute function private.on_goal_amount_changed();

-- profiles
drop trigger if exists profiles_protect_columns on public.profiles;
create trigger profiles_protect_columns before update on public.profiles
  for each row execute function private.protect_profile_columns();
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
drop trigger if exists profiles_audit on public.profiles;
create trigger profiles_audit after update on public.profiles
  for each row
  when ((old.role, old.status, old.job_title, old.team) is distinct from (new.role, new.status, new.job_title, new.team))
  execute function private.audit_row();

-- profile_private
drop trigger if exists profile_private_updated_at on public.profile_private;
create trigger profile_private_updated_at before update on public.profile_private
  for each row execute function private.set_updated_at();

-- point_rules
drop trigger if exists point_rules_stamp_actor on public.point_rules;
create trigger point_rules_stamp_actor before insert on public.point_rules
  for each row execute function private.stamp_actor();
drop trigger if exists point_rules_updated_at on public.point_rules;
create trigger point_rules_updated_at before update on public.point_rules
  for each row execute function private.set_updated_at();
drop trigger if exists point_rules_audit on public.point_rules;
create trigger point_rules_audit after insert or update on public.point_rules
  for each row execute function private.audit_row();

-- point_entries (ledger)
drop trigger if exists point_entries_before on public.point_entries;
create trigger point_entries_before before insert on public.point_entries
  for each row execute function private.before_point_entry();
drop trigger if exists point_entries_after on public.point_entries;
create trigger point_entries_after after insert on public.point_entries
  for each row execute function private.after_point_entry();
drop trigger if exists point_entries_immutable on public.point_entries;
create trigger point_entries_immutable before update or delete on public.point_entries
  for each row execute function private.forbid_ledger_mutation();

-- special_events
drop trigger if exists special_events_stamp_actor on public.special_events;
create trigger special_events_stamp_actor before insert on public.special_events
  for each row execute function private.stamp_actor();
drop trigger if exists special_events_updated_at on public.special_events;
create trigger special_events_updated_at before update on public.special_events
  for each row execute function private.set_updated_at();
drop trigger if exists special_events_audit on public.special_events;
create trigger special_events_audit after insert or update on public.special_events
  for each row execute function private.audit_row();
drop trigger if exists special_events_notify on public.special_events;
create trigger special_events_notify after insert or update of is_active on public.special_events
  for each row execute function private.notify_special_event();

-- missions
drop trigger if exists missions_validate_window on public.missions;
create trigger missions_validate_window before insert or update on public.missions
  for each row execute function private.validate_mission_window();
drop trigger if exists missions_stamp_actor on public.missions;
create trigger missions_stamp_actor before insert on public.missions
  for each row execute function private.stamp_actor();
drop trigger if exists missions_updated_at on public.missions;
create trigger missions_updated_at before update on public.missions
  for each row execute function private.set_updated_at();

-- mission_progress
drop trigger if exists mission_progress_updated_at on public.mission_progress;
create trigger mission_progress_updated_at before update on public.mission_progress
  for each row execute function private.set_updated_at();

-- challenges
drop trigger if exists challenges_validate_window on public.challenges;
create trigger challenges_validate_window before insert or update on public.challenges
  for each row execute function private.validate_challenge_window();
drop trigger if exists challenges_protect_status on public.challenges;
create trigger challenges_protect_status before update on public.challenges
  for each row execute function private.protect_challenge_status();
drop trigger if exists challenges_cardinality on public.challenges;
create constraint trigger challenges_cardinality after update of status on public.challenges
  deferrable initially deferred
  for each row execute function private.check_challenge_cardinality();
drop trigger if exists challenges_stamp_actor on public.challenges;
create trigger challenges_stamp_actor before insert on public.challenges
  for each row execute function private.stamp_actor();
drop trigger if exists challenges_updated_at on public.challenges;
create trigger challenges_updated_at before update on public.challenges
  for each row execute function private.set_updated_at();

-- challenge_participants
drop trigger if exists cp_protect on public.challenge_participants;
create trigger cp_protect before insert or delete on public.challenge_participants
  for each row execute function private.protect_challenge_participants();
drop trigger if exists cp_cardinality on public.challenge_participants;
create constraint trigger cp_cardinality after insert or delete on public.challenge_participants
  deferrable initially deferred
  for each row execute function private.check_challenge_cardinality();
drop trigger if exists cp_updated_at on public.challenge_participants;
create trigger cp_updated_at before update on public.challenge_participants
  for each row execute function private.set_updated_at();

-- wheels
drop trigger if exists wheels_updated_at on public.wheels;
create trigger wheels_updated_at before update on public.wheels
  for each row execute function private.set_updated_at();
drop trigger if exists wheels_protect_inactive on public.wheels;
create trigger wheels_protect_inactive before update of is_active on public.wheels
  for each row execute function private.protect_wheel_deactivation();
drop trigger if exists wheels_check_prizes on public.wheels;
create constraint trigger wheels_check_prizes after update of is_active on public.wheels
  deferrable initially deferred
  for each row execute function private.check_wheel_prizes_on_wheel();

-- wheel_prizes
drop trigger if exists wheel_prizes_min on public.wheel_prizes;
create constraint trigger wheel_prizes_min after insert or update or delete on public.wheel_prizes
  deferrable initially deferred
  for each row execute function private.check_wheel_min_prizes();
drop trigger if exists wheel_prizes_block_pending on public.wheel_prizes;
create trigger wheel_prizes_block_pending before update or delete on public.wheel_prizes
  for each row execute function private.block_prize_change_with_pending_spin();
drop trigger if exists wheel_prizes_updated_at on public.wheel_prizes;
create trigger wheel_prizes_updated_at before update on public.wheel_prizes
  for each row execute function private.set_updated_at();
drop trigger if exists wheel_prizes_audit on public.wheel_prizes;
create trigger wheel_prizes_audit after insert or update on public.wheel_prizes
  for each row execute function private.audit_row();

-- wheel_queue
drop trigger if exists wheel_queue_updated_at on public.wheel_queue;
create trigger wheel_queue_updated_at before update on public.wheel_queue
  for each row execute function private.set_updated_at();

-- rewards
drop trigger if exists rewards_stamp_actor on public.rewards;
create trigger rewards_stamp_actor before insert on public.rewards
  for each row execute function private.stamp_actor();
drop trigger if exists rewards_updated_at on public.rewards;
create trigger rewards_updated_at before update on public.rewards
  for each row execute function private.set_updated_at();
drop trigger if exists rewards_audit on public.rewards;
create trigger rewards_audit after insert or update on public.rewards
  for each row execute function private.audit_row();

-- reward_redemptions
drop trigger if exists reward_redemptions_updated_at on public.reward_redemptions;
create trigger reward_redemptions_updated_at before update on public.reward_redemptions
  for each row execute function private.set_updated_at();

-- achievements
drop trigger if exists achievements_updated_at on public.achievements;
create trigger achievements_updated_at before update on public.achievements
  for each row execute function private.set_updated_at();
drop trigger if exists achievements_audit on public.achievements;
create trigger achievements_audit after insert or update on public.achievements
  for each row execute function private.audit_row();
