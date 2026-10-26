# uptime cleanup, 2026-10-26

The goal is to make room for Invoice Ninja on uptime without a Hetzner rescale. The work runs in three gates, and each one waits for alex's approval. The fit target is **≥20G free on `/` and ≥2.5G available RAM** before the Invoice Ninja stack goes in.

## Gate 1: survey (read-only, done 2026-10-26)

The survey ran as root over a CA-certificate root window (`approve-root uptime 30m`, key ID `claude-root-uptime-20261026T155256`). This was also the **first root-by-certificate login on uptime, and it worked**. Nothing was changed. The survey printed no `.env` contents, no passwords and no table data.

**One slip:** Planka's compose file has the database password inside `DATABASE_URL`, which the masking pattern didn't catch, so it was printed once into the session. I scrubbed it from the saved output. Planka is due to be removed anyway.

### Starting point
- `/` is 38G, with 25G used and 11G free.
- RAM is 3.7Gi, with 2270M available. Swap is a 4G `/swapfile`, 348M used.
- Docker uses the **containerd image store**. Images live in `/var/lib/containerd` (9.7G: 7.7G snapshots and 2.0G content). `/var/lib/docker` holds 3.1G of volumes and container logs.

### Where the 25G is
| What | Size | Notes |
|---|---|---|
| `/var/lib/containerd` (images) | 9.7G | Mautic: `kenmore/mautic-ses` 4.16G and `mautic/mautic` 3.39G, which share 2.7G, plus `mysql:8.4` 1.12G. Planka: 0.58G, plus `postgres:14` 0.39G. Nextcloud 2.1G, Kuma 0.72G, MariaDB 11 0.46G, Redis 0.06G. |
| `/var/lib/docker` | 3.1G | Kuma data 809M (`kuma.db` 576M and WAL 270M), Kuma's **own container log 441M** (json-file with no size cap), Kuma's container layer 532M (its bundled Chromium), Nextcloud html 868M and db 473M, Mautic db 284M, Planka pg 190M |
| `/usr` | 3.1G | system |
| `/home/claude` | 2.3G | `.local` 959M, `.claude` 752M, `.codex` 389M, `.npm` 224M |
| `/swapfile` | 4.0G | |
| `/var/log` | 647M | journal 505M, `btmp.1` 121M |
| `/var/www` | 494M | the "premium" WordPress build (see below) |
| `/root` | 324M | `.npm` cache |
| `/var/lib/mysql` | 228M | host MariaDB |
| `/var/lib/apt` and `/var/cache/apt` | 198M and 151M | 39M of that is in `archives` |
| `/opt/kenmore` | 446M | `automation` (venv, logs), `planka` (compose only), `nextcloud` (76K: config and secrets) |
| `/home/est` | 105M | `premiumfx-migration` 105M, `mautic` (24K: compose, `.env`, `mautic-ses` build context) |

### Mautic
- Compose project `mautic`, working directory **`/home/est/mautic`**: `docker-compose.yml`, `docker-compose.override.yml` (builds `kenmore/mautic-ses` from `./mautic-ses`) and `.env` (est:est 664).
- Four containers: `mautic-db-1` (`mysql:8.4`), `mautic_web` (published on 8080), `mautic_cron` and `mautic_worker`. All have been exited for 4 weeks. The three app containers exited with code 137 (killed).
- Volumes:
  - `mautic_mautic-db-data`: 284M.
  - `mautic_mautic-media`: 17M.
  - `mautic_mautic-config` and `mautic_mautic-logs`: under 1M each.
  - Six anonymous 8K volumes for `media/files` and `media/images`.
- Network `mautic_default`.
- Caddy still has a `mailer.kenmorefx.com` block that proxies to `localhost:8080`, where nothing listens.

### Planka
- Compose project `planka`, working directory `/opt/kenmore/planka`, with `docker-compose.yml` only. The secrets are inline in that file.
- Containers `kenmore-planka` (published on 3000) and `kenmore-planka-db` (`postgres:14-alpine`), exited 4 weeks.
- Volumes: `planka_planka-pgdata` 190M, an anonymous `/app/data` volume of 2.7M, and empty attachments and uploads volumes.
- Network `planka_default`.
- **The only reference to it is an nginx site, and that does nothing.** `/etc/nginx/sites-enabled/planka` serves `planka.kenmorefx.net` and proxies to :3000, but the nginx package isn't installed (`nginx.service` "not-found", failed since 2026-05-19). The Caddy block for Planka is commented out.
- **`/opt/kenmore/automation` uses Planka** (`planka_client.py`, `planka_ids.json`). claude's **user** systemd timer `kenmore-process.timer` runs `process_queue.py` about every 65 seconds. Every run currently fails with "OpenAI proxy unreachable (127.0.0.1:10533)", so the pipeline isn't doing anything now, but it would need Planka to come back.

### Host leftovers
- **MariaDB 10.11 on the host** (127.0.0.1 only, 115M RSS):
  - The only user database is `premiumfx_wp` (9.4M, 21 tables). Its newest file is from 2026-09-02.
  - Accounts: `root`, `mysql`, `mariadb.sys`, `premiumfx_usr`.
  - There were no live clients, and only root's own connections since the 2026-10-24 restart (logrotate plus this survey).
- **php8.3-fpm** (3 processes, 66M): one `www` pool on `/run/php/php8.3-fpm.sock`, with no clients.
  - The Caddy block that served the premium site (`premium.kenmorefx.com`, `php_fastcgi unix//run/php/php8.3-fpm-premiumfx.sock`) is commented out, and that socket's pool doesn't exist.
  - Packages installed: `php8.3-{fpm,cli,common,mysql,gd,imagick,intl,mbstring,xml,zip,curl,bcmath,opcache,readline}`.
- **The "premium" WordPress build** from est (July 2026), served by nothing:
  - `/var/www/html/premium`: 295M, database `premiumfx_wp`.
  - `/var/www/premium-backups`: 127M of SQL dumps.
  - `/var/www/premium-source`: 73M (theme, HANDOVER.md).
  - `/var/www/premium-CREDENTIALS.txt`.
  - `/home/est/premiumfx-migration`: 105M.

  It looks like the staging copy of the premium template, which by now runs as zentro on wp-eu.
- **nginx:** only the `/etc/nginx` configuration and the planka site are left. There's no package and no RAM use.
- **Orphaned Uptime Kuma leftovers** from the first setup on 2026-05-15:
  - volumes `root_uptime-kuma-data` and `uptime-kuma_uptime-kuma-data` (1.1M each, no container);
  - networks `root_default` and `uptime-kuma_default`;
  - duplicate compose files `/root/docker-compose.yml` and `/opt/uptime-kuma/docker-compose.yml` (mode 777).

  The running Kuma container belongs to no compose project and uses the unprefixed volume `uptime-kuma-data`.

### Running and keeping
- **Nextcloud:** compose in `/opt/kenmore/nextcloud`, root-owned, with secrets as bind-mounted files. Its volumes take 1.3G and its image 2.1G. RAM: app 172M, database 144M, redis 5M. `nextcloud-cron.timer` runs every 5 minutes.
- **Uptime Kuma:** 259M RAM, 809M of data, a 441M uncapped log and a 532M container layer. It's still published on 0.0.0.0:3001.
- claude-owned processes that predate ops:
  - a `tmux` session `nextcloud` running Claude Code for 33 days, about 350M RSS;
  - a Claude Code remote server, running for 121 days;
  - the `kenmore-process` timer.
