# wp-asia

Surveyed 2026-09-30 over ssh as `claude` (uid 1001, group `claude` only; no sudo). Read-only. No database connection was made.

**Major gap:** both site directories (`/var/www/8itrade.com`, `/var/www/rforex.trade`) are mode `2750`, owned by the per-site user with group `www-data`. `claude` is not in `www-data`, so nothing inside them is readable. That means **no wp-config.php, no `DB_NAME` grep, no WordPress version, no plugin or theme list, no site logs and no document-root contents** for either site. I did not fetch the sites over HTTP to work around this, because rendering a WordPress page queries its database. Every "unknown" below is a real unknown, not a guess.

## OS and kernel
- Ubuntu 26.04.1 LTS, x86_64, QEMU guest. Hostname `WP-ASIA`. Uptime 2 weeks 2 days.
- Running kernel `7.0.0-30-generic`; `7.0.0-34-generic` is installed and `/var/run/reboot-required` exists, so a reboot is pending.
- Users in /home: `claude`, `alex` (mode 750, unreadable). Per-site system users `wp_8itrade_com`, `wp_rforex_trade`.
- fail2ban is running, with jails for `sshd`, `nginx-http-auth` and `nginx-botsearch` (the nginx jails watch `/var/log/nginx/error.log` and `/var/www/*/logs/error.log`; bantime 1h, maxretry 5). Firewall state (`ufw`) needs root and was not readable.

## Disk
`/dev/sda1` ext4 75G, **20G used (27%)**, 53G free. `/boot/efi` vfat 253M, 1% used.

| Top-level (as visible to `claude`) | Size |
|---|---|
| /usr | 1.9G |
| /home | 1.1G (all `/home/claude`; `alex` unreadable) |
| /var | 594M (`lib` 331M, `cache` 213M, `log` 49M, `backups` 1.9M, `www` 28K visible) |
| /boot | 119M |
| /etc | 8.1M |

**About 16G of the 20G used is not visible to me.** `du` over `/` only sums about 3.7G of readable data. The unreadable parts are the two site directories, `/root` (including `/root/backups`, see Backups) and most of the MariaDB data directory. The backup log says the site file copies are 854M (8itrade.com) and 1.5M (rforex.trade) and that about 15 daily copies are kept. If those sizes are what lands on disk, the backup tree could account for most of the gap. That is an inference I could not verify.

## Web server
nginx 1.28.3 (Ubuntu). No Apache (empty `/etc/apache2/conf-available` only).

**Layout:** `/etc/nginx/nginx.conf` (minimal, 768 worker connections, gzip on, `server_tokens off`, TLS 1.2/1.3) includes `conf.d/*.conf` and `sites-enabled/*`.
- `conf.d/cloudflare-realip.conf` sets the Cloudflare `set_real_ip_from` ranges, so the sites are evidently proxied by Cloudflare.
- `snippets/wordpress.conf` is shared by both vhosts:
  - `client_max_body_size 64M`.
  - Denies `xmlrpc.php`, dotfiles, `wp-config.php`, `wp-config-sample.php`, `readme.html`, `license.txt` and PHP under `uploads/`.
  - Passes PHP to `$php_socket`, which each vhost sets.
  - Sets 30-day expiry on static files.

**Enabled sites:**

| Site | Domains | Document root | Logs | PHP socket |
|---|---|---|---|---|
| 8itrade.com | `8itrade.com`, `www.8itrade.com` | `/var/www/8itrade.com/public` | `/var/www/8itrade.com/logs/` | `/run/php/8itrade.com.sock` |
| rforex.trade | `rforex.trade`, `www.rforex.trade` | `/var/www/rforex.trade/public` | `/var/www/rforex.trade/logs/` | `/run/php/rforex.trade.sock` |
| 00-default | anything else (`server_name _`) | `/var/www/default` (only a 10-byte `404.html`) | none | none; returns 404 on 80 and 443 using a self-signed cert in `/etc/nginx/ssl/` (unreadable) |

Each site serves both the bare domain and `www` directly. There is no `www` redirect. The plain-HTTP vhosts return 301 to https for those two hosts and 404 for anything else (Certbot-managed blocks). The stock `sites-available/default` is not enabled.

