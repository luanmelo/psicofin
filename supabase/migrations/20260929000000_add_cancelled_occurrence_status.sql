alter table public.session_occurrences
  drop constraint if exists session_occurrences_status_check;

alter table public.session_occurrences
  add constraint session_occurrences_status_check
  check (status in ('completed', 'missed', 'cancelled'));
