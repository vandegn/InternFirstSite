import { AccessToken } from 'livekit-server-sdk';

export function getLiveKitRoomName(interviewId: string) {
  return `interview-${interviewId}`;
}

export async function generateLiveKitToken(opts: {
  interviewId: string;
  userId: string;
  userName: string;
  isHost: boolean;
}): Promise<string> {
  const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new Error('LiveKit credentials are not configured');
  }

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: `user-${opts.userId}`,
    name: opts.userName,
    ttl: 60 * 60 * 2,
  });

  at.addGrant({
    room: getLiveKitRoomName(opts.interviewId),
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: opts.isHost,
  });

  return at.toJwt();
}
