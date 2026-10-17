# FC Barcelona Dashboard

A self-hosted, FC Barcelona–focused **Stadium Control Room**: matchdays, squad profiles, real-data analytics, historical Club museum, curated Barça media, and a personal supporter archive.

> **Project status (October 11, 2026):** Active development. The app is deployed on a private Ubuntu home server and was confirmed reachable publicly through Tailscale Funnel. Sign-up works, but the public-access security audit and account-isolation checks are not complete. This repository is not yet documented as a turnkey public deployment.

## What it includes

- **Overview:** Match Stage, Barça Pulse, Season Story, Home/Away/Third kit themes, and cinematic Camp Nou tunnel intro.
- **Matches:** Fixtures/results, competition filters and logos, match detail navigation, and FIFA Career Mode–inspired calendar.
- **Match Center:** Lineups, event timeline, team/player stats, official media, and account-owned **My Match** diary (watched, watch type/date, rating, Man of the Match, favourite goal, notes).
- **Squad:** Verified 2026/27 first-team roster, official portraits, captain treatment, player Quick View, form/rating charts, and real stored player heatmaps.
- **Analytics:** 20-club League Race, observed season trends, competition/home-away splits, player comparison and heatmaps. Unavailable data is not invented.
- **Club:** Museum foyer, five-stop trophy walk, 128-season historical index, season exhibits, identity chapter, and a first playable Blender-built Camp Nou explorer. Its stand sightlines are approximate, not an official seat map.
- **Media:** Screening room, curated/historical films, searchable library, watch-later/favourites, and reviewed exact-goal links when verified.
- **My Barça:** Personal archive, ratings diary, favourite players and top-three matches, season story.
- **Accounts:** Email/username signup and sign-in; `user`/`admin` roles and server sessions. Email verification/password reset are not yet implemented.
- **Admin:** Provider status, issues, sync control, media manager, add/review/curation workflows.

## Technology

Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, PostgreSQL, Prisma 8 RC contract/ORM (`@prisma/orm-postgres`), Three.js / React Three Fiber / Drei, Motion and Lucide. Canonical data is stored in PostgreSQL; provider adapters feed validated, provenance-aware ingestion.

Data providers include football-data.org, GOAL API, Big Balls Data, StatsHawk, PitchAPI spatial, official FC Barcelona sources and the official Barça YouTube channel. Provider credentials, availability, rate limits and licensing vary. Do not fabricate missing stats or event coordinates.

## Local development

Prerequisites: compatible Node.js/npm, Docker with Compose, PostgreSQL and valid project environment configuration.

```bash
npm install
npm run dev
```

The default Next.js development URL is `http://localhost:3000` unless another port is configured. The project has used PostgreSQL on host port `5434` for local development. **Do not assume `npm run dev` alone provisions the database**: check the current Compose configuration, migrations and `.env` template before first run.

Useful checks:

```bash
npm run lint
npm run build
```

The Prisma contract, migration snapshots and provider-specific setup require project-specific commands. Consult `package.json`, `docker-compose.prod.yml`, `src/prisma/` and `migrations/` in the checked-out revision rather than guessing a Prisma CLI workflow. Generated contract files should not be hand-edited.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Command Center |
| `/matches` and `/matches/[id]` | Season fixtures and Match Center |
| `/squad` | Squad and player Quick View |
| `/analytics` | Performance Lab |
| `/club`, `/club/trophies`, `/club/seasons`, `/club/identity` | Club history and museum |
| `/media` | Screening room |
| `/my-barca` | Personal archive |
| `/account` | Account sign-in, signup and session controls |
| `/settings` | Settings (still developing) |
| `/admin` | Privileged operational control room |

## Home-server deployment (current reference)

The existing Ubuntu installation uses `/srv/barca-dashboard/build-test` and `docker-compose.prod.yml`, with `db`, `migrate`, `app`, `backup`, and `media-scheduler` services. The dashboard app is bound to `127.0.0.1:3006` and proxied over HTTPS through Tailscale. The confirmed deployed `main` milestone on October 11 is `4a2850d`.

