# Private data comparison and controlled one-time transfer

Snapshots, manifests, attestations and apply logs contain private diary and curation data. Keep them in Git-ignored `.artifacts/data-compare/`, never in `public/` or Git. The default commands are read-only for PostgreSQL. `apply-transfer --apply` is a deliberately confirmed, single-transaction writer; it has **not** been run against production. It excludes goal-media operational state and leaves unresolved identities blocked. It does not change `GOAL_MEDIA_SCHEDULE_ENABLED`.

**Account-era safety:** New snapshots explicitly exclude the `app_user`, `user_session`, and `auth_throttle` tables (including password hashes and session-token hashes). They carry only account IDs and usernames as private comparison metadata. By default, owned personal rows are not paired across environments. `compare-accounts.mjs` requires two explicitly selected owner IDs and is read-only; the mapping is not proof of identity. Account-era snapshots cannot generate a transfer plan, and the legacy writer refuses a database containing `app_user`. Personal ownership and conflict resolution need a separately reviewed policy before another transfer.

After both databases have the account migration and their owner accounts, capture **fresh** private snapshots and compare an explicitly selected pair without writing either database:

```powershell
node tools/data-compare/snapshot.mjs --environment local --out local-account-review.json
node tools/data-compare/compare-accounts.mjs --local .artifacts/data-compare/local-account-review.json --production .artifacts/data-compare/production-account-review.json --local-owner-id LOCAL_UUID --production-owner-id PRODUCTION_UUID --out account-review.md
```

`production-account-review.json` must be obtained through the private, read-only server snapshot procedure below; the October 9 production snapshot predates accounts and cannot be substituted. Review legacy (unclaimed), selected-owner, and other-user rows separately. This command cannot approve a transfer, and the old preview/apply commands in this document are **not valid after the account migration**.

## Reviewed candidate from the October 9 snapshots

`.artifacts/data-compare/local-20261009-160808.json` and `production-20261009.json` yield **1,107 inserts, 58 updates, 142 blocked local rows and one contested production event left unchanged**. Blocked: 129 differing raw provider statistic payloads, eight invalid audit references, one conflicting goal/own-goal event and four dependent references. Updates: 27 player biographic/portrait rows, eight squad fields, 20 standing source/basis rows and three media-item fields. This candidate is not authorization to write. Refresh both snapshots and approve the exact new manifest before an apply.

The production goal event is not deleted. Its shared UUID has conflicting `goal` versus locally curated `own_goal` types; a dependent local clip, review and provider references remain blocked. No uncertain timestamp is assigned to that event. The 129 statistic rows have matching observed metrics but different raw payloads; choosing a source of truth is still open. Eight invalid override targets remain local. Multiple GOAL API IDs may legitimately map to one player: the current schema has a non-unique index on internal ID, and the earlier unique constraint was removed by a later migration.

## Offline review and isolated PostgreSQL rehearsal on Windows

```powershell
node tools/data-compare/compare.mjs --local .artifacts/data-compare/local-20261009-160808.json --production .artifacts/data-compare/production-20261009.json --out comparison-review.md
node tools/data-compare/preview-transfer.mjs --local .artifacts/data-compare/local-20261009-160808.json --production .artifacts/data-compare/production-20261009.json --out candidate-review.json
node tools/data-compare/apply-transfer.mjs --manifest .artifacts/data-compare/candidate-review.json --local .artifacts/data-compare/local-20261009-160808.json --production-snapshot .artifacts/data-compare/production-20261009.json
node tools/data-compare/qa-isolated-apply.mjs --local .artifacts/data-compare/local-20261009-160808.json --production .artifacts/data-compare/production-20261009.json
```

The QA command creates and later drops only a random, named, disposable **loopback** database. It migrates that database, seeds it from the private production snapshot, deliberately causes and checks a rollback, applies the candidate, repeats it as a no-op, and checks result counts and excluded operational rows. It never connects to Ubuntu.

`prepare-import.mjs`, `plan-transfer.mjs` and `validate-dependencies.mjs` are earlier read-only diagnostics; use `preview-transfer.mjs` for the authoritative operation candidate. The earlier headline counts are not executable.

## Fresh transfer procedure — **not executed**

The reported server layout is `/srv/barca-dashboard/app` for Git/Compose, `/srv/barca-dashboard/.artifacts/` for private artifacts, and `/srv/barca-dashboard/backups/` for backups. Confirm the running layout and deployed revision on Ubuntu before a real apply. PostgreSQL remains private to Docker.

1. On Windows, from the repository root, capture the local database and attest that it has not changed:

   ```powershell
   $stamp = Get-Date -Format yyyyMMdd-HHmmss
   node tools/data-compare/snapshot.mjs --environment local --out "local-$stamp.json"
   git check-ignore -v ".artifacts/data-compare/local-$stamp.json"
   ```

2. On Ubuntu, prepare the private directory. Copy tooling from Windows. This is not a deployment or DB write:

   ```bash
   install -d -m 700 /srv/barca-dashboard/.artifacts/data-compare/tools
   ```

   ```powershell
   scp tools/data-compare/*.mjs chlelaaa@100.68.17.37:/srv/barca-dashboard/.artifacts/data-compare/tools/
   ```

