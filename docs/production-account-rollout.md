# Production account rollout (not yet authorized)

Production uses its own PostgreSQL database. The Windows account and its sessions do not automatically exist there, and future personal edits do not synchronize between databases. The deployed browser origin is `https://chlela-bunker.tail0759d5.ts.net:8449` (no trailing slash in `BARCA_PUBLIC_ORIGIN`).

## Before any push

1. Confirm the existing `/srv/deploy` auto-deployer trigger and make a fresh production `pg_dump -Fc` backup. Copy it privately into Git-ignored `.artifacts/local-db-backups/` and run `node tools/auth/qa-backup-restore.mjs .artifacts/local-db-backups/BACKUP.dump --migration-check`. The October 10 pre-account backup passed this disposable restore and account-migration check: 46 matches, eight diary entries, and 33 events remained intact; no production database was changed by the check.
2. Record current production counts and migration status. Review the pending account migration against that database. The migration adds account/session/throttle tables and nullable owner columns; it does not claim or delete the eight legacy diary entries.
3. Set `BARCA_PUBLIC_ORIGIN=https://chlela-bunker.tail0759d5.ts.net:8449` in the private production environment. Leave `BARCA_SIGNUP_ENABLED=0` and `GOAL_MEDIA_SCHEDULE_ENABLED=false` for the initial deployment. Do not put credentials or the environment file in Git.
4. Obtain explicit approval for the push/deployment. The existing deployer automatically builds and applies migrations, so pushing this branch is a production database action.
5. Confirm the clean production-style build (`docker build --target web -t barca-account-web-qa .`) against the patched Next.js 16.3.8 lockfile and review any remaining production-dependency audit findings. The patched web image was built successfully on the Windows development machine; that does not validate the server deployment or clear every dependency advisory.

## After migration, before opening signup

The migration image includes `tools/auth/provision-account.mjs`. It creates a **user** account, not an admin; the separate reviewed legacy claim grants the owner role. Passwords must never appear in command arguments, shell history, logs or Git.

From `/srv/barca-dashboard/app`, preview without writing:

```bash
docker compose -f docker-compose.prod.yml run --rm --no-deps --entrypoint node migrate \
  tools/auth/provision-account.mjs --email 'marcchlela2005@gmail.com' --username 'chlelaaa'
```

After confirming the preview and its digest, create the account with a password read silently by the shell and passed only on standard input:

```bash
read -r -s -p 'Production account password: ' barca_owner_password; printf '\n'
printf '%s\n' "$barca_owner_password" | docker compose -f docker-compose.prod.yml run -T --rm --no-deps --entrypoint node migrate \
  tools/auth/provision-account.mjs --email 'marcchlela2005@gmail.com' --username 'chlelaaa' \
  --apply --confirm 'DIGEST_FROM_PREVIEW' --password-stdin
unset barca_owner_password
```

The password may be the same as local, but the two account UUIDs and sessions will be independent. Sign in on the website to verify it works. Then take a fresh production backup, preview `tools/auth/claim-legacy.mjs` for that **production** account, verify that exactly eight diary rows and no unexpected personal rows are unclaimed, and ask for a separate approval before applying the claim. The claim grants database admin role and revokes existing sessions; sign in again. Add the resulting production UUID to the private `BARCA_ADMIN_SUBJECTS` setting and restart the app. Production admin mutation APIs currently remain disabled even for an allowlisted admin; that is a separate activation review.

## Friends' registration

After the owner account and claim have been verified, `BARCA_SIGNUP_ENABLED=1` can open the existing Create account form for friends. The signup route enforces a database-backed ceiling of 60 attempts per hour globally and 5 per hour per normalized email and username. This protects the server from simple high-volume signup, but is not a complete anti-bot solution; a malicious actor could exhaust the global allowance. Do not rely on the unverified email address as proof of account ownership or for password recovery. There is no password recovery or email verification yet. Review the site's exposure and monitor signup activity before leaving open registration unattended. The flag is not enabled by this document or by the code changes.

The Racing Santander 36′ event is a separate approved correction: local records an own goal, production currently records a normal goal. It must be handled by the later identity-checked data transfer, not by the account migration or claim.
