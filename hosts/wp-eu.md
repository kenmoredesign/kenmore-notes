# wp-eu

Surveyed 2026-09-30 over ssh as `claude` (uid 1001, groups `claude`, `users`; no sudo). Read-only. No database connection was made; wp-config.php was only grepped for `DB_NAME`/`table_prefix`. WordPress and plugin versions come from file headers, not wp-cli.

## OS and kernel
- Ubuntu 26.04 LTS, x86_64, QEMU guest (qemu-guest-agent running). Hostname `wp-eu`. Uptime 8 weeks 2 days.
- Running kernel `7.0.0-28-generic`; `7.0.0-34-generic` is installed and `/var/run/reboot-required` exists, so a reboot is pending.
- Users in /home: `claude`, `alex` (mode 750, unreadable), `toby` (mode 750, unreadable). Per-site system users `alverix`, `zentro`, `default`.

## Disk
`/dev/sda1` ext4 150G, 5.9G used (5%), 138G free. `/boot/efi` vfat 253M, 1% used.

| Top-level | Size |
|---|---|
| /usr | 1.9G |
| /home | 1.9G (all `/home/claude`; alex and toby unreadable) |
| /var | 1.2G |
| /boot | 119M |
| /etc | 7.4M |
| /tmp | 2.2M |

`/var` breakdown: `/var/www` 716M, `/var/lib` 180M (`/var/lib/mysql` unreadable without sudo, so DB size is unknown), `/var/cache` 149M, `/var/log` 144M (130M of it is `journal`), `/var/backups` 2.0M.
`/home/claude`: `.local` 1.7G, `SiteTemplates` 93M, `premiumfx-transfer` 74M, `.claude` 31M.

## Web server
nginx 1.28.3 (Ubuntu). No Apache is installed (`/etc/apache2` holds only an empty `conf-available`).

**Layout:** `/etc/nginx/nginx.conf`, with `conf.d/*.conf` and `sites-enabled/*` included.
- `nginx.conf` sets `client_max_body_size 128M`, gzip, `server_tokens off`, TLS 1.2/1.3 only, and `open_file_cache`.
- `conf.d/cloudflare.conf` holds `set_real_ip_from` for the Cloudflare ranges with `real_ip_header CF-Connecting-IP`. A timer, `update-cloudflare-ips.timer` (weekly, Monday), runs `/usr/local/bin/update-cloudflare-ips.sh`, which I did not read. The sites are evidently proxied through Cloudflare.
- `snippets/wordpress.conf` is shared by all WP vhosts:
  - Denies `xmlrpc.php`, dotfiles, `wp-config.php` and PHP under `uploads/`.
  - Sets a 30-day expiry on static assets.
  - Standard `try_files ... /index.php?$args`.
  - Passes PHP to `unix:/run/php/php8.5-fpm-$site_name.sock`. Each vhost sets `$site_name`, which selects that site's pool.

**Enabled sites** (`sites-enabled` symlinks into `sites-available`):

| Site | Document root | Domains |
|---|---|---|
| alverix | `/var/www/alverix/public` | `www.alverix.net` serves the site. `alverix.net` 301s to `www`. |
| zentro | `/var/www/zentro/public` | `www.zentrobrokerage.com` serves the site. `zentrobrokerage.com`, `zentro.kenmorefx.com` and `www.zentro.kenmorefx.com` all 301 to `https://www.zentrobrokerage.com`. |
| default | none | Catch-all (`server_name _`). Port 80 returns a static 404 page. Port 443 uses `ssl_reject_handshake on`. |

**SSL:** Let's Encrypt via certbot. The vhosts point at `/etc/letsencrypt/live/alverix.net/`, `.../zentrobrokerage.com/` and `.../zentro.kenmorefx.com/`, with `options-ssl-nginx.conf` and `ssl-dhparams.pem`.
- Port 80 serves `/.well-known/acme-challenge/` from the webroot `/var/www/letsencrypt` and 301s everything else to https.
- Renewal uses `certbot.timer` (systemd), plus the `/etc/cron.d/certbot` fallback, which is inert under systemd.
- `/etc/letsencrypt/live` and `/etc/ssl/private` are **not readable without sudo**. I could not confirm that the certificates exist or when they expire.

`/var/www/html` holds only the stock `index.nginx-debian.html` and is not served.

## PHP
PHP 8.5.4 CLI, with PHP-FPM 8.5 (`php8.5-fpm.service`). Pools in `/etc/php/8.5/fpm/pool.d/`:

