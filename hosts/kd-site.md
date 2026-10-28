# kd-site

Surveyed 2026-09-30 over ssh as `claude` (uid 1010, groups `claude`, `www-data`, `users`; no sudo). Read-only. No database connection was made. wp-config.php files were only grepped for `DB_NAME` and `table_prefix`. WordPress, plugin and theme versions come from file headers, not wp-cli. Whether a plugin is *active* needs the database, so every list below means "installed".

This is the template/demo host ("KenmoreSite"). It serves the Kenmore Design company site, ten branded demo sites built from templates, several older demo templates and two client sites. Its `kdtemplates/` trees are the source of the sites on wp-eu and wp-asia.

## OS and kernel
- Ubuntu 24.04.3 LTS, **aarch64** (the other two hosts are x86_64 and Ubuntu 26.04). QEMU guest. Uptime 18 weeks.
- Running kernel `6.8.0-117-generic`; `6.8.0-142-generic` is installed and `/var/run/reboot-required` exists, so a reboot is pending.
- 7.5G RAM, 4G `/swapfile` (113M used).
- Users in /home: `claude`, `alex`, `bob`, `mike` (all listable), `toby`, `grisha`, `denisb` (mode 750, unreadable). Shell histories exist for several users and were not read.

## Disk
`/dev/sda1` ext4 75G, **54G used (76%)**, 18G free. This is the only host with real disk pressure.

| Top-level | Size |
|---|---|
| /var | 43G (`/var/www` 42G, `log` 427M, `lib` 335M, `cache` 157M, `backups` 2.2M) |
| /swapfile | 4.1G |
| /usr | 1.9G |
| /home | 1.2G (all `/home/claude`; others are under 60K or unreadable) |
| /tmp | 327M (all `/tmp/claude-1010`) |
| /boot | 113M |
| /srv | 24M (`/srv/kdtemplates`) |
| /etc | 8.2M |

`/var/www/html` breakdown: `kdsites` 33G (of which `_backups` 21G, `dev2` 3.4G, `site` 3.3G, `dev` 3.2G, `dev.zip` 2.7G), `kdtemplates` 6.4G, `clientsites` 1.4G, `webdesign` 593M, `ninjacharge` 84M, `aafx-calculators` 208K, `php-sql-test` 8K. `/var/lib/mysql` is unreadable, so database size is unknown.

## Web server
**nginx 1.24.0 is the live server.** Apache 2.4.58 is installed but `inactive` and `disabled` (its default vhost and `apache2` logrotate script remain). nginx has 27 enabled vhosts; six more files in `sites-available` are not enabled.

**Layout:** `/etc/nginx/nginx.conf` includes `conf.d/*.conf` and `sites-enabled/*`.
- `nginx.conf` sets `limit_req_zone`s (`one` 5r/s, `posts_zone` 2r/s for POSTs) and `ssl_protocols TLSv1 TLSv1.1 TLSv1.2 TLSv1.3` with `ssl_prefer_server_ciphers on`. Vhosts that include certbot's `options-ssl-nginx.conf` get its own protocol list.
- `conf.d/cloudflare.conf` sets the Cloudflare `set_real_ip_from` ranges.
- There are no shared WordPress snippets. Each vhost carries its own rules.

**Enabled vhosts.** All roots are under `/var/www/html/`.

| vhost | server_name(s) | Root | PHP socket |
|---|---|---|---|
| 000-default | `kenmoredesign.com`, `www.kenmoredesign.com` (live company site); `_` catch-all on 80 | `kdsites/site` (catch-all: none, `return 444` since 2026-10-08) | php8.3 `www` |
| dev | `dev.kenmoredesign.com` | `kdsites/dev` | php8.3 `www` |
| dev2 | `dev2.kenmoredesign.com` | none: switched off 2026-10-09, stub returns 410; files in `/var/backups/kenmore-ops/quarantine/kdsites-dev2`, database `kenmore_dev2` still in MySQL | none |
| broker1 | `meridianfx.kenmorefx.com` (also `broker1.kenmorefx.com`, `broker1.78.47.190.199.nip.io`, both 301 to meridianfx) | `kdtemplates/meridianfx` (note: no `/site`) | php8.3 `demos` |
| broker2 | `highpointfx.kenmorefx.com` (+ `broker2.*` redirects) | `kdtemplates/broker2/site` | `demos` |
| broker3 | `atlasfx.kenmorefx.com` (+ `broker3.*` redirects) | `kdtemplates/broker3/site` | `demos` |
| broker4 | `anchorfx.kenmorefx.com`, `broker4.kenmorefx.com` | `kdtemplates/broker4/site` | `demos` |
| broker5 | `lumenfx.kenmorefx.com`, `broker5.kenmorefx.com` | `kdtemplates/broker5/site` | `demos` |
| prop1 | `ascentfunded.kenmorefx.com` (+ `prop1.*` redirects) | `kdtemplates/prop1/site` | `demos` |
| prop2 | `primefunded.kenmorefx.com` (+ redirects) | `kdtemplates/prop2/site` | `demos` |
| prop3 | `vectorfunded.kenmorefx.com` (+ redirects) | `kdtemplates/prop3/site` | `demos` |
| prop4 | `bastionfunded.kenmorefx.com`, `prop4.kenmorefx.com` | `kdtemplates/prop4/site` | `demos` |
| prop5 | `alphafunded.kenmorefx.com`, `prop5.kenmorefx.com` | `kdtemplates/prop5/site` | `demos` |
| premium | `premium.kenmorefx.com` | `kdtemplates/premium/site` | php8.3 `premium` |
| breeze | `breeze.kenmorefx.com` | `kdtemplates/breeze/site` | php8.3 `www` |
| corporate | `corporate.kenmorefx.com` | `kdtemplates/corporate/site` | php8.1 `www` |
| executive | `executive.kenmorefx.com` | `kdtemplates/executive/site` | php8.1 `www` |
| modern | `modern.kenmorefx.com` | `kdtemplates/modern/site` | php8.1 `www` |
| prestige | `prestige.kenmorefx.com` | `kdtemplates/prestige/site` | php8.1 `www` |
| progress | `progress.kenmorefx.com` | `kdtemplates/progress/site` | php8.1 `www` |
| success | `success.kenmorefx.com` | `kdtemplates/success/site` | php8.1 `www` |
| victory | `victory.kenmorefx.com` | `kdtemplates/victory/site` | php8.1 `www` |
| 2sto | `2sto.net`, `www.2sto.net` (client site) | `clientsites/2sto/site` | php8.1 `www` |
| ninjacharge | `ninjacharge.com`, `www.ninjacharge.com` | `ninjacharge/public_html/web` (no WordPress found there) | php8.1 `www` |
| alexey | `alexsherbakov.com`, `www.alexsherbakov.com` (port 80 only, no TLS) | `webdesign/alexey/alexsherbakov` (no WordPress found) | php8.1 `www` |
| kevsqlping | `kevsqlping.kenmorefx.net` (port 80 only) | `php-sql-test` (one `index.php`, 1.8K) | php8.1 `www` |
| dittofeed-kenmoredesign | `ditto.kenmoredesign.com` | none: reverse proxy to `http://127.0.0.1:3000` | none |

