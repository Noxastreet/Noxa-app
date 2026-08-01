# 08 — UI Foundation and Library Policy

## Цель

Выбрать устойчивую основу для кнопок, bars, sheets, cards и анимаций NOXA без разрушительной миграции существующего Expo-приложения.

## Текущий технический контекст

Канонический проект использует:

- Expo SDK 54;
- React Native 0.81.5;
- React 19.1;
- Expo Router;
- TypeScript;
- StyleSheet-based components;
- собственные tokens в `src/theme`;
- собственные primitives в `src/components/ui`;
- `react-native-reanimated` 4.1.1;
- `react-native-worklets`;
- `react-native-gesture-handler`;
- Mapbox и Supabase.

Следовательно, библиотека оценивается не по красоте showcase, а по стоимости интеграции, совместимости, доступности, владению кодом и влиянию на существующий runtime.

# Рассмотренные варианты

## 1. React Native Reusables

### Сильные стороны

- shadcn-like подход;
- компоненты добавляются в проект и остаются под контролем команды;
- хорошие базовые patterns для Button, Select, Dialog, Tabs и других primitives;
- использует React Native Reanimated;
- адаптирован к ограничениям native platforms;
- можно preview-компоненты на устройстве.

### Риски для NOXA

- требует NativeWind или Uniwind;
- добавляет Tailwind-like styling и конфигурацию поверх текущего StyleSheet/token подхода;
- portal components требуют отдельный PortalHost;
- прямое смешивание с текущими `Noxa*` components создаст два design system.

### Решение

**Primary external reference, not a global runtime migration.**

Использовать как источник проверенных component anatomy, state models и accessibility patterns. Не запускать глобальный `init` и не переводить приложение на NativeWind/Uniwind в MVP.

Отдельный primitive может быть адаптирован в NOXA-owned component только после isolated pilot и перевода на `src/theme` tokens.

## 2. gluestack-ui

### Сильные стороны

- copy/paste modular philosophy;
- Expo and React Native support;
- Button, Actionsheet, Bottomsheet, Tabs, Toast, Form primitives;
- управляемые состояния и accessibility patterns;
- подходит для выборочного добавления компонентов.

### Риски для NOXA

- современная установка также добавляет styling engine, provider и конфигурационные файлы;
- NativeWind/Uniwind создаёт второй styling architecture;
- Actionsheet/animation stack может добавить дополнительные зависимости;
- default visual language не является NOXA и всё равно потребует полной token adaptation.

### Решение

**Secondary reference.** Рассматривать отдельный component implementation только когда React Native Reusables не покрывает требуемый native interaction pattern.

Не выполнять глобальный `gluestack-ui init` в MVP.

## 3. Tamagui

### Сильные стороны

- мощный cross-platform styling engine;
- typed themes and variants;
- compiler optimizations;
- широкий набор styled and unstyled components;
- единый подход для native and web.

### Риски для NOXA

- фактически заменяет текущую styling architecture;
- требует миграции tokens, components, provider and build setup;
- слишком большой scope для уже работающего приложения;
- усложняет проверку текущих Mapbox, auth и routing flows.

### Решение

**Rejected for MVP migration.** Может рассматриваться только как отдельное архитектурное решение после выпуска стабильного MVP.

## 4. React Native Reanimated

### Сильные стороны

- уже установлен и используется;
- Expo SDK 54 рекомендует ветку 4.1.1;
- UI-thread animations;
- gesture-friendly interaction;
- layout, entering/exiting and shared-value animations;
- поддержка system Reduced Motion.

### Решение

**Canonical animation engine for NOXA MVP.**

Не добавлять Moti, Legend Motion или вторую общую animation abstraction без доказанной необходимости.

## 5. @gorhom/bottom-sheet

### Сильные стороны

- зрелая gesture interaction model;
- dynamic sizing;
- keyboard handling;
- scrollable integration;
- modal and sheet patterns.

### Риск

Текущая официальная документация v5 указывает совместимость Reanimated v1–3, тогда как NOXA находится на Reanimated 4.1.1.

### Решение

