# 04 — MVP / V2 Boundary

## Purpose

Защитить первый релиз от бесконечного расширения социальной системы и сохранить фокус на главной ценности: живой карте и переходе к реальному действию.

## MVP — обязательное ядро

### Home / Map

- Smart Camera;
- Living Pulse в Top Bar и на карте;
- Lens `Все / Мои`;
- адаптивные Driver Pins и кластеризация;
- Identity Orb для незнакомцев;
- Floating Card для Drivers, Events и Meets;
- сохранение живого контекста карты во время preview;
- честные empty / low-density states.

### Core action

- `Еду сюда` для конкретной активности или точки;
- переход к маршруту по явному действию;
- понятный статус участия;
- отсутствие скрытого включения точной геолокации.

### Existing product areas

- Crews;
- Events / Car Meets;
- Garage;
- Profile;
- route/follow;
- базовые настройки видимости;
- block/report;
- production-ready auth and data flows.

### Group Drive — обязательная часть MVP

**Решение Product Owner (Stage 0A finalization): Group Drive входит в MVP и не является V2.**

Group Drive — это **последняя крупная функциональная система MVP**. Она обязательна, но не прерывает текущий порядок работ:

1. privacy P0 (подтверждение расширения аудитории активного персонального Live Drive);
2. Visual Architecture V2 foundation и пять reference experiences;
3. Group Drive как финальная крупная функция MVP;
4. статический MVP release candidate;
5. физическая Android/iOS runtime-валидация.

Каноническая архитектура и границы: `docs/GROUP_DRIVE.md`. Каноническая терминология: **Group Drive** — функция/сущность, **Active Drive** — полноэкранный runtime, **Live** — только статус, **Live Drive** — исключительно существующая персональная функция временного шеринга геопозиции.

Group Drive **не является** развитием Crew Convoy. `app/convoy-setup.tsx` и таблицы `crew_convoys`/`crew_convoy_participants` остаются frozen/legacy V2 и не переиспользуются как домен Group Drive.

Статус MVP-required **не** авторизует production-изменения Supabase: схема, RLS, RPC и Edge Function Group Drive проходят отдельный scoped review и существующие production-гейты. Реализация начинается только после явной авторизации.

### Quality gate

MVP не считается готовым только потому, что компонент существует в коде. Нужны:

- проверка актуального `main`;
- production Supabase evidence;
- Android runtime test;
- отсутствие критических UX и privacy regressions;
- стабильная производительность карты.

## V2 — не блокирует MVP

- 👋 между незнакомцами;
- mutual 👋 flow;
- scoped coordination chat;
- Coordination / Plan Card;
- предложения нейтральной точки встречи;
- подтверждение реальной встречи двумя сторонами;
- Result Cards;
- автоматическое ненавязчивое предложение постоянной связи;
- сложные временные Live-аудитории;
- синтетическое присутствие внутри больших публичных Meets;
- Pioneer status и исторические городские статусы;
- расширенная репутация, если она вообще будет доказана безопасной и полезной;
- **Crew Convoy** (`app/convoy-setup.tsx`, `crew_convoys`) — остаётся frozen/legacy V2 и не переиспользуется как домен Group Drive. Group Drive, в отличие от Crew Convoy, входит в MVP.

## Explicitly out of scope for MVP

- постоянный мессенджер как основная часть продукта;
- публичные social scores;
- сложная система доверия с множеством состояний;
- автоматическое определение факта встречи;
- фоновое раскрытие точного маршрута;
- отдельная сущность `Public Meet Point`;
- новые типы карты, не необходимые для Home Loop;
- декоративные анимации ради ощущения технологичности.

## Delivery order

1. Аудит текущего Home/Map и runtime.
2. Удаление визуального и функционального шума.
3. Top Bar и информационная иерархия.
4. Driver Pin / cluster system.
5. Floating Card behavior.
6. Living Pulse и честные состояния.
7. `Еду сюда` и route flow.
8. Privacy / visibility pass.
9. Performance pass.
10. Android acceptance test.

## Stop rule

Любая новая идея проходит один вопрос:

> Нужна ли она, чтобы пользователь увидел реальную активность рядом и безопасно перешёл к конкретному действию?

Если нет — она документируется для V2 и не входит в текущую реализацию.
