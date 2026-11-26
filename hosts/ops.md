# ops

The Ops box (hostname `Ops`, 188.245.16.25, Hetzner DE), where the Claude Code ops sessions run as `claude`. This file starts with the image-generation setup (2026-10-28); earlier changes on this host aren't written up here.

## Image generation (`imagegen`), 2026-10-28

Codex CLI runs as a dedicated service user and generates images with its built-in `$imagegen` tool. `claude` can only reach it through one wrapper. The files are in ops under `imagegen/` (first commit `f79e762`, v5 `015b6dc`, v6 `2489f6e`, v7 `b0c3d4a`), and the session skill is `.claude/skills/imagegen/SKILL.md`. alex installed it.

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

### Known issue: parallel runs cross outputs (2026-10-28)
Running several `imagegen generate` at once returned **some images under another run's `--out` name**: 01-03 (all started 15:09:04, one shared run log `20261028-150904.log`) and 13/14 (run logs 151218 and 151219, a second apart). The logged prompts were right and each file was a distinct render, only the labels crossed. Run renders one at a time until the wrapper names run logs and picks the output per run, not per second.

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
  - `/srv/imagegen` with `in/`, `out/` and `generated_images/` (2775)
  - `.runs/` (2770), one full Codex transcript per run
  - `log.jsonl`, one line per run
  - `.last.txt`
- **Sudoers** `/etc/sudoers.d/kenmore-imagegen`: `claude ALL=(imagegen) NOPASSWD: /usr/local/lib/kenmore-ops/imagegen`. Confirmed with `sudo -n -l`.
- **Command**:
  - `/usr/local/bin/imagegen` (shim: `sudo -n -u imagegen …`)
  - `/usr/local/lib/kenmore-ops/imagegen` (the Python wrapper, v7, root:root 755)
  - usage: `imagegen check` / `imagegen probe` / `imagegen generate "<prompt>" --out x.png [--size] [--quality low|medium|high] [--ref] [--transparent] [--force]`
  - `probe` is only for LB mode: it calls the LB's images route directly.

### State on 2026-10-28 (checked 12:49 UTC)
- `imagegen check` **from a Claude session: OK** (rc 0, reply `OK`, 3s).
- Smoke render at 12:45: `/srv/imagegen/out/smoke.png`, low quality, 40s.
- Two earlier smoke renders failed:
  - 11:30, "image tool unavailable": the provider/auth eligibility problem;
  - 12:37, "workspace tool host is unavailable": the missing code-mode host.
- Until 14:05 the installed wrapper was v1 (from `f79e762`), and the code-mode host and dir modes had been set by hand.

### v7 installed, 2026-10-28 14:05 UTC
- alex ran v7's `install.sh`. Backup: `/var/backups/kenmore-ops/imagegen-20261028-140509`.
- The installed `/usr/local/lib/kenmore-ops/imagegen` matches `b0c3d4a` (13849 bytes).
- The existing `config.toml` was kept, so it's still on the ChatGPT login.
- `/srv/imagegen/generated_images` (2775) was created, and `log.jsonl` is now 664.
- The agent runs with no tools except the image tool, and `--ref` is accepted only from `/srv/imagegen/in/`.
- **Smoke render at 14:06:** `/srv/imagegen/out/smoke-v7.png` (low quality, 28s). The agent replied with the tool's path under `/var/lib/imagegen/.codex/generated_images/<session>/`, and the wrapper moved the file into `out/`.
- **`imagegen check` from a Claude session at 14:09: OK.** It reports the ChatGPT login (`auth.json` present), the code-mode host and bwrap, and the round-trip took 3s.
- Moved images keep group `imagegen` (`smoke-v7.png` is imagegen:imagegen 664), because a renamed file doesn't pick up the setgid group of `out/`. `claude` can read, rename and delete them but can't overwrite them in place. To fix it, have the wrapper copy and then delete instead of moving, so the new file inherits group `claude`.

### Undo
```
sudo rm -f /etc/sudoers.d/kenmore-imagegen /usr/local/bin/imagegen /usr/local/lib/kenmore-ops/imagegen /usr/local/bin/codex /usr/local/bin/codex-code-mode-host
sudo userdel -r imagegen          # removes /var/lib/imagegen: the ChatGPT login, the LB key, both configs
sudo rm -r /srv/imagegen          # outputs + logs; copy out anything you want first
```
After that, revoke `OPS-IMAGEGEN` in the LB dashboard and sign the Ops device out of the ChatGPT account. bubblewrap can stay (`apt remove bubblewrap` if not).