**SSL:** Let's Encrypt via certbot (`/usr/bin/certbot`), one certificate per site, with the `nginx` authenticator and installer (from `/etc/letsencrypt/renewal/*.conf`, both on one ACME account). The vhosts are edited by certbot ("managed by Certbot"). Renewal is `certbot.timer`. Certificate contents and expiry dates were not checked.

## PHP
PHP 8.5.4 CLI, with PHP-FPM 8.5. Pools in `/etc/php/8.5/fpm/pool.d/`:

| Pool | User | Socket | Notes |
|---|---|---|---|
| 8itrade.com | `wp_8itrade_com` | `/run/php/8itrade.com.sock` | ondemand, `max_children` 10 |
| rforex.trade | `wp_rforex_trade` | `/run/php/rforex.trade.sock` | ondemand, `max_children` 10, `memory_limit` 512M, `max_execution_time` 300, `max_input_vars` 5000 |
| www | `www-data` | `/run/php/php8.5-fpm.sock` | stock pool, dynamic, `max_children` 5; no vhost uses it |

Both site pools set `open_basedir` to the site's `public/`, its own `tmp/` and `/usr/share/php`, use a per-site `tmp/` for uploads, sessions and temp files, and log PHP errors to `<site>/logs/php-error.log`. WP-CLI 2.12.0 is at `/usr/local/bin/wp`.

## Database
MariaDB 11.8.6 (`mariadb.service`), listening on 127.0.0.1:3306 only. Data directory is `/var/lib/mariadb`, not the default `/var/lib/mysql`. I did not connect, and I did not enumerate the data directory either.

The two site databases' names are known only because the world-readable `/var/log/backup-sites.log` lists them: `wp_8itrade_com` (dump about 19M) and `wp_rforex_trade` (dump about 152K). Mapping is by name (site `8itrade.com` ↔ `wp_8itrade_com`, `rforex.trade` ↔ `wp_rforex_trade`). **It is not confirmed from `DB_NAME`**, because wp-config.php is unreadable. `table_prefix` is unknown.

## WordPress sites
**Unknown: WordPress version, plugins, themes, mu-plugins and their versions for both sites.** The directories are unreadable to `claude`.
- Timing evidence only: both vhosts and pools were created 2026-09-14/15 (`rforex.trade` on 15 Sep at 17:48, `8itrade.com` at 21:18). The backup log's first run is 2026-09-15.

## Cron
No user crontab for `claude`. User crontabs in `/var/spool/cron/crontabs` are unreadable, so I could not check for others. Seen in `/etc/cron.d`:
- `backup-sites`: `0 3 * * *` as root, `/usr/local/sbin/backup-sites.sh`, output appended to `/var/log/backup-sites.log`.
- `certbot`, `php` (sessionclean), `e2scrub_all`: distro defaults.
- Standard `/etc/crontab` hourly, daily, weekly and monthly runs.

**No `wp cron` entry is visible** (unlike wp-eu, which runs `wp cron event run --due-now` every 5 minutes per site). The sites may rely on WordPress's built-in request-triggered cron, or a root or site-user crontab I can't read. systemd timers are the usual distro set (`apt-daily*`, `certbot`, `logrotate`, `fstrim`, `phpsessionclean`, `sysstat-*`, `dpkg-db-backup`); there is no `update-cloudflare-ips` timer here.

## Backups
**A scheduled nightly backup exists**, described from the log only.
- `/usr/local/sbin/backup-sites.sh` (mode 750 root, unreadable to me) runs at 03:00 and writes to `/root/backups/<YYYY-MM-DD>/` (unreadable).
- Each run dumps both databases, then archives both sites' files. Logged sizes on 2026-09-30: `wp_8itrade_com` 19M, `wp_rforex_trade` 152K, files 8itrade.com 854M, files rforex.trade 1.5M. It logs `errors=0`.
- Every run since 2026-09-15 has succeeded (16 nightly runs in the log). Retention looks like about 14 days: the first prune, of the 09-14 and 09-15 directories, appears on 09-29.
- **No off-host copy is visible.** The destination is a local directory on the same disk. `~/.config/rclone/` exists for `claude` but is empty. Root's own configuration is unreadable, so off-host sync from root can't be ruled out.
- `/usr/local/sbin/add-site.sh` (8.6K) and `remove-site.sh` (3.8K) also exist, mode 750 root, unreadable. They look like the provisioning and removal scripts for new sites and matter for deployment (see summary).
- `/var/backups` holds only dpkg and alternatives metadata.