| Pool | User | Socket | Notes |
|---|---|---|---|
| alverix | alverix | `/run/php/php8.5-fpm-alverix.sock` | `memory_limit` 512M, `open_basedir` `/var/www/alverix:/tmp:/usr/share/php` |
| zentro | zentro | `/run/php/php8.5-fpm-zentro.sock` | `open_basedir` `/var/www/zentro:/tmp:/usr/share/php` |
| default | default | `/run/php/php8.5-fpm-default.sock` | `open_basedir` `/var/www/default:/tmp:/usr/share/php` |
| www | n/a | n/a | `www.conf.disabled`, disabled |

All active pools use `pm = ondemand`, `max_children 8`, `process_idle_timeout 30s`, `max_requests 500`, `request_terminate_timeout 300s`, a slowlog threshold of 10s, and per-pool session directories under `/var/lib/php/sessions/<site>`. WP-CLI 2.12.0 is at `/usr/local/bin/wp`.

## Database
MySQL Community Server 8.4.11 (`mysql.service`), listening on 127.0.0.1:3306 and 127.0.0.1:33060 only. No MariaDB. I could not connect, and `/var/lib/mysql` is unreadable, so this is everything I know about it.

| Site | DB name (from `grep DB_NAME`) | table_prefix |
|---|---|---|
| alverix | `wp_alverix` | `wp_` |
| zentro | `wp_zentro` | `wp_` |
| default | none (no WordPress) | n/a |

Redis (redis-server, 127.0.0.1/::1:6379) is running, but no `object-cache.php` drop-in exists in either site and no Redis plugin is installed, so it looks unused by WordPress.

## WordPress sites
Both sites run **WordPress 7.1.2** (from `wp-includes/version.php`). `default` has an empty `public/`.

Active or inactive status cannot be read without the database. Everything below is "installed".

### alverix (`/var/www/alverix/public`)
| Plugin | Version | Size |
|---|---|---|
| elementor | 4.2.2 | 96M |
| wpforms-lite | 2.0.0.2 | 44M |
| essential-addons-for-elementor-lite | 6.7.3 | 23M |
| astra-sites | 4.7.3 | 22M |
| header-footer-elementor | 2.9.2 | 21M |
| safe-svg | 2.4.0 | 1.1M |

- Theme: `astra` 4.13.8, 25M. No child theme.
- mu-plugins (custom `kd-*`, 116K total): `kd-broker-sections`, `kd-contact-form`, `kd-education`, `kd-footer-bar`, `kd-forex-ticker`, `kd-forex-ticker-bottom`, `kd-login-style`, `kd-noindex`, `kd-platforms`, `kd-skin`, `kd-x-icon`. No version headers were checked.
- wp-content: plugins 206M, themes 25M, uploads 6.3M.
- `header-footer-elementor` ships a `.claude/` directory inside the plugin. It is vendor-supplied, not an operator leftover.

### zentro (`/var/www/zentro/public`)
| Plugin | Version | Size |
|---|---|---|
| elementor | 4.2.1 | 96M |
| advanced-custom-fields | 6.8.6 | 29M |
| lexend-core | 2.5 | 16M |
| kirki | 6.1.1 | 15M |
| wordpress-importer | 0.9.5 | 2.5M |
| contact-form-7 | 6.1.6 | 1.3M |

- Theme: `lexend` 2.6, 35M. No child theme.
- mu-plugins (60K total): `premiumfx-config.php` (49K, a large site-config plugin) and `zentro-light-mode.php`.
- wp-content: plugins 158M, themes 35M, uploads 11M.

## Cron
No user crontab for `claude`. User crontabs in `/var/spool/cron/crontabs` are unreadable, so I could not check for others. Seen in `/etc/cron.d`:

- `wp-cron-alverix`: `*/5 * * * *` as user `alverix`, `/usr/local/bin/wp --path=/var/www/alverix/public cron event run --due-now`.
- `wp-cron-zentro`: same, as user `zentro`, for `/var/www/zentro/public`.
- `certbot`, `php` (sessionclean), `e2scrub_all`: distro defaults.
- Standard `/etc/crontab` hourly, daily, weekly and monthly runs (daily: apport, apt-compat, dpkg, logrotate, man-db).

systemd timers of note: `update-cloudflare-ips` (weekly), `certbot`, `apt-daily*`, `sysstat-*`, `logrotate`, `fstrim`, `dpkg-db-backup`, `phpsessionclean`. `unattended-upgrades` is running.

