import crypto from 'crypto';

const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';
const ZOOM_API_BASE = 'https://api.zoom.us/v2';

async function getAccessToken(): Promise<string> {
  const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = process.env;
  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
    throw new Error('Zoom API credentials are not configured');
  }
  const credentials = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(
    `${ZOOM_TOKEN_URL}?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`,
    {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}` },
      cache: 'no-store',
    },
  );
  if (!res.ok) throw new Error(`Zoom token request failed: ${res.status}`);
  const data = await res.json();
  return data.access_token as string;
}

export async function createZoomMeeting(opts: {
  topic: string;
  startTime: string;
  durationMinutes: number;
}): Promise<{ meetingId: string; password: string }> {
  const token = await getAccessToken();
  const res = await fetch(`${ZOOM_API_BASE}/users/me/meetings`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: opts.topic,
      type: 2,
      start_time: opts.startTime,
      duration: opts.durationMinutes,
      settings: {
        waiting_room: false,
        join_before_host: true,
        participant_video: true,
        host_video: true,
        meeting_authentication: false,
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoom meeting creation failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  return { meetingId: String(data.id), password: data.password ?? '' };
}

export async function deleteZoomMeeting(meetingId: string): Promise<void> {
  let token: string;
  try {
    token = await getAccessToken();
  } catch {
    return; // If Zoom isn't configured, nothing to delete
  }
  const res = await fetch(`${ZOOM_API_BASE}/meetings/${meetingId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  // 404 means already deleted — both outcomes are fine
  if (!res.ok && res.status !== 404) {
    throw new Error(`Zoom meeting deletion failed: ${res.status}`);
  }
}

export function generateZoomSignature(meetingNumber: string, role: 0 | 1): string {
  const sdkKey = process.env.ZOOM_SDK_KEY;
  const sdkSecret = process.env.ZOOM_SDK_SECRET;
  if (!sdkKey || !sdkSecret) throw new Error('Zoom SDK credentials are not configured');

  const iat = Math.round(Date.now() / 1000) - 30;
  const exp = iat + 60 * 60 * 2; // 2-hour validity

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ sdkKey, mn: meetingNumber, role, iat, exp, appKey: sdkKey, tokenExp: exp }),
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', sdkSecret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${sig}`;
}
