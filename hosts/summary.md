# Summary: wp-eu, wp-asia, kd-site

Surveyed 2026-09-30, read-only, as `claude` without sudo. Per-host detail is in [wp-eu.md](wp-eu.md), [wp-asia.md](wp-asia.md) and [kd-site.md](kd-site.md). Nothing was modified, restarted, deleted or written on any host. No database was contacted; wp-config.php was only grepped for `DB_NAME` and `table_prefix` (and on wp-asia it was not readable at all). Credentials were never read.

**What I could not see is as important as what I could.** wp-asia's two site directories are unreadable to `claude`, so its WordPress versions, plugins, themes and database names from wp-config are all unknown. Plugin *active* status is unknown everywhere, because it lives in the database. Root-only data (`/var/lib/mysql` on wp-eu and kd-site, `/root/backups` and the provisioning scripts on wp-asia, letsencrypt contents, user crontabs) was unreadable throughout.

## Hosts at a glance

| | wp-eu | wp-asia | kd-site |
|---|---|---|---|
| Role | production | production | templates, demos, company site, two client sites |
| OS / arch | Ubuntu 26.04, x86_64 | Ubuntu 26.04.1, x86_64 | Ubuntu 24.04.3, **aarch64** |
| Kernel running / installed | 7.0.0-28 / 7.0.0-34 | 7.0.0-30 / 7.0.0-34 | 6.8.0-117 / 6.8.0-142 |
| Disk | 150G, 5% used | 75G, 27% used (20G; about 16G not visible to me) | 75G, **76% used** (54G; 18G free) |
| Web / PHP | nginx 1.28.3, PHP 8.5.4 | nginx 1.28.3, PHP 8.5.4 | nginx 1.24.0, PHP 8.3.6 **and 8.1** (Apache installed, inactive) |
| Database | MySQL 8.4.11 | MariaDB 11.8.6 | MySQL 8.0.46 |
| WordPress sites | 2 (alverix, zentro) | 2 (8itrade.com, rforex.trade): versions unknown | 27 nginx vhosts (23 of them WordPress) and 35 WordPress trees on disk including `site_old` and archive copies |
| PHP isolation | per-site user, `open_basedir` | per-site user, `open_basedir` | everything as `www-data`, no `open_basedir` |
| Scheduled backup | none | nightly 03:00, local only | none |
| wp-cron | system cron every 5 min per site | none visible | system cron for 2 of the trees |
| Extras | Redis (unused by the sites), Cloudflare IP timer | fail2ban | dead `ditto` proxy target (port 3000) |

## Cross-host findings

