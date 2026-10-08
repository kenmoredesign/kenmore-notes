# matrix

Commissioned 2026-10-06 with `commission/commission.sh matrix` (ops commit `535fdab`), run by alex. Not a WordPress host.

## Host
- Hostname `matrix`, tailnet `100.105.27.84`, Ubuntu 26.04. ssh alias `matrix` (logs in as `claude` with the `wp` key).
- Production is a Docker Compose stack in `/opt/support-hub`. **Do not touch Docker, that directory or any service** without being asked; commissioning changed users, sudoers and sshd only.

## Access after commissioning (checked from ops 2026-10-06)
- `alex`: password sudo, mac-jumper key. Unchanged by commissioning.
- `claude` (uid 1000): groups `claude`, `users` only. Removed from `sudo` and `docker`, so plain `docker` is refused on the socket. `authorized_keys` holds only the ops `wp` key.
- claude's sudo: one grant, `(root) NOPASSWD: /usr/local/lib/kenmore-ops/*` in `/etc/sudoers.d/claude-ops`. That directory exists and is empty, so the grant currently allows nothing. The earlier NOPASSWD grants were removed.
- sshd: `00-kenmore.conf` (`AllowUsers alex claude root`, Kenmore CA, principals file) alongside the existing `00-keys-only.conf` and `50-cloud-init.conf`. `/etc/ssh/principals/root` contains `matrix`.
- root: no key login. Only with a CA certificate for principal `matrix`, opened from the Mac with `approve-root matrix [ttl]` (`commission/approve-root` in the ops repo). Tested 2026-10-06: `id` and `docker ps` as root, nothing else.
- Everything the script removed or replaced is in `/root/commission-backup-2026-10-06/` on the host.

## Open issues found 2026-10-06 (read-only survey, nothing changed)

1. **Fixed 2026-10-06: nightly Postgres backup.** The old job ran as `claude` through `docker compose exec` and would have failed from 03:30 UTC on 2026-10-07, because commissioning removed `claude` from the `docker` group. It now runs as root from a root-owned script (see "Backups").
2. **Cleared by itself: `openai-gw` was unhealthy on 2026-10-06 from about 13:00 to the 16:18 UTC reset** because the ChatGPT Plus usage limit was exhausted, not because of auth. Healthy again by the 18:03 heartbeat. The gateway moved off that account the same evening (Codex LB), so this cause no longer applies to it. Details under "OpenAI gateway".
3. **`claude` owns the whole of `/opt/support-hub`**, including `.env` and `secrets/` (mode 600/700, owner `claude`). The ops login therefore can read every secret and edit code and compose without sudo. The three locally built services also run as uid 1000 inside their containers, which is why the files are owned that way (they rewrite their token files).

## /opt/support-hub

Docker Compose project `support-hub` (`docker-compose.yml`, one file). Host: 2 vCPU, 3.8G RAM, 75G disk at 29%. Tree is `claude:claude` unless noted.

### Git
Git repo, branch `master`, author `support-hub-ops`. **Since 2026-10-06 it has a remote:** `origin` = `git@github-support-hub:kenmoredesign/support-hub.git`, a private repo under Alex's personal GitHub account `kenmoredesign` (a user account, not an organisation). First push 2026-10-06: 97 commits, 70 files. Head on GitHub after the upload-limit RUNBOOK entry: `ebb59b3`.

- Deploy key `~claude/.ssh/gh-support-hub` on matrix (title `matrix` on GitHub, write access), ssh alias `github-support-hub` in `~claude/.ssh/config`, GitHub host keys pinned in `known_hosts`. `claude` pushes without sudo.
- `.gitignore` excludes `.env*`, `secrets/`, `backups/`, every data directory, `.claude/`, `*.bak*`, `*.orig`, `*.dump`, `*.sql.gz`, `*.key`, `*.pem`, `**/auth.json*`, `**/registration.yaml`, `analysis/`.
- Full-history scan before the push (all 96 commits and 267 file versions, including unreachable ones): no credential by exact match against 38 live secret values, no token-format or high-entropy matches, no secret file ever committed. Known and accepted: the shared business phone number (`TELEGRAM_PHONE`) is in a comment in `scripts/wa-import/wa_import.py`. Synapse and bridge config values could not be exact-matched (unreadable to `claude`).
- The docs in the repo carry agent names, room IDs, the domain and Jira mappings.
- Git as root needs `-c safe.directory=/opt/support-hub`.

