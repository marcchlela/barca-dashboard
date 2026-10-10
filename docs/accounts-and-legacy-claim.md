# Accounts and the legacy personal archive

The existing `/srv/deploy` bunker deployer remains the deployment mechanism. The unused draft Barça deployment hook was removed; nothing in this change registers a service, timer or webhook.

Shared football records (fixtures, squads, statistics, media, club history) remain readable without signing in. Personal records now carry a nullable `userId`: diary entries, Top 3 matches, favourite players and saved media. The null rows are the pre-account archive. Normal pages and APIs never show or modify those rows for a guest or another user.

Accounts use email, username and a password. Email is **not verified**, as requested. Passwords are salted scrypt hashes; browser sessions use random, HTTP-only cookies whose token hashes alone are stored in PostgreSQL. Login attempts are throttled by normalized account identifier. There is no password-reset flow yet; an unverified email address cannot be trusted as proof of ownership. Admin roles cannot be self-selected at signup.

Sessions expire at an absolute 30-day deadline checked by the server. There is no shorter idle timeout, password recovery, email verification, or signup-specific rate limit yet. Keep production self-registration closed while those public-launch controls are reviewed; local account creation is available for the owner's test.

Production needs a HTTPS `BARCA_PUBLIC_ORIGIN` (exact browser origin) for cookie and origin/CSRF protection. The deployed origin is `https://chlela-bunker.tail0759d5.ts.net:8449`; see [the staged production rollout](production-account-rollout.md). Production signup stays closed unless `BARCA_SIGNUP_ENABLED=1`; friends' registration can be opened after the owner claim is verified. An authenticated admin must have role `admin` **and** their UUID in `BARCA_ADMIN_SUBJECTS`. Production admin mutation APIs are still disabled until actor-level change auditing and the deployment review are completed; local development can exercise them. Do not push this change before reviewing the migration and rollout.

The account migration was generated **offline** from the latest checked-in contract hash `f6097504120286aca553e1ede724057f6150800b76a93503305c0fc785245fd4`; the repository's `db` ref pointed to an older hash, so the default planner was not used. The migration adds tables and nullable owner columns and replaces global personal unique constraints with per-user constraints. It does not delete or transfer personal rows. It was applied to the real **Windows local** database on 10 October 2026, after a private backup at `.artifacts/local-db-backups/barca-local-pre-accounts-20261010-001112.dump` (SHA-256 `88FBCCE6A3BFD466481404AA85B7DD03329A0FF94241455B6D6FD98ED47ABACF`). Before/after fingerprints matched for all eight diary entries, two Top 3 picks, one favourite player, one saved film, 42 goal moments and 44 goal events. Production has **not** been migrated in this work.

The private local backup was also restored successfully into a disposable local database and checked for the same personal and goal-media row counts.

On 10 October 2026, the user approved the **Windows local** legacy claim for `chlelaaa` (`84864dc9-11fd-4f3b-bbfd-e52016e0384b`). A fresh private pre-claim backup at `.artifacts/local-db-backups/barca-local-pre-claim-2026-10-10T09-03-52-696Z-6be00d.dump` passed disposable restore QA. The exact preview had zero conflicts. The claim assigned all eight diary entries, two Top 3 picks, one favourite player and one saved film to that account, granted the local admin role, and revoked its one existing session. Post-claim checks found zero unclaimed personal rows and unchanged fingerprints/counts for the 42 goal moments and 44 events. A fresh Git-ignored local comparison snapshot is `.artifacts/data-compare/local-account-claimed-20261010.json`. **No production account, migration, claim or transfer was performed.**

For another environment, take a fresh backup and preview the pending migration with `npx prisma db migrate --show`. Apply it only when ready to create and claim the owner account. **Do not push this branch casually:** the existing `/srv/deploy` pipeline applies production migrations automatically during deployment, and the old personal rows will be hidden from normal pages until an owner account is created and the claim is deliberately applied. This does not delete those rows.

Once the migration has been separately approved and applied, create your own account in the UI. Then run the private claim command in **preview** mode against the database containing your legacy rows:

```bash
node tools/auth/claim-legacy.mjs --email your-account@example.com
```

The report shows unclaimed rows, conflicts, the account UUID, and a digest of the exact unclaimed record IDs. After verifying the account, rows and fresh backup, the explicit `--apply --user-id UUID --confirm DIGEST` mode can assign those rows and grant that account the admin role:

```bash
node tools/auth/claim-legacy.mjs --email your-account@example.com --apply --user-id UUID_FROM_PREVIEW --confirm DIGEST_FROM_PREVIEW
```

Role elevation revokes its existing sessions, so sign in again. A changed digest requires a fresh preview. Never run `--apply` merely because a signup was first; do not claim a production archive before the separately gated local-to-production transfer has been reviewed. On the Ubuntu server, the migration image includes this tool and can run it with `docker compose -f docker-compose.prod.yml run --rm --no-deps --entrypoint node migrate tools/auth/claim-legacy.mjs --email ...` once the deployed image and database are ready. Production admin also requires that UUID in the private allowlist.

This is a foundation, not an activation notice. Before opening public registration, review reverse-proxy HTTPS/origin configuration, anti-abuse controls, password recovery and account lifecycle, and test isolated accounts plus the claim procedure against a copy of the database. The one-time transfer and goal-media schedule remain separate.

The previous cross-environment transfer writer is blocked after the account migration. Account-era comparison snapshots exclude credentials and sessions, carry only account IDs/usernames for identity review, and never pair owned personal rows by fixture alone. Once both environments have owner accounts, `tools/data-compare/compare-accounts.mjs` can compare two explicitly named account IDs **read-only**. It does not produce an import manifest. A new, explicitly approved per-user ownership and conflict policy is still required before any personal-data transfer between Windows and Ubuntu.
