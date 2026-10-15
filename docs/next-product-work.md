# Next product work

This list records requested follow-up work. It does not activate any service or change current data ownership.

## Push notifications

- Add installable-app support, browser permission handling, and a per-user opt-in.
- Store Web Push subscriptions per account and device, with revocation and quiet-hour controls.
- Offer separate choices for matchday reminder, confirmed squad/lineup, kickoff, goals, cards, half time, full time, and media availability. Send only after the canonical event is confirmed; deduplicate corrections and retries.
- Test delivery on iOS and Android home-screen installs and on desktop before asking users to enable notifications.

## Barça Femení

- Model the women's first team as a separate team scope across squad, fixtures, competitions, standings, statistics, match media, and personal selections.
- Audit free provider coverage first and keep women's and men's records, title counts, and provider identities distinct.

## Camp Nou experience

- Continue the pre-renovation 3D Camp Nou: architectural detail, VIP boxes, tunnel, benches, roof, lighting, advertising, seat-view navigation, and WASD pitch walk.
- Validate visual references and model rights, then optimize and test the full experience on mobile and reduced-motion devices.

## Mobile polish

- Audit every primary page at narrow widths, including long names, score rows, filters, dialogs, horizontal carousels, safe areas, focus, and touch targets.

## Matchday squad source

- The current Galatasaray selection is curated from an official article. Build a reusable discovery and review pipeline for later official squad announcements so new fixtures do not require code changes.

## Additional match coverage

- Add verified beIN SPORTS Arabic highlights as an optional external broadcaster link, alongside (not in place of) official FC Barcelona YouTube media. The current GOAL video endpoint returned no Galatasaray–Barça videos, and the beIN website does not expose a stable permitted feed that the app can safely ingest. Use a manually verified official link or a future authorized feed; do not scrape/guess URLs or treat it as the YouTube highlight required for goal timestamps.
- Monitor the automatic Big Balls post-match ratings recovery on a newly finished real fixture. It retries absent Barça ratings with persisted cooldowns and protects existing canonical/manual rows; team statistics and lineups alone are not treated as ratings.
- If local development needs hands-free polling, add an explicit opt-in runner with the same cooldowns and free-tier limits; `next dev` currently runs the web app only.
