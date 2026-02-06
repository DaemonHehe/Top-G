    create extension if not exists "pgcrypto";

    create table if not exists users (
      id text primary key default gen_random_uuid()::text,
      name text not null,
      email text not null unique,
      avatar text,
      timezone text,
      last_tasks_rollover_date date,
      total_xp integer not null default 0,
      current_rank text not null default 'Initiate',
      current_streak integer not null default 0,
      last_login timestamptz,
      last_streak_bonus_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table users drop column if exists password;
    alter table users add column if not exists total_xp integer not null default 0;
    alter table users add column if not exists current_rank text not null default 'Initiate';
    alter table users add column if not exists current_streak integer not null default 0;
    alter table users add column if not exists last_login timestamptz;
    alter table users add column if not exists last_streak_bonus_at timestamptz;

    create table if not exists tasks (
      id text primary key default gen_random_uuid()::text,
      user_id text not null references users(id) on delete cascade,
      title text not null,
      description text,
      status text not null default 'pending',
      completed boolean not null default false,
      type text not null default 'special',
      due_date date,
      completed_at timestamptz,
      last_failed_date date,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists tasks_user_idx on tasks(user_id);
    create index if not exists tasks_due_date_idx on tasks(due_date);
    alter table tasks add column if not exists completed_at timestamptz;
    create index if not exists tasks_completed_at_idx on tasks(completed_at);

    create table if not exists lifts (
      id text primary key default gen_random_uuid()::text,
      user_id text not null references users(id) on delete cascade,
      exercise text not null,
      exercise_id text,
      weight numeric not null,
      reps integer not null,
      notes text,
      date date,
      recorded_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists lifts_user_idx on lifts(user_id);
    create index if not exists lifts_recorded_at_idx on lifts(recorded_at);
    
    do $$
    begin
      if not exists (select 1 from pg_type where typname = 'protocol_status') then
        create type protocol_status as enum ('Active', 'Completed', 'Failed', 'Cancelled');
      end if;
    end $$;

    create table if not exists protocol_blueprints (
      id text primary key default gen_random_uuid()::text,
      title text not null,
      description text,
      category text,
      duration_days integer not null,
      reward_xp integer not null,
      badge_url text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists protocol_tasks (
      id text primary key default gen_random_uuid()::text,
      blueprint_id text not null references protocol_blueprints(id) on delete cascade,
      title text not null,
      description text,
      xp_value integer not null default 0,
      due_time time,
      is_smart boolean not null default false,
      smart_action text,
      sort_order integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists user_protocols (
      id text primary key default gen_random_uuid()::text,
      user_id text not null references users(id) on delete cascade,
      blueprint_id text not null references protocol_blueprints(id) on delete cascade,
      status protocol_status not null default 'Active',
      start_date date not null default current_date,
      end_date date,
      days_completed integer not null default 0,
      last_injected_date date,
      completed_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists user_badges (
      id text primary key default gen_random_uuid()::text,
      user_id text not null references users(id) on delete cascade,
      blueprint_id text not null references protocol_blueprints(id) on delete cascade,
      badge_url text,
      awarded_at timestamptz not null default now()
    );

    alter table tasks add column if not exists protocol_enrollment_id text references user_protocols(id) on delete set null;
    alter table tasks add column if not exists protocol_blueprint_id text references protocol_blueprints(id) on delete set null;
    alter table tasks add column if not exists protocol_task_id text references protocol_tasks(id) on delete set null;
    alter table tasks add column if not exists injected_date date;
    alter table tasks add column if not exists due_time time;
    alter table tasks add column if not exists is_smart boolean not null default false;
    alter table tasks add column if not exists smart_action text;

    create index if not exists protocol_blueprints_category_idx on protocol_blueprints(category);
    create index if not exists protocol_tasks_blueprint_idx on protocol_tasks(blueprint_id);
    create index if not exists user_protocols_user_idx on user_protocols(user_id);
    create index if not exists user_protocols_status_idx on user_protocols(status);
    create index if not exists user_badges_user_idx on user_badges(user_id);

    create unique index if not exists tasks_protocol_unique
      on tasks(user_id, protocol_task_id, injected_date);

    create unique index if not exists user_protocols_active_unique
      on user_protocols(user_id, blueprint_id)
      where status = 'Active';

    create table if not exists feedback (
      id text primary key default gen_random_uuid()::text,
      name text not null,
      email text not null,
      message text not null,
      created_at timestamptz not null default now(),
      metadata jsonb
    );

    create index if not exists feedback_created_at_idx on feedback(created_at);

    alter table users enable row level security;
    alter table tasks enable row level security;
    alter table lifts enable row level security;
    alter table feedback enable row level security;
    alter table protocol_blueprints enable row level security;
    alter table protocol_tasks enable row level security;
    alter table user_protocols enable row level security;
    alter table user_badges enable row level security;

    drop policy if exists "users_select_own" on users;
    drop policy if exists "users_update_own" on users;
    drop policy if exists "users_insert_own" on users;
    drop policy if exists "tasks_owner_all" on tasks;
    drop policy if exists "lifts_owner_all" on lifts;
    drop policy if exists "feedback_insert_any" on feedback;
    drop policy if exists "feedback_insert_authenticated" on feedback;
    drop policy if exists "protocol_blueprints_select_all" on protocol_blueprints;
    drop policy if exists "protocol_tasks_select_all" on protocol_tasks;
    drop policy if exists "user_protocols_owner_all" on user_protocols;
    drop policy if exists "user_badges_owner_select" on user_badges;

create policy "users_select_own" on users
  for select
  using (id = (select auth.uid())::text);

create policy "users_update_own" on users
  for update
  using (id = (select auth.uid())::text)
  with check (id = (select auth.uid())::text);

create policy "users_insert_own" on users
  for insert
  with check (id = (select auth.uid())::text);

create policy "tasks_owner_all" on tasks
  for all
  using (user_id = (select auth.uid())::text)
  with check (user_id = (select auth.uid())::text);

create policy "lifts_owner_all" on lifts
  for all
  using (user_id = (select auth.uid())::text)
  with check (user_id = (select auth.uid())::text);

create policy "feedback_insert_authenticated" on feedback
  for insert
  with check ((select auth.uid()) is not null);

create policy "protocol_blueprints_select_all" on protocol_blueprints
  for select
  using ((select auth.uid()) is not null);

create policy "protocol_tasks_select_all" on protocol_tasks
  for select
  using ((select auth.uid()) is not null);

create policy "user_protocols_owner_all" on user_protocols
  for all
  using (user_id = (select auth.uid())::text)
  with check (user_id = (select auth.uid())::text);

create policy "user_badges_owner_select" on user_badges
  for select
  using (user_id = (select auth.uid())::text);

create or replace function public.guard_protocol_tasks()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  jwt_role text;
  is_protocol boolean;
begin
  jwt_role := (current_setting('request.jwt.claims', true)::jsonb ->> 'role');
  is_protocol := (coalesce(new.type, old.type) = 'protocol') or (coalesce(new.protocol_task_id, old.protocol_task_id) is not null);

  if tg_op = 'DELETE' then
    if is_protocol and jwt_role <> 'service_role' then
      raise exception 'Protocol tasks cannot be deleted';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and is_protocol and jwt_role <> 'service_role' then
    if (new.title is distinct from old.title)
      or (new.description is distinct from old.description)
      or (new.type is distinct from old.type)
      or (new.due_date is distinct from old.due_date)
      or (new.protocol_enrollment_id is distinct from old.protocol_enrollment_id)
      or (new.protocol_blueprint_id is distinct from old.protocol_blueprint_id)
      or (new.protocol_task_id is distinct from old.protocol_task_id)
      or (new.injected_date is distinct from old.injected_date)
      or (new.due_time is distinct from old.due_time)
      or (new.is_smart is distinct from old.is_smart)
      or (new.smart_action is distinct from old.smart_action)
    then
      raise exception 'Protocol task attributes are locked';
    end if;

    if coalesce(old.is_smart, false)
      and ((new.status is distinct from old.status) or (new.completed is distinct from old.completed))
    then
      raise exception 'Smart protocol tasks auto-complete';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_protocol_tasks on tasks;
create trigger guard_protocol_tasks
before update or delete on tasks
for each row execute function public.guard_protocol_tasks();


create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email, created_at, updated_at)
  values (
    new.id::text,
    coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1),
      'User'
    ),
    new.email,
    now(),
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        name = excluded.name,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select
  using (bucket_id = 'avatars');
