# KD lead-funnel tests

Playwright tests for the kenmoredesign.com lead forms. Run from the Ops box; Chromium and
Playwright come from `~/ops/tools`. Nothing is installed on kd-site. `REPORT.md` is the
Phase 1 audit (2026-10-07).

| Script | What it does |
|---|---|
| `forms.js` | Every form in every language at 1440 and 390: empty submit, valid submit, layout checks, screenshots. Capture mode by default: the lead POST is intercepted in the browser and nothing reaches the server |
| `forms.js --edge` | Adds the edge-case inputs (phone formats, non-Latin names, long company, unusual emails) on the contact form |
| `forms.js --send --plan --email 'name+{n}@domain'` | Really submits the fixed 26-lead plan. **dev only** (any other host is refused), every lead labelled TEST, deletion list in `sent.csv`. dev has the same SendPulse credentials as live, so these land in the live CRM: get an OK first |
| `prod-check.js` | Prod, page loads only, never clicks submit: form present, validator bound, geo values baked into the page, trackers loaded |
| `fix1-submission-log.patch` | Phase 2 fix 1: server-side submission log in `themes/sage/app/actions.php`. Deploy with `~/ops/bin/theme-file` |
| `test-leads-2026-10-09.csv` | The 26 TEST leads sent from dev on 2026-10-09, with SendPulse contact ids: the list to delete from the CRM |
| `lib.js` | Languages, pages, viewports, the Cloudflare/CAPTCHA stop and the submit guard |

```sh
node forms.js                                   # full matrix on dev, capture mode, about 25 min
node forms.js --langs en,ar,zh --pages contact --edge
node forms.js --base prod --langs en            # still capture mode; clicks submit, sends nothing
node prod-check.js
```

Output goes to `out/<host>/results.json` plus screenshots (`out/` is git-ignored). All scripts
stop at the first Cloudflare challenge or CAPTCHA; do not work around one.

The forms are the theme's own (`themes/sage/resources/views/partials/form.blade.php`, handler
`send_message` in `themes/sage/app/actions.php`), not Contact Form 7. dev loads the same
analytics tags as live, so test runs show up in GTM, PostHog and Clarity under the `dev.` host.
