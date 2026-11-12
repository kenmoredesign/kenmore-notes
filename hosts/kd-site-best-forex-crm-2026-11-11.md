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

## Blog index and featured images (follow-up, 2026-11-11 23:50–23:58 UTC, dev only)

- **dev /blog/ (page 23) has no featuring mechanism.** "Featured Posts" is a Getwid `getwid/recent-posts` block in page 23's
  content: post type `post` only, newest first, `ignore_sticky_posts`=1 (sticky is ignored), 100 posts, 2 columns, `medium`
  thumbnail uncropped (300×200), `<img alt>` = post title (not the attachment alt), text = excerpt cut to 17 words + "…".
  The sidebar "Recent Posts" is a second Getwid block (5 titles). `sticky_posts` is empty; `page_for_posts` 0.
- **Page 19999 shown first anyway (Alex's choice):** page 23 content now wraps a static card (Getwid card markup copied,
  hero 19994 medium size, 17-word description from the excerpt's first sentence) and the dynamic block in one group
  `.kd-blogfeat`; a scoped `<style>` makes the group the flex container and both inner wrappers `display:contents`, so the
  card flows in the same grid. Saved under the kt_auto guard; page 23's `_kt_source_hash` is now stale, so an editor save
  of page 23 queues 11 languages. Its 11 translations still have the old content. Revert: ops
  `wordpress/best-forex-crm/blog-featured/tools/save23.sh backup/page23-content-before.exact.html`.
- **Featured images replaced on the English posts:** 19919 19922→20007, 19918 19921→20008, 19917 19920→20009
  (imagegen medium, 1000×667 JPG). 19921 and 19922 were byte-identical files, so the breach and permissions posts had
  shown the same picture. Old images were used only as featured images (EN + 11 translations each, 33 translation posts
  still on the old ones), not in post bodies, options or Yoast social-image overrides.
- **`post meta update _thumbnail_id` alone leaves og:image stale** (Yoast indexable) and WP Rocket's cached post page
  stale; a guarded no-change `post update ID --post_status=publish` refreshes both (posts' post_modified becomes 23:57).
- Ops resize to JPG: `blog-featured/tools/resize.js` (canvas, quality 0.9).

## Rebuilt as a blog post (2026-11-12 16:20–16:50 UTC, dev only)

- **Post 20045** `https://dev.kenmoredesign.com/2026/11/12/best-forex-crm-providers/` (author alex, All About Forex, en)
  replaces page 19999; **19999 and 20000 trashed**. Hero 20046 (1600×704, featured), vendor screenshots 20047–20056
  (WebP 1200×675). Job folder ops `wordpress/best-forex-crm/blog-post/` (README has rebuild and undo).
- **dev has no way to add a redirect through the wrapper:** the active Redirection plugin (`redirect-redirection`, Inisev)
  stores rules in `wp_irrp_redirections` and adds them only via wp-admin AJAX. With the page trashed, WordPress core's
  404 slug guess 301s `/best-forex-crm-providers/` to the dated post (`x-redirect-by: WordPress`); `/…/methodology/` is
  a 404. Alex chose core-only.
- `wp dev db search '<text>' --all-tables` works through the wrapper (read-only, via wpdb) and is the way to "grep the DB".
- **kenmore-translate ran FR for page 23 at 10:07 UTC (queued 08:14, also 19917 in 11 languages, outside our sessions)**
  and copied the static /blog/ card into fr page 11146. Card removed from 23 (exact original bytes) and 11146 (card block
  only) since the post now heads the Getwid grid by itself.
- Blog single template: H1 + "By Alex | category | date", no featured image in the body, no TOC on any recent post.
  A wide (1600×704) featured image gives a 300×132 card on /blog/ next to 300×200 cards (Getwid uncropped `medium`).
- `post update <id> <file>` reads content from a file; Yoast og:image follows `_thumbnail_id` after a guarded no-op save.
