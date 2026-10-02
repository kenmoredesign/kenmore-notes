# Live chat migration: livechat-old to wp-eu

Gate A plan, written 2026-10-02. **Nothing here has been done.** Facts behind it are in
`livechat-old.md` and the 2026-10-02 section of `wp-eu.md`.

## What the inventory changes about the brief

1. **Only seven chats have a database to move.** The other 87 installed chats point at
   a database host (`ziemel.kenmoredesign.net` and two others) that stopped answering
   around 2026-09-22. Six databases were moved onto livechat-old on 2026-09-18; a
   seventh (`alve`) was installed there on 2026-09-22.
2. **Two chats with real traffic are down right now**: `gofund` (chat.gofund.trade) and
   `ffun` (chat.fundedfun.com). Their databases were not among the six.
3. **wp-eu cannot run the app as it stands.** PHP Live! 4.7.8 needs PHP 7.4 or lower;
   wp-eu has 8.5 only and Ubuntu 26.04 ships nothing older.
4. **"Both copies run on one database" holds for the database only.** In-progress chat
   state is files under `web/chat_sessions/`. A visitor on one copy and an operator on
   the other would not see each other. For Cloudflare-proxied chats the origin switch
   is all-at-once, so this never arises. For the two direct-DNS chats it could during
   DNS propagation; neither has an operator account, so no chat can be in progress.

## Decisions needed before anything starts

| # | Question | Recommendation |
|---|---|---|
| 1 | What happened to `ziemel`, and do the other databases still exist anywhere? | Needed for `gofund` and `ffun`. Without their data the choice is a fresh empty install on wp-eu or retiring them |
| 2 | How to get PHP 7.4 on wp-eu | The ondrej/php PPA, if it publishes 7.4 for Ubuntu 26.04 (root has to check). Fallback: a `php:7.4-fpm` container per host. Not recommended: patching the app for PHP 8 (about 45 files) |
| 3 | TLS on the database link | Yes. It needs a three-line edit to `API/SQLi.php` in the seven old copies; without it visitor names, emails and chat text cross the internet in clear |
| 4 | Move `nc` and `vin`? They work but nobody uses them | Move them; it costs nothing extra and avoids a second round |
| 5 | `zen` (chat.zentrobrokerage.com, set up 2026-09-07) and `sto` (chat.2sto.net, 2026-06-23) are Kenmore's own recent chats and are in the broken group | If they are wanted, they are fresh installs, which is phase 2's `create-chat` |
| 6 | Who runs the root steps on wp-eu | Scripts in `~/ops/livechat/bin/`, reviewed, installed by alex into `/usr/local/lib/kenmore-ops/` so `claude` runs them with sudo, as with `wp`. This overlaps phase 2 |

## Per chat

All seven "go" chats need old PHP. None needs ionCube.

| Verdict | Chats |
|---|---|
| **Go, needs old PHP** | `alve`, `ngelpartners`, `pcxfx` (database `primecodex`), `thaurusguru` (database `thau`), `westernfx` |
| **Go if wanted (decision 4)** | `nc`, `vin` |
| **Blocked: alive, no database (decision 1)** | `gofund`, `ffun` |
| **Dead unless their database turns up** (DNS still reaches the old box, no real traffic) | `aiwa`, `blackridgecm`, `blackwavecapital`, `dreammarketsfx`, `ef`, `excm`, `finprop`, `ft`, `fund`, `gene`, `ibullcapital`, `mainetfunded`, `mbfx`, `mi`, `monkeyforex`, `onebidasset`, `onfon`, `pat`, `propfirmcapital`, `proptradacademy`, `pst`, `quicktrade`, `sto`, `tf`, `uniborsa`, `vm`, `xfin`, `xfintr8`, `zen` |
| **Dead** (name no longer resolves to the old box) | the 56 marked `dead` in `livechat-old.md` |
| **Never installed** | `5rf`, `axisby`, `bldemochat`, `el`, `finestock`, `josaimarkets`, `ntc`, `perfectlions`, `praxisdigital`, `switzprime`, `thau`; `inzo` is a static page |

## Layout on wp-eu

Kept as close to `create-chat` and `create-db` as possible: the docroot is the chat
directory itself, the database and its user carry the same name, and the nginx vhost
is the old template with the paths changed. The Unix user and the pool are new,
because wp-eu isolates every site and the old box did not.

