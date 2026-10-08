# alverix (www.alverix.net, wp-eu)

## 2026-10-01: Match-Trader picture section on the Platform page

**Page:** "Platform", ID 11, slug `platform`, https://www.alverix.net/platform/. Built with
Elementor (4.2.2, flex containers, data in post meta `_elementor_data`). WordPress 7.1.2.

**Context found:** Match-Trader is the only platform. It was already on the page as a
text-only block (`kd_platforms()` from the `kd-platforms.php` mu-plugin, appended after
the Elementor content by the `the_content` filter in `kd-broker-sections.php`). Copy
trading was removed from that block on 2026-09-07, so images showing Copy Trading or
Prop tabs were excluded.

**What changed**
- Five images imported into the media library (`uploads/2026/10/`), from
  `/srv/incoming/alverix/images.zip` on the ops machine:

  | ID | File | Source in the zip |
  |---|---|---|
  | 691 | `match-trader-desktop.png` | `Desktop/MTR__dark_desktop_mockup_10.png` |
  | 692 | `match-trader-tablet.png` | `Simple background/MTR_tablet_13.png` |
  | 693 | `match-trader-mobile.png` | `Mobile/Mobile_mix_04.png` |
  | 694 | `match-trader-order-ticket.png` | `Screens/Mobile_white_07.png` |
  | 695 | `match-trader-analytics.png` | `Screens/Mobile_dark_01.png` |

- One top-level Elementor container appended to the end of page 11's `_elementor_data`
  (element ids `a7d31f0`–`a7d31fe`, CSS id `match-trader`). It sits after the
  "Open Live Account" call-to-action (`69a0fb6`) and directly above the mu-plugin's
  "One platform, everywhere you trade." block. Heading "Match-Trader, on every screen",
  one paragraph, the five images, captions "Order ticket" and "Analytics".
- The seven existing containers are byte-identical to before. No mu-plugin or other
  file was edited. Elementor CSS cache flushed.

**Database exports** (on wp-eu, readable only by `alverix`; not opened)
- Before: `/var/backups/kenmore-ops/alverix/20261001-110240-before.sql`
- After: `/var/backups/kenmore-ops/alverix/20261001-110240-after.sql`

**Page data copies** (this repo): `alverix-page11-elementor-before.json` and
`alverix-page11-elementor-after.json`, as printed by `post meta get`.

**How to revert**

Targeted (only this change):

    head -c -1 ~/notes/sites/alverix-page11-elementor-before.json | ssh wp-eu 'sudo /usr/local/lib/kenmore-ops/wp alverix post meta update 11 _elementor_data'
    ssh wp-eu 'sudo /usr/local/lib/kenmore-ops/wp alverix elementor flush_css'
    ssh wp-eu 'sudo /usr/local/lib/kenmore-ops/wp alverix post delete 691 692 693 694 695 --force'

Full database restore (also discards everything else written since 11:02 on
2026-10-01, and leaves the image files in `uploads/2026/10/`):

    ssh wp-eu 'sudo /usr/local/lib/kenmore-ops/wp alverix db import /var/backups/kenmore-ops/alverix/20261001-110240-before.sql'

## 2026-10-01 (later): section rebuilt with an Image Carousel

Same write path as above. The first version (three stacked rows) was replaced; the
seven original containers are still byte-identical to `alverix-page11-elementor-before.json`.

**What it is now** (element ids `a7d31f0`–`a7d31f9`, CSS id `match-trader`)
- Container settings copied from the existing `c0ad78c` section (and its inner
  `7a009d4` / `f0e3691` / column containers).
- Row 1: heading and paragraph left, desktop image (691) right. Text unchanged.
- Row 2: Elementor Image Carousel of 692, 693, 694, 695. Three per view on desktop,
  two on tablet, one on mobile; dots, no arrows, no autoplay, captions on.
- Captions come from the attachment caption (`post_excerpt`), set on 692–695:
  "Tablet", "Mobile app", "Order ticket", "Analytics".
