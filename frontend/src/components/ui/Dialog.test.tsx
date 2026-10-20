import { render, screen, waitFor } from '@testing-library/react';
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

  it('keeps warnings on screen until dismissed, and lets a success go by itself', async () => {
    function Both() {
      const toast = useToast();
      return (
        <>
          <button onClick={() => toast({ type: 'warning', title: 'Heads up', text: 'Do this first', durationMs: 200 })}>warn</button>
          <button onClick={() => toast({ text: 'Saved', durationMs: 200 })}>ok</button>
        </>
      );
    }
    render(
      <ToastProvider>
        <Both />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByText('warn'));
    await userEvent.click(screen.getByText('ok'));
    expect(screen.getByRole('alert')).toHaveTextContent('Warning: Heads up');
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
