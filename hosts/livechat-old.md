# livechat-old

Surveyed 2026-10-02 over ssh as `claude` (uid 1003, passwordless sudo). Read-only: nothing
was changed or restarted. (One slip: a connectivity probe wrote and removed a
zero-content temp file in `/tmp`.) No password, dump or chat text was printed; config
files were read with values masked, databases through `information_schema`, row counts
and `MAX(timestamp)` only.

## Summary

- 172.105.248.251 (Linode), CentOS Linux 8.5.2111 (EOL), kernel 4.18.0-193, 2 vCPU,
  3.7 GB RAM, 48 GB disk (6.1 GB used). Last boot 2026-09-21.
- One app everywhere: **PHP Live! 4.7.8** (OSI Codes, 2018 code, plain PHP source, no
  ionCube or other loader). nginx 1.14.1, one shared PHP-FPM 7.2.24 pool, MySQL 8.0.26.
- 106 directories under `/var/www/html`, 105 vhosts. **Only 7 chats have a working
  database.** Everything else points at a database host that no longer answers.
- Of those 7, 5 carry real widget traffic and 2 work but are unused.
- 2 more chats (`gofund`, `ffun`) still get real traffic but fail on every request
  because their database is unreachable.

## The database situation (read this first)

Each chat's `web/config.php` names its DB host. Counts across the 94 installed chats:

| `SQLHOST` | Chats | State on 2026-10-02 |
|---|---|---|
| `localhost` | 7 | working |
| `ziemel.kenmoredesign.net` (pinned to 172.104.234.154 in `/etc/hosts`) | 74 | 3306 times out, no ping |
| `172.104.179.247` | 12 | 3306 times out, no ping |
| `136.244.89.111` | 1 (`colossus`) | 3306 times out, no ping |

- The local MySQL data directory was initialised on **2026-09-18 13:04**. Six databases
  were created between 14:10 and 14:16 that day, and the six matching `config.php`
  files were rewritten the same day (`web/config.php.bak.2026-09-18` sits beside each;
  not opened). `alve` was installed fresh on 2026-09-22/23.
- `/etc/my.cnf.d/zz-migration.cnf` (2026-09-18) sets `sql_mode=NO_ENGINE_SUBSTITUTION`
  and `bind-address=127.0.0.1`. `/root/mysql-server.cnf.bak.2026-09-18` is the copy
  taken before.
- PHP-FPM's error log shows `Connection refused` to the remote host on 2026-09-22 and
  `Connection timed out` on every day with traffic since. Requests to those chats end
  as 499/504.
- So somebody moved six databases off `ziemel` on 2026-09-18, and `ziemel` went away
  around 2026-09-22. **I do not know where the other databases are now, or whether
  `ziemel` still exists.** It is not in `ssh_config` and I did not probe it from
  anywhere but this box.

## Helper scripts

