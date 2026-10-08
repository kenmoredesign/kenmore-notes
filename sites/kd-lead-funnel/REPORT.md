# KD lead-funnel audit: Phase 1 report

2026-10-07. Read-only on kd-site. Browser tests from the Ops box (188.245.16.25, Hetzner DE).
**No form submission reached any server**: all 258 test submits were intercepted in the browser
(capture mode), because I could not establish whether dev writes to the live SendPulse CRM.
Nothing was changed on dev or prod.

## 1. Verdict

1. **Yes, leads were lost, and nothing would tell us if they still are.** Until 2026-09-10 22:39
   the forms did not post at all: a script-order bug made every submit a plain GET that reached
   neither SendPulse nor email. Since that fix the browser side passes in all 12 languages.
2. **How many: not yet countable.** The only data is a 15-day recovery file (27 Aug to 10 Sep):
   52 lost submissions, 36 of them not auto-flagged as spam, but 34 of those 36 carry a link in
   the message, so the genuine count is somewhere between 2 and 36 for that fortnight. When the
   bug started is unknown (nginx keeps 14 days of logs).
3. **Main cause now: no safety net.** SendPulse is the only place a lead lands. Submissions are
   not stored, the server has no mail transport so the `hello@` notification cannot be sent, and
   on any SendPulse error the visitor still sees the success screen.

## 2. What the lead path really is

The brief assumed Contact Form 7. **CF7 is installed but unused**: one form (ID 1828) exists, no
published post or template embeds it, and nothing posts to its endpoint. kenmore-translate's CF7
message translation therefore has nothing to act on (its jQuery Validate translation does work).

| Path | Where | Validation | Spam protection | Stored | Mailed | Reaches SendPulse |
|---|---|---|---|---|---|---|
| Theme form `partials/form.blade.php`, 6 placements: inline on `/contact-us/`, modals `#contacts-modal`, `2`, `5` (demo) and `3`, `4` (PDF download) on every page, 12 languages | all pages | Browser only (jQuery Validate): first name, last name, email required; messenger value required once a type is picked. **Server validates nothing.** | Honeypot `website_url`; a 3-second timer that never fires (see 5.4). No nonce, no CAPTCHA, no rate limit beyond nginx's 2 POST/s per IP | **No** | `wp_mail` to the address in ACF option `emails`; **cannot send** (no sendmail, no SMTP config) | Custom code in `themes/sage/app/actions.php`: `admin-ajax.php?action=send_message` → OAuth token → `POST /crm/v1/contacts`, then phone / messenger sub-calls |
| Chat widget | Chatwoot at `chat.kenmoredesign.com`, site-wide via Head & Footer Code | n/a | n/a | In Chatwoot | n/a | Not from the site. Not inspected further |
| Calendly | Shown inside the form's success message | n/a | n/a | In Calendly | n/a | No |
| Newsletter, WhatsApp, Telegram, mailto links | **None exist** in templates or published content | | | | | |
| Phone number | Plain text in the footer | | | | | |

Other facts about the path:

- Credentials are constants defined outside the theme (so in `wp-config.php`, which I do not read).
- The PDF forms say "we will immediately email you the Business Plan PDF". The site sends the
  visitor nothing; it only sets a `PDF` attribute on the contact. Delivery depends on an
  automation inside SendPulse, which I could not check.
- UTM parameters are not captured. The mu-plugin `populate-utm-fields.php` targets Forminator,
  which is not installed, and is dead code.
- dev and live run identical theme code (`app/`, `views/`, `actions.js`, `scripts.js` all diff clean).

## 3. Form × language × result

Client side, dev, capture mode. Each cell is desktop 1440 / phone 390. "pass" means: empty
submit is blocked with a visible translated error, a valid submit fires exactly one POST with
the right fields, no JS errors, no horizontal overflow, submit button reachable and not covered.

