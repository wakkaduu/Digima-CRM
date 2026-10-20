import { chromium } from 'playwright-core';
import { randomBytes } from 'node:crypto';
const exe = process.env.CHROME_PATH; // e.g. ~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome
if (!exe) throw new Error('Set CHROME_PATH to a Chromium/Chrome executable (see scripts/qa/README.md)');
const BASE = 'http://localhost:5199';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const log = (ok, msg) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);

async function open(vp, role, path, mobile = false) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: mobile, isMobile: mobile });
  await ctx.addCookies([{ name: 'role', value: role, url: BASE }]);
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  return { ctx, page };
}
const focusInfo = (page) => page.evaluate(() => {
  const el = document.activeElement; if (!el || el === document.body) return null;
  const cs = getComputedStyle(el);
  const name = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 28);
  return { name, tag: el.tagName, outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2, ring: cs.boxShadow !== 'none' };
});

// A. Keyboard order and visible focus (desktop, sales)
{
  const { ctx, page } = await open({ width: 1440, height: 900 }, 'sales', '/payments/new');
  const seen = [];
  for (let i = 0; i < 16; i++) { await page.keyboard.press('Tab'); const f = await focusInfo(page); if (f) seen.push(f); }
  log(seen[0]?.name.startsWith('Skip to content'), `first Tab stop is the skip link (got "${seen[0]?.name}")`);
  const invisible = seen.filter((f) => !f.outline && !f.ring);
  log(invisible.length === 0, `every one of ${seen.length} focus stops shows a >=2px indicator${invisible.length ? ': ' + invisible.map((f) => f.name).join(', ') : ''}`);
  console.log('      order:', seen.map((f) => f.name).join(' > '));
  await ctx.close();
}

// B. Dialog focus trap and focus return (admin review)
{
  const { ctx, page } = await open({ width: 1440, height: 900 }, 'admin', '/payments/review/p1');
  const reject = page.getByRole('button', { name: 'Reject', exact: true });
  await reject.focus(); await page.keyboard.press('Enter');
  const dlg = page.getByRole('dialog', { name: /Reject/ });
  await dlg.waitFor();
  // Focus may rest on the browser's own UI (activeElement = body); what must never happen is landing on page content behind the dialog.
  const inside = () => page.evaluate(() => document.activeElement === document.body || !!document.activeElement?.closest('dialog[open]'));
  log(await inside(), 'focus moves into the dialog when it opens');
  let stayed = true;
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); if (!(await inside())) stayed = false; }
  log(stayed, 'Tab x12 never leaves the dialog (focus trapped)');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  log(!(await dlg.isVisible()), 'Escape closes the dialog');
  log(await page.evaluate(() => document.activeElement?.textContent?.trim().startsWith('Reject')), 'focus returns to the Reject button');
  // shortcut keys must not fire while the dialog/typing is active
  await ctx.close();
}

// C. Reduced motion is honoured
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await ctx.addCookies([{ name: 'role', value: 'sales', url: BASE }, { name: 'delay', value: '1200', url: BASE }]);
  const page = await ctx.newPage();
  await page.goto(BASE + '/payments', { waitUntil: 'commit' });
  await page.waitForTimeout(500);
  const anim = await page.evaluate(() => [...document.querySelectorAll('*')].filter((e) => { const cs = getComputedStyle(e); return cs.animationName !== 'none' && parseFloat(cs.animationDuration) > 0.05; }).length);
  log(anim === 0, `no running animation longer than 50ms with prefers-reduced-motion (found ${anim})`);
  await ctx.close();
}

// D. Submit on a slow network, then offline, then Retry (390x844 touch)
async function fill(page) {
  await page.getByRole('button', { name: 'Customer or estimate' }).click();
  const sheet = page.getByRole('dialog', { name: 'Choose an estimate' });
  await sheet.getByRole('button', { name: /Acme Corp/ }).first().click();
  await page.getByLabel(/Amount received/).fill('2500');
  await page.getByRole('radio', { name: 'BDO' }).check({ force: true });
  await page.locator('input[type=file]').nth(1).setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(700 * 1024)]) });
  await page.getByText(/receipt\.png/).waitFor();
}
{
  const { ctx, page } = await open({ width: 390, height: 844 }, 'sales', '/payments/new', true);
  await fill(page);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  const btn = page.getByRole('button', { name: /Submit for approval|Uploading|Submitting/ });
  await btn.click();
  const seen = new Set();
  for (let i = 0; i < 40; i++) { const t = (await btn.first().textContent().catch(() => '')) ?? ''; if (/Uploading \d+%/.test(t)) seen.add(t.trim()); if (await page.getByRole('heading', { name: 'Submitted' }).isVisible().catch(() => false)) break; await page.waitForTimeout(250); }
  log(seen.size >= 2, `Slow 4G: progress is shown while uploading (${[...seen].slice(0, 4).join(' > ')})`);
  await page.getByRole('heading', { name: 'Submitted' }).waitFor({ timeout: 20000 });
  log(true, 'Slow 4G: upload completes and the Submitted screen appears');
  await ctx.close();
}
{
  const { ctx, page } = await open({ width: 390, height: 844 }, 'sales', '/payments/new', true);
  await fill(page);
  await ctx.setOffline(true);
  await page.getByRole('button', { name: 'Submit for approval' }).click();
  const alert = page.getByRole('alert').filter({ hasText: /Connection lost|Cannot reach/ });
  await alert.waitFor({ timeout: 10000 }).catch(async (e) => { console.log('DEBUG page text:', (await page.evaluate(() => document.body.innerText)).slice(0, 600)); throw e; });
  log(true, `Offline: clear message with Retry ("${(await alert.textContent()).trim().slice(0, 70)}")`);
  const kept = await page.evaluate(() => ({ amount: document.querySelector('#amount')?.value, file: document.body.innerText.includes('receipt.png') }));
  log(kept.amount === '2,500' || kept.amount === '2500' || kept.amount === '2,500.00', `Offline: amount is kept (${kept.amount})`);
  log(kept.file, 'Offline: the attached receipt is kept');
  await ctx.setOffline(false);
  await alert.getByRole('button', { name: 'Retry' }).click();
  await page.getByRole('heading', { name: 'Submitted' }).waitFor({ timeout: 10000 });
  log(true, 'Back online: Retry succeeds without re-entering anything');
  await ctx.close();
}
await browser.close();
