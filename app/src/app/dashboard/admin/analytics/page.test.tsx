import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnalyticsPage from './page';
const report = { events: [], daily: [], ctas: [], funnels: [{ name: 'registration_started', role: 'student', started: 4, completed: 1 }], totals: { registrations: 1, applications: 0, listings: 0, uniqueListingViews: 0, waitlist: 0 } };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('admin analytics page', () => {
  it('renders empty activity separately from a matched funnel and reloads role filters', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => report }); vi.stubGlobal('fetch', fetch);
    render(<AnalyticsPage />);
    expect(await screen.findByText('25.0%')).toBeInTheDocument();
    expect(screen.getByText('No CTA clicks in this period.')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Role'), 'employer');
    await waitFor(() => expect(fetch.mock.calls.at(-1)?.[0]).toContain('role=employer'));
    expect(screen.queryByText('Student registration')).not.toBeInTheDocument();
  });
  it('shows database errors instead of a zero-filled report', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Analytics unavailable.' }) }));
    render(<AnalyticsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Analytics unavailable.');
    expect(screen.queryByText('Conversion funnels')).not.toBeInTheDocument();
  });
});
