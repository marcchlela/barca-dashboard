# One-time goal-media transfer: preparation only

**Current decision: Option C — compare everything first.** The selective bundle below is an earlier local export experiment, not a proposed merge policy. Use [`../data-compare/README.md`](../data-compare/README.md) for the full read-only local/production inventory and offline comparison. Do not design or run an importer until the user has reviewed each category and made explicit choices.

This directory currently contains a **read-only local exporter and offline bundle validator**. There is no production importer or target-database preview yet. Do not treat a structurally valid bundle as permission to apply it to production.

## Scope and relationships

The bundle selects finished Barça fixtures explicitly (`--match`) or by current season (`--current-season`). It includes their goal events, complete lineups, players, teams, competition/season identities, referenced media, goal moments, DailyGoal review decisions, data sources, and provider mappings. It deliberately excludes match statistics, diary entries, media saves, user preferences, provider retry state, page caches, and job runs.

Relationships that a future importer must resolve in the **target database**:

1. Match: season label, competition code, home/away team codes, kickoff, final score, and provider mappings must agree. Equal UUIDs alone are insufficient.
2. Player: use unique provider mappings plus compatible name and team context. A name or source UUID alone must not decide identity. Unresolved players require review or explicitly validated creation.
3. Goal event: compare provider identity, fixture, side, type (including penalty/own goal), minute, scorer and corrections. Never attach a moment by minute alone or overwrite an existing curated event.
4. Lineup: map fixture/team/player identities before inserting. A complete production side is preserved; partial or contradictory sides block automatic changes.
5. Media item: resolve by official source, external video ID/URL and the validated fixture. Conflicting or duplicate video associations block import.
6. Media moment: attach only after both target event and media item have unambiguous identities. Preserve `startSecond`, nullable `endSecond`, `verificationBasis`, `verifiedAt`, evidence URL and review note. A different existing target moment is a conflict, not an overwrite.
7. Goal review: reconcile by unique clip URL; preserve prior approved/rejected decisions. Do not import operational retry/cache/job records.

## Read-only local preview

From the repository root on Windows:

```powershell
node tools/goal-transfer/export-local.mjs --match ba66e397-b5bf-4d00-b80e-efa20f57b095 --match 7076e62a-85e4-444f-bd02-49f0a4400364
node tools/goal-transfer/export-local.mjs --current-season
```

The exporter uses a repeatable-read, read-only PostgreSQL transaction. Without `--out`, it does not create a file. To make a private bundle later, add `--out descriptive-name.json`; output is restricted to `.artifacts/goal-transfer/`, which Git ignores, and existing files are never overwritten. Then run:

```powershell
node tools/goal-transfer/validate-bundle.mjs --file .artifacts/goal-transfer/descriptive-name.json
git check-ignore -v .artifacts/goal-transfer/descriptive-name.json
```

The bundle contains player identities, match data and review notes. Treat it as private. Never add it to Git, an issue, or a public file share.

## Transport after review

Use SSH/SCP from Windows to a restricted directory on the Ubuntu server, with no PostgreSQL port exposed and no database password in the command. Verify the file's SHA-256 on both hosts and set mode `0600` on Ubuntu. Do not copy it into the web application's public directory. The server can validate the JSON offline with Node; later target-database preview/import commands should run on the server's existing Docker network using `.env.production` internally, not via Admin Sync HTTP.

The `sha256` field inside the bundle protects its payload. Compare a **whole-file** SHA-256 separately when copying it (PowerShell `Get-FileHash`, Ubuntu `sha256sum`). These two hashes are intentionally different.

The existing backup is a recovery point, **not** a replacement import. Before any write, review the full read-only comparison by category with the user. The user—not this tool—will decide whether each category should be merged, replaced, preserved, or left unchanged. Only after those choices are explicit may an importer and its post-import integrity checks be designed. Keep `GOAL_MEDIA_SCHEDULE_ENABLED` off throughout.
