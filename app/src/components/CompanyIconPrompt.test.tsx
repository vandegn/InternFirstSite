import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CompanyIconPrompt from './CompanyIconPrompt';
import { validateIconFile, iconStoragePath } from '@/lib/company-icon';

const employerHasIconColumn = vi.fn();
const uploadImage = vi.fn();
const updateEmployer = vi.fn();
vi.mock('@/lib/supabase', () => ({
  employerHasIconColumn: (...a: unknown[]) => employerHasIconColumn(...a),
  uploadImage: (...a: unknown[]) => uploadImage(...a),
  updateEmployer: (...a: unknown[]) => updateEmployer(...a),
}));

const base = { employerId: 'emp-1', companyName: 'Acme', iconUrl: null, onUploaded: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  employerHasIconColumn.mockResolvedValue(true);
});

describe('company icon rules', () => {
  it('accepts PNG/JPG/WebP under 2 MB only', () => {
    expect(validateIconFile({ type: 'image/png', size: 1000 })).toBeNull();
    expect(validateIconFile({ type: 'image/svg+xml', size: 1000 })).toMatch(/PNG, JPG, or WebP/);
    expect(validateIconFile({ type: 'image/webp', size: 3 * 1024 * 1024 })).toMatch(/under 2 MB/);
  });
  it('builds a fresh path per upload', () => {
    expect(iconStoragePath('emp-1', 'image/jpeg', 42)).toBe('icons/emp-1-42.jpg');
  });
});

describe('CompanyIconPrompt', () => {
  it('lets a Master Admin upload the icon inline', async () => {
    uploadImage.mockResolvedValue('https://cdn/icon.png');
    updateEmployer.mockResolvedValue({});
    const onUploaded = vi.fn();
    render(<CompanyIconPrompt {...base} memberRole="master_admin" onUploaded={onUploaded} />);
    await screen.findByRole('region', { name: 'Add your company icon' });

    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText('Company icon file'), file);

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith('https://cdn/icon.png'));
    expect(updateEmployer).toHaveBeenCalledWith('emp-1', { icon_url: 'https://cdn/icon.png' });
  });

  it('points other teammates at their Master Admin instead of offering an upload', async () => {
    render(<CompanyIconPrompt {...base} memberRole="recruiter" />);
    await screen.findByText(/Ask your Master Admin/);
    expect(screen.queryByRole('button', { name: 'Upload icon' })).toBeNull();
  });

  it('stays hidden once an icon exists or before the migration', async () => {
    const { container, unmount } = render(<CompanyIconPrompt {...base} iconUrl="https://cdn/x.png" memberRole="master_admin" />);
    await waitFor(() => expect(employerHasIconColumn).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    unmount();

    employerHasIconColumn.mockResolvedValue(false);
    const second = render(<CompanyIconPrompt {...base} memberRole="master_admin" />);
    await waitFor(() => expect(employerHasIconColumn).toHaveBeenCalledTimes(2));
    expect(second.container).toBeEmptyDOMElement();
  });

  it('"Not now" hides it for the session', async () => {
    render(<CompanyIconPrompt {...base} memberRole="master_admin" dismissible />);
    await userEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('region')).toBeNull();
    expect(sessionStorage.getItem('if:company-icon-prompt-dismissed:emp-1')).toBe('1');
  });
});
