-- Expand the automotive event taxonomy used by NOXA.
-- This is an additive validation change only: existing rows remain valid and untouched.

alter table public.events
  drop constraint if exists events_category_check;

alter table public.events
  add constraint events_category_check
  check (
    category in (
      'meet',
      'drive',
      'track',
      'social',
      'autocross',
      'rally',
      'drift',
      'drag',
      'offroad',
      'show',
      'workshop'
    )
  );

comment on column public.events.category is
  'NOXA automotive event category: meet, drive, track, social, autocross, rally, drift, drag, offroad, show, or workshop.';
