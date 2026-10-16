# Digima CRM: Frontend Design Audit & Redesign Tracker

Scope: `frontend/` (React 19, Vite, Tailwind v4, TanStack Query). Audit date: 2026-10-16.
Constraints from the owner: **light mode only, no gradients, professional and minimalist.**

How to use this file: tick `[ ]` → `[x]` as work lands. Each task has an ID so commits and PRs can reference it (e.g. `UI-A3`). Phases are ordered; do not start a later phase before the "Done when" of the previous one, because later work depends on the tokens and shell built first.

---

## 1. Frame (assumptions)

| Item | Assumption |
|---|---|
| Users | **Sales rep** (submits payments, checks status; several times a day, often on a phone) and **Admin** (approves/rejects, manages QuickBooks link; desk-based, repetitive, error-averse). |
| Core jobs | Sales: submit a payment with proof, see whether it was approved. Admin: review proof, set the net amount, approve or reject, reconnect QuickBooks. |
| Reality check | The app today is a **payment-approval portal** (4 screens + login/password). **Owner decision (2026-10-16): the target is a real Customer Relationship Management system**, with a **left sidebar** and a **new logo** (created: `frontend/public/logo-mark.svg`, `favicon.svg`). Payments + QuickBooks become modules inside the CRM. See section 3b for the information architecture. |
| Success measures | Admin time-to-review per payment, rejected-for-error rate, "where is my payment?" questions from sales. |

---

## 2. Critique (ranked)

### Blockers: these undermine "professional"

**B1. Two competing styling systems.**
Evidence: login, submit, and password pages use the hand-written `.panel/.btn/.input` classes in [app.css](frontend/src/styles/app.css). The admin page, [PendingCard.tsx](frontend/src/components/PendingCard.tsx), and [SetupPage.tsx](frontend/src/pages/SetupPage.tsx) use raw Tailwind utilities (`rounded-xl shadow-sm`, `bg-green-600`, `bg-blue-600`, `text-slate-500`, `bg-amber-50`).
Impact: the same product shows two button shapes, two radii (4px vs 12px), three primary colours (navy, green, blue), and two spacing rhythms. This is the single biggest reason it reads as unfinished.
Fix: one token layer, one component set (Phase 0–1). Raw palette utilities (`slate-*`, `green-*`, `blue-*`) are banned in pages; only semantic tokens.

**B2. No application shell.**
Evidence: a text-only top bar (`Payment Portal` in bold) with nav links, "Change password" and "Log out" crammed on one wrapping row; content capped at 960px.
Impact: no identity, no place for growth (a CRM needs 6–10 destinations), account actions mixed with navigation, and wasted width on desktop.
Fix: left sidebar for destinations + slim page header + account menu (Phase 1).

**B3. Native `confirm()` and `prompt()` for the highest-stakes actions.**
Evidence: approve uses `confirm(...)` with a text summary, reject uses `prompt(...)` ([PendingCard.tsx](frontend/src/components/PendingCard.tsx)); duplicate-submit uses `confirm()` ([SubmitPaymentPage.tsx](frontend/src/pages/SubmitPaymentPage.tsx)).
Impact: browser-chrome dialogs look unprofessional, can't be styled, can't show a proper breakdown, can't validate the rejection reason inline, and are suppressible by the browser.
Fix: `ConfirmDialog` and `RejectDialog` components with an amount-breakdown table and a validated textarea.

**B4. Setup screen dumps raw JSON.**
Evidence: `<pre>{JSON.stringify(data)}</pre>` plus ✅ ❌ emoji as status ([SetupPage.tsx](frontend/src/pages/SetupPage.tsx)).
Impact: looks like a debug page. Emoji render differently per OS and fail the "not colour alone" rule inconsistently.
Fix: status badge + connection summary card; "Test connection" shows a result summary (count, time), with raw JSON behind a "Show details" disclosure for admins.

### Major

**M1. Admin review is a stack of tall cards, not a work queue.**
A 20-item backlog means 20 scrolls of 350px cards. No sort, no search, no filter by rep or bank, no approved/rejected history for the admin, no bulk anything. Receipt is a 112×144 thumbnail that opens a new tab, so reviewing means tab-switching.
Fix: master–detail queue (list left, receipt + decision panel right) with an in-page receipt viewer (zoom, rotate).

**M2. Submit form is one long scroll with numbered fieldsets.**
Five sections, "All fields are required except…" prose, native `<select>` for banks, raw `<input type=file>`, and the history table below it on the same page. On desktop this is a narrow column in a wide screen; on mobile it is very long.
Fix: two-column layout on desktop (form left, live summary + receipt preview right); drag-and-drop/camera-friendly upload zone; segmented control for payment mode (5 fixed options); history moves to its own page ("My submissions").

**M3. Tables lack basic data-grid behaviour.**
`MySubmissions` has no sort, filter, pagination, or status tabs; the empty and error states are text inside a `<td>`; the hierarchy is flat (customer, estimate, bank, rejection reason all stacked in one cell).
Fix: shared `DataTable` with status filter tabs, search, sortable date/amount, sticky header, skeleton rows, a proper `EmptyState`, and row-click to a detail drawer.

**M4. Feedback model is inconsistent.**
Three mechanisms: inline `Message` banners, an ad-hoc coloured `div` on the admin page, and an in-form "msg-info". Results appear at the top of the page and force a scroll. Success after submit is a sentence that vanishes on the next action.
Fix: toast for transient confirmation (with link "View submission"), inline banner only for persistent page-level conditions (QuickBooks disconnected), field-level errors stay inline.

**M5. Typography and density are not designed.**
System font at 16px base, `h1` 22px, no scale. Every control is `min-height: 44px` (good for thumbs, heavy on a desktop admin screen).
Fix: Inter (self-hosted) with a defined scale; **two density modes via breakpoint**: 40px controls on desktop, 44px on touch. Tabular numerals for all money.

**M6. Login page is an afterthought.**
The full top bar renders above a left-aligned form ("Log in" h1, no brand mark, no company context).
Fix: centred card on a plain `--bg` page with logo, product name, and the form; no header bar.

### Minor