### Services
| Service | What it is | Image | Notes |
|---|---|---|---|
| caddy | TLS front end, the only public listener (80/443) | `caddy:2.11.4` | `caddy/Caddyfile` |
| synapse | Matrix homeserver `matrix.kenmorefx.com` | `matrixdotorg/synapse:v1.154.0` | config and media in `synapse/data` |
| element | Element web client | `vectorim/element-web:v1.12.21` | `element/config.json` |
| postgres | One server, databases `synapse`, `mautrix_telegram`, `mautrix_whatsapp`, `relay`, `openai_gw`, `mautrix_teams` | `postgres:16.14` | no host port |
| mautrix-whatsapp, mautrix-telegram | Bridges to client chats | `dock.mau.dev/mautrix/*:latest`, pinned by digest | config in `bridges/*/data` |
| relay | Kenmore's own appservice: mirrors client rooms, translates, handles `!` commands; API on 127.0.0.1:7400 | built from `./relay` | translation providers: OpenAI (via gateway) then DeepSeek |
| openai-gw | Internal gateway that owns OpenAI access: `/translate`, `/topmodel`, `/image`, `/health` on 127.0.0.1:7500 | built from `./openai-gw` | no fallback by design |
| status | `!status` / `!ai` PM assistant (Jira + chat history, one `/topmodel` call per command) on 127.0.0.1:7580 | built from `./status` | |
| mautrix-teams | Teams bridge, **shelved 2026-09-08** (compose profile `teams`, not started) | built from `./mautrix-teams` | |

### How images are built
On the host with `docker compose build` / `up -d --build`; no registry, no CI. `relay`, `openai-gw` and `status` share one pattern: `python:3.12-slim`, `pip install -r requirements.txt`, copy the package, run as a uid-1000 user. Requirements are version ranges, not locked. `mautrix-teams` is a multi-stage Go build of `gekiclaws/matrix-teams` pinned to commit `657a759` plus two local patches. `openai-gw` and `status` mount their own source directory read-only at `/config` for hot-reloaded YAML (`models.yml`, `jira_map.yml`, `ai_rooms.yml`).

### Code and config (tracked)
`docker-compose.yml`, `caddy/Caddyfile`, `element/config.json`, `postgres-init/01-init-dbs.sh`, `relay/` (package, tests, `glossary.yaml`), `openai-gw/` (package, `models.yml`), `status/` (package, `schema.sql`, `jira_map.yml`, `ai_rooms.yml`), `mautrix-teams/` (Dockerfile, patches, README), `scripts/` (`pg-backup.sh`, systemd units, `ai-room/`, `phone-backfill/`, `wa-import/`), `reset-password.sh`, `docs/`, `RUNBOOK.md` (68K, the operations manual) and `HANDOFF.md` (36K, developer handoff).

### Data (ignored)
| Path | Size | Owner | What |
|---|---|---|---|
| `postgres-data/` | 362M | 999 | Postgres cluster |
| `synapse/data/media_store` | most of 835M | 991 | Matrix media |
| `bridges/*/data/logs`, `mautrix-teams/data/logs` | 366M total | 1337 | bridge logs |
| `backups/` | 304M | claude (a few root, 991) | nightly dumps, 10-day retention, plus hand-made config and SQL copies |
| `relay/logs/relay.jsonl` | 3.6M | claude | relay log |
| `relay/data/` | 14M with code | claude | `mx-state.json`, WhatsApp import and backfill staging |
| `caddy/data`, `caddy/config` | small | root | certificates and Caddy state |
| `analysis/` | 48K | claude | two chat-analysis reports (client content) |

