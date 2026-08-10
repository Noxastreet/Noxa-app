# NOXA — Functional System Audit

**Parent contract:** `docs/MVP_COMPLETION_MASTER.md`

## 10. Functional system audits

### 10.1 Entry, auth and onboarding

Acceptance path:

`launch → configuration check → welcome → sign up/sign in → callback/confirmation → onboarding → visibility setup → Map`

Verify:

- [ ] no auth redirect loop;
- [ ] email sign-up and confirmation states;
- [ ] email sign-in;
- [ ] wrong password/safe error copy;
- [ ] forgot-password link;
- [ ] reset deep link and new password;
- [ ] Google auth callback;
- [ ] Apple auth path remains platform-appropriate;
- [ ] session restore;
- [ ] sign-out clears Live Drive and sensitive state;
- [ ] onboarding completion persists;
- [ ] visibility setup defaults to Ghost;
- [ ] location permission is requested only after explanation/action;
- [ ] permission refusal does not block core app access.

### 10.2 Bottom navigation

- [ ] exact order: Crews / Events / Map / Garage / Profile;
- [ ] Map is the initial psychological Home;
- [ ] active state uses more than color;
- [ ] stable icon/label geometry;
- [ ] no oversized game-like Map FAB;
- [ ] correct state preservation between tabs;
- [ ] no duplicated headers or tab bars on pushed screens.

### 10.3 Home/Map

- [ ] map initializes or shows a safe configuration/error state;
- [ ] GPS permission and current position;
- [ ] pan, zoom, rotate and recenter;
- [ ] Smart Camera does not fight user gestures;
- [ ] real driver markers only;
- [ ] real Event markers only;
- [ ] Living Pulse uses real nearby activity;
- [ ] All/Mine is a lens: others dim, not disappear;
- [ ] first driver tap opens Floating Card, not full profile;
- [ ] stranger uses IdentityOrb;
- [ ] trusted identity rule is explicit and privacy-reviewed;
- [ ] card does not freeze the map;
- [ ] selected-object close behavior;
- [ ] route loading/success/error/retry/close;
- [ ] route distance/duration;
- [ ] Follow on/off and gesture cancellation;
- [ ] Follow resets after route close;
- [ ] marker/card/route layers do not overlap controls;
- [ ] adaptive density/clustering/hotspot is truthful;
- [ ] no decorative marker movement;
- [ ] no exact speed;
- [ ] Driving Mode minimizes nonessential interaction.

### 10.4 Personal Live Drive

This is the existing four-hour sharing system, separate from Group Drive.

- [ ] Ghost safe default;
- [ ] Friends/Crew/Global audience is explained before start;
- [ ] explicit consent;
- [ ] four-hour expiry visible;
- [ ] foreground update;
- [ ] background update;
- [ ] app restart/session restore;
- [ ] stop through Ghost;
- [ ] stop through sign-out;
- [ ] denied permission;
- [ ] expired session;
- [ ] stale row handling;
- [ ] blocked users cannot see one another;
- [ ] audience changes do not silently expand;
- [ ] no collision with Group Drive names or tables.

### 10.5 Events

- [ ] list loading/empty/error/refresh;
- [ ] real images and image fallback;
- [ ] sections reflect real timing/location;
- [ ] Event detail loads current event;
- [ ] scheduled/cancelled/completed states;
- [ ] RSVP/join/cancel behavior;
- [ ] host controls only for host;
- [ ] route to Event;
- [ ] Event editor create/edit mode;
- [ ] location picker confirmation;
- [ ] date/time validation;
- [ ] publish/save duplicate prevention;
- [ ] success routes to Event detail;
- [ ] unsaved changes protected;
- [ ] event-route remains separate from future drive-route;
- [ ] frozen Event chat/gallery/summary do not leak into core flow unless explicitly classified.

### 10.6 Crews

