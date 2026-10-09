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

### 14-day comparison of form POSTs against SendPulse errors (live, 24 Sep to 8 Oct)

Source: nginx `access.log` and `error.log`, readable since `claude` joined `adm`. The log does
not record the POST body, so form submissions were identified by response size: the success
message is 261 bytes, 205 gzipped, 216 on the wire, and 41 POSTs to `admin-ajax.php` got exactly
that (216 or 218 bytes).

| | Count, 15 days |
|---|---|
| POSTs to `admin-ajax.php` on live | 1,288 |
| of which Action Scheduler loopbacks from the server itself (kenmore-translate queue) | 920 |
| of which WP Rocket front-end beacons and wp-admin traffic | about 180 |
| of which bots: 301 (wrong host), 400 (no action), 403 | 144 |
| **Form submissions answered with the success message** | **41**, from 34 IPs, about 2.7 a day |
| Form submissions dropped by the honeypot or timer | 2 |
| `SendPulse …` errors in the error log | **0** |
| PHP fatals on `admin-ajax.php` | 0 |
| 499 (visitor's browser gave up before the reply) on a form page | 2 (7 Oct 11:06 from `/contact-us/`, 2 Oct 02:03 from a blog post) |
| 502 | 1 (1 Oct, no referring page) |

Reading: PHP messages do reach that error log (80,507 in the window), and the handler logs
every token, API and create-contact failure there, so **no SendPulse call failed for these 41
submissions**. Loss at this step in the last 15 days is at most the two 499s, whose outcome is
unknown. What this cannot show is a contact that SendPulse accepted but stored incompletely;
the test leads and fix 1 cover that.

Where the 41 came from: an Arabic blog post on funded-account challenges (7), `/contact-us/` (5),
home (3), `/zh/contact-us/` (2), the brokerage business-plan page (2), `/prop-firm-solutions/` (2),
`/ar/` (2), the rest one each. Devices: 18 phone (14 Android, 4 iPhone), 23 desktop.

Also in the log: **295 GET requests with `firstname=` in the URL** in the same 15 days, up to 76
in a day. With the September bug fixed these are bots that submit the form without running
JavaScript; they reach nobody. They do put whatever the bot typed into URLs.

dev received 3 success-sized submissions in the window, all from Meta's crawler range
(`2a03:2880::/32`). They went into the live CRM.

## Update 2026-10-09: fix 1 on dev, 26 TEST leads

**Fix 1 is on dev** (not on live). `themes/sage/app/actions.php` on dev was replaced with the
patched version in a root window at 12:45 UTC; backups before and after are in
`/var/backups/kenmore-ops/changes-20261009/` on kd-site (`dev-actions.php.before`, `.after`).
Live's file is unchanged. A dev-to-live migration would carry the patched file to live, so run
none until fix 1 is approved for live or the file is put back.

**26 TEST leads sent from dev, 12:46 to 12:52 UTC,** with dev on the new SendPulse pair.
`test-leads-2026-10-09.csv` is the deletion list: number, time, address
(`testeeee+01@kedddd.com` to `+26`), SendPulse contact id, name, company, form, language, case.

What dev's submission log (`leadlog_kenmore_dev`) recorded:

| | |
|---|---|
| Rows | 26, one per lead |
| Status | `created` for all 26; no `failed`, no `created_partial`, none stuck at `received` |
| SendPulse contact id | present on every row (43962776 to 43962924) |
| SendPulse error text | empty on every row; no `SendPulse` line in dev's PHP log |
| Source IP, country at submit time | `2a01:4f8:1c16:dcc1::1` (the Ops box, IPv6), `DE` |
| Stored fields | all 18 posted fields, non-Latin names and the 220-character company intact |

So every case was accepted by the API, including the ones suspected of being rejected: website
as a bare domain, `www.` without scheme, a full URL, "none yet", free text with spaces; phones
with spaces, `00` prefix; WhatsApp and Telegram handles; Arabic, Chinese, Cyrillic names;
`O'Brien-Smith`. The link-type attribute did not cause a rejection. **Accepted is not the same
as stored correctly:** whether the website, phone and messenger values and the apostrophe look
right on each contact can only be seen in the SendPulse UI. Lead 20 (`O'Brien-Smith`) is the one
to look at: the handler sends form values to SendPulse without removing the backslash
WordPress adds before an apostrophe.

Geo, for the comparison with the Ops box: the leads went out over IPv6 from
`2a01:4f8:1c16:dcc1::1` (Hetzner, Germany). `IP Country` should read `DE` on all 26, which
here is right by coincidence (the page's baked-in value and the real one agree). `IP City` and
`IP Timezone` come from the ip-api lookup of that address at submit time and are not in the
log; they should be a Hetzner location and `Europe/Berlin`.

The plan lists 27 cases and sends the first 26; "message multiline + emoji" was the one left out.

## Status at pause, 2026-10-09

**Fix 1 is live** since 13:53 UTC on 2026-10-09 (same file as dev; backups in
`/var/backups/kenmore-ops/changes-20261009/` on kd-site). Every form submission on live is now
written to the table `leadlog_kenmore_sage` before SendPulse is called and updated with the
result. Read it with:

```sh
ssh kd-site 'sudo /usr/local/lib/kenmore-ops/wp site db query "SELECT id, created_at, status, sp_contact_id, country, LEFT(sp_error,120) err FROM leadlog_kenmore_sage ORDER BY id DESC LIMIT 50"'
```

`status` is `created`, `created_partial` (contact made, phone or messenger call failed),
`failed`, `honeypot`, `too_fast`, or `received` (PHP died before SendPulse answered). Times are UTC.
The table holds personal data (the posted fields, IP, user agent) and has no retention rule yet.

### What the audit established

- The forms are the theme's own AJAX handler, not Contact Form 7. One handler, six placements
  per page, twelve languages.
- Browser side: passes in all 12 languages on all three form types at desktop and phone width.
- Server to SendPulse: 26 of 26 test leads created from dev, including every edge case; 41 real
  submissions on live in the 15 days to 8 Oct with no SendPulse error logged. No evidence of
  ongoing loss. The September loss (forms not posting at all) was a script-order bug, fixed on
  10 Sep and closed by the owner.
- Until fix 1 there was no record of a submission anywhere but SendPulse. There still is no
  second delivery channel: the server cannot send mail.
- `IP Country`, `First Page Seen` and the referrer on each CRM contact come from cached HTML
  and belong to whoever caused the page to be cached, not to the lead. City and timezone are right.

### Remaining fixes, ranked

The numbers are the original ones from section 7. Fix 1 is done.

| Rank | Fix | Effort | Why now |
|---|---|---|---|
| 1 | **Fix 3: geo and attribution read at submit time.** Take country from `CF-IPCountry` and first page and referrer from the visitor's cookies inside the handler, not from cached HTML | S | Every lead in the CRM carries someone else's country and first page today. The lead log already records the true country per submission, so the fix can be checked against it |
| 2 | **Fix 4: outcome events.** Push `lead_submit_ok` / `lead_submit_error` to `dataLayer` and PostHog from `actions.js` | S | Makes the funnel measurable and would show a repeat of September the same day |
| 3 | **Fix 5: self-host jquery.validate and give the form `method="post"`** | S | Removes the single dependency whose failure turns every submit into a GET that reaches nobody. 295 such GETs in 15 days today are bots; under a broken script they would be customers |
| 4 | **Fix 2: a mail transport for `wp_mail`** (SendPulse SMTP, credentials in `wp-config.php`) | S, needs root | The second copy of each lead. Less urgent now that the lead log exists |
| 5 | **Show the visitor an error when the contact is not created** (was part of fix 1, left out on purpose) | S | Today a failed lead still gets the success screen. Wait until the log shows how often `failed` happens |
| 6 | **Fix 6: server-side checks**: email with a TLD, no URL in name fields, set `form_time` in JavaScript so the timer works | S | Quality of what reaches the CRM. Bots that post directly go straight in |
| 7 | **Fix 7, reduced:** strip the backslash before apostrophes (`wp_unslash`) and keep message line breaks | S | The website-rejection worry is gone (all variants were accepted). What is left is cosmetic damage to names like O'Brien and flattened messages |
| 8 | **Fix 8: mobile and RTL polish**: phone field `type="tel"`, `autocomplete`, RTL chevron, translate "Messenger", Kurdish label | S | Completion rate on phones, mostly RTL markets |
| 9 | **Fix 9: logs for the next audit**: nginx format with `CF-IPCountry`, 90-day retention | M, needs root | The 12-month source breakdown is impossible from 14 days of logs |
| 10 | **Fix 10: remove dead parts**: CF7, form 1828, the Forminator mu-plugin; decide on UTM capture | S | Tidiness; UTM capture would be new work |
| new | **Lead log housekeeping:** a retention rule (for example delete rows older than 12 months) and a one-line weekly check for `failed` rows | S | The table grows with every bot submission and holds personal data |

Parked until the Ops secrets wrapper exists: comparing the lead log with SendPulse through the
API, and step 4 (12 months of submissions by country, language, landing page and referrer,
AI referrers and crawlers) from PostHog.

### HANDBACK

```
KD lead-funnel audit, paused 2026-10-09. Forms are a custom theme AJAX handler -> SendPulse, not CF7.
FOUND: no ongoing lead loss. Browser side passes in 12 languages; 26/26 test leads created via dev;
41 real submissions in 15 days on live with zero SendPulse errors. September loss = JS bug, fixed 10 Sep.
CHANGED: fix 1 live since 9 Oct 13:53 UTC: every submission logged in table leadlog_kenmore_sage with
the SendPulse result. dev refreshed from live, analytics tags stripped on dev, dev2 switched off.
SIDE WORK (kd-site security): raw wp-config exposure closed, salts shuffled on 23 sites, SendPulse pair
rotated, backups moved out of the web root, deny rules on every vhost, backdoored chass tree quarantined.
OPEN: CRM country / first page / referrer are wrong on every lead (cached HTML): fix 3 next.
No outcome events in GTM/PostHog (fix 4). No second delivery channel (no mail transport). No retention
rule on the lead log. Step 4 (12-month sources, AI referrers) parked until PostHog access via Ops wrapper.
UNLOCKS: weekly loss number from the lead log; once fix 3 is in, CRM geo and attribution become usable.
```

## Re-running the tests

Scripts are in this directory; see `README.md`. Results and screenshots go to `out/` (not in git).
