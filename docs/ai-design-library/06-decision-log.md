# 06 — Consolidated Decision Log

## Product

- **D01 — North Star:** «Ты не один в своей страсти. Прямо сейчас рядом есть свои».
- **D02 — Social catalyst:** NOXA существует для реальных поездок, встреч и совместных действий, а не для потребления контента.
- **D03 — People before cars:** машина создаёт контекст; человек создаёт связь.
- **D04 — Fewer decisions:** интерфейс уменьшает число решений на каждом шаге.
- **D05 — Reality is Home:** карта является окном в живую локальную реальность, а не меню функций.
- **D06 — Honest density:** пустота, малая плотность и активность всегда показываются честно.
- **D07 — Depth before breadth:** сначала пять функций на 10/10.
- **D08 — Local before global:** масштабирование не должно разрушать ощущение локального сообщества.

## Home loop

- **D09 — Primary questions:** есть ли жизнь → где мои люди → что ценно сейчас → еду сюда.
- **D10 — Living Pulse:** главный ambient-сигнал — реальное количество активных водителей поблизости.
- **D11 — Main action:** `Еду сюда` привязано к конкретной активности или точке.
- **D12 — Empty city:** несколько реальных пользователей не называются пустотой; допустим честный статус «один из первых».

## Top Bar

- **D13 — Left:** Identity Control показывает собственное присутствие и видимость.
- **D14 — Center:** Living Pulse, а не логотип или название города.
- **D15 — Right:** Lens `Все / Мои`, а не поиск, колокольчик или меню настроек.
- **D16 — Lens behavior:** персонализация выделяет, но не скрывает честную картину города.

## Camera and map

- **D17 — Smart Camera:** базовый кадр ориентирован на пользователя; релевантная активность включается в первый кадр только когда она реально существует.
- **D18 — User remains oriented:** пользователь не теряет себя из вида.
- **D19 — One-time automation:** автоматическое смещение камеры не продолжается после ручного управления.
- **D20 — Object priority:** люди → Crews → Meets/Events → businesses.
- **D21 — Overload removal:** бизнесы исчезают первыми, люди последними или агрегируются.

## Motion

- **D22 — Two motion layers:** ambient Living Pulse и event-driven движение конкретных объектов.
- **D23 — Data drives motion:** персональный объект двигается только при реальном обновлении.
- **D24 — Reality never stops:** карточки меняют фокус, но не замораживают карту и данные.

## Pins and privacy

- **D25 — Human pin:** в разреженном состоянии пин представляет человека, а не автомобиль.
- **D26 — Adaptive density:** avatars/orbs → simplified pins → clusters/Living Pulse.
- **D27 — Stranger default:** незнакомец видит нейтральный Identity Orb, не реальный аватар.
- **D28 — Progressive identity:** лицо и имя раскрываются только в пределах явной доверенной связи и настроек пользователя.
- **D29 — Separate permissions:** identity, communication and exact location are separate permissions.

## Floating Card

- **D30 — Context preserved:** карта остаётся видимой и живой.
- **D31 — Spatial continuity:** карточка раскрывается из пина и схлопывается обратно.
- **D32 — Three-block rule:** карточка показывает только три главных информационных блока.
- **D33 — Known contact:** связь → контекст/дистанция → автомобиль.
- **D34 — Stranger:** никнейм + активность → приблизительный контекст → автомобиль.
- **D35 — No tracking history:** прошлые перемещения и точная дистанция незнакомца не показываются.

## Location

- **D36 — Explicit Live consent:** точная геолокация никогда не включается скрыто.
- **D37 — One-tap scoped consent:** подтверждение может быть лёгким, но обязано показать аудиторию, цель и срок.
- **D38 — Participation independent:** отказ от Live-sharing не блокирует участие.
- **D39 — Audience does not expand silently:** новые участники группы не получают доступ автоматически.
- **D40 — Public Meet privacy:** публичное участие показывает присутствие, но не обязано показывать персональную GPS-точку.

## Social trust — V2

- **D41 — Low-stakes hello:** 👋 является обратимым первым сигналом, не запросом дружбы.
- **D42 — Mutual 👋:** открывает temporary scoped coordination, но не личность и не постоянный чат.
- **D43 — Coordination lifecycle:** канал живёт только пока существует конкретная цель.
- **D44 — Structured Plan state:** Plan Card — состояние Coordination Card, а не новый продукт.
- **D45 — Neutral rendezvous:** предлагаются реальные нейтральные POI, не персональные позиции.
- **D46 — Mutual meeting confirmation:** один предлагает факт, второй подтверждает.
- **D47 — Honest result:** без взаимного подтверждения сохраняется только факт согласованного плана.
- **D48 — No automatic social graph:** неподтверждённые планы не укрепляют связь.
- **D49 — Relationship suggestion:** после повторных подтверждённых действий система может один раз ненавязчиво предложить постоянную связь.
- **D50 — No automatic location trust:** постоянная связь не даёт бессрочный точный доступ к местоположению.

## Scope decision

- **D51 — MVP boundary:** Home/Map, Living Pulse, Lens, Smart Camera, adaptive pins, Floating Card, `Еду сюда`, route/follow, базовая приватность.
- **D52 — V2 boundary:** 👋, scoped chat, Plan/Result Cards, подтверждение встреч, сложные аудитории и relationship suggestions.
- **D53 — Stop rule:** редкие сценарии документируются, но не продолжают бесконечную цепочку вопросов и не блокируют MVP.

## Current status

Product and Home/Map architecture are sufficiently defined for implementation planning. The next work item is repository/runtime audit followed by an implementation plan and PRs. New philosophical questions require a concrete implementation blocker; otherwise they go to backlog.
