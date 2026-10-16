import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { useState } from 'react';
import { useUrlFilters } from '../../lib/useUrlFilters';
import { DataTable, type Column, type Sort } from './DataTable';
import { FilterBar } from './FilterBar';
import { formatSort, parseSort, ResultsView } from './ResultsView';

interface Row {
  id: string;
  name: string;
  amount: number;
}
const rows: Row[] = Array.from({ length: 60 }, (_, i) => ({ id: `r${i + 1}`, name: `Customer ${String(i + 1).padStart(2, '0')}`, amount: (i + 1) * 100 }));
const columns: Column<Row>[] = [
  { id: 'name', header: 'Name', pin: true, sortValue: (r) => r.name, cell: (r) => r.name },
  { id: 'amount', header: 'Amount', align: 'right', sortValue: (r) => r.amount, cell: (r) => `₱${r.amount}` },
  { id: 'note', header: 'Note', cell: () => '—' },
];

const viewport = (desktop: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: desktop && query.includes('1024'), addEventListener() {}, removeEventListener() {} }));
afterEach(() => vi.unstubAllGlobals());

function Harness({ initial = 'name:asc' }: { initial?: string }) {
  const [sort, setSort] = useState<Sort | null>(parseSort(initial, columns));
  return (
    <ResultsView
      rows={rows}
      columns={columns}
      getRowId={(r) => r.id}
      label="Customers"
      resetKey="x"
      sort={sort}
      onSortChange={setSort}
      renderCard={(r) => <span>{r.name}</span>}
    />
  );
}

describe('DataTable', () => {
  it('marks the sorted column, toggles direction, and leaves unsortable columns alone', async () => {
    const onSort = vi.fn();
    render(<DataTable columns={columns} rows={rows.slice(0, 3)} getRowId={(r) => r.id} caption="Customers" sort={{ id: 'name', dir: 'asc' }} onSortChange={onSort} />);
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getByRole('columnheader', { name: /Amount/ })).toHaveAttribute('aria-sort', 'none');
    expect(screen.getByRole('columnheader', { name: 'Note' })).not.toHaveAttribute('aria-sort');

    await userEvent.click(within(screen.getByRole('columnheader', { name: /Name/ })).getByRole('button'));
    expect(onSort).toHaveBeenLastCalledWith({ id: 'name', dir: 'desc' });
    await userEvent.click(within(screen.getByRole('columnheader', { name: /Amount/ })).getByRole('button'));
    expect(onSort).toHaveBeenLastCalledWith({ id: 'amount', dir: 'asc' });
  });

  it('moves between rows with the arrow keys and opens one with Enter', async () => {
    const onOpen = vi.fn();
    render(<DataTable columns={columns} rows={rows.slice(0, 3)} getRowId={(r) => r.id} caption="Customers" onRowClick={onOpen} />);
    const body = screen.getAllByRole('row').slice(1);
    expect(body.map((r) => r.tabIndex)).toEqual([0, -1, -1]); // one stop in the tab order
    body[0]!.focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(body[2]).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(body[0]).toHaveFocus();
    await userEvent.keyboard('{End}{Enter}');
    expect(onOpen).toHaveBeenCalledWith(rows[2]);
  });

  it('opens a row on click, and right-aligns and pins as configured', async () => {
    const onOpen = vi.fn();
    render(<DataTable columns={columns} rows={rows.slice(0, 2)} getRowId={(r) => r.id} caption="Customers" onRowClick={onOpen} selectedId="r2" />);
    await userEvent.click(screen.getByText('Customer 01'));
    expect(onOpen).toHaveBeenCalledWith(rows[0]);
    expect(screen.getByText('₱100')).toHaveClass('text-right', 'tabular-nums');
    expect(screen.getByText('Customer 01')).toHaveClass('sticky', 'left-0');
    expect(screen.getByText('Customer 02').closest('tr')).toHaveAttribute('aria-current', 'true');
  });
});

describe('ResultsView', () => {
  it('desktop: sorts everything before paging, shows the range, and pages', async () => {
    viewport(true);
    render(<Harness initial="amount:desc" />);
    expect(screen.getByText('Showing 1–25 of 60')).toBeInTheDocument();
    // The largest amount (row 60) is first even though it was the last in the data.
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Customer 60');

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('Showing 26–50 of 60')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('Showing 51–60 of 60')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();

    await userEvent.selectOptions(screen.getByLabelText('Rows per page'), '50');
    expect(screen.getByText('Showing 1–50 of 60')).toBeInTheDocument();
  });

  it('phone: shows cards with Load more instead of a table', async () => {
    viewport(false);
    render(<Harness />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(25);
    expect(screen.getByText('Showing 1–25 of 60')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(50);
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(screen.getByText('Showing 1–60 of 60')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('round-trips the sort through the URL format and ignores unknown columns', () => {
    expect(parseSort('amount:asc', columns)).toEqual({ id: 'amount', dir: 'asc' });
    expect(formatSort({ id: 'amount', dir: 'desc' })).toBe('amount:desc');
    expect(parseSort('bogus:asc', columns)).toBeNull();
  });
});

describe('useUrlFilters + FilterBar', () => {
  const DEFAULTS = { tab: 'all', q: '', bank: '' };
  function Page() {
    const { values, set, reset } = useUrlFilters(DEFAULTS);
    const { search } = useLocation();
    return (
      <>
        <output aria-label="url">{search}</output>
        <FilterBar
          tabs={{ label: 'Status', value: values.tab, onChange: (id) => set({ tab: id }), items: [{ id: 'all', label: 'All', count: 5 }, { id: 'pending', label: 'Pending', count: 2 }] }}
          search={{ label: 'Search', value: values.q, onChange: (v) => set({ q: v }) }}
          filters={[{ id: 'bank', label: 'Bank', allLabel: 'All banks', value: values.bank, options: [{ value: 'BDO', label: 'BDO' }] }]}
          onFilterChange={(id, v) => set({ [id]: v })}
          onClearAll={() => reset(['q', 'bank'])}
        />
      </>
    );
  }

  it('keeps filters in the URL, shows a chip per active filter, and clears them', async () => {
    viewport(true);
    render(
      <MemoryRouter initialEntries={['/?tab=pending&bank=BDO']}>
        <Page />
      </MemoryRouter>,
    );
    // Restored from the URL on load.
    expect(screen.getByRole('button', { name: /^Pending/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Bank: BDO')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Search'), 'acme');
    expect(screen.getByLabelText('url')).toHaveTextContent('q=acme');
    expect(screen.getByText('Search: acme')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Remove Bank filter' }));
    expect(screen.queryByText('Bank: BDO')).not.toBeInTheDocument();
    expect(screen.getByLabelText('url')).not.toHaveTextContent('bank');

    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByLabelText('Search')).toHaveValue('');
    // Tabs are not "filters to clear"; defaults are left out of the URL.
    expect(screen.getByLabelText('url')).toHaveTextContent('tab=pending');
    expect(screen.getByLabelText('url')).not.toHaveTextContent('q=');

    await userEvent.click(screen.getByRole('button', { name: /^All/ }));
    expect(screen.getByLabelText('url')).toHaveTextContent('');
  });

  it('phone: filters open in a sheet', async () => {
    viewport(false);
    render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Filters/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Filters' });
    await userEvent.selectOptions(within(sheet).getByLabelText('Bank'), 'BDO');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Done' }));
    expect(screen.getByText('Bank: BDO')).toBeInTheDocument();
    expect(screen.getByLabelText('url')).toHaveTextContent('bank=BDO');
  });
});
