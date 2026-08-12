import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export type ZavorthNativePowerPackRuntime = {
  projectRoot?: string;
  now?: () => Date;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
};

export type ZavorthNativePowerPackStatus = {
  generatedAt: string;
  surface: 'native-power-pack';
  pack: string;
  status: 'ready' | 'degraded' | 'blocked';
  summary: {
    configuredCredentials: number;
    configuredConnectors: number;
    actions: number;
  };
  actions: string[];
  safety: {
    rawSecretsSerialized: false;
    approvalRequiredForPersonalData: true;
    approvalRequiredForExternalSend: true;
  };
};

export type ZavorthNativePowerPackDocumentResult = {
  ok: boolean;
  status: 'ok' | 'blocked';
  summary: string;
  file: string;
  bytes: number;
  textPreview: string;
};

export type ZavorthNativePowerPackWikiResult = {
  ok: boolean;
  status: 'ok' | 'blocked';
  summary: string;
  hits: Array<{
    file: string;
    title: string;
    snippet: string;
    score: number;
  }>;
};

export type ZavorthNativePowerPackArtifactResult = {
  ok: boolean;
  status: 'ok' | 'blocked';
  summary: string;
  artifactPath: string;
  bytes: number;
  format: string;
};

export type ZavorthNativePowerPackImageAnalysis = {
  ok: boolean;
  status: 'ok' | 'blocked';
  summary: string;
  file: string;
  bytes: number;
  mimeType: string;
  sha256: string;
  rawBytesSerialized: false;
};

const GOOGLE_ACTIONS = [
  'gmail.search',
  'gmail.draft',
  'gmail.send',
  'google.drive.search',
  'google.drive.read_file',
  'google.calendar.list',
  'google.calendar.create',
  'google.calendar.update',
  'google.tasks.list',
  'google.tasks.create',
  'google.tasks.update',
];

const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.jsonl',
  '.csv',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.html',
  '.css',
  '.xml',
  '.yaml',
  '.yml',
]);

