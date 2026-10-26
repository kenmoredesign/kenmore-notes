# Invoice Ninja on uptime

Installed 2026-10-26 (Gate B) at **https://accounting.kenmorefx.com**, proxied through Cloudflare. One stack with one company now; two more companies will be added to the same stack later. The files and the install script are in ops under `invoiceninja/` (Gate A commit `ae45c3f`, placeholder-check fix `d3dad8b`).

## Layout
- `/opt/kenmore/invoiceninja` (root:root 750) holds `docker-compose.yml`, `nginx/` and `.env`.
  - `.env` is 600. It holds the generated `APP_KEY` and database passwords, which were never printed, and the SES SMTP credentials, which alex set by hand.
- Compose project `invoiceninja`, based on the official debian setup:
  - `invoiceninja/invoiceninja-debian:5.13.50` (PHP-FPM, queue workers, scheduler, Chrome for snappdf)
  - `nginx:1.30.6-alpine`, published on 127.0.0.1:8082 only
  - `mysql:8.4.13` with a 128M buffer pool, performance_schema off and no binary log
  - `redis:7.4.12-alpine`
  - network `172.31.82.0/24`; `TRUSTED_PROXIES=172.31.82.1`
  - logs capped at 10m × 3
- Volumes: `invoiceninja_{app_public,app_storage,mysql_data,redis_data}`.
- Caddy: `accounting.kenmorefx.com` block with the Cloudflare origin certificate (`mailer.pem` covers `*.kenmorefx.com`), proxying to 127.0.0.1:8082. Added with a reload only; the previous Caddyfile is kept as `Caddyfile.bak-<date>-invoiceninja`.
- Mail: AWS SES SMTP, `email-smtp.us-east-1.amazonaws.com:587` with STARTTLS, from "Kenmore Design" <accounting@kenmoredesign.com>.
- Admin login: alex@kenmoredesign.com. The first password was left in `/root/invoiceninja-admin-password` (600) for alex to change and then delete.

## Ops access
- `sudo /usr/local/lib/kenmore-ops/invoiceninja status | logs <app|nginx|mysql|redis> [lines] | restart <service>`. mysql can't be restarted with it.
- `invoiceninja-backup`, run as root by `invoiceninja-backup.timer` nightly at 03:45 UTC (+0–10 min, `Persistent=true`):
  - `mysqldump` using the mysql container's own environment, checked for "Dump completed";
  - a tar of the `app_storage` volume without framework and logs;
  - writes to `/var/backups/invoiceninja` (root 700), 14 days kept.
  - The first run at install time produced a 76K dump. **The backups are local only.** There's no off-host copy yet.
- Neither helper reads anything under `/opt/kenmore/invoiceninja`.

## Gate B tests (2026-10-26, 21:38–21:39 UTC)
- **Through Cloudflare, from ops:** `/` 200 and `/login` 200, with the HSTS header present.
- **PDF:** a test client and invoice were created through the API. The invoice PDF (84 KB, valid `%PDF`) rendered in 3.3s.
- **Memory:** the app container went from about 540M at rest to a **peak of 1.05GiB** during the render. The host's available RAM was 1766M just before. The sampler (`docker stats`, about one sample per second) was too coarse to catch the host's lowest point, so the dip is estimated from the container peak at about 500M, leaving roughly 1.2G available at the worst moment.
- **Email:** the invoice email to alex@kenmoredesign.com went through the queue (`App\Services\Email\Email` DONE, no exceptions). Delivery is for alex to confirm.
- **Cleanup:** the test invoice and client were deleted (soft delete).

## Resources after install
- 16G free on `/`, down from 21G (images about 5G).
- Available RAM about 1.6–1.8G at rest. The stack uses about 850M at rest: app 542M, mysql 296M, nginx 11M, redis 6M.

## Open
- An off-host copy of `/var/backups/invoiceninja`, for example to the Wasabi `archive:` remote.
- `/root/invoiceninja-src` (the copied install files, no secrets) is still on the host.
- Uptime Kuma is still public on 3001.