- **m1.** Hard-coded "− 1.5% fee" shortcut in [PendingCard.tsx](frontend/src/components/PendingCard.tsx) is business logic hiding in a button label. Make it a configurable quick-fill ("Apply bank fee %") or show per-bank defaults.
- **m2.** `<title>` is static "Payment Portal" on every route; no favicon. Set per-route titles.
- **m3.** No 404 page; `*` silently redirects to `/`.
- **m4.** No icons anywhere; status relies on text only. Add a small icon set for scannability (still paired with text).
- **m5.** Emoji in UI copy (🎉 ✅ ❌). Replace with icons/illustrations from the system.
- **m6.** "Loading…" plain paragraphs. Replace with skeletons that match final layout.
- **m7.** Links are underlined in the nav area and in-body alike; nav needs a proper active-state treatment.
- **m8.** The password page and the admin screens have no breadcrumb/page-header pattern; each page invents its own `h1` wrapper.
- **m9.** Dates use `toLocaleString()` in some places and `when()` / `dayLabel()` in others. Centralise in [format.ts](frontend/src/lib/format.ts).
- **m10.** The `.btn-link` is used as the logout action, so a destructive-ish account action looks like body text.

### What's already good (keep it)

- No gradients and no dark-mode CSS today. Nothing to remove, only to **lock in** (see D1).
- Accessibility basics are strong: `Field` wires label/hint/error via `aria-describedby`, focus moves to the first invalid field, `Message` uses `role=alert/status`, status badges carry text, keyboard-operable combobox list.
- Restrained, readable palette (navy accent `#1f4e79`, semantic ok/warn/bad pairs).
- Money handled well (tabular numerals, right-aligned amounts).
- Admin routes are code-split; route guards are role-based.
- Test coverage on auth and submit flow exists, so refactors are safer. Keep tests green throughout.

---

## 3. Design decisions & insights

**D1. Light only: enforce it, don't just omit it.**
Add `color-scheme: light` to `:root` and `<meta name="color-scheme" content="light">`. Without this, some browsers (and Windows high-contrast/"force dark" extensions, Android auto-dark) darken native controls (date picker, select popup, scrollbars) even when your CSS is light. Stating it explicitly guarantees the "light only" promise. Do **not** build a theme toggle or `prefers-color-scheme` branches.

**D2. No gradients → depth comes from borders, not shadows.**
A minimalist CRM that avoids gradients looks best when surfaces are separated by 1px hairline borders and a faint background step (`--bg` page vs `--surface` white cards), not by drop shadows. Rule: **no shadow except on floating layers** (menu, dialog, toast). Cards get border only. This also removes the `shadow-sm rounded-xl` look that currently makes the admin pages feel like a different app.

**D3. One accent colour, used sparingly.**
Navy `#1f4e79` stays as the single brand/action colour. Green/amber/red are **status only**, never decoration or primary buttons (today the Approve button is green and the QuickBooks button is green, which dilutes the meaning of "success"). Approve = primary navy; Reject = secondary-danger outline. Colour budget on any screen: neutral + one accent + status badges.

**D4. Neutral scale: slightly cool grey, WCAG AA everywhere.**
Body text `#1f2933` on white is ~14:1. Muted `#52606d` on white is ~6.5:1 (passes AA for small text); never go lighter than that for text. Borders may be lighter (`#e4e7eb`) because they are decoration. The current `--line: #cbd2d9` is heavy for a minimalist look; use it only for input borders (which must meet 3:1 as UI components).

**D5. Sidebar, not top bar.**
Rationale: CRM destinations will grow (Payments, Customers, Estimates, Reports, Settings). A top bar breaks at ~6 items. A fixed 232px left sidebar with icon + label, collapsing to a hamburger drawer under 1024px, gives permanent orientation and frees the top for page title + actions. Account (name, role, change password, log out) moves to a menu at the sidebar foot, which fixes the logout-looks-like-text problem (m10).

**D6. Admin review as master–detail, because the job is comparison.**
Admins compare three things: what the rep typed, what the receipt shows, and what they're about to post. Today these are split across a card and a new browser tab. Putting the receipt viewer beside the decision panel removes the highest-cost action in the flow. Alternative rejected: a table with row expansion. It still hides the receipt behind a click.

**D7. Prefer undo/confirm-with-consequences over generic "Are you sure?".**
- Approve → dialog showing Paid / Fee / Net to bank / "Invoice will be closed for ₱X" (consequences, not a yes/no). Posting to QuickBooks is irreversible, so confirm is justified.
- Reject → dialog with required reason (min 3 chars, inline error, counter). Reasons shown to the rep, so offer 3–4 quick-pick reasons ("Unclear receipt", "Wrong amount", "Duplicate") that fill the textarea.
- Submit duplicate → inline warning banner with "Submit anyway", not `confirm()`.

**D8. Mobile-first, density follows the device.**
Sales reps use phones, so the **base** is the phone layout (44px controls, 16px inputs, one column). `--control-h` shrinks to 36px only at ≥1024px with a fine pointer; tables become 40px rows there. No user-facing density toggle. See section 3c for the full mobile rules; every task below that has a mobile and a desktop form builds the mobile one first.

**D9. Status is a shared vocabulary.**
One `StatusBadge` for pending/approved/rejected/partially-posted/connected/disconnected: dot or icon + text, same sizes everywhere. Retire `.badge-*` and `badge-new`; "New" becomes a small dot on the row plus a count chip on the nav item.

**D10. Build only what the backend supports.**
No dashboards, customer lists, or reports until APIs exist. Placeholder nav items for non-existent modules mislead users. Add them to the sidebar the day the screen ships. The "Data needs" list in Phase 5 is what the backend must add first.

---

## 3b. CRM information architecture (decided)

**Navigation model:** fixed left sidebar, grouped, role-filtered. Sales see "Work" and "Sales"; admins also see "Finance" and "Admin". Items for modules that have no backend yet are **not shown** until the module ships (D10).

```
┌───────────────┬─────────────────────────────────────────────────────┐
│ [D] Digima    │  Customers                          [ + New customer ]│
│               │  Home › Customers                                    │
│ Search  ⌘K    │ ┌──────────────────────────────────────────────────┐│
│               │ │ All · Active · Inactive      🔍 Search   Filters ▾││
│ WORK          │ ├──────────────────────────────────────────────────┤│
│  Dashboard    │ │ Name ▲       Owner     Open est.   Balance   Last ││
│  Tasks     3  │ │ Acme Corp    J. Cruz   2         ₱120,000   2d   ││
│ SALES         │ │ ...                                              ││
│  Customers    │ ├──────────────────────────────────────────────────┤│
│  Contacts     │ │ Showing 1–25 of 132            ‹ 1 2 3 … ›       ││
│  Estimates    │ └──────────────────────────────────────────────────┘│
│ FINANCE       │                                                      │
│  Payments  7  │                                                      │
│  Reports      │                                                      │
│ ADMIN         │                                                      │
│  Users        │                                                      │
│  Integrations │                                                      │
│ ───────────── │                                                      │
│ (JC) J. Cruz ▴│  ← account menu: Change password, Log out            │
└───────────────┴─────────────────────────────────────────────────────┘
```

