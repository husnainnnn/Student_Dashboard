-- Student Dashboard — initial Supabase schema (v1, 2026-11-26)
--
-- Apply in the Supabase dashboard: SQL Editor -> paste -> Run.
-- Or with the Supabase CLI:  supabase db push
--
-- Tables mirror the frontend types in src/lib/types.ts, one row per user.
-- Every table has Row Level Security on: a student can only read and write
-- their own rows (auth.uid() = user_id). No service-role key is needed by
-- the frontend; it uses the anon key and the user's own login.

-- Needed for gen_random_uuid().
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
-- One row per signed-up student. Created by the app after Supabase Auth signup.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Students read their own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Students update their own profile"
  on public.profiles for update using (auth.uid() = id);
create policy "Students create their own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- ---------------------------------------------------------------- lectures
create table if not exists public.lectures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day smallint not null check (day between 0 and 6), -- 0 = Sunday
  subject text not null,
  teacher text not null default '',
  room text not null default '',
  start_time text not null, -- "HH:MM" 24h
  end_time text not null,   -- "HH:MM" 24h
  created_at timestamptz not null default now()
);

create index if not exists lectures_user_day_idx
  on public.lectures (user_id, day);

alter table public.lectures enable row level security;

create policy "Students manage their own lectures"
  on public.lectures for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -------------------------------------------------------------- assignments
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course text not null,
  title text not null,
  due date, -- null when no due date yet
  status text not null default 'pending'
    check (status in ('pending', 'submitted', 'missing')),
  created_at timestamptz not null default now()
);

create index if not exists assignments_user_due_idx
  on public.assignments (user_id, due);

alter table public.assignments enable row level security;

create policy "Students manage their own assignments"
  on public.assignments for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- --------------------------------------------------------------- mess menus
-- One row per weekday per student: the weekly mess menu.
create table if not exists public.mess_menus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day smallint not null check (day between 0 and 6), -- 0 = Sunday
  breakfast text not null default '',
  lunch text not null default '',
  dinner text not null default '',
  unique (user_id, day)
);

alter table public.mess_menus enable row level security;

create policy "Students manage their own mess menus"
  on public.mess_menus for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -------------------------------------------------------------- mess status
-- Which meals the student booked (or skipped) on a given date.
create table if not exists public.mess_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  breakfast boolean not null default false,
  lunch boolean not null default false,
  dinner boolean not null default false,
  unique (user_id, date)
);

create index if not exists mess_status_user_date_idx
  on public.mess_status (user_id, date);

alter table public.mess_status enable row level security;

create policy "Students manage their own mess status"
  on public.mess_status for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -------------------------------------------------------------------- links
create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  url text not null,
  created_at timestamptz not null default now()
);

alter table public.links enable row level security;

create policy "Students manage their own links"
  on public.links for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -------------------------------------------------------------------- notes
-- Notes are what the RAG-lite search API reads: title, folder and tags
-- boost a passage's rank, so keep them meaningful.
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  content text not null default '',
  folder text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_updated_idx
  on public.notes (user_id, updated_at desc);

alter table public.notes enable row level security;

create policy "Students manage their own notes"
  on public.notes for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Keep updated_at honest without the app having to set it.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------- settings
-- One row per student: reminder rules, quiet hours, onboarding state.
create table if not exists public.settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  lecture_reminder_minutes integer not null default 30,
  assignment_reminder_hours integer not null default 48,
  lecture_reminders jsonb not null default '{}',   -- {lectureId: {enabled, minutesBefore}}
  assignment_reminders jsonb not null default '{}', -- {assignmentId: {enabled, hoursBefore}}
  meals_to_track jsonb not null default '{"breakfast": true, "lunch": true, "dinner": true}',
  quiet_hours_enabled boolean not null default true,
  quiet_hours_start text not null default '22:00', -- "HH:MM"
  quiet_hours_end text not null default '07:00',   -- "HH:MM"
  onboarding_done boolean not null default false,
  demo_data boolean not null default false
);

alter table public.settings enable row level security;

create policy "Students manage their own settings"
  on public.settings for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
