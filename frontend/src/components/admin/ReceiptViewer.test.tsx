import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReceiptViewer } from './ReceiptViewer';

describe('ReceiptViewer', () => {
  it('zooms with the buttons and the + / - / 0 keys, within limits', async () => {
    render(<ReceiptViewer src="/r.png" alt="Receipt from Acme" />);
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('150%')).toBeInTheDocument();

    screen.getByRole('group', { name: /Receipt image/ }).focus();
    await userEvent.keyboard('++++++');
    expect(screen.getByText('400%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled();

    await userEvent.keyboard('0');
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('can open the original and recover from a broken image', async () => {
    render(<ReceiptViewer src="/r.png" alt="Receipt from Acme" />);
    expect(screen.getByRole('link', { name: 'Open original receipt in a new tab' })).toHaveAttribute('href', '/r.png');
    screen.getByAltText('Receipt from Acme').dispatchEvent(new Event('error'));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
  });

  it('keeps R for rotating so it does not reach the queue shortcuts', async () => {
    const outer = vi.fn();
    document.addEventListener('keydown', outer);
    render(<ReceiptViewer src="/r.png" alt="x" />);
    screen.getByRole('group', { name: /Receipt image/ }).focus();
    await userEvent.keyboard('r');
    expect(outer).not.toHaveBeenCalled();
    document.removeEventListener('keydown', outer);
  });
});
