/**
 * Wave 4 — Media transcription / Whisper STT (soft-fail).
 * Secret presence only; never returns API key values.
 * Workspace path traversal safe for local audio files.
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');

const DEFAULT_BASE = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'whisper-1';
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

function register(ctx) {
  const logger = ctx.getLogger();
  const workspace = ctx.getWorkspacePath();

  function statusPayload() {
    const keyPresent = Boolean(apiKey());
    const baseUrl = resolveBaseUrl();
    return {
      ok: true,
      provider: 'openai-compatible-whisper',
      keyPresent,
      baseUrlHost: safeHost(baseUrl),
      defaultModel: String(process.env.TRANSCRIPTION_MODEL || DEFAULT_MODEL),
      message: keyPresent
        ? 'OPENAI_API_KEY present; transcribe available when network.external is granted and a workspace audio path is provided.'
        : 'Set OPENAI_API_KEY (and optional OPENAI_BASE_URL) to enable Whisper transcription.',
      setup: keyPresent
        ? null
        : [
            'export OPENAI_API_KEY=...',
            'optional: OPENAI_BASE_URL for OpenRouter/local gateways',
            'optional: TRANSCRIPTION_MODEL (default whisper-1)',
            'Provide a workspace-relative audio path (path|file|filePath)',
            'Grant network.external for HTTP calls',
          ],
    };
  }

  async function transcribe(input) {
    const status = statusPayload();
    const payload = input || {};

    // Soft-fail remote URL-only input with a clear tip (do not fetch arbitrary URLs).
    const urlOnly = String(payload.url || '').trim();
    const pathHint = String(
      payload.path || payload.file || payload.filePath || payload.audio || '',
    ).trim();
    if (urlOnly && !pathHint) {
      return {
        ok: false,
        message:
          'Remote URL transcription is not enabled by default. Download the audio into the workspace and pass path|file|filePath instead.',
        tip: 'Prefer a workspace-relative audio file to avoid SSRF and keep path-traversal safety.',
        setup: status.setup,
      };
    }

    if (!status.keyPresent) {
      return {
        ...status,
        ok: false,
        message: 'OPENAI_API_KEY not set',
        text: null,
      };
    }

    if (!pathHint) {
      return {
        ok: false,
        message: 'path|file|filePath is required (workspace-relative audio file)',
        text: null,
        setup: status.setup,
      };
    }

    const resolved = resolveWorkspaceFile(workspace, pathHint);
    if (!resolved.ok) {
      return {
        ok: false,
        message: resolved.message,
        text: null,
      };
    }

    if (!fs.existsSync(resolved.absPath)) {
      return {
        ok: false,
        message: `Audio file not found: ${resolved.relativePath}`,
        text: null,
      };
    }

    let stat;
    try {
      stat = fs.statSync(resolved.absPath);
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
        text: null,
      };
    }
    if (!stat.isFile()) {
      return { ok: false, message: 'path must be a file', text: null };
    }
    if (stat.size <= 0) {
      return { ok: false, message: 'audio file is empty', text: null };
    }
    if (stat.size > MAX_AUDIO_BYTES) {
      return {
        ok: false,
        message: `audio file exceeds max size (${MAX_AUDIO_BYTES} bytes)`,
        text: null,
      };
    }

    const allowed = await ctx.requestPermission(
      'network.external',
      'OpenAI-compatible Whisper audio/transcriptions',
    );
    if (!allowed) {
      return {
        ok: false,
        blocked: true,
        message: 'network.external permission denied',
        text: null,
        setup: status.setup,
      };
    }

    const model =
      String(payload.model || process.env.TRANSCRIPTION_MODEL || DEFAULT_MODEL).trim() ||
      DEFAULT_MODEL;
    const language = payload.language ? String(payload.language).trim() : null;
    const baseUrl = resolveBaseUrl().replace(/\/$/u, '');

    try {
      const fileBuf = fs.readFileSync(resolved.absPath);
      const fileName = path.basename(resolved.absPath);
      const result = await postMultipart(
        `${baseUrl}/audio/transcriptions`,
        {
          model,
          fileName,
          fileBuf,
          language,
        },
        apiKey(),
      );

      const text =
        typeof result === 'string'
          ? result
          : result && typeof result.text === 'string'
            ? result.text
            : null;

      return {
        ok: Boolean(text),
        provider: 'openai-compatible-whisper',
        model,
        path: resolved.relativePath,
        text,
        bytes: fileBuf.length,
        message: text ? 'Transcription complete' : 'Transcription returned no text',
        raw: text ? undefined : sanitizeResult(result),
      };
    } catch (error) {
      logger.warn('media.transcription.transcribe failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
        text: null,
        setup: status.setup,
      };
    }
  }

  ctx.bindCapability('media.transcription.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindCapability('media.transcription.transcribe', async ({ input }) => {
    try {
      const result = await transcribe(input || {});
      return {
        output: result,
        receipts: result.ok ? ['media-transcription.receipt'] : [],
      };
    } catch (error) {
      logger.warn('media.transcription.transcribe capability failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          text: null,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  // Specialized registrar (Wave 0) — records transcription binding when host supports it.
  // May re-bind the same capabilityId; semantics stay soft-fail transcribe.
  if (typeof ctx.registerTranscriptionProvider === 'function') {
    try {
      ctx.registerTranscriptionProvider({
        kind: 'transcription',
        id: 'openai-compatible-whisper',
        capabilityId: 'media.transcription.transcribe',
        label: 'OpenAI-Compatible Whisper',
        metadata: { wave: 'W4', pack: 'media' },
        handler: async (input) => {
          try {
            return await transcribe(input || {});
          } catch (error) {
            logger.warn('media.transcription.transcribe specialized handler failed', {
              error: error instanceof Error ? error.message : String(error),
            });
            return {
              ok: false,
              text: null,
              message: error instanceof Error ? error.message : String(error),
            };
          }
        },
      });
    } catch (error) {
      logger.warn('registerTranscriptionProvider soft-failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info('media-transcription registered');
}

function apiKey() {
  return String(process.env.OPENAI_API_KEY || '').trim();
}

function resolveBaseUrl() {
  return (
    String(process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || DEFAULT_BASE).trim() ||
    DEFAULT_BASE
  );
}

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/**
 * Resolve a workspace-relative path; reject absolute escape and .. traversal.
 */
