# NOXA 1.0 — Apple App Review remediation (21–23 October 2026)

Status: **PREPARATION ONLY — NOT READY TO RESUBMIT**

- Apple rejection: 2026-10-21, iPad Air 11-inch (M3), iOS build 89
- App ID 6811355257, bundle `com.karaketidis.noxa`
- Submission `644f4b22-860c-4b7a-8f4b-c55b203bd645`
- Review issues: Guideline 5.1.1(ii) photo permission text; Guideline 5.1.2(i) 18+, privacy-policy URL, blocking, optional consent, manual sharing per session.

## Verified metadata (reported by product owner from App Store Connect screenshots)

- Age rating manually overridden to 18+; regional equivalents can differ.
- Privacy Policy URL is filled in: https://noxastreetapp.com/privacy — opened on owner's iPhone.
- In App Privacy, Photos or Videos are declared as linked to user identity, used for App Functionality; tracking marked No.
- Metadata edits do not prove implementation in build 89.

## Changes in this branch

- `app.json`: identical custom photo permission example in native Info.plist and Expo ImagePicker configuration. **New native build required.**
- `src/features/group-drive/DriveTogetherMapLayer.tsx`: separate location-sharing opt-in for hosts and invitees; joining/creating a room alone no longer starts sharing or requests Always permission.
- `src/legal/legalDocuments.ts`: 18+ age declaration; existing active Live Drive background-sharing description retained.
- `supabase/migrations/20261023181500_expire_stale_group_drive_location_reads.sql`: drafted restrictive freshness RLS policy preventing other participants from reading Group Drive location rows older than two minutes (own row remains visible). **Not deployed.**
- `scripts/verify-apple-review-privacy.mjs`: static regression checks. Run `npm run verify:apple-review-privacy`.

Related website PR: https://github.com/Noxastreet/noxa-website/pull/134

## Acceptance checklist (A and B are distinct test accounts)

- [ ] iPhone and iPad: photo picker shows custom message, matching the archived `NSPhotoLibraryUsageDescription`. Verify both profile and Garage; also posts, crew, events where available.
- [ ] A declines iOS location permission and NOXA sharing consent: B cannot obtain A's location; A can still use features not requiring location.
- [ ] A allows system location but chooses Ghost: B cannot obtain precise coordinates via app, REST, or private Realtime.
- [ ] A starts an explicit four-hour personal Live Drive for a chosen audience: authorized B sees A; unauthorized viewers do not.
- [ ] A selects Ghost/Stop or session expires: server location is deleted or made inaccessible; stale cached markers disappear.
- [ ] A blocks B during active sharing: B immediately loses access to A through REST and private Realtime; test existing channel subscriptions as well as fresh attempts.
- [ ] Cold-launch / force-close / iOS background / network disconnect-reconnect: no *new* sharing session starts without deliberate action; an already-enabled session can continue in background while authorized.
- [ ] Drive Together: creating a room and accepting an invitation do **not** automatically share. Each participant explicitly taps Share to enable; refusal preserves room and map use.
- [ ] Drive Together: stopping, leaving, ending a session and losing authorization prevents further location exposure; test delayed cleanup if offline.
- [ ] Server: deploy migration to a controlled environment first; assert live member sees recent allowed rows, blocked viewer cannot see rows, and no viewer sees old Group Drive rows after the freshness window. Production deployment requires explicit approval.
- [ ] TestFlight builds must use **new build**, not the rejected build 89. Identify source commit and test the archived IPA's Info.plist.
- [ ] Run Quality, `npm run verify:apple-review-privacy`, existing Group Drive and Live Drive regressions; record exact results.

## Proposed App Review Notes (send only after verification)

NOXA is an 18+ car and motorcycle community app.

Photo library permission is used when a person chooses a profile photo or uploads a photo to a vehicle in Garage, a post, a crew, or an event. The permission explanation in the new iOS binary names these examples.

Personal Live Drive location sharing is optional. To test: [provide verified UI path to Map > visibility > Start], select the intended audience, confirm sharing, then select Ghost or Stop to end. NOXA may keep an explicitly active session updated in background; reopening NOXA does not automatically start a new session. Device location permission and consent to share location with other NOXA users are distinct.

Drive Together/Group Drive location is independently optional. Creating or accepting a drive invitation does not start publishing coordinates. Participants explicitly tap Share to begin, can stop sharing without leaving, and can continue using supported non-sharing features.

To block another user: [provide verified UI path: open Driver Profile > ... > Block]. To inspect/remove blocked users: [provide verified Settings > Privacy & Safety > Blocked users path].

Privacy Policy: https://noxastreetapp.com/privacy

Review accounts: [supply TWO working QA accounts securely in App Store Connect Review Information if needed; do not commit passwords to Git].

## Draft response to Apple (NOT SENT)

Dear App Review Team,

Thank you for reviewing NOXA: Car & Moto 1.0.

**5.1.1(ii)** — We have revised the iOS photo library usage description to explain that photos are selected by users for profile pictures and uploads to Garage, posts, crews, and events. This change is included in [NEW BUILD NUMBER, PENDING FINAL VERIFICATION].

**5.1.2(i)** — The App Store Connect age rating has been overridden to 18+. Our privacy policy URL is https://noxastreetapp.com/privacy. We have reviewed user blocking, explicit opt-in for personal and Group Drive location sharing, a refusal path, manual initiation of each new sharing session, and stop/expiry/restart behaviors. [ADD VERIFIED RESULTS AND DEVICE DETAILS AFTER QA.]

We have included specific review steps in App Review Notes. Thank you for reconsidering our submission.

Best regards,
NOXA Development Team

Do **not** send the response or submit the app until the placeholders are replaced and the checklist is completed.

## Remaining decision / external blockers

- The mobile PR and website PR are drafts. Main branches and production are unchanged.
- Actual `Info.plist` / physical iOS builds / Apple App Store Connect build linkage not tested.
- Website privacy changes need review, merge and a successful deployment before Apple tests the public URL.
- Server migration requires tests and explicit production authorization.
- Apple review submission and messages require product-owner approval.