## Backups
There is **no scheduled backup**: no backup cron, timer or service. The only backups are hand-made "pre-change" snapshots sitting inside the site trees (see the junk list). These are the only ones visible to me:
- `/var/www/alverix/backups/` (about 620K): 4 DB dumps from 2026-09-07, copies of the mu-plugins before edits, and old nginx configs.
- `/var/www/zentro/backups/` (about 11.6M): 8 DB dumps from 2026-08-04 to 2026-09-14 (plus one in `migrate-20260806-113047/`), one uploads tarball, JSON exports of Elementor templates and posts, `premiumfx-config.php.*` copies, and dozens of one-off PHP scripts.
- `/var/backups` (2.0M) holds only dpkg and alternatives metadata.

Both backup directories sit next to `public/`, not inside it, so they are not web-served. Nothing shows off-host copies or snapshots. I can't see hypervisor-level snapshots from here.

## Services and listening ports
Running: nginx, php8.5-fpm, mysql, redis-server, cron, atd, chrony, ssh, tailscaled, rsyslog, unattended-upgrades, multipathd, qemu-guest-agent, polkit, dbus, systemd-networkd/resolved/logind/journald.

| Port | Bind | Service |
|---|---|---|
| 80, 443 | all (v4 and v6) | nginx |
| 22 | all | sshd |
| 3306, 33060 | 127.0.0.1 | MySQL |
| 6379 | 127.0.0.1, ::1 | Redis |
| 53 | 127.0.0.53, 127.0.0.54 | systemd-resolved |
| 42728, 61318 | Tailscale IPs | tailscaled |

## Large files, duplicates and junk candidates (list only, nothing deleted)

**Claude Code leftovers** (existence and size only; contents not read):
| Path | Size |
|---|---|
| `~/.local/share/claude/` (7 installed versions; `~/.local/bin/claude` is a symlink to `versions/2.1.284`) | 1.7G |
| ... of which old versions 2.1.228 (294M), 2.1.226 (284M), 2.1.221 (275M), 2.1.283 (230M), 2.1.270 (214M), 2.1.266 (206M) | about 1.47G |
| `~/.claude/` (plugins 16M, projects 9.8M, skills 4.5M, cache 828K, backups 296K; includes `CLAUDE.md`) | 31M |
| `~/.claude.json` | 64K |
| `/tmp/claude-1001/` (contains a stray 1.5M `db-pre-signup-links-20260928-155746.sql`, a database dump) | 2.2M |
| `/tmp/cc-socks`, `/tmp/tmux-1001` (Claude Code / tmux session dirs) | small |
| `/tmp/commission.sh` (7.2K, created 2026-09-30 21:33; not read) | 7K |
| `~/.tmux.conf`, `~/.bash_history` | small |

