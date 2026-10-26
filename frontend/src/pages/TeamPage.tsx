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
import { Avatar } from '../components/ui/Avatar';
import { Access } from '../components/team/Access';
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
            Send this link to <strong>{invite.user.name}</strong>. They open it and either sign in with the QuickBooks login they
            use for work, or choose a password and sign in with <strong>{invite.user.email}</strong>. It works once and expires on {dateShort(invite.inviteExpiresAt)}. Sending a new link also resets a forgotten password.
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
          hint="The email they will log in with if they choose a password. QuickBooks sign-in does not depend on it."
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

/** Person, role, access, actions: 1fr + 11rem + 17rem + 16rem, 16px gaps. Under 1024px each row stacks instead. */
const COLS = 'lg:grid lg:grid-cols-[minmax(0,1fr)_11rem_17rem_16rem] lg:items-center lg:gap-4';

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

  const people = team.data?.filter((m) => m.active);
  const unlinked = people?.filter((m) => !m.linked).length ?? 0;
  const summary = people
    ? `${people.length} ${people.length === 1 ? 'person' : 'people'} can sign in (${ROLES.map((r) => [people.filter((m) => m.role === r.value).length, r.label] as const)
        .filter(([n]) => n > 0)
        .map(([n, label]) => `${n} ${label}`)
        .join(', ')}).${unlinked ? ` ${unlinked} ${unlinked === 1 ? 'has' : 'have'} not linked QuickBooks yet.` : ''}`
    : 'People who can sign in with QuickBooks, and what each of them can do.';

  return (
    <div>
      <PageHeader
        title="Team"
        description={summary}
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
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          <div aria-hidden className={`hidden border-b border-border px-4 py-2 text-small font-medium text-text-muted ${COLS}`}>
            <span>Person</span>
            <span>Role</span>
            <span>Access</span>
            <span />
          </div>
          <ul className="divide-y divide-border">
            {team.data.map((m, i) => {
              const isMe = m.id === me?.id;
              return (
                <li key={m.id} className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 ${COLS}`}>
                  <div className="flex min-w-0 basis-full items-center gap-3 lg:basis-auto">
                    <Avatar name={m.name} index={i} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {m.name} {isMe && <span className="font-normal text-text-muted">(you)</span>}
                      </p>
                      <p className="truncate text-small text-text-muted">{m.email}</p>
                    </div>
                  </div>
                  <Select
                    aria-label={`Role for ${m.name}`}
                    className="w-auto lg:order-2 lg:w-full"
                    value={m.role}
                    disabled={isMe || !m.active || update.isPending}
                    onChange={(e) => {
                      const role = e.target.value as Role;
                      void change(m, { role }, `${m.name} is now ${roleLabel(role)}.`);
                    }}
                  >
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </Select>
                  <div className="text-small lg:order-3 lg:text-body">
                    <Access member={m} />
                  </div>
                  <div className="flex gap-2 lg:order-4 lg:justify-end">
                    {m.active && (
                      <Button size="sm" loading={reinvite.isPending && reinvite.variables === m.id} onClick={() => newInvite(m)} aria-label={isMe ? 'Get a link to set your own password' : `New invite link for ${m.name}`}>
                        <Link2 aria-hidden className="size-4" /> {isMe ? 'Set a password' : m.linked ? 'New invite link' : 'Invite link'}
                      </Button>
                    )}
                    {m.active ? (
                      <Button size="sm" disabled={isMe} onClick={() => setDeactivating(m)} aria-label={`Deactivate ${m.name}`}>
                        Deactivate
                      </Button>
                    ) : (
                      <Button size="sm" loading={update.isPending} onClick={() => change(m, { active: true }, `${m.name} can sign in again.`)} aria-label={`Reactivate ${m.name}`}>
                        Reactivate
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {people && (
        <section aria-label="What each role can do" className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-card border border-border bg-border lg:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r.value} className="bg-surface p-4">
              <h2 className="font-semibold">
                {r.label} <span className="font-normal text-text-muted tabular-nums">{people.filter((m) => m.role === r.value).length}</span>
              </h2>
              <p className="mt-1 text-text-muted">{r.hint}</p>
            </div>
          ))}
        </section>
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
