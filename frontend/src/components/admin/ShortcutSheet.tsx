import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';

const KEYS: [string, string][] = [
  ['J / K', 'Next / previous payment'],
  ['A', 'Approve the selected payment (opens the confirmation)'],
  ['R', 'Reject the selected payment (opens the reason box)'],
  ['?', 'Show this list'],
];
const VIEWER: [string, string][] = [
  ['+ / −', 'Zoom in / out'],
  ['0', 'Reset zoom and rotation'],
  ['R', 'Rotate'],
];

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-2">
      {rows.map(([k, text]) => (
        <div key={k} className="contents">
          <dt>
            <kbd className="rounded-control border border-border-strong bg-surface-sunk px-2 py-0.5 text-small font-semibold">{k}</kbd>
          </dt>
          <dd>{text}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ShortcutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts" footer={<Button onClick={onClose}>Close</Button>}>
      <h3 className="mb-2 font-semibold">Review queue</h3>
      <Rows rows={KEYS} />
      <p className="mt-2 text-small text-text-muted">Shortcuts never act on their own: approve and reject always ask first.</p>
      <h3 className="mt-4 mb-2 font-semibold">With the receipt focused</h3>
      <Rows rows={VIEWER} />
    </Dialog>
  );
}