**Object model (what the UI is organised around):**
`Customer` (synced from QuickBooks, plus CRM-only fields: owner, status, tags) → has many `Contact`s, `Estimate`s (QBO), `Payment`s, `Activity` entries (notes, calls, tasks). `Payment` keeps its existing submit → review → post flow.

**Module rollout order (recommendation, by data availability):**
1. **Payments** (exists): reskin into the shell, becomes the first module.
2. **Customers** (QuickBooks already holds them): list + detail page with tabs *Overview · Estimates · Payments · Activity*.
3. **Estimates**: read-only list and detail from QBO, with "Record payment" shortcut into the existing submit form (customer + estimate prefilled).
4. **Activity & Tasks**: notes, call logs, follow-up tasks on a customer; Dashboard "My tasks" depends on this.
5. **Contacts**: people per customer.
6. **Dashboard & Reports**: last, because they need the data above to be meaningful.
Deals/pipeline boards are **deliberately not scheduled**: no data or requirement exists yet. Ask before designing.

**Cross-cutting CRM patterns:** global search / command palette (`Ctrl+K`: customers, estimates, payments, "go to" pages); customer detail page as the hub every other record links back to; saved views on list pages (post-v1); activity timeline component reused on customer and payment detail (who changed what, when).

**Logo decision:** a flat navy rounded square with a white geometric "D" (single colour, no gradient, legible at 16px as the favicon). The lockup is the mark plus "Digima" set in live Inter SemiBold text beside it, not baked into the SVG, so no font outlining is required and the wordmark stays crisp and accessible. Sidebar shows the lockup; the collapsed state shows only the mark. Replace if you have an official brand asset.

---

## 3c. Mobile-first (owner requirement, 2026-10-16)

**Why this changes things:** sales reps submit payments from a phone, often right after collecting money, in the field, on a mid-range Android over patchy 4G, one-handed, with a screenshot or photo already in their gallery. The phone is the **primary** device for Sales; the desktop is primary for Admin review and CRM browsing. Design order is therefore: **360×640 first → 768 → 1024+**. CSS is written mobile-first (base styles = phone; `min-width` queries add desktop). Desktop is an enhancement, never the starting layout.

**Baseline device and conditions (test targets):** 360×640 (small Android), 390×844 (iPhone), 4G with 300ms+ latency and occasional dropouts, system font scale up to 130%, one-handed thumb use, sunlight (so contrast ≥ AA, ideally 7:1 for body text).

### Principles

1. **Thumb zone.** Primary actions sit at the bottom of the screen. Navigation is a bottom tab bar, the Submit button is a sticky bottom bar. Nothing frequent lives in the top corners.
2. **Fewest taps for the core job.** "Submit a payment" is reachable in one tap from anywhere (centre tab). Safe defaults remove taps: date = today, received by = me, bank remembered from last time. The form only asks what a human must decide.
3. **Phone-native inputs.** `inputmode="decimal"` for amounts (numeric keypad), `type="search"` with `enterkeyhint="search"`, `type="date"`, `autocomplete` attributes, file input with `accept="image/*"` (gallery **and** camera). All text inputs ≥ **16px** font (anything smaller makes iOS Safari zoom the page on focus).
4. **Touch targets.** Minimum 44×44px with 8px spacing between targets (already satisfied by `--control-h: 44px`, now the **base** value; desktop shrinks to 36px, not the reverse).
5. **Bottom sheets, not centred dialogs.** On < 640px, dialogs, pickers and action menus slide up from the bottom (drag handle, swipe down or tap scrim to dismiss, 12px top radius). At ≥ 640px the same component renders as a centred dialog.
6. **One column, no horizontal scroll.** Data tables become stacked cards (title row + 2–3 key facts + status badge). Never a horizontally scrolling table on a phone as the primary view.
7. **Resilient to bad networks.** Skeleton screens, optimistic status, upload progress with a visible percentage, **Retry** that keeps the form data, and a draft saved to the device so a dropped connection or accidental app switch doesn't lose a half-filled form.
8. **Lightweight.** Compress photos client-side before upload (see UI-M.5), lazy-load admin code (already done), self-hosted font subset, no heavy chart libraries on mobile routes.
9. **Respect the device.** Use `100dvh` (not `100vh`, which is wrong behind mobile browser chrome), `env(safe-area-inset-*)` padding for notches and home indicators, and `viewport-fit=cover`. Honour system font size (rem units everywhere, no fixed-height text containers).
10. **Visible keyboard handling.** When the on-screen keyboard opens, the focused field scrolls into view and the sticky submit bar doesn't cover it; use `scroll-margin-bottom` on fields.

### Breakpoints (mobile-first, `min-width`)

| Token | Width | Layout |
|---|---|---|
| base | 0–639 | Single column, bottom tab bar, bottom sheets, card lists |
| `sm` | ≥ 640 | Centred dialogs, 2-column form groups where useful |
| `md` | ≥ 768 | Tablet: tab bar stays, content max 720px centred |
| `lg` | ≥ 1024 | **Left sidebar replaces tab bar**, tables replace card lists, master–detail for admin queue, density 36px controls |
| `xl` | ≥ 1280 | Content max 1200px; wider detail panels |

### Navigation on mobile (reconciles with the "sidebar" decision)

Sidebar is the **desktop (≥ 1024px)** navigation. Below that, a **bottom tab bar** with at most 5 items; extras go in a **More** sheet. A hamburger drawer as the *only* mobile navigation was rejected: it hides destinations behind two taps and sits in the hardest-to-reach corner.

```
Sales (phone)                         Admin (phone)
┌──────────────────────┐              ┌──────────────────────┐
│ ... page ...         │              │ ... page ...         │
├──────────────────────┤              ├──────────────────────┤
│ Home  Cust. [ + ] Pay │              │ Home  Review  Cust. More│
│            Submit  List│              │       (7)                │
└──────────────────────┘              └──────────────────────┘
```
- Sales tabs: **Home · Customers · (+) Submit · Payments · More**. The centre "+" is the primary action (accent-filled circle, 48px, labelled "Submit" beneath).
- Admin tabs: **Home · Review (count badge) · Customers · More**. "More" holds Estimates, Reports, Integrations, Users, account menu, Log out.
- The count badge on Review shows pending payments; the number is text, not just a dot.

### Mobile wireframe: Submit a payment (Sales, 360px)

