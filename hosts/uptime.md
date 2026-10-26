# uptime

**Status 2026-10-26: commissioned and cleaned up.**
- **Access:** claude logs in with the `wp` key. Its only sudo is the scoped `kenmore-ops` grant, and it's no longer in the `docker` group. Root works only with a CA certificate for principal `uptime`; the first such login was tested 2026-10-26.
- **ops pinned host key:** ED25519 `SHA256:6VkmoO+s19EAs8GfcJxq+Crc7WPQXJAJs3Cg/0aiFLA`, confirmed by alex on the box.
- **est:** removed from `sudo` and `docker` by alex.
- **AllowUsers:** briefly trimmed to `alex` on 2026-10-26, then restored to `alex claude root`. `00-kenmore.conf` matches commission.sh again.
- **Removed 2026-10-26** (see [uptime-cleanup-2026-10-26.md](uptime-cleanup-2026-10-26.md)): Mautic, Planka, the automation pipeline, the premium WordPress, and the host MariaDB, php8.3 and nginx.
- **Runs now:** Caddy on the host (`uptime.kenmorefx.com`, `cloud.kenmorefx.com`), Uptime Kuma (log capped at 10m × 3) and Nextcloud.
- **Resources:** 21G free on `/`, about 2.5G RAM available.
- The pre-flight record below describes the state before commissioning.

Hetzner, Ubuntu 24.04.4 LTS, hostname `UptimeMonitor`. Runs Caddy on the host, Uptime Kuma and Nextcloud (`/opt/kenmore/nextcloud`). The Mautic and Planka stacks are present but stopped. Not a WordPress host. **Not yet commissioned.** The facts below come from alex's pre-flight output of 2026-10-26, run on the host. The Nextcloud path and the stopped Mautic/Planka stacks come from alex's brief, not from the pre-flight. Nothing was read from ops, because ops had no login yet.

## Host
- Tailnet `100.92.64.4`. ssh alias `uptime`, which is also the commission box name and the root principal (logs in as `claude` with the `wp` key once it's commissioned).
- 2 vCPU, 3.7Gi RAM (1.6Gi used), **11G free on `/`**, the least free space of any managed box.
- Installed: tailscale, git, curl, docker, Docker Compose v5.1.3.
- Login users: **`est`**, `claude`, `alex`. It's unknown who `est` is.

## Services (pre-flight)
| What | Listens on |
|---|---|
| Caddy (host service, not a container) | `*:80`, `*:443` |
| uptime-kuma | **public 0.0.0.0:3001 and [::]:3001**, published by Docker |
| nextcloud-app | 127.0.0.1:8081 (behind Caddy) |
| nextcloud-db | 3306/tcp (internal) |
| nextcloud-redis | 6379/tcp (internal) |

Uptime Kuma answers on its own port from the internet as well as through Caddy (if Caddy proxies it). ufw is **inactive**, and Docker-published ports bypass ufw anyway.

## Access before commissioning (pre-flight)
- sudo: `claude ALL=(ALL) NOPASSWD:ALL` and `root ALL=(ALL) NOPASSWD:ALL`, besides the stock `root`, `%admin` and `%sudo` lines.
- Effective sshd settings: `permitrootlogin yes`, `passwordauthentication yes`, `trustedusercakeys none`. The only drop-in is `50-cloud-init.conf`. Root therefore still accepts a password over SSH, even though the brief describes root as "key only".
- Public listeners: 22, 80, 443 and 3001, plus Tailscale's own ports on `tailscale0`.

## What commissioning will change
`commission/commission.sh uptime`, same profile as matrix:
- claude loses the NOPASSWD:ALL line and gets removed from `sudo`/`docker`. The only grant left is `(root) NOPASSWD: /usr/local/lib/kenmore-ops/*`, and with no helpers installed yet it allows nothing.
- `00-kenmore.conf` sets PasswordAuthentication no, PermitRootLogin prohibit-password, **`AllowUsers alex claude root`**, and the Kenmore CA with principal `uptime`.
- root's `authorized_keys` is emptied, which removes the Hetzner root key.
- **`est` will no longer be able to log in over SSH** because of `AllowUsers`. Decide what happens to `est` before running the script.

Before running it, check that nothing scheduled runs as claude through docker (crontab, systemd units with `User=claude`). On matrix, the nightly backup broke that way.
