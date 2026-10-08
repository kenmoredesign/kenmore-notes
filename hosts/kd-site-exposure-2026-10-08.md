# kd-site: web-root exposure, 2026-10-08

Read-only follow-up after the port-80 catch-all was closed at 12:17 UTC (see `kd-site.md`).
Names and paths only; no file contents or values were read or downloaded. HTTP checks were
HEAD requests.

## Still open (found during this check)

Sensitive files are also served by **named** vhosts, which the catch-all fix does not touch:

| URL | What it is | Status now | Seen in logs |
|---|---|---|---|
| `https://2sto.net/site.zip` | 45.6 M zip of the 2sto site, contains `site/wp-config.php` | **200** | **Downloaded 6 times** (full 47,847,936 bytes) |
| `https://executive.kenmorefx.com/site.zip` | 45.6 M, contains `site/wp-config.php` | **200** | no 200 in 15 days |
| `https://success.kenmorefx.com/successnew.zip` | 38.9 M, contains `wp-config.php` | **200** | no 200 in 15 days |
| `https://2sto.net/error_log`, `executive…/error_log`, `victory…/error_log` (5.1 M) | PHP error logs | **200** | not checked |
| `https://www.kenmoredesign.com/wp-content/themes/sage/resources/assets/kenmore/.git/config` and `/HEAD` | git metadata of the theme assets repo (same under `kenmore/kenmore/`, and on dev, dev2) | **200** | 2 × 200, both my own HEADs |
| `https://dev.kenmoredesign.com/Forex-CRM-Setup-1.0.0.exe.zip` | duplicate installer, served on purpose on live only | 200 | not sensitive |

The six `2sto.net/site.zip` downloads:

| Date (UTC) | Source IP | Bytes |
|---|---|---|
| 2026-09-26 12:25:54 | 195.178.110.131 | 47,847,936 |
| 2026-09-26 13:31:22 | 93.123.109.55 | 47,847,936 |
| 2026-09-30 09:10:30 | 195.178.110.15 | 47,847,936 |
| 2026-10-02 15:38:29 | 149.88.76.100 | 47,847,936 |
| 2026-10-02 20:45:55 | 195.178.110.15 | 47,847,936 |
| 2026-10-04 11:05:09 | 93.123.109.55 | 47,847,936 |

That zip is dated 2026-06-16; whether its `wp-config.php` still matches 2sto's current database
password was not checked. Scanners probe the demo hosts daily for `/database.sql`, `/backup.zip`,
`/dump.sql` and similar (all 404), so guessable archive names in a docroot do get found.

## 1. Who used the catch-all

**The logs go back to 2026-09-24 00:00 UTC only** (14 rotations, 507,914 lines in the shared
`access.log`, which holds the catch-all and kenmoredesign.com). How long the catch-all existed
before that is unknown, and nothing earlier can be checked on this host.

Method: the access log has no Host field, so catch-all hits were identified by path. Only the
catch-all had `/var/www/html` as root, so only it could answer for `/kdsites/…`,
`/kdtemplates/…`, `/clientsites/…`, `/webdesign/…`, `/ninjacharge/…`, `/aafx-calculators/…`
or `/php-sql-test/…`.

28 such requests in 15 days, all of them today. Every 200/206, with nothing excluded:

| Time (UTC) | Source IP | Request | Status | Bytes | Who |
|---|---|---|---|---|---|
| 11:43:50 to 12:09:43 | 188.245.16.25, 2a01:4f8:1c16:dcc1::1 | HEAD `wp-config.php` ×4, `dev.zip` ×2, `debug.log`, `readme.txt` | 200 | 0 | Ops box (me) |
| **12:01:10** | **35.170.74.146** | **GET `/kdsites/site/wp-config.php`** | **206** | **3731 (the whole file)** | `Slackbot-LinkExpanding 1.0` |
| 12:01:38 | 84.255.31.238 | HEAD `/kdsites/site/wp-config.php` | 200 | 0 | `curl/8.7.1`, taken to be the owner's check |

Also 12:01, from 35.172.165.90: one range request answered 416 with no content.

So, apart from the Ops box and the owner's check: **one transfer of the live `wp-config.php`, to
Slack's link-preview fetcher**, which fetches a URL when it is posted in a Slack message. No
`.zip`, `.sql`, `.env` or `_backups/` path was served to anyone in the window. No third-party
scanner requested a catch-all path in 15 days.

## 2. What was reachable under `/var/www/html`

**Config files with secrets.** Constant names only.