| | Old box | wp-eu |
|---|---|---|
| Directory and docroot | `/var/www/html/<name>/` | `/srv/livechat/<name>/` |
| Code ownership | `root:root` | `root:root`, read-only to PHP |
| Writable data | `web/`, 777, written by `apache` | `web/`, owner `lc-<name>`, group `www-data`, 2750 |
| Unix user | shared `apache` | `lc-<name>`, no login, home `/srv/livechat/<name>` |
| PHP-FPM pool | shared `www`, PHP 7.2 | `/etc/php/7.4/fpm/pool.d/lc-<name>.conf`, socket `/run/php/php7.4-fpm-lc-<name>.sock`, `ondemand`, 5 children, `open_basedir /srv/livechat/<name>:/tmp`, limits as on the old box (128M, 2M upload, 8M post) |
| nginx vhost | `sites-available/<name>.conf` | `sites-available/lc-<name>`, sets `$chat_name`, includes one shared `snippets/livechat.conf` (the old `general.conf` and `php.conf` merged) |
| Logs | `/var/log/nginx/<name>_access.log` | `/var/log/nginx/lc-<name>.access.log` |
| Database | `<db>` | same name: `alve`, `ngelpartners`, `primecodex`, `thau`, `westernfx`, `nc`, `vin` |
| Database user | `<db>@localhost` | `<db>@localhost` and `<db>@172.105.248.251` |
| Backups | none | `/var/backups/kenmore-ops/livechat/<name>/` |

In each copied `web/config.php` four path values change from `/var/www/html/<name>` to
`/srv/livechat/<name>`. `SQLHOST` stays `localhost`. Nothing else changes.

## The direct database link

**On wp-eu (root), one new file `/etc/mysql/mysql.conf.d/zz-livechat.cnf`:**

    [mysqld]
    bind-address          = 127.0.0.1,91.99.203.165
    mysql_native_password = ON
    sql_mode              = NO_ENGINE_SUBSTITUTION

- `bind-address`: `tuning.cnf` and `mysqld.cnf` both set it to 127.0.0.1; a `zz-` file
  sorts last and wins. `mysqlx` stays local.
- `mysql_native_password`: off by default in 8.4. PHP 7.2 on the old box can log in no
  other way.
- `sql_mode`: the old server was switched to non-strict for this app on 2026-09-18.
  WordPress sets its own session mode on connect and already drops the strict modes,
  so the two sites should see no difference.
- These need a **MySQL restart**: the WordPress sites lose their database for the
  length of it, estimated 10 to 30 seconds.
- ufw: confirm `ufw status`, and add `allow from 172.105.248.251 to any port 3306
  proto tcp` if it is not there.

**Users**, two per chat, created from the old server's stored hash so no password is
typed or shown:

    CREATE USER '<db>'@'localhost'        IDENTIFIED WITH mysql_native_password AS '<hash>';
    CREATE USER '<db>'@'172.105.248.251'  IDENTIFIED WITH mysql_native_password AS '<hash>' REQUIRE SSL;
    GRANT ALL PRIVILEGES ON `<db>`.* TO both;

Same password as today, so the copied `config.php` works unchanged on wp-eu and the
old one needs only its host changed. `REQUIRE SSL` applies if decision 3 is yes.

**TLS.** The old client can do it: mysqlnd with OpenSSL 1.1.1k, TLS 1.2 and 1.3, and
MySQL 8.4 generates a server certificate by itself. But the app connects with
`new mysqli(host, user, pass)`, which cannot ask for TLS. The edit in
`API/SQLi.php` on the old copies replaces that line with `mysqli_init()` and
`real_connect(..., MYSQLI_CLIENT_SSL | MYSQLI_CLIENT_SSL_DONT_VERIFY_SERVER_CERT)`.
That encrypts without verifying the server; verifying would mean copying wp-eu's
`ca.pem` to the old box and one more line.

**On the old box:**
- In each `web/config.php`, `SQLHOST` goes from `localhost` to `91.99.203.165`. The
  IPv4 address, not a name: this box prefers IPv6 outbound and the grant and firewall
  rule are for 172.105.248.251.
- SELinux needs nothing: it is permissive, and `httpd_can_network_connect_db` is on.
- firewalld does not filter outbound. No PHP restart is needed (no opcache).
- The path is already open: 91.99.203.165:3306 refuses the connection today.

## Cloudflare and TLS on the new origin

| Chat | Mode | wp-eu vhost serves |
|---|---|---|
| `ngelpartners`, `pcxfx`, `thaurusguru` | Flex | **port 80 only, plain HTTP, no redirect.** The `cf.conf` template as it is |
| `alve`, `vin` | Full | port 80 as above, plus 443 with a new 10-year self-signed certificate in `/etc/ssl/selfsigned/<domain>.{crt,key}`, generated on wp-eu. Cloudflare Full does not validate it, so the old key need not travel |
| `westernfx`, `nc` | not proxied | 443 with a public certificate, 80 serving the ACME path and redirecting the rest |

- wp-eu's default 443 server rejects the handshake, so a Full chat without its own 443
  vhost would fail loudly instead of showing the wrong site. Good.
- Nothing in the app or the vhost forces HTTPS on the Flex chats. `BASE_URL` is https
  in every config and that already works behind Flex today.
- `westernfx` and `nc` have a chicken-and-egg problem: certbot on wp-eu cannot pass
  HTTP-01 until DNS points there. Copy the current Let's Encrypt pair from the old box
  for the cutover (valid to 2026-12-10 and 2026-11-21), then issue properly on wp-eu
  once DNS has moved. This is the one place a private key crosses hosts.
