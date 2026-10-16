import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './ConfirmDialog';
import { ToastProvider, useToast } from './Toast';

describe('ConfirmDialog', () => {
  it('shows the consequences and calls the right handler', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(
      <ConfirmDialog open={false} title="Approve payment" confirmLabel="Approve" onConfirm={onConfirm} onCancel={onCancel}>
        Invoice will be closed for ₱2,500.00.
      </ConfirmDialog>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(
      <ConfirmDialog open title="Approve payment" confirmLabel="Approve" onConfirm={onConfirm} onCancel={onCancel}>
        Invoice will be closed for ₱2,500.00.
      </ConfirmDialog>,
    );
    expect(screen.getByRole('dialog', { name: 'Approve payment' })).toHaveTextContent('Invoice will be closed');

    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe('Toast', () => {
  function Trigger() {
    const toast = useToast();
    return <button onClick={() => toast({ type: 'error', text: 'Upload failed' })}>go</button>;
  }

  it('announces errors as alerts and lets the user dismiss them', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByText('go'));
    expect(screen.getByRole('alert')).toHaveTextContent('Upload failed');
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
