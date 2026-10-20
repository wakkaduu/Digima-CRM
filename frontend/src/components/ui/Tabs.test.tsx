import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs } from './Tabs';

function Demo() {
  const [v, setV] = useState('a');
  return <Tabs label="Sections" value={v} onChange={setV} tabs={[{ id: 'a', label: 'One' }, { id: 'b', label: 'Two' }, { id: 'c', label: 'Three' }]} />;
}

describe('Tabs', () => {
  it('only the selected tab is in the tab order, and arrow keys move selection and focus', async () => {
    render(<Demo />);
    const one = screen.getByRole('tab', { name: 'One' });
    expect(one).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('tabindex', '-1');

    one.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveFocus();

    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}'); // wraps
    expect(screen.getByRole('tab', { name: 'One' })).toHaveFocus();
  });
});
