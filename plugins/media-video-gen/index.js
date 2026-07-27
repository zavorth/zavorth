/**
 * Media video generation (optional tier soft template).
 * Never pretends success without a configured provider API.
 * Secret presence only; never returns key values.
 */
const http = require('node:http');
const https = require('node:https');

function register(ctx) {
  const logger = ctx.getLogger();

  function envPresence() {
    return {
      VIDEO_GEN_API_KEY: Boolean(String(process.env.VIDEO_GEN_API_KEY || '').trim()),
      VIDEO_GEN_BASE_URL: Boolean(String(process.env.VIDEO_GEN_BASE_URL || '').trim()),
      RUNWAY_API_KEY: Boolean(String(process.env.RUNWAY_API_KEY || '').trim()),
      LUMA_API_KEY: Boolean(String(process.env.LUMA_API_KEY || '').trim()),
      REPLICATE_API_TOKEN: Boolean(String(process.env.REPLICATE_API_TOKEN || '').trim()),
      OPENAI_API_KEY: Boolean(String(process.env.OPENAI_API_KEY || '').trim()),
    };
  }

  function anyProviderKey() {
    const p = envPresence();
    return p.VIDEO_GEN_API_KEY || p.RUNWAY_API_KEY || p.LUMA_API_KEY || p.REPLICATE_API_TOKEN;
  }

  function setupTips() {
    return [
      'Video generation is an optional tier — not fully available by default.',
      'export VIDEO_GEN_API_KEY=... and optional VIDEO_GEN_BASE_URL for a generic HTTPS provider.',
      'Or set a documented vendor key: RUNWAY_API_KEY, LUMA_API_KEY, or REPLICATE_API_TOKEN.',
      'Grant network.external before any outbound video API call.',
      'Heavy cost / latency — enable only when needed.',
    ];
  }

  function statusPayload() {
    const keys = envPresence();
    const configured = anyProviderKey();
    const baseHost = keys.VIDEO_GEN_BASE_URL ? safeHost(String(process.env.VIDEO_GEN_BASE_URL || '').trim()) : null;
    return {
      ok: true,
      provider: 'video-gen-optional',
      available: false,
      fullyAvailable: false,
      keyPresent: configured,
      keysPresent: {
        VIDEO_GEN_API_KEY: keys.VIDEO_GEN_API_KEY,
        RUNWAY_API_KEY: keys.RUNWAY_API_KEY,
        LUMA_API_KEY: keys.LUMA_API_KEY,
        REPLICATE_API_TOKEN: keys.REPLICATE_API_TOKEN,
        // OpenAI listed for awareness only — no silent video claim.
        OPENAI_API_KEY: keys.OPENAI_API_KEY,
      },
      baseUrlHost: baseHost,
      tier: 'optional',
      message: configured
        ? 'A video-gen related key is present, but full provider wiring is still optional/experimental. generate may soft-try VIDEO_GEN_* only.'
        : 'Video generation is not fully available. Set provider keys and base URL for future soft providers; never assumes success without API.',
      setup: setupTips(),
    };
  }

  async function generate(input) {
    const status = statusPayload();
    const payload = input || {};
    const prompt = String(payload.prompt || payload.text || payload.input || '').trim();
    const duration = Math.max(1, Math.min(30, Number(payload.duration) || 4) || 4);

    if (!prompt) {
      return {
        ok: false,
        available: false,
        message: 'prompt is required',
        setup: setupTips(),
      };
    }

    const videoKey = String(process.env.VIDEO_GEN_API_KEY || '').trim();
    const baseUrl = String(process.env.VIDEO_GEN_BASE_URL || '')
      .trim()
      .replace(/\/$/u, '');

    // Soft-try only when both generic video-gen key and base URL are set.
    if (videoKey && baseUrl) {
      const allowed = await ctx.requestPermission('network.external', 'Optional VIDEO_GEN video generation API');
      if (!allowed) {
        return {
          ok: false,
          blocked: true,
          available: false,
          message: 'network.external permission denied',
          prompt: prompt.slice(0, 200),
          duration,
          setup: setupTips(),
        };
      }

      try {
        const endpoint = `${baseUrl}/v1/video/generations`;
        const result = await postJson(
          endpoint,
          {
            prompt: prompt.slice(0, 4000),
            duration,
          },
          videoKey,
        );
        // Only report success if the remote API clearly succeeded with a usable handle.
        const videoUrl =
          result &&
          (result.url ||
            result.video_url ||
            result.output ||
            (result.data && (result.data.url || result.data[0]?.url)));
        const jobId = result && (result.id || result.job_id || result.jobId);
        if (videoUrl || jobId) {
          return {
            ok: true,
            provider: 'video-gen-generic',
            prompt: prompt.slice(0, 200),
            duration,
            jobId: jobId || null,
            // Never invent media; only surface provider-returned URL-like fields as opaque refs.
            videoRef: videoUrl ? String(videoUrl).slice(0, 500) : null,
            message: jobId
              ? 'Video generation job accepted by configured VIDEO_GEN provider'
              : 'Video generation response received from configured VIDEO_GEN provider',
          };
        }
        return {
          ok: false,
          available: false,
          message: 'VIDEO_GEN provider responded but did not return a video URL or job id; treating as incomplete.',
          prompt: prompt.slice(0, 200),
          duration,
          setup: setupTips(),
        };
      } catch (error) {
        logger.warn('media.video.generate soft-try failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          ok: false,
          available: false,
          message: error instanceof Error ? error.message : String(error),
          prompt: prompt.slice(0, 200),
          duration,
          setup: setupTips(),
        };
      }
    }

    // Honest soft template — never pretends success without API.
    return {
      ok: false,
      available: false,
      fullyAvailable: false,
      tier: 'optional',
      prompt: prompt.slice(0, 200),
      duration,
      message:
        'Video generation is an optional tier and is not fully available. Configure VIDEO_GEN_API_KEY + VIDEO_GEN_BASE_URL (or a documented vendor key) before expecting real output. This plugin never fakes success.',
      keyPresent: status.keyPresent,
      keysPresent: status.keysPresent,
      setup: setupTips(),
    };
  }

  ctx.bindCapability('media.video.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindCapability('media.video.generate', async ({ input }) => {
    try {
      const result = await generate(input || {});
      return {
        output: result,
        receipts: result.ok ? ['media-video-gen.receipt'] : [],
      };
    } catch (error) {
      logger.warn('media.video.generate capability failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          available: false,
          message: error instanceof Error ? error.message : String(error),
          setup: setupTips(),
        },
      };
    }
  });

  // Specialized registrar — records video_gen binding when host supports it.
  // May re-bind the same capabilityId; semantics stay soft template / soft-try.
  if (typeof ctx.registerVideoGenProvider === 'function') {
    try {
      ctx.registerVideoGenProvider({
        kind: 'video_gen',
        id: 'video-gen-optional',
        capabilityId: 'media.video.generate',
        label: 'Optional Video Gen',
        metadata: { pack: 'media', optional: true },
        handler: async (input) => {
          try {
            return await generate(input || {});
          } catch (error) {
            logger.warn('media.video.generate specialized handler failed', {
              error: error instanceof Error ? error.message : String(error),
            });
            return {
              ok: false,
              available: false,
              message: error instanceof Error ? error.message : String(error),
              setup: setupTips(),
            };
          }
        },
      });
    } catch (error) {
      logger.warn('registerVideoGenProvider soft-failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info('media-video-gen registered');
}

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function postJson(url, body, apiKey) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      reject(error);
      return;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      reject(new Error('Only http(s) base URLs are supported'));
      return;
    }
    const lib = parsed.protocol === 'https:' ? https : http;
    const data = JSON.stringify(body);
    const req = lib.request(
      {
        method: 'POST',
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(data),
          'User-Agent': 'zavorth-media-video-gen/1.0',
        },
        timeout: 60000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          const status = res.statusCode || 0;
          if (status >= 200 && status < 300) {
            try {
              resolve(JSON.parse(raw));
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error(`HTTP ${status}: ${raw.slice(0, 240)}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('video gen request timed out'));
    });
    req.write(data);
    req.end();
  });
}

module.exports = { register };
