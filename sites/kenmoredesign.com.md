# kenmoredesign.com

Company site on kd-site: live `kdsites/site` (DB `kenmore_sage`), staging `dev.kenmoredesign.com`
`kdsites/dev` (DB `kenmore_dev`). Host details in `hosts/kd-site.md`.

## Workflow
Content is edited and translated on dev, then deployed: `~/ops/kdsites/refresh-dev-from-live.sh`
(live to dev, writes the refresh record) and `~/ops/kdsites/deploy-dev-to-live.sh` (dev to live;
refuses if live changed since the last refresh, and live keeps its own analytics/chat code, WP Rocket
preload, link checker, search visibility and three license/path options). Run both as root, dry run
first. Do not edit live between a refresh and the deploy. The old `migrate-dev-to-live.sh` is
retired (2026-10-21). `~/ops/kdsites/restore-live-settings.sh` puts live's own settings back from
a restore point if a deploy ever copies dev's over them.

## Translation (kenmore-translate 1.7.37 + Polylang 3.9.0 + Polylang Slug 0.2.3)
- English source, 11 targets: ar es fa fr he ja ko ku ru tr zh. Publishing or updating an English
  post queues one Action Scheduler job per language (group `kenmore-translate`); system cron runs
  the queue every 5 minutes (`DISABLE_WP_CRON` is set). `wp action-scheduler run
  --group=kenmore-translate` runs it at once.
- Provider: OpenAI, model `gpt-5.4-mini`, key in option `kt_api_key` (database, so in every dump
  and carried to live by the deploy). Key replaced 2026-10-21 (last 4 `5-QA`) after the old one
  was revoked. Set a key through stdin: `wp option update kt_api_key` with no value argument.
- Failures are silent on the front end: see post meta `_kt_error_<lang>`, the cron logs
  `/var/log/wp-cron-kdsites{,-dev}.log`, or the plugin's settings page.
- **Open (2026-10-21):** new translations are created with `-2`…`-12` slugs; run the plugin's
  "Fix slugs" for the source post afterwards. Cause under investigation (Polylang Slug vs
  Polylang 3.9.0). Details: `hosts/kd-site-translate-2026-10-21.md`.
- **Next (planned):** provider switch to Codex LB on Jenny, settings only. See section 6 of
  `hosts/kd-site-translate-2026-10-21.md`.
