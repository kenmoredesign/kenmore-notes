# kdsites: preparing a live -> dev refresh (2026-10-08)

Prepared only. Nothing was changed and the script was not run. Script and dry-run output:
`~/ops/kdsites/refresh-dev-from-live.sh` and `refresh-dev-from-live.dry-run.txt`.

## 1. What `migrate-dev-to-live.sh` does (dev -> live)

Run by hand as root (`readme.txt`); written for cron but no cron entry calls it. `DRY_RUN=1` previews.

| Step | Action |
|---|---|
| 0 | Pre-flight: tools present, both trees and both `wp-config.php` exist, both sites answer `wp core is-installed`, `table_prefix` equal, free space at least 1.2 x live |
| 1 | Live into maintenance mode |
| 2 | Restore point: dumps live's database to `site/_restore_db_<date>.sql` **inside live's docroot**, zips the whole live tree (minus `*/cache/*`) with that dump to `BACKUP_DIR`, deletes the loose dump |
| 3 | Dumps dev's whole database to a temp file in `/tmp` |
| 4 | `wp db clean` on live (drops every `wp_`-prefixed table), imports dev's dump, `search-replace dev.kenmoredesign.com www.kenmoredesign.com --all-tables` |
| 5 | `rsync -a --delete dev/ site/`, then `chown -R www-data:www-data` on live |
| 6 | `blog_public = 1`, rewrite flush, cache flush, empties `wp-content/cache`, `uploads/cache`, `uploads/elementor/css` on live |
| 7 | Maintenance mode off, checks the home page returns 200/301/302 |
| 8 | Deletes all but the newest 8 `live-restorepoint-*.zip` |

On failure after step 1 it leaves live in maintenance mode and logs how to roll back. A dry run
still creates a restore point.

What it treats differently between dev and live:

- **URLs:** the two host names, rewritten in every table after import.
- **Kept on live, never copied or deleted:** `wp-config.php`, `robots.txt`, `.htaccess`,
  `.user.ini`, `.maintenance`.
- **Not copied, regenerated:** `wp-content/cache/`, `uploads/cache/`, `uploads/elementor/css/`,
  `wp-content/wp-rocket-config/`, any `.cache/`.
- **Search visibility:** forced on for live (`blog_public = 1`); dev has it off.
- **Database:** everything with the `wp_` prefix is replaced, including users, options, plugin
  settings and transients. Tables without the prefix are left alone by `db clean`, but dev's
  dump is the whole dev database, so a non-prefixed table that exists on dev is imported too.
- **Not handled:** `wp-content/advanced-cache.php` is copied from dev although it holds dev's
  absolute paths (WP Rocket rewrites it later); the analytics and chat tags live in the database
  and so are whatever dev had.

## 2. What exists on dev that is not on live

Almost nothing. dev and live are the same site as of the last migration (2026-09-25 13:21).

- **Database:** identical counts for every post type and status, same newest modification
  (page 2026-09-24 10:55, post 2026-09-24 08:10, attachment 2026-09-18), same 7 users, same
  active plugin set, same 59 tables. No post or page on either side has been modified since the
  migration. Differences are only what each site accumulates by running: redirect logs, Yoast
  and WP Rocket tables, revisions; dev has 14 more option rows (transients and the like).
  `blog_public` is 0 on dev and 1 on live; `home`/`siteurl` differ as they should.
- **Theme, plugins, core (checksum compare):** no file differs. 8,258 files have different
  timestamps only.
- **Only on dev:** three generated Elementor CSS files in `uploads/elementor/css/` and a `.cache/`
  directory. Both are excluded from the sync and regenerated.
- **Only on live** (would appear on dev): `wp-content/plugins/wordfence/` (19 leftover files, not
  an active plugin), `wp-content/wflogs/`, `wp-content/backups-dup-lite/`.
- **Different on purpose, preserved by the script:** `wp-config.php`, `robots.txt` (dev:
  `Disallow: /`), `.htaccess` (dev's has 79 lines of old cache rewrite rules, live's has none;
  nginx ignores both), `wp-content/advanced-cache.php` (paths).

So a refresh today would overwrite no work on dev. That changes as soon as anything is edited
on dev (fix 1, for instance): check again before running.

## 3. The live -> dev script

`refresh-dev-from-live.sh`, dry run by default, `--run` to execute, root only.

