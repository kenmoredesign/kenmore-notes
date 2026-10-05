# Live chat migration: livechat-old to wp-eu

Revised 2026-10-05 for the decisions of that day (forwarding instead of a database
link). The 2026-10-02 Gate A plan is in git history. Facts behind it: `livechat-old.md`
and the 2026-10-02 section of `wp-eu.md`. Scripts: `~/ops/livechat/`.

**Status 2026-10-05:** Gate A approved. Step 2 done on the old box: backup in
`/root/livechat-migration/20261005-105822Z/` (`original` points at it; checksums
verified; 7 database dumps, 8 configs, 11 vhosts). The `josaimarkets`,
`praxisdigital` and `thau` vhosts are disabled (their `/setup/install.php` now 404s).
The six `config.php.bak.2026-09-18` files and `ngelpartners/web/config.php_old_server`
were moved to `original/config-bak/`. All seven working chats still pass `check.sh old`.
Nothing changed on wp-eu yet.

Changes from the 2026-10-05 review: opcache off in every `lc-*` pool; needrestart
list-only through the environment of that one apt run (no file changed); the
rehearsal also proves one database write per chat; cutover order nc (with the
rollback proof), vin, thaurusguru, then a stop and report, then sto, alve,
westernfx, ngelpartners, pcxfx.

## Rollback

Ready before anything is cut over. Run from `~/ops/livechat` on the ops machine.

| Situation | Command | What it loses |
|---|---|---|
| One chat misbehaves after cutover | `bin/rollback-old.sh <chat>` | Everything that chat wrote on wp-eu since its cutover. Takes seconds. |
| All chats | `bin/rollback-old.sh all` | Same, for every chat. `sto` goes back to its original, broken state (its database was on `ziemel`). |
| A chat has had real use since cutover | `ssh root@wp-eu /root/livechat/wp-eu-livechat.sh dump <chat> \| bin/rollback-old.sh --from-dump <chat>` | Nothing written before the dump. The chat shows 503 for the minute it takes. Needs a root window on wp-eu. The local database is saved to `/root/livechat-migration/pre-rollback-<time>/` before it is replaced. Not for `sto` (no local database). |
| ...and DNS already points at wp-eu | first `ssh root@wp-eu /root/livechat/wp-eu-livechat.sh disable <chat>`, then the line above, then move DNS back | as above |
| Take the chats off wp-eu | `bin/rollback-old.sh all`, then `ssh root@wp-eu 'bash -s' < bin/rollback-wp-eu.sh` | Nothing. It disables the `lc-*` vhosts and pools, removes the real-IP rule and undoes `sql_mode`. Keeps data, users, files and PHP 7.4. It refuses if any `lc-*` vhost served a request in the last 10 minutes (`--force` overrides). |
| Remove everything from wp-eu | `ssh root@wp-eu 'bash -s -- --purge --yes' < bin/rollback-wp-eu.sh` | The chat databases (each is dumped to `/var/backups/kenmore-ops/livechat/<chat>/` first), users, `/srv/livechat`, certificates, PHP 7.4 and the sury repository. Ubuntu's `php-common` goes back. |
| Undo the old-box hygiene | `ssh livechat-old sudo /root/livechat-migration/bin/old-livechat.sh unhygiene` | nothing |

`bin/rollback-old.sh status` shows each chat's state on the old box (original,
maint, forward). `bin/check.sh <chat> old|new|both` tests a chat on either box.

How the fast rollback works: the migration never modifies or drops the old box's
local databases, and every changed vhost has its original in
`/root/livechat-migration/original/vhosts/`. Restoring the vhost makes the old copy
serve again from the local database, as it did at that chat's cutover.

## What is moving

| Chat | Domain | Cloudflare | Database | Notes |
|---|---|---|---|---|
| alve | chat.alverix.net | Full | alve | |
| ngelpartners | chat.ngelpartners.com | Flex | ngelpartners | |
| pcxfx | chat.pcxfx.com | Flex | primecodex | |
| thaurusguru | chat.thaurusguru.com | Flex | thau | |
| vin | chat.vinnexiacapital.com | Full | vin | |
| westernfx | chat.westernfx.com | not proxied | westernfx | public certificate on wp-eu |
| nc | chat.niivesh.com | not proxied | nc | public certificate on wp-eu; cut over first (no users) |
| sto | chat.2sto.net | not proxied | sto | database from `/srv/incoming/livechat/sto.sql.gz`; code from the old box |

