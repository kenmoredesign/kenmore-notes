# kdsites: making the dev -> live deploy safe (2026-10-09, Phase 1)

Prepared only. Nothing was changed on kd-site; everything below was read as `claude` through the
`wp` wrapper, with option values compared by hash on the host and never printed.
Script and dry-run output: `~/ops/kdsites/deploy-dev-to-live.sh`, `deploy-dev-to-live.dry-run.txt`.
`refresh-dev-from-live.sh` was changed too (it now writes a refresh record, see section 2).

**Do not run the old `/var/www/html/kdsites/migrate-dev-to-live.sh` any more.** With dev as it
is since today's refresh it would remove GTM and Chatwoot from live (section 1).

## 1. Where live and dev differ on purpose, and what a deploy does to each today

"Today" is the old `migrate-dev-to-live.sh`. All 768 non-transient options were compared;
16 differ, and the ones not in this table are run-time counters and timestamps.

### In the database (a deploy replaces all of it with dev's)

| Setting | Live | Dev | Old script | New script |
|---|---|---|---|---|
| Site URL (`home`, `siteurl`, every URL in content) | www | dev | Rewritten to www after the import. Correct | Same |
| Search visibility (`blog_public`) | 1 | 0 | Forced to 1. Correct | Live keeps its own value |
| Site-wide head, body and footer code (`auhfc_settings_sitewide`: GTM-TZW9SC6J, which loads GA4, PostHog, Clarity and LinkedIn; Chatwoot) | 425 + 249 + 431 characters | empty | **Live's tags are emptied.** No analytics, no chat, and nothing reports it | Live keeps its three values |
| `broken-link-checker` | active | inactive | **Deactivated on live** | Activated again if it was active before |
| WP Rocket cache preload (`wp_rocket_settings` → `manual_preload`) | 1 | 0 | **Preload switched off on live** | Live keeps its value for this key; every other WP Rocket setting comes from dev |
| Cached SendPulse token (transient) | live's | dev's | dev's token is used on live for up to 55 minutes. Harmless while both use one account | Deleted on live; live requests its own |
| `acf_pro_license`, `wp_rocket_last_base_url` (each encodes the site's own URL), `fs_active_plugins` (holds an absolute path) | live's | dev's | dev's copies land on live; the plugins repair them later. Has happened on every deploy | Live keeps its own |
| `acf_pro_license_status` | live's | dev's | dev's lands on live | Not kept: ACF rewrites it every time WordPress loads (seen on dev: a new value after each load) |
| Scheduled jobs (`cron`) | 8,043 bytes | 7,142 bytes (no link-checker or preload jobs) | dev's schedule replaces live's | Still dev's; activating the link checker and restoring the preload setting put their jobs back. Will show as a difference in Phase 2 |
| Users | 6 | 7 | dev's users replace live's | Same, behind the guard (section 4) |
| Logins | | | dev's session tokens replace live's: everyone is logged out of live's wp-admin | Same |
| Lead log `leadlog_kenmore_sage` (no `wp_` prefix; 1 row) | on live | dev has `leadlog_kenmore_dev` (26 test rows) | Live's table survives, but dev's table is **imported into live's database** (the dump is dev's whole database), and the URL rewrite runs on `--all-tables`, so it **rewrites text inside live's lead log** | Only `wp_` tables are exported, dropped, imported and rewritten. The lead log's checksum is compared before and after |

The user difference is real and current: **`esteban` (administrator, id 7) was removed from live
after today's 11:52 refresh and is still on dev. A deploy today would create that administrator
on live again.**

### In files (a deploy mirrors dev's files to live with `--delete`)

| File or folder | Old script | New script |
|---|---|---|
| `wp-config.php` (database name, SendPulse pair, salts), `robots.txt`, `.htaccess`, `.user.ini` | Kept | Kept |
| `wp-content/advanced-cache.php` (WP Rocket, absolute paths) | **Overwritten with dev's**, wrong paths until WP Rocket rewrites it | Kept |
| `wp-content/cache/`, `uploads/cache/`, `uploads/elementor/css/`, `wp-rocket-config/` | Kept, then emptied | Same |
| `wp-content/backups-dup-lite/`, `wp-content/wflogs/` (live only; the refresh no longer copies them to dev) | **Deleted from live** (3 files) | Kept, with `updraft/` |
| `plugins/robin-image-optimizer/…/assets/cache/` (2 files that plugin generated on dev) | Copied to live | Not copied |

### Not in the database or the site tree, so no deploy touches them

`/etc/cron.d/wp-cron-kdsites` (live, every 5 minutes) and `wp-cron-kdsites-dev`; the nginx vhosts.

### Faults of the old script itself

- Live's database dump is written to `site/_restore_db_<date>.sql`, inside the docroot, for the
  length of the zip (62 seconds on 25 Sep).
