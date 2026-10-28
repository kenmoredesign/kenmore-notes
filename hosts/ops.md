# ops

The Ops box (hostname `Ops`, 188.245.16.25, Hetzner DE), where the Claude Code ops sessions run as `claude`. This file starts with the image-generation setup (2026-10-28); earlier changes on this host aren't written up here.

## Image generation (`imagegen`), 2026-10-28

Codex CLI runs as a dedicated service user and generates images with its built-in `$imagegen` tool. `claude` can only reach it through one wrapper. The files are in ops under `imagegen/` (first commit `f79e762`, v5 `015b6dc`), and the session skill is `.claude/skills/imagegen/SKILL.md`. alex installed it.

### Current auth: a ChatGPT login, not Codex LB
- It **runs on a direct ChatGPT login** in the service user (`/var/lib/imagegen/.codex/auth.json`). The run log of a check on 2026-10-28 shows `provider: openai`, model `gpt-5.6-sol`.
- The reason is that Jenny's codex-lb (1.22–1.24) hard-codes `gpt-5.5` as the host model for its images route, and the pooled accounts' plans no longer include 5.5. That route returns 503 `no_plan_support_for_model`.
- **`/var/lib/imagegen/.codex/config.toml.lb` is the Codex LB config to restore.** There are two ways to fix the LB side on Jenny:
  - set `_IMAGES_HOST_MODEL = "gpt-5.6-luna"` in `app/modules/proxy/api.py` and restart, or
  - upgrade codex-lb to `1.25.0b9`+.
- To go back to the LB once it's fixed:
  1. run `sudo -u imagegen env HOME=/var/lib/imagegen CODEX_HOME=/var/lib/imagegen/.codex codex logout`;
  2. move `config.toml.lb` back to `config.toml`;
  3. make sure `codex-lb.env` holds the `OPS-IMAGEGEN` key (that key's allowed models need `gpt-image-2`, and it must have no enforced model);
  4. run `imagegen probe`, then `imagegen check`.
- A login can lapse, as matrix's did, and the LB route can't, which is why the repo keeps the LB config as its default.

### What's installed
- **Service user** `imagegen`: uid 999, gid 983, system user, shell `/usr/sbin/nologin`, home `/var/lib/imagegen` (imagegen:imagegen 750).
- **Codex CLI** `rust-v0.165.0`, both root:root 755:
  - `/usr/local/bin/codex` (`codex-cli 0.165.0`)
  - `/usr/local/bin/codex-code-mode-host`. Codex runs every tool call through it; without it, tools fail with "workspace tool host is unavailable".
- **bubblewrap** 0.11.1 at `/usr/bin/bwrap`. Codex uses it as the shell sandbox.
- **Config and key** under `/var/lib/imagegen`, readable only by imagegen:
  - `.codex/config.toml`: the active config (ChatGPT login, no `model_provider`)
  - `.codex/config.toml.lb`: the LB config to restore
  - `.codex/auth.json`: the ChatGPT login
  - `codex-lb.env` (600): `CODEX_LB_API_KEY`, only used when the config has `env_key`
- **Work dirs**, imagegen:claude, setgid:
  - `/srv/imagegen` with `in/` and `out/` (2775)
  - `.runs/` (2770), one full Codex transcript per run
  - `log.jsonl`, one line per run
  - `.last.txt`
- **Sudoers** `/etc/sudoers.d/kenmore-imagegen`: `claude ALL=(imagegen) NOPASSWD: /usr/local/lib/kenmore-ops/imagegen`. Confirmed with `sudo -n -l`.
- **Command**:
  - `/usr/local/bin/imagegen` (shim: `sudo -n -u imagegen …`)
  - `/usr/local/lib/kenmore-ops/imagegen` (the Python wrapper, root:root 755)
  - usage: `imagegen check` / `imagegen generate "<prompt>" --out x.png [--size] [--quality low|medium|high] [--ref] [--transparent] [--force]`. v5 adds `imagegen probe`.

### State on 2026-10-28 (checked 12:49 UTC)
- `imagegen check` **from a Claude session: OK** (rc 0, reply `OK`, 3s).
- Smoke render at 12:45: `/srv/imagegen/out/smoke.png`, low quality, 40s.
- Two earlier smoke renders failed:
  - 11:30, "image tool unavailable": the provider/auth eligibility problem;
  - 12:37, "workspace tool host is unavailable": the missing code-mode host.
- **The installed wrapper is still v1** (8543 bytes, 10:43, from `f79e762`), not v5 from `015b6dc`. The code-mode host and the dir mode changes were done by hand. There's no `/var/backups/kenmore-ops/` either, which means v5's `install.sh` hasn't been run yet. A v5 run would:
  - install the v5 wrapper, which adds `probe`, makes the LB key optional and adds the `generated_images/` pickup;
  - create `/srv/imagegen/generated_images`;
  - set `log.jsonl` to 664 (it's 660 now);
  - overwrite `config.toml` with the LB config from the repo. **Before re-running it while still on the ChatGPT login, save the login config, or put it back afterwards.**
- The v1 wrapper still labels its check line "via Codex LB". That's only the label; the auth is the ChatGPT login.

### Undo
```
sudo rm -f /etc/sudoers.d/kenmore-imagegen /usr/local/bin/imagegen /usr/local/lib/kenmore-ops/imagegen /usr/local/bin/codex /usr/local/bin/codex-code-mode-host
sudo userdel -r imagegen          # removes /var/lib/imagegen: the ChatGPT login, the LB key, both configs
sudo rm -r /srv/imagegen          # outputs + logs; copy out anything you want first
```
After that, revoke `OPS-IMAGEGEN` in the LB dashboard and sign the Ops device out of the ChatGPT account. bubblewrap can stay (`apt remove bubblewrap` if not).

### Open
- Run v5's `install.sh`, keeping the login config (see above).
- Fix codex-lb's images host model on Jenny, then switch back to the LB.
- Codex runs as `imagegen` with shell access and reads aren't sandboxed, so a session's prompt could probably get it to copy `auth.json` or `codex-lb.env` into `out/`. I haven't tested this. The sudoers line limits how much a session can spend; it doesn't keep the secret from a session.