- **2026-10-08:** the port-80 catch-all (`default_server`, v4 and v6) used to have `root /var/www/html` and no PHP handler, so any file under the web root, `wp-config.php` and `kdsites/dev.zip` included, was downloadable by IP over plain HTTP. It now returns 444. Backup of the old file: `/root/nginx-backup-20261008/000-default`. Port 443 has no default block; requests by IP fall to the kenmoredesign.com vhost, which executes PHP. Credentials in the exposed files were not rotated as of this date.
- **2026-10-08:** what was reachable, who fetched it, and the files still served by named vhosts (`2sto.net/site.zip` among them) are in `kd-site-exposure-2026-10-08.md`.
- **2026-10-08:** every file-serving server block includes `snippets/kenmore-deny.conf` (dotfiles except `.well-known`, logs, `.sql`, archives). A file that must be downloadable needs an exact-match `location = /name { }`.
- **2026-10-08:** restore points and `dev.zip` live in `/var/backups/kenmore-ops/kdsites/`; `webdesign/chass` and three site zips are in `/var/backups/kenmore-ops/quarantine/` (see its `MANIFEST.txt`). There is no host firewall (`kd-site-firewall-2026-10-08.txt`).
- **2026-10-08:** `claude` is in `adm` and can read `/var/log/nginx/*`.
- Every `*.kenmorefx.com` demo is reached by its brand-name host. The `brokerN`/`propN` names and the `*.78.47.190.199.nip.io` names survive only as 301 redirects to the brand hosts (dated 2026-08-21, per the vhost template).
- **Nothing is listening on port 3000**, so the `ditto.kenmoredesign.com` proxy backend is down. That vhost also references a certificate named `mailautomation.thebestprop.com`, which does not match its `server_name`.
- Six unenabled files in `sites-available`: `site`, `premium.pre-certbot.bak`, `000-default.bak.20260910-215511`, `000-default.bak.20260910-225923`, `dev.bak.20260910-221637`, `dev.bak.20260910-225923`.
- The company site's vhost (000-default) deliberately serves two large installers from the docroot (`location = /Forex-CRM-Setup-1.0.0.exe.zip` and `/Forex-CRM-1.0.0-arm64-mac.zip`). It denies `/wp-content/updraft/` and any `.sql/.zip/.gz/.log/.bak…` path, with the installers as exceptions.

**SSL:** Let's Encrypt via certbot. `/etc/letsencrypt/renewal` holds 32 configs (22 use the `nginx` authenticator, 10 use `webroot`), all with the `nginx` installer. Renewal is `certbot.timer`. There is one certificate per hostname (no wildcard), including six legacy nip.io certificates (`broker1-3`, `prop1-3`) kept only for the redirects. Live contents and expiry dates were not checked (`/etc/letsencrypt/live` private material needs root).

## PHP
CLI PHP 8.3.6. **Two FPM versions run side by side:** `php8.3-fpm` and `php8.1-fpm`. All pools run as `www-data` (no per-site users, no `open_basedir`), unlike wp-eu and wp-asia.

| Pool | Version | Socket | Serves | Settings |
|---|---|---|---|---|
| www | 8.3 | `/run/php/php8.3-fpm.sock` | company site, dev, dev2, breeze | dynamic, `max_children` 30 |
| demos | 8.3 | `php8.3-fpm-demos.sock` | broker1-5, prop1-5 | ondemand, `max_children` 8, idle 10s, `memory_limit` 512M, `max_input_vars` 5000, errors to `/var/log/php8.3-fpm-demos.error.log` |
| premium | 8.3 | `php8.3-fpm-premium.sock` | premium.kenmorefx.com | dynamic, `max_children` 12, same limits as demos |
| www | 8.1 | `/run/php/php8.1-fpm.sock` | corporate, executive, modern, prestige, progress, success, victory, 2sto, ninjacharge, alexey, kevsqlping | dynamic, `max_children` 5 |

Stale file: `/etc/php/8.3/fpm/pool.d/www.conf.bak.20260910-215622`. WP-CLI 2.12.0 is at `/usr/local/bin/wp`.

## Database
MySQL Community Server 8.0.46 (`mysql.service`), listening on 127.0.0.1:3306 and 127.0.0.1:33060 only. `/var/lib/mysql` is unreadable. Database names below come only from `grep DB_NAME` on each wp-config.php. All use `table_prefix` `wp_`.

