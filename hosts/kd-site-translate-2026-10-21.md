# kd-site: kenmore-translate stopped, and the deploy of 2026-10-21

What broke translations on kenmoredesign.com, what this morning's deploy did to live, and how both
were put right on 2026-10-21. All times UTC. Scripts are in `~/ops/kdsites/`.

## 1. Why new posts were not translated

- **Cause: OpenAI rejected the plugin's API key.** `kt_api_key` (one OpenAI project key, last 4
  `FiEA`, same on live and dev) answered `HTTP 401 invalid_api_key` to a live `GET /v1/models` from
  kd-site. That is a revoked or deleted key; an empty balance would be `429 insufficient_quota`.
  Who revoked it and when is not recorded here (OpenAI dashboard). It had been exposed: it is in
  every database dump, including those downloadable by IP until 2026-10-08.
- Last successful translation on either site: 2026-09-24 10:55. The first posts after that were
  19316 `ib-to-white-label-partner` and 19317 `how-to-pay-forex-ib-commissions`, written by denis
  in the block editor on dev and published 2026-10-16 05:53. The publish hook fired and the first
  API call failed 2 s later. Every attempt since, on both sites, is the same 401
  (post meta `_kt_error_<lang>`, and `/var/log/wp-cron-kdsites{,-dev}.log`).
- **Not the cause:** plugin active, 1.7.37, files identical on live and dev and unchanged since
  2026-06-30; `DISABLE_WP_CRON` plus the system cron entries work; Action Scheduler runs the jobs
  within seconds (they show "complete" because the plugin records the 401 and returns); outbound
  HTTPS fine; no HTTP-blocking constants.
- **The plugin uses OpenAI, not DeepSeek.** Provider `openai`, model `gpt-5.4-mini`, no fallback:
  the code calls one provider. No DeepSeek key exists on either site. Endpoint, model and key are
  plain options (`kt_endpoint`, `kt_model`, `kt_api_key`), so a provider change is a settings
  change. The HTTP timeout is fixed at 120 s in the code (`deepseek_request()`).
- **The plugin is not in git.** Only copies: the two site trees and the backups.

**Fixed:** new OpenAI key (last 4 `5-QA`), set on dev at 13:48 through stdin
(`wp option update kt_api_key` with no value argument), so it is in no command line or log. It
reached live with the deploy. Tested from kd-site: `/v1/models` 200, a chat completion with
`response_format: json_object` 200 in 1.7 s. Codex LB is still the plan for a later session
(chat-completions URL would be `http://100.85.194.92:2455/v1/chat/completions`; the route exists
and wants `Authorization: Bearer`).

## 2. What this morning's deploy did to live

At 10:46 the old `/var/www/html/kdsites/migrate-dev-to-live.sh` was run (live in maintenance
10:46 to 10:49; restore point `live-restorepoint-2026-10-21_104600.zip`). As the 2026-10-09 notes
warned, it copied dev's settings over live's:

- site-wide head, body and footer code emptied: **no GTM (GA4, PostHog, Clarity, LinkedIn) and no
  Chatwoot on live from 10:49 to 13:34**;
- WP Rocket preload off, `broken-link-checker` deactivated;
- dev's `acf_pro_license`, `wp_rocket_last_base_url`, `fs_active_plugins` on live;
- dev's `leadlog_kenmore_dev` (26 test leads) imported into live's database. Live's own lead log
  `leadlog_kenmore_sage` was not dropped (`wp db clean` only drops prefixed tables).

