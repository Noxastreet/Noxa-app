# 07 — NOXA MVP Screen Plan

## Назначение

Этот документ переводит продуктовые решения NOXA в последовательный план редизайна и реализации всех экранов MVP.

Цель — не «перерисовать всё приложение», а собрать единый продукт из повторно используемых компонентов, сохранить рабочую логику и выпускать изменения небольшими проверяемыми PR.

## Общие критерии для каждого MVP-экрана

Экран считается готовым только когда определены и проверены:

- одна основная задача пользователя;
- одно главное действие;
- ясная визуальная иерархия;
- loading / empty / error состояния;
- длинный текст и реальные данные;
- клавиатура и safe area;
- Android small/medium screen;
- доступность интерактивных элементов;
- навигация назад;
- отсутствие визуальных конфликтов;
- TypeScript и ESLint;
- runtime evidence.

## Release Wave 0 — UI Foundation

### Цель

Создать минимальный набор общих компонентов до массового изменения экранов.

### Компоненты

- `NoxaButton` v2;
- `NoxaIconButton`;
- `NoxaTopBar`;
- `NoxaSegmentedControl`;
- `NoxaCard`;
- `NoxaSheet`;
- `NoxaInput`;
- `NoxaListRow`;
- `NoxaEmptyState`;
- `NoxaLoadingState`;
- `NoxaToast`;
- `IdentityOrb`;
- общие motion tokens;
- общие screen paddings и content widths.

### Принцип

Сначала фундамент на 2–3 реальных экранах. Затем массовое переиспользование. Не создавать большой абстрактный design system без runtime-проверки.

---

# Release Wave 1 — Entry, Auth, Onboarding

## 1. Welcome

**Файл:** `app/welcome.tsx`

**Задача:** за несколько секунд объяснить, что NOXA соединяет водителя с реальной автомобильной жизнью рядом.

**Основное действие:** `Get started` / регистрация.

**Вторичное:** вход в существующий аккаунт.

**Правки:**

- убрать перегруженную футуристичность;
- сохранить один сильный бренд-момент;
- один визуальный фокус;
- минимальный текст;
- CTA в стабильной нижней зоне;
- учитывать маленькие Android-экраны;
- не показывать функции как сетку меню.

## 2. Sign in

**Файл:** `app/sign-in.tsx`

**Задача:** быстро и без двусмысленности войти.

**Основное действие:** `Sign in`.

**Правки:**

- единый `NoxaInput`;
- корректные keyboard types и autofill;
- inline validation;
- понятное состояние загрузки;
- восстановление пароля как вторичное действие;
- ошибки Supabase переводить в безопасный пользовательский текст.

## 3. Sign up

**Файл:** `app/sign-up.tsx`

**Задача:** создать аккаунт с минимальным количеством решений.

**Основное действие:** `Create account`.

**Правки:**

- не смешивать регистрацию с полным профилем;
- email/password и необходимые согласия;
- ясное подтверждение email;
- одинаковый визуальный язык с Sign in.

## 4. Forgot / Reset password

**Файлы:**

- `app/forgot-password.tsx`;
- `app/reset-password.tsx`.

**Задача:** восстановить доступ без ощущения ошибки или наказания.

**Основное действие:** отправить ссылку / сохранить новый пароль.

**Правки:**

- общий auth shell;
- явные success states;
- безопасное возвращение к Sign in;
- защита от повторных нажатий.

## 5. Product onboarding

**Файл:** `app/onboarding.tsx`

**Задача:** объяснить только основное:

1. люди рядом;
2. Events / Meets;
3. Crews;
4. карта и поездка к активности.

**Основное действие:** продолжить.

**Правки:**

- 3–4 шага максимум;
- один тезис на экран;
- не повторять маркетинговый сайт;
- не просить разрешения до объяснения пользы;
- не использовать декоративные карусели ради эффекта.

## 6. Visibility Setup

**Целевой файл:** `app/visibility-setup.tsx`

**Задача:** до первой публикации позиции ясно объяснить Ghost / Friends / Crew / Global.

**Основное действие:** безопасно продолжить в выбранном режиме.

**Правила:**

- Ghost — безопасный default;
- permission запрашивается только после явного действия;
- аудитория и 4-часовой срок видны до подтверждения;
- отказ не блокирует вход в приложение.

---

# Release Wave 2 — Core Navigation and Home

## 7. Bottom Navigation

**Файл:** `app/(tabs)/_layout.tsx`

**Порядок:** Crews / Events / Map / Garage / Profile.

**Правки:**

- единый `NoxaBottomNav` визуальный контракт;
- Map остаётся центральной вкладкой без игрового oversized FAB;
- активное состояние читается не только цветом;
- корректная safe area;
- минимум blur/glass;
- никакой прыгающей геометрии при смене вкладки.

