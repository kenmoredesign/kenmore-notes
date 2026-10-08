#!/usr/bin/env node
// forms.js [--base dev|prod] [--send --email ADDR] [--plan] [--langs en,ar] [--pages home,contact,pdf] [--edge] [--out DIR]
//
// Walks every lead form in every language at desktop and phone widths.
//   default      capture mode: the lead POST is intercepted in the browser, nothing reaches
//                the server or SendPulse. Safe to run against prod (it still loads pages only).
//   --send       really submit. Dev only (lib.js refuses any other host). Every submission
//                is labelled TEST and uses --email (required). dev's SendPulse credentials
//                are the same as live's (checked 2026-10-08), so these land in the live CRM.
//                '{n}' in --email becomes 01, 02, ... so each lead has its own address.
//                Writes sent.csv, the list to delete from the CRM afterwards.
//   --plan       run the fixed 26-lead plan (PLAN below) instead of the full matrix:
//                one baseline per language, then the edge inputs incl. free-text websites.
//   --edge       also run the edge-case inputs (phones, non-Latin names, long company, TLDs).
// Stops at the first Cloudflare challenge or CAPTCHA.
const fs = require('fs');
const path = require('path');
const L = require('./lib.js');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : (process.argv[i + 1] || true); };
const has = (n) => process.argv.includes('--' + n);
const base = arg('base', 'dev') === 'prod' ? L.PROD : L.DEV;
const send = has('send');
if (send && base !== L.DEV) { console.error('--send is dev only'); process.exit(2); }
const email = arg('email', null);
if (send && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email))) { console.error('--send needs --email ADDR (an address you control)'); process.exit(2); }
const langs = arg('langs', L.LANGS.join(',')).split(',');
const pages = arg('pages', Object.keys(L.PAGES).join(',')).split(',');
const out = arg('out', path.join(__dirname, 'out', new URL(base).host + (send ? '-send' : '')));
fs.mkdirSync(out, { recursive: true });

const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const BASE = { firstname: 'TEST Anna', lastname: 'TEST Probe', email: email || 'test+kd@example.com', company: 'TEST Kenmore audit', message: `TEST submission ${stamp}, please ignore` };
const EDGE = {
  'phone +971 spaced': { contact: ['phone', '+971 50 123 4567'] },
  'phone 0044 prefix': { contact: ['phone', '0044 7911 123456'] },
  'phone US brackets': { contact: ['phone', '(212) 555-0100'] },
  'whatsapp +7 dashes': { contact: ['whatsapp', '+7 (495) 123-45-67'] },
  'telegram @handle': { contact: ['telegram', '@test_handle'] },
  'messenger picked, left empty': { contact: ['telegram', ''] },
  'name Arabic': { firstname: 'TEST محمد', lastname: 'TEST الأحمد' },
  'name Chinese': { firstname: 'TEST 王', lastname: 'TEST 小明' },
  'name Cyrillic': { firstname: 'TEST Алексей', lastname: 'TEST Щербаков' },
  "name O'Brien-Smith": { firstname: "TEST Seán", lastname: "TEST O'Brien-Smith" },
  'company 220 chars': { company: 'TEST ' + 'International Brokerage Holdings and Proprietary Trading Group '.repeat(4).slice(0, 215) },
  'email new TLD': { email: 'test@firm.technology' },
  'email IDN domain': { email: 'test@пример.рф' },
  'email plus, co.uk': { email: 'test.user+kd@mail.co.uk' },
  'email no TLD': { email: 'test@localhost' },
  'email trailing space': { email: 'test+kd@example.com ' },
  'website bare domain': { website: 'testcompany.com' },
  'website free text': { website: 'none yet' },
  'website www no scheme': { website: 'www.testcompany.com' },
  'website full URL': { website: 'https://testcompany.com/about?x=1' },
  'website with spaces': { website: 'Test Company Ltd (site coming soon)' },
  'message multiline + emoji': { message: 'TEST line one\nline two 🚀\n"quotes" & <tags>' },
};

// The fixed send plan: [viewport, language, page, case]. 26 leads.
const PLAN = [
  ...L.LANGS.map((l, i) => [i % 2 ? 'mobile' : 'desktop', l, ['home', 'contact', 'pdf'][i % 3], 'baseline']),
  ...['phone +971 spaced', 'phone 0044 prefix', 'whatsapp +7 dashes', 'telegram @handle', 'name Arabic', 'name Chinese', 'name Cyrillic',
    "name O'Brien-Smith", 'company 220 chars', 'website bare domain', 'website free text', 'website www no scheme', 'website full URL',
    'website with spaces', 'message multiline + emoji'].map((c, i) => [i % 2 ? 'desktop' : 'mobile', ['en', 'ar', 'zh'][i % 3], 'contact', c]),
].slice(0, 26);