| Files | Secret-bearing names |
|---|---|
| `kdsites/site/wp-config.php`, `kdsites/dev2/wp-config.php` | `DB_PASSWORD`, the 8 keys and salts (`AUTH_KEY`, `SECURE_AUTH_KEY`, `LOGGED_IN_KEY`, `NONCE_KEY`, `AUTH_SALT`, `SECURE_AUTH_SALT`, `LOGGED_IN_SALT`, `NONCE_SALT`), `SENDPULSE_CLIENT_ID`, `SENDPULSE_CLIENT_SECRET`, `SENDPULSE_RESPONSIBLE_ID` |
| `kdsites/dev/wp-config.php` | the same, plus `DUPLICATOR_AUTH_KEY` |
| `kdtemplates/{meridianfx, broker2-5/site, prop1-5/site, premium/site}/wp-config.php`, `kdtemplates/premium/_staging/premiumfx-files-20260731/server-config/wp-config-template.php` | `DB_PASSWORD`, the 8 keys and salts, `WP_CACHE_KEY_SALT` |
| `kdtemplates/{breeze, corporate, executive, modern, progress, victory}/{site,site_old}/wp-config.php`, `kdtemplates/{prestige, success}/site/wp-config.php`, `kdtemplates/victory/site/wp-config-back.php`, `clientsites/2sto/{site,site_old}/wp-config.php`, `ninjacharge/old/wp-config.php`, `webdesign/chass/{site,site_old}/wp-config.php`, `webdesign/gea/site/wp-config.php` | `DB_PASSWORD`, the 8 keys and salts |
| `ninjacharge/public_html/config.php`, `ninjacharge/git/php/config.php` | a `$config` array (not WordPress) |
| `kdtemplates/modern/{site,site_old}/wp-content/themes/mexin-wp/inc/twitter/config.php` | a `$TConfig` array (Twitter API settings by its name) |
| `kdtemplates/.htpasswd`, `ninjacharge/old/.htpasswd` | password hashes |

37 `wp-config` files in all. `kdsites` site, dev and dev2 share one MySQL user (`KenmoreSAGE`,
all privileges on `kenmore_sage`, `kenmore_dev`, `kenmore_dev2`), so one password covers all three.
The DeepSeek key for kenmore-translate lives in the database, not in a file; it is inside every
database dump listed below.

No `.env` file exists anywhere under `/var/www/html`.

**`.git` directories:** `ninjacharge/git/.git`, and in each of `kdsites/{site,dev,dev2}`:
`wp-content/themes/sage/resources/assets/kenmore/.git` and `…/kenmore/kenmore/.git`.

**Database dumps, loose:** `kdtemplates/premium/_staging/premiumfx-db/import.sql` and
`premiumfx_wp.sql` (3.7 M each), `kdtemplates/premium/_backups/kd_premium-pre-searchreplace-20260731.sql.gz`,
`webdesign/chass/chass_db.sql` (2016), and six UpdraftPlus `…-db.gz` files (two in each of
`kdsites/{site,dev,dev2}/wp-content/updraft/`, Dec 2025 and Feb 2026; names carry a random token).

**Logs:** `wp-content/debug.log` in `kdsites/{site,dev,dev2}`; `error_log` in
`clientsites/2sto/site`, `kdtemplates/{executive,success,victory}/site`.

**Other files to look at** (names only, not opened): `ninjacharge/old/se.php` (29 K, a database
search-and-replace tool by its name), and two PHP files inside image galleries,
`webdesign/chass/site_old/wp-content/gallery/distributors/thumbs/config.php` and
`…/gallery/manufacturer-positions/thumbs/db.php`. PHP in an upload folder is a common sign of
an old compromise. `/var/www/html/aafx-calculators/` is mode 777.

**Archives** (plugin-bundled and theme-bundled zips left out):

