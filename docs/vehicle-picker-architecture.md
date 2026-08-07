# NOXA Vehicle Picker Architecture

## Purpose

The vehicle picker is shared product infrastructure for Garage and future onboarding. It must stay easy to animate without coupling visual transitions to catalog strings or Supabase rows.

## Layer boundaries

```text
vehicle catalog data
        ↓
vehicle catalog registry
        ↓
picker selectors
        ↓
picker state / selection
        ↓
semantic UI components
        ↓
motion choreography
```

Do not merge these layers into one component.

## Semantic components

Keep public UI responsibilities distinct even when they share a small private visual frame:

- `VehicleTypeCard` — Car / Motorcycle.
- `PopularMakeCard` — compact promoted manufacturer treatment.
- `MakeCard` — manufacturer list treatment.
- `ModelCard` — model treatment.
- `GenerationCard` — generation treatment.
- `YearCard` — year treatment.
- `ColorCard` — normalized color treatment.
- `VehiclePhotoCard` — optional cover-photo treatment.
- `VehicleIdentityPreview` — compact persistent selection summary.
- `VehiclePickerStage` — stage header/layout boundary.
- `VehicleFinalizeFlow` — Color → Photo → Save orchestration after catalog identity selection.

`PickerCardFrame` is private visual plumbing. Do not replace all semantic components with a single exported `OptionCard`.

## Motion identity

Visible labels are not animation keys. Always use stable IDs from the catalog and include the vehicle type.

Examples:

```text
vehicle-picker:type:car
vehicle-picker:type:motorcycle
vehicle-picker:make:car:bmw
vehicle-picker:make:motorcycle:yamaha
vehicle-picker:model:car:bmw:3-series
vehicle-picker:generation:car:bmw:3-series:e46
vehicle-picker:year:car:bmw:3-series:e46:2004
vehicle-picker:color:black
vehicle-picker:photo:cover
```

This prevents shared-transition collisions when the same manufacturer exists in both catalogs or labels change later.

## Persistence boundary

Catalog choice and persistence are intentionally separate:

```text
VehiclePicker
Type → Make → Model → optional Generation → Year → Confirm
        ↓
VehicleFinalizeFlow
Color → optional Photo → final confirmation → Save
        ↓
vehicles + vehicle-images
```

`brand` and `model` remain display snapshots in `vehicles`. Stable `catalog_make_id`, `catalog_model_id`, and optional `catalog_generation_id` preserve catalog identity. `vehicle_type` is `car | motorcycle`.

Quick add does not require horsepower. Performance/build details remain optional follow-up work in Garage.

Production schema support is migration `20260807153807_extend_vehicles_for_catalog_picker.sql`.

## Future animation rule

Add Reanimated motion around the semantic components only after static runtime behavior is accepted. Catalog helpers and persistence functions must remain animation-agnostic.