async function reveal(page) { // wow.js keeps sections hidden until scrolled into view
  for (let y = 0; y < 4000; y += 400) { await page.mouse.wheel(0, 400); await page.waitForTimeout(60); }
}

async function openForm(page, pageKey) {
  if (pageKey === 'contact') {
    await reveal(page);
    const f = page.locator('form.contact_form').first();
    await f.scrollIntoViewIfNeeded(); await page.waitForTimeout(700);
    return { form: f, how: 'inline' };
  }
  const ids = pageKey === 'pdf' ? ['#contacts-modal3', '#contacts-modal4'] : ['#contacts-modal', '#contacts-modal2', '#contacts-modal5'];
  await reveal(page);
  for (const id of ids) {
    const trig = page.locator(`[data-modal="${id}"]:visible`).first();
    if (!await trig.count()) continue;
    await trig.scrollIntoViewIfNeeded(); await trig.click({ timeout: 5000 }).catch(() => trig.evaluate((e) => e.click()));
    await page.waitForTimeout(700);
    const f = page.locator(`${id} form.contact_form`);
    if (await f.isVisible()) return { form: f, how: id };
  }
  return { form: null, how: 'no visible trigger for ' + ids.join('/') };
}

async function fill(form, data) {
  for (const k of ['firstname', 'lastname', 'email', 'company', 'website', 'message']) {
    if (data[k] != null) await form.locator(`[name=${k}]`).fill(data[k]);
  }
  if (data.contact) {
    await form.locator('.step-1 button.field').click();
    await form.locator(`.step-1 .option[data-type=${data.contact[0]}]`).click();
    await form.locator('[name=im]').fill(data.contact[1]);
  }
}

async function submit(page, form, sink) {
  const before = sink.length;
  const btn = form.locator('button[type=submit]');
  await btn.scrollIntoViewIfNeeded();
  // Is the button really tappable, or is something (chat bubble, cookie bar) on top of it?
  const covered = await btn.evaluate((b) => { const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return e === b || b.contains(e) ? '' : (e ? e.tagName + '.' + String(e.className).slice(0, 40) : 'offscreen'); });
  const resp = send ? page.waitForResponse((r) => r.url().includes('admin-ajax.php') && r.request().method() === 'POST', { timeout: 30000 }).catch(() => null) : null;
  await btn.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(send ? 500 : 700);
  const r = resp && sink.length > before ? await resp : null;
  if (r) await page.waitForTimeout(1500);
  return {
    posted: sink.length > before, covered,
    status: r ? r.status() : null,
    errors: await form.locator('label.error:visible').allTextContents(),
    result: (await form.locator('.result').innerText().catch(() => '')).slice(0, 120) || (await form.locator('.result').innerHTML().catch(() => '')).slice(0, 120),
    payload: sink.length > before ? sink[sink.length - 1].fields : null,
  };
}

async function layout(page, form) {
  return form.evaluate((f) => {
    const r = f.getBoundingClientRect(), d = document.documentElement, b = f.querySelector('button[type=submit]').getBoundingClientRect();
    const modal = f.closest('.modal-content, .modal-dialog');
    return {
      htmlLang: d.lang, htmlDir: d.dir || '', cssDir: getComputedStyle(f).direction, textAlign: getComputedStyle(f.querySelector('.input-field')).textAlign,
      pageOverflowX: d.scrollWidth - window.innerWidth, formLeft: Math.round(r.left), formRight: Math.round(window.innerWidth - r.right),
      submitW: Math.round(b.width), submitH: Math.round(b.height),
      modalScrollable: modal ? modal.scrollHeight > modal.clientHeight || document.querySelector('.modal.active, .modal.open, .modal.show, .modal[style*="block"]')?.scrollHeight > window.innerHeight : null,
      caption: f.querySelector('.form-caption')?.textContent.trim().slice(0, 60),
      labels: [...f.querySelectorAll('.fake-label')].map((e) => e.textContent.trim()).join(' | '),
      picker: f.querySelector('.step-1 button.field')?.textContent.trim(), submit: f.querySelector('button[type=submit]').textContent.trim(),
      inputs: [...f.querySelectorAll('input:not([type=hidden]),textarea')].filter((i) => i.name !== 'website_url').map((i) => `${i.name}:${i.type}${i.inputMode ? '/' + i.inputMode : ''}${i.autocomplete ? '/ac=' + i.autocomplete : ''}`).join(' '),
    };
  });
}

