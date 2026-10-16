# Browser QA scripts (UI-6)

Not part of `npm test`: they drive a real Chromium against the dev server with a fake API, so nothing needs a database or QuickBooks.

```bash
npm i --no-save playwright-core axe-core          # not project dependencies
node scripts/qa/mock-api.mjs &                    # fake API on :3100 (role comes from a `role=admin|sales` cookie)
VITE_API_TARGET=http://localhost:3100 npx vite --port 5199 &
export CHROME_PATH=~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome   # any Chrome/Chromium

node scripts/qa/audit.mjs [page-name] [--shots]   # layout, touch targets, input font size, axe WCAG 2.2 AA
node scripts/qa/flows.mjs                         # keyboard order, dialog focus trap, reduced motion, slow-4G and offline submit
```

`audit.mjs` visits every screen at 360x640, 390x844, 640x360 (landscape), 768x1024, 1024x768 and 1440x900, and at 130% text size on the two phone sizes. It reports horizontal scroll, tab bar / sidebar mix-ups, targets under 44px on touch (24px otherwise), inputs under 16px, clipped text, console errors, and axe violations (at 360 and 1440). It prints `NO PROBLEMS` when clean. Screenshots go to `scripts/qa/shots/` (git-ignored).