Not damaged: `advanced-cache.php` (WP Rocket rewrote it with live's paths at 10:54),
`wflogs/` and `backups-dup-lite/` (same files as in the restore point), users.

At 10:55 the two posts were updated on live in the editor. Compared with dev, the only change was
the dev-to-www URL rewrite in image links, so the later deploy lost nothing.

## 3. What was done (root window 13:18 to 14:50)

| Time | Step | Result |
|---|---|---|
| 13:02 | dev backed up as claude: `~claude/kt-backup-20261021/` on kd-site (dir 700, files 600) | DB dump, `kt_*` options, plugin tarball |
| 13:21 | `restore-live-settings.sh --run`, first attempt | **Stopped silently in step 1, live unchanged.** awk left the dump early, unzip died of SIGPIPE (141), `pipefail` + `set -e` ended the script with no message. Fixed (awk reads the whole dump; an ERR trap now logs) and run again with approval |
| 13:34 | `restore-live-settings.sh --run` | Live's values from the 10:46 restore point back: the four options match it byte for byte, `manual_preload=1`, link checker active, page caches emptied. Home page has GTM-TZW9SC6J and the chat widget again |
| 13:35 to 13:39 | `refresh-dev-from-live.sh --run` | Dry run identical to the committed one. dev 4 min in maintenance. New record `refresh-record-2026-10-21_133514`. Needed because the deploy guard compares live with the last refresh record, and the morning run had changed live |
| 13:48 | new key set on dev | see section 1 |
| 13:50 to 14:01 | 19316 and 19317 updated on dev (publish to publish fires the hook), queue run with `wp action-scheduler run --group=kenmore-translate` | 22 jobs, all complete, no errors. 11 languages each: ar es fa fr he ja ko ku ru tr zh |
| 14:08 | **slugs fixed** (see section 4) | |
| 14:10 to 14:22 | `deploy-dev-to-live.sh --run` | Dry run unchanged from the one at 13:52. Waited 7 min for a running live cron job (most likely the link checker's first run after reactivation). Both guards passed. Live 177 s in maintenance. Kept values verified; lead log unchanged; home and login 200; both markers present |
| 14:23 | `leadlog_kenmore_dev` dumped to `/var/backups/kenmore-ops/kdsites/leadlog_kenmore_dev-from-live-2026-10-21.sql` (600, 26 rows), then dropped from live | `leadlog_kenmore_sage` checksum unchanged (1595802412) |
| 14:23 | old script retired: `/var/www/html/kdsites/migrate-dev-to-live.sh.retired`, mode 444 | |

Also: the 10:46 restore point was written mode 644 by the old script; now 600.

**Verified on www after the deploy:** `kt_api_key` last 4 `5-QA`; both posts have 11 published
translations sharing the English slug; on both English pages the language switcher has 11 links,
each 200 with the right `<html lang>`; head/body/footer code 425/249/431 characters as before the
morning run; `manual_preload=1`; `blog_public=1`; `broken-link-checker` active.

## 4. New translations get suffixed slugs (open)

The 22 new posts were created with `ib-to-white-label-partner-2` … `-12`. Every older translation
shares the English slug, which is what the **Polylang Slug** plugin (0.2.3) provides and what the
translate plugin expects (`'post_name' => $post->post_name` on insert, comment: "else WP adds -2").
With the suffixes, `/fr/2026/10/16/ib-to-white-label-partner/` 301s to the English post and the
switcher links to the `-N` URLs.

Fixed on dev before the deploy with the plugin's own "Fix slugs" job
(`wp action-scheduler action create kt_fix_slugs_batch now --args='[[19316,19317]]'
--group=kenmore-translate`, then `wp action-scheduler run --hooks=kt_fix_slugs_batch`): all 22 came
back to the shared slug at once, so Polylang Slug works on update, not on insert. Then
`wp cache flush` and `wp rewrite flush`.

**Still open (separate task):** Polylang auto-updated 3.8.10 to 3.9.0 on 2026-10-19 23:12 (dev,
reached live with the morning run). Suspected: Polylang Slug 0.2.3 no longer hooks in when
the translate plugin inserts a post under 3.9.0. Not proven. Until fixed, **every new translation
needs "Fix slugs" afterwards**. Also to do: turn off auto-updates for Polylang.

## 5. Undo and what was left

- **Deploy:** backup `/var/backups/kenmore-ops/kdsites/live-restorepoint-2026-10-21_141005.zip`;
  restore commands at the end of `deploy-2026-10-21_141005.log` in the same folder.
- **Settings restore:** live's values from before 13:34 are in `kdrestore_prev_options` (live's
  database, no prefix; the deploy leaves such tables alone). Undo commands at the end of
  `restore-settings-2026-10-21_133438.log`. Drop `kdrestore_prev_options` and
  `kdrestore_rp_options` once no longer needed.
- **Key:** the old (revoked) key is in `~claude/kt-backup-20261021/dev-kt_api_key-before.txt`; it
  is no rollback, it does not work. The DB dumps in that folder hold the new key; delete the
  folder when done.
- Scripts and console logs of the root window: `/root/kdsites-run/2026-10-21/`.
- **`/var/www/html/kdsites/readme.txt` was the source of the morning's mistake:** it told people to
  run `migrate-dev-to-live.sh`. Rewritten at 14:36 (old copy:
  `/var/backups/kenmore-ops/kdsites/readme.txt.bak-2026-10-21`): refresh before working on dev,
  nobody edits www until the deploy, deploy with `deploy-dev-to-live.sh`, what to do if the guard
  stops it, "Fix translated slugs" after translating, and the settings restore. The three
  scripts are now installed next to it (root 644, run with `sudo bash`, same checksums as ops
  `de97999`), and both dry runs work from there. The readme is kept in ops as `kdsites/readme.txt`.
  `migrate-dev-to-live.OLD` is still next to it, unchanged; the readme says not to use it.