1. **Reboots are pending on all three hosts** (`/var/run/reboot-required`, running kernel older than installed). On wp-eu the running kernel is `-28` and `-34` is installed. Nothing to do until someone reboots deliberately.
2. **Production and the template host differ in stack.** The demos are built and exercised on PHP 8.3 / MySQL 8.0 / nginx 1.24 (arm64). Production runs PHP 8.5.4 / nginx 1.28.3 on x86_64, with MySQL 8.4 on wp-eu and MariaDB 11.8 on wp-asia. Three different database servers are in play, and nothing in what I can see tests a template on the production PHP version first.
3. **Production matches its source templates version for version.** wp-eu's alverix has the same plugin set as the `meridianfx` template (Elementor 4.2.2, Astra 4.13.8, astra-sites 4.7.3, essential-addons 6.7.3, header-footer-elementor 2.9.2, safe-svg 2.4.0, wpforms-lite 2.0.0.2) and WordPress 7.1.2. zentro has the same set as the `premium` template (Elementor 4.2.1, ACF 6.8.6, kirki 6.1.1, lexend-core 2.5, theme lexend 2.6) and its custom `premiumfx-config.php` mu-plugin. So updates land on the template first and production lags it, which is also why the two prod sites have different Elementor versions (4.2.2 vs 4.2.1).
4. **Isolation differs.** Both production hosts run one PHP pool and Unix user per site with `open_basedir`. kd-site runs all 27 vhosts in shared pools as `www-data`, and several `site_old` trees share a database with their current tree.
5. **Backups are the weakest area.** No host shows an off-host copy. wp-asia has the only scheduled job (local, `/root/backups`, about 14 days). wp-eu relies on hand-made "pre-change" dumps inside each site's `backups/` directory (about 12M). kd-site keeps eight 2.6G restore points that come from a manual migration script (21G), plus three duplicated Updraft sets. The template sources on kd-site have no backup at all, and `/srv/kdtemplates/README.md` itself says nothing there is a backup.
6. **Same artifacts on every host.** `meridianfxSep4.zip` (96773452 bytes, 2026-09-04) is in the claude home on all three hosts, with a fourth copy on wp-asia under `~/rforex/`. A 7243-byte `/tmp/commission.sh` (created tonight) sits on all three; I did not read it.
7. **Claude Code is installed per host and keeps every version.** The old versions total about 1.47G on wp-eu, 648M on wp-asia and 836M on kd-site (about 2.95G), plus about 100M of `~/.claude` state. kd-site also has `CLAUDE.md` files in the template tree and a 258M DB dump in `/tmp/claude-1010`.
8. **Common infrastructure:** all three sit behind Cloudflare (real-IP ranges configured), all run Tailscale, all use Let's Encrypt through certbot, none exposes the database beyond 127.0.0.1. I could not see a host firewall anywhere (needs root). Only wp-asia runs fail2ban.
9. **Things worth a look on kd-site** (observations only, nothing tested):
   - Its disk is 76% full, mostly backups and duplicates (see the trim list).
   - The global `ssl_protocols` line still lists TLSv1 and TLSv1.1.
   - The `ditto.kenmoredesign.com` vhost proxies to 127.0.0.1:3000, where nothing listens, and names a certificate for `mailautomation.thebestprop.com`.
   - `aafx-calculators/` is world-writable (777) and from 2020.
   - `wp-file-manager` is installed in 9 trees.
   - Six legacy `*.78.47.190.199.nip.io` certificates exist only to serve redirects.
   - The company site serves two large installers (763M and 101M) from its docroot on purpose, per explicit nginx exceptions.

## How a site gets from the kd-site template to a production host (inferred)

I did not see a deployment script for this path. `add-site.sh`, `remove-site.sh` and `backup-sites.sh` on wp-asia are root-only, and `/tmp/commission.sh` was deliberately not opened. What follows is reconstructed from artifacts. The kenmoredesign.com dev-to-live script (`kdsites/migrate-dev-to-live.sh`) is a *different* flow and is described at the end.

**Evidence used**
- kd-site: `kdtemplates/<name>/site` trees, each with its own `kd_<name>` database; `/srv/kdtemplates/` (README, `generateur-logos/` with `vhost.tpl`, `legacy-*.tpl` and `map.txt`, `outils/` of `wp eval-file` scripts, `installateurs/`); `kdtemplates/premium/` with dated zips and `_staging/`.
- wp-eu: `~/premiumfx-transfer/` (DB dump `kd_premium-20260804.sql.gz`, `files/wp-content/{mu-plugins,plugins,themes,uploads}`, `server-config/{premium.nginx.conf, premium-fpm-pool.conf, wp-config-template.php}`, `SHA256SUMS`); each site's `backups/` directory with dated dumps and config copies; `/var/www/zentro/.wp-cli/cache/` (core 7.0.2, elementor 4.2.1, ACF, CF7, importer zips, all 2026-08-04); `cron.d/wp-cron-*`.
- wp-asia: `~/rforex/rforex_assets/` (MANIFEST, CHECKSUMS, content, legal, branding, images) and `meridianfxSep4.zip`; the `add-site.sh` filename; per-site naming (`wp_<domain>` user and DB); the backup log.

