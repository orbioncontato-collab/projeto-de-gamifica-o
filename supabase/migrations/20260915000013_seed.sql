-- 0013_seed.sql — DATA-MODEL §13 (catálogo e configuração)
-- Cria APENAS catálogo e configuração. Nenhuma pessoa, perfil, lançamento, missão,
-- desafio, giro, resgate, fila ou notificação fictícia. Todo insert é idempotente
-- (on conflict do nothing / where not exists) e usa chaves naturais estáveis
-- (code, kind, lower(name)); linhas apagadas pelo gestor (deleted_at) NÃO voltam.

-- 13.1 app_settings (singleton)
insert into public.app_settings (
  id, company_name, xp_per_level, currency, timezone,
  target_conversion_pct, target_attendance_pct, target_crm_pct, target_activities_count,
  rank_admins, auto_approve_members
)
values (1, 'Orbion', 400, 'BRL', 'America/Sao_Paulo', 25, 70, 95, 1000, true, false)
on conflict (id) do nothing;

-- 13.2 app_secrets (singleton) — team_code aleatório gerado NESTA execução;
-- numa reexecução a linha já existe e o código é preservado.
insert into public.app_secrets (id, team_code, bootstrap_email, bootstrap_done)
values (1, upper(encode(extensions.gen_random_bytes(6), 'hex')), null, false)
on conflict (id) do nothing;

-- 13.3 seasons — uma temporada ativa nomeada pelo mês corrente (America/Sao_Paulo),
-- do 1º dia 00:00 local até o 1º dia do mês seguinte (exclusivo). Só na instalação nova.
insert into public.seasons (name, starts_at, ends_at, team_goal_amount, xp_per_level, is_active)
select
  (array['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'])
    [extract(month from (now() at time zone 'America/Sao_Paulo'))::int]
  || ' ' || extract(year from (now() at time zone 'America/Sao_Paulo'))::int,
  date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo',
  (date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '1 month') at time zone 'America/Sao_Paulo',
  0, 400, true
where not exists (select 1 from public.seasons);

-- 13.4 point_rules (10 regras; coins = points)
insert into public.point_rules (name, metric, points, coins, trigger_kind, amount_step, requires_amount, sort_order)
select v.name, v.metric::public.metric_type, v.points, v.coins, v.trigger_kind::public.rule_trigger_kind,
       v.amount_step, v.requires_amount, v.sort_order
from (values
  ('Reunião agendada',   'meeting_scheduled', 10,  10,  'manual',           null::numeric, false, 1),
  ('Reunião realizada',  'meeting_held',      20,  20,  'manual',           null,          false, 2),
  ('Venda realizada',    'sale',              100, 100, 'manual',           null,          true,  3),
  ('R$ 10.000 vendidos', 'amount_step',       150, 150, 'auto_amount_step', 10000,         false, 4),
  ('Meta semanal',       'weekly_goal',       200, 200, 'manual',           null,          false, 5),
  ('Meta mensal',        'monthly_goal',      500, 500, 'auto_goal',        null,          false, 6),
  ('CRM atualizado',     'crm_update',        10,  10,  'manual',           null,          false, 7),
  ('Recuperação de lead','lead_recovery',     30,  30,  'manual',           null,          false, 8),
  ('Upsell',             'upsell',            80,  80,  'manual',           null,          false, 9),
  ('Ligação realizada',  'call',              5,   5,   'manual',           null,          false, 10)
) as v(name, metric, points, coins, trigger_kind, amount_step, requires_amount, sort_order)
where not exists (select 1 from public.point_rules r where lower(r.name) = lower(v.name));

-- 13.5 wheels (2)
insert into public.wheels (kind, name)
values ('classic', 'Roleta Clássica'), ('premium', 'Roleta Premium')
on conflict (kind) do nothing;

