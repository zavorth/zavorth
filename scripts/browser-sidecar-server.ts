import http from 'http';
import fs from 'fs';
import path from 'path';
import { AutomaticBrowserTool } from '../src/mcp/tools/AutomaticBrowserTool.js';
import { asErrorLike } from '../src/utils/errorLike';

const host = String(process.env.ZAVORTH_BROWSER_SIDECAR_HOST || '127.0.0.1').trim() || '127.0.0.1';
const port = Number(process.env.ZAVORTH_BROWSER_SIDECAR_PORT || 35791) || 35791;
const token = String(process.env.ZAVORTH_BROWSER_SIDECAR_TOKEN || '').trim();
const baseUrl = `http://${host}:${port}`;
const statusFile = String(
  process.env.ZAVORTH_BROWSER_SIDECAR_STATUS_FILE
    || path.resolve(process.cwd(), 'data', 'runtime', 'browser-sidecar.json'),
);
const browser = new AutomaticBrowserTool({ browserSidecar: null });

function writeJson(res: http.ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function isAuthorized(req: http.IncomingMessage): boolean {
  if (!token) {
    return true;
  }
  const authorization = String(req.headers.authorization || '').trim();
  return authorization === `Bearer ${token}`;
}

function writeStatus(snapshot: {
  running: boolean;
  ready: boolean;
  message: string;
}): void {
  try {
    fs.mkdirSync(path.dirname(statusFile), { recursive: true });
    fs.writeFileSync(statusFile, JSON.stringify({
      enabled: true,
      running: snapshot.running,
      ready: snapshot.ready,
      spawnedByZavorth: true,
      pid: process.pid,
      baseUrl,
      localUrl: baseUrl,
      checkedAt: new Date().toISOString(),
      message: snapshot.message,
    }, null, 2), 'utf8');
  } catch {
    // Status file is observability-only.
  }
}

function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 1_000_000) {
        reject(new Error('Payload grande demais para o browser sidecar.'));
      }
    });
    req.on('error', reject);
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        resolve(parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? parsed as Record<string, unknown>
          : {});
      } catch {
        reject(new Error('JSON invalido no browser sidecar.'));
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || `${host}:${port}`}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      writeJson(res, 200, {
        ok: true,
        runtime: 'browser-sidecar',
        isolated: true,
        checkedAt: new Date().toISOString(),
      });
      return;
    }

    if (req.method !== 'POST' || url.pathname !== '/mcp/browser') {
      writeJson(res, 404, { ok: false, error: 'Not found' });
      return;
    }

    if (!isAuthorized(req)) {
      writeJson(res, 401, { ok: false, error: 'Unauthorized' });
      return;
    }

    const body = await readBody(req);
    const action = String(body.action || '').trim();
    const args = body.args && typeof body.args === 'object' && !Array.isArray(body.args)
      ? body.args as Record<string, unknown>
      : {};
    const result = await browser.handleToolCall(action, args);
    const text = result.content[0]?.text || '{}';
    const payload = JSON.parse(text);
    writeJson(res, result.isError ? 400 : 200, payload);
  } catch (error: unknown) {
    const err = asErrorLike(error);

    writeJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(port, host, () => {
  writeStatus({
    running: true,
    ready: true,
    message: 'Browser sidecar pronto para MCP isolado.',
  });
  console.log(`[browser-sidecar] listening on ${baseUrl}`);
});

process.on('SIGTERM', async () => {
  writeStatus({
    running: false,
    ready: false,
    message: 'Browser sidecar encerrado por SIGTERM.',
  });
  await browser.shutdown();
  server.close(() => process.exit(0));
});

process.on('SIGINT', async () => {
  writeStatus({
    running: false,
    ready: false,
    message: 'Browser sidecar encerrado por SIGINT.',
  });
  await browser.shutdown();
  server.close(() => process.exit(0));
});
