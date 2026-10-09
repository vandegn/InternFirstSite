import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmActionModal from './ConfirmActionModal';
import { ARCHIVE_CONFIRM, UNARCHIVE_CONFIRM } from '@/lib/listing-archive';

type Copy = {
  title: string;
  paragraphs: readonly string[];
  cancelLabel: string;
  confirmLabel: string;
  busyLabel: string;
};

function setup(
  onConfirm: () => Promise<void> = vi.fn().mockResolvedValue(undefined),
  onCancel = vi.fn(),
  copy: Copy = ARCHIVE_CONFIRM,
) {
  render(
    <ConfirmActionModal
      open
      title={copy.title}
      paragraphs={copy.paragraphs}
      cancelLabel={copy.cancelLabel}
      confirmLabel={copy.confirmLabel}
      busyLabel={copy.busyLabel}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel };
}

describe('ConfirmActionModal', () => {
  it('shows the exact archive wording and focuses Cancel', () => {
    setup();
    const dialog = screen.getByRole('alertdialog', { name: 'Archive this job and end hiring?' });
    expect(dialog).toHaveTextContent('All applicants who are not currently in the Offered category will have their application status changed to Rejected.');
    expect(dialog).toHaveTextContent('its previous candidate data will not be restored.');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Archive & End Hiring' })).toBeInTheDocument();
  });

  it('Cancel and Escape back out without confirming', async () => {
    const { onConfirm, onCancel } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms once even when clicked repeatedly', async () => {
    let resolve!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>((r) => { resolve = r; }));
    setup(onConfirm);
    const button = screen.getByRole('button', { name: 'Archive & End Hiring' });
    await userEvent.click(button);
    await userEvent.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Archiving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    resolve();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Archive & End Hiring' })).toBeEnabled());
  });

  it('shows the failure and stays open so the employer can retry', async () => {
    const onConfirm = vi.fn().mockRejectedValueOnce(new Error('We couldn’t archive this posting. Nothing was changed — please try again.'));
    const { onCancel } = setup(onConfirm);
    await userEvent.click(screen.getByRole('button', { name: 'Archive & End Hiring' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nothing was changed');
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Archive & End Hiring' })).toBeEnabled();
  });

  it('keeps Tab inside the dialog', async () => {
    setup();
    await userEvent.tab(); // Cancel -> confirm
    expect(screen.getByRole('button', { name: 'Archive & End Hiring' })).toHaveFocus();
    await userEvent.tab(); // wraps
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('shows the exact unarchive wording', () => {
    setup(undefined, undefined, UNARCHIVE_CONFIRM);
    expect(screen.getByRole('alertdialog', { name: 'Unarchive this job?' }))
      .toHaveTextContent('Previous candidates will not be restored.');
    expect(screen.getByRole('button', { name: 'Unarchive as Closed' })).toBeInTheDocument();
  });
});