| Site tree | DB name |
|---|---|
| kdsites/site (live company site) | `kenmore_sage` |
| kdsites/dev | `kenmore_dev` |
| kdsites/dev2 | `kenmore_dev2` |
| kdtemplates/meridianfx (broker1) | `kd_broker1` |
| kdtemplates/broker2 … broker5 | `kd_broker2`, `kd_broker3`, `kd_broker4`, `kd_broker5` |
| kdtemplates/prop1 … prop5 | `kd_prop1` … `kd_prop5` |
| kdtemplates/premium/site | `kd_premium` |
| kdtemplates/breeze (`site` and `site_old`) | `kd_breeze` (shared) |
| kdtemplates/corporate (`site`, `site_old`) | `kd_corporate` (shared) |
| kdtemplates/executive/site | `kd_executive2` |
| kdtemplates/executive/site_old | `kd_executive` |
| kdtemplates/modern (`site`, `site_old`) | `kd_modern` (shared) |
| kdtemplates/prestige/site | `kd_prestige2` |
| kdtemplates/progress (`site`, `site_old`) | `kd_progress` (shared) |
| kdtemplates/success/site | `kd_success2` |
| kdtemplates/victory (`site`, `site_old`) | `kd_victory` (shared) |
| clientsites/2sto/site | `2sto_www` |
| clientsites/2sto/site_old | `kd_executive` (same DB as kdtemplates/executive/site_old) |
| ninjacharge/old | `salescharge` |
| webdesign/chass (`site`, `site_old`) | `chass` (shared) |
| webdesign/gea/site | `gea` |
| premium/_staging/wordpress, gea/original | no wp-config found |

A `site_old` tree and its current `site` tree point at the **same database** in six cases, so the `_old` trees are not independent snapshots. The dev-to-live script comments say dev and live share one MySQL user. Credentials were not read.

## WordPress sites

### Versions
| Tree | WP |
|---|---|
| broker2-5, meridianfx, prop1-5, premium, prestige, success, executive, victory, 2sto (`site`) | 7.1.2 |
| kdsites/site, kdsites/dev | 7.0.6 |
| kdsites/dev2, breeze, corporate, modern (`site`) | 6.9.9 |
| progress/site, victory/site_old | 6.9 |
| premium/_staging/wordpress | 7.0.2 |
| `site_old` trees: breeze, executive, modern, progress 4.9.8; corporate 4.9.16; 2sto 4.9.8 | 4.9.x |
| webdesign: chass (`site` 4.4.14, `site_old` 4.2.4), gea (`site` 4.9.8, `original` 3.1.1) | 3.x to 4.x |
| ninjacharge/old | 3.3 |

### Plugins, themes and mu-plugins (name=version)
Empty versions mean no `Version:` header found, not necessarily an empty folder.