```
┌────────────────────────────┐
│ ←  Submit payment          │  header 56px, back = previous page
├────────────────────────────┤
│ Customer / estimate        │
│ ┌────────────────────────┐ │
│ │ 🔍 Search…             │ │  tap → full-screen search sheet
│ └────────────────────────┘ │  (selected state shows card:
│                            │   Acme Corp · #1042 · ₱120,000
│ Amount received (₱)        │   Remaining ₱80,000  [Change])
│ ┌────────────────────────┐ │
│ │ 2,500.00               │ │  numeric keypad
│ └────────────────────────┘ │
│ Before bank fee            │
│                            │
│ Paid via                   │
│ ┌──────────┐┌──────────┐   │  2-column radio cards,
│ │ ○ BDO    ││ ○ UnionBk│   │  min 56px tall, last-used preselected
│ └──────────┘└──────────┘   │
│ ┌──────────┐┌──────────┐   │
│ │ ○ Digima ││ ○ HappyM.│   │
│ └──────────┘└──────────┘   │
│ ┌──────────────────────┐   │
│ │ ○ Cash               │   │
│ └──────────────────────┘   │
│                            │
│ Reference no. (optional)   │  hidden for Cash
│ [____________________]     │
│                            │
│ Receipt                    │
│ ┌────────────────────────┐ │
│ │  [📷 Take photo]       │ │  one tap = camera OR gallery
│ │  [🖼 Choose screenshot] │ │  (two explicit buttons; preview
│ └────────────────────────┘ │   + Replace/Remove after pick)
│                            │
│ Received 16 Oct 2026 by You│  collapsed defaults row
│                    [Change]│  (date + receiver in a sheet)
│                            │
│ (spacer so content clears  │
│  the sticky bar)           │
├────────────────────────────┤
│ [   Submit for approval   ]│  sticky, 48px, safe-area padded
└────────────────────────────┘
```

