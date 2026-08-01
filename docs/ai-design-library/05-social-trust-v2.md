# 05 — Social Trust Architecture (V2)

## Status

Approved direction, intentionally excluded from MVP implementation.

## Trust ladder

```text
Identity Orb
  → 👋
  → mutual 👋
  → scoped coordination
  → confirmed plan
  → mutually confirmed real interaction
  → optional permanent connection
```

Each step unlocks only the minimum additional capability required for the next action.

## Stranger preview

A stranger card contains only:

1. nickname and current voluntary activity;
2. approximate distance or safe context;
3. car.

No real face, legal name, movement history, follower counts or public trust score.

## Mutual 👋

A mutual gesture opens a temporary coordination capability, not friendship and not a permanent messenger.

It does not automatically reveal:

- identity;
- exact location;
- permanent profile access;
- persistent chat.

## Scoped coordination

Temporary coordination is tied to a concrete goal:

- shared ride;
- Meet;
- proposed rendezvous;
- other time-bounded real-world action.

The channel may include short text, route/point actions and status updates. It expires based on activity context or inactivity.

## Coordination state machine

```text
Mutual 👋
  → Coordination Card
  → rendezvous proposed
  → plan confirmed
  → in progress
  → Result Card
```

The Plan state is not a separate product or messenger. It is a structured state of the same coordination object.

## Rendezvous

NOXA should suggest 2–3 neutral, real POIs relative to the shared activity area, not relative to either user’s exact location.

Users can:

- accept the suggested place;
- propose another place;
- choose a custom point.

A custom point is a proposal and requires confirmation from the other side.

No separate `Public Meet Point` entity is required.

## Meeting confirmation

A real-world meeting is never inferred as fact from proximity alone.

Flow:

1. one user proposes `Отметить встречу`;
2. the other explicitly confirms;
3. only mutual confirmation creates a confirmed shared experience.

Location may only surface a prompt when both users voluntarily shared location within the same coordination context.

## Result Card

After coordination closes, message content is no longer shown. A private compact result may preserve:

- nickname or mutually disclosed identity;
- car;
- activity type and date;
- honest result status.

If a meeting was not mutually confirmed, the shared status is limited to:

> План был согласован.

This does not strengthen the social graph and does not count as a confirmed shared activity.

## Permanent connection

After repeated confirmed shared activities, NOXA may show one quiet suggestion inside a private Result Card.

The system never sends a request automatically and never repeatedly pressures the user.

A permanent connection unlocks identity and the right to contact. It does not automatically grant exact or continuous location access.

## Location model

Identity, communication and exact location are separate permissions.

Exact Live location requires explicit, scoped consent showing:

- audience;
- purpose;
- duration.

Public Meet participation does not imply exact tracking. Large/open activities use aggregate or synthetic presence, not personal GPS disclosure.

## Safety rules

- silence is not consent;
- refusal needs no explanation;
- blocking immediately revokes access;
- no public negative marks for ignored or rejected interactions;
- no automatic friendship, trust score or meeting claim;
- no stored exact rendezvous coordinates in long-term social history.