**Company site trio** (`kdsites/site` / `dev` / `dev2`, each about 3.3G): identical plugin families; `site` and `dev` (WP 7.0.6) match, `dev2` (WP 6.9.9) is older.
- site/dev: advanced-custom-fields-pro 6.7.0, better-search-replace 1.4.11, breadcrumb-navxt 7.5.2, broken-link-checker 2.4.14.1, bulkpress 0.3.5, contact-form-7 6.1.7, content-protector 4.3.16, duplicate-page 4.5.9, duplicator 5.0.5, getwid 3.0.2, google-site-kit 1.188.0, head-footer-code 1.5.9, kenmore-translate 1.7.37, megamenu 3.10.8, polylang 3.8.10, polylang-slug-0.2.3, redirect-redirection 1.3.0, robin-image-optimizer 2.0.9, simple-css 1.1.1, svg-support 2.6.1, uk-cookie-consent 3.3.1, updraftplus 1.26.8, wordpress-importer 0.9.6, wordpress-seo 28.6, wp-file-manager 8.0.6, wp-rocket 3.22.0.2, wp-sitemap-page 1.9.6. `site` also has a `wordfence` folder with no version header.
- **2026-10-21:** Polylang is 3.9.0 on site and dev (auto-updated on dev 2026-10-19, reached live with the 2026-10-21 deploy). New translations get `-N` slugs under it until "Fix slugs" is run; see `kd-site-translate-2026-10-21.md`. kenmore-translate is not in git.
- dev2 (older versions of the same set): ACF Pro 6.7.0, better-search-replace 1.4.10, contact-form-7 6.1.5, duplicator 1.5.16, google-site-kit 1.177.0, kenmore-translate 1.7.20, megamenu 3.8.1, polylang 3.8.4, updraftplus 1.26.3, wordpress-seo 27.4, wp-file-manager 8.0.4, wp-rocket 3.21.1, and others; no head-footer-code, plus `broken-link-checker 2.4.8`.
- Themes (all three): `sage` (custom, no version header), twentytwentythree 1.6, twentytwentyfour 1.3, twentytwentyfive 1.3. mu-plugin: `populate-utm-fields.php`.
- **2026-10-23:** Polylang auto-updated again, 3.9.0 to 3.9.1, on dev (2026-10-21 23:12) and live (23:15) separately, after that day's refresh and deploy. Live's files have therefore changed since the last refresh record, so the deploy guard will refuse until dev is refreshed from live again. Auto-updates are still on.
- **2026-10-23 09:05:** plugin and theme auto-updates **turned off on live** (`wp site plugin auto-updates disable --all`; 21 plugins had them on, saved in Ops `~/agent-guide/backup/20261023-www-autoupdates/`; the only theme, `sage`, was already off; core updates untouched). `auto_update_plugins` keeps one stale entry for the removed `wp-file-manager`. dev gets the setting with the next refresh. No kenmore-translate job has run on live since Polylang 3.9.1, so whether new translations still work under it is unproven.
- **2026-10-23:** `llms.txt` in the dev and live webroots (1054 bytes, identical) is Yoast's generated file (`wpseo` `enable_llms_txt` = 1 on both; cron `wpseo_llms_txt_population`). Its links are empty and its sitemap link points at `dev.kenmoredesign.com`: the deploy's rsync copies dev's file to live. nginx has no `md` type in `mime.types`, so `.md` files are served as `application/octet-stream` on dev and live; `.txt` is `text/plain`.
- **2026-10-23:** sage is Sage 9.0.9, not in git (neither is the dev webroot). CSS is prebuilt and enqueued from `resources/assets/` by `app/setup.php`; no build is needed for a template change. The footer partial is `resources/views/partials/footer.blade.php` (widget area `sidebar-footer`, ACF option `footer`, then the contact modals).
- **2026-10-23:** kenmore-translate 1.7.37 translates hard-coded theme text only through its "Theme strings" list (option `kt_theme_strings`, translations in `kt_string_i18n`), by exact substring replacement in the visible text of the page (tags, scripts, styles and comments are set aside first). It honours no `translate="no"`, `notranslate` class or attribute of its own. Its link rewriting touches only internal `<a href>` with a known translation, and skips anchors that carry `lang` or `hreflang`.
- **2026-10-23:** kenmore-translate re-queues a page (all 11 languages) only on a publish → publish save whose md5 of title|content|excerpt changed (`on_transition`, `_kt_source_hash`); an ACF-only change (e.g. `pre_footer_description`) does not re-queue it. Site copy lives mostly in post content and ACF meta, not theme files (About 9327, Home 1830, /guides/ 18810). For WP-CLI content writes use `post update ID - --user=admin` (the wrapper passes stdin): without a user that has unfiltered_html, kses would strip the pages' `<svg>`/section markup.
- **2026-10-23:** theme buttons are `.btn` in `resources/assets/kenmore/css/main.css`: 30px radius, 3px `#FA6C06` border, bold uppercase, 18px/60px tall (14px/47px, 2px border under 992px), hover `#fb8a38`, `.btn:focus{outline:none}`.
- **2026-10-23 12:50:** on dev, kenmore-translate 1.7.37 under Polylang 3.9.1 (with Polylang Slug 0.2.3) creates and links new translations with correct text, but with suffixed slugs (`about-us-2`…) instead of the shared slug; translations it created 2026-10-21 14:08 under 3.9.0 share their slug. The plugin has an admin action `kt_fix_slugs` meant to realign them (not run). About (9327) had no translations at all before (corrected 18:49: /guides/ 18810 already had 11, sharing the slug `guides`); `/xx/about-us/` 301s to the English page on www. The queue runs about one `kt_translate_post` job per 5-minute system-cron tick on dev (`/etc/cron.d/wp-cron-kdsites-dev`; dev has DISABLE_WP_CRON).
- **2026-10-23 18:49:** the slug fix works under Polylang 3.9.1 + Polylang Slug 0.2.3. After the 231-job queue emptied (0 failed), `kt_fix_slugs_batch` was queued for named source IDs (`wp dev action-scheduler action create kt_fix_slugs_batch now --args='[[ids]]' --group=kenmore-translate`, then `action-scheduler run --hooks=kt_fix_slugs_batch`, `cache flush`, `rewrite flush`). It renamed About's 11 translations to `about-us`, core did not re-suffix them, and nothing else changed (full slug list diffed before and after). `/xx/about-us/` and the footer switcher (`#km-lang-switcher`, JS-built `/<lang>` + path links) now land on the translations with no redirect. The admin button `kt_fix_slugs` queues every source page in batches of 25; the worker only renames translations whose slug differs from the source. WP-CLI `eval` is refused by the wp wrapper; translation groups are readable with `post term list <id> post_translations` and languages with `post term list <id> language`. About's Yoast title/description (9327) still say "Since 2006" and "1.5M+", on www too.
- **2026-10-26:** kenmore-translate Theme strings, how they work (read in 1.7.37): the list is option `kt_theme_strings` (one per line, trimmed); translations are `kt_string_i18n` (source => lang => text, autoload off), hand edits locked in `kt_string_locked`. The front end reads only `kt_string_i18n`: on every translated page an output buffer stashes tags, scripts and styles, then `str_replace`s each key as a **substring** of the remaining visible text, longest first. So a short key hits inside longer text ("Copy" would turn the English "Copy Trading" left inside many translated pages into "Copier Trading"), and text around an inline tag must be listed as separate pieces. The worker `kt_translate_strings [lang]` (admin "Translate theme strings") re-translates the WHOLE list and overwrites every unlocked translation. To add strings without touching the existing ones: set the list to the new strings only, run the worker for the 11 languages, then set the list back with them appended (done on dev for the footer block, backup `~/agent-guide/backup/strings-20261026-110912`). About's Yoast title/description fixed on dev the same day. The deploy carries all `kt_*` options (live keeps only `LIVE_KEEP_OPTIONS`).
- **2026-10-26:** Polylang's Kurdish (`ku`) on kenmoredesign.com is tagged `<html lang="ckb">` (Sorani) with no `dir`, but its pages are LTR and the translated text is Kurmanji in Latin script. ar, fa and he are `dir="rtl"`. The footer "Ask your AI" block's prompt and Copy labels are a per-language array in `footer.blade.php` (not Theme strings).
- **2026-10-28:** how the product pages are built (read on dev). `/prop-firm-solutions/prop-firm-dashboard/` (5118) and `/forex-solutions/traders-room/` (31) have **empty post_content**: `views/template-traders-room.blade.php` renders hero, 6-card grid, timeline (ACF flexible `timeline`: `block` / `Get started` / `block 2`), backlinks and closing CTA from ACF fields. The timeline `traders-N.svg` files are connector lines picked by row index (traders-1…7 exist, no traders-8), not step icons. `/forex-solutions/forex-crm/` (421) does the alternating pillars as `.crm-features-section > .container > .crm-feature-card` (CSS `nth-child`: odd = text left, even = image left; the first child also draws `forex-crm-line.svg`, 3492px tall). Templates that print post_content all wrap it in `.brief-section > .container > .wrap-content(.tpg)`; `.tpg` and `.brief-section` rules leak into section markup placed there. `.card-text ul li` bullets come from the site-wide Customizer CSS (`wp-custom-css`). Yoast OG title/description are set on no page; they fall back to title/metadesc. Robin Image Optimizer on dev: auto-optimise on upload (ultra, scheduled), resize to 1000px max, no WebP.
- **2026-10-28:** **Agentic Forex CRM page, draft, ID 19488** on dev (`/forex-solutions/agentic-forex-crm/`, parent 10, No Menu Page Template, language `en`, featured image 19470). Hand-built post_content in one `wp:html` block that reuses the rendered markup of the two references, plus a scoped `<style>` that undoes the `.brief-section`/`.tpg` leaks; Block 17 (closing CTA + trust line) comes from the template's ACF fields `pre_footer_*` and `conclusion_text`. Left as draft because `kt_auto` = 1 queues all 11 translations on publish (no per-page opt-out in kenmore-translate 1.7.37). 18 illustrations from imagegen are attachments 19470-19487 (`uploads/2026/10/NN-*.png`). Sources, prompts, media list and checks: ops `wordpress/agentic-forex-crm/`.
- **2026-10-28 (round 2):** facts that bit while fixing 19488. (1) ACF field keys are per template group: `template.no.menu.page` (and `template.menu.hero`, `template.menu-partners`, `template.menu-api`) use group **Content Pages** (5843, keys `field_67e552b0f59d9`… for `pre_footer_title`/`description`/`highlight_text`/`link_text`, `field_67e552ddf59de` for `conclusion_text`); Forex CRM uses "Forex CRM System" (1748) and the traders-room pages "Traders-room" (1963, located on pages 31/3976/5118 only). Values stored under another group's key show empty in the editor and the template. (2) The Customizer CSS (`wp-custom-css`) spaces `.crm-feature-card` by `:nth-of-type(1/3/4/8)` and `:nth-child(2/5/6/8)`, so any page reusing that markup inherits Forex-CRM-specific card margins by position; non-card children must be `div`s to keep the count. (3) `.container` in those sections is not positioned. (4) Demo popups: the header and timeline CTAs use `<a href="#" data-modal="#contacts-modal" class="btn">`; the theme's closing CTA (`accelerate-section`, hard-coded in every menu/no-menu template) opens `#contacts-modal5`, the same form with the caption "Let's Talk Business." (trailing period). (5) The Forex CRM page's dashed line (`forex-crm-line.svg`, shown at >=1200px) does not actually meet its own badges after the second (misses by 49-259px). On 19488 it is redrawn per badge gap from the same path; refit with `fit-line.py` in the job folder if pillar copy changes.