## Services and listening ports
Running: nginx, php8.5-fpm, mariadb, fail2ban, cron, atd, chrony, ssh, tailscaled, rsyslog, unattended-upgrades, multipathd, qemu-guest-agent, polkit, dbus, systemd-networkd/resolved/logind/journald. There is **no Redis** on this host.

| Port | Bind | Service |
|---|---|---|
| 80, 443 | all (v4 and v6) | nginx |
| 22 | all | sshd |
| 3306 | 127.0.0.1 | MariaDB |
| 53 | 127.0.0.53, 127.0.0.54 | systemd-resolved |
| 36988, 61305 | Tailscale IPs | tailscaled |

## Large files, duplicates and junk candidates (list only, nothing deleted)

**Claude Code leftovers** (existence and size only; contents not read):
| Path | Size |
|---|---|
| `~/.local/share/claude/` (4 installed versions; `~/.local/bin/claude` is a symlink to `versions/2.1.273`) | 865M |
| ... of which old versions 2.1.272 (217M), 2.1.271 (217M), 2.1.270 (214M) | about 648M |
| `~/.claude/` (projects 11M, plugins 7.4M, cache 688K, backups 284K, file-history 140K, paste-cache 20K) | 19M |
| `~/.claude.json` | 56K |
| `~/.tmux.conf`, `~/.bash_history`, `/tmp/tmux-1001` | small |
| `/tmp/commission.sh` (7.2K, created 2026-09-30 21:38; not read) | 7K |
| `~/.config/rclone/` (empty) | 4K |

No separate `CLAUDE.md` or notes checkout was found under `/` outside `~/.claude` (a `find` for `CLAUDE.md` and `.claude` found only `~/.claude`).

**Other candidates:**
| Path | Size | Note |
|---|---|---|
| `/home/claude/meridianfxSep4.zip` | 92.3M | Template archive, mode 600. |
| `/home/claude/rforex/meridianfxSep4.zip` | 92.3M | Byte-identical size (96773452) to the copy above, so very likely a duplicate. The same size as `~/SiteTemplates/meridianfxSep4.zip` on wp-eu (96773452 bytes). |
| `/home/claude/rforex/rforex_assets/` | about 12M (excluding the zip) | Asset and content bundle for rforex (markdown docs, legal text, branding, images including `_not-rforex` and `uploads-old-2013-2016` folders). Likely staging material for the site build. Not opened. |
| `/var/cache/apt/` and `/var/lib/apt/lists/` | 207M and 143M | Regenerable. Includes a 36.9M tailscale .deb. |
| `/var/log/journal/` | 41M | |
| `/boot`: kernel `7.0.0-30` initrd | 26M | Running kernel; leave until after the reboot. |
| `/var/www/html/index.nginx-debian.html` | 615B | Stock page; not served. |
| `/etc/nginx/sites-available/default`, `/etc/nginx/nginx.conf.orig` | 2.4K, 1.5K | Stock files, unused. |
| `/var/lib/mariadb/ib_logfile0` | 96M | Normal InnoDB redo log; not junk. |

Nothing else visible: site trees, `/root/backups` and site logs are unreadable, so any old backups, dumps, logs or abandoned site directories inside them are not listed here.

## Could not read without sudo
- Everything under `/var/www/8itrade.com` and `/var/www/rforex.trade` (wp-config, versions, plugins and themes, logs, uploads, backups inside the tree)
- `/root`, including `/root/backups` (the nightly backup archives)
- `/usr/local/sbin/backup-sites.sh`, `add-site.sh`, `remove-site.sh`
- `/etc/nginx/ssl/`, `/etc/letsencrypt` private material and certificate expiry
- `/var/spool/cron/crontabs/*`, `/home/alex`
- The MariaDB data directory's database folders and the `mysql` schema
- `ufw` / firewall state