## 8. Home / Map

**Файл:** `app/(tabs)/index.tsx`

**Канон:** `03-home-map-mvp-spec.md`.

**Задача:** показать жизнь рядом и дать перейти к реальному действию.

**Главное действие:** `Еду сюда` для конкретной активности.

**Фазы:**

1. Identity / Living Pulse / Все–Мои;
2. Floating Card для выбранного водителя;
3. privacy-aware Identity Orbs и adaptive density;
4. Smart Camera и truthful hotspot;
5. `Еду сюда`;
6. Driving Mode ограничения.

**Не допускать:**

- повторных counters;
- прямого открытия полного профиля по первому тапу;
- фейковой активности;
- автоматического включения Live;
- перегруженного набора фильтров;
- социального взаимодействия во время движения.

## 9. Search

**Файл:** `app/search.tsx`

**Задача:** найти место, Event, Crew или пользователя без превращения Home в поисковый экран.

**Основное действие:** открыть выбранный результат в контексте.

**Правки:**

- recent searches только при реальной пользе;
- секции результатов по типу;
- ясное empty state;
- keyboard-first UX;
- возвращение на карту с выбранным объектом;
- не показывать результаты, нарушающие privacy.

---

# Release Wave 3 — Events

## 10. Events list

**Файл:** `app/(tabs)/events.tsx`

**Задача:** быстро понять, что происходит сегодня и скоро.

**Основное действие:** открыть Event.

**Правки:**

- приоритет `Tonight / Soon / Nearby`, а не сложная сетка категорий;
- одна понятная карточка Event;
- дата, время, место, расстояние и честный social context;
- skeleton/loading;
- empty state для города без Events;
- создание Event — отдельное вторичное действие.

## 11. Event details

**Файл:** `app/event-details.tsx`

**Задача:** решить, стоит ли ехать.

**Основное действие:** `Еду сюда` или подтверждённый MVP-аналог.

**Вторичные:** Route, Save/Share при наличии.

**Иерархия:**

1. что это;
2. когда и где;
3. кто/сколько реально участвует;
4. почему это релевантно;
5. действие.

**Правки:**

- hero не должен выталкивать главную информацию;
- sticky action zone;
- карта/маршрут остаются связанными с Home;
- отменённый или завершённый Event имеет честное состояние.

## 12. Create / Edit Event

**Файл:** `app/event-editor.tsx`

**Задача:** опубликовать реальный Event без длинной административной формы.

**Основное действие:** Publish / Save.

**Поля MVP:**

- title;
- category;
- date/time;
- venue/location;
- short description;
- optional image.

**Правки:**

- пошаговое или секционное раскрытие без лишних экранов;
- map picker с явным подтверждением;
- валидация до публикации;
- success state с переходом к Event details;
- draft protection.

---

# Release Wave 4 — Crews

## 13. Crews list

**Файл:** `app/(tabs)/crews.tsx`

**Задача:** увидеть свои Crews и найти релевантные локальные сообщества.

**Основное действие:** открыть Crew.

**Правки:**

- `My Crews` имеет приоритет;
- discovery ниже, без бесконечной ленты;
- карточка показывает цель Crew, локальность и реальную активность;
- создание Crew — вторичное действие;
- пустое состояние помогает найти или создать Crew.

## 14. Crew details

**Файл:** `app/crew/[id].tsx`

**Задача:** понять Crew и выполнить главное действие: Join / Open current activity / Manage.

**Правки:**

- один hero/header;
- краткое описание;
- участники и текущая активность;
- upcoming Events;
- Garage preview только при реальной ценности;
- admin controls отделены от обычного режима;
- не превращать экран в dashboard из десяти модулей.

### V2 Crew modules — не блокируют MVP

- `app/crew-chat.tsx`;
- `app/crew-gallery.tsx`;
- `app/crew-calendar.tsx`;
- `app/crew-polls.tsx`;
- `app/crew-garage.tsx`;
- advanced roles/invitations beyond required basics.

---

# Release Wave 5 — Garage

## 15. Garage

**Файл:** `app/(tabs)/garage.tsx`

**Задача:** показать автомобили пользователя как часть личности, а не каталог характеристик.

**Основное действие:** открыть основной автомобиль или добавить первый.

**Правки:**

- primary vehicle first;
- минимум карточек и метрик;
- фото, make/model/year и несколько значимых деталей;
- empty state должен вести к добавлению автомобиля;
- не использовать dealership-style UI.

## 16. Vehicle details

**Файл:** `app/vehicle-details.tsx`

**Задача:** показать автомобиль и его историю/характер в понятной иерархии.