**Do not adopt now.** Вернуться к оценке после официально подтверждённой совместимости с используемой версией Reanimated или отдельного native proof-of-concept без изменений production flow.

# Итоговое решение

## Архитектура

NOXA сохраняет собственный UI layer:

```text
src/theme
  colors
  typography
  spacing
  radius
  shadows
  animations

src/components/ui
  NoxaButton
  NoxaIconButton
  NoxaTopBar
  NoxaSegmentedControl
  NoxaCard
  NoxaFloatingCard
  NoxaSheet
  NoxaInput
  NoxaListRow
  NoxaEmptyState
  NoxaLoadingState
  NoxaToast
  IdentityOrb
```

### External library roles

- **React Native Reusables:** primary component-pattern reference;
- **gluestack-ui:** secondary pattern reference for complex native primitives;
- **React Native Reanimated:** actual animation runtime;
- **Tamagui:** no MVP migration;
- **@gorhom/bottom-sheet:** paused until compatibility proof.

# Foundation Pilot

Первый UI Foundation PR должен изменить не всё приложение, а небольшой вертикальный slice.

## Pilot components

1. `NoxaButton` v2;
2. `NoxaIconButton`;
3. `NoxaSegmentedControl`;
4. `NoxaTopBar`;
5. базовый `NoxaSheet` без новой несовместимой dependency;
6. motion tokens and Reduced Motion handling.

## Pilot screens

- Sign in;
- Settings;
- один компактный control на Home/Map после завершения текущего map PR.

Эти экраны выбраны потому, что проверяют:

- формы;
- primary/secondary/destructive buttons;
- list rows;
- top bars;
- segmented control;
- accessibility;
- keyboard;
- safe areas;
- dark theme;
- motion without map regression.

# Button contract

`NoxaButton` должен поддерживать:

- variants: primary, secondary, ghost, danger, overlay;
- sizes: small, medium, large;
- leading/trailing icon;
- loading without layout shift;
- disabled;
- full width;
- pressed feedback;
- haptics only for meaningful actions;
- accessibility label/hint;
- Reduced Motion-safe feedback.

Не использовать bounce как default. Press feedback — короткое уменьшение/opacity or elevation change без игровой энергии.

# Bar contract

## Top Bar

- предсказуемая высота;
- safe-area aware;
- left / center / right slots;
- одна primary title or signal;
- icon buttons 44 × 44 hit area;
- не смешивать несколько строк controls без необходимости.

## Bottom Navigation

- пять канонических tabs;
- стабильная геометрия;
- active state читается формой/weight и цветом;
- Map выделен приоритетом, но не превращается в отдельный floating game button;
- keyboard hides bar where appropriate;
- no decorative motion loops.

## Segmented Control

- максимум 2–4 коротких варианта;
- selection moves spatially and predictably;
- state remains clear with Reduced Motion;
- не использовать вместо navigation tabs.

# Motion tokens — working defaults

Конкретные значения проходят native tuning, но единый характер обязателен:

- press feedback: 90–140 ms;
- micro state transition: 140–220 ms;
- card/sheet transition: 220–360 ms;
- map camera transitions use separate navigation logic;
- low or no overshoot;
- system Reduced Motion respected.

Motion duration не является причиной задерживать действие пользователя.

# Dependency gate

Новая UI dependency разрешена только когда PR содержит:

1. повторяющуюся проблему минимум в трёх MVP-экранах;
2. доказательство, что существующие primitives не решают её разумно;
3. Expo SDK 54 / RN 0.81 / Reanimated 4 compatibility evidence;
4. bundle/configuration impact;
5. Android proof-of-concept;
6. migration and removal plan;
7. no duplicate design-system architecture.

# Acceptance

UI Foundation считается принятой только когда:

- компоненты выглядят единообразно на нескольких реальных экранах;
- TypeScript и ESLint проходят;
- Android keyboard, gestures and safe areas проверены;
- loading/disabled/error states работают;
- Reduced Motion не ломает понимание состояния;
- Mapbox и Live Drive не получили regression;
- компоненты документированы примерами и не требуют screen-level one-off styles.