- **Live is read-only.** Three commands touch live: `wp db tables`, `wp db export` (to a temp
  file in `/tmp`, with `--single-transaction` so live's tables are not locked) and an rsync with
  live as the source. A wrapper refuses any other WP-CLI command against live. No maintenance
  mode on live.
- **Refuses to run** unless the target is exactly `/var/www/html/kdsites/dev`, resolves there,
  differs from the live directory, uses a different database name from live, and its home URL
  is the dev host.
- **Backs up dev first:** database dump plus the whole dev tree (minus caches) in one zip,
  `/var/backups/kenmore-ops/kdsites/dev-backup-<date>.zip`, root-only. Keeps the newest 3.
  The dump is never written into a web root.
- **Copies only `wp_`-prefixed tables from live,** so live's lead log (once fix 1 is deployed)
  stays on live, and dev's own lead log survives the refresh.
- **dev keeps** `wp-config.php`, `robots.txt`, `.htaccess`, `.user.ini`, `advanced-cache.php`
  and its caches.
- On failure it leaves dev in maintenance mode and prints the rollback commands.

### dev's wp-config.php against live's (names only; values compared by hash)

| Should differ | Today |
|---|---|
| `DB_NAME` | differs |
| `SENDPULSE_CLIENT_ID`, `SENDPULSE_CLIENT_SECRET` | differ since live was rotated; **dev still has the old pair** |
| The 8 keys and salts | **identical today**; will differ after the shuffle. While they match and the user tables match, a login cookie from dev is valid on live |
| `DUPLICATOR_AUTH_KEY` | dev only |
| `DB_PASSWORD`, `DB_USER` | identical: one MySQL user serves live, dev and dev2. Separate users would be better, and it is a separate job |

| Should match | Today |
|---|---|
| `$table_prefix` (the script requires it) | same |
| `DB_HOST`, `DB_CHARSET`, `DB_COLLATE` | same |
| `SENDPULSE_RESPONSIBLE_ID` (unless dev leads should go to another owner) | same |
| `WP_CACHE`, `WP_DEBUG`, `DISABLE_WP_CRON`, `WP_ALLOW_MULTISITE`, `ABSPATH` | same |

`WP_HOME` and `WP_SITEURL` are named in both files and compare equal, so they appear only in
comments or carry no host; the URLs come from the database.

## 4. What should be different on dev after a refresh, and is not today

| Item | Today | After the script |
|---|---|---|
| Search engines | `blog_public = 0` and `robots.txt` disallows all. Pages are still public to anyone with the URL | Same; `blog_public` set again each run. A login wall (basic auth in the dev vhost) would be the real fix, not done |
| Analytics | dev loads live's GTM container, which loads GA4, PostHog, Clarity and LinkedIn: dev traffic and test runs land in live's reports | Site-wide head/body/footer code emptied on dev (`DEV_STRIP_TAGS=1`). Every refresh brings the tags back from live, so the script removes them each time |
| Chat | Chatwoot widget on dev talks to the live inbox | Removed with the tags above |
| Leads | dev's form writes to the live SendPulse CRM (same account) | Unchanged: decided by the values in dev's `wp-config.php` |
| SendPulse token | live's cached token would arrive with the database | Deleted on dev after import |
| Outgoing mail | Neither site can send: no mail transport on the host | Unchanged. When SMTP is added for live (fix 2), dev must not inherit it: keep it in `wp-config.php`, which dev keeps |
| Scheduled jobs | dev's WP-cron runs every 5 minutes (`/etc/cron.d/wp-cron-kdsites-dev`) on a copy of live's data: kenmore-translate's queue (DeepSeek API calls), broken-link checker, image optimiser all run twice | Not changed by the script. Worth deciding whether dev needs cron at all |
| Salts | Same as live | Different once shuffled; the script never copies `wp-config.php` |

## 5. dev2

It looks abandoned as a work site, but something still watches it.

- **Content:** newest post or page change 2026-06-05; nothing since July.
- **Logins:** newest admin sessions are esteban 2026-06-24, mike 2026-06-05, alex 2026-06-04,
  denis 2026-04-20, Nat 2026-04-07. No successful login in the 15 days of logs (0 redirects
  after 593 `wp-login.php` POSTs, all from bots).
- **Files:** the only changes since June are automatic: translation updates (latest
  2026-10-06) and a core auto-update to 6.9.10 with its database upgrade on 2026-10-06.
  No SFTP or SSH login by denis or esteban in the current auth logs, and neither is allowed in.
- **Traffic, 15 days:** 73,951 requests from 167 IPs. 20,542 are an Uptime-Kuma monitor at
  89.167.38.140, 18,709 the site calling itself (WP-cron and loopbacks), 11,848 WP Rocket
  preloading. About 12,600 page views carry browser user agents from 80 IPs; with no login and
  scanners known to be working on it, I read most of those as bots, not people.
- **Exposure:** older plugins (the notes list its versions), no deny rules of its own until
  today's snippet, no cron entry, same database user and SendPulse constants as live.

Unknown from here: who runs the Uptime-Kuma monitor, and whether anyone still needs dev2.

## Update 2026-10-09: failure handling, restore, excluded folders

**The live export** (`/tmp/live-export-<date>.sql`, a full copy of live's WordPress tables,
mode 600) is removed when the script ends, however it ends: normal finish, a failed step, or an
interrupt. The dry run now prints that `rm`.

**If a step fails:**

- before dev's database is cleaned (pre-flight, backup, live export): the script stops, takes
  dev out of maintenance mode again and says dev was not modified;
- once dev's database has been cleaned (import, URL rewrite, file sync, dev-only settings): the
  script stops, leaves dev in maintenance mode, and prints the restore commands with the real
  file names of that run.

**Restoring dev from a backup zip** (as root; replace `<date>` with the stamp in the zip's name):

```sh
Z=/var/backups/kenmore-ops/kdsites/dev-backup-<date>.zip
D=/var/www/html/kdsites/dev
unzip -p "$Z" "dev-backup-<date>.sql" | sudo -u www-data wp --path="$D" db import - --default-character-set=utf8mb4
unzip -o -q "$Z" -x "dev-backup-<date>.sql" -d "$D"
chown -R www-data:www-data "$D"
sudo -u www-data wp --path="$D" maintenance-mode deactivate
curl -sI https://dev.kenmoredesign.com/ | head -1
```

The import replaces every table (the dump drops and recreates each one), and it works on an
empty database. The unzip puts back every file dev had, including its `wp-config.php`; it does
not remove files that arrived from live and dev did not have. The zip holds dev's
`wp-config.php` and database, so it is root-only.

Tested on the Ops box against stub commands (nothing on kd-site was run): a normal run, a
failure of the live export, of the import and of the URL rewrite. In each case the live export
was gone afterwards, no write command was issued against live, and dev's maintenance state was
as described above.

**Live-only folders the first version would have copied to dev,** now excluded together with
`updraft` (the same 1 GB of December and February UpdraftPlus sets sits on both sides):

| Folder on live | Size | What it is |
|---|---|---|
| `wp-content/backups-dup-lite/` | 12 K, 2 files (`.htaccess`, `robots.txt`) | Duplicator's backup folder, empty of backups |
| `wp-content/wflogs/` | 8 K, 1 file (`.htaccess`) | Wordfence's log folder, not a backup; excluded with it since it is live-only state |
| `wp-content/plugins/wordfence/` | 76 K, 8 `.htaccess` files in an empty directory skeleton | What is left of a removed Wordfence. **Not excluded**: it is under `plugins/`, and excluding one plugin folder would make dev's plugin tree differ from live's. It is not a working plugin |

## Refresh run, 2026-10-09 11:52 to 11:57 UTC

dev was refreshed from live with `refresh-dev-from-live.sh --run` (defaults), in a root window.

- **Backup of dev before the refresh:** `/var/backups/kenmore-ops/kdsites/dev-backup-2026-10-09_115226.zip`
  (2.66 GB, root-only; 35,808 entries including `dev-backup-2026-10-09_115226.sql`, 271 MB, and
  dev's `wp-config.php`). Run log: `refresh-dev-2026-10-09_115226.log` beside it.
- **Result:** dev's database is live's as of 11:52 (2,811 posts and pages, newest 11:33 that
  day), 140,497 URL replacements, files identical to live outside the preserved and excluded
  paths (checksum compare: 0 differences). `blog_public` 0; site-wide head, body and footer code
  emptied, so dev pages carry no GTM and no Chatwoot; no mention of the live host in dev's pages.
  dev's `wp-config.php` was not touched (still the file from the salts shuffle), so dev still
  holds the old SendPulse pair until the owner replaces it.
- **Live:** not written to. Same post count and newest change before and after, tags intact,
  no file written by the run, home and contact pages 200.
- **Checked after:** dev home, contact, Arabic home and login return 200; forms pass the
  capture-mode browser test in English and Arabic at both widths; no PHP fatal.

Two faults in the script showed up in this first real run. Both were fixed and committed.

1. **First attempt (11:51) stopped at the backup step** before anything was modified: the web
   user cannot write a dump into the root-only backup directory. dev was put back online
   automatically. Fix: the dump goes to `/tmp` and into the zip from there.
2. **Second attempt completed steps 1 to 6, then failed at the last command.**
   `wp maintenance-mode deactivate` reported "already deactivated": something had removed the
   `.maintenance` file during the run (not identified; the dev cron job that started at 11:52:01
   is a candidate). The error handler then did what it is meant to do after a late failure and
   put dev into maintenance mode, although the refresh itself was complete. The flag was removed
   by hand at 11:59 and dev checked. dev showed the maintenance page for about 3 minutes longer
   than needed. Fix: the script now writes and removes the flag file itself. That also closes a
   gap: WP-CLI's flag carries a fixed timestamp that WordPress ignores after 10 minutes, so a
   longer run would have left the site open mid-refresh. `migrate-dev-to-live.sh` uses the
   WP-CLI flag for live and has that same 10-minute limit.

Leftover on kd-site: `/root/refresh-run.log` (console output of the run, no secrets).

**Correction:** kenmore-translate on this site is set to provider `openai` with model
`gpt-5.4-mini`; the API key in `kt_api_key` is an OpenAI key, not DeepSeek as the plugin's
README and earlier notes here say. It is stored in the database, so it is in every database
dump: the restore points, the UpdraftPlus sets and the dev backup above.