| Size | Date | Path |
|---|---|---|
| 66.0 M | 2026-06-16 | `clientsites/2sto/site_old/exec.zip` |
| 45.6 M | 2026-06-16 | `clientsites/2sto/site/site.zip` |
| 142.9 M | 2026-07-31 | `clientsites/2sto/site/wp-content/backups-dup-lite/20260731_2stolimited_3fa84396fedf55911045_20260731110640_archive.zip` |
| 0.1 M | 2026-07-31 | `clientsites/2sto/site/wp-content/backups-dup-lite/20260731_2stolimited_3fa84396fedf55911045_20260731110640_installer.php.bak` |
| 0.0 M | 2026-06-16 | `clientsites/2sto/site/wp-content/themes/executivefx.zip` |
| 117.7 M | 2026-06-16 | `clientsites/2sto/site.zip` |
| 546.7 M | 2026-07-31 | `clientsites/2sto.zip` |
| 2572.0 M | 2026-06-18 | `kdsites/_backups/live-restorepoint-2026-06-18_111957.zip` |
| 2609.0 M | 2026-06-19 | `kdsites/_backups/live-restorepoint-2026-06-19_120502.zip` |
| 2611.7 M | 2026-07-02 | `kdsites/_backups/live-restorepoint-2026-07-02_144349.zip` |
| 2644.0 M | 2026-07-20 | `kdsites/_backups/live-restorepoint-2026-07-20_143138.zip` |
| 2632.9 M | 2026-08-12 | `kdsites/_backups/live-restorepoint-2026-08-12_073311.zip` |
| 2643.2 M | 2026-08-25 | `kdsites/_backups/live-restorepoint-2026-08-25_122443.zip` |
| 2654.3 M | 2026-09-10 | `kdsites/_backups/live-restorepoint-2026-09-10_152620.zip` |
| 2522.4 M | 2026-09-25 | `kdsites/_backups/live-restorepoint-2026-09-25_132116.zip` |
| 101.0 M | 2025-11-07 | `kdsites/dev2/Forex-CRM-1.0.0-arm64-mac.zip` |
| 762.8 M | 2025-11-07 | `kdsites/dev2/Forex-CRM-Setup-1.0.0.exe.zip` |
| 14.7 M | 2026-05-19 | `kdsites/dev2/wp-content/backups-dup-lite/19052026_kenmoredesign_8f5528cabc1541ef9570_20260519131152_archive.daf` |
| 0.1 M | 2026-05-19 | `kdsites/dev2/wp-content/backups-dup-lite/19052026_kenmoredesign_8f5528cabc1541ef9570_20260519131152_installer.php.bak` |
| 0.2 M | 2026-05-20 | `kdsites/dev2/wp-content/kenmore-translate.zip` |
| 3.5 M | 2025-12-26 | `kdsites/dev2/wp-content/themes/sage/resources/assets/kenmore.zip` |
| 25.2 M | 2025-12-26 | `kdsites/dev2/wp-content/themes/sage.zip` |
| 8.4 M | 2025-12-26 | `kdsites/dev2/wp-content/updraft/backup_2025-12-18-0702_Kenmore_Design_85bf16e59ed0-db.gz` |
| 0.0 M | 2025-12-26 | `kdsites/dev2/wp-content/updraft/backup_2025-12-18-0702_Kenmore_Design_85bf16e59ed0-mu-plugins.zip` |
| 159.8 M | 2025-12-26 | `kdsites/dev2/wp-content/updraft/backup_2025-12-18-0702_Kenmore_Design_85bf16e59ed0-others.zip` |
| 57.0 M | 2025-12-26 | `kdsites/dev2/wp-content/updraft/backup_2025-12-18-0702_Kenmore_Design_85bf16e59ed0-plugins.zip` |
| 64.3 M | 2025-12-26 | `kdsites/dev2/wp-content/updraft/backup_2025-12-18-0702_Kenmore_Design_85bf16e59ed0-themes.zip` |
| 158.0 M | 2025-12-26 | `kdsites/dev2/wp-content/updraft/backup_2025-12-18-0702_Kenmore_Design_85bf16e59ed0-uploads.zip` |
| 9.0 M | 2026-02-03 | `kdsites/dev2/wp-content/updraft/backup_2026-02-03-1509_Kenmore_Design_c449c8ed9a6f-db.gz` |
| 0.0 M | 2026-02-03 | `kdsites/dev2/wp-content/updraft/backup_2026-02-03-1509_Kenmore_Design_c449c8ed9a6f-mu-plugins.zip` |
| 160.2 M | 2026-02-03 | `kdsites/dev2/wp-content/updraft/backup_2026-02-03-1509_Kenmore_Design_c449c8ed9a6f-others.zip` |
| 58.5 M | 2026-02-03 | `kdsites/dev2/wp-content/updraft/backup_2026-02-03-1509_Kenmore_Design_c449c8ed9a6f-plugins.zip` |
| 64.3 M | 2026-02-03 | `kdsites/dev2/wp-content/updraft/backup_2026-02-03-1509_Kenmore_Design_c449c8ed9a6f-themes.zip` |
| 268.7 M | 2026-02-03 | `kdsites/dev2/wp-content/updraft/backup_2026-02-03-1509_Kenmore_Design_c449c8ed9a6f-uploads.zip` |
| 116.2 M | 2025-12-26 | `kdsites/dev2/wp-content/wp-content-kd.zip` |
| 101.0 M | 2025-11-07 | `kdsites/dev/Forex-CRM-1.0.0-arm64-mac.zip` |
| 762.8 M | 2025-11-07 | `kdsites/dev/Forex-CRM-Setup-1.0.0.exe.zip` |
| 3.5 M | 2025-12-26 | `kdsites/dev/wp-content/themes/sage/resources/assets/kenmore.zip` |
| 8.4 M | 2025-12-26 | `kdsites/dev/wp-content/updraft/backup_2025-12-18-0702_Kenmore_Design_85bf16e59ed0-db.gz` |
| 0.0 M | 2025-12-26 | `kdsites/dev/wp-content/updraft/backup_2025-12-18-0702_Kenmore_Design_85bf16e59ed0-mu-plugins.zip` |
| 159.8 M | 2025-12-26 | `kdsites/dev/wp-content/updraft/backup_2025-12-18-0702_Kenmore_Design_85bf16e59ed0-others.zip` |
| 57.0 M | 2025-12-26 | `kdsites/dev/wp-content/updraft/backup_2025-12-18-0702_Kenmore_Design_85bf16e59ed0-plugins.zip` |
| 64.3 M | 2025-12-26 | `kdsites/dev/wp-content/updraft/backup_2025-12-18-0702_Kenmore_Design_85bf16e59ed0-themes.zip` |
| 158.0 M | 2025-12-26 | `kdsites/dev/wp-content/updraft/backup_2025-12-18-0702_Kenmore_Design_85bf16e59ed0-uploads.zip` |
| 9.0 M | 2026-02-03 | `kdsites/dev/wp-content/updraft/backup_2026-02-03-1509_Kenmore_Design_c449c8ed9a6f-db.gz` |
| 0.0 M | 2026-02-03 | `kdsites/dev/wp-content/updraft/backup_2026-02-03-1509_Kenmore_Design_c449c8ed9a6f-mu-plugins.zip` |
| 160.2 M | 2026-02-03 | `kdsites/dev/wp-content/updraft/backup_2026-02-03-1509_Kenmore_Design_c449c8ed9a6f-others.zip` |
| 58.5 M | 2026-02-03 | `kdsites/dev/wp-content/updraft/backup_2026-02-03-1509_Kenmore_Design_c449c8ed9a6f-plugins.zip` |
| 64.3 M | 2026-02-03 | `kdsites/dev/wp-content/updraft/backup_2026-02-03-1509_Kenmore_Design_c449c8ed9a6f-themes.zip` |
| 268.7 M | 2026-02-03 | `kdsites/dev/wp-content/updraft/backup_2026-02-03-1509_Kenmore_Design_c449c8ed9a6f-uploads.zip` |
| 2715.0 M | 2026-07-20 | `kdsites/dev.zip` |
| 101.0 M | 2025-11-07 | `kdsites/site/Forex-CRM-1.0.0-arm64-mac.zip` |
| 762.8 M | 2025-11-07 | `kdsites/site/Forex-CRM-Setup-1.0.0.exe.zip` |
| 3.5 M | 2025-12-26 | `kdsites/site/wp-content/themes/sage/resources/assets/kenmore.zip` |
| 8.4 M | 2025-12-26 | `kdsites/site/wp-content/updraft/backup_2025-12-18-0702_Kenmore_Design_85bf16e59ed0-db.gz` |
| 0.0 M | 2025-12-26 | `kdsites/site/wp-content/updraft/backup_2025-12-18-0702_Kenmore_Design_85bf16e59ed0-mu-plugins.zip` |
| 159.8 M | 2025-12-26 | `kdsites/site/wp-content/updraft/backup_2025-12-18-0702_Kenmore_Design_85bf16e59ed0-others.zip` |
| 57.0 M | 2025-12-26 | `kdsites/site/wp-content/updraft/backup_2025-12-18-0702_Kenmore_Design_85bf16e59ed0-plugins.zip` |
| 64.3 M | 2025-12-26 | `kdsites/site/wp-content/updraft/backup_2025-12-18-0702_Kenmore_Design_85bf16e59ed0-themes.zip` |
| 158.0 M | 2025-12-26 | `kdsites/site/wp-content/updraft/backup_2025-12-18-0702_Kenmore_Design_85bf16e59ed0-uploads.zip` |
| 9.0 M | 2026-02-03 | `kdsites/site/wp-content/updraft/backup_2026-02-03-1509_Kenmore_Design_c449c8ed9a6f-db.gz` |
| 0.0 M | 2026-02-03 | `kdsites/site/wp-content/updraft/backup_2026-02-03-1509_Kenmore_Design_c449c8ed9a6f-mu-plugins.zip` |
| 160.2 M | 2026-02-03 | `kdsites/site/wp-content/updraft/backup_2026-02-03-1509_Kenmore_Design_c449c8ed9a6f-others.zip` |
| 58.5 M | 2026-02-03 | `kdsites/site/wp-content/updraft/backup_2026-02-03-1509_Kenmore_Design_c449c8ed9a6f-plugins.zip` |
| 64.3 M | 2026-02-03 | `kdsites/site/wp-content/updraft/backup_2026-02-03-1509_Kenmore_Design_c449c8ed9a6f-themes.zip` |
| 268.7 M | 2026-02-03 | `kdsites/site/wp-content/updraft/backup_2026-02-03-1509_Kenmore_Design_c449c8ed9a6f-uploads.zip` |
| 11.6 M | 2020-03-20 | `kdtemplates/breeze/site_old/breeze.zip` |
| 0.3 M | 2026-08-21 | `kdtemplates/broker4/site/wp-content/themes/itsulu/inc/plugins/envato-market.zip` |
| 66.0 M | 2019-11-11 | `kdtemplates/executive/site_old/exec.zip` |
| 45.6 M | 2023-11-09 | `kdtemplates/executive/site/site.zip` |
| 0.0 M | 2025-04-10 | `kdtemplates/executive/site/wp-content/themes/executivefx.zip` |
| 117.7 M | 2026-06-11 | `kdtemplates/executive/site.zip` |
| 0.4 M | 2026-07-31 | `kdtemplates/premium/_backups/kd_premium-pre-searchreplace-20260731.sql.gz` |
| 0.4 M | 2026-07-31 | `kdtemplates/premium/premiumfx-db-20260731.zip` |
| 59.9 M | 2026-07-31 | `kdtemplates/premium/premiumfx-files-20260731.zip` |
| 44.0 M | 2026-07-31 | `kdtemplates/premium/premiumfx-source-20260731.zip` |
| 3.5 M | 2026-07-31 | `kdtemplates/premium/_staging/premiumfx-db/import.sql` |
| 3.5 M | 2026-07-31 | `kdtemplates/premium/_staging/premiumfx-db/premiumfx_wp.sql` |
| 30.0 M | 2026-07-31 | `kdtemplates/premium/_staging/wordpress-7.0.2.zip` |
| 0.3 M | 2026-08-21 | `kdtemplates/prop4/site/wp-content/themes/itsulu/inc/plugins/envato-market.zip` |
| 38.9 M | 2023-08-12 | `kdtemplates/success/site/successnew.zip` |
| 0.0 M | 2025-12-12 | `kdtemplates/victory/site_old/wp-content/themes/victory.zip` |
| 0.0 M | 2025-12-12 | `kdtemplates/victory/site/wp-content/themes/victory.zip` |
| 22.9 M | 2014-10-21 | `ninjacharge/old/flighttomalta.zip` |
| 0.2 M | 2020-03-27 | `webdesign/centralcleaners/centralcleaners.zip` |
| 1.2 M | 2016-01-06 | `webdesign/chass/chass_db.sql` |
| 46.5 M | 2016-01-06 | `webdesign/chass/chass.zip` |
| 18.1 M | 2016-01-06 | `webdesign/chass/site/post-restore.zip` |
| 36.1 M | 2025-11-12 | `webdesign/chass/site.zip` |
| 6.6 M | 2016-01-06 | `webdesign/chass/wordpress-4.2.zip` |
| 9.1 M | 2018-08-02 | `webdesign/gea/latest.zip` |
| 0.0 M | 2018-01-10 | `webdesign/gea/original/wp-content/uploads/bcgea.com_.zip` |
| 0.1 M | 2012-07-18 | `webdesign/gea/original/wp-content/uploads/facebook-social-widgets.1.0.1.zip` |
| 0.0 M | 2018-01-10 | `webdesign/gea/site/wp-content/uploads/bcgea.com_.zip` |
| 0.1 M | 2012-07-18 | `webdesign/gea/site/wp-content/uploads/facebook-social-widgets.1.0.1.zip` |
| 102.7 M | 2018-08-06 | `webdesign/gea/site/wp-content.zip` |