export class ZavorthNativePowerPackService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly env: NodeJS.ProcessEnv | Record<string, string | undefined>;
  private readonly fetchImpl: typeof fetch;

  public constructor(runtime: ZavorthNativePowerPackRuntime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.now = runtime.now || (() => new Date());
    this.env = runtime.env || process.env;
    this.fetchImpl = runtime.fetchImpl || fetch;
  }

  public googleWorkspaceStatus(): ZavorthNativePowerPackStatus {
    const credentialKeys = [
      'ZAVORTH_GOOGLE_ACCESS_TOKEN',
      'GOOGLE_ACCESS_TOKEN',
      'ZAVORTH_GOOGLE_OAUTH_CLIENT_ID',
      'GOOGLE_OAUTH_CLIENT_ID',
      'ZAVORTH_GOOGLE_OAUTH_CLIENT_SECRET',
      'GOOGLE_OAUTH_CLIENT_SECRET',
    ];
    const configuredCredentials = credentialKeys.filter((key) => clean(this.env[key])).length;
    return {
      generatedAt: this.now().toISOString(),
      surface: 'native-power-pack',
      pack: 'google-workspace',
      status: configuredCredentials > 0 ? 'ready' : 'degraded',
      summary: {
        configuredCredentials,
        configuredConnectors: configuredCredentials > 0 ? 1 : 0,
        actions: GOOGLE_ACTIONS.length,
      },
      actions: [...GOOGLE_ACTIONS],
      safety: {
        rawSecretsSerialized: false,
        approvalRequiredForPersonalData: true,
        approvalRequiredForExternalSend: true,
      },
    };
  }

  public mediaStatus(): ZavorthNativePowerPackStatus {
    const actions = ['media.image.generate', 'media.image.analyze', 'media.speech.synthesize'];
    return {
      generatedAt: this.now().toISOString(),
      surface: 'native-power-pack',
      pack: 'media',
      status: 'ready',
      summary: {
        configuredCredentials: 0,
        configuredConnectors: 1,
        actions: actions.length,
      },
      actions,
      safety: {
        rawSecretsSerialized: false,
        approvalRequiredForPersonalData: true,
        approvalRequiredForExternalSend: true,
      },
    };
  }

  public iotStatus(): ZavorthNativePowerPackStatus {
    const configuredConnectors = clean(this.env.ZAVORTH_MQTT_BRIDGE_URL) || clean(this.env.MQTT_BRIDGE_URL) ? 1 : 0;
    const actions = ['devices.iot.status', 'devices.iot.mqtt_publish'];
    return {
      generatedAt: this.now().toISOString(),
      surface: 'native-power-pack',
      pack: 'device-iot',
      status: configuredConnectors > 0 ? 'ready' : 'degraded',
      summary: {
        configuredCredentials: configuredConnectors,
        configuredConnectors,
        actions: actions.length,
      },
      actions,
      safety: {
        rawSecretsSerialized: false,
        approvalRequiredForPersonalData: true,
        approvalRequiredForExternalSend: true,
      },
    };
  }

  public extractDocument(input: { filePath?: string | null; maxChars?: number | null }): ZavorthNativePowerPackDocumentResult {
    const resolved = this.resolveWorkspaceFile(input.filePath);
    if (!resolved.ok) {
      return {
        ok: false,
        status: 'blocked',
        summary: (resolved as any).reason,
        file: '',
        bytes: 0,
        textPreview: '',
      };
    }
    const ext = path.extname(resolved.absolute).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) {
      return {
        ok: false,
        status: 'blocked',
        summary: `Document extension ${ext || '<none>'} is not supported by local extractor.`,
        file: resolved.relative,
        bytes: 0,
        textPreview: '',
      };
    }
    const raw = fs.readFileSync(resolved.absolute, 'utf8');
    const maxChars = boundedNumber(input.maxChars, 4000, 200, 24000);
    return {
      ok: true,
      status: 'ok',
      summary: `Extracted ${Math.min(raw.length, maxChars)} character(s) from ${resolved.relative}.`,
      file: resolved.relative,
      bytes: Buffer.byteLength(raw, 'utf8'),
      textPreview: redactSensitiveText(raw).slice(0, maxChars),
    };
  }

  public searchWiki(input: { query?: string | null; limit?: number | null }): ZavorthNativePowerPackWikiResult {
    const query = clean(input.query);
    if (!query) {
      return { ok: false, status: 'blocked', summary: 'Wiki search query is required.', hits: [] };
    }
    const terms = normalizeSearch(query).split(/\s+/u).filter((term) => term.length >= 2);
    const files = this.collectWikiFiles();
    const hits = files
      .map((file) => this.scoreWikiFile(file, terms))
      .filter((hit): hit is NonNullable<ReturnType<ZavorthNativePowerPackService['scoreWikiFile']>> => Boolean(hit))
      .sort((left, right) => right.score - left.score || left.file.localeCompare(right.file))
      .slice(0, boundedNumber(input.limit, 8, 1, 50));
    return {
      ok: true,
      status: 'ok',
      summary: `Found ${hits.length} local wiki/document hit(s).`,
      hits,
    };
  }

  public generateImageArtifact(input: { prompt?: string | null; style?: string | null }): ZavorthNativePowerPackArtifactResult {
    const prompt = clean(input.prompt);
    if (!prompt) return artifactBlocked('Image prompt is required.');
    const title = clean(input.style) || 'native-visual';
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">',
      '<rect width="1280" height="720" fill="#101418"/>',
      '<rect x="56" y="56" width="1168" height="608" rx="28" fill="#f7f3e8"/>',
      `<text x="96" y="138" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="#101418">${escapeXml(title)}</text>`,
      `<text x="96" y="220" font-family="Arial, sans-serif" font-size="30" fill="#1d4f8f">${escapeXml(prompt.slice(0, 90))}</text>`,
      '<circle cx="1040" cy="430" r="124" fill="#7ad48b"/>',
      '<rect x="132" y="330" width="640" height="34" rx="17" fill="#56b6e9"/>',
      '<rect x="132" y="396" width="520" height="34" rx="17" fill="#ffcf5a"/>',
      '<rect x="132" y="462" width="720" height="34" rx="17" fill="#f2766b"/>',
      '</svg>',
    ].join('');
    return this.writeArtifact('media-artifacts', 'image', 'svg', svg);
  }

  public synthesizeSpeechArtifact(input: { text?: string | null; voice?: string | null }): ZavorthNativePowerPackArtifactResult {
    const speechText = clean(input.text);
    if (!speechText) return artifactBlocked('Speech text is required.');
    const payload = {
      generatedAt: this.now().toISOString(),
      kind: 'speech-synthesis-plan',
      voice: clean(input.voice) || 'default',
      textPreview: redactSensitiveText(speechText).slice(0, 1000),
      audioGenerated: false,
      nextExecutor: 'SpeechRuntimeService or configured TTS adapter',
    };
    return this.writeArtifact('media-artifacts', 'speech', 'json', `${JSON.stringify(payload, null, 2)}\n`);
  }

  public renderCanvas(input: { title?: string | null; content?: string | null }): ZavorthNativePowerPackArtifactResult {
    const title = clean(input.title) || 'Zavorth Canvas';
    const content = clean(input.content);
    if (!content) return artifactBlocked('Canvas content is required.');
    const html = [
      '<!doctype html>',
      '<meta charset="utf-8">',
      `<title>${escapeHtml(title)}</title>`,
      '<main style="font-family:Arial,sans-serif;margin:0;min-height:100vh;background:#101418;color:#f7f3e8;padding:48px">',
      `<h1 style="font-size:42px">${escapeHtml(title)}</h1>`,
      `<section style="white-space:pre-wrap;font-size:22px;line-height:1.5;max-width:960px">${escapeHtml(redactSensitiveText(content))}</section>`,
      '</main>',
    ].join('\n');
    return this.writeArtifact('canvas-artifacts', 'canvas', 'html', html);
  }

  public analyzeImage(input: { filePath?: string | null }): ZavorthNativePowerPackImageAnalysis {
    const resolved = this.resolveWorkspaceFile(input.filePath);
    if (!resolved.ok) {
      return {
        ok: false,
        status: 'blocked',
        summary: (resolved as any).reason,
        file: '',
        bytes: 0,
        mimeType: 'application/octet-stream',
        sha256: '',
        rawBytesSerialized: false,
      };
    }
    const bytes = fs.readFileSync(resolved.absolute);
    return {
      ok: true,
      status: 'ok',
      summary: `Image metadata analyzed for ${resolved.relative}.`,
      file: resolved.relative,
      bytes: bytes.length,
      mimeType: detectImageMime(bytes, resolved.absolute),
      sha256: createHash('sha256').update(bytes).digest('hex'),
      rawBytesSerialized: false,
    };
  }

  public async driveSearch(input: { query?: string | null; pageSize?: number | null }): Promise<Record<string, unknown>> {
    const token = this.googleAccessToken();
    if (!token) return { ok: false, status: 'blocked', summary: 'Google access token is not configured.' };
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('pageSize', String(boundedNumber(input.pageSize, 10, 1, 50)));
    url.searchParams.set('fields', 'files(id,name,mimeType,modifiedTime,webViewLink),nextPageToken');
    const query = clean(input.query);
    if (query) url.searchParams.set('q', `name contains '${query.replace(/'/g, "\\'")}' and trashed = false`);
    const json = await this.googleJson(url.toString(), token);
    const files = Array.isArray(json.files) ? json.files : [];
    return {
      ok: true,
      status: 'ok',
      summary: `Google Drive returned ${files.length} file(s).`,
      files: files.map(redactGoogleFile),
      nextPageToken: clean(json.nextPageToken),
    };
  }

  public async driveReadFile(input: { fileId?: string | null }): Promise<Record<string, unknown>> {
    const token = this.googleAccessToken();
    const fileId = clean(input.fileId);
    if (!token) return { ok: false, status: 'blocked', summary: 'Google access token is not configured.' };
    if (!fileId) return { ok: false, status: 'blocked', summary: 'Google Drive fileId is required.' };
    const metaUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}...fields=id,name,mimeType,size,modifiedTime,webViewLink`;
    const meta = await this.googleJson(metaUrl, token);
    return {
      ok: true,
      status: 'ok',
      summary: `Google Drive metadata read for ${clean(meta.name) || fileId}.`,
      file: redactGoogleFile(meta),
      contentFetched: false,
      note: 'Binary/document content export is intentionally separate from metadata read.',
    };
  }

  public async mqttPublish(input: { topic?: string | null; message?: string | null }): Promise<Record<string, unknown>> {
    const bridge = clean(this.env.ZAVORTH_MQTT_BRIDGE_URL) || clean(this.env.MQTT_BRIDGE_URL);
    const topic = clean(input.topic);
    const message = clean(input.message);
    if (!bridge) return { ok: false, status: 'blocked', summary: 'MQTT bridge URL is not configured.' };
    if (!topic || !message) return { ok: false, status: 'blocked', summary: 'MQTT topic and message are required.' };
    const response = await this.fetchImpl(bridge, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic, message }),
    });
    return {
      ok: response.ok,
      status: response.ok ? 'ok' : 'blocked',
      summary: response.ok ? `MQTT bridge accepted publish to ${topic}.` : `MQTT bridge rejected publish with HTTP ${response.status}.`,
      httpStatus: response.status,
      topic,
    };
  }

  private async googleJson(url: string, token: string): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(url, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`google_request_failed:${response.status}`);
    }
    const parsed = await response.json().catch(() => ({}));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  }

  private googleAccessToken(): string | null {
    return clean(this.env.ZAVORTH_GOOGLE_ACCESS_TOKEN) || clean(this.env.GOOGLE_ACCESS_TOKEN);
  }

  private writeArtifact(folder: string, prefix: string, extension: string, content: string): ZavorthNativePowerPackArtifactResult {
    const hash = createHash('sha256').update(`${this.now().toISOString()}\n${content}`).digest('hex').slice(0, 16);
    const dir = path.join(this.projectRoot, '.zavorth', folder);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${prefix}-${hash}.${extension}`);
    fs.writeFileSync(file, content, 'utf8');
    const relative = path.relative(this.projectRoot, file).replace(/\\/g, '/');
    return {
      ok: true,
      status: 'ok',
      summary: `Created ${prefix} artifact at ${relative}.`,
      artifactPath: relative,
      bytes: Buffer.byteLength(content, 'utf8'),
      format: extension,
    };
  }

  private resolveWorkspaceFile(filePath: unknown): { ok: true; absolute: string; relative: string } | { ok: false; reason: string } {
    const raw = clean(filePath);
    if (!raw) return { ok: false, reason: 'A workspace file path is required.' };
    const absolute = path.resolve(this.projectRoot, raw);
    const relativeCheck = path.relative(this.projectRoot, absolute);
    if (relativeCheck.startsWith('..') || path.isAbsolute(relativeCheck)) {
      return { ok: false, reason: 'Path escapes the workspace root.' };
    }
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      return { ok: false, reason: `File not found: ${raw}` };
    }
    return { ok: true, absolute, relative: relativeCheck.replace(/\\/g, '/') };
  }

  private collectWikiFiles(): string[] {
    const roots = ['docs', 'README.md', 'readme.md', 'wiki', 'knowledge']
      .map((entry) => path.join(this.projectRoot, entry));
    const files: string[] = [];
    for (const root of roots) {
      if (!fs.existsSync(root)) continue;
      const stat = fs.statSync(root);
      if (stat.isFile()) files.push(root);
      if (stat.isDirectory()) files.push(...walkTextFiles(root, this.projectRoot, 120));
    }
    return Array.from(new Set(files));
  }

  private scoreWikiFile(file: string, terms: string[]): { file: string; title: string; snippet: string; score: number } | null {
    const raw = fs.readFileSync(file, 'utf8');
    const normalized = normalizeSearch(raw);
    let score = 0;
    for (const term of terms) {
      if (normalized.includes(term)) score += term.length;
    }
    if (score <= 0) return null;
    const relative = path.relative(this.projectRoot, file).replace(/\\/g, '/');
    return {
      file: relative,
      title: inferTitle(raw, relative),
      snippet: buildSnippet(raw, terms),
      score,
    };
  }
}

