/**
 * ICE server config for WebRTC (STUN + optional TURN).
 * Env (no secrets logged):
 *   ZAVORTH_WEBRTC_STUN_URLS=stun:stun.l.google.com:19302
 *   ZAVORTH_WEBRTC_TURN_URLS=turn:turn.example.com:3478
 *   ZAVORTH_WEBRTC_TURN_USERNAME=...
 *   ZAVORTH_WEBRTC_TURN_CREDENTIAL=...
 */

export type VoiceIceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export type VoiceIceConfig = {
  iceServers: VoiceIceServer[];
  hasTurn: boolean;
  source: 'env' | 'default_stun';
};

function splitUrls(raw: string | undefined): string[] {
  return String(raw || '')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((u) => /^(stun|stuns|turn|turns):/i.test(u));
}

/**
 * Build ICE servers for browser + server peers.
 * Never returns credentials in logs; caller must not log credential field.
 */
export function resolveVoiceIceConfig(
  env: NodeJS.ProcessEnv = process.env,
): VoiceIceConfig {
  const stun = splitUrls(env.ZAVORTH_WEBRTC_STUN_URLS);
  const turn = splitUrls(env.ZAVORTH_WEBRTC_TURN_URLS);
  const username = String(env.ZAVORTH_WEBRTC_TURN_USERNAME || '').trim();
  const credential = String(env.ZAVORTH_WEBRTC_TURN_CREDENTIAL || '').trim();

  const iceServers: VoiceIceServer[] = [];

  if (stun.length) {
    iceServers.push({ urls: stun.length === 1 ? stun[0] : stun });
  } else {
    iceServers.push({ urls: 'stun:stun.l.google.com:19302' });
  }

  let hasTurn = false;
  if (turn.length) {
    // Require credentials for TURN (security: avoid open relays without auth when env incomplete)
    if (username && credential) {
      iceServers.push({
        urls: turn.length === 1 ? turn[0] : turn,
        username,
        credential,
      });
      hasTurn = true;
    }
  }

  return {
    iceServers,
    hasTurn,
    source: stun.length || turn.length ? 'env' : 'default_stun',
  };
}

/** Safe public view (no credentials) for APIs / Desktop. */
export function publicVoiceIceConfig(
  env: NodeJS.ProcessEnv = process.env,
): {
  iceServers: Array<{ urls: string | string[]; hasCredentials?: boolean }>;
  hasTurn: boolean;
  source: string;
} {
  const full = resolveVoiceIceConfig(env);
  return {
    iceServers: full.iceServers.map((s) => ({
      urls: s.urls,
      hasCredentials: Boolean(s.username && s.credential),
    })),
    hasTurn: full.hasTurn,
    source: full.source,
  };
}