### Secrets (names and purpose only; contents never read out)
| File | Purpose |
|---|---|
| `.env` (600) | All stack parameters and passwords: Postgres and per-database passwords, Synapse registration shared secret, relay appservice and API tokens, DeepSeek API key, Telegram API id/hash and phone, agent lists |
| `secrets/openai-gw/auth.json` | **The gateway's ChatGPT OAuth session** (Codex-format `auth.json`); rewritten by the gateway on each refresh |
| `secrets/openai-gw/auth.json.pkce` | Leftover PKCE verifier/state from the 2026-07-21 login |
| `secrets/relay/openai-auth.json` | The relay's own ChatGPT OAuth session, used only by the direct-call rollback path; still refreshed (last 2026-09-29) |
| `secrets/relay/openai-auth.json.bak.20260630` | Old copy of the above |
| `secrets/jira/token.json` | Jira email, API token, site and expiry for the status service |
| `secrets/admin.pw` | Synapse admin password |
| `secrets/initial-agent-passwords.txt` | Initial passwords for the agent accounts |
| `synapse/data/homeserver.yaml` (+ two `.bak-*`) | Synapse config with database password and secrets |
| `synapse/data/matrix.kenmorefx.com.signing.key` | Homeserver signing key |
| `synapse/data/appservices/` | Appservice registrations (tokens) |
| `bridges/{whatsapp,telegram}/data/config.yaml`, `registration.yaml` (+ `.orig`) | Bridge configs and appservice tokens |
| `mautrix-teams/data/config.yaml`, `registration.yaml` | Same, for the shelved bridge |
| `backups/.env.bak-modelretire-20260908-164109`, `backups/homeserver.yaml.bak.*`, `backups/mautrix-teams-yoursandwich-config-*` | Secret-bearing copies inside `backups/` |
| `backups/*.dump`, `globals_*.sql.gz`, `*.sql` | Database dumps (role password hashes, all chat content) |

### Backups
Changed 2026-10-06 (ops repo `matrix/`). `support-hub-backup.timer` (03:30 UTC nightly, unchanged) now runs `/usr/local/lib/kenmore-ops/support-hub-backup` **as root**, through the drop-in `/etc/systemd/system/support-hub-backup.service.d/kenmore.conf`.

- **Dumps go to `/var/backups/support-hub/`** (`root:root` 700, files 600). `claude` cannot list or read it, so **restores need root**.
- Same content as before: `pg_dumpall --globals-only` plus `pg_dump -Fc` of `synapse`, `mautrix_telegram`, `mautrix_whatsapp`, `relay`. `openai_gw` is deliberately not included. 10-day retention, applied only to the new directory. Local only, no off-host copy.
- New: a dump is kept only if `pg_restore --list` reads it back; globals only if `gzip -t` passes.
- The script reads nothing under `/opt/support-hub` (no compose file, no `.env`); it calls `docker exec support-hub-postgres-1` directly.
- First run 2026-10-06 20:58 UTC through the unit: success, all four dumps validated (173, 25, 41 and 10 tables).
- **`/opt/support-hub/backups/` is no longer written or pruned.** Its 68 files (nightly dumps to 2026-10-06 03:30 plus hand-made copies) stay until someone deletes them.
- `RUNBOOK.md` "Backups (Postgres)" and `HANDOFF.md` were brought up to date on 2026-10-06 (restore commands rewritten for root and container names, not yet re-run in that form). The old script and unit copies remain in the Support Hub repo, unused.
- `claude` can start a backup with `sudo /usr/local/lib/kenmore-ops/support-hub-backup` (the sudo grant covers the directory).
- Undo: remove the drop-in directory, `systemctl daemon-reload`, remove the script. That returns to the old job, which fails without the `docker` group.

### Ops helper
`/usr/local/lib/kenmore-ops/hub` (root-owned, installed 2026-10-06), run by `claude` with sudo:
`sudo /usr/local/lib/kenmore-ops/hub status`, `... logs <service> [lines]` (default 100, max 1000), `... restart <service>`.
Services: caddy, synapse, element, postgres, relay, openai-gw, status, mautrix-whatsapp, mautrix-telegram. Restart of postgres is refused. It acts on containers by name and never reads the compose file. Restarts are logged to syslog (`kenmore-ops`). `restart` has not been exercised on a real service.

## OpenAI gateway: why it is unhealthy (2026-10-06)

- **Cause:** OpenAI returns `HTTP 429 usage_limit_reached` (`plan_type: plus`, 300-minute window). The limit resets at **2026-10-06 16:18:58 UTC**. The gateway's `/health` is 200 only while OpenAI calls succeed, so the container shows unhealthy (148 failed probes when checked at 15:17 UTC). Auth is fine: the access token was refreshed 2026-09-29 and is valid to 2026-10-09; the refresh log shows a clean refresh every 10 days since July.
- **Timeline (UTC):** last successful call 12:03 (heartbeat); first 429 at 12:59:52 (a translation); the 14:03 heartbeat failed and flagged the outage. The one earlier error in the log (2026-10-05 06:02, `server_is_overloaded`) cleared by the next heartbeat.
- **The hub did not use up the limit.** `gateway_calls` shows about 55 `/translate` calls and roughly 10k tokens in the 27 hours before the 429, and no `/topmodel` or `/image` calls at all. The quota was spent by something else on the same ChatGPT account.
- **Translations right now:** working, on the fallback. The relay marked `openai` unhealthy at 12:59:52 and `/healthz` reports `active_provider: deepseek`, DeepSeek healthy. English messages are mirrored verbatim without a model call. The relay re-probes the gateway every 5 minutes and switches back by itself.
- **`!status` / `!ai` right now:** the status container is healthy (Jira and DB fine), but every command makes one `/topmodel` call through the gateway and there is no fallback, so they will return an error until the limit resets. Nobody has run one in the last 30 hours.
- Nothing auto-restarts on unhealthy, and a restart would not help.
- **Recovered:** heartbeats at 18:03 and 20:03 UTC were OK and the container is healthy again.

