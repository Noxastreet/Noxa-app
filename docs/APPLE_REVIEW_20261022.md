# Apple review remediation — 22 October 2026

Status: **NO-GO for submission** until the evidence below is complete.
Legal-copy changes are a proposed release draft, not a legal opinion. Confirm
the effective date and jurisdiction-specific requirements before publication.

## Scope and evidence

Submission `644f4b22-860c-4b7a-8f4b-c55b203bd645`, version 1.0 (89),
was rejected on 21 October under 5.1.1(ii) and 5.1.2(i).
Source baseline: `359a20ea9f1afb1acac2192214377dc77694794f`.
The mapping from build 89 to its source commit remains unverified.

This MVP compliance change preserves map, consent, blocking and background
location behavior, following AGENTS.md's explicit scoped consent requirement.
It sets a specific iOS photo purpose string and aligns the proposed age
eligibility to 18 in the bundled and static legal pages. Dependencies, signing
and identifiers are unchanged. A new native iOS binary is required.

## Checks performed

- TypeScript: PASS (`npx tsc --noEmit`).
- ESLint: zero errors, eight warnings in unchanged files.
- Expo introspected iOS Info.plist: exact custom photo string survives plugins.
- Existing `test-live-drive-offline-stop.mjs`: PASS (mocked smoke).
- Existing `test-group-drive-account-isolation.mjs`: PASS (mocked smoke).
- Physical iOS/iPadOS/Android: NOT RUN; native permission UI is not proven.
- Live backend policies / two-account location access: NOT VERIFIED here.

## Store changes required

| Field | Required action | Evidence still needed |
| --- | --- | --- |
| Age Rating | Accurately answer questionnaire; set 18+ override if needed | Saved rating; existing value could not be read |
| Privacy Policy URL | Keep working app-specific URL `https://noxastreetapp.com/privacy` | New website draft deployed and link checked without login |
| Photos or Videos | Review as linked to user for account avatars / vehicle photos; App Functionality | Reconcile all media uses with submitted build |
| Other App Privacy categories | Reconcile precise location, identifiers, content, analytics with actual flows | Full data inventory; do not guess tracking answers |
| Business / DSA | Verify trader declaration and any outstanding agreements | Account holder evidence if documents requested |
| Review Information | Valid reviewer credentials and clear reproduction steps | Test account verified; never put credentials in this repository |

The current website claims personal sharing stops in the background, whereas
this source explicitly supports active personal background sessions. The paired
website PR corrects that disclosure. Do not publish claims about an older binary
without checking its behavior first.

## Device acceptance and reviewer walkthrough

Record release commit, build number, device/OS, time and outcome for each case.
Use two test accounts A/B, not real users' location or personal content.

1. Clean install on iPhone and iPad: onboarding → Add photo. Confirm the exact
   explanation; test deny, limited access and allow; onboarding remains usable.
2. Sign in to A, open Map. Before any sharing consent, B must not see A.
3. Select a visibility audience. Verify “Stay visible while driving?” explains
   precise location, audience, background use and four-hour expiry. Cancel must
   keep A invisible; Continue starts only with necessary device permissions.
4. Confirm A appears only to the chosen audience. Change audience: require
   explicit confirmation without resetting the existing session's expiry.
5. Select Ghost. Verify B loses A's presence, including cached/realtime views.
   Repeat while A is offline; verify bounded server visibility and later cleanup.
6. Test expiry, sign-out, force-close/cold restart and permission revocation.
   No new sharing session may start without another manual action. Distinguish
   continuing an already-consented session in background from a new check-in.
7. B's driver profile → ellipsis → Block driver → Block. Verify profiles/content
   and Live Drive access are removed in both directions, not just button state.
   Recheck after app restart and through realtime updates.
8. Test Group Drive separately: joining alone must not grant location sharing;
   cancel consent, stop, leave, end, account switch and restart must preserve
   scope and prevent unauthorized restoration. Verify backend enforcement.
9. Open policy and terms from Settings. Confirm readable scrolling, working
   links, accurate age and location disclosure. Repeat relevant flows on Android
   before merge as required by AGENTS.md.

No PASS may be inferred solely from code or mocked tests. Record failures and
fix only reproduced defects; do not duplicate existing controls speculatively.

## Response draft — not sent

Dear App Review Team,

Thank you for reviewing NOXA: Car & Moto, version 1.0 (build 89).
We are preparing a revised submission addressing Guidelines 5.1.1(ii) and
5.1.2(i), including a specific photo library purpose string and the required
18+ rating. Our privacy policy is available at
https://noxastreetapp.com/privacy.

We are verifying user blocking, explicit location-sharing consent with an
option to decline, and manual activation of each new sharing session in the
release build. Our resubmission will provide the build number and precise
review steps for these safeguards.

Could you clarify whether the blocking or location-consent controls were
unavailable, difficult to locate, or did not work as expected in build 89?
Reproduction steps would help us address your findings accurately.

Best regards,
NOXA Development Team

Before sending the final resubmission response, replace future-tense statements
with verified results and exact build/steps. Do not claim completed testing until
it has occurred. Owner approval is required for Apple communication/submission.
