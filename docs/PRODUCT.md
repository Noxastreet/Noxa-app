# NOXA — Product

## Identity

NOXA is a premium mobile social platform for automotive enthusiasts.

**North Star:** «Ты не один в своей страсти. Прямо сейчас рядом есть свои».

NOXA connects drivers, vehicles, routes, Car Meets, Events, Crews and automotive communities through one map-centered social product.

## Core user value

A user should be able to:

- discover automotive activity nearby;
- find drivers, Car Meets, Events and Crews;
- open map object cards;
- build an internal NOXA route and use Follow;
- join events and communities;
- maintain a profile and Garage;
- control privacy, visibility and safety;
- later interact with verified automotive businesses and partners.

## Positioning

NOXA is not a utility directory and not a Waze clone. It is a premium automotive social platform.

Visual references: Apple, Porsche, Rivian, Nothing and Leica.

Product qualities:

- dark, minimal and highly legible;
- calm premium character;
- strong hierarchy and motion;
- low visual noise;
- clear touch targets;
- predictable behavior and honest system states.

## MVP boundary

MVP work prioritizes runtime stability and the primary social/map journeys. Large new modules, Convoy, complex social mechanics and commercial POI expansion remain frozen until the MVP passes runtime validation and release hardening.

## Canonical product rules

### Events

- Events Home presents the main event for today and upcoming events by date.
- Primary action: «Я еду».
- RSVP keeps the user on Event Detail; cancellation is available from the confirmed state.
- Event Detail uses real data, images, Mapbox preview and an internal route action.
- Only verified Crews or organizers create official Events.

### Car Meets

- Any user may create a Car Meet.
- Location and date/time are mandatory.
- Default duration is three hours.
- Check-in is voluntary and limited to the defined time window.

### Crews

- Crews Home and Crew Detail are MVP functionality.
- Data must be Supabase-backed.
- Join/request/leave, errors, images and navigation require runtime validation.

### Garage and Vehicles

- Garage and Vehicles are the next product stage after Crews & Events runtime PASS.
- Vehicle Editor belongs to the canonical flow.