**Основное действие владельца:** Edit.

**Правки:**

- сильное изображение;
- ключевая спецификация компактно;
- модификации без перегруженной таблицы;
- owner/private controls не видны чужому пользователю;
- long-content scroll без вложенных карточек в карточках.

## 17. Vehicle editor

**Файл:** `app/vehicle-editor.tsx`

**Задача:** добавить или изменить автомобиль с минимальным количеством полей.

**Основное действие:** Save.

**Правки:**

- make/model/year сначала;
- фото отдельно;
- optional details раскрываются прогрессивно;
- delete — отдельная destructive zone;
- защита от потери несохранённых изменений.

---

# Release Wave 6 — Profile and Trust

## 18. Profile

**Файл:** `app/(tabs)/profile.tsx`

**Задача:** показать личность пользователя и быстрый доступ к управлению аккаунтом.

**Основное действие владельца:** Edit profile.

**Иерархия:**

1. identity;
2. main vehicle;
3. Crews / real activity context;
4. settings entry.

**Правки:**

- vanity metrics не становятся главным фокусом;
- профиль не копирует Instagram;
- точная геолокация и Live status не раскрываются автоматически;
- settings не смешиваются с публичным профилем.

## 19. Public driver profile

**Файл:** `app/driver-profile/[id].tsx` или актуальный route.

**Задача:** понять, кто это, после явного более глубокого намерения.

**Правки:**

- progressive identity;
- shared Crew/friend context выше автомобиля;
- privacy-aware sections;
- block/report доступны, но не конкурируют с содержанием;
- никаких прошлых маршрутов и movement history.

## 20. Edit profile

**Файл:** `app/edit-profile.tsx`

**Задача:** изменить основные данные без смешивания с privacy settings.

**Основное действие:** Save.

**Правки:**

- avatar, display name, username, short bio;
- inline validation;
- уникальность username;
- отдельная зона для privacy/settings links.

---

# Release Wave 7 — Utility and Account Safety

## 21. Notifications

**Файл:** `app/notifications.tsx`

**Задача:** показать только события, требующие внимания или объясняющие изменение состояния.

**Правки:**

- группировка по времени;
- read/unread без агрессивных badges;
- переход к конкретному контексту;
- честное empty state;
- никакого engagement spam.

## 22. Settings

**Файл:** `app/settings.tsx`

**Секции:**

- account;
- privacy and visibility;
- notifications;
- blocked users;
- legal;
- sign out;
- delete account.

**Правки:**

- стандартные list rows;
- destructive actions внизу;
- отсутствие декоративных карточек для каждой строки;
- значения текущих privacy modes видны до входа в подпункт.

## 23. Blocked users

**Файл:** `app/blocked-users.tsx`

**Задача:** просмотреть и при необходимости разблокировать.

**Правки:**

- нейтральная формулировка;
- подтверждение unblock;
- отсутствие social pressure.

## 24. Delete account

**Файл:** `app/delete-account.tsx`

**Задача:** безопасно и понятно удалить аккаунт.

**Правки:**

- объяснить последствия;
- не использовать guilt patterns;
- явное подтверждение;
- обработать повторную аутентификацию, если требуется;
- success exit.

## 25. Privacy Policy / Terms

**Файлы:**

- `app/privacy-policy.tsx`;
- `app/terms-of-service.tsx`.

**Правки:**

- читабельная типографика;
- корректный scroll;
- версия/дата документа;
- открытие внешних ссылок безопасно;
- никаких декоративных блоков, мешающих чтению.

---

# Замороженные V2-экраны

Эти экраны могут существовать в коде, но не получают приоритет редизайна до завершения MVP:

- `app/social-list.tsx`;
- `app/event-chat.tsx`;
- `app/event-gallery.tsx`;
- `app/event-summary.tsx`;
- `app/crew-chat.tsx`;
- `app/crew-gallery.tsx`;
- `app/crew-calendar.tsx`;
- `app/crew-polls.tsx`;
- `app/crew-garage.tsx`;
- `app/convoy-setup.tsx`;
- `app/post-editor.tsx`;
- `app/post-details.tsx`;
- advanced scoped coordination / Plan Card / Result Card flows.

Исключение — критический баг, блокирующий существующий MVP-путь.

# Порядок реализации PR

1. UI Foundation pilot.
2. Entry/Auth/Onboarding.
3. Home/Map phases.
4. Events.
5. Crews core.
6. Garage.
7. Profile and public identity.
8. Settings, safety, legal.
9. Whole-MVP consistency pass.
10. Android acceptance build.

Каждый PR должен менять один связный пользовательский путь, а не одновременно пять несвязанных экранов.