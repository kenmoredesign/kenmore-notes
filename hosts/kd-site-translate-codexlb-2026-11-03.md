# kenmore-translate on dev: codex-lb provider (2026-11-03)

Dev only (dev.kenmoredesign.com, `kdsites/dev`). www untouched, no deploy run.
Patch, test payload and this summary's source: ops `wordpress/kenmore-translate-codexlb/`.

## Why
OpenAI (the dev provider, `gpt-5.4-mini`) was returning 429 "no credits remaining".
codex-lb is Alex's self-hosted, OpenAI-compatible relay on Jenny, published with
`tailscale serve` at `https://jenny.tail768f53.ts.net` (tailnet only, port 2455 behind
serve). kd-site reaches it: it's on the tailnet (100.83.106.39), MagicDNS resolves jenny to
100.85.194.92, and `/v1/models` without a key returns 401.

## What was there (1.7.37)
- One provider at a time: `kt_provider` (`deepseek` default | `openai`), one key
  `kt_api_key`, optional `kt_endpoint` (full `/chat/completions` URL override),
  `kt_model`. **There is no DeepSeek fallback**: a job retries the same endpoint
  (`kt_max_retries`, 2 on dev) and then fails. The plugin stores no DeepSeek key.
- Body: `{model, messages, response_format:{type:json_object}, stream:false}`;
  `temperature: 1.3` only for DeepSeek; no `max_tokens`; timeout 120s.

## What changed (1.7.38, `kenmore-translate.php` only)
- Provider dropdown gains `codexlb` ("codex-lb (self-hosted)").
- New options, used only when Provider = codexlb: `kt_codexlb_endpoint` (default
  `https://jenny.tail768f53.ts.net/v1/chat/completions`), `kt_codexlb_model` (default
  `gpt-6.1-terra`, the only model the key lists), `kt_codexlb_key` (Alex entered it).
  `kt_api_key`, `kt_endpoint` and `kt_model` are untouched (OpenAI key still stored,
  `kt_model` still `gpt-5.4-mini`).
- `api_key()`/`api_model()` resolvers; the worker and "Test API connection" use them.
- For codexlb only, `response_format` is omitted: codex-lb answers HTTP 400 "Response
  input messages must contain the word 'json' in some form to use 'text.format' of
  type 'json_object'" (it passes the system prompt upstream as instructions, and the
  user message `{"items":[…]}` has no "json"). Without it the model still returned
  clean, parseable JSON (3/3 curl runs, ~2s each), and the worker already retries
  unparseable replies. No temperature is sent, as for OpenAI.
- Dev settings now: `kt_provider` = `codexlb`.
- Gotcha: "Test API connection" prints the first 7 and last 4 characters of the active
  key. Don't run it where output is shared.

## Test
- Raw curl from kd-site with the plugin's exact payload shape (French system prompt
  from `translate_text_runs()`, two items, see `test-payload-fr.json`). The key is
  read through the wrapper into a mode-600 header file, never on the command line:

  ```
  H=$(mktemp ~/.kt-hdr.XXXXXX); chmod 600 $H; trap 'rm -f $H' EXIT
  printf 'Authorization: Bearer %s\n' "$(sudo /usr/local/lib/kenmore-ops/wp dev option get kt_codexlb_key | tr -d '\n')" > $H
  curl -sS -H @$H https://jenny.tail768f53.ts.net/v1/models
  curl -sS -H @$H -H 'Content-Type: application/json' --data-binary @test-payload-fr.json \
    https://jenny.tail768f53.ts.net/v1/chat/completions
  ```
- Real job: `action-scheduler action create kt_translate_post async --args='[6617,"fr"]'
  --group=kenmore-translate` → action 376978, run by ID, complete in 15s, no
  `_kt_error_fr`. 6617 "MT4 Manager for Prop Firms" → fr 10506 (rewritten 23:05:05 UTC,
  slug unchanged, no `-2`), `/fr/support-guides/mt4-manager-for-prop-firms/` 200. Both
  pages are password-protected (10506 was already), so screenshots show the password
  form. Screenshots: `/srv/incoming/kenmoredesign/review/kt-codexlb-20261103/`.
- No fallback test: there is no fallback (Alex, 2026-11-03: codex-lb is the only
  provider, none to be added).

## Revert
- Quick (keeps 1.7.38): Settings → AI Translate → Provider = OpenAI → Save, or
  `wp dev option update kt_provider openai`. OpenAI key/model are still in place.
- Full: restore the file and options from Ops
  `~/agent-guide/backup/kt-codexlb-20261103-2258/` (mode 600, holds the stored keys):
  `kenmore-translate-1.7.37-dev.tgz` (whole plugin dir, md5 of the php
  35bae132…), `kt-options-dev.json` (all 22 `kt_*` rows before the change), then
  delete `kt_codexlb_endpoint`, `kt_codexlb_model`, `kt_codexlb_key`.
  `10506-fr-before.json` holds the French page before the test job.
  Restoring on dev counts as a file edit in the dev webroot (rule 4 exception).

## Before any deploy to www
`deploy-dev-to-live.sh` carries all `kt_*` options. With dev on codexlb it would put
live's Provider on `codexlb` and copy the codex-lb key. If live's plugin is still
1.7.37, it would treat `codexlb` as DeepSeek and send the OpenAI key to DeepSeek. Also, codex-lb is
reachable only over the tailnet; www is on the same host, so it would reach it too. Decide
before deploying: set dev back to openai, or ship 1.7.38 with it on purpose.

## First real run on codex-lb (2026-11-03 23:19–23:33 UTC)
Alex: no full run, only these pages. 19 `kt_translate_post` jobs, created and run by ID
one at a time (376979–376997): 1733 /demo/ × 11 languages, and 18933's 8 earlier
OpenAI-429 failures (ru tr zh ko ja ku ar fa; its fr es he had gone through before).
**0 failed, 828 s total**: 1733 jobs ~6 s each, 18933 jobs 73–128 s each. No
`_kt_error_*` left on either source; all slugs shared (`demo`, the KPI slug), no `-N`.
Backups of the 19 overwritten translations + both sources (post + meta JSON):
Ops `~/agent-guide/backup/kt-codexlb-20261103-2258/run-1733-18933/`.

- All 11 /demo/ translations now carry 1733's Custom HTML embed: `.kd-calendly`,
  `utm_source=kd-demo-page` on the `data-url`, no `[schedule]`. The Calendly webhook
  tags /demo/ bookings by that utm (`KD_CALENDLY_DEMO_UTM_SOURCE`, `kd_calendly_parse()`),
  **not by post ID**, so translated copies now get leadlog + lead email too. Verified
  as far as the iframe `src` (the tag reaches Calendly on /fr/ and /he/); no real
  booking made (it would create a SendPulse contact and email).
- Embed fit (`ops wordpress/kenmore-translate-codexlb/test-demo-embed.js`, calendar →
  times → details, never Schedule Event), /fr/demo/ and /he/demo/ identical to /demo/:
  1440 = 1160×800 frame, document 800; 390 = auto-resize 1056/1063/1112, document equals
  frame. No ancestor scrolls or clips. Only scroller: Calendly's own time-slot list at
  1440 on the times step (777/569), same on English. he is `dir=rtl` around an LTR
  Calendly; Calendly's UI stays English on every language.
- KPI 18933 ru and ar screenshotted at 1440/390 (ar RTL), text sampled on all 8.
- Screenshots: `/srv/incoming/kenmoredesign/review/kt-codexlb-20261103/`.
