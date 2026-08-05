# NOXA — UX/UI Rules

## Design direction

NOXA follows a premium dark visual language influenced by Apple, Porsche, Rivian, Nothing and Leica. The goal is not decoration; it is clarity, restraint, precision and confidence.

## Non-negotiable principles

- Preserve the established information architecture unless a product problem proves it wrong.
- Do not perform broad redesigns without a documented reason.
- One screen must feel designed as a system, not assembled from unrelated AI-generated fragments.
- Use consistent spacing, radii, typography, opacity and elevation.
- Prioritize content and primary action; secondary controls must not compete visually.
- Never allow buttons, overlays, bottom navigation or floating panels to collide.
- Respect safe areas, keyboard insets and dynamic content height.
- Touch targets must remain comfortably usable on physical Android devices.
- Loading, empty, error, disabled and success states are part of the component, not later additions.
- Do not expose raw Supabase, Mapbox or network errors to users.

## Visual quality

- Dark surfaces should have deliberate tonal separation, not random translucent layers.
- Transparency must preserve legibility and depth; avoid muddy stacked glass effects.
- Use red as a controlled brand/action signal, not as general decoration.
- Avoid cheap gradients, excessive glow, uncontrolled blur and decorative noise.
- Cards should have a clear purpose and hierarchy. Do not wrap every element in another card.
- Icons, labels and controls use a consistent visual weight.
- Typography should create hierarchy through size, weight and spacing rather than excessive color changes.

## Layout contract

- Define screen-level horizontal gutters and reuse them consistently.
- Use a spacing scale rather than arbitrary pixel values.
- Floating controls must reserve space for bottom navigation and device safe area.
- Modal sheets and map cards must have explicit collapsed, expanded and dismissed states.
- Lists must account for loading skeletons, empty states, pagination and bottom content inset.
- Forms must remain usable with the keyboard open and validation messages visible.

## Motion

- Motion communicates state and continuity.
- Keep transitions short, predictable and interruptible.
- Avoid animation that delays the primary action.
- Follow reduced-motion preferences when supported.

## Review checklist

Before accepting a UI change, verify:

1. no overlapping elements on small and medium Android screens;
2. correct safe-area and keyboard behavior;
3. consistent spacing, radius and opacity;
4. clear primary action and visual hierarchy;
5. complete loading, empty, error and disabled states;
6. no raw backend errors or mock content;
7. runtime validation in a native development build.