**Steps**
1. **Build and stage the template on kd-site.** A template lives at `/var/www/html/kdtemplates/<template>/site` (or `meridianfx/` directly) with database `kd_<template>`. It is served at `<brand>.kenmorefx.com` through a generated vhost (`vhost.tpl` filled from `map.txt`, e.g. `broker3` → `atlasfx`), with certbot certificates and a noindex header. Content is shaped with the `wp eval-file` tools in `/srv/kdtemplates/outils` and the `kd-*` mu-plugins.
2. **Snapshot it into a transfer bundle.** For `premium` this is `premiumfx-{db,files,source}-20260731.zip` plus a staged copy in `_staging/`, and then `premiumfx-transfer/` (DB dump, the four `wp-content` subtrees, nginx and FPM config, a wp-config template and `SHA256SUMS`). For `meridianfx` it is `meridianfxSep4.zip` (92M, 2026-09-04). Only wp-content, the database and config are carried, not WordPress core.
3. **Copy the bundle to the target host.** The bundle lands in the `claude` home on the target (`~/premiumfx-transfer`, `~/SiteTemplates/` on wp-eu, `~/meridianfxSep4.zip` and `~/rforex/` on wp-asia). Checksums (`SHA256SUMS`, `CHECKSUMS.sha256`) suggest an integrity check on arrival.
4. **Provision the site on the target.** Create a per-site system user and `/var/www/<site>/{public,logs|backups,tmp}`; create a PHP-FPM pool (per-site user and socket, `open_basedir`); create an nginx vhost that includes the shared `snippets/wordpress.conf` with the site's socket; create a database (`wp_<site>`) and database user; write `wp-config.php` from the template. On wp-asia this looks scripted (`add-site.sh`, with `wp_<domain>` names, pool and vhost named after the domain); on wp-eu it looks done by hand (pools and `cron.d` files created one at a time, `.bak`/`pre-ssl` copies in `backups/`).
5. **Install WordPress core on the target.** Core is fetched by `wp` on the host (the wp-cli cache holds `wordpress-7.0.2-en_US.zip` and the plugin zips); prod now runs 7.1.2.
6. **Load the template's content.** Copy the `wp-content` trees into `public/`, import the DB dump, and run a serialization-safe search-replace from the template hostname to the real domain. wp-eu's alverix backups (`db-pre-domain-…`, `db-pre-rebrand-…`, `db-pre-slugs-…`) and zentro's `db-pre-*` series are consistent with this and with later rebranding edits.
7. **Get TLS.** Start with an HTTP vhost, run certbot (first `nginx` authenticator, shown by the `*.pre-ssl` and `post-certbot` copies on wp-eu; on wp-eu the vhosts later use the shared webroot `/var/www/letsencrypt`; wp-asia stays on the `nginx` authenticator), and add `www` and redirect server blocks. Cloudflare sits in front (real-IP config).
8. **Make cron real.** Add a `/etc/cron.d/wp-cron-<site>` entry running `wp cron event run --due-now` every 5 minutes as the site user (wp-eu). wp-asia shows none.
9. **Customize for the client brand.** Tune the site with mu-plugin edits (`kd-*` files, `premiumfx-config.php`), Elementor JSON swaps, logos, addresses, legal text and links, taking a dated dump and file copy before each change (the `*.pre-<change>` pattern).
10. **Operate.** wp-asia adds nightly DB and file backups; wp-eu has none.

**Unverified:** how files move between hosts (scp, rsync or Tailscale), who creates the databases and users, whether wp-asia's scripts do everything in step 4, and whether `8itrade.com` came from a template at all (only `rforex.trade` has template evidence there). The steps were reconstructed from timestamps: zentro on 2026-08-04, alverix on 2026-09-07, rforex on 2026-09-15 and 8itrade.com on 2026-09-15.

**Separate flow, seen directly:** `kdsites/migrate-dev-to-live.sh` pushes `dev.kenmoredesign.com` → `www.kenmoredesign.com` on the same host: maintenance mode on, live DB and files zipped into `_backups/`, dev DB exported, live DB cleared and replaced, dev URLs rewritten to live, files rsynced with `--delete` (keeping wp-config, robots.txt, .htaccess), `blog_public` forced on, caches cleared, maintenance mode off, then a homepage check and retention of the last 8 restore points. It is run by hand with sudo.

## Prioritized trim list

**List only. Nothing was deleted, and I have not confirmed any entry is unused.** Sizes are as measured on 2026-09-30. Each item needs a human to confirm before removal.

