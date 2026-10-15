-- Gym TV backend. Paste this whole file into Supabase: SQL Editor > New query > Run.
-- Safe to run again; it replaces the functions and keeps your data.
--
-- One row per "room" (your gym). The TV, phone and watch all talk to the same room
-- through two functions: gym_get (read) and gym_action (change something).
-- The table itself is locked; only these functions can touch it.

create table if not exists public.gym_rooms (
  room        text primary key,
  plan        jsonb not null,
  day         int  not null default 0,        -- which workout day in the plan
  ex          int  not null default 0,        -- which exercise in that day
  set_no      int  not null default 1,        -- which set of that exercise (1-based)
  phase       text not null default 'idle',   -- idle | work | rest | done
  rest_ends   timestamptz,                    -- when the current rest finishes
  rest_total  int  not null default 0,        -- length of the current rest in seconds
  paused_left int,                            -- seconds left when rest is paused, null if not paused
  started_at  timestamptz,                    -- when the workout started
  log         jsonb not null default '{}'::jsonb,  -- exercise name -> last weight used
  updated_at  timestamptz not null default now()
);

alter table public.gym_rooms enable row level security;
revoke all on public.gym_rooms from anon, authenticated;

create or replace function public.gym_default_plan() returns jsonb
language sql immutable as $$
  select '{"days":[
    {"name":"Push","exercises":[
      {"name":"Overhead Press","sets":3,"reps":"10","rest":90,"weight":""},
      {"name":"Bench Press","sets":4,"reps":"8","rest":90,"weight":""},
      {"name":"Incline DB Press","sets":3,"reps":"10","rest":90,"weight":""},
      {"name":"Cable Fly","sets":3,"reps":"12","rest":60,"weight":""},
      {"name":"Tricep Pushdown","sets":3,"reps":"12","rest":60,"weight":""}]},
    {"name":"Pull","exercises":[
      {"name":"Deadlift","sets":3,"reps":"5","rest":120,"weight":""},
      {"name":"Pull Up","sets":4,"reps":"8","rest":90,"weight":""},
      {"name":"Barbell Row","sets":3,"reps":"10","rest":90,"weight":""},
      {"name":"Face Pull","sets":3,"reps":"15","rest":60,"weight":""},
      {"name":"Bicep Curl","sets":3,"reps":"12","rest":60,"weight":""}]},
    {"name":"Legs","exercises":[
      {"name":"Back Squat","sets":4,"reps":"6","rest":120,"weight":""},
      {"name":"Romanian Deadlift","sets":3,"reps":"10","rest":90,"weight":""},
      {"name":"Walking Lunge","sets":3,"reps":"12 each","rest":60,"weight":""},
      {"name":"Calf Raise","sets":4,"reps":"15","rest":45,"weight":""}]}
  ]}'::jsonb
$$;

create or replace function public.gym_state(r public.gym_rooms) returns jsonb
language sql stable as $$
  select (to_jsonb(r) - 'room') || jsonb_build_object('server_now', now())
$$;

create or replace function public.gym_load(p_room text) returns public.gym_rooms
language plpgsql security definer set search_path = public as $$
declare r public.gym_rooms;
begin
  if p_room is null or length(p_room) < 6 or length(p_room) > 64 then
    raise exception 'Room code must be 6 to 64 characters';
  end if;
  insert into gym_rooms (room, plan) values (p_room, gym_default_plan())
    on conflict (room) do nothing;
  select * into r from gym_rooms where room = p_room for update;
  return r;
end $$;

