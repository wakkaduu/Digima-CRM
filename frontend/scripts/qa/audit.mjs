import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const axeSrc = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const exe = process.env.CHROME_PATH; // e.g. ~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome
if (!exe) throw new Error('Set CHROME_PATH to a Chromium/Chrome executable (see scripts/qa/README.md)');
const BASE = 'http://localhost:5199';
const VIEWPORTS = [['360x640', 360, 640, true], ['390x844', 390, 844, true], ['640x360-landscape', 640, 360, true], ['768x1024', 768, 1024, true], ['1024x768', 1024, 768, false], ['1440x900', 1440, 900, false]];
const PAGES = [
  ['login', null, '/login'], ['sales-submit', 'sales', '/payments/new'], ['sales-mine', 'sales', '/payments'], ['password', 'sales', '/password'],
  ['admin-queue', 'admin', '/payments/review'], ['admin-review', 'admin', '/payments/review/p2'], ['admin-history', 'admin', '/payments/review?tab=history'], ['admin-history-detail', 'admin', '/payments/review/p20?tab=history'], ['setup', 'admin', '/settings/integrations'], ['dashboard-sales', 'sales', '/dashboard'], ['dashboard-admin', 'admin', '/dashboard'], ['customers', 'sales', '/customers'], ['customers-admin', 'admin', '/customers?tab=active&q=a'], ['customer-detail', 'sales', '/customers/51'], ['customer-estimates', 'sales', '/customers/50?tab=estimates'], ['customer-payments', 'admin', '/customers/50?tab=payments'], ['estimates', 'sales', '/estimates'], ['estimate-detail', 'sales', '/estimates/2'], ['notfound', 'admin', '/nope'],
];
const only = process.argv[2]?.startsWith('--') ? undefined : process.argv[2]; const shots = process.argv.includes('--shots');
const SHOTS = new URL('./shots/', import.meta.url);
mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const problems = [];
for (const [vn, w, h, touch] of VIEWPORTS) {
  for (const scale of [1, 1.3]) {
    if (scale !== 1 && !['360x640', '390x844'].includes(vn)) continue;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
    for (const [pn, role, path] of PAGES) {
      if (only && !pn.includes(only)) continue;
      await ctx.clearCookies();
      if (role) await ctx.addCookies([{ name: 'role', value: role, url: BASE }]);
      const page = await ctx.newPage();
      const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => m.type() === 'error' && !/401|404|Failed to load resource/.test(m.text()) && errs.push(m.text()));
      await page.goto(BASE + path, { waitUntil: 'networkidle' });
      if (scale !== 1) await page.addStyleTag({ content: `html{font-size:${scale * 100}% !important}` });
      await page.waitForTimeout(350);
      const tag = `${vn}${scale !== 1 ? '@130%' : ''} ${pn}`;
      const r = await page.evaluate(() => {
        const de = document.documentElement; const out = { overflowX: de.scrollWidth - de.clientWidth, sidebar: !!document.querySelector('aside, nav[aria-label="Main"]'), tabbar: false, small: [], smallFont: [], clipped: [] };
        const tab = document.querySelector('nav[aria-label="Main"]'); out.tabbar = !!tab && getComputedStyle(tab).position === 'fixed';
        const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden]') && !el.closest('dialog:not([open])') && !el.closest('.sr-only'); };
        for (const el of document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], summary')) {
          if (!vis(el)) continue; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
          const inline = cs.display === 'inline' && el.tagName === 'A' && el.closest('p, li, dd, span, div.text-small, nav[aria-label=Breadcrumb]') ; // text links inside copy are exempt (WCAG 2.5.8 inline exception)
          const label = (el.getAttribute('aria-label') || el.textContent || el.id || el.tagName).trim().slice(0, 40);
          const choice = el.type === 'checkbox' || el.type === 'radio'; // the whole label row is the target
          if (choice) continue;
          if ((r.height < 24 || r.width < 24) && !inline) out.small.push(`${label} ${Math.round(r.width)}x${Math.round(r.height)}`);
          else if (matchMedia('(pointer:coarse)').matches && r.height < 44 && !inline && !(el.type === 'checkbox' || el.type === 'radio')) out.small.push(`(<44) ${label} ${Math.round(r.width)}x${Math.round(r.height)}`);
          if (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) && parseFloat(cs.fontSize) < 16 && !['checkbox','radio','file','hidden'].includes(el.type)) out.smallFont.push(`${label} ${cs.fontSize}`);
        }
        for (const el of document.querySelectorAll('h1,h2,h3,p,dd,li,button,a')) { if (!vis(el)) continue; const r = el.getBoundingClientRect(); if (r.right > innerWidth + 1 || r.left < -1) out.clipped.push((el.textContent || '').trim().slice(0, 30)); }
        return out;
      });
      const bad = [];
      if (r.overflowX > 0) bad.push(`horizontal scroll +${r.overflowX}px`);
      const desktop = w >= 1024; if (pn !== 'login' && pn !== 'notfound' || role) { if (role && desktop && r.tabbar) bad.push('tab bar shown on desktop'); }
      if (role && !desktop && pn !== 'admin-review' && pn !== 'sales-submit' && !r.tabbar) bad.push('no tab bar on mobile');
      if (r.small.length) bad.push('small targets: ' + [...new Set(r.small)].slice(0, 6).join('; '));
      if (r.smallFont.length) bad.push('input font <16px: ' + [...new Set(r.smallFont)].join('; '));
      if (r.clipped.length) bad.push('clipped text: ' + [...new Set(r.clipped)].slice(0, 4).join('; '));
      if (errs.length) bad.push('console: ' + errs[0]);
      await page.evaluate(axeSrc);
      const ax = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0].target.join(' ')}`));
      if (vn === '1440x900' || vn === '360x640') for (const a of ax) bad.push('axe ' + a);
      if (bad.length) problems.push(`${tag}\n   - ` + bad.join('\n   - '));
      if (shots) await page.screenshot({ path: new URL(`${vn}${scale !== 1 ? '-130' : ''}-${pn}.png`, SHOTS).pathname, fullPage: false });
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();
console.log(problems.length ? problems.join('\n') : 'NO PROBLEMS');