-- 13.5 wheel_prizes — Clássica (6) e Premium (8), peso 1 cada
insert into public.wheel_prizes (wheel_id, label, kind, value, weight, color, sort_order)
select w.id, v.label, v.kind::public.prize_kind, v.value, 1, v.color, v.sort_order
from (values
  ('classic', 0, 'R$ 10 PIX',   'cash',       10::numeric, '#F97316'),
  ('classic', 1, '100 pontos',  'points',     100,         '#22C55E'),
  ('classic', 2, 'R$ 20 PIX',   'cash',       20,          '#3B82F6'),
  ('classic', 3, 'Giro extra',  'extra_spin', null,        '#A855F7'),
  ('classic', 4, 'R$ 30 iFood', 'voucher',    30,          '#EF4444'),
  ('classic', 5, '200 pontos',  'points',     200,         '#EAB308'),
  ('premium', 0, 'R$ 50 PIX',   'cash',       50,          '#F97316'),
  ('premium', 1, '500 pontos',  'points',     500,         '#22C55E'),
  ('premium', 2, 'R$ 100 PIX',  'cash',       100,         '#3B82F6'),
  ('premium', 3, 'Giro extra',  'extra_spin', null,        '#A855F7'),
  ('premium', 4, 'R$ 50 iFood', 'voucher',    50,          '#EF4444'),
  ('premium', 5, '1.000 pontos','points',     1000,        '#EAB308'),
  ('premium', 6, '2x pontos',   'multiplier', 2,           '#14B8A6'),
  ('premium', 7, 'Mystery Box', 'mystery',    null,        '#EC4899')
) as v(wheel_kind, sort_order, label, kind, value, color)
join public.wheels w on w.kind = v.wheel_kind::public.wheel_kind
where not exists (
  select 1 from public.wheel_prizes p where p.wheel_id = w.id and p.sort_order = v.sort_order
);

-- 13.6 achievements (6)
insert into public.achievements (code, title, description, icon, criteria, criteria_value, scope, reward_points, reward_coins, sort_order)
select v.code, v.title, v.description, v.icon, v.criteria::public.achievement_criteria, v.criteria_value,
       v.scope::public.achievement_scope, v.reward_points, v.reward_coins, v.sort_order
from (values
  ('first_sale',   'PRIMEIRA VENDA', 'Realize sua primeira venda',          '🎯', 'first_sale',   null::numeric, 'lifetime', 50,  50,  1),
  ('on_fire',      'EM CHAMAS',      '7 dias consecutivos com atividade',   '🔥', 'streak_days',  7,             'lifetime', 100, 100, 2),
  ('club_50k',     '50K CLUB',       'R$ 50.000 vendidos',                  '💎', 'sales_total',  50000,         'lifetime', 300, 300, 3),
  ('goal_reached', 'META BATIDA',    'Bateu a meta mensal',                 '✅', 'monthly_goal', null,          'season',   200, 200, 4),
  ('champion',     'CAMPEÃO',        '1º lugar no mês',                     '🏆', 'rank_first',   null,          'season',   500, 500, 5),
  ('club_100k',    '100K CLUB',      'R$ 100.000 vendidos',                 '👑', 'sales_total',  100000,        'lifetime', 600, 600, 6)
) as v(code, title, description, icon, criteria, criteria_value, scope, reward_points, reward_coins, sort_order)
on conflict (code) do nothing;

-- 13.7 rewards (7) — loja
insert into public.rewards (name, category, value_amount, cost_coins, stock, icon, sort_order)
select v.name, v.category, v.value_amount, v.cost_coins, v.stock, v.icon, v.sort_order
from (values
  ('R$ 20 iFood',        'Voucher',   20::numeric, 500,  null::int, '🍔', 1),
  ('R$ 50 iFood',        'Voucher',   50,          1000, null,      '🍕', 2),
  ('R$ 50 PIX',          'PIX',       50,          1200, null,      '💸', 3),
  ('R$ 100 PIX',         'PIX',       100,         2200, null,      '💰', 4),
  ('Almoço pago',        'Benefício', null,        1500, null,      '🍽️', 5),
  ('Sair 2h mais cedo',  'Benefício', null,        1800, null,      '⏰', 6),
  ('Day Off',            'Benefício', null,        5000, null,      '🏖️', 7)
) as v(name, category, value_amount, cost_coins, stock, icon, sort_order)
where not exists (select 1 from public.rewards r where lower(r.name) = lower(v.name));

-- 13.8 O seed NÃO cria: profiles, profile_private, season_goals, point_entries, missions,
-- challenges, special_events, wheel_queue, wheel_spins, reward_redemptions,
-- profile_achievements, feed_events, notifications, audit_log (fora dos triggers de auditoria
-- das próprias linhas de catálogo acima).