A three-hour scheduler calls `/api/internal/jobs/match-media` with `INTERNAL_JOB_SECRET`; the job also refreshes/caches player heatmaps. A verified production run wrote 143 spatial heatmap rows, and both Squad and Analytics heatmaps were subsequently checked in the browser.

The server also hosts unrelated services. **Do not reset Tailscale Serve/Funnel, replace existing routes or expose the database directly.** Music Universe already uses the public Funnel port `10000`. The final Barça public Funnel address should be confirmed with `tailscale funnel status` on the host before sharing; do not assume an old tailnet-only Serve URL is public.

The production stack is operational, but this README intentionally does not claim that automated GitHub deployments, backup restoration, and every security control have been fully verified.

## Accounts and security

### Web Push notifications (opt-in)

The notification tables are added by the `20261016T2037_web_push_notifications` migration. Review and apply that migration through the existing deployment workflow before using the new Settings or Admin Notifications screens. Generate one VAPID key pair with `npx web-push generate-vapid-keys`, then place `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, and `WEB_PUSH_CONTACT=mailto:your-address` in the private server environment; never commit the private key. Set `PUSH_NOTIFICATIONS_ENABLED=true` only after a backup, migration, configuration and a manual test notification pass. Its default is `false`. The existing media-scheduler calls the authenticated notifications endpoint every 60 seconds; no separate scheduler is needed. Keep the same VAPID keys across deployments or devices must subscribe again.

Users opt in per device under Settings; admins can edit templates, send a test or custom alert, and inspect delivery history at `/admin/notifications`. On iPhone, open the installed Home Screen app to grant permission. Already-installed Home Screen apps do not need to be removed and re-added, but notification permission still must be granted. A successful push-provider acceptance does not prove the operating system displayed the alert, and goal alerts can only be as prompt and complete as the upstream event provider. Penalty and VAR alerts are sent only for explicit provider events, never guessed from a score change.

- `BARCA_SIGNUP_ENABLED=1` enables signup in production. Keep this under operator control.
- Signup and login include validation, throttling and same-origin safeguards. Passwords use salted scrypt hashes; sessions use server-managed cookies.
- Canonical match, squad, analytics and media records are shared; personal diary, favourites and saves must be user-scoped.
- Production signup and an initial second-account favourites isolation check passed. **Do not interpret this as a full audit of every account-owned route or admin API.**
- Before broader sharing, test authorization for every admin/debug endpoint, verify ownership on every personal read/write and data-transfer flow, and review public origin/proxy/cookie behavior.
- Email verification is not implemented. Password recovery uses configured email delivery; an unverified address must not be treated as proof of identity beyond control of that inbox.
- Never commit `.env`, API keys, database credentials, session secrets, private licensed assets or user records.

## Product and data rules

- **Canonical database first:** provider results are evidence, not UI truth until resolved and persisted.
- Match and player identities must be matched conservatively; ambiguous data remains unresolved.
- Preserve provider provenance and the distinction between missing (`null`) and real zero.
- Official verified squad membership is distinct from one-off lineup appearances.
- Spatial heatmaps use real stored samples, never formation coordinates.
- Global writes should be idempotent and previewable when appropriate.
- Fan-facing times use 12-hour AM/PM; clickable controls use pointer cursors; visuals follow the squared, editorial Stadium Control Room design language.

## Roadmap

Near-term: public-access and ownership security audit; improve account management, password recovery and email verification; refine the two-version Camp Nou explorer against stronger architectural references; build out Settings; verify exact-goal clips and `MediaMoment` associations; strengthen provider freshness, retries and diagnostics. A separate women's first-team scope across Squad, matches and competitions is planned. AI match prediction and goal-path replay remain future work dependent on trustworthy data.

## Documentation

See [`barca-dashboard-spec.md`](./barca-dashboard-spec.md) for the full product, architecture, provider, design, data-ownership, historical implementation and roadmap specification. The spec contains dated snapshots and explicitly distinguishes confirmed production tests from older local milestones.

## Repository

[github.com/marcchlela/barca-dashboard](https://github.com/marcchlela/barca-dashboard)

FC Barcelona trademarks, photographs, match footage and third-party data remain the property of their respective owners. Review asset rights before wider distribution. This is an independent supporter project, not an official FC Barcelona product.