`gofund`, `ffun` and `zen` are dead and stay where they are.

**The sto dump** (`sto.sql.gz`, 4.6 KB, 36 KB unpacked) is a complete `mysqldump`
from MySQL 5.6.39 on 2026-09-17 13:23 ("Dump completed" trailer present). It holds
the 35 standard PHP Live! tables. Only `p_admins`, `p_vars`, `p_footprints`,
`p_footprints_u`, `p_footstats`, `p_ips` and `p_refer` have rows. So setup ran (an
admin account exists) but no departments or operators were ever added, the same
shape as `alve` and `westernfx`. Whether it loads is tested in the rehearsal.

## How it works

- **No database link.** MySQL on wp-eu stays on localhost. At cutover, the chat's
  vhost on the old box stops serving PHP and forwards every request to wp-eu over
  HTTPS (`proxy_pass https://91.99.203.165`, SNI and `Host` set to the chat's
  domain). It sends the visitor's address in `CF-Connecting-IP`; wp-eu trusts that
  header from 172.105.248.251 (`conf.d/livechat-realip.conf`), next to the existing
  Cloudflare ranges.
- So there is only one live copy per chat at any time, and the file-based chat
  state in `web/chat_sessions/` is never split between two servers.
- For the three direct-DNS chats the old box also forwards
  `/.well-known/acme-challenge/` over plain HTTP, so certbot on wp-eu can get their
  certificates before DNS moves. No private key moves between hosts.
- When a chat's DNS moves, visitors reach wp-eu directly and the old box's
  forwarding vhost simply goes quiet.

## PHP 7.4

Checked 2026-10-05 from the ops machine, no root: `packages.sury.org/php` has a
`resolute` suite (amd64, main, signed by `15058500A0235D97F5D10063B188E2B695BD4743`,
the DEB.SURY.ORG key) with `php7.4-*` 7.4.33. It also has php8.5 8.5.11, newer than
wp-eu's Ubuntu 8.5.4, so the pin matters.

Pin (`/etc/apt/preferences.d/sury-php`): everything from sury at -1 (never), except
`php7.4 php7.4-*` and `php-common` at 500. `php-common` has to come along because
Ubuntu's `2:99ubuntu1` declares `Breaks: php7.4-common`.

Dry run (simulated on the ops machine against a copy of wp-eu's
`/var/lib/dpkg/status`, Ubuntu lists plus sury, with the pin):

    The following NEW packages will be installed:
      php7.4-bz2 php7.4-cli php7.4-common php7.4-curl php7.4-fpm php7.4-json
      php7.4-mysql php7.4-opcache php7.4-readline php7.4-sqlite3
    The following packages will be upgraded:
      php-common     (2:99ubuntu1 -> 2:101~+0~20260503.72+ubuntu26.04~1, sury)
    1 upgraded, 10 newly installed, 0 to remove

PHP 8.5 candidates stay Ubuntu's 8.5.4-0ubuntu1.3. `php-common`'s postinst restarts
only `phpsessionclean.timer`. php8.5-fpm's only dpkg trigger watches
`/etc/php/8.5/fpm/conf.d`, which the 7.4 packages do not touch. wp-eu runs
`needrestart`, so the install sets `NEEDRESTART_MODE=l` (list, never restart).
`php7.4-cli` registers `/usr/bin/php` at priority 74, below 8.5's 85, so `php` stays
8.5. `unattended-upgrades` only takes Ubuntu origins, so nothing from sury arrives
by itself.

`wp-eu-php74.sh install` repeats the dry run on wp-eu and refuses unless it
installs only `php7.4-*`, upgrades at most `php-common`, removes nothing and leaves
php8.5 alone. Afterwards it prints `php -v`, php8.5-fpm's PID and start time before
and after, and both WordPress sites' status codes.

## Layout on wp-eu

