alter table public.therapy_sessions
  add column if not exists billing_type text not null default 'per_session';

alter table public.therapy_sessions
  drop constraint if exists therapy_sessions_billing_type_check;

alter table public.therapy_sessions
  add constraint therapy_sessions_billing_type_check
  check (billing_type in ('per_session', 'monthly_fixed'));