(async () => {
  const browser = await L.chromium.launch();
  const results = [];
  const save = () => fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 1));
  try {
    const matrix = [];
    for (const vp of Object.keys(L.VIEWPORTS)) for (const lang of langs) for (const pg of pages) {
      matrix.push([vp, lang, pg, 'empty submit'], [vp, lang, pg, 'baseline']);
      if (has('edge') && pg === 'contact') for (const c of Object.keys(EDGE)) matrix.push([vp, lang, pg, c]);
    }
    {
      for (const [vp, lang, pg, name] of has('plan') ? PLAN : matrix) {
        const over = name === 'empty submit' ? null : (EDGE[name] || {});
        if (send && name === 'empty submit') continue;
        const ctx = await browser.newContext(L.VIEWPORTS[vp]); const page = await ctx.newPage();
        const sink = [], jsErrors = [];
        page.on('pageerror', (e) => jsErrors.push(e.message.slice(0, 160)));
        await L.guardSubmit(page, send ? 'send' : 'capture', sink);
        const row = { vp, lang, page: pg, case: name, url: L.pageUrl(base, lang, pg) };
        try {
          const res = await L.gotoOrStop(page, row.url);
          row.http = res.status(); row.finalUrl = page.url() === row.url ? undefined : page.url();
          await page.waitForTimeout(1200);
          row.validateLoaded = await page.evaluate(() => typeof jQuery !== 'undefined' && typeof jQuery.fn.validate === 'function');
          const { form, how } = await openForm(page, pg);
          row.opened = how;
          if (form) {
            if (name === 'empty submit') row.layout = await layout(page, form);
            const n = String(results.length + 1).padStart(2, '0'); // --email 'name+{n}@domain' numbers each lead
            const data = over && { ...BASE, ...over, ...(send ? { email: email.replace('{n}', n) } : {}), ...(send && !over.message ? { message: `${BASE.message} [${vp}/${lang}/${pg}/${name}]` } : {}) };
            if (data) { await fill(form, data); row.sentAt = new Date().toISOString(); row.data = data; }
            Object.assign(row, await submit(page, form, sink));
            if (name === 'empty submit' || (over && Object.keys(over).length === 0)) await page.screenshot({ path: path.join(out, `${vp}-${lang}-${pg}-${name.replace(/\W+/g, '_')}.png`) });
          }
        } catch (e) {
          if (e instanceof L.Blocked) throw e;
          row.error = e.message.split('\n')[0].slice(0, 200);
        }
        if (jsErrors.length) row.jsErrors = jsErrors;
        results.push(row); save();
        const ok = row.error ? 'ERROR ' + row.error : name === 'empty submit' ? `errors=${JSON.stringify(row.errors)} posted=${row.posted}` : `posted=${row.posted}${row.status ? ' http=' + row.status : ''} errors=${JSON.stringify(row.errors)}${row.covered ? ' COVERED_BY=' + row.covered : ''}`;
        console.log(`${vp} ${lang} ${pg} [${name}] ${row.opened || ''} ${ok}`);
        await ctx.close();
        if (send) await new Promise((r) => setTimeout(r, 3000)); // stay far below the nginx POST limit
      }
    }
  } catch (e) {
    console.error(e instanceof L.Blocked ? `STOPPED: ${e.message}` : e.stack);
    process.exitCode = 1;
  } finally {
    save();
    if (send) { // the list to delete from the CRM
      const q = (v) => '"' + String(v ?? '').replace(/"/g, '""').replace(/\n/g, ' ') + '"';
      fs.writeFileSync(path.join(out, 'sent.csv'), ['sent_at_utc,viewport,lang,page,case,firstname,lastname,company,email,http,posted',
        ...results.filter((r) => r.posted).map((r) => [r.sentAt, r.vp, r.lang, r.page, r.case, r.data.firstname, r.data.lastname, r.data.company.slice(0, 40), r.data.email, r.status, r.posted].map(q).join(','))].join('\n') + '\n');
    }
    await browser.close();
  }
})();