- [ ] list loading/empty/error/refresh;
- [ ] My Crews priority;
- [ ] discovery without infinite feed;
- [ ] Crew detail real data;
- [ ] open/invite/request membership semantics;
- [ ] join, request, cancel request, accept invitation where applicable;
- [ ] leave confirmation;
- [ ] owner/admin/member controls;
- [ ] owner cannot accidentally leave/delete through common action;
- [ ] member and role visibility is correct;
- [ ] images and fallback;
- [ ] blocked users and moderation;
- [ ] V2 modules do not crowd the MVP detail screen;
- [ ] legacy convoy is not Group Drive.

### 10.7 Garage and vehicles

- [ ] empty Garage leads to Add Vehicle;
- [ ] primary vehicle first;
- [ ] vehicle list/detail uses real ownership;
- [ ] add/edit make, model, year and required fields;
- [ ] optional details are progressive;
- [ ] image picker/upload/delete/retry;
- [ ] owner-only edit/delete;
- [ ] delete confirmation;
- [ ] unsaved-change protection;
- [ ] profile and public-profile vehicle visibility match privacy rules;
- [ ] no dealership-style metric overload.

### 10.8 Profiles and social graph

- [ ] own profile identity;
- [ ] main vehicle;
- [ ] Crew/context previews;
- [ ] edit profile;
- [ ] avatar upload/fallback;
- [ ] public driver profile opens only after explicit intent;
- [ ] first map tap does not bypass Floating Card;
- [ ] follow/unfollow state;
- [ ] followers/following list if retained in MVP;
- [ ] block/report;
- [ ] blocked profile cannot expose location or social data;
- [ ] no exact location automatically shown;
- [ ] no Instagram-style vanity hierarchy.

### 10.9 Search

- [ ] keyboard-first focus and dismissal;
- [ ] query debounce/cancellation;
- [ ] supported result sections;
- [ ] loading/empty/error;
- [ ] recent searches only if real/persisted;
- [ ] result opens correct screen/map context;
- [ ] privacy filtering;
- [ ] no mock results in release candidate;
- [ ] long names and duplicate labels handled.

### 10.10 Notifications

- [ ] notification types correspond to real supported actions;
- [ ] loading/empty/error;
- [ ] unread/read state if retained;
- [ ] tapping opens exact context;
- [ ] deleted/expired target has safe fallback;
- [ ] no vanity or fake urgency;
- [ ] no mock notification dataset in release candidate;
- [ ] push delivery is separately classified if not yet implemented.

### 10.11 Settings, safety and legal

- [ ] settings rows use one list pattern;
- [ ] sign-out confirmation where needed;
- [ ] visibility/privacy entry;
- [ ] blocked users list and unblock;
- [ ] report supported entities;
- [ ] block immediately revokes visibility/access where applicable;
- [ ] Privacy Policy and Terms are readable and current;
- [ ] legal links work without broken navigation;
- [ ] Delete Account explains irreversible consequences;
- [ ] delete-account edge function behavior is verified before release;
- [ ] deletion success clears local session and sensitive tasks;
- [ ] raw backend errors are never shown.

### 10.12 Group Drive

Canonical architecture: `docs/GROUP_DRIVE.md`.

Naming:

- feature/entity: **Group Drive**;
- active fullscreen surface: **Active Drive**;
- card status: **Live**;
- never call the new feature “Live Drive”.

MVP acceptance:

- [ ] My Group Drives;
- [ ] create title/description;
- [ ] start and destination;
- [ ] invite friends and Crew-expanded individuals;
- [ ] start now or schedule;
- [ ] route review;
- [ ] limited pending invitation preview;
- [ ] Join/Decline;
- [ ] Active Drive fullscreen map;
- [ ] realtime participant positions only while session and participant are both active;
- [ ] approximate moving/stopped/arrived/stale only;
- [ ] participant leave confirmation;
- [ ] host End Drive confirmation;
- [ ] no late join;
- [ ] server-owned eight-hour expiry;
- [ ] immediate access revocation on left/removed;
- [ ] basic completed summary;
- [ ] no exact speed anywhere, including debug UI.

The design v1.1 must receive a small v1.1.1 correction before implementation:

1. pending invite uses IdentityOrb + safe nickname, not host photo;
2. one sheet controller; confirmations replace content instead of stacking sheets;
3. Minimize always routes to My Group Drives;
4. Resume Active Drive is primary when an active session exists; Create is secondary.
