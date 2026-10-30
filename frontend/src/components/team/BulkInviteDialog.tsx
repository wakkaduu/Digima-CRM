import { useMemo, useState, type FormEvent } from 'react';
import { Copy } from 'lucide-react';
import { ApiError } from '../../api/client';
import { useAddMember, type InviteResult } from '../../api/users';
import { Field } from '../Field';
import { Message } from '../Message';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Select, Textarea } from '../ui/controls';
import { useToast } from '../ui/Toast';
import { dateShort } from '../../lib/format';
import { parseBulkInvites, type BulkRole, type BulkRow } from '../../lib/parseBulkInvites';
import { roleLabel } from '../../lib/roles';

type Outcome = { row: BulkRow; invite: InviteResult } | { row: BulkRow; error: string };

const PLACEHOLDER = 'Ana Cruz, ana@company.com\nBen Reyes, ben@company.com, admin';

/** Paste a list, get one one-time invite link per person. Each line goes through the same endpoint as "Add person". */
export function BulkInviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const add = useAddMember();
  const toast = useToast();
  const [text, setText] = useState('');
  const [defaultRole, setDefaultRole] = useState<BulkRole>('sales');
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const parsed = useMemo(() => parseBulkInvites(text, defaultRole), [text, defaultRole]);

  const close = () => {
    if (sending) return;
    setText('');
    setDefaultRole('sales');
    setOutcomes(null);
    setMessage(null);
    onClose();
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (parsed.problems.length) return setMessage('Fix the lines marked below, then try again.');
    if (!parsed.rows.length) return setMessage('Paste at least one person.');

    setSending(true);
    const done: Outcome[] = [];
    // One at a time: a failure (for example an email that already exists) must not stop the others.
    for (const row of parsed.rows) {
      try {
        done.push({ row, invite: await add.mutateAsync({ name: row.name, email: row.email, role: row.role }) });
      } catch (err) {
        done.push({ row, error: err instanceof ApiError ? err.message : 'Something went wrong.' });
      }
    }
    setSending(false);
    setOutcomes(done);
  }

  async function copy(value: string, done: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ type: 'success', text: done });
    } catch {
      toast({ type: 'error', text: 'Could not copy. Select the link and press Ctrl+C.' });
    }
  }

  const created = outcomes?.filter((o): o is Extract<Outcome, { invite: InviteResult }> => 'invite' in o) ?? [];
  const failed = outcomes?.filter((o): o is Extract<Outcome, { error: string }> => 'error' in o) ?? [];

  return (
    <Dialog
      open={open}
      onClose={close}
      title={outcomes ? 'Invite links' : 'Add several people'}
      footer={
        outcomes ? (
          <>
            {created.length > 1 && (
              <Button onClick={() => copy(created.map((o) => `${o.row.name} <${o.row.email}>: ${o.invite.inviteUrl}`).join('\n'), 'All links copied.')}>
                <Copy aria-hidden className="size-4" /> Copy all
              </Button>
            )}
            <Button variant="primary" onClick={close}>Done</Button>
          </>
        ) : (
          <>
            <Button onClick={close} disabled={sending}>Cancel</Button>
            <Button variant="primary" type="submit" form="bulk-invite" loading={sending} disabled={!text.trim()}>
              {parsed.rows.length > 1 ? `Add ${parsed.rows.length} people` : 'Add people'}
            </Button>
          </>
        )
      }
    >
      {outcomes ? (
        <>
          <p className="mb-3">
            {created.length} {created.length === 1 ? 'person' : 'people'} added. Send each person their own link; it works once and
            is shown only now. If you lose one, use <strong>Invite link</strong> on their row.
          </p>
          <ul className="divide-y divide-border rounded-card border border-border">
            {created.map(({ row, invite }) => (
              <li key={invite.user.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{row.name} <span className="font-normal text-text-muted">· {roleLabel(row.role)}</span></p>
                  <p className="truncate text-small text-text-muted">{row.email} · expires {dateShort(invite.inviteExpiresAt)}</p>
                </div>
                <Button size="sm" onClick={() => copy(invite.inviteUrl, `Link for ${row.name} copied.`)} aria-label={`Copy invite link for ${row.name}`}>
                  <Copy aria-hidden className="size-4" /> Copy
                </Button>
              </li>
            ))}
          </ul>
          {failed.length > 0 && (
            <Message focus>
              {failed.length === 1 ? 'One person was not added:' : `${failed.length} people were not added:`}
              <ul className="mt-1 list-disc pl-5">
                {failed.map(({ row, error }) => <li key={row.line}>{row.name} ({row.email}): {error}</li>)}
              </ul>
            </Message>
          )}
        </>
      ) : (
        <>
          {message && <Message focus>{message}</Message>}
          <form id="bulk-invite" noValidate onSubmit={onSubmit}>
            <Field
              id="bulk-people"
              label="People"
              hint="One per line: name, email, and an optional role (sales or admin). A list copied from a spreadsheet works too."
            >
              {(aria) => (
                <Textarea id="bulk-people" rows={7} placeholder={PLACEHOLDER} value={text} onChange={(e) => setText(e.target.value)} {...aria} />
              )}
            </Field>
            <Field id="bulk-role" label="Role when a line has none">
              {(aria) => (
                <Select id="bulk-role" value={defaultRole} onChange={(e) => setDefaultRole(e.target.value as BulkRole)} {...aria}>
                  <option value="sales">{roleLabel('sales')}</option>
                  <option value="admin">{roleLabel('admin')}</option>
                </Select>
              )}
            </Field>
          </form>
          {parsed.problems.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-small font-semibold text-danger" aria-label="Lines to fix">
              {parsed.problems.map((p) => <li key={p.line}>Line {p.line}: {p.message} <span className="font-normal text-text-muted">({p.text})</span></li>)}
            </ul>
          )}
          <p className="mt-3 text-small text-text-muted">
            SuperAdmins are added one at a time with <strong>Add person</strong>.
          </p>
        </>
      )}
    </Dialog>
  );
}
