#!/usr/bin/env node
// prod-check.js: page loads only on prod, never touches a submit button.
// Per language (contact page, desktop + phone): is the form there, is jquery.validate
// bound (if not, the form silently degrades to a GET that reaches nobody), which geo and
// first-page values are baked into the cached HTML, which trackers load. Screenshots to out/prod/.
const fs = require('fs'); const path = require('path'); const L = require('./lib.js');
const out = path.join(__dirname, 'out', 'prod'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await L.chromium.launch(); const rows = [];
  try {
    for (const vp of Object.keys(L.VIEWPORTS)) for (const lang of L.LANGS) {
      const ctx = await browser.newContext(L.VIEWPORTS[vp]); const page = await ctx.newPage();
      const hosts = new Set(); page.on('request', (r) => hosts.add(new URL(r.url()).host));
      const url = L.pageUrl(L.PROD, lang, 'contact');
      const res = await L.gotoOrStop(page, url);
      for (let y = 0; y < 4000; y += 400) { await page.mouse.wheel(0, 400); await page.waitForTimeout(60); }
      await page.waitForTimeout(2500);
      const row = await page.evaluate(() => ({
        forms: document.querySelectorAll('form.contact_form').length,
        validateBound: !!(window.jQuery && jQuery.fn.validate && jQuery('form.contact_form').first().data('validator')),
        country: global.country, city: global.ipCity, tz: global.ipTimezone, firstPage: global.firstPage, refSite: global.refSite,
        formAgeH: Math.round((Date.now() / 1000 - document.querySelector('[name=form_time]').value) / 360) / 10,
        posthog: !!(window.posthog && posthog.config), posthogHost: window.posthog && posthog.config && posthog.config.api_host,
        dataLayerEvents: (window.dataLayer || []).map((e) => e.event).filter(Boolean).join(','),
      }));
      Object.assign(row, { vp, lang, http: res.status(), cache: res.headers()['cf-cache-status'], trackers: [...hosts].filter((h) => !/kenmoredesign\.com$|fonts\.g|cdnjs|youtube/.test(h) || /chat\./.test(h)).sort().join(' ') });
      const f = page.locator('form.contact_form').first(); await f.scrollIntoViewIfNeeded(); await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(out, `${vp}-${lang}-contact.png`) });
      rows.push(row); console.log(JSON.stringify(row)); await ctx.close();
    }
  } catch (e) { console.error(e instanceof L.Blocked ? `STOPPED: ${e.message}` : e.stack); process.exitCode = 1; }
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(rows, null, 1)); await browser.close();
})();
