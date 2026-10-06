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

`openai-gw` was already reporting unhealthy when first seen; not investigated.