- `conf.d/cloudflare.conf` on wp-eu already restores the visitor IP.

## Cutover, in order

**Stage 0: prepare wp-eu. No chat downtime. Root.**
1. Install PHP 7.4 FPM (decision 2) with mysqli, curl, and the modules listed in
   `livechat-old.md`. Confirm 8.5 and the WordPress pools are untouched.
2. Create `/srv/livechat`, `snippets/livechat.conf`, and per chat: user, directory,
   pool, vhost (not yet enabled), self-signed pair where Full.
3. Write `zz-livechat.cnf`; check ufw.
4. **Gate B.** Restart MySQL. WordPress outage 10 to 30 seconds. Check both sites.
5. Create the seven databases and fourteen users.

**Stage 1: rehearsal. No downtime.**
6. Stream code and a `--single-transaction` dump per chat through the ops machine
   (`ssh livechat-old … | ssh wp-eu …`), nothing landing on its disk. Load, fix the
   four paths in `config.php`, enable the vhosts.
7. Test each new copy with `curl --resolve <domain>:80:91.99.203.165` (and `:443`):
   widget script, operator login page, setup login page. Read the PHP 7.4 error log.
   This is where MySQL 8.4 or PHP 7.4 surprises show, before anything live is touched.
8. From the old box, connect to wp-eu as one chat's user with TLS. Proves the link.

**Stage 2: the database move. Gate B. Chats down for about 5 minutes; ask for 15.**
9. Before-backup on the old box: dump of each database and a copy of each
   `config.php` (and `API/SQLi.php`) to `/root/livechat-migration/<timestamp>/`, mode
   600, outside any docroot.
10. Stop `php-fpm` on the old box. All chats there return 502. Downtime starts.
11. Final dump of the seven databases, load into wp-eu (replacing the rehearsal copy).
    Final sync of each `web/` directory.
12. Edit the seven old `config.php` files: `SQLHOST`. Apply the `SQLi.php` edit if TLS.
13. Start `php-fpm`. Downtime ends. The old copies now run on wp-eu's database.
14. Verify old and new copy of every chat; compare row counts per table on both sides.
15. After-backup: dump each database on wp-eu to
    `/var/backups/kenmore-ops/livechat/<name>/`. The old box's local databases are
    left in place, untouched, as the rollback.

**Stage 3: move the names. Per chat, no downtime, any time after stage 2.**
16. Flex and Full chats: the origin A record in the zone's Cloudflare account changes
    to 91.99.203.165. `alve` is Kenmore's; the other four are the clients' accounts.
17. `westernfx` (Kenmore's zone) and `nc` (client, Namecheap): A record to
    91.99.203.165, then issue the real certificate on wp-eu.
18. When a chat's old access log has gone quiet for a few days, disable its old vhost.
    When all seven have, remove the `@172.105.248.251` users and put
    `bind-address` back to local only. The old box can then go. (`mysql_native_password`
    stays on until the chats' own users are moved off it, which is phase 2.)

## Rollback

| If it fails at | Do this | Loses |
|---|---|---|
| Stage 0 step 4 (MySQL will not start, or WordPress misbehaves) | delete `zz-livechat.cnf`, restart MySQL | nothing |
| Stage 1 | disable the `lc-*` vhosts, reload nginx | nothing; nothing live was touched |
| Stage 2, before step 13 | restore the seven `config.php` (and `SQLi.php`) from step 9, start `php-fpm` | nothing; the local databases were never modified |
| Stage 2, after step 13 | stop `php-fpm`; dump the seven databases from wp-eu and load them into the old local MySQL; restore `config.php` and `SQLi.php` from step 9; start `php-fpm`. The quick form skips the dump-back | quick form only: writes made since step 13 |
| Stage 3 | put the A record back. Both copies share the database, so either origin is current | nothing |

## What needs root on wp-eu

Everything on wp-eu. `claude` can run only `/usr/local/lib/kenmore-ops/*` there.

- installing PHP 7.4 and its FPM service (apt, possibly a PPA)
- `/srv/livechat/*`, the `lc-*` users, `/var/backups/kenmore-ops/livechat`
- pool files and reloading PHP-FPM 7.4
- nginx snippet, vhosts, self-signed pairs, installing the two copied certificates,
  reload; later certbot for `westernfx` and `nc`
- `zz-livechat.cnf` and the MySQL restart
- ufw rule
- creating databases and users, loading dumps, taking the after-backups

On the old box `claude` has sudo and can do all of stage 2's steps there.

## Not part of this plan, but should not be forgotten

- The open `/setup/install.php` on `josaimarkets`, `praxisdigital` and `thau`, which
  scanners are already hitting. Disabling three vhosts on the old box would close it.
- The six `config.php.bak.2026-09-18` files inside docroots on the old box.
- No MTA on either host. Only `primecodex` has SMTP configured in the app; whether its
  provider accepts wp-eu's address, and on which port, is unknown.
- wp-eu has no scheduled backup. After stage 2 it holds the only current copy of the
  chat data.
