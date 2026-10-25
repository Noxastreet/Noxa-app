# NOXA 1.0 — Apple App Review remediation (21–23 October 2026)

Status: **build 92 ready in TestFlight (owner reports working); App Store Review NOT YET SUBMITTED.**

Code merged to `main` from [PR #388](https://github.com/Noxastreet/Noxa-app/pull/388) on 25 October 2026. Before App Store Review, independently verify two-account sharing and blocking, and confirm build 92 is selected in App Store Connect.

- Apple rejection: 2026-10-21, iPad Air 11-inch (M3), iOS build 89
- App ID 6811355257, bundle `com.karaketidis.noxa`
- Submission `644f4b22-860c-4b7a-8f4b-c55b203bd645`
- Review issues: Guideline 5.1.1(ii) photo permission text; Guideline 5.1.2(i) 18+, privacy-policy URL, blocking, optional consent, manual sharing per session.

## Verified metadata (reported by product owner from App Store Connect screenshots)

- Age rating manually overridden to 18+; regional equivalents can differ.
- Privacy Policy URL is filled in: https://noxastreetapp.com/privacy — opened on owner's iPhone.
- In App Privacy, Photos or Videos are declared as linked to user identity, used for App Functionality; tracking marked No.
- Metadata edits do not prove implementation in build 89.

## Changes merged into main

- `app.json`: identical custom photo permission example in native Info.plist and Expo ImagePicker configuration. **New native build required.**
- `src/features/group-drive/DriveTogetherMapLayer.tsx`: separate location-sharing opt-in for hosts and invitees; joining/creating a room alone no longer starts sharing or requests Always permission.
- `src/legal/legalDocuments.ts`: 18+ age declaration; existing active Live Drive background-sharing description retained.
- `supabase/migrations/20261024222114_expire_stale_group_drive_location_reads.sql`: restrictive freshness RLS policy preventing other participants from reading Group Drive location rows older than two minutes (own row remains visible). **APPLIED to production Supabase on 24 Oct 2026 and verified.**
- `scripts/verify-apple-review-privacy.mjs`: static regression checks. Run `npm run verify:apple-review-privacy`.

Related website PR: https://github.com/Noxastreet/noxa-website/pull/134 — MERGED 24 Oct 2026, production Vercel deployment READY (commit `668b5668b9468eac59ad11cebfc5fff8ffc212b9`).

## 24–25 October 2026 build and TestFlight progress

- Website PR #134 merged and published through Vercel, commit `668b5668b9468eac59ad11cebfc5fff8ffc212b9`. Verify privacy content again before App Review.
- EAS Build `e6aad518-209a-40e8-be72-fa6813c31b52` (iOS build 90, source `009e8cee1777363028efa5419e078ea92f3ede1d`) **FAILED** with `XCODE_BUILD_ERROR`: Xcode 27.1 rejects pre-iOS-15 CocoaPods resource targets (SDWebImage, RNSVGFilters, MapboxMapsResources).
- The `production.ios.image` in `eas.json` was pinned from `latest` (Xcode 27.1) to the Expo SDK 54 compatible `macos-sequoia-15.6-xcode-26.0`.
- Corrected EAS build ID `653a5db5-0d86-425e-96ad-e7c9b289f081` **FINISHED successfully** with iOS build number **91** from source commit `d880cd6064442a33bf688cf1d8349e50ce71ea6b` (Xcode 26.0). https://expo.dev/accounts/noxastreet/projects/Noxa/builds/653a5db5-0d86-425e-96ad-e7c9b289f081
- GitHub pipeline https://github.com/Noxastreet/Noxa-app/actions/runs/40135592033 downloaded the signed IPA and verified `CFBundleIdentifier=com.karaketidis.noxa`, `CFBundleVersion=91` and `NSPhotoLibraryUsageDescription` exactly matching the approved purpose string. Its **first** EAS Submit request failed with a GraphQL scheduling error; this was **not** an iOS or IPA problem.
- One controlled retry with EAS CLI 25.3.0 checked that there were no existing submissions for the build, repeated signed IPA verification and successfully scheduled TestFlight upload: https://github.com/Noxastreet/Noxa-app/actions/runs/40136355463.
- Submission ID `2eb1c2cb-2607-4f99-a602-a9d4de090c42` subsequently reported **FINISHED** in Expo's authenticated submission list, verified at https://github.com/Noxastreet/Noxa-app/actions/runs/40136592512. https://expo.dev/accounts/noxastreet/projects/Noxa/submissions/2eb1c2cb-2607-4f99-a602-a9d4de090c42
- **Build 92** from source `882576b21ecbcd5ba03b7991fcbf3b22af9d00b4` finished successfully in Expo: https://expo.dev/accounts/noxastreet/projects/Noxa/builds/f7f2c55a-b859-49c4-968b-44aa510ac63e. GitHub CI inspected its signed IPA and confirmed photo library purpose string and bundle ID, build number 92. Workflow: https://github.com/Noxastreet/Noxa-app/actions/runs/40138387129.
- Build 92 TestFlight submission **scheduled** by EAS (not App Review): https://expo.dev/accounts/noxastreet/projects/Noxa/submissions/49962623-b3e0-4cec-bf5c-9fa7729cd3ad. Product owner reports the current TestFlight version works on their device; we have not inspected App Store Connect processing independently.
- Quality CI, isolated PostgreSQL RLS tests and branch preflight passed. `PR #388` merged into `main` via squash commit `0cfafd2ae392bacd049a3fc31dfc7a9151154d2b`.
- Production Supabase migration `20261024222114_expire_stale_group_drive_location_reads` was applied and verified in `pg_policies`. Anonymous SELECT is denied; authenticated SELECT remains restricted by active membership, mutual blocks and stale coordinate age.
- **Outstanding:** two-account physical-device tests have not been independently demonstrated; App Store Review has NOT been submitted.

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
- [x] Server: isolated temporary PostgreSQL fixture passes active participant, outsider, blocking and stale coordinate tests. Migration installed on production; restrictive policy and grants verified. No production test-user impersonation was performed.
- [x] TestFlight candidate uses build 92, not rejected build 89. Source SHA and signed IPA `Info.plist` checked by CI.
- [x] Run Quality, `npm run verify:apple-review-privacy`, existing Group Drive and Live Drive regressions; GitHub Quality passed on PR head `882576b21ecbcd5ba03b7991fcbf3b22af9d00b4`.

## Proposed App Review Notes (copy after verifying the two-account checks)

NOXA is an 18+ car and motorcycle community app.

Photo library permission is used when a person chooses a profile photo or uploads a photo to a vehicle in Garage, a post, a crew, or an event. The permission explanation in the new iOS binary names these examples.

Personal Live Drive location sharing is optional. To test: open Map, choose a non-Ghost visibility audience, confirm the sharing action, select the intended audience, confirm sharing, then select Ghost or Stop to end. NOXA may keep an explicitly active session updated in background; reopening NOXA does not automatically start a new session. Device location permission and consent to share location with other NOXA users are distinct.

Drive Together/Group Drive location is independently optional. Creating or accepting a drive invitation does not start publishing coordinates. Participants explicitly tap Share to begin, can stop sharing without leaving, and can continue using supported non-sharing features.

To block another user: open their Driver Profile, tap the upper-right safety actions menu (ellipsis), choose Block driver and confirm. To inspect/remove blocked users: Settings > Privacy & Safety > Blocked Users.

Privacy Policy: https://noxastreetapp.com/privacy

Review accounts: [supply TWO working QA accounts securely in App Store Connect Review Information if needed; do not commit passwords to Git].

## Draft response to Apple (NOT SENT)

Dear App Review Team,

Thank you for reviewing NOXA: Car & Moto 1.0.

**5.1.1(ii)** — We have revised the iOS photo library usage description to explain that photos are selected by users for profile pictures and uploads to Garage, posts, crews, and events. This change is included in the signed iOS binary for build **1.0 (92)**; automated inspection of the IPA confirmed the text.

**5.1.2(i)** — The App Store Connect age rating has been overridden to 18+. Our privacy policy URL is https://noxastreetapp.com/privacy. The application includes blocking from Driver Profile > safety actions > Block driver and Settings > Privacy & Safety > Blocked Users. Personal Live Drive visibility requires a separate opt-in. Drive Together joining and location sharing are separate choices; participants use Share and Stop. Server access rules enforce active membership, blocks, and stale position limits. Please refer to the reproduction steps provided in App Review Notes. [Add real-device/two-account test results if verified.]

We have included specific review steps in App Review Notes. Thank you for reconsidering our submission.

Best regards,
NOXA Development Team

Do **not** send the response or submit the app until the placeholders are replaced and the checklist is completed.

## Remaining decision / external blockers

- The mobile PR #388 is **merged into main**. Website PR #134 is merged and Vercel deployment previously reached READY.
- Signed build **92** Info.plist has been verified in CI. User reports build works in TestFlight, but 2-device/2-account security verification remains outstanding.
- Website is deployed but re-check external public `/privacy` content before final Apple submission.
- Server migration is applied with an isolated RLS test and post-application policy checks complete.
- App Store Connect / Resolution Center changes have not been made here because no authenticated App Store Connect action is available; the account owner must select build 92 and submit after QA.