| Language | Demo modal (home) | Inline (contact-us) | PDF modal | Error the visitor sees on empty submit | Server → SendPulse |
|---|---|---|---|---|---|
| en | pass / pass | pass / pass | pass / pass | This field is required. | not tested |
| fr | pass / pass | pass / pass | pass / pass | Ce champ est obligatoire. | not tested |
| es | pass / pass | pass / pass | pass / pass | Este campo es obligatorio. | not tested |
| ru | pass / pass | pass / pass | pass / pass | Это поле обязательно для заполнения. | not tested |
| tr | pass / pass | pass / pass | pass / pass | Bu alan zorunludur. | not tested |
| zh | pass / pass | pass / pass | pass / pass | 此字段为必填项。 | not tested |
| ja | pass / pass | pass / pass | pass / pass | この項目は必須です。 | not tested |
| ko | pass / pass | pass / pass | pass / pass | 이 필드는 필수입니다. | not tested |
| ar (RTL) | pass / pass | pass / pass | pass / pass | هذه الخانة مطلوبة. | not tested |
| fa (RTL) | pass / pass | pass / pass | pass / pass | پر کردن این فیلد الزامی است. | not tested |
| he (RTL) | pass / pass | pass / pass | pass / pass | שדה זה חובה. | not tested |
| ku | pass / pass | pass / pass | pass / pass | Ev zehfî pêdivî ye. | not tested |

144 runs, 143 clean first time; one page-load timeout (he, desktop, contact) passed on re-run.
Prod, load only (24 loads, no submit clicked): form present and validator bound in every
language at both widths. No Cloudflare challenge or CAPTCHA at any point.

Edge cases (contact form, en + ar + zh, both widths, 6 runs each): the browser accepts all of them.

| Input | Result |
|---|---|
| Phone `+971 50 123 4567`, `0044 7911 123456`, `(212) 555-0100` | posted 6/6, sent verbatim |
| WhatsApp `+7 (495) 123-45-67`, Telegram `@test_handle` | posted 6/6 |
| Messenger type picked, value left empty | blocked 6/6 with "This field is required." |
| Names in Arabic, Chinese, Cyrillic, `O'Brien-Smith` | posted 6/6 |
| Company name, 220 characters | posted 6/6, not truncated |
| Email `@firm.technology`, `@пример.рф`, `+tag@mail.co.uk`, trailing space | posted 6/6 (space trimmed) |
| Email `test@localhost` (no TLD) | posted 6/6: accepted, should not be |
| Website `testcompany.com`, `none yet` | posted 6/6 |
| Multi-line message with emoji, quotes, `<tags>` | posted 6/6 |

**The untested half is the one that matters.** Nothing in the browser blocks a real visitor, so
any remaining loss is between PHP and SendPulse. Candidates I can name from the code but not
verify: `Website URL`, `First Page Seen` and `Last Page Seen` are sent as SendPulse *link*
attributes, so a free-text website ("none yet") may make the API reject the whole contact; an
IDN or TLD-less email may do the same. One rejected attribute loses the lead, silently.

Mobile and RTL defects (cosmetic, none blocks a submit):

- The phone number is typed into a `type="text"` field (`im`), so phones show the letter
  keyboard. The real `type="tel"` field is never displayed. No `autocomplete` on any field.
- RTL: the dropdown chevron overlaps the "Phone or Messenger" label in ar, fa, he.
- "Messenger" is left in English in ar, he, fr, es, ru, tr, zh.
- Kurdish: the switcher shows the Sorani name (کوردی, locale `ckb`) but the content is Kurmanji
  in Latin script, with weak strings ("Phone an Messenger", "Nû bide"). LTR is right for what is
  actually served.
- The chat bubble sits over the right end of the submit button on phones; the button stays tappable.

## 4. Evidence of loss (step 2)

| Source | 90-day view | What it showed |
|---|---|---|
| nginx access and error logs | **Not available.** Files are `www-data:adm 640` and unreadable to `claude`; only 14 days are kept; the format has no country field | Nothing. Boundary reported, not worked around |
| Stored submissions | None exist anywhere | |
| Mail log | None; there is no MTA on kd-site | Notification emails cannot be going out from this server |
| PHP errors (where `SendPulse …` failures are logged) | Root-only FPM log | Not readable |
| SendPulse records | No API access | |
| WP database | Token transient on live was last issued about 16:30 UTC today, so credentials work and a submission was processed today. One `ip_geo_*` transient confirms the ip-api fallback ran | Proves the path is alive, not that contacts are created |
| `/home/claude/leads Sep11.csv` on kd-site | 27 Aug to 10 Sep | 52 rows: 36 `candidate`, 11 `bot_honeypot_filled`, 5 likely spam. All geo and page fields empty. Read as aggregates only |

