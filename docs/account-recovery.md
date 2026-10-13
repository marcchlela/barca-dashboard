# Account recovery and Settings

The Account page links to Settings and email password recovery. Settings offers kit selection (stored in the current browser) and authenticated password change. Recovery sends a one-use, 30-minute link to the account email. A successful reset or password change revokes all existing sessions; the user signs in again. It never signs in automatically.

Recovery requires the additive `20261012T1401_password_reset_tokens` migration; the admin email log requires `20261012T1943_email_delivery_log`. Both are previewable before applying. Configure these **private** server environment variables:

```dotenv
BARCA_PUBLIC_ORIGIN=https://your-dashboard-origin.example
BARCA_SMTP_HOST=smtp.gmail.com
BARCA_SMTP_PORT=465
BARCA_SMTP_USER=demo.test.sender@gmail.com
BARCA_SMTP_PASSWORD=YOUR_PRIVATE_APP_PASSWORD
BARCA_MAIL_FROM=demo.test.sender@gmail.com
```

Do not put the password in Git, a chat, or the browser. For a Gmail sender, use a Google app password on an account with 2-Step Verification; a normal Gmail password is not suitable for SMTP. If your sender uses another SMTP provider, use that provider's host, port and credentials. Port 465 uses implicit TLS; other ports use STARTTLS where supported. In production the public origin must be the exact HTTPS origin visitors use, including a nonstandard port. Keep the existing `BARCA_SIGNUP_ENABLED=1` if friends should be able to register; recovery does not change that flag.

Before deployment, review `prisma db migrate --show` and take a database backup. The existing deployer applies migrations during deployment, so do not push until the migrations and SMTP setup are approved. Locally, `BARCA_PUBLIC_ORIGIN` must point to the local app; production uses the actual HTTPS origin.

`/admin/email` shows the two message templates, SMTP configuration status, and the last 50 attempts. The test button sends only to the signed-in admin account address, with a three-per-hour limit. Production access still requires the admin role and private allowlist. The log stores a masked recipient, message type, accepted/failed status, and a sanitized error code; it never stores reset tokens, URLs, message bodies or SMTP credentials. “Accepted” means the SMTP server accepted the message, not that the recipient opened or received it. A real test message is not sent merely by loading the page.

Test a reset with a disposable account, verify expiry and one-time use, then verify old sessions no longer work. Password-reset delivery is unavailable until SMTP is configured. Email addresses are not verified during signup; someone who enters an address they cannot access may be unable to recover their account. Email changes need a separate verified-address flow.

Future push notifications are a separate milestone: installable-app opt-in, per-user notification preferences, Web Push subscriptions, permission handling, and matchday events (reminders, lineups, kickoff, goals, full time). They should not be coupled to password-recovery email or sent automatically without consent.
