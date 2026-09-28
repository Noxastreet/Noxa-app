# NOXA — аудит main и Phase 1

Дата: 2026-09-22. Задача: [#306](https://github.com/Noxastreet/Noxa-app/issues/306).
Исполнитель: Codex. Приёмка: Сергей, Product Owner.
Проверенный источник: `main@0f225d07da3f6e3d9e622798d48242de431a1763`.
Это аудит кода, не подтверждение runtime. Визуальные выводы ниже требуют сравнения с устройством.

## Решение Product Owner

Целевое направление: automotive social + spatial; `Map | Explore | Activity | Profile`.
Create — действие внутри соответствующего контекста. Feed, infinite feed, видео, Reels, Stories и алгоритмическая лента исключены.
Существующие сущности, сервисы, приватность и working flows сохраняются.

Это новое решение заменяет историческую пяти-вкладочную **целевую** структуру в `AGENTS.md` и старой дизайн-библиотеке. Фактическая навигация в Phase 1 остаётся прежней; её изменение относится к Phase 2. Запреты на историю перемещений, скрытое согласие и расширение MVP сохраняются.

## Источники и расхождения

- GitHub main содержит последний merge #303 от 2026-09-18, удаляющий оставшиеся поверхности истории посещений.
- Открытые PR #305 (56 коммитов), #304 (25), #297 (176), #296 (40) и #300 не являются main. Количество — из GitHub на момент аудита; это не число новых независимых функций.
- Последняя установленная пользователем сборка и её SHA в этой сессии не установлены. Нельзя переносить её runtime-оценку на main или эту ветку.
- Notion Control Center прочитан. Верхний checkpoint от 18 сентября описывает routing #299; ниже есть противоречащие более новым данным исторические main/статусы. Для кода используется проверенный GitHub SHA, для нового направления — текущее задание пользователя.
- Старые PR не объединялись, изменения из них не переносились. Перед будущим merge нужно заново проверить main и пересечение с параллельными ветками.

## Реальная архитектура

В main: 56 route-файлов `.tsx` и 3 layout-файла в `app/`. Наличие route не подтверждает доступность или правильность сценария.

| Область | Текущая реализация | Следствие |
| --- | --- | --- |
| Запуск | `App.tsx` → env gate / splash → `ExpoRoot` | Сохраняем порядок запуска и конфигурацию |
| Навигация | `app/_layout.tsx`: Stack, SafeAreaProvider, auth refresh, recovery links; `app/(tabs)/_layout.tsx`: auth/onboarding/visibility gate, PushNotificationBridge, Tabs | Нельзя просто заменить tabs и потерять gates / deep links |
| Root tabs | Crews, Events, Map (`index`), Garage, Profile | Explore и Activity пока отдельные страницы, не root tabs |
| Map | `app/(tabs)/index.tsx` → `MapboxLiveMapCompat` → `MapboxLiveMap` | Главная карта уже absolute-fill; UI расположен поверх неё |
| Native map | `src/features/mapbox/config.ts`, `MapboxLiveMap.tsx`: Standard, StyleImport basemap, Camera, LocationPuck, route ShapeSource | Standard / 3D / follow сохраняются; их код здесь не меняется |
| Другие карты | Active Drive повторно использует `MapboxLiveMapCompat`; Event preview и location picker имеют отдельные MapView реализации | Единого постоянно смонтированного MapView для всех пространственных flows в main нет. Не устранять это скрыто в Phase 1 |
| Location | `src/lib/liveDrive.ts`, `group-drive/runtime/nativeLocation.ts`, `localNavigationLocation.ts` | Personal sharing, Group Drive sharing и local navigation разделены; конкурентность требует device-проверки, не предположений |
| Group Drive | `app/group-drives/*` + API/types/lobby/runtime в `src/features/group-drive` | Создание разнесено по details / route / participants / schedule / review; lobby и active — отдельные routes |
| Events / Crew | Tab wrappers → `src/features/crews-events/Canonical*Screen.tsx`; детали и utility routes отдельно | Существующая бизнес-логика сохраняется; локальные CanonicalPrimitives отличаются от общих Noxa-компонентов |
| Profile / Garage | `app/(tabs)/profile.tsx`, `garage.tsx`, driver/vehicle detail/editor routes | Identity, vehicle, связи и grid фотографий уже существуют; profile grid показывает первые 6 posts |
| Explore | `app/search.tsx`: People, Vehicles, Crews, Events; запросы к существующим таблицам | Можно использовать существующий поиск, не строить новую API-систему |
| Activity | `app/notifications.tsx`, push bridge, Group Drive invitation routes | Inbox уже использует строки и реальные social/invitation данные; не нужен новый dashboard |
| Данные | Общий `src/lib/supabase.ts`; screen-level queries + выделенный Group Drive API | Используются profiles / vehicles / posts / crews / events и drive entities; локальные типы проекций не означают новые таблицы |
| UI | `src/theme/*`, `src/components/ui/*`, StyleSheet, Reanimated | Существующую основу улучшаем; новая UI-библиотека не нужна |

Маршруты по группам: auth/onboarding; пять tabs; profile/driver/social/settings/legal; vehicle; crew; event; photo; search/notifications; Group Drive. Полный файловый список остаётся в `app/`, без создания второго router inventory, который придётся синхронизировать вручную.

## Причины проблем, подтверждённые кодом

| Наблюдение | Доказательство | Фаза исправления |
| --- | --- | --- |
| Общие primitives не задают единый визуальный язык | `NoxaHeader` и `NoxaTopBar`, `CanonicalPrimaryButton`, локальные screen-level buttons и typography | Phase 1 задаёт основу; adoption по очереди в соответствующих фазах |
| Слабая читаемость и чрезмерная насыщенность | NoxaListRow: label 14/800, caption 10/600, value 12/800; NoxaInput: label 11, uppercase, textSubtle; TopBar/Sheet: condensed 900 | Phase 1 |
| Нестабильная кнопка при загрузке | Spinner заменяет leading icon / добавляется перед текстом, trailing icon удаляется; sm minHeight 32 | Phase 1 |
| Декоративные контейнеры и motion в строках | NoxaListRow: отдельная закруглённая подложка иконки и scale всей строки при нажатии | Phase 1 |
| Визуальные правила расходятся с реальными экранами | Profile использует крупный vehicle block, много локальных 800/900 и метаданных 8–10; Crew/Event имеют собственные pills/artwork/buttons | Phase 4 и соответствующие узкие follow-ups, без миграции всех экранов |
| Map marker hierarchy зависит прежде всего от числа объектов | `DRIVER_CLUSTER_LIMIT = 80`; до порога используются MarkerView с allowOverlap; кластерный tap сразу return | Phase 3: измерение плотности/zoom/performance и точечное исправление |
| Пространственные сценарии дробятся на страницы | Group Drive wizard и Active Drive — отдельные маршруты; native MapView существует в нескольких contexts | Phase 3 только presentation; lifecycle/API остаются существующими |
| Документация и ветки дают разные представления продукта | Старые five-tab rules, незавершённые большие PR и устаревшие Notion checkpoints | Явный SHA и новый phased gate вместо объединения всех веток |

## План и критерии перехода

Каждая фаза — один ограниченный PR или последовательность независимых PR внутри её scope. Следующая фаза начинается только после проверки и приёмки текущей.

| Фаза | Изменение | Gate |
| --- | --- | --- |
| 0 | Аудит main и текущей архитектуры | Code evidence зафиксирован здесь; runtime не заявляется |
| 1 | Общая типографика и состояния существующих контролов | Static checks, JS bundles, iPhone + Android visual/interaction acceptance |
| 2 | Map / Explore / Activity / Profile shell; существующие экраны и gates | Deep links, cold/warm launch, Back, roundtrip tabs, physical iPhone, Android navigation |
| 3 | Map UX: поиск, выбранный объект, zoom hierarchy, contextual sheets | Native map/camera/location, actual device performance, continuity; без изменения Drive lifecycle |
| 4 | Profile identity/vehicle/crew/events/garage/photo hierarchy | Реальные собственный/чужой profiles, empty/error, CRUD regression, device visual acceptance |
| 5 | Explore через текущие данные/поиск | Поиск по четырём сущностям, stale/empty/offline, правильные destinations; no Feed |
| 6 | Activity как компактный operational inbox | Invitations/read state/context links, repeated taps, delivery и восстановление |
| 7 | Связи между стабильными областями | Object → Map → route; owner links; Back/context сохранены; privacy regression |

## Phase 1: foundation contract

| Элемент | Решение |
| --- | --- |
| Typography | Роли в существующем `typography`: 30 screen / 20 section / 16 body / 14 secondary+control / 12 metadata; regular, medium, semibold. System family в изменённых primitives. Legacy scalar/v2 значения остаются для немигрированных screens |
| Spacing | Существующие 4/8/12/16/24/32; новые shared sheet paddings 16. Не менять глобально `spacing.lg=20`, чтобы не затронуть все screens |
| Radius | Существующие button/input 12, sheet top 20. Legacy `radius.sheet=28` оставлен, поскольку его использует Map |
| Colors | Существующие near-black/graphite/white/grey/red; палитра не заменяется. Labels используют textMuted, error имеет читаемый текст и красную границу |
| Button | sm target 44; content остаётся в layout при loading, spinner расположен поверх; busy блокирует нажатие и не приглушает primary background |
| Input / Search | Улучшен существующий NoxaInput, включая его использование в place search. Отдельного search-компонента нет: новый не создаётся; Explore screen-local search рассматривается в Phase 5 |
| Top bar | Существующий NoxaTopBar: 20 semibold / 14 secondary; side slots сохранены. NoxaHeader и screen-local headers мигрируются позже |
| List row | Текст 16/14, обычная иконка без карточки, minHeight 56 + адаптивная высота; pressed background без scale |
| Sheet | NoxaSheet остаётся presentational View, не gesture engine. Обновлены padding/type. В main нет его call sites; drag/snap/keyboard не заявляются реализованными |
| Tab bar | Root shell остаётся в существующем `_layout`. No NoxaBottomNav duplicate. Контракт следующей фазы: четыре tabs, стабильные hit areas, label+icon selected state, keyboard/safe areas |
| Icons / segments | NoxaIconButton уже имеет обязательную label и min 44: API сохранён. Segment target увеличен до 44, веса 500/600; у NoxaSegmentedControl также нет текущих call sites |

Изменены только `src/theme/typography.ts`, шесть существующих UI primitives и этот документ. Screen-файлы, services, native configuration, dependencies, backend и workflows не менялись.

## Риски и приёмка

Shared primitive влияет на все существующие call sites. Отсутствие diff в Map/Auth/Group Drive не доказывает отсутствие визуальной регрессии там.

- NoxaInput затрагивает Auth, onboarding, editors и Mapbox location search: проверить keyboard, password visibility, focused/error/disabled, multiline, длинные названия и font scaling.
- NoxaButton используется широко, включая Map actions: проверить sm/md/lg, no/leading/trailing icons, busy/disabled, долгий запрос, длинный title и narrow layouts. Стабильность loading относится к одинаковому title/icons до и после: вызывающий экран может сам менять текст.
- NoxaTopBar затрагивает Settings/Event detail/Group Drive: проверить названия, subtitle, Back и safe areas.
- NoxaListRow затрагивает Settings и location suggestions: проверить все строки, длинные значения, destructive action и видимость результатов с открытой клавиатурой.
- NoxaSheet и SegmentedControl проверяются отдельно перед первым runtime adoption; отсутствие consumers не является runtime PASS.
- Protected smoke: cold start → sign in/session restore → существующие tabs → Profile/Garage → Map Standard/3D → route/follow/manual pan → sign out. Не начинать sharing без явного consent.
- Physical iPhone и Android: обычный и увеличенный текст, Reduced Motion, VoiceOver/TalkBack, repeated taps, no-data/error, foreground/background. Записать SHA, build, модель, OS и результаты.
- Никакие EAS/TestFlight builds не запускались этим изменением. JS export не является signed build или device runtime.
- Merge и переход к Phase 2 запрещены до acceptance. Откат — revert единственного foundation-коммита; данные/миграции не затронуты.

## Проверки

- VERIFIED — TypeScript; ESLint: 0 errors, 3 warnings в неизменённых файлах; Expo Doctor: 18/18.
- VERIFIED (static only) — interaction wiring, AUTH flow, Home/Map disclosure, Home/Map performance contract, Group Drive Phase 5.
- VERIFIED (bundle only) — `CI=1 npx expo export --platform ios --platform android`: обе Hermes JS-сборки созданы, 2289 iOS / 2298 Android modules. Это не native binary/runtime.
- NOT VERIFIED — native visual result, keyboard, loading geometry на устройстве, touch/gesture behavior, screen-reader behavior и protected-flow runtime regression.
- BLOCKED — итоговая приёмка Phase 1: в этой сессии нет управляемого физического iPhone/Android и подтверждённой установленной candidate-сборки.
- Exact PR CI: результат фиксируется в PR после завершения проверки.

Design review: **Approve with changes** — три приоритета: читаемость, стабильный loading, спокойные строки; нужен visual acceptance на устройстве. QA verdict: **BLOCKED для завершения Phase 1**. Следующий шаг: приёмка именно этого isolated candidate; не начинать Phase 2.
