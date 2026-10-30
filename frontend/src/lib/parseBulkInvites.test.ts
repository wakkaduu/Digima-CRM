import { parseBulkInvites } from './parseBulkInvites';

describe('parseBulkInvites', () => {
  it('reads name, email and an optional role, falling back to the default role', () => {
    const { rows, problems } = parseBulkInvites('Ana Cruz, ana@x.co\nBen Reyes; ben@x.co; Admin\n\nCy\tcy@x.co\tsales', 'sales');
    expect(problems).toEqual([]);
    expect(rows).toEqual([
      { line: 1, name: 'Ana Cruz', email: 'ana@x.co', role: 'sales' },
      { line: 2, name: 'Ben Reyes', email: 'ben@x.co', role: 'admin' },
      { line: 4, name: 'Cy', email: 'cy@x.co', role: 'sales' },
    ]);
  });

  it('uses the chosen default role', () => {
    expect(parseBulkInvites('Ana, ana@x.co', 'admin').rows[0].role).toBe('admin');
  });

  it('flags bad lines with their line number instead of guessing', () => {
    const { rows, problems } = parseBulkInvites('Ana, not-an-email\n, a@x.co\nBo, bo@x.co, superadmin\nDi, di@x.co\nDi Again, DI@x.co', 'sales');
    expect(rows.map((r) => r.email)).toEqual(['di@x.co']);
    expect(problems.map((p) => [p.line, p.message])).toEqual([
      [1, 'Missing or invalid email.'],
      [2, 'Missing name.'],
      [3, 'Role must be Sales or Admin.'],
      [5, 'This email appears twice in the list.'],
    ]);
  });
});
