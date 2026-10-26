import { useState, type FormEvent } from 'react';
import { Copy, Link2, UserPlus } from 'lucide-react';
import { useMe } from '../api/auth';
import { ApiError } from '../api/client';
import { useAddMember, useReinvite, useTeam, useUpdateMember, type InviteResult } from '../api/users';
import type { Role, TeamMember } from '../api/types';
import { Field, TextField } from '../components/Field';
import { Message } from '../components/Message';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Dialog } from '../components/ui/Dialog';
import { PageHeader } from '../components/ui/PageHeader';
import { ErrorState, Skeleton } from '../components/ui/States';
import { ToneBadge } from '../components/ui/StatusBadge';
import { useToast } from '../components/ui/Toast';
import { Input, Select } from '../components/ui/controls';
import { dateShort } from '../lib/format';
import { ROLES, roleLabel } from '../lib/roles';
import { useDocumentTitle } from '../lib/useDocumentTitle';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/** The one-time link, shown right after it is created. It cannot be shown again, only replaced. */
function InviteLinkDialog({ invite, onClose }: { invite: InviteResult | null; onClose: () => void }) {
  const toast = useToast();

  async function copy() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.inviteUrl);
      toast({ type: 'success', text: 'Invite link copied.' });
    } catch {
      // Clipboard blocked (insecure page, denied permission): the link is selected so Ctrl+C works.
      document.getElementById('invite-link')?.focus();
      (document.getElementById('invite-link') as HTMLInputElement | null)?.select();
    }
  }

  return (
    <Dialog
      open={!!invite}
      onClose={onClose}
      title="Send this invite link"
      footer={<Button variant="primary" onClick={onClose}>Done</Button>}
    >
      {invite && (
        <>
          <p className="mb-3">
            Send this link to <strong>{invite.user.name}</strong>. They open it and sign in with the QuickBooks login they use
            for work; that links their account. It works once and expires on {dateShort(invite.inviteExpiresAt)}.
          </p>
          <Field id="invite-link" label="One-time invite link" hint="It is shown only now. If you lose it, create a new one.">
            {(aria) => (
              <div className="flex gap-2">
                <Input id="invite-link" readOnly value={invite.inviteUrl} onFocus={(e) => e.currentTarget.select()} {...aria} />
                <Button onClick={copy} aria-label="Copy invite link">
                  <Copy aria-hidden className="size-4" /> Copy
                </Button>
              </div>
            )}
          </Field>
        </>
      )}
    </Dialog>
  );
}

