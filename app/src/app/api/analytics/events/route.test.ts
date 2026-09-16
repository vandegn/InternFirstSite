import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const state = vi.hoisted(() => ({ user: null as null | { id: string }, role: 'student', visible: true, rpc: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({
  getAdminSupabase: () => ({ rpc: state.rpc }),
  getServerSupabase: async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) }, from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === 'profiles' ? { role: state.role } : state.visible ? { id: 'listing' } : null }) }) }) }) }),
}));
import { POST } from './route';
const uuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const event = { id: uuid, sessionId: uuid, path: '/register', name: 'cta_clicked', cta: 'register' };
function request(body: object, origin = 'http://localhost') { return new NextRequest('http://localhost/api/analytics/events', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
describe('analytics ingestion boundary', () => {
  beforeEach(() => { state.user = null; state.role = 'student'; state.visible = true; state.rpc.mockReset().mockResolvedValue({ data: true, error: null }); });
  it('rejects other origins and client completion claims', async () => {
    expect((await POST(request(event, 'https://elsewhere.test'))).status).toBe(403);
    expect((await POST(request({ ...event, name: 'job_published' }))).status).toBe(400);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it('does not trust client roles for CTA events', async () => {
    await POST(request({ ...event, role: 'employer' }));
    expect(state.rpc.mock.calls[0][1].p_role).toBe('anonymous');
  });
  it('requires student authentication to start an application', async () => {
    expect((await POST(request({ ...event, name: 'application_started', listingId: uuid }))).status).toBe(403);
    state.user = { id: 'student-user' };
    expect((await POST(request({ ...event, name: 'application_started', listingId: uuid }))).status).toBe(200);
    expect(state.rpc.mock.calls[0][1].p_flow).toBe(`student-user:${uuid}`);
  });
  it('rejects hidden listings and excludes admin activity', async () => {
    state.visible = false;
    expect((await POST(request({ ...event, name: 'listing_viewed', listingId: uuid }))).status).toBe(404);
    state.user = { id: 'admin' }; state.role = 'intern_first_admin';
    expect((await POST(request(event))).status).toBe(200); expect(state.rpc).not.toHaveBeenCalled();
  });
  it('propagates rate limits and storage failures', async () => {
    state.rpc.mockResolvedValue({ data: false, error: null });
    expect((await POST(request(event))).status).toBe(429);
    state.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await POST(request(event))).status).toBe(503); log.mockRestore();
  });
});
