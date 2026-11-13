# NOXA 1.0 – TestFlight acceptance / 2026-11-13

Release candidate: `release/testflight-qa-20261113`; PR #399.
Signed iOS build: pending at the time this checklist was authored. No App Store Review submission is authorized.

## Important release gate

Production Supabase project `Noxa` (project ref `wzfpwuyyaotvofdijhin`) does **not** yet have the two new driver Broadcast migrations / RPC. Do not infer Live Drive correctness or publish publicly from a TestFlight install. The database migration, verified backup/rollback, recycling cached Realtime channels, and multi-account revocation tests must be completed as a coordinated cutover. No live database changes are performed by this QA workflow.

## Visual and interaction review on iPhone

- [ ] Launch, login and relaunch without onboarding loop or crash. Confirm app is build > 92.
- [ ] Map is initially selected. Five bottom tabs are labelled: Crews, Events, Map, Garage, Profile.
- [ ] Navigate rapidly between all tabs: no clipped controls, jumpy animation, stuck spinners, stale activity or broken back actions.
- [ ] Check visibility audience and countdown are readable (Ghost/Friends/Crew/Public), including without an avatar. Do not start location sharing with real people for this preliminary visual pass.
- [ ] Visibility menu opens, scrolls and closes without silently changing selection; selected state does not rely only on color.
- [ ] Driver activity: loading vs unavailable vs successful zero have distinct copy; retry retains previously known markers.
- [ ] 200% larger text (iOS Settings > Accessibility > Display & Text Size > Larger Text): tabs, headers, menu, long list bottom clearances, modals remain accessible.
- [ ] VoiceOver/Reduce Motion: tabs read once with selected state and navigation works.
- [ ] Create/edit post, vehicle, crew/event with a tagged photo; verify orientation, color/quality, and no duplicate upload; inspect uploaded EXIF on a separate device if feasible.

## After the coordinated server migration and backend acceptance

- [ ] Physical iPhone + Android, two test accounts A/B and outsider C. New smooth location samples only reach authorized viewers.
- [ ] Block, unfollow, remove crew, narrow audience: formerly authorized viewers immediately stop receiving new coordinates, including already-connected private channels.
- [ ] Ghost, Stop, logout, app background, offline stop/recovery, force-quit, and quick re-login do not resurrect location.
- [ ] Group Drive Join **does not** start sharing; Share explicitly does; Stop stops without leaving; coordinates expire/evict properly.
- [ ] Measure 2-second RPC latency and error rate; check no publication backlog or unexpected Supabase costs.

## Release decision

Do not merge PR #399 to `main` or submit App Store Review until physical-device screenshots/accessibility, real multi-account revocation, compatible production schema, signed TestFlight processing, and the above high-priority scenarios are accepted. Document build number, failures, test device versions and verified database migration IDs in the PR.