### Open
- Fix codex-lb's images host model on Jenny, then switch back to the LB.
- ~~A session's prompt could get the agent to copy `auth.json` or `codex-lb.env` into `out/`.~~ **Closed in v6** (`2489f6e`); in effect since the v7 install. The agent runs with `--disable shell_tool`, `-s read-only` and `web_search="disabled"`, and the wrapper moves the image itself.
- ~~Default-on agent tools beyond the shell.~~ **Closed in v7** (`b0c3d4a`). The wrapper also disables `unified_exec`, `view_image`, `multi_agent`, `apps`, `plugins` and `hooks`. alex verified on codex 0.165.0 that `shell_tool` alone already removes `exec_command`. The remaining nested tools are the image tool, `apply_patch` (model-authored text only), goals and MCP resource listing with no servers configured.
- ~~`--ref` accepts any path the imagegen user can read.~~ **Closed in v7** (`b0c3d4a`). Its realpath must be under `/srv/imagegen/in/`.
- Smaller, untested: `in/` is writable by `claude`, and the wrapper checks the ref's realpath but passes the unresolved path to `codex -i`. A session could swap a checked file for a symlink to `auth.json` between the check and Codex reading it. Codex's image loader would most likely reject the file. To close it, copy each ref into a private temp file (opened with `O_NOFOLLOW`) after the check and pass that copy.

## claude-seo: Google and PostHog connections (2026-11-26)

The claude-seo plugin (2.6.2, `~/.claude/plugins/cache/agricidaniel-claude-seo/`) can read real
data for kenmoredesign.com. All four were live-tested on 2026-11-26.

- **Google** (Search Console, GA4, PageSpeed, CrUX). Files in `~/.config/claude-seo/` (700, files 600):
  - `service_account.json`: service account `kenmore-seo@kenmore-seo-515714.iam.gserviceaccount.com`,
    Cloud project `kenmore-seo-515714`. Search Console: Full user on `sc-domain:kenmoredesign.com`.
    GA4: Viewer on property `381359430`. No Indexing API (needs Owner).
  - `google-api.json`: `service_account_path`, `api_key` (restricted to PageSpeed + CrUX; replaced
    2026-11-26 after the first one showed in a session log) and a `sites` map:
    `kenmoredesign.com` → `sc-domain:kenmoredesign.com` + `properties/381359430`.
  - Check: `<plugin>/scripts/claude-seo run google_auth.py --check` (Tier 2, Full). Scripts take
    `--domain kenmoredesign.com` (`gsc_query.py`, `ga4_report.py`, `pagespeed_check.py <url>`).
- **PostHog** (US cloud): MCP server `posthog` at `https://mcp.posthog.com/mcp`, user scope in
  `~/.claude.json` with a read-only `phx_` personal API key as a Bearer header. Tool
  `mcp__posthog__exec` (`call execute-sql` for HogQL). A session started before the server was
  added doesn't see the tool; restart Claude Code. PostHog counts include `dev.` test traffic.
- Don't print the key files or `~/.claude.json` into a session: mask keys when checking.

## Sandboxed agents and the SEO plugin (2026-11-26)

**Use `agent-run --profile seo`.** A Herdr terminal started with `tools/agent-run` in the default or `ssh` profile
has no plugins, no `~/.config/claude-seo` keys, no PostHog MCP server and no browser: none of those paths are mounted.
That is why an SEO session started that way cannot reach Google or PostHog. (On 2026-11-24 Alex chose to run SEO
audits himself in a normal tab, and the sandboxed variant was not built; the 2026-11-26 connection note above only
covers normal sessions.)

Since 2026-11-26 15:00 UTC `tools/agent-sandbox` has an opt-in profile `seo` (Alex approved it, including the Chromium
setting). It adds, read-only:
- the installed plugin (newest version under `~/.claude/plugins/cache/agricidaniel-claude-seo/claude-seo/`) at `~/claude-seo`;
- `~/.local/share/claude-seo` (its Python venv and Chromium) and `~/.config/claude-seo` (service account, API key);
- the `posthog` entry of `~/.claude.json` in the per-run `~/.claude.json`;
- `CLAUDE_SEO_CHROMIUM_REQUIRE_SANDBOX=0` in the environment and in the per-run copy of `settings.json`: Chromium's own
  sandbox cannot start inside bubblewrap, and the host setting (`1`, unchanged) makes the plugin refuse to render
  without it. Inside the profile bubblewrap is the containment.
An agent in this profile can read the Google service-account key and the PostHog key (both read-only). No ssh.

Launch: `agent-run --profile seo --job <dir> --name <n> -- claude --model <m> --permission-mode auto --plugin-dir
~/claude-seo "<task>"`. Without `--plugin-dir` the skills are not loaded. Checked inside the profile: 29 claude-seo
skills in a Claude run, `claude-seo run google_auth.py --check` all OK, live `gsc_query.py` and `ga4_report.py`, CrUX,
a PostHog `execute-sql` through the MCP server, and `render_page.py` (playwright-chromium). Probe again with
`tools/agent-sandbox --profile seo --job <dir> -- bash -c '~/claude-seo/scripts/claude-seo run google_auth.py --check'`.
The agent cannot `hc send` (no hc inside): have it report through a status file and read its screen with `hc read`.

Before the profile existed (the first hours of the 2026-11-26 audit) the workaround was: orchestrator exports the
Google and PostHog data into the job folder, plugin loaded from a copy with `--plugin-dir <job>/tools/claude-seo`,
Playwright and Chromium copied into the job folder with `PLAYWRIGHT_BROWSERS_PATH`. Not needed any more.
