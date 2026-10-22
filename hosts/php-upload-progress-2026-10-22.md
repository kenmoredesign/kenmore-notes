# session.upload_progress.enabled = 0 on every PHP host

2026-10-22. Requested because of a newly disclosed PHP vulnerability. **PHP itself is
not updated.** Only this one ini setting changes.

## State before (read-only survey, 2026-10-22)

| Host | PHP-FPM serving sites | Value | Overrides found |
|---|---|---|---|
| wp-eu | 8.5.4 (alverix, zentro, default), 7.4.33 (the 8 `lc-*` livechat pools) | On (default, commented out in both php.ini) | none |
| wp-asia | 8.5 (8itrade.com, rforex.trade, www) | On | none in pools. Site trees are unreadable to claude, so `.user.ini` there is only checked when the script runs as root |
| kd-site | 8.3.6 (demos, premium, www), 8.1 (www) | On | none. No `.user.ini`/`php.ini` under `/var/www` |
| matrix | no PHP | | |
| livechat-old | decommissioned (user, 2026-10-22), out of scope | | |

kd-site also has `libapache2-mod-php8.3` installed with `/etc/php/8.3/apache2`, but
apache2 is inactive, so it serves nothing and the script leaves it alone.

The setting is `PHP_INI_PERDIR`: php.ini, conf.d, pool `php_value`/`php_admin_value` or
`.user.ini` can set it, but `ini_set()` at runtime cannot.

## The change

Script: `~/ops/php/php-upload-progress-off`, installed as
`/usr/local/lib/kenmore-ops/php-upload-progress-off`, so claude can run it with sudo once
it's installed.

- No argument: preview. Lists the docroot and pool overrides, what would be written,
  the current `php-fpm -t`, and the exact undo per version.
- `--apply`: for each FPM version it backs up an existing drop-in, writes
  `/etc/php/<v>/fpm/conf.d/99-kenmore-upload-progress.ini` (`session.upload_progress.enabled = 0`),
  runs `php-fpm<v> -t`, then `systemctl reload php<v>-fpm` (graceful), and checks
  `php-fpm<v> -i` shows Off. If `-t` fails, the drop-in is put back as it was and
  nothing is reloaded. The first failure stops the run. The log and any backups go to
  `/var/backups/kenmore-ops/php-upload-progress-<date>/`.
- Undo per version: `rm /etc/php/<v>/fpm/conf.d/99-kenmore-upload-progress.ini && php-fpm<v> -t --fpm-config /etc/php/<v>/fpm/php-fpm.conf && systemctl reload php<v>-fpm`.

Limits: `php-fpm -i` shows the value from the ini files, not from a running worker,
and doesn't see pool-level overrides. The script's pool scan covers pool overrides. A
`.user.ini` setting it back to On would override the drop-in within its own tree, and
the docroot scan reports those.

Tested 2026-10-22: preview run as claude (non-root) on all three hosts. It found the
expected versions, values On, and no overrides. Not yet installed or applied anywhere.

## Run log

(fill in per box: date, installed, preview output, apply output, verified value)