**Broker templates**
- **meridianfx** (kd_broker1): astra-sites 4.7.3, elementor 4.2.2, essential-addons-for-elementor-lite 6.7.3, header-footer-elementor 2.9.2, safe-svg 2.4.0, wpforms-lite 2.0.0.2. Theme astra 4.13.8. mu-plugins (12): kd-broker-sections, kd-contact-form, kd-education, kd-footer-bar, kd-forex-ticker-bottom, kd-forex-ticker, kd-login-style, kd-noindex, kd-platforms, kd-skin, kd-titre-onglet, kd-x-icon.
- **broker2**: same Elementor/Astra stack with latepoint 5.6.10 and sureforms 2.12.3 (no safe-svg, no wpforms). mu-plugins (14): the meridianfx set plus kd-hide-forms, kd-redirects and kd-forex-ticker-inline.
- **broker3**: Elementor/Astra stack with sureforms 2.12.3 and wpforms-lite 2.0.0.2. mu-plugins (14) include kd-atlas-news and kd-hide-forms.
- **broker4**: advanced-custom-fields-pro 6.4.3, elementor 4.2.2, itsulu-plugin 1.5.0, one-click-demo-import 3.4.1, svg-support 2.6.1. Theme itsulu 1.7.0 + itsulu-child 1.0.0. mu-plugins (10): kd-anchorfx-footer/-form/-skin, kd-education, kd-forex-ticker(-bottom), kd-login-itsulu, kd-noindex, kd-platforms, kd-titre-onglet.
- **broker5**: Elementor/Astra stack (astra-sites, elementor, essential-addons, header-footer-elementor, sureforms 2.12.3). Themes astra 4.13.8 and hello-elementor. mu-plugins (5): kd-broker-sections, kd-login-style, kd-noindex, kd-skin, kd-titre-onglet.

**Prop templates**
- **prop1**: same as meridianfx but without safe-svg; mu-plugins (12) identical to meridianfx.
- **prop2**: same plugins and mu-plugins as broker2.
- **prop3**: same plugins and mu-plugins as broker3.
- **prop4**: same as broker4 (mu-plugins 10).
- **prop5**: same as broker5.

**Other templates**
- **premium** (kd_premium): advanced-custom-fields 6.8.6, akismet 5.7, contact-form-7 6.1.6, elementor 4.2.1, kirki 6.1.1, lexend-core 2.5, wordpress-importer 0.9.5. Theme lexend 2.6. mu-plugin `premiumfx-config.php`. `zentro` on wp-eu has the same plugin set minus akismet, at the same versions, with the same theme. Directory owned by user `toby`; also holds `_staging/` (WP 7.0.2 + `wordpress-7.0.2.zip`, 31M), `_backups/`, and three July-31 zips.
- **executive** (kd_executive2): better-search-replace 1.4.10, duplicate-page 4.5.9, kdfx-ticker 0.1, sitepress-multilingual-cms 4.3.2, ultimate-addons-for-gutenberg 2.19.28, wp-file-manager 8.0.4. Themes astra 4.1.5, executivefx 1.0.0. mu-plugins: kd-news, kd-ticker-sombre, kd-titre-onglet, kd-yourfx-band.
- **prestige** (kd_prestige2): better-search-replace 1.4.3, duplicate-wp-page-post 2.9.3, ultimate-addons-for-gutenberg 2.7.4, wp-file-manager 7.2. Theme astra 4.1.8. mu-plugins: kd-forex-ticker(-bottom), kd-news, kd-titre-onglet, kd-yourfx-band.
- **success** (kd_success2): better-search-replace 1.4.3, duplicate-page 4.5.3, kdfx-ticker 0.1, sitepress-multilingual-cms 4.3.2, ultimate-addons-for-gutenberg 2.7.4, wp-file-manager 7.2. Themes astra 4.1.8, successfx 1.0.0. No mu-plugins.
- **victory** (kd_victory): duplicate-page 4.5.9, export-media-with-selected-content 2.1.4, kdfx-ticker 0.1, sitepress-multilingual-cms 4.3.2, ultimate-addons-for-gutenberg 2.20.4, wordpress-seo 26.5, wp-file-manager 8.0.6, wp-rocket 3.10.8. Themes astra 4.1.2, victory 1.0.0. mu-plugins: kd-forex-ticker, kd-news, kd-titre-onglet, kd-yourfx-band.
- **breeze** (kd_breeze, WP 6.9.9): akismet 2.5.7, kenmoreforex 2.0, screets-chat 1.4.3, wordpress-importer 0.6, plus fx_ticker/ticker/ticker2 (no headers). Themes rackhost, twentyeleven 1.5, twentytwelve 1.1.
- **corporate** (kd_corporate): akismet 2.5.7, black-studio-tinymce-widget 1.1.0, kenmoreforex 2.0, kenmorefx 1.0, screets-chat 1.4.3, widget-logic 0.56, wordpress-importer 0.6, wp-rss-retriever 1.3.1, fx-data, main-renew. Theme hostingsquare 1.1.
- **modern** (kd_modern): akismet 2.5.9, always-edit-in-html 1.3, js_composer 3.6.14, kenmoreforex 2.0, new-royalslider 3.1.4, screets-chat 1.4.3, simple-pie-rss-reader_old 1.4.1, wordpress-importer 0.6.1, fx-data, main-renew. Theme mexin-wp, twentythirteen 1.0, twentytwelve 1.2.
- **progress** (kd_progress, WP 6.9): fx_ticker, kenmoreforex, screets-chat 1.4.3. Theme progress.

