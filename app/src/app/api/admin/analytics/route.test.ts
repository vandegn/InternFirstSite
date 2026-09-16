import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const state = vi.hoisted(() => ({ user: null as null | { id: string }, role: 'student', rpc: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ getServerSupabase: async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: state.role } }) }) }) }), rpc: state.rpc }) }));
import { GET } from './route';
const request = (query = 'start=2026-09-01&end=2026-09-16&role=student') => new NextRequest(`http://localhost/api/admin/analytics?${query}`);
describe('admin analytics authorization and filters', () => {
  beforeEach(() => { state.user = null; state.role = 'student'; state.rpc.mockReset(); });
  it('rejects anonymous requests', async () => { expect((await GET(request())).status).toBe(401); expect(state.rpc).not.toHaveBeenCalled(); });
  it('rejects non-admin users', async () => { state.user = { id: 'student' }; expect((await GET(request())).status).toBe(403); expect(state.rpc).not.toHaveBeenCalled(); });
  it('rejects invalid and reversed dates before running reports', async () => {
    state.user = { id: 'admin' }; state.role = 'intern_first_admin';
    for (const query of ['start=2026-02-30&end=2026-03-05', 'start=2026-09-16&end=2026-09-01', 'start=2020-01-01&end=2026-01-01', 'start=2026-09-01&end=2026-09-16&role=invalid']) expect((await GET(request(query))).status).toBe(400);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it('uses inclusive UTC end dates and prevents shared caching', async () => {
    state.user = { id: 'admin' }; state.role = 'intern_first_admin'; state.rpc.mockResolvedValue({ data: { events: [] }, error: null });
    const response = await GET(request()); expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(state.rpc).toHaveBeenCalledWith('admin_product_analytics', { p_start: '2026-09-01T00:00:00Z', p_end: '2026-09-17T00:00:00.000Z', p_role: 'student' });
  });
  it('reports missing migrations as unavailable, never fabricated zeros', async () => {
    state.user = { id: 'admin' }; state.role = 'intern_first_admin'; state.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    expect((await GET(request())).status).toBe(503);
  });
});
