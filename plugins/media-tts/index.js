/**
 * Media TTS (soft-fail OpenAI-compatible audio/speech).
 * Secret presence only; never returns API key values.
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const { randomUUID } = require('node:crypto');

const DEFAULT_BASE = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'tts-1';
const DEFAULT_VOICE = 'alloy';
const DEFAULT_FORMAT = 'mp3';
const ALLOWED_FORMATS = new Set(['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm']);
const ALLOWED_VOICES = new Set([
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'onyx',
  'nova',
  'sage',
  'shimmer',
  'verse',
]);

function register(ctx) {
  const logger = ctx.getLogger();
  const workspace = ctx.getWorkspacePath();

  function statusPayload() {
    const keyPresent = Boolean(apiKey());
    const baseUrl = resolveBaseUrl();
    return {
      ok: true,
      provider: 'openai-compatible-tts',
      keyPresent,
      baseUrlHost: safeHost(baseUrl),
      defaultModel: String(process.env.TTS_MODEL || DEFAULT_MODEL),
      message: keyPresent
        ? 'OPENAI_API_KEY present; synthesize available when network.external is granted.'
        : 'Set OPENAI_API_KEY (and optional OPENAI_BASE_URL / TTS_MODEL) to enable TTS.',
      setup: keyPresent
        ? null
        : [
            'export OPENAI_API_KEY=...',
            'optional: OPENAI_BASE_URL for OpenRouter/local gateways',
            'optional: TTS_MODEL (default tts-1)',
            'Grant network.external for HTTP calls',
          ],
    };
  }

  async function synthesize(input) {
    const status = statusPayload();
    if (!status.keyPresent) {
      return {
        ...status,
        ok: false,
        message: 'OPENAI_API_KEY not set',
      };
    }

    const allowed = await ctx.requestPermission('network.external', 'OpenAI-compatible TTS audio/speech');
    if (!allowed) {
      return {
        ok: false,
        blocked: true,
        message: 'network.external permission denied',
        setup: status.setup,
      };
    }

    const payload = input || {};
    const text = String(payload.text || payload.input || payload.message || '').trim();
    if (!text) {
      return { ok: false, message: 'text|input is required' };
    }

    const model = String(payload.model || process.env.TTS_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
    const voiceRaw =
      String(payload.voice || DEFAULT_VOICE)
        .trim()
        .toLowerCase() || DEFAULT_VOICE;
    const voice = ALLOWED_VOICES.has(voiceRaw) ? voiceRaw : DEFAULT_VOICE;
    const formatRaw = String(payload.format || payload.response_format || DEFAULT_FORMAT)
      .trim()
      .toLowerCase();
    const format = ALLOWED_FORMATS.has(formatRaw) ? formatRaw : DEFAULT_FORMAT;
    const baseUrl = resolveBaseUrl().replace(/\/$/u, '');

    try {
      const audio = await postSpeech(
        `${baseUrl}/audio/speech`,
        {
          model,
          input: text.slice(0, 4096),
          voice,
          response_format: format,
        },
        apiKey(),
      );

      const bytes = audio && audio.length ? audio.length : 0;
      if (!bytes) {
        return {
          ok: false,
          message: 'TTS returned empty audio body',
          provider: 'openai-compatible-tts',
          model,
        };
      }

      const saved = trySaveAudio(workspace, audio, format, logger);
      return {
        ok: true,
        provider: 'openai-compatible-tts',
        model,
        voice,
        format,
        bytes,
        path: saved.path || null,
        relativePath: saved.relativePath || null,
        message: saved.relativePath
          ? `Synthesized speech written to ${saved.relativePath}`
          : `Binary audio received (${bytes} bytes); filesystem write skipped or failed`,
        note: saved.ok ? null : saved.note || `Binary audio received with size ${bytes} bytes`,
      };
    } catch (error) {
      logger.warn('media.tts.synthesize failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
        setup: status.setup,
      };
    }
  }

  ctx.bindCapability('media.tts.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindCapability('media.tts.synthesize', async ({ input }) => {
    try {
      const result = await synthesize(input || {});
      return {
        output: result,
        artifacts: result.relativePath || result.path ? [result.relativePath || result.path] : [],
        receipts: result.ok ? ['media-tts.receipt'] : [],
      };
    } catch (error) {
      logger.warn('media.tts.synthesize capability failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  // Specialized registrar — records tts binding when host supports it.
  // May re-bind the same capabilityId; semantics stay soft-fail synthesize.
  if (typeof ctx.registerTtsProvider === 'function') {
    try {
      ctx.registerTtsProvider({
        kind: 'tts',
        id: 'openai-compatible-tts',
        capabilityId: 'media.tts.synthesize',
        label: 'OpenAI-Compatible TTS',
        metadata: { pack: 'media' },
        handler: async (input) => {
          try {
            return await synthesize(input || {});
          } catch (error) {
            logger.warn('media.tts.synthesize specialized handler failed', {
              error: error instanceof Error ? error.message : String(error),
            });
            return {
              ok: false,
              message: error instanceof Error ? error.message : String(error),
            };
          }
        },
      });
    } catch (error) {
      logger.warn('registerTtsProvider soft-failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info('media-tts registered');
}

function apiKey() {
  return String(process.env.OPENAI_API_KEY || '').trim();
}

function resolveBaseUrl() {
  return String(process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || DEFAULT_BASE).trim() || DEFAULT_BASE;
}

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function trySaveAudio(workspace, buffer, format, logger) {
  try {
    if (!workspace || !fs.existsSync(workspace)) {
      return {
        ok: false,
        note: `Binary audio received with size ${buffer.length} bytes (no workspace)`,
      };
    }
    const outDir = path.join(workspace, '.zavorth', 'media-tts');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const fileName = `${randomUUID()}.${format}`;
    const absPath = path.join(outDir, fileName);
    // Ensure final path stays inside workspace.
    const resolved = path.resolve(absPath);
    const root = path.resolve(workspace);
    if (!resolved.startsWith(root + path.sep) && resolved !== root) {
      return {
        ok: false,
        note: `Binary audio received with size ${buffer.length} bytes (path rejected)`,
      };
    }
    fs.writeFileSync(resolved, buffer);
    const relativePath = path.relative(root, resolved).split(path.sep).join('/');
    return { ok: true, path: resolved, relativePath };
  } catch (error) {
    if (logger) {
      logger.warn('media-tts write failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return {
      ok: false,
      note: `Binary audio received with size ${buffer.length} bytes`,
    };
  }
}

function postSpeech(url, body, key) {
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
          Authorization: `Bearer ${key}`,
          'Content-Length': Buffer.byteLength(data),
          Accept: 'audio/*',
          'User-Agent': 'zavorth-media-tts/1.0',
        },
        timeout: 120000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const status = res.statusCode || 0;
          if (status >= 200 && status < 300) {
            resolve(buf);
            return;
          }
          const snippet = buf.toString('utf8').slice(0, 240);
          reject(new Error(`HTTP ${status}: ${snippet}`));
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('TTS request timed out'));
    });
    req.write(data);
    req.end();
  });
}

module.exports = { register };