**Client and old sites**
- **2sto.net** (`clientsites/2sto/site`, `2sto_www`, WP 7.1.2): better-search-replace 1.4.11, contact-form-7 6.1.6, contact-form-cfdb7 1.3.6, duplicate-page 4.5.9, duplicator 1.5.16.1, kdfx-ticker 0.1, svg-support 2.5.16, ultimate-addons-for-gutenberg 2.19.29, wp-file-manager 8.0.4. Themes astra 4.1.5, executivefx 1.0.0.
- **ninjacharge**: live root `public_html/web` is not WordPress. `ninjacharge/old` is WP 3.3 (akismet 2.5.3, all-in-one-seo-pack 1.6.13.8, fancybox-for-wordpress 3.0.1, google-sitemap-generator 3.2.6, simple-301-redirects 1.03, others; theme recloud; DB `salescharge`). It also holds a file named `se.php`; I only confirmed the filename.
- **Not served by any vhost** (no `server_name`): `webdesign/chass`, `webdesign/gea`, `webdesign/centralcleaners`, `ninjacharge/old`, and every `site_old`.

**2026-10-09: removed from every served site** (live, dev, 2sto, executive, victory, prestige, success); dev2 is quarantined; only `victory/site_old` (unserved) still has a copy. Before that: `wp-file-manager` was installed in 9 trees (2sto, dev, dev2, site, executive, prestige, success, victory, victory/site_old) at versions 7.1.6, 7.2, 8.0.4 and 8.0.6. Worth reviewing whether it is needed.

## Cron
No user crontab for `claude`. User crontabs are unreadable to me. In `/etc/cron.d`:
- `wp-cron-kdsites`: `*/5 * * * *` as `www-data`, `wp cron event run --due-now --path=/var/www/html/kdsites/site`, logging to `/var/log/wp-cron-kdsites.log`.
- `wp-cron-kdsites-dev`: `2-59/5 * * * *` as `www-data`, same for `kdsites/dev`, logging to `/var/log/wp-cron-kdsites-dev.log`.
- `sysstat`, `certbot`, `php`, `e2scrub_all`: distro defaults. `/etc/cron.daily` also runs `apache2` (inert), `apport`, `apt-compat`, `dpkg`, `logrotate`, `man-db`, `sysstat`.

No cron exists for the templates, dev2, 2sto or the migration script, so those rely on request-triggered WP-cron. systemd timers are the distro set (`apt-daily*`, `certbot`, `logrotate`, `fstrim`, `sysstat-*`, and so on). There is no custom timer.

## Backups
**No scheduled backup.** There are three manual arrangements:
1. **`/var/www/html/kdsites/migrate-dev-to-live.sh`** (plus `readme.txt`, and `migrate-dev-to-live.OLD`). **Retired 2026-10-21:** renamed `migrate-dev-to-live.sh.retired` (mode 444) after its 10:46 run copied dev's settings over live's; use `~/ops/kdsites/deploy-dev-to-live.sh` (see `kd-site-translate-2026-10-21.md`). `readme.txt` rewritten 2026-10-21 for the new scripts, which are installed next to it. It pushes dev.kenmoredesign.com → www.kenmoredesign.com by hand (`readme.txt` shows `sudo bash … | tee /tmp/migrate-real.log`). Each run first writes a **restore point**, a zip of the live files plus a DB dump, to `kdsites/_backups/live-restorepoint-<date>.zip`, and keeps the newest 8 (`KEEP_BACKUPS=8`). Eight exist: 2026-06-18, 06-19, 07-02, 07-20, 08-12, 08-25, 09-10 and 09-25, each about 2.6G, **21G together** plus per-run logs. The script says it is meant for cron, but no cron entry calls it.
2. **UpdraftPlus backups** inside each company-site tree's `wp-content/updraft/` (Dec 2025 and Feb 2026 sets), **1009M per tree, three identical sets** in `site`, `dev` and `dev2`. nginx denies the path.
3. Ad-hoc zips next to the sites (see the junk list) and `/var/backups` (dpkg metadata only).

No off-host copy is visible. The demo templates, `2sto` and `ditto` have no scheduled backup at all.

## Services and listening ports
Running: nginx, php8.1-fpm, php8.3-fpm, mysql, cron, atd, ssh, tailscaled, rsyslog, unattended-upgrades, multipathd, qemu-guest-agent, polkit, dbus, systemd-networkd/resolved/logind/journald/timesyncd. **No fail2ban, no Redis, no chrony** (timesyncd instead). `/opt/containerd` exists (mode 711, unreadable) but no Docker or containerd service is running.

| Port | Bind | Service |
|---|---|---|
| 80, 443 | all (v4 and v6) | nginx |
| 22 | all | sshd |
| 3306, 33060 | 127.0.0.1 | MySQL |
| 53 | 127.0.0.53, 127.0.0.54 | systemd-resolved |
| 65469, 63668 | Tailscale IPs | tailscaled |
| 3000 | not listening | target of the `ditto` vhost proxy |

