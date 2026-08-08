# NOXA — UI Foundation and Universal Screen Audit

**Parent contract:** `docs/MVP_COMPLETION_MASTER.md`

## 8. Shared component and token audit

### 8.1 Available foundations

Current repository contains:

- `NoxaAvatar`;
- `NoxaBadge`;
- `NoxaButton`;
- `NoxaCard`;
- `NoxaDivider`;
- `NoxaEmptyState`;
- `NoxaFloatingActionButton`;
- `NoxaFloatingCard`;
- `NoxaHeader`;
- `NoxaIconButton`;
- `NoxaInput`;
- `NoxaListRow`;
- `NoxaLoadingState`;
- `NoxaScreen`;
- `NoxaSectionTitle`;
- `NoxaSegmentedControl`;
- `NoxaSheet` visual shell;
- `NoxaTopBar`;
- `IdentityOrb`;
- color, spacing, radius, typography, shadow and animation tokens.

Their presence is not proof of cross-screen correctness. Each component needs real usage, state coverage and device evidence.

### 8.2 Missing or incomplete shared contracts

Before broad screen polishing, resolve:

- [ ] `NoxaBottomNav` canonical contract or a clearly documented tab-layout implementation.
- [ ] `NoxaToast` or one approved feedback mechanism.
- [ ] `NoxaSheetController`: portal/modal ownership, backdrop, Android Back, focus restoration, pan gesture, scroll boundary and Reduced Motion.
- [ ] `DriverPin` for general Map privacy/density.
- [ ] Group Drive `DriverPin` status variant without route-accent collision.
- [ ] Group Drive Route Summary block.
- [ ] Participant Status Row.
- [ ] Stale/Offline indicator.
- [ ] Destructive confirmation content contract.
- [ ] consistent image loading/error fallback.
- [ ] consistent form validation and unsaved-change guard.
- [ ] a single error-sanitization pattern.
- [ ] a single loading/skeleton policy.
- [ ] real Reduced Motion behavior, not documentation only.

### 8.3 Component acceptance checklist

Every reusable interactive component must define:

- [ ] normal;
- [ ] pressed;
- [ ] focused where applicable;
- [ ] selected;
- [ ] disabled;
- [ ] loading;
- [ ] error;
- [ ] success where meaningful;
- [ ] long text;
- [ ] large text;
- [ ] 44×44 minimum target or equivalent hit slop;
- [ ] accessibility role, label, state and hint;
- [ ] Reduced Motion behavior;
- [ ] safe use on dark surfaces and over map imagery.

### 8.4 Cleanup candidates

The repository contains duplicate/legacy foundation surfaces:

- root `components/` Expo starter components;
- `constants/theme.ts` beside `src/theme`;
- `App.tsx.backup`;
- `package.json.backup`;
- multiple logo component generations;
- mock datasets under `src/data`.

Do not delete these blindly. First produce a reference/import audit. Remove only items proven unused, with a separate reversible commit.

## 9. Global screen audit checklist

Every MVP screen must pass all applicable items.

### 9.1 Product and hierarchy

- [ ] one explicit user job;
- [ ] one primary action;
- [ ] secondary actions are visually quieter;
- [ ] destructive actions are isolated and confirmed;
- [ ] no feature or metric exists only to make the screen look busy;
- [ ] content order answers the user’s immediate decision;
- [ ] no contradictory terminology across screens.

### 9.2 Visual system

- [ ] canonical background/surface/text/accent tokens;
- [ ] canonical spacing and radius scale;
- [ ] consistent top bar and horizontal padding;
- [ ] no one-off button/card/input when a shared primitive fits;
- [ ] no random gradients, glow, glass or shadows;
- [ ] no nested card-on-card dashboard composition without necessity;
- [ ] primary CTA geometry remains stable while loading;
- [ ] long labels clamp or wrap intentionally;
- [ ] real content is visually stronger than decorative chrome.

### 9.3 Navigation

- [ ] all entry paths are defined;
- [ ] back behavior is deterministic;
- [ ] Android hardware/gesture back is correct;
- [ ] modal and sheet back behavior is safe;
- [ ] deep links resolve correctly;
- [ ] auth/onboarding gates cannot loop;
- [ ] no dead route or hidden mandatory step;
- [ ] tab bar visibility is correct on pushed/fullscreen screens;
- [ ] destructive action is never encoded as ordinary Back/Close/Minimize.

### 9.4 States

- [ ] initial loading;
- [ ] refresh/retry;
- [ ] empty;
- [ ] partial data;
- [ ] error with sanitized copy;
- [ ] offline where relevant;
- [ ] stale/realtime-disconnected where relevant;
- [ ] permission denied/restricted where relevant;
- [ ] unauthenticated/session-expired where relevant;
- [ ] image loading/failure;
- [ ] successful action;
- [ ] cancelled/destructive completion;
- [ ] no layout shift between loading and content.

### 9.5 Forms

- [ ] correct keyboard type;
- [ ] autofill/autocomplete;
- [ ] submit from keyboard where appropriate;
- [ ] inline validation;
- [ ] server errors mapped to safe copy;
- [ ] duplicate submit prevented;
- [ ] loading disables only affected controls;
- [ ] unsaved changes protected;
- [ ] image upload progress/failure/retry;
- [ ] date/time and timezone semantics explicit;
- [ ] destructive delete is separate from Save.

### 9.6 Accessibility

- [ ] minimum target size;
- [ ] icon-only labels;
- [ ] meaningful reading order;
- [ ] dynamic text without clipping;
- [ ] state not conveyed by color only;
- [ ] focus moves correctly into/out of modals;
- [ ] Reduced Motion honored;
- [ ] Reduced Transparency honored where relevant;
- [ ] contrast remains sufficient over maps and images;
- [ ] screen-reader copy describes consequence, not icon appearance.

### 9.7 Android and iOS layout readiness

Before device testing, static implementation must account for:

- [ ] small Android width around 348 px;
- [ ] medium Android;
- [ ] notches/status bars;
- [ ] Android gesture/navigation inset;
- [ ] iPhone safe areas;
- [ ] keyboard resize and dismissal;
- [ ] system font scaling;
- [ ] rotation policy explicitly supported or locked;
- [ ] platform-specific Apple/Google auth visibility;
- [ ] native permission copy and configuration.