### Switched to Codex LB 2026-10-06 21:40 UTC
The gateway no longer uses the ChatGPT login. Support Hub commits `022cf35` (code) and `33c9270` (compose), pushed to GitHub.

- **Upstream:** `http://100.85.194.92:2455/backend-api/codex/responses` (Codex LB on the tailnet, plain HTTP inside WireGuard), same wire format as before.
- **Auth:** API key, one line in `/opt/support-hub/secrets/openai-gw/codex-lb.key` (`claude:claude` 600, placed by Alex). Re-read on every call, so replacing the key needs no restart. The key allows `gpt-5.6-sol`, `gpt-5.6-terra` and `gpt-5.6-luna`.
- **Switch:** `GW_UPSTREAM_URL` and `GW_API_KEY_PATH` on the `openai-gw` service in `docker-compose.yml`. Both or neither; the gateway refuses to start with only one.
- **No model, prompt or schema changes.** `/translate` and `/image` stay on `gpt-5.6-terra`, `/topmodel` on `gpt-5.6-sol`.
- **Key-mode behaviour:** no token refresh, no `chatgpt-account-id` header, no device-login code in alerts (alerts explain the LB and key file instead). A missing, empty or rejected key is an auth failure: alert, unhealthy container, relay on DeepSeek.
- **Cutover:** only `openai-gw` was rebuilt and recreated (`docker compose build openai-gw`, `up -d --no-deps openai-gw`, as root); all other container ids unchanged. Healthy 15 seconds after start.
- **Tests through the LB, all passed:** translation via `/translate` (200, 2.7s, `gpt-5.6-terra`), `/topmodel` trivial prompt (200, 2.1s, `gpt-5.6-sol`), `/topmodel` with a trivial `json_schema` (200, strict JSON returned), `/health` 200, relay `/healthz` shows `active_provider: openai`. `/image` tested separately the same evening: one image in 26s, valid PNG, generator `gpt-image-2-codex`. A real `!status` ran through the LB at 21:59 UTC the same evening (23.5k tokens in). Not tested: inputs near the 1.1M-character cap.
- **Rollback:** the previous image is tagged `support-hub-openai-gw:pre-codex-lb-20261006` (`b8f6571d0a82`). Either delete the two compose lines and `docker compose up -d --no-deps openai-gw` (new code, ChatGPT login), or additionally `docker tag support-hub-openai-gw:pre-codex-lb-20261006 support-hub-openai-gw:latest` first to go back to the old code too. `secrets/openai-gw/auth.json` was left in place for this; its access token expires 2026-10-09 and nothing refreshes it now, so a rollback after that date depends on the refresh token still being accepted, or on `python -m gw.setup_auth`.
- `RUNBOOK.md` "OpenAI gateway" and `HANDOFF.md` describe key mode, key replacement and the rollback since Support Hub commit `80a51e8`.

## `!status` posting bug, fixed 2026-10-06

- **Symptom:** every `!status` failed after the model call with `!status failed: quote_from_bytes() expected bytes` and posted nothing. First seen 2026-10-06 21:49 and 21:52 UTC (`!status WFBL`).
- **Cause:** in `_cmd_status` (`status/svc/api.py`) the variable `out` held the output room and was then overwritten with the model's JSON, which was passed to the poster as the room id. Introduced 2026-07-27 by `ed18579` (per-agent AI rooms); no `!status` had been run since, so it only surfaced now. Not related to the Codex LB switch: both `/topmodel` calls returned ok.
- **Fix:** Support Hub commit `3749b62` (five-line rename, no prompt or schema change), pushed 2026-10-07. Only `status` was rebuilt and recreated (2026-10-06 21:58 UTC). Previous image kept as `support-hub-status:pre-statusfix-20261006` (`6c7ee9db72f1`), which has the bug.
- **Confirmed:** Alex ran `!status WFBL` at 21:59 UTC and the briefing arrived (623 new messages, 8 facts written, `gpt-5.6-sol` through the LB, 60s). This was also the first real `!status` through the Codex LB.
- The two failed runs wrote no state, bookmark or facts.