### Priority 1: kd-site (disk is 76% full)
| # | Candidate | Size | Reason |
|---|---|---|---|
| 1 | `kdsites/_backups/live-restorepoint-*.zip`, the six oldest (2026-06-18, 06-19, 07-02, 07-20, 08-12, 08-25), keeping the two newest | about 15.6G | Eight restore points are kept (21G); the script's retention is 8 |
| 2 | `kdsites/dev.zip` | 2.7G | Zip of the dev tree from 2026-07-20 |
| 3 | `kdsites/dev/wp-content/updraft/` and `dev2/…/updraft/` | 2 × 1009M = 2.0G | Same file names and sizes as the live tree's set |
| 4 | `kdsites/dev/` and `dev2/Forex-CRM-*.zip` (two zips each) | 2 × 864M = 1.7G | Duplicates of the copies served from the live docroot |
| 5 | `kdsites/{site,dev,dev2}/wp-content/cache` | 329M + 296M + 402M = 1.0G | Regenerable cache (plus 40M in `victory`) |
| 6 | Unserved `site_old` and archive trees: `kdtemplates/*/site_old` (about 771M), `clientsites/2sto/site_old` (236M), `webdesign/chass/site_old` (76M), `ninjacharge/old` (63M) | about 1.15G | Old WordPress 3.x/4.x trees with no vhost; six share a database with their live tree, so check before dropping any data |
| 7 | `clientsites/2sto.zip` (547M), `2sto/site.zip` (118M), `2sto/site/site.zip` (46M), `2sto/site/wp-content/backups-dup-lite` (144M) | about 855M | Client-site zips and a Duplicator archive |
| 8 | `/tmp/claude-1010/` | 327M | Includes a 258M live-DB dump from 2026-09-25 |
| 9 | Claude Code old versions in `~/.local/share/claude/versions` (2.1.272, .267, .263, .261) | about 836M | Only 2.1.282 is linked |
| 10 | `kdtemplates/executive/site.zip` and `site/site.zip`; premium `_staging/` (94M tree + 30M zip) and the three premium zips | about 400M | Older snapshots; the premium zips are the source of the wp-eu zentro build, so keep one if that matters |
| Subtotal | Items 1 to 10 | **about 26.5G** | Would take the disk from 76% to about 37% |
| Optional | `kdsites/dev2/` whole tree (WP 6.9.9, still has a vhost) | 3.4G | Needs a decision on whether `dev2.kenmoredesign.com` is still used |
| Optional | `webdesign/gea` (355M), `webdesign/chass` (226M), `webdesign/centralcleaners` (592K) | about 0.6G | No vhosts, content from 2016 to 2018 |

### Priority 2: wp-eu
| # | Candidate | Size | Reason |
|---|---|---|---|
| 1 | Claude Code old versions in `~/.local/share/claude/versions` (6 old) | about 1.47G | Only 2.1.284 is linked |
| 2 | `~/SiteTemplates/meridianfxSep4.zip` | 92M | Template archive; same file exists on the other hosts |
| 3 | `/var/www/zentro/.wp-cli/cache/` | about 62M | Download cache from 2026-08-04 |
| 4 | `~/.claude/` and `/tmp/claude-1001/` (contains a 1.5M DB dump) | 31M + 2.2M | |
| 5 | `/var/www/zentro/backups/` (old dumps, scripts, JSON) and `/var/www/alverix/backups/` | about 11.6M + 0.6M | Hand-made pre-change snapshots; the only backups these sites have, so keep the newest of each |
| 6 | `/var/log/journal`, apt caches | 130M; 285M | Regenerable |
| 7 | Stray items: `~/mt55.png` (524K duplicate), empty `~/echo/`, a stray directory named after an SSH public key, `sites-available/default.bak.2026-09-04` | under 1M | |
| Subtotal | Items 1 to 4 | **about 1.66G** | The disk is only 5% used, so this is housekeeping rather than urgent |

### Priority 3: wp-asia
| # | Candidate | Size | Reason |
|---|---|---|---|
| 1 | Claude Code old versions (2.1.272, .271, .270) | about 648M | Only 2.1.273 is linked |
| 2 | `~/meridianfxSep4.zip` or `~/rforex/meridianfxSep4.zip` | 92.3M | Identical-size duplicates |
| 3 | `~/.claude/` and `~/.claude.json` | 19M | |
| 4 | apt caches and journal | 350M and 41M | Regenerable |
| Subtotal | Items 1 to 3 | **about 760M** | |
| Unmeasured | `/root/backups` (about 15 daily copies) | unknown (possibly about 13G if logged sizes are on-disk sizes) | Needs sudo; retention appears to be about 14 days, so it is self-limiting |

**Totals:** about 26.5G on kd-site, 1.7G on wp-eu and 0.8G on wp-asia, roughly **29G** in all, nearly all of it on kd-site.

### Not trim candidates (for clarity)
`/swapfile` (4.1G), `/srv/kdtemplates` (24M, the template build tools and sources), `kdtemplates/*/site` trees (the live demos), both MariaDB/MySQL data directories, and the currently linked Claude Code version on each host.