- The maintenance flag is WP-CLI's, which WordPress ignores after 10 minutes.
- `DRY_RUN=1` still takes a 2.6 GB restore point. Nothing prints restore commands.
- Live's WP-cron job runs through WP-CLI, which ignores maintenance mode, so it can run on a
  half-imported database. It is the likely cause of the flag vanishing in today's refresh.
- It keeps the newest 8 restore points and deletes older ones.

## 2. How live keeps its values

**(a) The deploy puts live's values back after the import.** Works with what exists. Its weak
point is the list: a dev-only setting added to the refresh and forgotten in the deploy goes live.

**(b) Dev-only behaviour moved into code** (a must-use plugin that blanks the tags, forces
noindex and so on when it sees dev's database name). The database would then be the same on both
sides. Rejected: the plugin would run on live too; the settings screens on dev would show the
filtered values, so saving Head & Footer Code or Reading settings on dev would write the blanks
into the database, and the next deploy would carry them to live. It replaces a forgettable list
with a trap.

**Recommended and built: (a) with one list, kept by the refresh.** Every dev-only setting in
`refresh-dev-from-live.sh` now goes through one of three helpers (`dev_option`,
`dev_option_key`, `dev_plugin_off`). Each applies the setting to dev and writes a line to the
refresh record on kd-site. The deploy reads that record and keeps live's own value for every
line. A new dev-only setting is added in one place and the deploy follows by itself. After
putting the values back, the deploy compares each one with what it saved and stops, with live
still in maintenance mode, if any differs.

What this does not cover: a setting changed by hand in dev's wp-admin is content like any other
and is deployed.

The refresh record is `/var/backups/kenmore-ops/kdsites/refresh-record-<date>/`, named in the
file `last-refresh`: `time`, `dev-only` (the list), and `db` and `files` (section 4).

## 3. The new script

`deploy-dev-to-live.sh`: dry run by default, `--run` to execute, root only. It can be fed to
bash on stdin.

| Step | What | Live |
|---|---|---|
| 0 | Pre-flight and the guard. Read-only | up |
| 1 | Live's cron entry renamed to `wp-cron-kdsites.paused` (cron skips names with a dot), wait for a running job to end. Zip of live's files to `/var/backups/kenmore-ops/kdsites/live-restorepoint-<date>.zip`; live's `wp_` tables and, as a second file, its other tables dumped by root into the root-only work directory and added to the zip. **Backup checked:** each dump must end with mysqldump's closing line and hold one `CREATE TABLE` per table asked for; the zip must pass `unzip -t` (every entry read back, checksums compared) and list the dump, `wp-config.php` and `index.php` | up |
| 2 | Maintenance flag written by the script (holds until removed, written again before every step). Guard again | **down** |
| 3 | Live's own values saved; dev's `wp_` tables exported | down |
| 4 | Live's `wp_` tables dropped, dev's imported, URLs rewritten in `wp_` tables only | down |
| 5 | `rsync --delete` dev -> live, every changed file logged | down |
| 6 | Live's values put back and verified; lead log checksum verified; caches emptied; refresh record updated | down |
| 7 | Flag removed, cron entry back; home and login status, GTM and Chatwoot looked for in the home page | up |

- **Failure before step 4:** live is put back online unchanged.
- **The cron entry is put back on every exit path** (normal end, any failed step, interrupt),
  from one cleanup function. After a failure from step 4 on that means WP-cron runs again on a
  half-deployed live until it is restored; the owner chose that over an entry that stays paused
  unnoticed. Only a `kill -9` or a power cut can leave it paused, and the next run then refuses
  to start and names the file. `refresh-dev-from-live.sh` now pauses dev's entry
  (`wp-cron-kdsites-dev`) the same way.
- The database dump is taken with live still up (`--single-transaction`), up to about two
  minutes before the flag. The guard after the flag proves content, users and files did not
  change in between; a setting changed in wp-admin in that gap would not be in the backup.
- **Failure from step 4 on:** the script stops, live stays in maintenance mode, and the restore
  commands are printed with that run's file names. The same block is printed after a successful
  run, as the way to undo it. The restore imports the `wp_` tables only, so it never rolls the
  lead log back.
- **Nothing is pruned.** Each run adds about 2.6 GB. The disk has 16 GB free; the eight old
  restore points take 21 GB.
- No dump is ever written under a web root. The copy of dev's database in the work directory is
  removed when the script ends, however it ends.

Tested on the Ops box against stub commands (nothing on kd-site was run): a refresh followed by
a deploy, a second deploy with no refresh in between, and 18 failure cases: live changed since
the refresh, no record, live already in maintenance mode, failure of the zip, a truncated dump,
a dump lacking a table, a zip failing its integrity test, failure of the dev export, of reading
a live value, of the import, of the URL rewrite, of the plugin activation, a kept option or key
not coming back, the lead log changing, a missing tag, an interrupt before and a TERM after the
point of no return. In each case live's flag, both cron entries and the list of write commands
issued were as described. The refresh was run through five failure cases for its cron entry.

### The save, verify and restore statements on real MySQL (dev's database only, 16:54 UTC)

Run as `claude` through the `wp` wrapper against `kenmore_dev` (MySQL 8.0.46), with a scratch
option `deploykeep_selftest` holding quotes, a backslash, an emoji and serialized text. Nothing
on live. Scratch option and table removed afterwards; dev has 939 options as before, home 200.

| Statement | Result |
|---|---|
| `DROP TABLE IF EXISTS`, `CREATE TABLE deploykeep_options AS SELECT …` | ok, 6 rows, columns copied with their collation |
| Verify count straight after the save | 0 |
| Scratch option changed (value and autoload), verify | counted it |
| `UPDATE … JOIN` | value and autoload back, verify 0 |
| Scratch option deleted, verify, then `UPDATE` and `INSERT … SELECT … LEFT JOIN` | counted it; row inserted, verify 0; WordPress reads the original value back byte for byte |
| `CHECKSUM TABLE leadlog_kenmore_dev`, twice | identical |
| Table lists | 59 prefixed; others: the lead log (and the keep table, which the script filters out) |
| Export of the 59 tables | last line `-- Dump completed on …`, 59 `CREATE TABLE` lines |
| Key save and restore (`option pluck`, `option patch update`, pluck again) | identical for all four keys |

Two faults found by this test, both of which would have stopped a real deploy after the point
of no return, both fixed:

1. **`wp option patch update` treats a value of `0` on stdin as no value** and fails. Live's
   preload value is 1, so tomorrow's run would have passed, but any kept key that is 0 on live
   would have failed. The value is now passed as an argument; tested on dev with 0, an empty
   string, 1 and a script tag with quotes.
2. **`acf_pro_license_status` changes every time WordPress loads.** The verify counted it as a
   kept option that had not come back. It is no longer kept, and the kept options are now
   verified straight after the restore, before any command that loads WordPress.

Side effect on dev: the `UPDATE` wrote `acf_pro_license_status` back to the value saved seconds
earlier; ACF has rewritten it on every load since.

Still not run for real: the whole script in order, against live. That is Phase 2.

## 4. The guard

It answers one question: is live still what dev was copied from? The refresh stores two
things about live; the deploy computes them again, before anything is touched and once more
when live is in maintenance mode, and stops on any difference, showing it.

| Checked | How | Catches |
|---|---|---|
| Posts (`wp_posts`: pages, posts, media, menus, revisions, templates) | row count, highest ID, newest modification time. Auto-drafts and oEmbed cache rows left out | anything added, edited or deleted in content |
| Users | count, and a checksum over ID, login, email and password hash | a user added or removed, a changed password or email |
| Comments | count, highest ID | new comments (there are none today) |
| Terms | row counts of the three term tables | categories, tags, menus added or removed |
| Files a deploy would overwrite or delete (30,843) | path, size, modification time | a plugin updated or removed on live, a file uploaded or edited |

**Not checked:** settings changed in live's wp-admin (options have no timestamp), redirects and
other plugin tables, a term renamed without a count change. The lead log is not part of it; it
is never overwritten.

Today the guard would stop a deploy on two counts: the user (6 now, 7 at the refresh) and
`actions.php` (fix 1, installed on live at 13:53).

The values did not move by themselves in three samples over ten minutes and two cron runs.
That is a short watch. If the guard stops on something that is not a real change, it stops
before live is touched.

After a successful deploy the record is updated to live's new state, so a second deploy without
a refresh in between is not blocked.

## 5. Time in maintenance mode

**About 3 minutes.** The 25 Sep run of the old script kept live down for 3 min 37 s: zip 62 s,
import 26 s, URL rewrite 113 s, file sync 5 s. The new script takes the zip, the dump and the
backup check before the flag goes up and adds roughly 30 seconds of saving, restoring and
verifying. The log states the measured
time at the end.

During that time every page and every form submission gets WordPress's 503 page. A lead sent in
those minutes is not delivered and not logged.

## 6. Phase 2, as planned

1. Before: as `claude`, snapshot live (file hashes, row count per table, options by hash,
   active plugins, the snippet option, WP Rocket settings, `blog_public`, page source markers).
2. Root window: `refresh-dev-from-live.sh --run`, then `deploy-dev-to-live.sh --run`. Allow 30
   minutes. A script that needs changing mid-window means stop and ask.
3. After: the same snapshot, a diff, page and login checks, one TEST lead through live's form.

Differences to expect from an empty deploy, known now:

- `cron`, transients, `recently_activated`, session tokens, Duplicator and Action Scheduler
  timestamps, option and row IDs.
- `optml_settings` and `termly_website` on live contain the dev host name (leftovers of removed
  plugins); the URL rewrite may change them.
- Row counts in tables that live writes to by itself (redirect logs, WP Rocket, Yoast).
- The refresh will remove `esteban` from dev, since dev becomes a copy of live.