## 3. Do the zips contain a database dump

Listed with `unzip -l`, nothing extracted.

- **All eight `_backups/live-restorepoint-*.zip`: yes.** Each holds a full dump of the live
  database, `_restore_db_<stamp>.sql`, from 86 M (June 18) to 271 M (Sept 25) uncompressed, plus
  the live `wp-config.php` and the two UpdraftPlus `-db.gz` files. The files are `root:root 644`.
  Directory listing was off and the names carry a to-the-second timestamp, so they could not be
  found by guessing a date alone; the logs show no request for any of them.
- **`dev.zip`: no loose `.sql`,** but it holds `dev/wp-config.php` (the April version) and the
  same two UpdraftPlus `-db.gz` database backups (8.8 M and 9.5 M), so it does contain database
  content from Dec 2025 and Feb 2026.

## 4. Who else uses the SendPulse client ID and secret

On kd-site, only the company site trio:

- `kdsites/{site,dev,dev2}/wp-config.php` define them; all three hold the **same** values
  (hash comparison: dev = live, dev2 = live).
- `kdsites/{site,dev,dev2}/wp-content/themes/sage/app/actions.php` is the only code that reads them.
- Old copies sit inside `dev.zip` and all eight restore-point zips.

Nothing else: no other site tree, no file under `/srv`, `/usr/local`, `/etc/cron*`,
`/etc/systemd/system`, `/opt` or the readable home directories mentions SendPulse, and none of
the 23 WordPress databases has a SendPulse option. wp-eu, wp-asia and the Ops repos: no reference.