function resolveWorkspaceFile(workspace, rel) {
  if (!workspace) {
    return { ok: false, message: 'workspace path unavailable' };
  }
  const raw = String(rel || '').trim();
  if (!raw) {
    return { ok: false, message: 'path is required' };
  }
  // Disallow absolute paths and Windows drive roots as input.
  if (path.isAbsolute(raw) || /^[a-zA-Z]:[\\/]/u.test(raw)) {
    return {
      ok: false,
      message: 'path must be workspace-relative (absolute paths rejected)',
    };
  }
  if (raw.includes('\0')) {
    return { ok: false, message: 'invalid path' };
  }

  const root = path.resolve(workspace);
  const candidate = path.resolve(root, raw);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (candidate !== root && !candidate.startsWith(rootWithSep)) {
    return { ok: false, message: 'path escapes workspace (path traversal blocked)' };
  }

  const relativePath = path.relative(root, candidate).split(path.sep).join('/');
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return { ok: false, message: 'path escapes workspace (path traversal blocked)' };
  }

  return { ok: true, absPath: candidate, relativePath };
}

function sanitizeResult(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value.slice(0, 500);
  if (typeof value !== 'object') return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function postMultipart(url, { model, fileName, fileBuf, language }, key) {
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

    const boundary = `----zavorth${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
    const parts = [];

    function addField(name, value) {
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
          'utf8',
        ),
      );
    }

    addField('model', model);
    if (language) addField('language', language);
    addField('response_format', 'json');

    const safeName = String(fileName || 'audio.bin').replace(/["\r\n]/gu, '_');
    const contentType = guessContentType(safeName);
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${safeName}"\r\nContent-Type: ${contentType}\r\n\r\n`,
        'utf8',
      ),
    );
    parts.push(fileBuf);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'));
    const body = Buffer.concat(parts);

    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        method: 'POST',
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          Authorization: `Bearer ${key}`,
          'Content-Length': body.length,
          'User-Agent': 'zavorth-media-transcription/1.0',
        },
        timeout: 180000,
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
            } catch {
              resolve(raw);
            }
            return;
          }
          reject(new Error(`HTTP ${status}: ${raw.slice(0, 240)}`));
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('transcription request timed out'));
    });
    req.write(body);
    req.end();
  });
}

function guessContentType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const map = {
    '.mp3': 'audio/mpeg',
    '.mp4': 'audio/mp4',
    '.m4a': 'audio/mp4',
    '.wav': 'audio/wav',
    '.webm': 'audio/webm',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.mpeg': 'audio/mpeg',
    '.mpga': 'audio/mpeg',
  };
  return map[ext] || 'application/octet-stream';
}

module.exports = { register };
