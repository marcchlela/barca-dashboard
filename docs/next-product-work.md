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

- Monitor the official beIN SPORTS Arabic YouTube ingestion on later fixtures. The bounded worker checks only the verified channel, fixture publication window and highlight titles; GOAL video metadata remains a fallback. It does not replace official FC Barcelona media used for goal timestamps.
- Monitor automatic post-match player-performance recovery on a newly finished real fixture. Big Balls ratings remain preferred, while StatsHawk safely fills minutes, goals, assists, shots, passing and defensive fields when ratings are unavailable.
- If local development needs hands-free polling, add an explicit opt-in runner with the same cooldowns and free-tier limits; `next dev` currently runs the web app only.
