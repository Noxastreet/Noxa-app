# NOXA Vehicle Picker architecture

The vehicle picker is shared by Garage and future onboarding.

## Separation rule

Keep these layers separate:

1. **Catalog data** — make/model/generation/year facts and stable ids.
2. **Picker state** — current step and selected ids.
3. **Selectors** — convert catalog records into typed picker items.
4. **UI cards** — visual presentation for one item kind.
5. **Motion** — animation behavior keyed by stable motion identity.

Visible text must never be used as a React key or shared-transition identity.

## Stable identity

Examples:

- `vehicle-picker:make:bmw`
- `vehicle-picker:model:bmw:3-series`
- `vehicle-picker:generation:bmw:3-series:e46`
- `vehicle-picker:year:bmw:3-series:e46:2004`

Changing copy, localization or sort order must not change these identities.

## Planned UI component boundaries

Do not collapse the public picker UI into one giant universal card component.

- `MakeCard.tsx`
- `ModelCard.tsx`
- `GenerationCard.tsx`
- `YearCard.tsx`
- `VehiclePickerStage.tsx`
- `VehicleIdentityPreview.tsx`

These components may share small private primitives for surface, press feedback, typography or selection indication, but each public card owns its semantic content and future animation choreography.

## Motion contract

Animations are added only after the static picker is runtime-correct.

Recommended responsibilities:

- `MakeCard`: selection scale/fade and make-to-model continuity.
- `ModelCard`: selection scale/fade and model-to-generation/year continuity.
- `GenerationCard`: horizontal/stack transition into the selected generation.
- `YearCard`: lightweight selection feedback; no heavy shared-element animation.
- `VehicleIdentityPreview`: persistent summary that updates between steps using layout/opacity transitions.
- `VehiclePickerStage`: owns step enter/exit slide/fade and direction.

Use `react-native-reanimated` as the canonical animation engine. Do not embed animation-specific fields in catalog data.

## Data scope

The curated catalog is an MVP convenience layer, not VIN certification and not an exhaustive global database. Manual entry remains mandatory for missing vehicles.