- An HTML widget (`a7d31f9`) holds one `<style>` rule giving every slide image the
  same height (420px, 340px under 768px) with `object-fit: contain`. Without it the
  tall phone screens stretch the carousel. Elementor free has no control for this.

**Checked** with `~/ops/tools/shot` at 1440 and 390; two rounds (round 1 had unequal
slide heights). Final screenshots on the ops machine:
`/srv/incoming/alverix/review/platform-match-trader-1440.png` and `-390.png`. The dark
band across them is the site's fixed bottom ticker, not part of the section.

**Database exports for this change**
- Before: `/var/backups/kenmore-ops/alverix/20261001-124406-before.sql`
- After: `/var/backups/kenmore-ops/alverix/20261001-124406-after.sql`

`alverix-page11-elementor-after.json` in this repo is now the carousel version. The
revert commands above still apply and remove the whole section; the full-restore
alternative for this change is the `20261001-124406-before.sql` export, which goes
back to the first (stacked) version.

## 2026-10-01 13:00: page title and mobile section

- Page title (`post_title`) "Platform" → "Match-Trader Platform". Slug stays `platform`
  (the mu-plugin injection keys on it). The hero H1 (Elementor heading `786610c`) was
  changed to match. Browser title is now "Match-Trader Platform – Alverix".
- The nav menu item (db_id 19) inherited the new title, so its label was set back to
  "Platform" explicitly with `menu item update 19 --title=Platform`.