## Large files, duplicates and junk candidates (list only, nothing deleted)

**Claude Code leftovers** (existence and size only; contents not read):
| Path | Size |
|---|---|
| `~/.local/share/claude/` (5 versions; `~/.local/bin/claude` → `versions/2.1.282`) | 1.1G |
| ... of which old versions 2.1.272 (217M), 2.1.267 (207M), 2.1.263 (206M), 2.1.261 (206M) | about 836M |
| `~/.claude/` (projects 39M, plugins 7.4M, cache 696K, backups 320K, file-history 36K; includes `CLAUDE.md`) | 47M |
| `~/.claude.json` | 64K |
| `/tmp/claude-1010/` | 327M |
| ... including a 258M DB dump `_restore_db_2026-09-25_132116.sql` (the live company-site DB, from the 09-25 migration) | |
| `/var/www/html/kdtemplates/CLAUDE.md` (25K, in the templates root, not inside any document root) | 25K |
| `/tmp/claude-1010/-var-www-html-kdtemplates-premium/.../scratchpad/CLAUDE.md` | small |
| `~/.cache/claude`, `~/.cache/claude-cli-nodejs`, `~/.npm` | about 72K plus 12K |
| `/tmp/claude-1008/` and `/tmp/cc-socks/` (owned by `toby`, unreadable) | unknown |
| `/tmp/commission.sh` (7.2K, 2026-09-30 21:05, not read), `/tmp/migrate-real.log` (5K), `/tmp/hp.txt`, `/tmp/succ.html` | small |

No separate notes checkout was found.

**Other candidates, largest first:**
| Path | Size | Note |
|---|---|---|
| `kdsites/_backups/live-restorepoint-*.zip` (8) | about 21G | Eight live-site restore points; 06-18 and 06-19 are the oldest. |
| `kdsites/dev.zip` | 2.7G | Zip of the dev tree from 2026-07-20, in the kdsites parent directory. |
| `kdsites/{site,dev,dev2}/wp-content/updraft/` | 3 × 1009M = 3.0G | Same file names and sizes in all three trees; Dec 2025 and Feb 2026 Updraft sets. Not compared by hash. |
| `kdsites/{site,dev,dev2}/Forex-CRM-*.zip` (Setup exe 763M and arm64-mac 101M each) | 3 × 864M = 2.6G | Triplicate. The `site` copy is deliberately served by nginx; the `dev` and `dev2` copies are plain duplicates. |
| `/swapfile` | 4.1G | Not junk; listed for completeness. |
| `kdsites/dev2/` (whole old clone, WP 6.9.9) | 3.4G | Also includes `wp-content-kd.zip` 116M. |
| `kdsites/{site,dev,dev2}/wp-content/cache` | 329M, 296M, 402M (1.0G) | Regenerable (WP Rocket). `kdtemplates/victory/site/wp-content/cache` adds 40M. |
| `clientsites/2sto.zip` | 547M | Dated 2026-07-31. |
| `clientsites/2sto/site_old` | 236M | WP 4.9.8, unserved; also `exec.zip` 66M. |
| `clientsites/2sto/site.zip` (118M) and `2sto/site/site.zip` (46M) | 164M | |
| `clientsites/2sto/site/wp-content/backups-dup-lite` | 144M | Duplicator archive from 2026-07-31. Also `kdsites/dev2/wp-content/backups-dup-lite` 15M. |
| `webdesign/gea` (`site` 238M, `original` 117M WP 3.1.1, `latest.zip` 9.1M) | 364M | No vhost; dated 2018. `gea/site/wp-content.zip` is 103M. |
| `webdesign/chass` (226M incl. `site_old`, several zips and `chass_db.sql` 1.2M dated 2016) | 226M | No vhost. |
| `kdtemplates/*/site_old` (breeze 51M, corporate 56M, executive 236M, modern 106M, progress 137M, victory 185M) | about 771M | WP 4.x or 6.9, unserved. Same DB as the current `site` in six cases. `executive/site_old/exec.zip` is 66M (2019). |
| `kdtemplates/executive/site.zip` (118M, 2026-06-11) and `executive/site/site.zip` (46M, 2023) | 164M | |
| `kdtemplates/premium/` zips (`premiumfx-files-20260731` 60M, `premiumfx-source-20260731` 44M, `premiumfx-db-20260731` 0.4M), `_staging` (94M WP tree + 30M zip), `_backups/` (a pre-search-replace dump) | about 230M | The 2026-07-31 snapshot used to build wp-eu's zentro (see summary). |
| `kdtemplates/success/site/successnew.zip` (39M, 2023), `breeze/site_old/breeze.zip` (12M, 2020) | 51M | |
| `ninjacharge/old` (WP 3.3, 63M), `ninjacharge/git` 9.1M | 72M | Not served. |
| `/home/claude/meridianfxSep4.zip` | 92.3M | Same byte size (96773452) as the copies on wp-eu and wp-asia. Mode 600. |
| `/home/claude/leads Sep11.csv` | 39K | Leads export (personal data likely); contents not read. |
| `/var/log/journal` | 314M | |
| `/var/log/nginx` | 99M | Rotated error logs from `progress` (12M) and `ninjacharge` (7.8M) are the biggest. |
| `/var/cache/apt`, `/var/lib/apt` | 151M, 204M | Regenerable. |
| `/var/log/php8.3-fpm-www.slow.log` | 1.9M | |
| `/etc/nginx/sites-available/*.bak*`, `site`; `/etc/php/8.3/fpm/pool.d/www.conf.bak.*` | tiny | Stale config copies. |
| `/var/www/html/aafx-calculators/` | 208K | From 2020. **World-writable** (mode 777, including the PHP files). No vhost serves it by name. Whether the catch-all host serves it was not traced. |
| `/var/www/html/kdsites/dev3/` (empty) and `kdsites/migrate-dev-to-live.OLD` (12K) | tiny | |
| `/var/www/html/kdtemplates/.htpasswd` | 43B | Dated 2015; not read. |
| `/srv/kdtemplates/` | 24M | Not junk. Its README says it holds the sources and tools that rebuild the demo sites (see summary). Includes `outils/hors-ligne/se.php`, a database search-and-replace tool the README says used to answer 200 without authentication on the public IP and was moved out of the web root. |
| `/boot`: kernel `6.8.0-117` | initrd plus vmlinuz | Running kernel; leave until after the reboot. |

