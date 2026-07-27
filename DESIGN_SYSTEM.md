# Noxa Design System v2.0

Noxa is a premium car-culture social app with a dark, graphite-first interface and a disciplined deep-red accent. The system combines the NOXA product architecture with the approved Figma Make visual language. It should feel precise, automotive, and calm: more Porsche cockpit and Apple restraint than game HUD.

## Visual philosophy

- Build on black and graphite surfaces.
- Use red only for key actions, active states, and important brand moments.
- Keep components matte, clean, and tactile.
- Prefer reusable tokens and components over one-off styles.
- Screens should feel premium, spacious, and night-oriented.

## Colors

| Token | Value | Usage |
| --- | --- | --- |
| `background` | `#06060A` | App screens and full-page backgrounds |
| `surface` | `#111116` | Cards and main panels |
| `surfaceSoft` | `#18181D` | Inputs, secondary buttons, elevated sections |
| `border` | `rgba(255,255,255,0.072)` | Subtle dividers and component borders |
| `primary` | `#C8102E` | Main CTA, active tab, critical brand accent |
| `primaryHover` | `#E01535` | Pressed/hovered red states where supported |
| `text` | `#F0F0F4` | Primary text |
| `textMuted` | `#8E8E98` | Secondary text and placeholders |
| `success` | `#30D158` | Positive statuses |
| `warning` | `#FF9F0A` | Caution statuses |

Backward-compatible aliases remain available: `accent` equals `primary`, `accentDark` remains available, and `textSecondary` equals `textMuted`.

## Typography

Use strong hierarchy and short labels:

- `caption: 13` for badges, helper text, and compact labels.
- `body: 17` for readable UI copy.
- `title: 22` for headers and card titles.
- `h2: 28` for section hero text.
- `h1: 34` for screen-level hero headings.
- `hero: 48` for rare brand moments.

## Spacing

Spacing is based on a compact mobile rhythm:

`xxs: 4`, `xs: 8`, `sm: 12`, `md: 16`, `lg: 20`, `xl: 24`, `xxl: 32`, `xxxl: 40`, `huge: 48`.

Use `md` to `xl` for most screen layout. Use `xxs` and `xs` only inside tight components.

## Radius

Noxa uses restrained automotive-panel shapes:

- `sm: 8` for small controls.
- `md: 12` for inputs and compact cards.
- `lg: 16` for standard cards.
- `xl: 20` for hero cards.
- `pill: 999` for avatars, chips, compact filters, and small floating controls.

## Buttons

Use `NoxaButton` for standard actions:

- `primary` for the most important action on a screen.
- `secondary` for alternate actions with visible containment.
- `ghost` for low-emphasis actions.

Standard buttons use a 12px radius instead of a capsule shape. Reserve `pill` for chips, avatars, and compact filters. Avoid more than one primary button in a single decision area.

## Cards

Use `NoxaCard` for grouped content. Cards are matte dark surfaces with subtle borders, 16px corners, and restrained shadows. Do not use heavy blur or bright transparent glass effects.

## Bottom navigation

Keep the product architecture `Crews / Events / Map / Garage / Profile`. The bar is edge-to-edge, dark, and visually quiet. Map stays in the center and may use a slightly larger icon, but never a floating glowing game-style button. Search and notifications remain stack screens opened from contextual header actions.

## Screen layout

Use `NoxaScreen` for new screens so safe-area handling, background color, and padding are consistent. Use `NoxaHeader` for title/subtitle rows with optional left and right controls. Keep Map-specific visuals intact until a dedicated Map refactor module.

## When to use red

Use red for:

- Primary calls to action.
- Active navigation states.
- Small brand moments such as logo underlines.
- Live or featured status accents when safe and appropriate.

Do not use red as a generic decoration everywhere. Red should communicate priority.

## Forbidden styles

- No cyberpunk overload.
- No heavy glassmorphism.
- No random one-off colors.
- No white screens.
- No default Expo look.