- Section `c0ad78c` (was "Keep Your Terminal Light by Streaming Only the Symbols You
  Trade", with a generic phone mock-up, attachment 601): heading now "Trade From Your
  Phone on the Same Account", new paragraph about the iOS/Android app, image replaced
  with attachment 696 `match-trader-phone.jpg` (`Simple background/MTR_Mobile_dark_13.jpg`
  in the zip). The "See All Instruments" button is unchanged. Attachment 601 is kept.
- Screenshots: `/srv/incoming/alverix/review/platform-hero-{1440,390}.png` and
  `platform-mobile-section-{1440,390}.png`.
- Exports: `/var/backups/kenmore-ops/alverix/20261001-130046-before.sql` and
  `…-130046-after.sql`.
- Revert this change only:

      head -c -1 ~/notes/sites/alverix-page11-elementor-before-20261001-1300.json | ssh wp-eu 'sudo /usr/local/lib/kenmore-ops/wp alverix post meta update 11 _elementor_data'
      ssh wp-eu "sudo /usr/local/lib/kenmore-ops/wp alverix post update 11 --post_title=Platform"
      ssh wp-eu 'sudo /usr/local/lib/kenmore-ops/wp alverix elementor flush_css'
      ssh wp-eu 'sudo /usr/local/lib/kenmore-ops/wp alverix post delete 696 --force'

  `alverix-page11-elementor-after.json` is the current page data.

## 2026-10-01 13:40: Match-Trader section moved up

- The `a7d31f0` (`#match-trader`) container moved from last to second in page 11's
  `_elementor_data`, directly under the hero. Order is now: hero, Match-Trader,
  instruments, accounts table image, "Everything You Need", mobile section, "best way
  to access", call-to-action. Contents of every container are unchanged.
- Screenshots: `/srv/incoming/alverix/review/platform-full-{1440,390}.png`.
- Exports: `/var/backups/kenmore-ops/alverix/20261001-134025-before.sql` and
  `…-134025-after.sql`.
- Revert this move only:

      head -c -1 ~/notes/sites/alverix-page11-elementor-before-20261001-1340.json | ssh wp-eu 'sudo /usr/local/lib/kenmore-ops/wp alverix post meta update 11 _elementor_data'
      ssh wp-eu 'sudo /usr/local/lib/kenmore-ops/wp alverix elementor flush_css'

## 2026-10-08: account types aligned to the client's source table

Names are now **Standard / Raw / Prime** everywhere ("Raw Spread" → Raw, "Professional"/"Pro" → Prime).
"accounts classified as professional" in the negative-balance FAQ is the regulatory category and was kept.

**Values** (client source of truth): deposit $100 / $500 / $10,000; minimum FX spread From 1.2 / 0.2 / 0.2 pips;
FX commission per side $0 / $3.50 / $2.50, per round turn $0 / $7 / $5; Up to 1:500 on all three;
Margin Call / Stop Out 100% / 50%; currencies USD, EUR; support Standard / Priority / Personal manager;
EAs, scalping and hedging allowed; swap-free on request; min volume 0.01 lot; market execution.
Product codes (standard / raw / prime) are not used anywhere on the site.

**Where account data lives**
- `mu-plugins/kd-broker-sections.php`, `kd_broker_tiers()`: single source for the Home and Account Types
  cards and for the full comparison table that the `[kd_broker_accounts]` shortcode now adds on `/accounts/`
  (`kd_broker_compare()`, reusing the `.kdb-table` styles).
- `mu-plugins/kd-education.php`: glossary leverage example (now "1:500 means $200 controls $100,000").
- SVG panels referenced by attachment ID from Elementor image widgets. New files in `uploads/2026/10/`,
  old ones in `2026/08/` kept: core-features-en-v2 (698, Platform `7de2662`), spreads-panel-en-v2 (699,
  Home `1389999`), markets-grid-en-v2 (700, Home `006e274`), api-connectivity-en-v2 (701, About `b3ca73c`).
  Safe-svg strips `role="img"` and whitespace on import; text and elements survive.
- Elementor text: FAQ "typical spreads" on Account Types (9) and Contact (13), Home feature box `374f015`,
  About stat `b052176` (0.2), Platform feature box `26020db` ("Personal account manager").
- Also removed claims the source doesn't back: dedicated analyst, financing rates, Free VPS tiers, FIX/LD4
  tied to Professional, and the AVG column of the spreads panel. Copy-trading box removed from the
  connectivity diagram.

**Backups**
- DB: `/var/backups/kenmore-ops/alverix/20261008-103700-before.sql` and `…-after.sql`.
- PHP: `kd-broker-sections.php.bak-20261008` and `kd-education.php.bak-20261008` next to the originals.
- Review bundle (diffs, staged files, previews, screenshots): `/srv/incoming/alverix/account-types-20261008/`
  and `/srv/incoming/alverix/review/account-types-20261008/` on the ops machine.

**Rollback**

    # as root on wp-eu
    cd /var/www/alverix/public/wp-content/mu-plugins && for f in kd-broker-sections kd-education; do cp -p $f.php.bak-20261008 $f.php; done
    # as claude
    ssh wp-eu 'sudo /usr/local/lib/kenmore-ops/wp alverix db import /var/backups/kenmore-ops/alverix/20261008-103700-before.sql'
    ssh wp-eu 'sudo /usr/local/lib/kenmore-ops/wp alverix elementor flush_css'

**How file edits were done:** `claude` cannot write in `mu-plugins/` (owned by `alverix`) and the `wp`
wrapper writes no files. PHP was staged in `/tmp/alverix-acct/` with SHA256SUMS and installed by root.
SVGs went in with `media import --user=alverixadmin` (safe-svg only accepts SVG from a user with
upload rights).

## Working notes (2026-10-01)
- `sudo /usr/local/lib/kenmore-ops/wp alverix …` runs wp-cli as user `alverix`. Exports
  go to `/var/backups/kenmore-ops/alverix/`, which `claude` cannot list.
- Writing `_elementor_data`: pipe the JSON to `post meta update 11 _elementor_data` on
  stdin, without the trailing newline that `post meta get` adds. Verified by a
  byte-for-byte round trip of the unchanged value.
- wp-eu has no `/srv/incoming`; incoming files live on the ops machine. Images were
  copied to `/tmp/alverix-import/` on wp-eu for `media import` and the folder removed.
- GD and Imagick are both present, so imports get the usual resized renditions.
- Don't use `?m=` as a cache-busting parameter when fetching or screenshotting: `m` is
  WordPress's date-archive query var and returns the 404 template. Use e.g. `?shot=`.
