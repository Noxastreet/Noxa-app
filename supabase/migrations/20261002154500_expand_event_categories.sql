-- Expand NOXA automotive event categories without changing existing rows.
alter table public.events
  drop constraint if exists events_category_check;

alter table public.events
  add constraint events_category_check
  check (
    category in (
      'meet',
      'drive',
      'track',
      'drift',
      'drag',
      'rally',
      'offroad',
      'show',
      'social'
    )
  );
