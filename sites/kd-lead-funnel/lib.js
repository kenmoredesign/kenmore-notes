// Shared helpers for the KD lead-funnel tests. Playwright comes from ~/ops/tools.
const path = require('path');
const os = require('os');
const { chromium } = require(path.join(os.homedir(), 'ops/tools/node_modules/playwright'));

const LANGS = ['en', 'fr', 'es', 'ru', 'tr', 'zh', 'ja', 'ko', 'ar', 'fa', 'he', 'ku'];
const RTL = ['ar', 'fa', 'he', 'ku']; // ku (Sorani) is RTL script, though Polylang has it as LTR
// Every page carries the five footer modal forms; contact-us adds an inline one.
const PAGES = { home: '', contact: 'contact-us/', pdf: 'start-your-own-prop-firm-business-plan/' };
const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' },
};
const DEV = 'https://dev.kenmoredesign.com';
const PROD = 'https://www.kenmoredesign.com';

const pageUrl = (base, lang, page) => `${base}/${lang === 'en' ? '' : lang + '/'}${PAGES[page]}`;

class Blocked extends Error {}

// Rule: if Cloudflare or a CAPTCHA blocks us, stop and report. Never work around it.
async function gotoOrStop(page, url) {
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const h = res ? res.headers() : {};
  const title = await page.title();
  if (!res || h['cf-mitigated'] || /just a moment|attention required/i.test(title) ||
      await page.locator('iframe[src*="challenges.cloudflare.com"], .g-recaptcha, .h-captcha').count()) {
    throw new Blocked(`BLOCKED at ${url}: status ${res && res.status()}, title "${title}"`);
  }
  await page.waitForLoadState('load', { timeout: 60000 }).catch(() => {});
  return res;
}

// Intercept the lead POST (admin-ajax action=send_message).
//   capture: record the payload and answer locally; nothing reaches the server.
//   send:    let it through, on dev only. Any other host is refused.
async function guardSubmit(page, mode, sink) {
  await page.route('**/wp-admin/admin-ajax.php', async (route) => {
    const req = route.request();
    const body = req.postData() || '';
    if (req.method() !== 'POST' || !body.includes('action=send_message')) return route.continue();
    const host = new URL(req.url()).host;
    sink.push({ url: req.url(), fields: Object.fromEntries(new URLSearchParams(body)) });
    if (mode === 'send' && host === 'dev.kenmoredesign.com') return route.continue();
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<p class="kd-test">CAPTURED, not sent</p>' });
  });
}

module.exports = { chromium, LANGS, RTL, PAGES, VIEWPORTS, DEV, PROD, pageUrl, gotoOrStop, guardSubmit, Blocked };