Decisions behind it:
- **Collapse the two rarely-changed fields** (date received, received by) into a one-line "Received today by You · Change" row that opens a bottom sheet. Today they are two full fields every time; for a rep submitting at the moment of payment, the defaults are right ~95% of the time. This removes two inputs and about 250px of scroll. *(Assumption: validate with Sales; if late submissions are common, make date visible.)*
- **Remove the numbered step headings** ("1. Estimate" …). On a 360px screen they cost vertical space and imply a wizard that isn't one.
- **Single page, not a multi-step wizard.** Seven simple fields don't justify steps; steps add taps. Alternative rejected: wizard. Revisit only if usability testing shows people lose their place.
- **Remember last-used bank** per user (device storage) to save a tap.
- **Estimate search is a full-screen sheet**, not an inline dropdown: the on-screen keyboard covers about half the screen, and a dropdown under the input would be hidden. The sheet shows recent estimates first, then live results (customer, #, total, status).
- **Inline over-amount warning** appears directly under the amount field, with text, not just colour.
- **Submit button states:** disabled-looking buttons that give no reason are hostile on mobile. Keep the button enabled; on tap, scroll to and focus the first invalid field with its message. While sending: "Uploading 62%…" with progress; on failure: error banner with **Retry** and the form intact.
- **After success:** full-screen confirmation ("Submitted. Admin will review it.") with primary "Submit another", secondary "View submission". Also a toast is not enough on mobile: the thumb may be mid-air and miss it.

### Mobile wireframe: Admin review on a phone (≤ 1023px)

```
List                                   Detail (full screen, back = list)
┌────────────────────────┐             ┌────────────────────────┐
│ Review            7 ⟳  │             │ ← Acme Corp   ₱2,500   │
│ [Pending][Attention]   │             │ ┌────────────────────┐ │
│ ┌────────────────────┐ │             │ │   receipt image    │ │ pinch zoom
│ │ Acme Corp   ₱2,500 │ │             │ │   (tap = full)     │ │
│ │ BDO · J. Cruz · 2h │ │   tap →     │ └────────────────────┘ │
│ └────────────────────┘ │             │ Deposited to  BDO      │
│ ┌────────────────────┐ │             │ Reference     12345678 │
│ │ ...                │ │             │ Received      16 Oct   │
└────────────────────────┘             │ Final (net) amount     │
                                       │ [ 2,462.50 ] [−1.5%]   │
                                       │ Fee ₱37.50 (1.5%)      │
                                       ├────────────────────────┤
                                       │ [Reject] [Approve ₱2,462.50]│ sticky
                                       └────────────────────────┘
```
- Approve and Reject open **bottom sheets** (consequence breakdown / reason with quick-pick chips). Approve remains a two-step action because it posts to QuickBooks irreversibly. The Approve button label includes the amount to prevent mistaken taps.
- After deciding, auto-advance to the next pending item; swipe gestures are **not** used for approve/reject (accidental irreversible actions).
- Keyboard shortcuts (J/K/A/R) stay desktop-only enhancements.

### Mobile-specific insights / trade-offs

- **Dark mode / gradients:** unchanged; light only. `color-scheme: light` also stops Android's "force dark" from inverting the page, which is a real risk on phones and now a bigger reason to ship UI-0.2.
- **PWA ("Add to home screen")** gives a one-tap launch icon and standalone chrome. Recommended: web manifest + icons now (cheap). Offline submission queue and push notifications ("Your payment was approved/rejected") are **valuable but costly**; scope them as Phase M stretch goals, not v1. Without push, the in-app "New" dot and badge count remain the notification channel.
- **Camera vs screenshot:** reps mostly attach bank-app screenshots from the gallery, so "Choose screenshot" is as prominent as "Take photo". Both are explicit buttons because one ambiguous file input behaves differently across Android and iOS.
- **Screenshots are large** (3–6 MB on modern phones). The current 5 MB hard limit would reject valid receipts and force users to hunt for a smaller image. Compress in the browser instead of rejecting (UI-M.5) and raise the server limit if needed.
- **Hover doesn't exist.** Every hover affordance (tooltips, row actions) needs a tap equivalent. Information shown only on hover is banned.
- **Money entry errors are expensive.** Show the typed amount formatted back ("₱2,500.00") beneath the field as the user types, so a missing zero is visible without reading the keypad.

---

## 4. Design tokens (new / changed)

Implement as CSS variables in `frontend/src/styles/tokens.css`, mapped into Tailwind v4 via `@theme` so utilities (`bg-surface`, `text-muted`) exist and raw palette utilities are no longer used.

```
color.bg            #f6f7f9    page background
color.surface       #ffffff    cards, tables, dialogs
color.surface-sunk  #f0f2f5    table header, hover row, inputs disabled
color.border        #e4e7eb    hairlines, dividers
color.border-strong #7b8794    input borders (3.7:1 on white; the old #9aa5b1 was 2.5:1 and failed)
color.text          #1f2933
color.text-muted    #52606d
color.accent        #1f4e79    primary buttons, active nav, links
color.accent-hover  #163a5a
color.accent-subtle #e8f0f7    selected row, active nav background
color.focus-ring    #1f4e79    2px ring + 2px offset (match accent, not a second blue)
status.success/warning/danger/info: keep existing text + bg pairs
space   4 8 12 16 24 32 48        (4px base)
radius.control 6px   radius.card 8px   radius.badge 999px   (no 12px+ anywhere)
shadow.float  0 4px 16px rgb(16 24 40 / .08)   (menus, dialogs, toasts ONLY)
shadow.card   none
font.family   "Inter", system-ui, sans-serif (self-hosted woff2, no CDN)
font.size     12 / 13 / 14 (body) / 16 / 20 (page title) / 24
font.numeric  tabular-nums on all money and dates
control.h     44px BASE (mobile-first)  →  36px at (min-width:1024px) and (pointer:fine)
font.input    16px minimum on all inputs (prevents iOS focus zoom)
tabbar.h      56px + env(safe-area-inset-bottom)
bottombar.h   (sticky submit) 72px incl. 8px padding + safe-area
radius.sheet  12px 12px 0 0 (bottom sheets <640px)
z-index       content 0 · sticky bar 20 · tabbar 30 · sheet scrim 40 · sheet 50 · toast 60
breakpoints   sm 640 · md 768 · lg 1024 · xl 1280  (min-width only)
motion        120ms ease-out; none under prefers-reduced-motion
```

Forbidden: `linear-gradient`, `radial-gradient`, `conic-gradient`, `backdrop-filter` blur glass, `prefers-color-scheme: dark`, `.dark` classes, `shadow-sm/md/lg` on static cards. Enforce via the lint check in UI-0.4.

---

## 5. Task list

### Phase 0: Foundation (blocks everything else)

- [x] **UI-0.1** Create `styles/tokens.css` with the tokens above; wire into Tailwind v4 `@theme`; replace `:root` values in [app.css](frontend/src/styles/app.css).
- [x] **UI-0.2** Add `color-scheme: light` on `:root` and `<meta name="color-scheme" content="light">` in [index.html](frontend/index.html). (D1)
- [x] **UI-0.3** Self-host Inter (variable woff2) in `public/fonts`; set type scale; set `font-variant-numeric: tabular-nums` utility `.num`.
- [x] **UI-0.4** Add a guard script (`npm run lint:design`) that fails if `src/` contains `gradient`, `prefers-color-scheme`, `dark:`, or palette utilities `(slate|gray|green|blue|red|amber)-\d`. Run it in CI/`npm test`.
- [x] **UI-0.5** Decide the styling approach: **migrate to Tailwind utilities + tokens and delete `app.css` class soup**, or keep CSS classes and delete Tailwind utilities from pages. *Recommendation: Tailwind + small component library, since it's already installed, v4 tokens are first-class, and components encapsulate the classes so pages stay clean.*
- [x] **UI-0.6** Fix `<title>` handling: per-route document titles ("Pending approvals · Digima"), favicon, `lang`, theme-colour meta (light).

**Done when:** pages render identically to today but all colour/spacing come from tokens; design-lint passes.

### Phase 1: Shell & core components

- [x] **UI-1.1** `AppShell` **mobile-first**: base = top header (56px) + content + **bottom `TabBar`** (<1024px); `lg` and up = sidebar (232px) + header + content (max 1200px, 24px padding). Safe-area insets, `100dvh`, `viewport-fit=cover`. The tab bar hides while the on-screen keyboard is open.
- [x] **UI-1.1b** `TabBar` component: 4–5 role-based items, active state = accent colour + label weight + top indicator (not colour alone), centre primary action for Sales, "More" opens a `BottomSheet` with remaining destinations and account actions.
- [x] **UI-1.2** Sidebar nav with icons (lucide-react, tree-shaken): role-filtered items, active state = `accent-subtle` bg + accent text + 2px left bar; badge count for pending (admin) / unseen (sales).
- [x] **UI-1.3** `AccountMenu` at sidebar foot: avatar initials, name, role; items: Change password, Log out. Replaces the inline row in [Topbar.tsx](frontend/src/components/Topbar.tsx).
- [x] **UI-1.4** `PageHeader` (title, optional description, breadcrumb, right-aligned actions). Every page uses it. (m8)
- [x] **UI-1.5** Primitives: `Button` (primary / secondary / ghost / danger-outline; sm, md; loading state with spinner and preserved width), `Input`, `Select`, `Textarea`, `Checkbox`, `Card`, `Badge`/`StatusBadge`. Rewrite [Field.tsx](frontend/src/components/Field.tsx) on top of these; keep its a11y wiring.
- [x] **UI-1.6** `Dialog` → **responsive**: renders as a `BottomSheet` (<640px: drag handle, swipe/scrim/Esc to dismiss, max-height 90dvh, scrollable body, sticky action footer) and as a centred dialog at ≥640px. Focus trap, return focus, scroll lock. + `ConfirmDialog`. *Recommendation: native `<dialog>`, no new dependency.*
- [x] **UI-1.7** `Toast` region: on mobile, anchored **above the tab bar / sticky bar** (never under it), full-width minus 16px gutters; bottom-right on desktop. `aria-live`; 5s auto-dismiss, errors persist; Undo slot. Important outcomes (payment submitted) also get an in-page confirmation, not a toast alone.
- [x] **UI-1.8** `Skeleton`, `EmptyState` (icon, headline, one-line help, optional action), `ErrorState` (message + Retry).
- [x] **UI-1.9** Login redesign: centred card, brand mark, no header bar. (M6) Add `/403` and `/404` pages. (m3)
- [x] **UI-1.10** Logo mark + favicon created (favicon link and BrandLockup now wired): `frontend/public/logo-mark.svg`, `frontend/public/favicon.svg`. Still to do: add `<link rel="icon" href="/favicon.svg" type="image/svg+xml">` to [index.html](frontend/index.html), and build the `BrandLockup` component (mark + "Digima" text) for sidebar/login.
- [x] **UI-1.11** Sidebar grouped sections (Work / Sales / Finance / Admin) with section labels, collapsible to a 64px icon rail (tooltips on hover/focus), state remembered in `localStorage` (wrapped in try/catch).
- [ ] **UI-1.12** Global search / command palette (`Ctrl/⌘+K`): "Go to" pages now; entity search (customers, estimates, payments) once Phase 7 APIs exist.

**Done when:** all existing pages sit inside the new shell using shared primitives; no page imports raw `.btn`/`.panel` classes.

### Phase 2: Sales experience

- [x] **UI-2.1** Split "Submit payment" and "My submissions" into two routes (`/payments/new`, `/payments`). (M2)
- [x] **UI-2.2** Submit form **mobile layout first** (see 3c wireframe): single column, no numbered headings, field order Estimate → Amount → Paid via → Reference → Receipt → "Received today by You · Change" row; sticky bottom submit bar. Enhancement at ≥1024px: two columns, right = sticky **summary card** (customer, estimate total, remaining, entered amount, receipt thumbnail).
- [x] **UI-2.2b** Collapsed "Received on / by" row with a `BottomSheet` editor; defaults today + current user; shows "Change" as a ≥44px target.
- [x] **UI-2.2c** Amount field: `inputmode="decimal"`, live formatted echo ("₱2,500.00"), thousands separators on blur, paste-tolerant (`cleanAmount`), over-remaining warning directly beneath.
- [x] **UI-2.2d** Remember last-used bank per user; preselect it.
- [x] **UI-2.2e** Draft autosave of the whole form (text fields only, plus the receipt kept in memory) to `sessionStorage`/`localStorage` in try/catch; restore on return with a small "Draft restored · Discard" note.
- [x] **UI-2.3** `EstimatePicker`: on mobile a **full-screen search sheet** (keyboard-safe, results list scrolls above the keyboard, sticky search field, recents first); on desktop an inline ARIA combobox (`role=combobox`, `aria-activedescendant`). Result rows show number, customer, total, status badge. Selected state is a summary card with "Change".
- [x] **UI-2.4** Payment mode as **radio cards** (2-column grid on mobile, ≥56px tall; one row on desktop) instead of `<select>`; real `<input type=radio>` inside a `<fieldset>`/`<legend>`. Reference-number field shows/hides for Cash. (Banks list from the API, see Phase 5.)
- [x] **UI-2.5** `ReceiptUpload`: two explicit buttons on mobile ("Take photo" with `capture="environment"`, "Choose screenshot"), drag-drop on desktop; inline preview, name/size, Replace/Remove, **upload progress %**, and client-side compression (see UI-M.5).
- [x] **UI-2.6** Duplicate-pending and over-remaining warnings become inline `Alert` (warning) with explicit "Submit anyway" action; remove `confirm()`. (B3, D7)
- [x] **UI-2.7** Submit success: full-screen confirmation on mobile (what was submitted, "Submit another" primary, "View submission" secondary); form reset behind it. Failure: banner with **Retry**, all data kept. Unsaved-form guard (`beforeunload`) when the form is dirty.
- [x] **UI-2.8** (done with Phase 4: tabs, search, bank filter, sortable table, cards, detail sheet, URL-kept filters) "My submissions" using the shared `DataTable` (Phase 4): status tabs (All · Pending · Approved · Rejected), search, row → detail drawer with rejection reason and receipt. "New" = dot + dismiss all.

### Phase 3: Admin experience

- [x] **UI-3.1** (built: `/admin/:id?`; phone = queue then full-screen review with sticky bar, ≥1024px = list + review side by side; oldest first) Review queue, **mobile-first**: base = card list → full-screen detail route with sticky `[Reject] [Approve ₱X]` bar (see 3c wireframe); at ≥1024px becomes master–detail (list left, detail right). (M1, D6)
- [x] **UI-3.2** (built: zoom 100–400%, rotate, open original, keys `+ - 0 R` while the receipt is focused; `R` there rotates and does not trigger Reject) `ReceiptViewer`: inline image with zoom, rotate, open-original, keyboard `+ - R`.
- [x] **UI-3.3** (built; the fee rate is the constant `DEFAULT_FEE_PERCENT` in `lib/review.ts` until UI-5.3 supplies it from the API) Decision panel: submitted-by/received-by/date/reference as a definition list; **net-amount input with live fee calculation** and a "Fee %" quick-fill using a configurable rate (m1); partial-sync notice as an `Alert` (warning).
- [x] **UI-3.4** `ApproveDialog` with Paid / Fee / Net / destination bank / "Invoice closed for ₱X"; primary button text states the action, "Approve and post ₱X". (B3, D7)
- [x] **UI-3.5** `RejectDialog`: required reason textarea with quick-pick chips, inline validation, "visible to the rep" helper text.
- [x] **UI-3.6** (J/K/A/R/? and auto-advance; shortcuts only open confirmations; Undo for reject now built on UI-5.5) Keyboard flow for the queue: `J/K` next/prev, `A` approve, `R` reject (opens dialog, never acts directly), `?` shows shortcut sheet. After a decision, auto-advance to the next item and offer Undo for the *reject* only (approve is irreversible in QBO).
- [~] **UI-3.7** (partial: search, rep, bank, "Waiting 2d" age text with >24h highlight, Pending and Needs-attention tabs done. History tab now built on UI-5.1; filters are now kept in the URL via UI-4.3) Queue filters: search, rep, bank, age (> 24h highlighted with text "Waiting 2d"). Tabs: Pending · Needs attention (partial sync) · History.
- [x] **UI-3.8** Empty state for "All caught up" (no emoji). (m5)
- [x] **UI-3.9** (built; "last verified" shows when the page last checked, true expiry waits for UI-5.6. The shell banner shows when QuickBooks is disconnected or an approval just failed on an expired connection) QuickBooks settings page: `ConnectionCard` (StatusBadge, company, realm, last verified, Reconnect), "Test connection" with summary result and a "Show raw response" disclosure; reconnect banner in the shell when the token is expired so it's visible from every admin page, not only on Submit. (B4)

### Phase 4: Shared data components

- [x] **UI-4.1** (built: `components/data/DataTable.tsx`; sorting is done by `ResultsView` so it can go server-side later) `DataTable`: sticky header, sortable columns (`aria-sort`), 40px rows, right-aligned tabular money, row hover, selected state, keyboard row navigation, horizontal scroll on narrow screens with first column pinned.
- [x] **UI-4.2** (built: page-size 25/50 with "Showing 1–25 of 132" on desktop, "Load more" on phones; in-memory until UI-5.1 adds server paging) Pagination (page-size 25/50) or "Load more", with `Showing 1–25 of 132`.
- [x] **UI-4.3** (built: `FilterBar` + `useUrlFilters`; used by My payments and the Approvals queue; filters sit in a bottom sheet on phones) `FilterBar`: search input, status tabs, dropdown filters, active-filter chips with "Clear all"; filter state kept in URL query so views are linkable and survive refresh.
- [x] **UI-4.4** (built: `DataList`/`ListRow`; `ResultsView` picks card list below 1024px and table above. Phones keep the default newest-first order, no sort control yet) `DataList` is the **default** mobile pattern (<1024px): each row = card (primary text, amount right-aligned, 1–2 secondary lines, `StatusBadge`), ≥64px tall, whole card tappable, filters in a "Filter" bottom sheet, infinite "Load more". `DataTable` is the ≥1024px enhancement. Build the card first.
- [x] **UI-4.5** (built: `money`, `dateShort`, `dateTime`, `relativeTime`, and a `RelativeTime` component; all in Manila time. Old `lib/ui.ts` table classes removed) Central formatters in [format.ts](frontend/src/lib/format.ts): `money`, `dateShort`, `dateTime`, `relativeTime` (always with absolute time in `title`); replace ad-hoc `toLocaleString()`. (m9)

### Phase 5: Backend asks (needed by the above; hand to backend-developer)

- [x] **UI-5.1** (built: `GET /api/payments`, filtered/sorted/paged, role-scoped; the Approvals page has a server-paged History tab. My payments still uses `/mine` (last 30); switching it is a small follow-up) `GET /api/payments` with `status`, `q`, `rep`, `bank`, `from/to`, `sort`, `page/pageSize` → `{ items, total }` (sales: own only; admin: all). Needed for DataTable and History tab.
- [x] **UI-5.2** (built: `GET /api/payments/:id` with audit events, fee and admin-only QuickBooks ids; used by the read-only History detail) `GET /api/payments/:id` full detail incl. audit trail (submitted, reviewed by, reviewed at, QBO ids).
- [x] **UI-5.3** (built: `GET /api/config/banks`; the submit form and the fee shortcut read it, with a built-in fallback) `GET /api/config/banks` (names, whether a reference number applies, default fee %) to replace the hard-coded `BANKS` array and the 1.5% constant.
- [x] **UI-5.4** (built as `GET /api/payments/counts`; nav badges poll it instead of the full lists) Pending count endpoint (or include in `/me`) for the sidebar badge, polling at 60s.
- [x] **UI-5.5** (built: soft undo within 30 s by the same admin; the toast offers Undo for exactly the time the server allows) Reject undo window: `POST /reject/:id/undo` within 30s, or soft-reject. Without this, drop Undo from UI-3.6.
- [x] **UI-5.6** (built: `lastVerifiedAt`, `expiresInDays`, `needsReauth`; shown on the QuickBooks page, and the shell banner warns 14 days ahead) QuickBooks status to include `lastVerifiedAt` and expiry.
- [x] **UI-5.7** (built; the submit form reuses one key per distinct payment and changes it if anything is edited) *(Mobile)* Accept an `Idempotency-Key` header on `POST /api/payments/submit` so a manual **Retry** after a dropped connection can't create duplicates (complements the existing duplicate-reference check). Still needed without the offline queue, because a request can reach the server even when the response is lost.
- [x] **UI-5.8** (built: `q` + `limit` search with `total`, `GET /payments/recent-estimates`; the picker no longer downloads the whole list) *(Mobile)* `GET /api/payments/recent-estimates` (the user's last ~5 estimates) for the empty state of the estimate search; and a **paginated/server-side estimate search** (`/api/qbo/estimates?q=&limit=`) because the current client downloads and filters the whole list, which is slow on mobile data.
- [x] **UI-5.9** (built: `?w=800` resized receipts and `thumbUrl`; the review viewer loads the small copy first and the full one on zoom) *(Mobile)* Thumbnail/resized receipt URL (Cloudinary transformation, e.g. `w_800,q_auto,f_auto`) in list responses, with full-size only on tap, to save bandwidth for admins on phones.

### Phase 6: Polish & verification

- [x] **UI-6.1** (done with an automated browser audit on a fake API: 360x640, 390x844, 640x360 landscape, 768, 1024, 1440, plus 130% text on both phone sizes. No horizontal scroll anywhere, tab bar below 1024px and sidebar from it, every touch target is 44px or more, inputs are 16px. Scripts live in `frontend/scripts/qa/`) Responsive pass at 360×640, 390×844, 768, 1024, 1440. No horizontal page scroll; tab bar ⇄ sidebar switch at 1024; tables degrade per UI-4.4. Test with 130% system font scale and landscape phone.
- [ ] **UI-6.1b** **Needs a person and real phones** (not done; emulated touch viewports only) Real-device check: one low-end Android (Chrome) and one iPhone (Safari). Verify keyboard doesn't hide the focused field or the submit bar, no zoom on input focus, camera/gallery picker works, safe-area padding on notched devices.
- [x] **UI-6.1c** (emulated in Chromium: Slow 4G shows live upload progress and completes; offline shows 'Connection lost' with Retry, keeps the amount and receipt, and Retry succeeds once back online. Not tested on a real network) Network resilience test: Chrome DevTools "Slow 4G" and "Offline" during submit; confirm progress, Retry, and data retention.
- [x] **UI-6.2** (done by tool, not by a person: axe WCAG 2.2 AA is clean at 360 and 1440 on every screen; a contrast test covers every token pair; keyboard order, 2px focus indicators, dialog focus trap and focus return, and reduced motion all pass. A screen-reader walkthrough was not done) Accessibility pass (WCAG 2.2 AA): tab order through shell → page; focus is visible (2px accent ring); dialogs trap and restore focus; target size ≥ 24px (44px on touch); contrast checked on every token pair; `prefers-reduced-motion` honoured; screen-reader names for icon-only buttons.
- [x] **UI-6.3** (`npm run lint:design` passes; it runs inside `npm test`) Run design-lint (UI-0.4) and confirm zero hits for gradients/dark mode/palette utilities.
- [x] **UI-6.4** (done: Login and Submit tests were updated in earlier phases; Approve/Reject dialog validation and the J/K/A/R queue flow are covered in `AdminPendingPage.test.tsx`) Update existing tests ([LoginPage.test.tsx](frontend/src/pages/LoginPage.test.tsx), [SubmitPaymentPage.test.tsx](frontend/src/pages/SubmitPaymentPage.test.tsx)) for new markup; add tests for ApproveDialog/RejectDialog validation and the queue keyboard flow.
- [ ] **UI-6.5** **Needs people** (not done): one sales rep and one admin Usability check with 1 sales rep (phone: submit a payment) and 1 admin (review five payments); record time-on-task and confusions.
- [x] **UI-6.6** (`app.css` was already removed; `frontend/DESIGN.md` documents tokens, components and rules) Delete dead CSS from `app.css`; document tokens/components in a short `frontend/DESIGN.md`.

---

### Phase M: Mobile enablers (run alongside Phases 0–2; M.1–M.3 block Phase 2)

- [~] **UI-M.1** (partial: `viewport-fit=cover` and `theme-color` done; `apple-mobile-web-app-capable` still to add) `index.html`: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` (do **not** set `user-scalable=no`; pinch-zoom is an accessibility requirement), `theme-color` (white), `apple-mobile-web-app-capable`.
- [x] **UI-M.2** Convert [app.css](frontend/src/styles/app.css) rules to mobile-first (base = phone, `@media (min-width: …)` for larger). Replace `100vh` with `100dvh`; add `scroll-padding-bottom` and `padding-bottom: env(safe-area-inset-bottom)` for sticky bars.
- [x] **UI-M.3** `StickyActionBar` component (bottom, safe-area aware, hides tab bar on form pages to avoid two stacked bars, 1px top border, white surface). Used by Submit and Review detail.
- [ ] **UI-M.4** Web app manifest (name, short_name "Digima", `display: standalone`, `theme_color`, icons 192/512/maskable derived from the logo mark) so reps can "Add to Home screen". No service worker needed for this step.
- [x] **UI-M.5** Client-side image compression before upload: downscale to max 2000px long edge, JPEG/WebP quality ~0.8, keep EXIF orientation correct; show "Optimising photo…" state; skip if already < 1.5 MB. Keep original if compression fails. Replace the "larger than 5 MB" rejection with compression-then-check. *Backend:* confirm the 5 MB server limit still applies post-compression; raise to ~10 MB as a safety margin.
- [x] **UI-M.6** Upload progress using `XMLHttpRequest` (`upload.onprogress`) or `fetch` streams in [client.ts](frontend/src/api/client.ts), because plain `fetch` can't report upload progress. Add timeout handling and an explicit "Connection lost. Retry" state.
- [ ] **UI-M.7** Header behaviour: static (not auto-hiding) on forms; page title left, optional back arrow; sticky only on list pages.
- [ ] **UI-M.8** *(Stretch)* Notify sales when a submission is reviewed: Web Push via service worker (needs backend VAPID + subscription storage), or as a lighter v1, poll `/api/payments/mine` every 60s while the app is open and update the tab badge.
- [~] **UI-M.9** **DEFERRED (owner decision, 2026-10-16): offline submission queue is not in scope for now.** Submit requires a connection; on failure the user sees the Retry banner with the form data kept (UI-2.7, UI-M.6, UI-2.2e). Revisit later: it would store the payload + receipt in IndexedDB and auto-retry when online. Do not build or design it until requested.

### Phase 7: CRM modules (after Phases 0–4; each one needs its Phase 5-style backend work first)

- [ ] **UI-7.1** Routes restructured: `/dashboard`, `/customers`, `/customers/:id`, `/estimates`, `/payments`, `/payments/new`, `/payments/review`, `/settings/integrations`, `/settings/users`. Redirect old `/`, `/admin`, `/setup`.
- [ ] **UI-7.2** **Customers list**: DataTable (name, owner, status, open estimates, outstanding balance, last activity), search, status tabs, owner filter, "+ New customer" (side drawer form). *Backend:* `GET /api/customers` (synced from QBO + CRM fields), `POST/PATCH`.
- [ ] **UI-7.3** **Customer detail**: header (name, status badge, owner, primary actions: Record payment, Add note), tabs Overview · Estimates · Payments · Activity; Overview = key facts + 3 summary tiles (open estimates, paid to date, outstanding) with no charts yet.
- [ ] **UI-7.4** **Activity timeline** component (notes, calls, status changes, payment events; author + absolute time) and "Add note" inline composer. *Backend:* `activities` table and endpoints.
- [ ] **UI-7.5** **Estimates**: list + detail from QBO with payment-progress bar (approved vs pending vs remaining; text labels, not colour only); "Record payment" button deep-links to `/payments/new?estimateId=`.
- [ ] **UI-7.6** **Tasks**: "My tasks" list, due dates, overdue shown as text "Overdue 2d"; task create from customer page. Sidebar count badge.
- [ ] **UI-7.7** **Contacts**: list and per-customer tab; click-to-copy email/phone.
- [ ] **UI-7.8** **Dashboard**: role-based. Sales: my tasks, my pending payments, my recent customers. Admin: payments awaiting review (count + oldest age), QuickBooks health, recent activity. Stat tiles + short lists only; charts via the `dataviz` skill, flat solid fills, no gradients, if reports are requested.
- [ ] **UI-7.9** **Users admin**: list, invite/create (replaces `scripts/create-user.ts` for non-developers), role, deactivate, reset password. Audit: who did it.
- [ ] **UI-7.10** **Audit trail** on customer and payment detail: who changed what and when (trust/auditability principle).

---

## 6. State checklist (apply to every new screen)

Default · hover · focus · active · disabled · loading (skeleton) · empty · error (with Retry) · no-permission (403 page) · offline/QuickBooks-down · too-much-data (pagination). A screen is not done until each is designed or explicitly marked n/a.

## 7. Open questions & risks

1. ~~Is "CRM" the goal or the name?~~ **Resolved: a real CRM.** Remaining question: do you need a **deals/pipeline** board? Not scheduled; tell me and I'll design it.
2. ~~Logo~~ **Resolved:** designer-created mark (see 3b); swap in an official asset any time. Product name is now "Digima" (not "Payment Portal").
3. ~~Sidebar vs top bar~~ **Resolved: sidebar.**
3b. **New:** should CRM customers be QuickBooks-synced only, or also creatable in the CRM and pushed to QuickBooks? Affects UI-7.2 (assumed: synced from QBO plus CRM-only fields; creating customers in CRM is out of scope until confirmed).
4. **Admin master–detail** costs more than polishing the cards; fall back to "cards + in-page receipt viewer + dialogs" (UI-3.2/3.4/3.5 only) if time is short. That alone removes B3 and most of M1.
5. **Undo for reject** needs backend support (UI-5.5); otherwise ship without it.
6. **Dependencies**: only `lucide-react` is proposed (icons). Everything else uses what's installed, and fonts are self-hosted to avoid third-party requests.
7. **Risk:** mixed Tailwind/CSS migration in Phase 0–1 touches every page. Keep PRs per page and tests green to avoid regressions on the auth and submit flows.

## 8. Suggested order of work (one-line summary)

Tokens + light-only lock → shell + primitives → dialogs replace `confirm/prompt` (biggest quality jump for least effort) → sales form → admin queue → shared table → backend endpoints → polish.