No separate notes checkout was found (a `find` for `CLAUDE.md`, `.claude` and `notes` turned up only the above plus Elementor's own `modules/notes` directories).

**Other candidates:**
| Path | Size | Note |
|---|---|---|
| `/home/claude/SiteTemplates/meridianfxSep4.zip` | 92M | Template archive, mode 600. Possibly a source for deploys; check before removing. |
| `/home/claude/premiumfx-transfer/` | 74M (`files/` 74M, `db/` 380K, `server-config/` 16K, `SHA256SUMS` 220K, two logo PNGs) | Transfer bundle from 2026-08-04: DB dump, `server-config/` (nginx, fpm pool and wp-config template) and `SHA256SUMS`. Possibly how zentro was first moved here. Not opened. |
| `/home/claude/mt55.png` | 524K | Duplicate of `/var/www/zentro/backups/mt55.png`, same size (533942 bytes). |
| `/home/claude/ssh-ed25519 AAAA.../` | 8K | Stray directory whose name is a pasted public-key string (a mangled `mac-jumper` key), two levels deep and empty. |
| `/home/claude/echo/` | 4K | Empty directory. |
| `/var/www/zentro/backups/uploads-pre-tasks-20260811.tar.gz` | 7.6M | Uploads snapshot from 2026-08-11. |
| `/var/www/zentro/.wp-cli/cache/` (core zip 30M, elementor 22.7M, ACF 8.9M, importer 0.5M, CF7 0.3M) | about 62M | wp-cli download cache from 2026-08-04. Core zip is 7.0.2, now superseded by 7.1.2. |
| `/var/www/zentro/backups/*.sql.gz` (8 dumps: 2026-08-04 to 2026-09-14) | about 3.0M | Old pre-change DB dumps. Contain site data. |
| `/var/www/zentro/backups/*.php`, `*.json`, `premiumfx-config.php.*` | about 1.1M | One-off fix/scan scripts (owned by root or zentro) and pre-change copies. Some scripts are root-owned, so I could not assume they're inert. |
| `/var/www/zentro/backups/migrate-20260806-113047/` | 388K | Contains a `db.sql.gz`. |
| `/var/www/zentro/backups/crm-links-20260914/` | 272K | Per-post JSON exports. |
| `/var/www/alverix/backups/` | about 620K | 4 DB dumps, mu-plugin copies, `mu-plugins-orig/`, `svg-orig/`. |
| `/home/claude/premiumfx-transfer/db/kd_premium-20260804.sql.gz` | 0.4M | DB dump. |
| `/etc/nginx/sites-available/default.bak.2026-09-04` | 425B | Not enabled. A stale vhost for `/var/www/default`. |
| `/var/www/default/` | about 8K | Empty docroot and pool; nothing is served from it now. |
| `/var/log/php-fpm/testsite.slow.log` | 0 | Leftover from a removed `testsite` pool (no pool config exists). |
| `/var/log/journal/` | 130M | No cap seen; I can't check `journald.conf` effects without sudo. |
| `/var/cache/apt/` and `/var/lib/apt/lists/` | 142M and 143M | Regenerable. |
| `/boot`: old kernel `7.0.0-28` | initrd 26M plus vmlinuz | The running kernel; do not remove until after the reboot. |

## Could not read without sudo
- `/var/lib/mysql` (DB size, extra databases)
- `/etc/letsencrypt/` (cert presence and expiry), `/etc/ssl/private`
- `/var/spool/cron/crontabs/*` (user crontabs)
- `/home/alex`, `/home/toby`, `/root`, `/var/lib/redis`
- root-only php-fpm logs (`*.slow.log`, mode 600)
- `update-cloudflare-ips.sh` and `commission.sh` exist but I did not open them (scripts may hold credentials)
- Whether plugins and themes are active, and which databases actually exist (both need DB access)

## 2026-10-02: fit check for the live chat migration

Read-only, as `claude`. Target for seven PHP Live! 4.7.8 chats from `livechat-old`
(see `livechat-old.md` and `livechat-migration.md`).

| | Found | Fit |
|---|---|---|
| PHP | 8.5.4 only. No PPA configured; `php7.4-fpm` has no candidate in the Ubuntu 26.04 archive | **Blocker.** The app needs PHP 7.4 or lower |
| Containers | no docker or podman | relevant only as the fallback for old PHP |
| MySQL | 8.4.11. `mysql_native_password` is **OFF** (the 8.4 default). `sql_mode` is the strict default. `require_secure_transport` off. TLS 1.2/1.3 | Old PHP 7.2 can only log in with `mysql_native_password`; the app expects non-strict mode |
| bind-address | 127.0.0.1, set in both `mysqld.cnf` and `tuning.cnf` (the later file wins). `mysqlx` also local | Needs the public address added, and a restart |
| `max_connections` | 102 | enough for seven small chats |
| nginx | 1.28.3. `sites-available` + `sites-enabled/*`, `conf.d/cloudflare.conf` (real IP), `snippets/wordpress.conf`. Default server: 404 on 80, `ssl_reject_handshake` on 443 | A Flex chat needs its own port-80 vhost with no redirect; a Full chat needs its own 443 vhost or the handshake is rejected |
| `/srv` | exists, empty, root-owned | `/srv/livechat` has to be created by root |
| Disk | 138 GB free of 150 GB | the seven chats are under 250 MB with their databases |
| RAM | 7.7 GB, 4.4 GB available, **no swap**. InnoDB buffer pool 3 GB | seven `ondemand` pools add little |
| Mail | no MTA, nothing on 25 | same as the old box; the app's SMTP add-on dials out itself |
| Public address | 91.99.203.165 on `eth0`; Tailscale 100.110.146.18 | |
| Reboot | still pending (kernel 7.0.0-28 running) | not needed for this work; do not combine |

A TCP connect from `livechat-old` to 91.99.203.165:3306 is refused at once, which
means the Hetzner firewall and ufw both let it through and only the bind address
stops it. (If ufw rejects rather than drops, this reading is wrong; see below.)

**Could not see without root**
- `ufw status`: ufw is active, its rules are unreadable. Is 3306 from 172.105.248.251
  allowed there as well as in the Hetzner firewall?
- Anything inside MySQL: existing users and their plugins, whether the server
  certificate files exist, the effective `sql_mode`.
- Whether the ondrej/php PPA publishes PHP 7.4 for Ubuntu 26.04. Adding a PPA to
  check is itself a root action.
- `/etc/letsencrypt` (how certbot is set up to issue for a new name).
- AppArmor's `usr.sbin.mysqld` profile is loaded; it does not restrict bind addresses,
  but I could not read the effective policy.
- `claude`'s only sudo is `/usr/local/lib/kenmore-ops/*`, which holds one script (`wp`).
  Nothing in this migration can be done on wp-eu by `claude` as things stand.