## Could not read without sudo
- `/var/lib/mysql` (database list and sizes), `/opt/containerd`
- `/etc/letsencrypt` private material and certificate expiry
- `/var/spool/cron/crontabs/*`
- `/home/toby`, `/home/grisha`, `/home/denisb`, `/root`, `/tmp/claude-1008`, `/tmp/cc-socks`, `/var/www/html/webdesign/chass/.pki`
- `/var/log/php8.1-fpm.log*` (root-only, mode 600)
- Which plugins and themes are active, and what data the databases hold (DB access needed)
- **2026-10-28 (round 3):** **ACF fields on a draft read from the latest revision in preview.** In ACF Pro, `acf_validate_post_id` (`includes/revisions.php`) swaps the post ID for `acf_get_post_latest_revision()` whenever `?preview` is in the URL, and the only way to see a draft is that preview. ACF copies field meta onto a revision only in a request where `acf/save_post` ran, i.e. an editor save. A `wp post update` (content write via the wrapper) creates a revision with **no** meta, so every ACF-driven section of the template previews blank, even with correct meta on the post itself (19488: closing CTA showed only the hard-coded image and an empty button). It can't be fixed through the wrapper: `wp post meta add/update` on a revision ID writes to the parent (`update_post_meta` resolves revisions), and `eval` is refused. Fixes: one editor "Save draft" after the last wp-cli content write (from a freshly loaded editor), or delete the wp-cli revisions. Published pages are unaffected, because the front end without `?preview` reads the post's own meta.
- **2026-10-28:** Forex CRM FAQ page (7105, `/forex-crm-faq/`, `template.menu-api`): Q&As are hand-written HTML cards in `post_content` (`wp:columns > wp:column > wp:html` with `.item.double > .news-card`, static, no accordion), and the FAQPage JSON-LD is an inline `<script>` in the last `wp:html` block (not Yoast). 11 translations (term 180). The theme's header is `position: fixed` (58–63px) with no scroll offset, so any `#anchor` lands its target under the header (the page's own `#apis` too); give the target `scroll-margin-top`. WP Rocket's page cache on dev is empty (`cache/wp-rocket/` has only `index.html`, responses are `cf-cache-status: DYNAMIC`), and the wrapper has no `wp rocket` command. Updating a published EN page through the wrapper queues all 11 translations (see the kenmore-translate entry above); the part-2 FAQ insertion is prepared in ops `wordpress/agentic-forex-crm/faq/` and waits on that.
- **2026-10-28: standard for saving any English page on dev during the Agentic Forex CRM job (parts 1–3), until Alex runs translations once at the end:** wrap every content save in one ssh call that sets `kt_auto` to 0, runs `post update ID - --user=admin`, and restores `kt_auto` to 1 in an `EXIT` trap. Afterwards check both the setting and the queue: `wp dev action-scheduler action list --hook=kt_translate_post --status=pending --format=count` must be 0, and no new `kenmore-translate` group action may appear (queue is Action Scheduler tables, not posts; `post list --post_type=scheduled-action` shows nothing). Pages saved this way keep a stale `_kt_source_hash`, so the next publish save (editor or wp-cli without the guard) queues all 11 languages. First use: FAQ 7105 insertion, 21:55 UTC, nothing queued. Template in ops `wordpress/agentic-forex-crm/faq/ROLLBACK.md`.
- **2026-10-28 (part 3):** Agentic Forex CRM page 19488 **published** on dev (`/forex-solutions/agentic-forex-crm/`); translations 19497–19507 (fr es ru tr zh ko ja ku ar fa he), all 22 jobs (19488 + FAQ 7105) completed without errors. The kt_auto guard above was only for parts 1–2; from part 3 English saves run normally.
- **2026-10-28:** **The header's Forex Solutions mega panel is not built from menu items**: Main Menu (term 2) item 2031 carries two Max Mega Menu Custom HTML widgets (`custom_html-2` left, `custom_html-3` right; option `widget_custom_html` indexes 2/3, CRLF content; `custom_html-4/5` Prop Firm 4272, `-6/7` Resources 13956) with hand-written `<li>` entries and a `.default`/`.active` media-library SVG pair per icon (hard-coded #6C67AB / #FA6C06; theme CSS swaps them). Separators are inline `border-top` on a `.sub-mega` wrapper. Edit through `wp option patch update widget_custom_html N content` (stdin). All 12 languages use Main Menu; labels are swapped at render by kenmore-translate's Theme strings (`kt_theme_strings` / `kt_string_i18n`, substring replace, longest first, whole page), so a new label stays English unless added there; links are rewritten to `/lang/…` once that translation exists. Widget changes need no Max Mega Menu CSS rebuild (CSS comes from menu/theme settings). Agentic item added between Forex Web Design and FX & CRM Reports; ops `wordpress/agentic-forex-crm/menu/`.
- **2026-10-28:** kenmore-translate gotchas. (1) It saves translations via `wp_insert_post` without `wp_slash`, so **backslashes in source content are stripped**: a `\"` inside inline JSON-LD became a bare quote and broke FAQPage JSON on every translation; use typographic quotes. (2) Inline `<script type="application/ld+json">` is copied untranslated. (3) "Translate now" = 11 × `wp action-scheduler action create kt_translate_post async --args='[ID,"lang"]' --group=kenmore-translate`; drive with `wp action-scheduler run --group=kenmore-translate` (both via the wrapper). (4) Pages with fixed-geometry decoration fitted to English text (19488's dashed line) don't survive translation: longer text moves the badges, RTL mirrors them.
- **2026-10-28:** WP Rocket on dev **started writing page cache at 22:15** (24 files by 22:32, all pages loaded during checks); before that `cache/wp-rocket/` held only `index.html`. Cached copies can serve a stale header menu; purge from the admin bar (no wrapper command).