## WhatsApp media over 50 MiB was not bridged (found and fixed 2026-10-07)

- **Cause:** `max_upload_size` is not set in `synapse/data/homeserver.yaml`, so Synapse's 50 MiB default applies. mautrix-whatsapp refuses larger media before uploading (`media too large (63.20 MB > 52.43 MB)`) and posts an `m.notice` in the client-side room: "Failed to bridge video attachment, please view it on the WhatsApp app". The relay drops every bridge notice (`relay/relay/service.py`, `_inbound`), so the agents' room shows nothing.
- **Frequency:** six cases in the bridge logs since 2026-06-29: 2026-07-14 video 79.48 MB, 2026-09-09 file 58.56 MB, and the same 63.20 MB video four times on 2026-10-06 and 2026-10-07 (twice in a direct chat, twice in the `[INZO]` group, relay conversation 24). Synapse rejected no uploads and Caddy returned no 413s; Caddy has no body limit and the bridge talks to Synapse directly.
- **Applied 2026-10-07 21:57 UTC:** `max_upload_size: 100M` (plus a one-line comment) appended to `synapse/data/homeserver.yaml`. Synapse restarted (healthy in about 7s), then `mautrix-whatsapp` and `mautrix-telegram` (both `CONNECTED` within seconds). Verified: the media config endpoint returns `{"m.upload.size":104857600}`; all nine containers healthy; no warnings or errors in the Synapse or bridge logs after the restart; relay, gateway and status healthy. Not yet proven with a real file over 50 MB.
- **Undo:** `cp -p synapse/data/homeserver.yaml.bak-uploadsize-20261007-215739 synapse/data/homeserver.yaml` as root (the backup is the file before the change, same owner 991 and mode 600), then `docker restart support-hub-synapse-1`, wait for healthy, and restart both bridge containers.
- The setting is recorded in the Support Hub `RUNBOOK.md` ("Synapse settings that live only on the host", commit `ebb59b3`), because `homeserver.yaml` is not in git.
- The limit applies to Element users and the Telegram bridge too. No media retention is configured; `media_store` was 838M with 52G free on 2026-10-07.
- **Missed videos cannot be re-fetched:** the bridge stored the message as the failure notice with no media details. After the limit is raised the video has to be sent or forwarded again in WhatsApp.
- **Relay marker, deployed 2026-10-08 06:31 UTC:** Support Hub commit `4243f11` (code and test) plus `1044470` (RUNBOOK). The bridge's failed-media notice from a client ghost becomes an `m.notice` in the agents' room only ("⚠️ Sent a video that could not be bridged. View it in WhatsApp.") and a stored transcript row `[video, not bridged]`. All other bridge notices stay dropped. WhatsApp wording only: the Telegram bridge logs (from 2026-06-22) contain no failed-media notice to copy. Matcher in `relay/relay/bridge_notice.py`, unit test `relay/tests/test_bridge_notice.py` (no dependencies).
  - Only `relay` was rebuilt and recreated (`--no-deps`), after 11 quiet minutes in its log; healthy in 8 seconds; no other container changed. Previous image kept as `support-hub-relay:pre-marker-20261008` (`951645adc9e9`). Rollback: `docker tag support-hub-relay:pre-marker-20261008 support-hub-relay:latest`, then `docker compose up -d --no-deps relay`.
  - **Open as of 06:50 UTC:** no client or agent message had arrived since the restart, so mirroring by the new relay is not yet confirmed from the log, and the two commits are **not pushed** (GitHub is at `ebb59b3`). Synapse shows the `support-relay` appservice `up` with no queued transactions. The marker path itself has not fired yet either; the first real failed-media notice is its proof.
  - An exception in the marker code is contained to that one notice: the relay wraps each event in `handle_event` (logs "error handling event") and the appservice library runs each event as its own task.
