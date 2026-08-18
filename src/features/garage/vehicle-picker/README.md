# NOXA Vehicle Picker architecture

The vehicle picker is shared by Garage and future onboarding and supports multiple vehicle types without duplicating the flow.

## Supported vehicle types

MVP:

- `car`
- `motorcycle`

The first picker step is vehicle type. The remaining flow reuses the same semantic stages:

`type → make → model → optional generation → year → color → photo → confirm`

Do not create a separate `MotorcyclePicker`. Cars and motorcycles share the picker shell, selection state, selectors and animation infrastructure while keeping separate catalog datasets.

## Separation rule

Keep these layers separate:

1. **Catalog data** — vehicle-type-specific make/model/generation/year facts and stable ids.
2. **Picker state** — current step, vehicle type and selected ids.
3. **Selectors** — convert catalog records into typed picker items.
4. **UI cards** — visual presentation for one item kind.
5. **Motion** — animation behavior keyed by stable motion identity.

Visible text must never be used as a React key or shared-transition identity.

## Stable identity

Examples:

- `vehicle-picker:type:car`
- `vehicle-picker:type:motorcycle`
- `vehicle-picker:make:car:bmw`
- `vehicle-picker:make:motorcycle:yamaha`
- `vehicle-picker:model:car:bmw:3-series`
- `vehicle-picker:model:motorcycle:yamaha:mt-07`
- `vehicle-picker:generation:car:bmw:3-series:e46`
- `vehicle-picker:year:car:bmw:3-series:e46:2004`

Vehicle type is part of all downstream motion identities. This prevents collisions when the same manufacturer name exists in both catalogs (for example Honda or Suzuki).

Changing copy, localization or sort order must not change these identities.

## Planned UI component boundaries

Do not collapse the public picker UI into one giant universal card component.

- `VehicleTypeCard.tsx`
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

- `VehicleTypeCard`: car/motorcycle selection and first-stage transition.
- `MakeCard`: selection scale/fade and make-to-model continuity.
- `ModelCard`: selection scale/fade and model-to-generation/year continuity.
- `GenerationCard`: horizontal/stack transition into the selected generation.
- `YearCard`: lightweight selection feedback; no heavy shared-element animation.
- `VehicleIdentityPreview`: persistent summary that updates between steps using layout/opacity transitions.
- `VehiclePickerStage`: owns step enter/exit slide/fade and direction.

Use `react-native-reanimated` as the canonical animation engine. Do not embed animation-specific fields in catalog data.

## Catalog boundaries

- Car data: `completeVehicleCatalog`, assembled from the curated catalog phases.
- Motorcycle data: `motorcycleCatalog`, assembled from the core and phase 2 datasets.
- Cross-type access: `vehicleCatalogRegistry`.

Motorcycle generation metadata is intentionally optional. Do not invent generation steps solely for visual consistency; if a bike can be selected cleanly by model and year, the picker skips generation.

## Data scope

The curated catalogs are MVP convenience layers, not VIN certification and not exhaustive global databases. Manual entry remains mandatory for missing vehicles, rare trims and regional variants.
