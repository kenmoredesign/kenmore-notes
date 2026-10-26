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

## Gate 2: archive (done 2026-10-26)

- **Before the archive:** I stopped and disabled claude's `kenmore-process.timer`, so the automation copy would be consistent.
- **Dumps:**
  - `mautic-db-1` and `kenmore-planka-db` were started only for their dumps and stopped again.
  - Mautic: `mysqldump` with the container's own credentials, 124 tables, ends "Dump completed".
  - Planka: `pg_dump -Fc` (checked with `pg_restore --list`, 34 tables with data) plus the globals.
  - Host: `mariadb-dump premiumfx_wp` plus the `premiumfx_usr` grants.
- **Archive:** 15 files, 432M, staged in `/root/archive-2026-10-26/` (root-only) with `SHA256SUMS`:
  - the dumps;
  - tars of all Mautic volumes (10) and Planka volumes (4);
  - `/home/est/mautic` (compose files, `.env`, build context);
  - `/opt/kenmore/planka` and `/etc/nginx`;
  - `/opt/kenmore/automation` with the timer and service units. The venv was left out; a package list made from the dist-info names was kept instead, so root never ran claude-owned code.
  - the premium trees, `premium-CREDENTIALS.txt` and `premiumfx-migration`;
  - `/etc/mysql`, `/etc/php/8.3` and `/etc/caddy` (without `certs/`);
  - the old Kuma leftovers.
- **Where it went:** rclone to `archive:uptime/2026-10-26/`.
  - `archive` is a crypt remote on top of `wasabi`. It encrypts contents only; folder and file names stay readable.
  - The bucket is `decomrooms`. The key is IAM user `decom-maksym`, a no-delete key; alex confirmed it's the intended one.
  - The rclone config is root-only on the host. It was never read.
- **The first upload failed** with `AccessDenied ... s3:CreateBucket`: the bucket name in the config was wrong, and rclone tries to create the bucket by default. alex fixed the name and set `no_check_bucket`.
- **Verification:**
  - By the rerun, all 15 objects were already present.
  - `rclone cryptcheck` against the local files: 15 matching, 0 differences.
  - `rclone check --size-only`: 15 matching.
  - The listing's sizes are identical to the local files.

## Gate 3: removal (done 2026-10-26)

Four root windows were used in all. Gate 3 itself ran from 15:56 to 16:03 UTC. It stopped twice, and each time alex approved the next step.

1. **Mautic:** 4 containers, 10 volumes, network `mautic_default`, the images `kenmore/mautic-ses`, `mautic/mautic` and `mysql:8.4`, and `/home/est/mautic`.
2. **Planka and automation:** 2 containers, 4 volumes, network `planka_default`, the images `plankanban/planka` and `postgres:14-alpine`, `/opt/kenmore/planka`, `/opt/kenmore/automation`, and the `kenmore-process` units (followed by claude's `systemctl --user daemon-reload`).
3. **Premium WordPress:** `/var/www/html/premium`, `/var/www/premium-backups`, `/var/www/premium-source`, `premium-CREDENTIALS.txt` and `/home/est/premiumfx-migration`.
4. **Host services:**
   - Purged the explicit list `mariadb-server{,-core}`, `mariadb-client{,-core}`, `mariadb-common`, `libmariadb3`, `galera-4`, `php-common`, all `php8.3-*` and `nginx-common`.
   - Deleted `/var/lib/mysql`, `/etc/mysql`, `/etc/php`, `/etc/nginx` and their logs.
   - Kept `mysql-common`.
   - Did **not** run `apt autoremove`: it would also remove `python3-docker`, `python3-compose` and others, which weren't part of this approval.
   - **First stop:** the script's guard caught `libmariadb3`, which the purge would take along because it depends on `mariadb-common`. The only other package depending on it was `mariadb-client-core`, which was on the list anyway. alex approved adding it, and steps 4–9 were rerun.
5. **Old Kuma leftovers:** volumes `root_uptime-kuma-data` and `uptime-kuma_uptime-kuma-data`, networks `root_default` and `uptime-kuma_default`, and the compose files `/root/docker-compose.yml` and `/opt/uptime-kuma/docker-compose.yml`. `cert.pem` and `key.pem` in `/opt/uptime-kuma` were kept. Dangling images and build cache were pruned.
6. **Caddy:** removed the `mailer.kenmorefx.com` block and the commented-out planka and premium blocks.
   - The previous file is `/etc/caddy/Caddyfile.bak-20261026-gate3`.
   - The new file passed `caddy validate`, followed by `systemctl reload caddy` (a reload, not a restart).
   - **Second stop:** the script's first test request after the reload timed out (curl exit 28).
   - Checked right after: both sites answer through Caddy (302; `status.php` and `/login` 200). Nextcloud was busy with a large WebDAV/rclone download. A direct request to `127.0.0.1:8081` that bypassed Caddy hung, most likely because its Apache workers were all occupied. Nothing went down. alex approved continuing with steps 7–9 unchanged.
7. **`/opt/kenmore`** is now `root:root 755`. claude keeps `.claude`, `PROJECT.md`, the `CLAUDE.md` link and `proposals`; `nextcloud` stays root.
8. **Cleanup:**
   - deleted `/root/.npm` and `/home/claude/.npm`;
   - vacuumed the journal (now 80M);
   - deleted `/var/log/btmp.1`;
   - ran `apt-get clean`.

   Before this, as claude: ended the tmux `nextcloud` Claude Code session and stopped the Claude Code remote server. Claude Code won't be used on this host again.
9. **Uptime Kuma recreated last**, with the same image, port, volume and restart policy, plus `--log-opt max-size=10m --log-opt max-file=3`.
   - The old container was renamed and kept until the new one was healthy, then removed together with its 421M log.
   - Down from 16:02:12 to 16:02:23 UTC, about 11 seconds.
   - :3001 answers 302, directly and through Caddy.
   - Chromium is no longer installed in the container. No monitor is of the real-browser type.
10. **Archive check and local delete:** `cryptcheck` run once more (15 matching, 0 differences), then `/root/archive-2026-10-26/` was deleted.

### Result
| | before | after |
|---|---|---|
| Free on `/` | 11G (25G used) | **21G** (15G used) |
| Available RAM | 2270M | **2584M** (about 2.52Gi) |
| Containers | 10 (4 running) | 4 running: nextcloud-app, -db, -redis and uptime-kuma |
| Images | 9 | 4: nextcloud, redis, mariadb:11, uptime-kuma |
| Host services | caddy, mariadb, php8.3-fpm (and a failed nginx unit) | caddy |

**Fit check for Invoice Ninja (target ≥20G free and ≥2.5G available): passed without a rescale.** The RAM margin is thin, about 2.52Gi against 2.5. After Invoice Ninja's steady state (about 0.8–1G), roughly 1.5G is left for Chrome's spikes, with 4G of swap behind it.

Not changed and still open:
- Uptime Kuma is public on port 3001 (ufw inactive).
- The `est` account still exists.
- `cloud-init-hotplugd.service` is in a failed state. That has nothing to do with this cleanup, and I didn't look into it.