On that CSV: it was written 49 minutes after `setup.php` was fixed on 10 Sep, and its columns
(`ip`, `page`, `user_agent`) are what a log line holds, so I read it as the submissions recovered
from access logs at the time of the fix. That is an inference. I do not know whether those rows
were ever entered into the CRM. All 11 honeypot rows have the honeypot equal to the website
field, which fits bots filling every URL-like field. Of the 36 candidates, 34 have a link in
the message and 25 use free-mail addresses, so most are probably solicitations; someone should
look at the 36 by eye.

**Outcome events: none.** `actions.js` pushes nothing to `dataLayer` and calls no PostHog
capture on success or failure; the only dataLayer events are GTM's own. PostHog autocapture
sees the click, not the outcome. The CF7 events (invalid, spam, mailfailed, mailsent) cannot
fire because CF7 is not in the path.

## 5. Geo fields (step 5)

The hypothesis is the wrong way round. **City and timezone are the trustworthy ones; country is not.**

1. `IP Country`, `First Page Seen` and the referrer are written into the page HTML by PHP
   (`wp_localize_script` in `setup.php`, from `CF-IPCountry` and the visitor's cookies) and
   copied into the form by JavaScript. WP Rocket then caches that HTML, so every later visitor
   submits the values of **whoever caused the page to be cached**. Of 863 cached pages on live:
   777 say `DE` (the cache preloader, running from the server in Germany), 49 `US`, 9 `CN`, and
   the rest 18 other countries. Cached pages likewise carry someone else's first page and referrer.
2. `IP City` and `IP Timezone` are meant to come from Cloudflare's `CF-IPCity` / `CF-IPTimezone`
   headers, which are empty in all 863 cached pages (the "visitor location headers" transform is
   evidently off). The handler then falls back to an ip-api.com lookup at submit time, on
   `X-Forwarded-For`, which behind Cloudflare is the real visitor.
3. nginx real-IP handling is correct: `real_ip_header CF-Connecting-IP` with 15 Cloudflare ranges.
4. So "Frankfurt am Main / RU / Europe/Berlin" reads as: a submitter whose IP is in Frankfurt
   (commonly a VPN or datacentre), on a page first cached for a Russian visitor.
5. The 3-second anti-bot timer uses `form_time`, also baked into cached HTML, so it is always
   hours old and never triggers. Harmless, and useless.

PostHog: there is **no reverse proxy**. It loads through GTM from `us-assets.i.posthog.com` and
reports straight to `us.i.posthog.com`; no nginx vhost on kd-site proxies it. Its geo is
therefore PostHog's own lookup of the real client IP and should be sound, but ad blockers will
drop a share of sessions. I could not confirm inside PostHog without access.

Ops-box comparison: not possible yet, since no test lead was created. Expected for a real test
from 188.245.16.25: country whatever the page was cached with (often `DE`, right by
coincidence), city and timezone from ip-api for a Hetzner address, `Europe/Berlin`.

## 6. Lead sources (step 4)

**Not delivered.** Twelve months by country, language, landing page and referrer cannot come
from this server: 14 days of logs, unreadable to me, with no country field, and no stored
submissions. The CRM's own country and first-page fields are unreliable for the reason in 5.1.
PostHog is the only source that can answer this, and it needs a read key.

What I could establish:

- `robots.txt` on live has a single `User-agent: *` group and no AI-specific rule. `llms.txt` exists.
- Requests with the user agents GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User,
  PerplexityBot, Perplexity-User, Google-Extended, CCBot, Bytespider, Amazonbot and
  meta-externalagent all returned 200 through Cloudflare. That is a user-agent test from one
  IP; a Cloudflare "block AI bots" setting, if on, could still treat real crawler IPs differently.
- Side note for SEO: `robots.txt` disallows `/wp-content/themes/` and `/wp-content/cache/`,
  which is where the site's CSS and JS live, so Google cannot fully render the pages.
- AI referrers and crawler hit counts: need the logs or PostHog.

## 7. Ranked fixes

| # | Fix | Effort | Expected impact |
|---|---|---|---|
| 1 | Record every submission on the server before calling SendPulse, with the API result, and show the visitor an error if the contact was not created | S | Ends silent loss; gives the first real loss number within a week |
| 2 | Give `wp_mail` a transport (SendPulse SMTP, credentials in `wp-config.php`) so `hello@` receives every lead as a second copy | S, needs root for the config | Independent backup channel |
| 3 | Read country, first page and referrer at submit time on the server (`CF-IPCountry` header, cookies) instead of from cached HTML | S | Correct geo and attribution on every lead |
| 4 | Push `lead_submit_ok` / `lead_submit_error` to `dataLayer` and PostHog from `actions.js` | S | Funnel becomes measurable; a repeat of September shows up the same day |
| 5 | Serve jquery.validate from the theme, not cdnjs, and give the form `method="post"` | S | If the script fails again, submits no longer vanish into a GET, and visitor details stop landing in URLs seen by GA, Clarity, LinkedIn and PostHog |
| 6 | Server-side checks: valid email with a TLD, no URL in name fields, set `form_time` in JavaScript so the timer works | S | Fewer junk contacts in the CRM. Direct bot POSTs currently go straight in |
| 7 | Normalise the website value to a URL or send it as text; keep message line breaks (`sanitize_textarea_field`) | S | Removes the most likely cause of rejected contacts; confirm with test leads first |
| 8 | Phone field `type="tel"`, `autocomplete` attributes, RTL chevron, translate "Messenger", fix the Kurdish label | S | Mobile completion rate, mostly in RTL markets |
| 9 | nginx log format with `CF-IPCountry`, 90-day retention, and a read wrapper for `claude` | M, needs root | The next audit has data |
| 10 | Remove dead parts: CF7, form 1828, the Forminator mu-plugin; decide whether UTM capture is wanted | S | Less confusion. UTM capture would be new work |

Fix 1 comes first because every other number in this report depends on it.

## 8. Open, and what I need to finish Phase 1

1. **Does dev write to the live SendPulse CRM?** It depends on whether dev's `wp-config.php`
   defines the SendPulse constants, and I do not open that file. dev's database has never held a
   token transient, which hints that nobody has submitted there, nothing more. Tell me, or allow
   a count-only `grep -c SENDPULSE` on that one file. Then I need your OK for about 25 TEST leads
   from dev, which is the only way to test the server half and the Ops-box geo comparison.
2. **SendPulse API read access**: contacts created per day against submissions, and which
   attribute values the API rejects.
3. **PostHog read key and project ID**: step 4 in full, and the start date of the GET-fallback
   bug (pageviews whose URL contains `firstname=`).
4. **Log access on kd-site**: nginx access and error logs and the PHP-FPM log.
5. Confirm whether the 36 candidates in `leads Sep11.csv` were followed up.
6. dev loads the same GTM, PostHog, Clarity and LinkedIn tags as live. Today's tests added
   roughly 300 dev page loads from 188.245.16.25; filter that IP or the `dev.` host in reports.

## 9. HANDBACK

```
KD lead-funnel audit, Phase 1 (2026-10-07). Read-only, nothing changed, no test lead sent.
FOUND: forms are a custom theme AJAX handler -> SendPulse API, not CF7 (CF7 is unused).
Until 10 Sep a script-order bug turned every submit into a GET that reached nobody; fixed then.
Since: browser side passes in 12 languages x 3 forms x desktop/phone, incl. RTL and edge inputs.
No safety net: submissions are not stored, server cannot send mail, SendPulse errors are silent.
Geo: IP Country, first page and referrer come from cached HTML (wrong visitor); city/timezone are right.
No outcome events in GTM/PostHog; PostHog has no reverse proxy. AI crawlers are not blocked.
OPEN: loss rate still unmeasured. Need: does dev hit live CRM + OK for TEST leads, SendPulse API
read, PostHog read key, nginx/PHP log access. 12-month source breakdown blocked on PostHog.
UNLOCKS: fix 1 (store + log each submission) gives a real loss number in a week; fix 3 makes CRM geo usable.
```

## Update 2026-10-08

**Urgent, outside the audit scope: kd-site serves raw files by IP.** The port-80 catch-all
vhost in `000-default` has `root /var/www/html` and no PHP handler, so
`http://78.47.190.199/kdsites/site/wp-config.php` answers `200`, `application/octet-stream`,
3731 bytes, from the Ops box over the public address. `kdsites/dev.zip` (2.8 GB, a full copy of
dev) answers 200 too. Directory listing is off (`_backups/` gives 403), but the restore-point
zips have dated, guessable names. Checked with HEAD requests only; no body was downloaded.
Every `wp-config.php` under `/var/www/html` is presumably reachable the same way. Closing it
needs root (make the catch-all `return 444;`), then the database password, the SendPulse
secret, the WordPress salts and any other key in those files should be treated as disclosed.
This also rules out keeping a lead log as a file anywhere under `/var/www/html`.

**dev and live use the same SendPulse credentials.** SHA-256 of the three `SENDPULSE_*` lines,
whitespace-normalised: match. Test leads from dev land in the live CRM.

**September bug: closed** by the owner; leads recovered. No further loss-dating.

**Parked** until the Ops secrets wrapper exists: SendPulse and PostHog API comparison, step 4.

**Fix 1 (submission log) is written, linted, and not deployed.** `fix1-submission-log.patch`
changes one file, `themes/sage/app/actions.php`:

- Every POST to `send_message` is inserted into a table before SendPulse is called, then
  updated with the result. Columns: time (UTC), status, SendPulse contact id, SendPulse error
  text, IP, `CF-IPCountry` read at submit time, user agent, the posted fields as JSON.
- Status is `received`, `created`, `created_partial` (contact made, phone or messenger call
  failed), `failed`, `honeypot` or `too_fast`. A row left at `received` means PHP died mid-call.
- The table is `leadlog_<database name>`, with no `wp_` prefix. `migrate-dev-to-live.sh` runs
  `wp db clean` (prefixed tables only) and imports dev's dump, so a prefixed or shared name
  would be wiped or overwritten on every migration. With this name live's rows survive; dev's
  own log table arrives as an extra table and can be ignored.
- What the visitor sees and what is sent to SendPulse are unchanged. A logging error can never
  break a submission.
- Read it with `sudo /usr/local/lib/kenmore-ops/wp site db query "SELECT id, created_at, status, sp_contact_id, sp_error FROM leadlog_kenmore_sage ORDER BY id DESC LIMIT 50"`.

It is not deployed because the only wrapper on kd-site is `wp`, which cannot replace a file,
and host changes go through a wrapper. `~/ops/bin/theme-file` is written for this (replace one
existing theme file from stdin, PHP lint, copy before and after to
`/var/backups/kenmore-ops/theme/`, print both checksums) and needs a root install.

**Test leads: ready, not sent.** `node forms.js --send --plan --email ADDR` sends 26 leads from
dev: one baseline per language across the three form types and both widths, then phones,
messengers, non-Latin names, a 220-character company and five website variants (bare domain,
`www.`, full URL, "none yet", free text with spaces). Names and company start with TEST. The
deletion list is written to `out/dev.kenmoredesign.com-send/sent.csv`. Waiting on the address.
All 26 use one email address; if SendPulse merges or rejects contacts by email, that will show
in the log and is worth knowing for repeat enquirers.

**Closed 2026-10-08 12:17 UTC.** The catch-all block now returns 444 (one edit in `000-default`, backup in `/root/nginx-backup-20261008/`). Verified by public IP on v4 and v6: `wp-config.php`, `dev.zip` and a real `_backups` zip get no reply; live, dev, a demo and 2sto still load. Credential rotation is still open. `claude` was added to `adm`, so nginx logs are now readable.

## Re-running the tests

Scripts are in this directory; see `README.md`. Results and screenshots go to `out/` (not in git).