function AddPersonDialog({ open, onClose, onInvited }: { open: boolean; onClose: () => void; onInvited: (invite: InviteResult) => void }) {
  const add = useAddMember();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('sales');
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [message, setMessage] = useState<string | null>(null);

  const close = () => {
    setName('');
    setEmail('');
    setRole('sales');
    setErrors({});
    setMessage(null);
    onClose();
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    const found: typeof errors = {};
    if (!name.trim()) found.name = 'Enter their name.';
    if (!EMAIL_RE.test(email.trim())) found.email = 'Enter an email address, for example name@company.com.';
    setErrors(found);
    if (found.name || found.email) return document.getElementById(found.name ? 'member-name' : 'member-email')?.focus();

    try {
      const invite = await add.mutateAsync({ name: name.trim(), email: email.trim(), role });
      close();
      onInvited(invite);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Add a person"
      footer={
        <>
          <Button onClick={close} disabled={add.isPending}>Cancel</Button>
          <Button variant="primary" type="submit" form="add-member" loading={add.isPending}>Add person</Button>
        </>
      }
    >
      {message && <Message focus>{message}</Message>}
      <form id="add-member" noValidate onSubmit={onSubmit}>
        <TextField id="member-name" label="Name" autoComplete="off" value={name} error={errors.name} onChange={(e) => (setName(e.target.value), setErrors((x) => ({ ...x, name: undefined })))} />
        <TextField
          id="member-email"
          label="Email"
          type="email"
          autoComplete="off"
          hint="Only a label so you can recognise them. Their QuickBooks login is linked when they open the invite link."
          value={email}
          error={errors.email}
          onChange={(e) => (setEmail(e.target.value), setErrors((x) => ({ ...x, email: undefined })))}
        />
        <Field id="member-role" label="Role" hint={ROLES.find((r) => r.value === role)?.hint}>
          {(aria) => (
            <Select id="member-role" value={role} onChange={(e) => setRole(e.target.value as Role)} {...aria}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
          )}
        </Field>
      </form>
    </Dialog>
  );
}

/** Where a person stands: signed up (linked), waiting on an invite, or the invite ran out. */
function InviteBadge({ member }: { member: TeamMember }) {
  if (!member.active || member.linked) return null;
  if (member.invitePending && member.inviteExpiresAt) {
    return new Date(member.inviteExpiresAt) > new Date()
      ? <ToneBadge tone="warning">Invite pending · expires {dateShort(member.inviteExpiresAt)}</ToneBadge>
      : <ToneBadge tone="danger">Invite expired</ToneBadge>;
  }
  return <ToneBadge tone="neutral">Not invited yet</ToneBadge>;
}

/** SuperAdmin: who may sign in, and as what. People join by one-time invite link; there are no passwords. */
export default function TeamPage() {
  useDocumentTitle('Team');
  const { data: me } = useMe();
  const team = useTeam();
  const update = useUpdateMember();
  const reinvite = useReinvite();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [deactivating, setDeactivating] = useState<TeamMember | null>(null);
  const [invite, setInvite] = useState<InviteResult | null>(null);

  async function change(member: TeamMember, patch: { role?: Role; active?: boolean }, done: string) {
    try {
      await update.mutateAsync({ id: member.id, ...patch });
      toast({ type: 'success', text: done });
    } catch (err) {
      toast({ type: 'error', title: 'Could not update the account', text: err instanceof ApiError ? err.message : 'Please try again.' });
    }
  }

  async function newInvite(member: TeamMember) {
    try {
      setInvite(await reinvite.mutateAsync(member.id));
    } catch (err) {
      toast({ type: 'error', title: 'Could not create the invite link', text: err instanceof ApiError ? err.message : 'Please try again.' });
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Team"
        description="People who can sign in with QuickBooks, and what each of them can do."
        actions={
          <Button variant="primary" onClick={() => setAdding(true)}>
            <UserPlus aria-hidden className="size-4" /> Add person
          </Button>
        }
      />

      {team.isPending && (
        <div role="status" aria-label="Loading the team" className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      )}
      {team.error && <ErrorState message={team.error.message} onRetry={() => team.refetch()} />}

      {team.data && (
        <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {team.data.map((m) => {
            const isMe = m.id === me?.id;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="truncate font-semibold">
                    {m.name} {isMe && <span className="font-normal text-text-muted">(you)</span>}
                  </p>
                  <p className="truncate text-small text-text-muted">{m.email}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {!m.active && <ToneBadge tone="danger">Deactivated</ToneBadge>}
                    <InviteBadge member={m} />
                  </div>
                </div>
                <Select
                  aria-label={`Role for ${m.name}`}
                  className="w-auto"
                  value={m.role}
                  disabled={isMe || !m.active || update.isPending}
                  onChange={(e) => {
                    const role = e.target.value as Role;
                    void change(m, { role }, `${m.name} is now ${roleLabel(role)}.`);
                  }}
                >
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </Select>
                {m.active && !isMe && (
                  <Button size="sm" loading={reinvite.isPending && reinvite.variables === m.id} onClick={() => newInvite(m)} aria-label={`New invite link for ${m.name}`}>
                    <Link2 aria-hidden className="size-4" /> {m.linked ? 'New invite link' : 'Invite link'}
                  </Button>
                )}
                {m.active ? (
                  <Button variant="danger" size="sm" disabled={isMe} onClick={() => setDeactivating(m)} aria-label={`Deactivate ${m.name}`}>
                    Deactivate
                  </Button>
                ) : (
                  <Button size="sm" loading={update.isPending} onClick={() => change(m, { active: true }, `${m.name} can sign in again.`)} aria-label={`Reactivate ${m.name}`}>
                    Reactivate
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <AddPersonDialog open={adding} onClose={() => setAdding(false)} onInvited={setInvite} />
      <InviteLinkDialog invite={invite} onClose={() => setInvite(null)} />
      <ConfirmDialog
        open={!!deactivating}
        title={`Deactivate ${deactivating?.name ?? ''}?`}
        confirmLabel="Deactivate"
        tone="danger"
        loading={update.isPending}
        onCancel={() => setDeactivating(null)}
        onConfirm={async () => {
          if (!deactivating) return;
          await change(deactivating, { active: false }, `${deactivating.name} can no longer sign in.`);
          setDeactivating(null);
        }}
      >
        <p>
          They are signed out and cannot sign in again until you reactivate them. Their QuickBooks connection is removed.
          Payments they submitted stay in the history.
        </p>
      </ConfirmDialog>
    </div>
  );
}