create or replace function public.gym_get(p_room text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.gym_rooms;
begin
  r := gym_load(p_room);
  return gym_state(r);
end $$;

create or replace function public.gym_action(p_room text, p_action text, p_value jsonb default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r       public.gym_rooms;
  n_days  int;
  exs     jsonb;
  n_ex    int;
  cur     jsonb;
  sets    int;
  rest    int;
  v_name  text;
begin
  r := gym_load(p_room);

  -- A rest that has run out counts as the next set being in progress.
  if r.phase = 'rest' and r.paused_left is null and r.rest_ends <= now() then
    r.phase := 'work'; r.rest_ends := null;
  end if;

  n_days := coalesce(jsonb_array_length(r.plan->'days'), 0);
  if r.day >= n_days then r.day := greatest(n_days - 1, 0); end if;
  exs  := coalesce(r.plan->'days'->r.day->'exercises', '[]'::jsonb);
  n_ex := jsonb_array_length(exs);
  cur  := exs->r.ex;

  case p_action

  when 'start' then
    r.day := coalesce((p_value->>'day')::int, r.day);
    if r.day < 0 or r.day >= n_days then raise exception 'No such day'; end if;
    exs := coalesce(r.plan->'days'->r.day->'exercises', '[]'::jsonb);
    r.ex := 0; r.set_no := 1; r.rest_ends := null; r.paused_left := null;
    r.started_at := now();
    r.phase := case when jsonb_array_length(exs) > 0 then 'work' else 'idle' end;

  when 'select_day' then
    r.day := coalesce((p_value->>'day')::int, r.day);
    if r.day < 0 or r.day >= n_days then raise exception 'No such day'; end if;

  when 'done' then
    if r.phase = 'rest' then
      -- tapping Done while resting skips the rest
      r.phase := 'work'; r.rest_ends := null; r.paused_left := null;
    elsif r.phase = 'work' and cur is not null then
      sets := greatest(coalesce((cur->>'sets')::int, 1), 1);
      rest := greatest(coalesce((cur->>'rest')::int, 0), 0);
      if r.set_no < sets then
        r.set_no := r.set_no + 1;
      else
        r.ex := r.ex + 1; r.set_no := 1;
      end if;
      if r.ex >= n_ex then
        r.phase := 'done'; r.ex := greatest(n_ex - 1, 0);
        r.set_no := greatest(coalesce((exs->r.ex->>'sets')::int, 1), 1);
      elsif rest > 0 then
        r.phase := 'rest'; r.rest_total := rest;
        r.rest_ends := now() + make_interval(secs => rest); r.paused_left := null;
      else
        r.phase := 'work';
      end if;
    end if;

  when 'next' then
    if r.phase in ('work', 'rest') then
      r.ex := r.ex + 1; r.set_no := 1; r.rest_ends := null; r.paused_left := null;
      if r.ex >= n_ex then
        r.phase := 'done'; r.ex := greatest(n_ex - 1, 0);
      else
        r.phase := 'work';
      end if;
    end if;

  when 'prev' then
    if r.phase in ('work', 'rest', 'done') and n_ex > 0 then
      if r.phase = 'done' then
        r.ex := n_ex - 1;
        r.set_no := greatest(coalesce((exs->r.ex->>'sets')::int, 1), 1);
      elsif r.set_no > 1 then
        r.set_no := r.set_no - 1;
      elsif r.ex > 0 then
        r.ex := r.ex - 1;
        r.set_no := greatest(coalesce((exs->r.ex->>'sets')::int, 1), 1);
      end if;
      r.phase := 'work'; r.rest_ends := null; r.paused_left := null;
    end if;

  when 'pause', 'resume', 'toggle_pause' then
    if r.phase = 'rest' then
      if r.paused_left is null and p_action in ('pause', 'toggle_pause') then
        r.paused_left := greatest(ceil(extract(epoch from r.rest_ends - now()))::int, 0);
      elsif r.paused_left is not null and p_action in ('resume', 'toggle_pause') then
        r.rest_ends := now() + make_interval(secs => r.paused_left);
        r.paused_left := null;
      end if;
    end if;

  when 'add30' then
    if r.phase = 'rest' then
      r.rest_total := r.rest_total + 30;
      if r.paused_left is not null then
        r.paused_left := r.paused_left + 30;
      else
        r.rest_ends := r.rest_ends + interval '30 seconds';
      end if;
    end if;

  when 'weight' then
    v_name := coalesce(p_value->>'name', cur->>'name');
    if v_name is null then raise exception 'No exercise'; end if;
    r.log := jsonb_set(r.log, array[v_name], coalesce(p_value->'weight', p_value));

  when 'end' then
    r.phase := 'idle'; r.ex := 0; r.set_no := 1;
    r.rest_ends := null; r.paused_left := null; r.started_at := null;

  when 'save_plan' then
    if jsonb_typeof(p_value->'days') <> 'array' or jsonb_array_length(p_value->'days') = 0 then
      raise exception 'Plan needs at least one day';
    end if;
    if length(p_value::text) > 100000 then raise exception 'Plan is too big'; end if;
    r.plan := p_value;
    n_days := jsonb_array_length(r.plan->'days');
    if r.day >= n_days then r.day := n_days - 1; r.phase := 'idle'; end if;
    n_ex := coalesce(jsonb_array_length(r.plan->'days'->r.day->'exercises'), 0);
    if r.ex >= n_ex then r.ex := greatest(n_ex - 1, 0); r.set_no := 1; end if;

  else
    raise exception 'Unknown action %', p_action;
  end case;

  r.updated_at := now();
  update gym_rooms set
    plan = r.plan, day = r.day, ex = r.ex, set_no = r.set_no, phase = r.phase,
    rest_ends = r.rest_ends, rest_total = r.rest_total, paused_left = r.paused_left,
    started_at = r.started_at, log = r.log, updated_at = r.updated_at
  where room = p_room;

  return gym_state(r);
end $$;

revoke all on function public.gym_load(text) from public, anon, authenticated;
grant execute on function public.gym_get(text) to anon, authenticated;
grant execute on function public.gym_action(text, text, jsonb) to anon, authenticated;
