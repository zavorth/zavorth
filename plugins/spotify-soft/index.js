/**
 * Wave 7 — Spotify Soft (lifestyle, optional, soft-fail).
 * Presence-only secrets; never returns token or client secret values.
 */
const SPOTIFY_API = 'https://api.spotify.com/v1';
const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 50;

function register(ctx) {
  const logger = ctx.getLogger();

  function accessToken() {
    return String(
      process.env.SPOTIFY_ACCESS_TOKEN || process.env.SPOTIFY_TOKEN || '',
    ).trim();
  }

  function tokenConfigured() {
    return Boolean(accessToken());
  }

  function clientIdConfigured() {
    return Boolean(String(process.env.SPOTIFY_CLIENT_ID || '').trim());
  }

  function clientSecretConfigured() {
    return Boolean(String(process.env.SPOTIFY_CLIENT_SECRET || '').trim());
  }

  function statusPayload() {
    const tokenOk = tokenConfigured();
    const clientIdOk = clientIdConfigured();
    const clientSecretOk = clientSecretConfigured();
    return {
      ok: true,
      wave: 'W7',
      pack: 'lifestyle',
      backend: 'spotify-web-api',
      tokenConfigured: tokenOk,
      clientIdConfigured: clientIdOk,
      clientSecretConfigured: clientSecretOk,
      baseUrlHost: 'api.spotify.com',
      message: tokenOk
        ? 'Spotify access token present; playback/search available when network.external is granted.'
        : 'No SPOTIFY_ACCESS_TOKEN or SPOTIFY_TOKEN configured.',
      setup: setupTips(),
      note: 'Secret values are never returned — presence only.',
    };
  }

  async function ensureNetwork(reason) {
    if (typeof ctx.requestPermission !== 'function') {
      return null;
    }
    try {
      const allowed = await ctx.requestPermission('network.external', reason);
      if (!allowed) {
        return {
          ok: false,
          blocked: true,
          reason: 'permission_denied',
          message: 'network.external permission denied',
          setup: setupTips(),
        };
      }
    } catch (error) {
      return {
        ok: false,
        blocked: true,
        reason: 'permission_error',
        message: error instanceof Error ? error.message : String(error),
        setup: setupTips(),
      };
    }
    return null;
  }

  function requireToken() {
    if (!tokenConfigured()) {
      return {
        ok: false,
        reason: 'no_token',
        message: 'SPOTIFY_ACCESS_TOKEN or SPOTIFY_TOKEN not set',
        setup: setupTips(),
      };
    }
    return null;
  }

  async function spotifyRequest(method, path, options) {
    const opts = options || {};
    const url = path.startsWith('http') ? path : `${SPOTIFY_API}${path}`;
    const headers = {
      Authorization: `Bearer ${accessToken()}`,
      Accept: 'application/json',
    };
    const init = {
      method,
      headers,
      signal: AbortSignal.timeout(20000),
    };
    if (opts.body !== undefined && opts.body !== null) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
    const response = await fetch(url, init);
    const status = response.status || 0;
    // 204 No Content is success for player control / empty currently-playing.
    if (status === 204) {
      return { ok: true, status: 204, data: null };
    }
    let data = null;
    const raw = await response.text();
    if (raw && raw.trim()) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = { raw: redactSecrets(raw).slice(0, 240) };
      }
    }
    if (status < 200 || status >= 300) {
      const apiMessage =
        data && data.error && data.error.message
          ? String(data.error.message)
          : `HTTP ${status}`;
      return {
        ok: false,
        reason: 'api_error',
        status,
        message: redactSecrets(apiMessage).slice(0, 400),
      };
    }
    return { ok: true, status, data };
  }

  ctx.bindCapability('spotify.status', async () => {
    try {
      return { output: statusPayload() };
    } catch (error) {
      logger.warn('spotify.status failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          tokenConfigured: false,
          clientIdConfigured: false,
          message: error instanceof Error ? error.message : String(error),
          setup: setupTips(),
        },
      };
    }
  });

  ctx.bindCapability('spotify.now_playing', async () => {
    try {
      const missing = requireToken();
      if (missing) return { output: missing };

      const denied = await ensureNetwork('Spotify currently-playing');
      if (denied) return { output: denied };

      const result = await spotifyRequest(
        'GET',
        '/me/player/currently-playing',
      );
      if (!result.ok) {
        return {
          output: {
            ...result,
            track: null,
            artists: [],
            is_playing: false,
            setup: setupTips(),
          },
        };
      }

      // Empty body / 204 => nothing playing.
      if (!result.data || !result.data.item) {
        return {
          output: {
            ok: true,
            is_playing: false,
            track: null,
            artists: [],
            message: 'Nothing is currently playing.',
          },
        };
      }

      const item = result.data.item;
      const artists = Array.isArray(item.artists)
        ? item.artists.map((a) => String((a && a.name) || '')).filter(Boolean)
        : [];
      return {
        output: {
          ok: true,
          is_playing: Boolean(result.data.is_playing),
          track: String(item.name || ''),
          artists,
          album: item.album ? String(item.album.name || '') : null,
          trackId: item.id ? String(item.id) : null,
          progress_ms:
            typeof result.data.progress_ms === 'number'
              ? result.data.progress_ms
              : null,
        },
      };
    } catch (error) {
      logger.warn('spotify.now_playing failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: softHttpError(error, {
          track: null,
          artists: [],
          is_playing: false,
        }),
      };
    }
  });

  ctx.bindCapability('spotify.pause', async () => {
    try {
      const missing = requireToken();
      if (missing) return { output: missing };

      const denied = await ensureNetwork('Spotify player pause');
      if (denied) return { output: denied };

      const result = await spotifyRequest('PUT', '/me/player/pause');
      if (!result.ok) {
        return { output: { ...result, setup: setupTips() } };
      }
      return {
        output: {
          ok: true,
          action: 'pause',
          message: 'Playback paused.',
          status: result.status,
        },
      };
    } catch (error) {
      logger.warn('spotify.pause failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { output: softHttpError(error) };
    }
  });

  ctx.bindCapability('spotify.play', async ({ input }) => {
    try {
      const missing = requireToken();
      if (missing) return { output: missing };

      const denied = await ensureNetwork('Spotify player play');
      if (denied) return { output: denied };

      const payload = input || {};
      let body;
      if (payload.body && typeof payload.body === 'object') {
        body = payload.body;
      } else {
        const built = {};
        if (Array.isArray(payload.uris) && payload.uris.length) {
          built.uris = payload.uris.map(String);
        } else if (payload.uri || payload.track_uri || payload.trackUri) {
          built.uris = [
            String(payload.uri || payload.track_uri || payload.trackUri),
          ];
        }
        if (payload.context_uri || payload.contextUri) {
          built.context_uri = String(payload.context_uri || payload.contextUri);
        }
        if (Object.keys(built).length) {
          body = built;
        }
      }

      const result = await spotifyRequest(
        'PUT',
        '/me/player/play',
        body ? { body } : {},
      );
      if (!result.ok) {
        return { output: { ...result, setup: setupTips() } };
      }
      return {
        output: {
          ok: true,
          action: 'play',
          message: body ? 'Playback started with request body.' : 'Playback resumed.',
          status: result.status,
          hadBody: Boolean(body),
        },
      };
    } catch (error) {
      logger.warn('spotify.play failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { output: softHttpError(error) };
    }
  });

  ctx.bindCapability('spotify.search', async ({ input }) => {
    try {
      const payload = input || {};
      const query = String(payload.query || payload.q || payload.text || '').trim();
      if (!query) {
        return {
          output: {
            ok: false,
            results: [],
            message: 'query is required',
            setup: setupTips(),
          },
        };
      }

      const missing = requireToken();
      if (missing) {
        return { output: { ...missing, results: [] } };
      }

      const denied = await ensureNetwork('Spotify track search');
      if (denied) {
        return { output: { ...denied, results: [] } };
      }

      const limit = normalizeLimit(payload.limit);
      const path = `/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`;
      const result = await spotifyRequest('GET', path);
      if (!result.ok) {
        return {
          output: {
            ...result,
            results: [],
            setup: setupTips(),
          },
        };
      }

      const items =
        (result.data &&
          result.data.tracks &&
          Array.isArray(result.data.tracks.items) &&
          result.data.tracks.items) ||
        [];
      const results = items.map((track) => ({
        id: track && track.id ? String(track.id) : null,
        name: String((track && track.name) || ''),
        artists: Array.isArray(track && track.artists)
          ? track.artists.map((a) => String((a && a.name) || '')).filter(Boolean)
          : [],
        album:
          track && track.album ? String(track.album.name || '') : null,
        uri: track && track.uri ? String(track.uri) : null,
        duration_ms:
          track && typeof track.duration_ms === 'number'
            ? track.duration_ms
            : null,
      }));

      return {
        output: {
          ok: true,
          query,
          results,
          count: results.length,
          message: results.length
            ? `Spotify returned ${results.length} track(s)`
            : 'Spotify returned no tracks',
        },
      };
    } catch (error) {
      logger.warn('spotify.search failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { output: softHttpError(error, { results: [] }) };
    }
  });

  logger.info('spotify-soft registered');
}

function setupTips() {
  return [
    'Create a Spotify app at https://developer.spotify.com/dashboard',
    'Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET for OAuth (presence only in status)',
    'Complete Authorization Code / PKCE OAuth with scopes: user-read-currently-playing, user-read-playback-state, user-modify-playback-state',
    'export SPOTIFY_ACCESS_TOKEN=... (or SPOTIFY_TOKEN) with a user access token',
    'Grant network.external for HTTPS calls to api.spotify.com',
    'A Premium account is typically required for play/pause Web API control',
  ];
}

function normalizeLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_SEARCH_LIMIT;
  return Math.max(1, Math.min(MAX_SEARCH_LIMIT, Math.floor(n)));
}

function softHttpError(error, extra) {
  const message = redactSecrets(
    error instanceof Error ? error.message : String(error),
  ).slice(0, 400);
  return {
    ok: false,
    reason: 'fetch_failed',
    message,
    setup: setupTips(),
    ...(extra || {}),
  };
}

function redactSecrets(text) {
  let out = String(text || '');
  const secrets = [
    process.env.SPOTIFY_ACCESS_TOKEN,
    process.env.SPOTIFY_TOKEN,
    process.env.SPOTIFY_CLIENT_SECRET,
    process.env.SPOTIFY_CLIENT_ID,
  ];
  for (const secret of secrets) {
    const s = String(secret || '').trim();
    if (s && out.includes(s)) {
      out = out.split(s).join('[redacted]');
    }
  }
  return out;
}

module.exports = { register };
