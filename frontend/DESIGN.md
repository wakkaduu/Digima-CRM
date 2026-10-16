# Frontend design system

Light mode only. No gradients. Mobile-first: the CSS and the components start from a 360px phone and add desktop at `lg` (1024px).
`npm run lint:design` (also part of `npm test`) fails on gradients, dark-mode hooks, raw palette colours (`slate-*`, `green-*`...) and `shadow-sm/md/lg`.

## Tokens (`src/styles/tokens.css`)

Everything visual comes from `@theme` tokens, so utilities such as `bg-surface`, `text-text-muted` and `rounded-card` exist and raw colours do not.

| Group | Tokens |
|---|---|
| Surfaces | `bg` page, `surface` cards, `surface-sunk` table header and hover, `accent-subtle` selected |
| Text | `text`, `text-muted` (never lighter than this for text) |
| Lines | `border` hairlines, `border-strong` control borders (3.7:1 on white), `focus-ring` |
| Accent | `accent`, `accent-hover`: the only brand colour, used for actions and the active state |
| Status | `success`, `warning`, `danger`, `info`, each with a `-bg`. Status only, never decoration |
| Shape | `rounded-control` 6px, `rounded-card` 8px, `rounded-sheet` 12px, `rounded-badge` pill |
| Depth | Static cards have a border and no shadow. `shadow-float` is for menus, dialogs and toasts only |
| Type | Inter (self-hosted). `text-micro` 12, `text-small` 13, `text-body` 14, `text-input` 16, `text-title` 20. Inputs are always 16px (stops iOS zooming on focus). Money uses `tabular-nums` |
| Size | `--control-h` 44px, 36px on desktop with a fine pointer. `--control-h-sm` 44px, 32px on desktop. Targets on phones are never below 44px |

`src/styles/tokens.contrast.test.ts` checks every text/background pair against WCAG AA (4.5:1 text, 3:1 control borders and focus ring). Change a colour and that test tells you if it broke.

Motion: spinners and skeletons opt out per element, and a global `prefers-reduced-motion` rule removes transitions and smooth scroll.

## Components

`components/ui` (primitives)
- `Button` (`primary | secondary | ghost | danger | link`; sizes `sm | md | lg`; `loading` keeps its width), `buttonClass()` for links that must look like buttons
- `Input`, `Select`, `Textarea`, `Checkbox`, `RadioCards`; `Field` (in `components/Field.tsx`) wires label, hint and error via `aria-describedby`
- `Card`, `PageHeader`, `StatusBadge` / `NewDot` / `CountChip` / `NeutralBadge`, `RelativeTime`
- `Dialog` (native `<dialog>`: a bottom sheet under 640px, centred above; focus trap and focus return come from the browser), `ConfirmDialog`
- `Toast` (`useToast()`; errors persist; optional action such as Undo), `Skeleton`, `EmptyState`, `ErrorState`, `StickyActionBar`

`components/shell`: `AppShell` (tab bar under 1024px, sidebar from 1024px), `Sidebar`, `TabBar`, `AccountMenu`, `BrandLockup`, `QboBanner`.

`components/data` (lists)
- `ResultsView` = `DataTable` (desktop) or `DataList` + `ListRow` (phone), with sorting and paging; `Pagination` and `LoadMore`
- `FilterBar` (tabs, search, dropdown filters, chips) and `useUrlFilters` (filters live in the URL)

`components/admin`: `PaymentReview`, `ReceiptViewer`, `ApproveDialog`, `RejectDialog`, `QueueList`, `HistoryList`, `PaymentHistoryDetail`, `ShortcutSheet`, `useQueueShortcuts`.

## Rules worth knowing

- **Pick the phone layout first.** Write the base classes for 360px, then add `lg:` for desktop. Use `max-lg:` to hide something on phones; `hidden lg:...` on a component that already sets `display` can lose to it, because `cn()` does not merge conflicting classes.
- **Do not override a component's size with `className`.** Use its `size` prop (`cn()` joins class names, it does not resolve conflicts).
- **Status is icon plus text**, never colour alone. Errors in forms say what to do next.
- **Server state lives in TanStack Query** (`src/api/payments.ts` has the hooks and keys). After a decision invalidate `PAYMENTS_KEY`.
- **Confirm with consequences.** Approve states the amounts and that QuickBooks will be updated; reject needs a reason and offers a 30-second Undo. Shortcuts only ever open a confirmation.
- **Never use `confirm()` or `prompt()`.**

## Checks that exist

| What | Where |
|---|---|
| Design rules (no gradients, no dark mode, tokens only) | `npm run lint:design` |
| Contrast of every token pair | `src/styles/tokens.contrast.test.ts` |
| Behaviour (forms, queue, dialogs, history, retry safety) | `npm test` |
| Layout at 360, 390, 640 landscape, 768, 1024, 1440 and 130% text, touch target sizes, input font size, axe WCAG 2.2 AA | manual audit script, see `UI_REDESIGN_TASKS.md` Phase 6 |
