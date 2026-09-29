create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) >= 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) >= 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index patients_user_name_unique
  on public.patients (user_id, lower(name));

create table public.therapy_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null,
  weekday text not null check (
    weekday in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
  ),
  session_time time not null,
  session_value numeric(10, 2) not null check (session_value > 0),
  billing_type text not null default 'per_session' check (
    billing_type in ('per_session', 'monthly_fixed')
  ),
  frequency text not null check (frequency in ('weekly', 'biweekly', 'once')),
  start_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, user_id)
    references public.patients(id, user_id)
    on delete cascade,
  unique (id, user_id)
);

create index therapy_sessions_user_id_idx
  on public.therapy_sessions (user_id);

create table public.session_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  therapy_session_id uuid not null,
  occurrence_date date not null,
  status text not null check (status in ('completed', 'missed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (therapy_session_id, user_id)
    references public.therapy_sessions(id, user_id)
    on delete cascade,
  unique (therapy_session_id, occurrence_date)
);

create index session_occurrences_user_date_idx
  on public.session_occurrences (user_id, occurrence_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger patients_set_updated_at
before update on public.patients
for each row execute function public.set_updated_at();

create trigger therapy_sessions_set_updated_at
before update on public.therapy_sessions
for each row execute function public.set_updated_at();

create trigger session_occurrences_set_updated_at
before update on public.session_occurrences
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Psicólogo')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.therapy_sessions enable row level security;
alter table public.session_occurrences enable row level security;

create policy "Users manage their own profile"
on public.profiles
for all
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Users manage their own patients"
on public.patients
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage their own therapy sessions"
on public.therapy_sessions
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage their own session occurrences"
on public.session_occurrences
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on table public.profiles from anon;
revoke all on table public.patients from anon;
revoke all on table public.therapy_sessions from anon;
revoke all on table public.session_occurrences from anon;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.patients to authenticated;
grant select, insert, update, delete on table public.therapy_sessions to authenticated;
grant select, insert, update, delete on table public.session_occurrences to authenticated;