| | |
|---|---|
| Code and docroot | `/srv/livechat/<name>/`, `root:root`, read-only to PHP |
| Writable data | `web/`, owner `lc-<name>`, group `www-data`, dirs 2750, files 640 |
| Unix user | `lc-<name>`, system, no login |
| Pool | `/etc/php/7.4/fpm/pool.d/lc-<name>.conf`, socket `/run/php/php7.4-fpm-lc-<name>.sock`, ondemand, 5 children, `open_basedir /srv/livechat/<name>:/tmp`, 128M, 2M upload, 8M post, UTC |
| vhost | `/etc/nginx/sites-available/lc-<name>`, shared `snippets/livechat.conf`, logs `/var/log/nginx/lc-<name>.*.log` |
| TLS | every chat answers on 443 with a 10-year self-signed certificate in `/etc/ssl/livechat/`. Flex and Full chats also serve the app on plain 80 with no redirect. Direct chats use 80 for ACME and a redirect, and switch to Let's Encrypt via `wp-eu-livechat.sh cert` |
| Database | same name as on the old box, `utf8mb4_general_ci` default |
| Database user | the chat's own `SQLLOGIN@localhost`, created with the password already in its `config.php`, read by PHP 7.4 (which applies the app's `stripslashes()`), never printed. Default plugin (`caching_sha2_password`) |
| `sql_mode` | `SET PERSIST sql_mode = 'NO_ENGINE_SUBSTITUTION'`, no restart. The old value is saved in `/root/livechat/sql_mode.orig`. WordPress sets its own session mode, so the two sites are unaffected |
| Backups | `/var/backups/kenmore-ops/livechat/<name>/` |
| Root-only tool | `/root/livechat/wp-eu-livechat.sh` |

The snippet adds `X-Livechat-Origin: wp-eu` to responses (that is how `check.sh`
tells the two servers apart), and denies dotfiles, `*.bak`/`*.sql` and direct
requests for `web/config.php`.

If PHP 7.4 turns out unable to log in with `caching_sha2_password`, the plan stops:
the alternative needs `mysql_native_password=ON`, which means a MySQL restart.
`import-files` tests the login right after creating the user.

## Order

| Step | What | Who | Gate |
|---|---|---|---|
| 1 | PHP 7.4 check, sto dump, this file, the scripts | done | **A (now)** |
| 2 | Old box: `backup`, then `hygiene` (disable the `josaimarkets`, `praxisdigital`, `thau` vhosts; move the six `config.php.bak.2026-09-18` into the backup) | claude, sudo on old box | after A |
| 3 | wp-eu: `wp-eu-php74.sh check`, show the dry run, `install`, `wp-eu-build.sh`, copy `wp-eu-livechat.sh` to `/root/livechat/` | root window; Hetzner snapshot confirmed first | |
| 4 | Rehearsal: per chat `export-files \| import-files`, `export-db \| import-db` (sto: `zcat sto.sql.gz \| import-db sto`), `check.sh <chat> new`, `wp-eu-livechat.sh errors` | root window | **B** |
| 5 | Cutover, one chat at a time, nc first (then roll nc back and cut it over again) | claude + root window | your go |
| 6 | After-backups, certificates for westernfx, nc, sto, DNS table below, notes, commit and push | root window | |

**Cutover of one chat** (about a minute of 503). Each line is a separate command.

    OLD="ssh livechat-old sudo /root/livechat-migration/bin/old-livechat.sh"
    WP="ssh root@wp-eu /root/livechat/wp-eu-livechat.sh"
    $OLD maint <chat>                                    # 503 starts
    $OLD export-db <chat>  | $WP import-db <chat>        # not for sto
    $OLD export-web <chat> | $WP import-web <chat>
    diff <($OLD counts <chat>) <($WP counts <chat>)      # must be empty (sto: compare to the dump)
    bin/check.sh <chat> new
    $OLD forward <chat>                                  # 503 ends
    bin/check.sh <chat> both
    # any failure after 'maint':  bin/rollback-old.sh <chat>

After all chats: `$WP backup <chat> after-cutover` for each. For westernfx, nc
and sto: `$WP cert <chat>`.

## DNS changes

Filled in at step 6.

## Not part of this work

- The old box's certbot will try to renew chat.niivesh.com from about 2026-10-22,
  chat.2sto.net from 2026-10-21 and chat.westernfx.com from 2026-11-10, with the
  nginx plugin, on vhosts that now forward. Moving those three names' DNS before then
  avoids finding out what it does.
- wp-eu has no scheduled backup; after cutover it holds the only live copy of the chats.
