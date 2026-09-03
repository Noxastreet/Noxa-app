# NOXA Communities — data foundation

Status: review-only. No production Supabase change is authorized by this document.

## Product distinction

NOXA keeps two separate concepts:

- **Crew** — a smaller user-created group inside NOXA with membership, chat, polls, convoys and private/public join rules.
- **Community** — an established automotive or motorcycle organization, club, organiser or local scene with a public identity and event presence.

A Community must not be implemented by renaming or overloading `public.crews`.

## Source of truth

The canonical Community identity belongs in the main NOXA Supabase project used by the app. The public website may read only published, non-sensitive Community fields through the publishable client role.

The existing NOXA Meets collector database remains a separate source for externally discovered public events. Cross-source event linking will be added separately after the Community directory is proven.

## Phase 1 schema

### `public.communities`

Public identity only:

- slug / name
- description
- city / region / country
- car / moto / mixed focus
- scene tags
- logo / cover
- Instagram / website
- verified flag
- publication status

No private contact details or admin identifiers are stored here.

### `public.community_admins`

Private mapping between a NOXA profile and a Community. Anonymous clients have no access.

Initial creation/claiming remains backend-controlled. Direct client insert/update/delete permissions are intentionally not introduced in Phase 1.

### `public.events.community_id`

Nullable relation for future events created on behalf of established Communities. Existing `crew_id` remains unchanged and independent.

## Public web access

Anonymous clients may only `SELECT` Community rows where `status = 'published'`.

No anonymous access is granted to:

- community admin mappings
- contact email
- applications
- member lists
- private Crew data
- user profiles

## Next phases

1. Hosted migration verification + security/performance advisors.
2. Website `/communities` directory reading published Community rows.
3. `/communities/[slug]` public profile.
4. Community application/claim workflow with private contact data stored separately.
5. Curated linking between Community profiles and NOXA Meets events.
6. Authenticated organiser tools after real communities are onboarded.

## Production gate

Before applying the migration to production:

- review SQL diff;
- run migration in an isolated hosted environment when available;
- test anon/authenticated RLS matrix;
- run Supabase security and performance advisors;
- verify existing Events and Crews behavior is unchanged;
- obtain explicit Product Owner approval for production migration.
