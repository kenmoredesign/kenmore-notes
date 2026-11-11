# kd-site: "Best Forex CRM Providers 2026–2027" on dev (2026-11-11)

Dev only (dev.kenmoredesign.com). Nothing on www; deploy-dev-to-live.sh not run. Job folder: ops `wordpress/best-forex-crm/`
(sources, scripts, prompts, backups, screenshots, `README.md` with undo). Inputs from `/srv/incoming/kenmoredesign/content/`.

## What exists on dev

- **Page 19999** `/best-forex-crm-providers/` (publish, author alex = 2, lang en, No Menu Page Template, featured 19994).
- **Page 20000** `/best-forex-crm-providers/methodology/` (child of 19999): scoring.md + method-changelog.md, title
  "How we ranked: full scoring and changelog", anchors `#scoring`, `#years-serving-fx-brokers`, `#full-score-table`, `#changelog`.
- **Attachments 19994–19998** `uploads/2026/11/bfc-0N-*.png` (1000×667, imagegen medium): hero, how-we-ranked, track-record,
  platform-independence, also-considered.
- Created 23:05 UTC and re-saved three times (CSS fixes) under the kt_auto guard; kenmore-translate queued nothing;
  no translations exist. Verified 45/45 (`tools/verify.py`).

## Durable facts learned

- **dev permalinks are `/%year%/%monthnum%/%day%/%postname%/`** and no custom-permalink plugin is installed, so an
  undated URL for a blog-style article needs a **page**. Pages have no category/tags and their templates don't print the
  post byline. Every page template (`page.blade.php` always; `template.no.menu.page`/`menu-api` when ACF `subtitle` is set)
  puts a hero with the featured image above the content; `template.no.menu.page` with an empty `subtitle` prints only
  `the_content()` in `.wrap-content.tpg`, then its own `accelerate-section` CTA from the Content Pages ACF fields
  (`pre_footer_*`, keys `field_67e552b0f59d9`/`b7f59da`/`c0f59db`/`c7f59dc`) and an empty `pre-footer-text-section`.
- On that template with no hero, the fixed header (bottom at 134px desktop, 115px at 390) covers the first ~80px of
  content; blog posts put the H1 at y=140. The page's scoped CSS adds `padding-top:80px` to match.
- `.tpg` typography is larger than posts' (p 20px, h2 36px, h1 72px/900 vs post h1 36px/700, p 18px, h2 27px, h3 21px);
  the page's scoped CSS resets to the post values.
- Recent English posts (19917–19919, 2026-11-09): no tags, empty excerpt, one category each, Yoast title/metadesc/focuskw,
  featured image 1000×667 jpg not shown in the post body; Alex's posts end with the `kd-author` "Written by" box
  (wp:html, own `<style>`) then the "Request a Consultation on …" `accelerate-section` in a wp:html block. Outbound links:
  `target="_blank" rel="noreferrer noopener"`; internal links relative.
- **deploy-dev-to-live.sh search-replaces `dev.kenmoredesign.com` → `www.kenmoredesign.com` across all tables.** Content
  that must keep saying "dev.kenmoredesign.com" after a deploy (e.g. "crawled from its staging site, dev.kenmoredesign.com")
  is stored as `dev&#46;kenmoredesign.com` (renders identically). Six such mentions are on page 20000.
- **imagegen runs in parallel can swap outputs**: two concurrent `imagegen generate` calls returned the same
  `last_message` file and their PNGs came back under each other's names. Render one at a time.
- Ops has no ImageMagick/PIL; resize with headless Chromium canvas (`tools/resize.js` in the job folder).
- markdown-it-py replaces NUL with U+FFFD, so NUL-delimited placeholder tokens don't survive parsing.

## Open points for Alex

- Before launch: the handoff's post-launch check (dev→www statements), the `[LAUNCH DATE: …]` placeholder (left visible,
  highlighted), canonical/JSON-LD URLs become www through the deploy's search-replace.
- Any editor save of 19999/20000 while `kt_auto`=1 queues 11 languages (no `_kt_source_hash`); re-save with the job's
  `tools/update.sh`, or translate deliberately.