All in `/root/bin/` (root's `PATH`); the login banner (`/etc/motd`) names three.

**`create-chat`** (2023-11-16), interactive:
1. Asks for a name (`^[[:alnum:]]{1,16}$`, "use jira slug") and a URL; strips the scheme
   and path.
2. `ping -4 -c1` the host. If it resolves to 172.105.248.251 the chat is "direct",
   otherwise "proxied via CloudFlare".
3. Writes `/etc/nginx/sites-available/<name>.conf` from a template with `CHAT_URL` and
   `NAME` substituted: `direct.conf` (443 vhost with no certificate lines yet, plus an
   80 vhost that serves `/.well-known/acme-challenge/` from `/var/www/_letsencrypt` and
   301s the rest to https) or `cf.conf` (**port 80 only, no redirect**: the Flex case).
   Symlinks it into `sites-enabled`.
4. `mkdir /var/www/html/<name>`, copies `../install_chat.sh` in and runs it:
   untars `/var/www/chat.tar.gz` (6.3 MB, 2025-08-01), deletes `web/config.php`,
   `chmod 777` on `web` and every directory in it, `666` on its files.
5. `nginx -t`, reload. For direct chats: `certbot --nginx -d <url>`, reload again.
6. The operator then finishes in the browser at `/setup/install.php`, which writes
   `web/config.php`.

**`create-db <name>`** (rewritten 2026-09-22 12:17): name must match `^[a-zA-Z0-9_]+$`.
Creates database `<name>` (`utf8mb4` / `utf8mb4_general_ci`), user
`<name>@localhost` with a random 10-character password (`A-Za-z0-9_@*`), `GRANT ALL`
on that database, and prints host, db, user and password to the terminal for pasting
into the installer. Runs `mysql -u root` with no password (root has `/root/.my.cnf`).

**`add-self-signed-cert <domain>`** (2025-06-24): for "CF Full and cannot change it to
Flex". Finds the single vhost whose `server_name` matches, exits if it already listens
on 443, makes a 10-year RSA-2048 self-signed pair in `/etc/ssl/selfsigned/<domain>.{crt,key}`,
backs the vhost up to `/etc/nginx/vhost_backups/`, inserts `listen 443 ssl` and the two
certificate lines after the first `listen 80`, tests and reloads. Port 80 stays open
and nothing redirects.

Also there: `cf_443.conf` (unused template pointing at `/etc/pki/nginx/server.crt`),
`/root/cloudflare.sh` (rebuilds `/etc/nginx/cloudflare`, the `set_real_ip_from` list,
from cloudflare.com/ips-v4 and -v6; no credentials in it).

## Layout a chat ends up with

| | |
|---|---|
| Docroot | `/var/www/html/<name>/` (the whole app, owned by root; `alve` is `bob:games` from the tarball) |
| Writable data | `<name>/web/`, mode 777, files written by `apache` |
| Config | `<name>/web/config.php`, a `$CONF[...]` array |
| vhost | `/etc/nginx/sites-available/<name>.conf`, includes `general.conf` (asset expiry, gzip) and `default.d/php.conf` |
| Logs | `/var/log/nginx/<name>_access.log`, `<name>_error.log`; rotated daily, 10 kept |
| PHP | shared pool `www`, user `apache`, socket `/run/php-fpm/www.sock`, `pm.max_children 200` |
| Database | `<name>` with user `<name>@localhost` (older chats: `<x>_chat` on the remote host) |

`config.php` keys: `DOCUMENT_ROOT`, `BASE_URL`, `SQLTYPE` (`SQLi.php`, i.e. mysqli),
**`SQLHOST`, `SQLLOGIN`, `SQLPASS`, `DATABASE`**, `THEME`, `TIMEZONE`, `icon_online`,
`icon_offline`, `lang`, `logo`, `CONF_ROOT`, `UPLOAD_HTTP`, `UPLOAD_DIR`, `ATTACH_DIR`,
`geo`, `SALT`, `API_KEY`. Four of them hold absolute paths under `/var/www/html/<name>`
and two hold the https URL. There is no port key. The connection is
`new mysqli(SQLHOST, SQLLOGIN, SQLPASS)` then `select_db` in `API/SQLi.php`, so there
is no TLS option without editing that file.

Under `web/`: `chat_sessions/`, `chat_initiate/`, `file_attach/`, `patches/`, operator
icons, `vals.php`, `VERSION.php`. Live chat state is kept as files in `chat_sessions/`,
not in the database (to confirm in the rehearsal), so two copies of an app do not share
an in-progress chat even when they share a database.

Three code trees are in use among the seven working chats (md5 over everything outside
`web/`): the 2018 tree (`ngelpartners`, `thaurusguru`, `westernfx`), that tree plus a
stray `_debug.txt` (`pcxfx`), and the 2025-07-29 tarball with patched `phplive.php` and
`patch.php` (`nc`, `vin`, `alve`; `vin` and `alve` each differ in `setup/install.php`).

## Web server and PHP

- nginx 1.14.1, user `nginx`. `nginx.conf` includes `/etc/nginx/cloudflare`
  (`real_ip_header CF-Connecting-IP`), then `sites-enabled/*.conf`. Default servers on
  80 and 443 serve `/var/www/html/default`; the 443 one uses `/etc/pki/nginx/server.crt`,
  a self-signed "Default Company Ltd" certificate that **expired 2024-08-27**.
- The log format has no scheme or port, so the logs cannot show whether Cloudflare
  arrived on 80 or 443.
- PHP 7.2.24, FPM only (no CLI). Modules: bz2 calendar ctype curl date exif fileinfo
  filter ftp gettext hash iconv libxml mysqli mysqlnd openssl pcre PDO pdo_mysql
  pdo_sqlite Phar session sockets sqlite3 tokenizer zlib. No mbstring, gd, opcache,
  ionCube or any Zend extension. `memory_limit 128M`, `upload_max_filesize 2M`,
  `post_max_size 8M`.
- **The code does not run on PHP 8.** Outside `web/`: `each()` in 29 files (60 calls),
  `get_magic_quotes_*` in 3, `split`/`ereg` family in 12, one curly-brace string
  offset. All removed in 8.0. It needs PHP 7.4 or lower.
- mysqlnd in 7.2 cannot authenticate with `caching_sha2_password`. Every app user here
  is `mysql_native_password`.

## Databases

MySQL 8.0.26 (AppStream), `bind-address 127.0.0.1`, `sql_mode NO_ENGINE_SUBSTITUTION`
(not strict), server default `utf8mb4_0900_ai_ci`, `default_authentication_plugin
mysql_native_password`, binlog on, `have_ssl YES`, data directory 262 MB of which the
schemas are 16 MB. All InnoDB, 35 `p_*` tables each. No views, routines, triggers or
events.

| Database | Chat | Charset | Size | App user (`@localhost`, `mysql_native_password`) | Operators | Last operator activity | Chat requests logged | Last chat request | Last visitor footprint | Newest `.ibd` |
|---|---|---|---|---|---|---|---|---|---|---|
| alve | alve | utf8mb4_general_ci | 1.8 MB | alve | 0 | none (admin 2026-09-23) | 0 | none | 2026-10-02 | 2026-10-02 |
| ngelpartners | ngelpartners | utf8_general_ci | 3.6 MB | ngelpartners | 3 | 2026-04-07 | 133 | 2026-03-04 | 2026-10-02 | 2026-10-02 |
| primecodex | pcxfx | utf8_general_ci | 3.8 MB | primecodex | 6 | 2026-09-28 | 267 | 2026-07-17 | 2026-09-28 | 2026-09-28 |
| thau | thaurusguru | utf8_general_ci | 1.8 MB | thau | 1 | never | 0 | none | 2026-10-02 | 2026-10-02 |
| westernfx | westernfx | utf8_general_ci | 1.8 MB | westernfx | 0 | none (admin 2024-11-20) | 0 | none | 2026-10-02 | 2026-10-02 |
| nc | nc | utf8_general_ci | 1.8 MB | nc | 0 | none (admin 2025-10-30) | 0 | none | 2026-03-19 | 2026-09-18 |
| vin | vin | utf8_general_ci | 1.8 MB | vin | 1 | 2026-05-05 | 1 | 2026-05-05 | 2026-09-17 | 2026-09-21 |

Each user has `GRANT ALL` on its own database and nothing else. `root@localhost` is
also `mysql_native_password`. `westernfx`, `thau` and `nc` are the size of an empty
install and have no operators or history; whether that is how they were on `ziemel` or
they were re-created empty on 2026-09-18, I cannot tell.

The only dump on disk is `/root/ngel.sql` (525 KB, 2024-09-30; not opened).

## Which chats are alive

Measured from the access logs since 2026-09-22, counting only requests for the app's
own PHP endpoints (`js/phplive*.php`, `ajax/*.php`, `phplive.php`, `ops/`, `setup/`).
Everything else in the logs is scanner noise (`/.env`, `/wp-json`, and so on).

| Chat | App requests | Widget loads | Succeeded | Verdict |
|---|---|---|---|---|
| ngelpartners | 768 | 407 | 768 | live: widget is on a real site; operators idle since April |
| westernfx | 514 | 204 | 514 | live widget, but no operator accounts |
| pcxfx | 228 | 57 | 226 | live; operators active 2026-09-28 |
| alve | 203 | 92 | 202 | new install, being set up |
| thaurusguru | 104 | 48 | 104 | live widget; one operator who has never logged in |
| nc | 79 | 0 | 79 | works; no widget, no operators |
| vin | 12 | 0 | 12 | works; unused since May |
| **gofund** | 1895 | 13 | 106 | **real traffic, database unreachable** |
| **ffun** | 621 | 8 | 11 | **real traffic, database unreachable** |
| every other chat | 0 to 10 | 0 | 0 | no real use |

## Cloudflare and DNS

Resolved from the ops machine on 2026-10-02. "Zone held at" is the zone's NS pair; a
Cloudflare pair identifies an account. `karina/micah` holds kenmorefx.com and
kenmoredesign.com. `marjory/noah` holds alverix.net, 2sto.net and westernfx.com, so it
is presumably Kenmore's too. Every other pair is a client's own account or registrar.

Flex or Full is inferred from the vhost, since the logs cannot show it: a port-80-only
vhost that serves the chat correctly through Cloudflare must be Flex (in Full,
Cloudflare would land on the 443 default server and get the wrong site). A vhost that
`add-self-signed-cert` has touched is Full by the script's own purpose.

| Chat | Proxied | Mode | Origin must serve | DNS record controlled by |
|---|---|---|---|---|
| alve | yes | Full (self-signed, expires 2036-09-19; also answers on 80) | 443 self-signed and 80 | Kenmore (`marjory/noah`), presumed |
| ngelpartners | yes | Flex | plain 80, no redirect | client's Cloudflare (`harleigh/tosana`) |
| pcxfx | yes | Flex | plain 80, no redirect | client's Cloudflare (`garrett/journey`) |
| thaurusguru | yes | Flex | plain 80, no redirect | client's Cloudflare (`kevin/tiffany`) |
| vin | yes | Full (self-signed, expires 2036-04-30; also answers on 80) | 443 self-signed and 80 | client's Cloudflare (`lara/uriah`) |
| westernfx | no (DNS-only record) | n/a | 443 with a public certificate, 80 redirects | Kenmore (`marjory/noah`), presumed |
| nc | no | n/a | 443 with a public certificate, 80 redirects | client, at Namecheap (`registrar-servers.com`) |

## TLS on the origin

- **Let's Encrypt**, certbot 1.22.0, nginx authenticator and installer. 75 renewal
  configs. Renewal is a line in `/etc/crontab`: `0 0,12 * * *`, random sleep up to an
  hour, `certbot renew -q --renew-hook "service nginx reload"`. `certbot-renew.timer`
  is disabled. Today's run ended with **48 renew failures** (the dead domains).
  `chat.westernfx.com` expires 2026-12-10, `chat.niivesh.com` 2026-11-21.
- **Self-signed**, `/etc/ssl/selfsigned/`, 10 years, never renewed:
  chat.alverix.net, chat.vinnexiacapital.com, chat.thefundedtalent.com,
  chat.thebestprop.com, chat.x-fine.com.
- **Client-supplied**, `/etc/ssl/client-certs/`: a Cloudflare Origin CA certificate for
  monyxa (to 2036) and a self-signed one for fundedpeaks (to 2033). Both chats are dead.
- **`/etc/pki/nginx/server.crt`**: expired 2024, used by the default server and four
  dead vhosts.

## Cron, mail, uploads

- Cron: `/etc/crontab` has the certbot line above and `0 0 * * 0 root
  /root/cloudflare.sh`. `/etc/cron.daily/logrotate`. No user crontabs, no at jobs,
  nothing chat-specific.
- Mail: **no MTA is installed**. `sendmail_path` points at `/usr/sbin/sendmail`, which
  does not exist, and nothing listens on 25, so PHP `mail()` cannot send. PHP Live has
  its own SMTP add-on (`addons/smtp`, SwiftMailer) configured per department in the
  database. Only `primecodex` has a department with SMTP set; for the others, offline
  messages and transcript emails are not going anywhere today.
- Uploads: `web/file_attach/` is empty in all seven working chats except one file in
  `ngelpartners`. `web/` totals 40 to 364 KB per chat. The largest anywhere are dead
  chats: `vonway` 18 MB, `rut` 6.7 MB, `mbfx` 5.9 MB.
- Each chat's tree is 18 to 28 MB; `/var/www/html` is about 2 GB, nearly all of it
  dead copies of the same code.

## SELinux and firewall

- SELinux is **Permissive** (running and in `/etc/selinux/config`), so it blocks
  nothing. The booleans are right anyway: `httpd_can_network_connect on`,
  `httpd_can_network_connect_db on`. `httpd_can_sendmail off`.
- firewalld is running: services cockpit, dhcpv6-client, http, https, ssh inbound. It
  does not filter outbound.
- Outbound to wp-eu: a TCP connect from here to 91.99.203.165:3306 is **refused
  immediately**, not dropped, so the path is open and only MySQL's bind address is in
  the way. Port 443 connects. This box prefers IPv6 for outbound by name, so configs
  must use wp-eu's IPv4 address, not a hostname.
- OpenSSL 1.1.1k: TLS 1.2 and 1.3 are available to PHP for a MySQL connection.

## People and access

Shell users: root, bob, alex, tenshi (home untouched since 2021), claude. Recent
logins: alex (2026-10-02, 09-21, 09-18), bob (2026-09-22, when `alve` and the new
`create-db` appeared), claude (2026-09-18).

## Things that are wrong but out of scope

- **Open installers.** `josaimarkets`, `praxisdigital` and `thau` (chat.thaurus.com) are
  unpacked but never installed, resolve to this box, and return 200 for
  `/setup/install.php` with `web/` world-writable. Scanners requested that URL 323,
  2227 and 288 times between 2026-09-30 and 2026-10-02. Nothing has been written into any of the three
  `web/` directories yet. `el` and `finestock` are also uninstalled, behind Cloudflare.
- Requests to the broken chats each hold an FPM worker until the database connect
  times out. With one shared pool that is a way for scanner traffic to starve the
  working chats.
- Six `web/config.php.bak.2026-09-18` files hold credentials and sit inside docroots.
  nginx hands only names ending in `.php` to PHP, so these would be sent as plain
  text if requested (not tested, for obvious reasons).

## Every chat

Class: `live` and `working, unused` have a local database. `broken` means DNS still
reaches this box but the database host is gone. `dead` means the name no longer
resolves here. `not installed` has no `config.php`. `ziemel` is
`ziemel.kenmoredesign.net`. Web server, PHP and app version are the same for all
(nginx 1.14.1, PHP 7.2.24, PHP Live! 4.7.8). Docroot is `/var/www/html/<chat>` and
config is `web/config.php` under it.

| Chat | Domain | Class | DNS now | DNS zone held at | Origin TLS | DB host | DB name | Last log line | web/ KB | Attachments |
|---|---|---|---|---|---|---|---|---|---|---|
| alve | chat.alverix.net | live | Cloudflare proxy | Cloudflare (marjory/noah) | self-signed | local | alve | 02/Oct/2026 | 60 | 0 |
| ngelpartners | chat.ngelpartners.com | live | Cloudflare proxy | Cloudflare (harleigh/tosana) | none (HTTP only) | local | ngelpartners | 02/Oct/2026 | 364 | 1 |
| pcxfx | chat.pcxfx.com | live | Cloudflare proxy | Cloudflare (garrett/journey) | none (HTTP only) | local | primecodex | 02/Oct/2026 | 100 | 0 |
| thaurusguru | chat.thaurusguru.com | live | Cloudflare proxy | Cloudflare (kevin/tiffany) | none (HTTP only) | local | thau | 02/Oct/2026 | 60 | 0 |
| westernfx | chat.westernfx.com | live | this box, direct | Cloudflare (marjory/noah) | LE | local | westernfx | 02/Oct/2026 | 60 | 0 |
| nc | chat.niivesh.com | working, unused | this box, direct | registrar-servers.com | LE | local | nc | 02/Oct/2026 | 40 | 0 |
| vin | chat.vinnexiacapital.com | working, unused | Cloudflare proxy | Cloudflare (lara/uriah) | self-signed | local | vin | 02/Oct/2026 | 44 | 0 |
| ffun | chat.fundedfun.com | broken, has traffic | this box, direct | domaincontrol.com | LE | ziemel | ffun | 02/Oct/2026 | 96 | 0 |
| gofund | chat.gofund.trade | broken, has traffic | this box, direct | domaincontrol.com | LE | ziemel | gofund | 02/Oct/2026 | 56 | 0 |
| aiwa | chat.gofund.aiwafx.com | broken, no traffic | this box, direct | domaincontrol.com | LE | ziemel | aiwa | 02/Oct/2026 | 52 | 0 |
| blackridgecm | chat.blackridgecm.com | broken, no traffic | Cloudflare proxy | Cloudflare (lily/lou) | none (HTTP only) | ziemel | blackridgecm_chat | 30/Sep/2026 | 56 | 0 |
| blackwavecapital | chat.blackwavecapital.com | broken, no traffic | this box, direct | Cloudflare (dane/stevie) | LE | ziemel | blackwavecapital | 02/Oct/2026 | 56 | 0 |
| dreammarketsfx | chat.dreammarketsfx.com | broken, no traffic | Cloudflare proxy | Cloudflare (rustam/violet) | none (HTTP only) | ziemel | dreammarketsfx | 30/Sep/2026 | 32 | 0 |
| ef | chat.ecapfx.com | broken, no traffic | this box, direct | ui-dns.biz | LE | ziemel | ef | 02/Oct/2026 | 56 | 0 |
| excm | chat.exclusivefunded.com | broken, no traffic | this box, direct | Cloudflare (kiki/noel) | LE | ziemel | excm | 02/Oct/2026 | 56 | 0 |
| finprop | chat.fin-prop.com | broken, no traffic | Cloudflare proxy | Cloudflare (paislee/roman) | none (HTTP only) | ziemel | finprop | 01/Oct/2026 | 64 | 0 |
| ft | chat.thefundedtalent.com | broken, no traffic | Cloudflare proxy | Cloudflare (elaine/felipe) | self-signed | ziemel | ft | 02/Oct/2026 | 36 | 0 |
| fund | chat.theupsidefunding.com | broken, no traffic | this box, direct | Cloudflare (elinore/ruben) | LE | ziemel | fund | 02/Oct/2026 | 32 | 0 |
| gene | chat.generalfx.io | broken, no traffic | Cloudflare proxy | Cloudflare (mina/ned) | snakeoil (expired 2024) | ziemel | gene | 02/Oct/2026 | 64 | 0 |
| ibullcapital | chat.ibullcapital.com | broken, no traffic | this box, direct | domaincontrol.com | LE | 172.104.179.247 | ibullcapital_chat | 02/Oct/2026 | 52 | 0 |
| mainetfunded | chat.mainetfunded.com | broken, no traffic | Cloudflare proxy | Cloudflare (betty/hans) | snakeoil (expired 2024) | ziemel | mainetfunded | 02/Oct/2026 | 32 | 0 |
| mbfx | chat.mbfx.co | broken, no traffic | Cloudflare proxy (vhost disabled) | Cloudflare (marjory/ray) | LE | ziemel | mbfx_chat | 20/Mar/2024 | 5948 | 38 |
| mi | chat.masadamarkets.com | broken, no traffic | Cloudflare proxy | Cloudflare (chance/paris) | none (HTTP only) | ziemel | mi | 16/Sep/2026 | 84 | 0 |
| monkeyforex | chat.monkeyforex.net | broken, no traffic | this box, direct | Cloudflare (ariella/jeff) | LE | ziemel | monkeyforex | 02/Oct/2026 | 56 | 0 |
| onebidasset | chat.onebidasset.com | broken, no traffic | Cloudflare proxy | Cloudflare (agustin/dorthy) | LE | 172.104.179.247 | onebidasset_chat | 25/Dec/2025 | 160 | 0 |
| onfon | chat.onfin.group | broken, no traffic | this box, direct | gandi.net | LE | ziemel | onfin | 02/Oct/2026 | 32 | 0 |
| pat | chat.paidtotrade.net | broken, no traffic | Cloudflare proxy | Cloudflare (olga/rudy) | none (HTTP only) | ziemel | pat | 02/Oct/2026 | 32 | 0 |
| propfirmcapital | chat.propfirmcapital.com | broken, no traffic | Cloudflare proxy | Cloudflare (kaiser/sue) | none (HTTP only) | ziemel | propfirmcapital | 02/Oct/2026 | 32 | 0 |
| proptradacademy | chat.proptradingacademy.com | broken, no traffic | this box, direct | nsone.net | LE | ziemel | proptradacademy | 02/Oct/2026 | 32 | 0 |
| pst | chat.pip-street.com | broken, no traffic | this box, direct | bop4.uk | LE | ziemel | pst | 02/Oct/2026 | 36 | 0 |
| quicktrade | chat.quicktrade.co.za | broken, no traffic | Cloudflare proxy | Cloudflare (john/teresa) | snakeoil (expired 2024) | ziemel | turbotrade | 02/Oct/2026 | 32 | 0 |
| sto | chat.2sto.net | broken, no traffic | this box, direct | Cloudflare (marjory/noah) | LE | ziemel | sto | 02/Oct/2026 | 60 | 0 |
| tf | chat.tigerfunded.com | broken, no traffic | this box, direct | siteground.net | LE | ziemel | tf | 02/Oct/2026 | 56 | 0 |
| uniborsa | chat.uniborsa.com | broken, no traffic | this box, direct | domaincontrol.com | LE | 172.104.179.247 | uniborsa_chat | 02/Oct/2026 | 40 | 0 |
| vm | chat.virtualmarkets.com | broken, no traffic | this box, direct | registrar-servers.com | LE | ziemel | vm | 02/Oct/2026 | 32 | 0 |
| xfin | chat.x-fine.live | broken, no traffic | this box, direct | Cloudflare (sloan/weston) | LE | ziemel | xfin | 02/Oct/2026 | 468 | 2 |
| xfintr8 | chat.tr8center.com | broken, no traffic | this box, direct | beget.com | LE | ziemel | xfintr8 | 02/Oct/2026 | 60 | 0 |
| zen | chat.zentrobrokerage.com | broken, no traffic | this box, direct | domaincontrol.com | LE | ziemel | zen | 02/Oct/2026 | 36 | 0 |
| 5rf | - | not installed | elsewhere (-) | - | - | not installed | - | - | 4 | 0 |
| axisby | chat.axisby.com | not installed | no record | Cloudflare (damiete/ryleigh) | LE | not installed | - | 28/May/2025 | 20 | 0 |
| bldemochat | bl-demo-chat.kenmorefx.com | not installed | Cloudflare proxy | Cloudflare (karina/micah) | snakeoil (expired 2024) | not installed | - | 01/Sep/2026 | 20 | 0 |
| el | chat.thebestprop.com | not installed | Cloudflare proxy | Cloudflare (thomas/virginia) | self-signed | not installed | - | - | 24 | 0 |
| finestock | chat.fine-stock.com | not installed | Cloudflare proxy | Cloudflare (harleigh/tosana) | none (HTTP only) | not installed | - | 29/Sep/2026 | 20 | 0 |
| inzo | my.inzo.co | static page | Cloudflare proxy | Cloudflare (clayton/mckenzie) | LE | not installed | - | 27/Sep/2023 | - | 0 |
| josaimarkets | chat.josaimarkets.com | not installed | this box, direct | Cloudflare (dana/ricardo) | LE | not installed | - | 02/Oct/2026 | 20 | 0 |
| ntc | chat.kubera-global.com | not installed | no record | - | LE | not installed | - | 25/Dec/2025 | 20 | 0 |
| perfectlions | chat.perfectlions.com | not installed | no record | - | none (HTTP only) | not installed | - | 10/May/2025 | 20 | 0 |
| praxisdigital | chat.praxisdigitaltrading.com | not installed | this box, direct | whois.com | LE | not installed | - | 02/Oct/2026 | 20 | 0 |
| switzprime | chat.switzprime.com | not installed | no record | - | LE | not installed | - | 26/Sep/2023 | 20 | 0 |
| thau | chat.thaurus.com | not installed | this box, direct | registrar-servers.com | LE | not installed | - | 02/Oct/2026 | 20 | 0 |
| agramarkets | chat.agramarkets.com | dead | no record | Cloudflare (damian/joselyn) | LE | ziemel | agramarkets_chat | 28/Aug/2023 | 60 | 0 |
| allstarstrader | chat.allstarstrader.com | dead | no record | Cloudflare (bjorn/connie) | LE | ziemel | vitamarkets_chat | 20/Jun/2026 | 56 | 0 |
| alphacompany | chat.4rex.world | dead | no record | - | LE | 172.104.179.247 | alpha_chat | 09/Mar/2022 | 56 | 0 |
| atlantacapital | chat.atlantacapitalmarkets.com | dead | no record | - | snakeoil (expired 2024) | ziemel | atlantacapital | 02/Sep/2026 | 56 | 0 |
| betailcapital | chat.betailcapital.com | dead | elsewhere (traff-https.hugedomains.com) | amazonaws.com | LE | 172.104.179.247 | betail_chat | 28/May/2025 | 56 | 0 |
| bullfunded | chat.bullfunded.com | dead | no record | Cloudflare (beth/jeff) | none (HTTP only) | ziemel | bullfunded | 24/Sep/2026 | 32 | 0 |
| cacespiciffx | chat.cacespiciffx.com | dead | no record | - | LE | ziemel | cacespicif_chat | 28/May/2025 | 32 | 0 |
| castlerock | chat.castlerockfx.com | dead | no record | - | LE | ziemel | castlerock_chat | 21/Nov/2021 | 56 | 0 |
| cawada | chat.cawada.com | dead | no record | - | LE | ziemel | cawada_chat | 23/Jan/2024 | 68 | 0 |
| colossus | chat.colossussecurities.com | dead | no record | namecheaphosting.com | LE | 136.244.89.111 | chat | 28/May/2025 | 44 | 0 |
| comet | chat.cometforex.com | dead | no record | - | LE | ziemel | cometforex_chat | 08/Aug/2021 | 56 | 0 |
| commo | chat.commot.asia | dead | no record | - | LE | 172.104.179.247 | commot_chat | 08/Nov/2024 | 56 | 0 |
| crmarkets | chat.crmarkets.co | dead | no record | - | none (HTTP only) | ziemel | crmarkets_chat | 25/Feb/2023 | 280 | 2 |
| daiocapital | chat.daiocapital.com | dead | no record | registrar-servers.com | LE | ziemel | daiocapital_chat | 20/Jun/2026 | 104 | 0 |
| deltafx | chat.deltafx.com | dead | no record | Cloudflare (alec/princess) | LE | 172.104.179.247 | deltafx_chat | 23/Aug/2026 | 32 | 0 |
| flom | chat.florencemarkets.com | dead | no record | - | LE | ziemel | flom | 20/Jun/2026 | 56 | 0 |
| fofxtrading | chat.fofxtrading.com | dead | no record | - | none (HTTP only) | ziemel | fofxtrading_chat | 12/Sep/2024 | 32 | 0 |
| fundednation | chat.fundednation.com | dead | no record | Cloudflare (kim/lamar) | none (HTTP only) | ziemel | fundednation_chat | 08/Aug/2025 | 56 | 0 |
| fundedpeaks | chat.fundedpeaks.com | dead | no record | Cloudflare (javon/leia) | client-supplied | ziemel | fundedpeaks | 05/Aug/2025 | 32 | 0 |
| glanzfx | chat.glanzfx.net | dead | no record | - | LE | ziemel | glanzfx_chat | 22/Nov/2022 | 32 | 0 |
| grandpointmarkets | chat.grandpointcapital.co.za | dead | no record | domaincontrol.com | LE | ziemel | grandpoint_chat | 06/Mar/2021 | 32 | 0 |
| gsforex | chat.gsforex.com | dead | elsewhere (traff-https.hugedomains.com) (vhost disabled) | amazonaws.com | none (HTTP only) | ziemel | gsforex_chat | 17/Oct/2023 | 56 | 0 |
| igl | chat.itrader.global | dead | no record | Cloudflare (adele/armfazh) | LE | ziemel | igl | 25/Jun/2026 | 32 | 0 |
| indexsecurities | chat.index-securities.com | dead | no record | - | LE | ziemel | indexsec_chat | 23/Jan/2025 | 32 | 0 |
| jettrade | chat.cdi.group | dead | no record | - | LE | ziemel | jettrade_chat | 31/Dec/2025 | 56 | 0 |
| khprime | chat.khprime.com | dead | no record | nsone.net | LE | 172.104.179.247 | khprime_chat | 28/Feb/2023 | 32 | 0 |
| lariox | chat.lariox.com | dead | elsewhere (76.223.54.146) | afternic.com | none (HTTP only) | 172.104.179.247 | lariox_chat | 31/Jan/2023 | 56 | 0 |
| lineupfx | chat.lineupfx.com | dead | no record | googledomains.com | LE | ziemel | lineupfx_chat | 09/Jun/2024 | 56 | 0 |
| magellanmarkets | chat.magellanmarkets.com | dead | no record | dns-parking.com | LE | ziemel | magellan_chat | 21/Jun/2026 | 56 | 0 |
| medbondforex | chat.medbondforex.com | dead | no record | - | LE | ziemel | medbondforex_chat | 25/Jul/2021 | 1432 | 1 |
| mindshift | chat.fxms.fund | dead | no record | - | LE | ziemel | mindshift_chat | 20/Jan/2025 | 32 | 0 |
| mintxmarkets | chat.mintxmarkets.com | dead | elsewhere (13.223.25.84) | namebrightdns.com | LE | ziemel | mintxmarkets_chat | 25/Dec/2025 | 32 | 0 |
| monyxa | chat.monyxa.com | dead | no record | - | client-supplied | 172.104.179.247 | monyxa_chat | 10/Oct/2022 | 240 | 1 |
| mthub | chat.mthub.io | dead | no record | Cloudflare (mitch/olga) | none (HTTP only) | ziemel | mthub_chat | 24/May/2022 | 56 | 0 |
| myfundedtrade | chat.myfundedtrade.com | dead | no record | - | LE | ziemel | myfundedtrade_chat | 22/Jun/2026 | 32 | 0 |
| nf | chat.funded.nexus | dead | no record | - | none (HTTP only) | ziemel | nf | 21/Jul/2025 | 32 | 0 |
| nostrotrading | chat.nostrotrading.co.uk | dead | no record | nic.uk | LE | ziemel | nostrotrading_chat | 22/Jun/2026 | 56 | 0 |
| perfectlion | chat.perfect-lion-limited.com | dead | no record | - | none (HTTP only) | ziemel | perfectlion_chat | 30/Jul/2024 | 32 | 0 |
| perfectmarkets | chat.perfect-markets.com | dead | no record | - | none (HTTP only) | ziemel | perfectmarkets_chat | 14/Feb/2023 | 32 | 0 |
| pipslots | chat.pipsandlots.com | dead | no record | - | none (HTTP only) | ziemel | pipslots_chat | 30/May/2025 | 32 | 0 |
| plioninvest | chat.plioninvest.com | dead | no record | - | none (HTTP only) | ziemel | plioinvest_chat | 17/Jul/2023 | 32 | 0 |
| pointblankcap | chat.pointblankcap.com | dead | no record | - | LE | ziemel | pointblankcap_chat | 22/Apr/2024 | 160 | 1 |
| profundingfx | chat.profundingfx.com | dead | no record | - | LE | ziemel | profunding_chat | 20/Jun/2026 | 32 | 0 |
| propfirm | chat.propfirm.com | dead | no record | Cloudflare (chip/raegan) | LE | ziemel | propfirm | 01/May/2024 | 32 | 0 |
| propfirma | chat.propfirma.com | dead | no record (vhost disabled) | Cloudflare (jeff/melina) | none (HTTP only) | ziemel | propfirma | 28/Nov/2023 | 32 | 0 |
| rfi4x | chat.rfi4x.com | dead | no record | - | LE | 172.104.179.247 | rfi4x_chat | 28/May/2025 | 32 | 0 |
| rpffx | chat.rpffx.com | dead | no record | domaincontrol.com | LE | ziemel | rpffx_chat | 21/Jun/2026 | 56 | 0 |
| rut | chat.ruthe1.com | dead | no record | domaincontrol.com | LE | ziemel | rut | 08/Jun/2026 | 6712 | 27 |
| sapphiremarkets | chat.sapphiremarkets.com | dead | no record | - | none (HTTP only) | ziemel | sapphiremarkets_chat | 05/Mar/2026 | 56 | 0 |
| skyequity | chat.skyequity.co | dead | no record | - | none (HTTP only) | ziemel | skyequity_chat | - | 56 | 0 |
| tradersedgefx | chat.tradersedgefx.com | dead | no record | domaincontrol.com | LE | ziemel | tradersedgefx | 20/Jun/2026 | 188 | 0 |
| tradersplanetfunds | chat.tradersplanetfunds.com | dead | no record | - | LE | ziemel | tradersplanetfunds_chat | 21/Jun/2026 | 56 | 0 |
| traumfx | chat.traumfx.com | dead | no record | - | none (HTTP only) | ziemel | traumfx_chat | 02/Jun/2023 | 44 | 0 |
| vonway | chat.vonwayforex.com | dead | no record | bunny.net | LE | ziemel | vonway_chat | 09/Apr/2021 | 18480 | 84 |
| worldfinanceinvest | chat.worldfinanceinvest.com | dead | no record | - | LE | ziemel | wrldfinvst_chat | 20/Jun/2026 | 32 | 0 |
| xpgmarkets | chat.xpgmarkets.com | dead | no record | namecheaphosting.com | LE | 172.104.179.247 | xpgmarkets_chat | 20/Jun/2026 | 32 | 0 |
