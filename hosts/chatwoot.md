# chatwoot

Hetzner, Ubuntu 26.04.1 LTS. Runs the Chatwoot customer-messaging stack. Not a WordPress host. **Not yet commissioned.** Everything below comes from alex's pre-flight output of 2026-10-26, run on the host. Nothing was read from ops, because ops had no login yet.

## Host
- Hostname `chatwoot`, tailnet `100.87.57.35`. ssh alias `chatwoot` (logs in as `claude` with the `wp` key once it's commissioned).
- 2 vCPU, 3.7Gi RAM (2.0Gi used), 21G free on `/`.
- Installed: tailscale, git, curl, docker, Docker Compose v5.5.1.
- Login users: `claude`, `alex`.

## Containers (pre-flight)
| Container | Ports |
|---|---|
| chatwoot-caddy | **public** 80/tcp, 443/tcp and 443/udp (v4 and v6); 2019/tcp internal |
| chatwoot-web | 3000/tcp (internal) |
| chatwoot-sidekiq | 3000/tcp (internal) |
| chatwoot-bot | 8000/tcp (internal) |
| chatwoot-relay | 8080/tcp (internal) |
| chatwoot-postgres | 5432/tcp (internal) |
| chatwoot-redis | 6379/tcp (internal) |

The pre-flight doesn't show the compose project's directory, its backups or its owner. They're unknown until the first survey from ops.

## Access before commissioning (pre-flight)
- sudo: `claude ALL=(ALL) NOPASSWD:ALL` and `root ALL=(ALL) NOPASSWD:ALL`, besides the stock `root`, `%admin` and `%sudo` lines.
- Effective sshd settings: `permitrootlogin yes`, `passwordauthentication yes`, `trustedusercakeys none`. The only drop-in is `50-cloud-init.conf`. Root therefore still accepts a password over SSH, even though the brief describes root as "key only".
- Public listeners: 22, 80 and 443 (v4 and v6), plus Tailscale's own ports on `tailscale0`.
- ufw is active. The pre-flight doesn't list its rules.

## What commissioning will change
`commission/commission.sh chatwoot`, same profile as matrix:
- claude loses the NOPASSWD:ALL line and gets removed from `sudo`/`docker`. The only grant left is `(root) NOPASSWD: /usr/local/lib/kenmore-ops/*`, and with no helpers installed yet it allows nothing.
- `00-kenmore.conf` sets PasswordAuthentication no, PermitRootLogin prohibit-password, `AllowUsers alex claude root`, and the Kenmore CA with principal `chatwoot`.
- root's `authorized_keys` is emptied, which removes the Hetzner root key.

Before running it, check that nothing scheduled runs as claude through docker (crontab, systemd units with `User=claude`). On matrix, the nightly backup broke that way.
