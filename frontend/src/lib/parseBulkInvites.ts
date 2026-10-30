import type { Role } from '../api/types';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/** Bulk-added people can be Sales or Admin only: a SuperAdmin is always added one at a time, on purpose. */
export type BulkRole = Extract<Role, 'sales' | 'admin'>;

export interface BulkRow {
  line: number;
  name: string;
  email: string;
  role: BulkRole;
}

export interface BulkProblem {
  line: number;
  text: string;
  message: string;
}

/**
 * One person per line: `Name, email` or `Name, email, role`, separated by commas, semicolons or tabs (so a copied
 * spreadsheet works too). The role is optional and falls back to `defaultRole`. Blank lines are ignored; a repeated
 * email is flagged instead of creating two accounts.
 */
export function parseBulkInvites(input: string, defaultRole: BulkRole): { rows: BulkRow[]; problems: BulkProblem[] } {
  const rows: BulkRow[] = [];
  const problems: BulkProblem[] = [];
  const seen = new Set<string>();

  input.split(/\r?\n/).forEach((raw, i) => {
    const text = raw.trim();
    if (!text) return;
    const line = i + 1;
    const [name = '', email = '', roleText = ''] = text.split(/[\t,;]/).map((s) => s.trim());

    const fail = (message: string) => problems.push({ line, text, message });
    if (!name) return fail('Missing name.');
    if (!EMAIL_RE.test(email)) return fail('Missing or invalid email.');

    const lowered = roleText.toLowerCase();
    if (lowered && lowered !== 'sales' && lowered !== 'admin') return fail('Role must be Sales or Admin.');
    if (seen.has(email.toLowerCase())) return fail('This email appears twice in the list.');

    seen.add(email.toLowerCase());
    rows.push({ line, name, email, role: (lowered || defaultRole) as BulkRole });
  });

  return { rows, problems };
}
