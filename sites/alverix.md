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

## Working notes (2026-10-01)
- `sudo /usr/local/lib/kenmore-ops/wp alverix …` runs wp-cli as user `alverix`. Exports
  go to `/var/backups/kenmore-ops/alverix/`, which `claude` cannot list.
- Writing `_elementor_data`: pipe the JSON to `post meta update 11 _elementor_data` on
  stdin, without the trailing newline that `post meta get` adds. Verified by a
  byte-for-byte round trip of the unchanged value.
- wp-eu has no `/srv/incoming`; incoming files live on the ops machine. Images were
  copied to `/tmp/alverix-import/` on wp-eu for `media import` and the folder removed.
- GD and Imagick are both present, so imports get the usual resized renditions.