function walkTextFiles(dir: string, projectRoot: string, limit: number): string[] {
  const files: string[] = [];
  const stack = [dir];
  while (stack.length > 0 && files.length < limit) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
      const absolute = path.join(current, entry.name);
      const relative = path.relative(projectRoot, absolute);
      if (relative.startsWith('..') || path.isAbsolute(relative)) continue;
      if (entry.isDirectory()) stack.push(absolute);
      if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(absolute);
      if (files.length >= limit) break;
    }
  }
  return files;
}

function artifactBlocked(summary: string): ZavorthNativePowerPackArtifactResult {
  return { ok: false, status: 'blocked', summary, artifactPath: '', bytes: 0, format: '' };
}

function clean(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function normalizeSearch(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function inferTitle(raw: string, fallback: string): string {
  const heading = raw.split(/\r?\n/u).find((line) => /^#\s+/.test(line));
  return heading ? heading.replace(/^#\s+/, '').trim().slice(0, 120) : fallback;
}

function buildSnippet(raw: string, terms: string[]): string {
  const lower = normalizeSearch(raw);
  const index = terms.map((term) => lower.indexOf(term)).filter((entry) => entry >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, index - 120);
  return redactSensitiveText(raw.slice(start, start + 320)).replace(/\s+/g, ' ').trim();
}

function detectImageMime(bytes: Buffer, file: string): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes.slice(0, 3).toString('ascii') === 'GIF') return 'image/gif';
  if (bytes.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  const ext = path.extname(file).toLowerCase();
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

function redactGoogleFile(value: unknown): Record<string, unknown> {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    id: clean(record.id),
    name: clean(record.name),
    mimeType: clean(record.mimeType),
    modifiedTime: clean(record.modifiedTime),
    webViewLink: clean(record.webViewLink),
    size: clean(record.size),
  };
}

function redactSensitiveText(value: unknown): string {
  return String(value || '')
    .replace(/\b(sk-[A-Za-z0-9_-]{12,})\b/g, 'sk-[redacted]')
    .replace(/\b(xox[baprs]-[A-Za-z0-9-]{12,})\b/g, 'xox-[redacted]')
    .replace(/\b(gh[pousr]_[A-Za-z0-9_]{12,})\b/g, 'gh_[redacted]')
    .replace(/\b([A-Za-z0-9+/]{40,}={0,2})\b/g, '[redacted-secret-like-token]')
    .replace(/\b([A-Z0-9_]*(?:api[_-]?key|TOKEN|SECRET|PASSWORD|PASS|CREDENTIAL)[A-Z0-9_]*)\s*[:=]\s*([^\s"'`,;]+)/gi, '$1=[redacted]');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtml(value: string): string {
  return escapeXml(value).replace(/'/g, '&#39;');
}