- **Relay restarts and missed messages:** the relay is a Matrix appservice, so Synapse pushes events to it and retries undelivered transactions when it is back. The relay claims each event id in the `processed_event` table before handling it (`claim_event`), so redelivery after a restart cannot double-mirror. Limitation: an event claimed but not yet mirrored when the process is stopped is not retried. Now in the RUNBOOK ("Restarting the relay"). Check for quiet with `sudo /usr/local/lib/kenmore-ops/hub logs relay 20` before restarting.
- Bridge logs are in `bridges/whatsapp/data/logs/` (JSON, 100M rotation, back to 2026-06-29). Their debug lines contain display names, phone numbers and short-lived WhatsApp media tokens; filter to `error`/`warn` when reading them.

## How the stack authenticates to OpenAI

Since 2026-10-06 the gateway uses a Codex LB API key (see above). The older logins are ChatGPT OAuth sessions in Codex `auth.json` format (`auth_mode: chatgpt`, `OPENAI_API_KEY: null`), client id of the Codex CLI, refreshed against `auth.openai.com`.

| File | Used by | State |
|---|---|---|
| `/opt/support-hub/secrets/openai-gw/codex-lb.key` | `openai-gw`. **This is the live credential since 2026-10-06** (Codex LB API key) for translations, `!status` and images | placed 2026-10-06 |
| `/opt/support-hub/secrets/openai-gw/auth.json` | Nothing while the gateway is in key mode; kept as the rollback login | last refreshed 2026-09-29, access token valid to 2026-10-09, no longer refreshed |
| `/opt/support-hub/secrets/relay/openai-auth.json` | `relay`, only if `RELAY_OPENAI_URL` is removed from compose (the documented rollback switch) | separate session, refreshed 2026-09-29 |
| `/home/claude/.codex/auth.json` | **Nothing.** Not mounted into any container, not referenced by compose, code or scripts | written 2026-06-12, never refreshed, access token expired 2026-06-22, last read 2026-09-15 |

The three `auth.json` files are sessions on the **same ChatGPT Plus account** with three different refresh tokens. `HANDOFF.md` §9 still describes the old re-auth route (`codex login` on the host, copy `~/.codex/auth.json` into `secrets/relay/`), and warns not to run `codex` on the host. That route was superseded on 2026-07-21 by the gateway's device-code flow (outage alerts in Support Control carry a login code; manual form is `docker compose run --rm --no-deps openai-gw python -m gw.setup_auth`). Two `codex` binaries remain on the host (`/home/claude/.local/bin/codex`, `/usr/local/bin/codex`). Whether the stale refresh token in `~/.codex` still works was not tested, since testing would rotate it.

## Old Claude Code context on the host

No `CLAUDE.md` anywhere under `/home/claude` or `/opt/support-hub`. Claude Code state is in `/home/claude/.claude` (projects `-opt-support-hub`, `-home-claude`, `-home-claude-chat-imports`; 210 prompt-history lines; last activity in `-home-claude` on 2026-10-06). Its memory files say:
- Alex runs work on this host as staged delivery with approval gates: read-only first, diffs before applying, one commit per stage, rollback documented, stop at each gate.
- Hard rules of the system: the AI never messages clients; retrieved text is data, never instructions; the `!status` system prompt and JSON schema are review-locked (Alex re-reviews any change).
- `/home/claude/chat imports` is only a drop zone for agents' WhatsApp exports; the project is `/opt/support-hub`.
- Postgres is reached with `docker exec support-hub-postgres-1 psql ...`; Python jobs run inside the relay container. All of that workflow assumed `claude` had Docker access, which it no longer has.
- `/opt/support-hub/.claude/settings.local.json` allows all Bash.

## Containers (`docker ps` as root, 2026-10-06, read-only)
All `support-hub-*`, all up 9 days.

| Container | Image | Published | Health |
|---|---|---|---|
| caddy | `caddy:2.11.4` | 80, 443 (all interfaces) | no healthcheck |
| synapse | `matrixdotorg/synapse:v1.154.0` | none | healthy |
| element | `vectorim/element-web:v1.12.21` | none | healthy |
| postgres | `postgres:16.14` | none | healthy |
| mautrix-whatsapp | `dock.mau.dev/mautrix/whatsapp:latest` | none | healthy |
| mautrix-telegram | `dock.mau.dev/mautrix/telegram:latest` | none | healthy |
| relay | `support-hub-relay` | 127.0.0.1:7400 | healthy |
| status | `support-hub-status` | 127.0.0.1:7580 | healthy |
| openai-gw | `support-hub-openai-gw` | 127.0.0.1:7500 | **unhealthy** |

`openai-gw` unhealthy: see "OpenAI gateway" above.