3. On Ubuntu, replace `YYYYMMDD-HHMMSS` with the Windows `$stamp` and take a read-only production snapshot:

   ```bash
   cd /srv/barca-dashboard/app
   STAMP=YYYYMMDD-HHMMSS
   docker compose -f docker-compose.prod.yml run --rm --no-deps \
     --user "$(id -u):$(id -g)" --entrypoint node -e COMPARE_OUTPUT_DIR=/private \
     -v /srv/barca-dashboard/.artifacts/data-compare/tools:/app/tools/data-compare:ro \
     -v /srv/barca-dashboard/.artifacts/data-compare:/private \
     -v /srv/barca-dashboard/app/public:/asset-public:ro \
     migrate /app/tools/data-compare/snapshot.mjs \
     --environment production --public-root /asset-public --out "production-$STAMP.json"
   sha256sum "/srv/barca-dashboard/.artifacts/data-compare/production-$STAMP.json"
   git rev-parse HEAD
   ```

   Pull the snapshot to Windows, compare the whole-file hash, make a **new** preview and rehearse it:

   ```powershell
   scp "chlelaaa@100.68.17.37:/srv/barca-dashboard/.artifacts/data-compare/production-$stamp.json" .artifacts/data-compare/
   Get-FileHash ".artifacts/data-compare/production-$stamp.json" -Algorithm SHA256
   node tools/data-compare/preview-transfer.mjs --local ".artifacts/data-compare/local-$stamp.json" --production ".artifacts/data-compare/production-$stamp.json" --out "candidate-$stamp.json"
   node tools/data-compare/qa-isolated-apply.mjs --local ".artifacts/data-compare/local-$stamp.json" --production ".artifacts/data-compare/production-$stamp.json"
   ```

   Inspect and explicitly approve the **new** counts, changed fields, blocked rows and exact manifest SHA-256. If a category changed, stop and review; old approval does not carry over.

4. Only after that approval, **re-run the live local attestation immediately before transfer**, then copy the three private artifacts from Windows:

   ```powershell
   node tools/data-compare/verify-local.mjs --snapshot ".artifacts/data-compare/local-$stamp.json" --out "local-attestation-$stamp.json"
   scp ".artifacts/data-compare/local-$stamp.json" ".artifacts/data-compare/local-attestation-$stamp.json" ".artifacts/data-compare/candidate-$stamp.json" chlelaaa@100.68.17.37:/srv/barca-dashboard/.artifacts/data-compare/
   ```

5. On Ubuntu, make a fresh custom-format backup, verify that `pg_restore` can list it, and note its exact basename. The existing October 9 backup is too old for the apply gate:

   ```bash
   cd /srv/barca-dashboard/app
   bash scripts/backup-server.sh
   ls -lt /srv/barca-dashboard/backups/barca-dashboard-predeploy-*.dump | head
   docker compose -f docker-compose.prod.yml exec -T db pg_restore -l /backups/EXACT-FRESH-BACKUP.dump >/dev/null
   ```

6. The first command below is **offline preview only**. The second is the gated writer: **do not run it until the refreshed manifest, blocked count, backup, and production write are explicitly approved**. Replace the stamp, checksum, blocked count and backup basename with reviewed values:

   ```bash
   cd /srv/barca-dashboard/app
   STAMP=YYYYMMDD-HHMMSS
   PRIVATE=/srv/barca-dashboard/.artifacts/data-compare
   docker compose -f docker-compose.prod.yml run --rm --no-deps --entrypoint node \
     -v "$PRIVATE/tools:/app/tools/data-compare:ro" -v "$PRIVATE:/private" \
     migrate /app/tools/data-compare/apply-transfer.mjs \
     --manifest "/private/candidate-$STAMP.json" --local "/private/local-$STAMP.json" \
     --production-snapshot "/private/production-$STAMP.json"

   docker compose -f docker-compose.prod.yml run --rm --no-deps \
     --user "$(id -u):$(id -g)" --entrypoint node -e COMPARE_OUTPUT_DIR=/private \
     -v "$PRIVATE/tools:/app/tools/data-compare:ro" -v "$PRIVATE:/private" \
     -v /srv/barca-dashboard/backups:/backups:ro \
     migrate /app/tools/data-compare/apply-transfer.mjs \
     --manifest "/private/candidate-$STAMP.json" --local "/private/local-$STAMP.json" \
     --production-snapshot "/private/production-$STAMP.json" \
     --local-attestation "/private/local-attestation-$STAMP.json" \
     --backup "/backups/EXACT-FRESH-BACKUP.dump" \
     --apply --confirm MANIFEST_SHA256 --acknowledge-blocked BLOCKED_COUNT
   ```

The writer revalidates hashes and the deterministic plan; requires snapshots/manifest younger than 30 minutes, local attestation younger than 15 minutes, and a backup younger than one hour; verifies live schema/data under a serializable transaction and advisory lock; writes only planned domain rows; checks counts, references and protected production rows; and stores a private result log. If any gate fails, re-snapshot and review. A repeat run is a no-op only when all intended values remain present.

## Deployments and later curation

Git-tracked code and versioned Prisma migrations are distinct from database contents. Compose declares a persistent `barca_dashboard_pgdata` volume and a `migrate` service that applies on-disk migrations before `app` starts. Do not use `down -v`, force-reset, or a blanket database restore as deployment steps. A deployment trigger has **not** been selected or activated: SSH access to inspect the actual Ubuntu workflow failed in this session. Do not invent a public webhook or put Tailscale/SSH secrets in Git.

For later curated data, choose between narrowly scoped reviewed data migrations, fresh approved private manifests, or authenticated production admin editing. None should silently overwrite future users' diaries or favourites. The one-time transfer tool is not automatic replication.