Not checkable from here: other users' crontabs and the homes of toby, grisha and denisb on
kd-site, and anything off these servers that was given the same pair (automations, another
developer's machine, a no-code tool).

After regenerating: update the three `wp-config.php` files. The cached token expires by itself
within 55 minutes, or delete the `sendpulse_access_token` transient to switch at once.

## 5. wp-eu and wp-asia

Neither has the pattern.

| | Default block | By IP, port 80 | By IP, port 443 |
|---|---|---|---|
| wp-eu (91.99.203.165, 2a01:4f8:c0c:644d::1) | port 80 `default_server` serves only `/.well-known/acme-challenge/` from `/var/www/letsencrypt` and returns a fixed 404 page for everything else; port 443 `default_server` has `ssl_reject_handshake on` | 404 for `/`, `/wp-config.php`, `/alverix/public/wp-config.php`, `/zentro/public/wp-config.php`, `/alverix/backups/`; same over IPv6 | handshake refused |
| wp-asia (5.223.49.177, 2a01:4ff:2f0:3566::1) | one `default_server` for 80 and 443, root `/var/www/default` (holds only `404.html`), `location / { return 404; }` | 404 for `/`, `/wp-config.php`, both sites' `public/wp-config.php`; same over IPv6 | 404 |

## 6. Where dev.zip and the restore points should live

Proposal only; nothing moved or deleted.

- **Restore points:** `/var/backups/kenmore-ops/kdsites/`, owned `root:root`, mode `700`, files
  `600`. It is on the same filesystem, so moving 21 G is a rename and needs no free space. Change
  one line in `migrate-dev-to-live.sh`: `BACKUP_DIR="$BASE/_backups"` becomes
  `BACKUP_DIR=/var/backups/kenmore-ops/kdsites`. The script runs as root, so nothing else changes.
  Its comment says the directory is "kept OUTSIDE the WP roots"; it was outside the WordPress
  roots but inside the web root.
- **`dev.zip`** (2.7 G, 2026-07-20): it is a stale copy of dev with an old `wp-config.php` and
  database backups. Delete it if nobody needs it; otherwise move it to the same directory.
- **Same treatment** for the other site-root archives in the table above, starting with the three
  that are public today (`2sto/site/site.zip`, `executive/site/site.zip`, `success/site/successnew.zip`).
- The disk is at 76% (18 G free). Eight restore points at 2.6 G each is the largest item; keeping
  four would free about 10 G.
- Whatever stays under `/var/www/html` should be covered by a deny rule in **every** vhost, not
  only kenmoredesign.com: archives, `.sql`, logs, `error_log`, and dot-directories such as `.git`.

## Follow-up checks, same day (read-only)

**Backdoors in `webdesign/chass/site_old`.** The two gallery files are PHP webshells: each is
`<?php`, about 250 spaces of padding, then obfuscated code that runs whatever is sent in a POST
field through `base64_decode`. They are not alone: 202 files in that tree carry the same padding
trick and 128 the same two signatures (`.php` files with `.inf` twins, spread through the
`nextgen-gallery` and `kenmore-design` plugin folders, plus `site_old/post.php`). All are dated
2016-01-06, owned by root, mode 775: an infection from the site's previous hosting that was
copied here with the archive. No other tree under `/var/www/html` matches these signatures (a
signature scan, not a full malware audit). **They cannot run here:** no vhost, symlink or cron
points into `webdesign/chass`, and the old catch-all served files without executing PHP. No
request for them appears in 15 days of logs. `chass.zip`, `chass/site.zip` and
`site/post-restore.zip` in the same folder were not inspected and may hold copies. Nothing was
touched.

**`2sto.net/site.zip` contents:** 9,215 entries, newest dated 2023-11-09. WordPress core,
plugins, themes, 137 upload files (images, css), `site/wp-config.php` (2023-08-10) and
`site/error_log`. No database dump, no export, no user data files. It is the same 2023 package
as `executive/site/site.zip`. Whether its database password is still in use anywhere was not
checked.

**The four downloaders** are automated secret-harvesting scanners, not people:

| IP | Requests, 15 days | Vhosts | User agent | Around the download |
|---|---|---|---|---|
| 195.178.110.131 | 495 | 2sto, live, ninjacharge | Chrome 133 on Windows (5 truncated, 2 `Go-http-client`) | Loaded 2sto's home, `?phpinfo=1`, `wp-login.php` (GET only), then `site.zip`; went straight on to `/backup.zip`, `/.env`, `composer.json` and similar, all 404. On 7 Oct crawled 13 pages of kenmoredesign.com and GET `wp-login.php` |
| 195.178.110.15 | 632 | 2sto, ninjacharge | Chrome 124 on Windows | `site.zip` twice (30 Sep, 2 Oct), then 166 probes for `.env` variants and config backups, all 404 |
| 93.123.109.55 | 352 | 2sto | Chrome 124 on Windows | `site.zip` twice (26 Sep, 4 Oct), then probes for `.aws/credentials`, CI configs, `.bash_history`; all 301/404 |
| 149.88.76.100 | 109 | 2sto | Chrome 121 on Windows | 107 archive-name guesses, one hit: `site.zip` (2 Oct) |

None of the four sent a single POST to any vhost, and none requested `wp-admin` after a
download apart from the GETs above. Other addresses in the same /24s scan dev2, premium,
prestige and ninjacharge the same way. A log shows requests to this host only; it cannot show
whether the database password was tried elsewhere.

**dev2 `debug.log` is public** (`https://dev2.kenmoredesign.com/wp-content/debug.log`, 200,
108,951 bytes) and was fetched 6 times by scanners between 24 Sep and 5 Oct. dev2's vhost has
none of the deny rules that live and dev have.

**MySQL** listens on 127.0.0.1 only (3306 and 33060; `bind-address` and `mysqlx-bind-address`
both 127.0.0.1) and both ports are closed from the Ops box over the public IP. ufw is active;
its rules need root to read. **No phpMyAdmin or Adminer** exists under `/var/www/html`
(`vendor/phpmyadmin` inside WPML is only the sql-parser library). The one database tool is
`ninjacharge/old/se.php`, which no vhost serves.

**Git remotes:** none of the seven `.git/config` files has a password or token in its remote
URL. The six theme-asset repos point at github.com over a plain URL; `ninjacharge/git` uses an
ssh remote with a user name only. **The whole theme-asset repository can be cloned over HTTP**
from www.kenmoredesign.com: `config`, `HEAD`, `index`, `packed-refs`, `logs/HEAD`,
`refs/heads/master` and the 3.6 M pack file all return 200.

**SendPulse token cache:** yes, one place. `set_transient('sendpulse_access_token', …, 55 min)`.
There is no object-cache drop-in, so it is a row in `wp_options` of whichever site ran the
handler, and so it is also inside any database dump taken while it was fresh. A token is valid
for an hour, so the ones in old dumps are dead. Nothing is written to disk or to a log.

## Further read-only checks, 13:30 to 14:00 UTC

**Password in the leaked zips (hash-only comparison of the `DB_PASSWORD` line).** The 2sto and
executive zips hold the same password. It does **not** match the current `wp-config.php` of
2sto, executive or success. It **does** match two unserved files: `clientsites/2sto/site_old/wp-config.php`
and `kdtemplates/executive/site_old/wp-config.php` (database `kd_executive`). The success zip's
password matches no current file on this host. Whether the MySQL account behind the old
password still exists was not checked (needs MySQL root); MySQL is local-only either way.

**Legitimate archive downloads, 15 days:** only the two installers
(`Forex-CRM-Setup-1.0.0.exe.zip`, `Forex-CRM-1.0.0-arm64-mac.zip`), on live, and the same two
file names on dev and dev2 (almost all from the server's own address, 3 from outside on dev).
Everything else that returned an archive was `2sto.net/site.zip` to scanners.

**PHP under uploads and gallery directories:** 198 files, full list in
`kd-site-uploads-php-2026-10-08.tsv`. Outside `webdesign/chass/site_old` (32 backdoor files in
its gallery folders) everything is of an expected kind: 127 compiled Blade views in
`kdsites/{site,dev,dev2}/wp-content/uploads/cache/<sha1>.php` (Sage theme), 33 WPML compiled
Twig templates in victory, 4 `index.php` placeholders, and `uploads/stm_fonts/stm/charmap.php`
(11.5 K, an icon-font page shipped by the old "consulting" theme) in the two unserved
`site_old` trees. Only names and dates were read.

**Theme-asset repo history:** 2 commits in `assets/kenmore`, 5 in `assets/kenmore/kenmore`,
all from July 2020, front-end files only (svg, scss, png, html, css, js). No file with a
sensitive name in any commit and no added line matching a key, token, password or private-key
pattern. Nothing secret to rotate because of the clone exposure.

**dev2 `debug.log`:** 312 lines, all from 22 minutes on 2026-04-16; identical copies sit in
site and dev. Contents by kind: 303 PHP notices, warnings and deprecations that show absolute
server paths and plugin names; and 2 lines written by an earlier debug version of the SendPulse
handler: one full "create contact" API response (one contact with name, phone and an email at
`test.com`, plus SendPulse's internal IDs) and one contact ID. No password, key, token,
Authorization header, SQL or IP address. `WP_DEBUG` is `false` in all three configs and the file
has not grown since April, so debug logging is already off; the file is a leftover.

## Second root window, 13:40 to 13:50 UTC: what changed

Backups of everything edited: `/var/backups/kenmore-ops/changes-20261008/` (all 33 files of
`/etc/nginx/sites-available/` under `nginx/`, and `migrate-dev-to-live.sh`).

1. **Quarantine**, `/var/backups/kenmore-ops/quarantine/` (root, 700), with `MANIFEST.txt`:
   `2sto-site.zip`, `executive-site.zip` (byte-identical to the 2sto one), `success-successnew.zip`,
   and the whole `webdesign/chass` tree as `webdesign-chass/` (5,729 files, 220 M; contains the
   PHP backdoors; moved as one rename, nothing inside opened).
2. **Restore points:** the 8 zips, 12 migrate logs and `dev.zip` are in
   `/var/backups/kenmore-ops/kdsites/` (root, 700, files 600). `kdsites/_backups/` is left empty.
   `migrate-dev-to-live.sh` line 24 is now `BACKUP_DIR="/var/backups/kenmore-ops/kdsites"`.
3. **nginx:** new `/etc/nginx/snippets/kenmore-deny.conf` (dotfiles except `.well-known`;
   `error_log`, `.log`, `.sql`, `.zip`, `.gz`, `.tgz`, `.tar`, `.bz2`, `.7z`, `.rar`, `.bak`),
   included after `server_name` in 46 server blocks across 26 vhost files. `nginx -t` passed, reloaded.
   Files that must be served need an exact-match location, as the two installers have on live
   and dev. dev2 has none, so its duplicate installers now return 403.
4. **Verified:** at the origin the three zips, three `error_log`s, dev2's `debug.log`, every
   `.git` path including the pack file, `.tmb`, `.htaccess` and dev2's loose zips return 403.
   `.well-known/acme-challenge/` still reaches its location (404 for a missing token, not 403).
   The two installers still download on live and dev. All 41 hostnames give the same status as
   before the change (24 return 200; `progress` 500 and `ditto` 502 were already so).

**Still served by Cloudflare's cache:** the three zip URLs return 200 with `cf-cache-status: HIT`
(`max-age=14400`) although the origin now answers 403. The cache entries date from 12:28 UTC,
which is when the HEAD checks from the Ops box were made: Cloudflare turns a HEAD for a
cacheable file into a full fetch and stores it. They expire by about 16:30 UTC or on a purge.

**Firewall, corrected:** there is no host firewall on kd-site. `ufw` is not installed (package
removed, a stale unit still reports "active"); iptables has policy ACCEPT with only Tailscale's
chains and one DROP for 160.20.109.0/24. Ports 22, 80 and 443 are open to the internet on IPv4
and IPv6. Full capture in `kd-site-firewall-2026-10-08.txt`. Whether a Hetzner Cloud Firewall
sits in front cannot be seen from the host.

**SSH (checked 14:20 UTC, read-only).** Password login is off: `00-kenmore.conf` sets
`PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `PermitRootLogin prohibit-password`
and `AllowUsers alex claude root`, and sshd offers only `publickey` to all three. A leftover
`Match Group sftpjail` block in `sshd_config` still says `PasswordAuthentication yes` for
esteban and denis, but `AllowUsers` shuts both out. `50-cloud-init.conf` is unreadable to
`claude`; it is read after `00-kenmore.conf`, so it cannot override it. The Ops box connects over
Tailscale (100.83.106.39). **Port 22 on the public IP times out from the Ops box**, so something
upstream filters it (presumably a Hetzner Cloud Firewall), which corrects the note above that
22 is open to the internet: it listens on all addresses, but is not reachable from outside as
far as one test from one address shows.

## Third root window, 14:44 to 14:48 UTC: salts and debug.log

- The three stale `debug.log` copies (`kdsites/{site,dev,dev2}/wp-content/`) are in the
  quarantine directory as `kdsites-<site>-debug.log`, with manifest entries.
- **WordPress keys and salts shuffled on all 23 served installs** with `wp config shuffle-salts`:
  dev, live, dev2, the ten brand demos, premium, the eight older templates, 2sto. For each one:
  `wp-config.php` backed up to `/var/backups/kenmore-ops/changes-20261008/salts/` first (these
  backups hold the old salts and the current database passwords; root-only), then verified by
  hash that all 8 lines changed and no other line did, PHP lint, owner and mode unchanged, home
  page status equal to before. No install shares an `AUTH_KEY` with another any more; dev and
  live had identical salts until now.
- Not touched: unserved trees (`site_old`, `ninjacharge/old`, `webdesign/gea`), `WP_CACHE_KEY_SALT`,
  `DUPLICATOR_AUTH_KEY`, database passwords.
- Effects: everyone is logged out of every site; pages cached by WP Rocket before the shuffle
  carry stale content-protector nonces until the cache is cleared or expires (24 h).
