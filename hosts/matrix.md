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
2. **Cleared by itself: `openai-gw` was unhealthy on 2026-10-06 from about 13:00 to the 16:18 UTC reset** because the ChatGPT Plus usage limit was exhausted, not because of auth. Healthy again by the 18:03 heartbeat. It will recur while the hub shares that account. Details under "OpenAI gateway".
3. **`claude` owns the whole of `/opt/support-hub`**, including `.env` and `secrets/` (mode 600/700, owner `claude`). The ops login therefore can read every secret and edit code and compose without sudo. The three locally built services also run as uid 1000 inside their containers, which is why the files are owned that way (they rewrite their token files).

## /opt/support-hub

Docker Compose project `support-hub` (`docker-compose.yml`, one file). Host: 2 vCPU, 3.8G RAM, 75G disk at 29%. Tree is `claude:claude` unless noted.

### Git
Already a git repo: branch `master`, 94 commits (2026-06 to 2026-09-08, author `support-hub-ops`), **no remote**, working tree clean except untracked `.claude/`. 70 tracked files. `.gitignore` excludes `.env`, `secrets/`, `backups/`, `synapse/data/`, `postgres-data/`, `caddy/data/`, `caddy/config/`, both bridge `data/` dirs, `mautrix-teams/data/`, `relay/logs/`, `relay/data/`, `analysis/`, `*.pyc`, `__pycache__/`. A pattern scan of the tracked files found no embedded tokens or passwords, and `.env`, `secrets/` and the bridge/Synapse configs were never committed. Git as root needs `-c safe.directory=/opt/support-hub`.

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
- **`RUNBOOK.md` "Backups (Postgres)" is out of date**: it still describes `scripts/pg-backup.sh`, the old directory and restores as `claude`. The old script and unit copies remain in the Support Hub repo, unused.
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

### Planned, not started (decided 2026-10-06)
Order: first the GitHub copy of the Support Hub (`kenmoredesign/support-hub`, private, deploy key on matrix), then switch the gateway to Codex LB at `http://100.85.194.92:2455/backend-api/codex/responses` with an API key in `secrets/openai-gw/codex-lb.key`, keeping the ChatGPT login as rollback. No model changes: Alex is adding `gpt-5.6-terra` to the key (it already allows `gpt-5.6-sol` and `gpt-5.6-luna`). The `!status` prompt and schema are not to be touched. The gateway container reaching the LB is confirmed (401 without a key).

## How the stack authenticates to OpenAI

Not an API key: ChatGPT OAuth sessions in Codex `auth.json` format (`auth_mode: chatgpt`, `OPENAI_API_KEY: null`), client id of the Codex CLI, refreshed against `auth.openai.com`.

| File | Used by | State |
|---|---|---|
| `/opt/support-hub/secrets/openai-gw/auth.json` | `openai-gw` (`GW_AUTH_JSON_PATH=/secrets/auth.json`). **This is the live login** for translations, `!status` and images | refreshed 2026-09-29, access token valid to 2026-10-09 |
| `/opt/support-hub/secrets/relay/openai-auth.json` | `relay`, only if `RELAY_OPENAI_URL` is removed from compose (the documented rollback switch) | separate session, refreshed 2026-09-29 |
| `/home/claude/.codex/auth.json` | **Nothing.** Not mounted into any container, not referenced by compose, code or scripts | written 2026-06-12, never refreshed, access token expired 2026-06-22, last read 2026-09-15 |

All three are sessions on the **same ChatGPT Plus account** with three different refresh tokens. `HANDOFF.md` §9 still describes the old re-auth route (`codex login` on the host, copy `~/.codex/auth.json` into `secrets/relay/`), and warns not to run `codex` on the host. That route was superseded on 2026-07-21 by the gateway's device-code flow (outage alerts in Support Control carry a login code; manual form is `docker compose run --rm --no-deps openai-gw python -m gw.setup_auth`). Two `codex` binaries remain on the host (`/home/claude/.local/bin/codex`, `/usr/local/bin/codex`). Whether the stale refresh token in `~/.codex` still works was not tested, since testing would rotate it.

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
