#!/usr/bin/env node
import * as http from 'http';
import { config } from './config/index.js';
import { ZavorthEchoService } from './services/ZavorthEchoService.js';
import { DashboardEchoRouteService } from './services/DashboardEchoRouteService.js';

const host = process.env.ZAVORTH_ECHO_HOST || config.zavorthWebHost || '127.0.0.1';
const port = Number.parseInt(process.env.ZAVORTH_ECHO_PORT || String(config.zavorthWebPort || 3000), 10);
const echo = new ZavorthEchoService();
const routes = new DashboardEchoRouteService();

function writeCors(res: http.ServerResponse): void {
  const defaultCorsOrigin = `http://${host}:${port}`;
  res.setHeader('Access-Control-Allow-Origin', process.env.ZAVORTH_CORS_ORIGIN || defaultCorsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

function writeJson(res: http.ServerResponse, body: unknown, statusCode = 200): void {
  writeCors(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  void (async () => {
    writeCors(res);

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || `${host}:${port}`}`);
    const pathname = url.pathname;

    if (pathname === '/' || pathname === '/health') {
      writeJson(res, {
        ok: true,
        service: 'zavorth-echo',
        routes: ['/api/v2/echo/*', '/api/v2/nexus/*'],
      });
      return;
    }

    if (pathname.startsWith('/api/v2/echo/') || pathname.startsWith('/api/v2/nexus/')) {
      const handled = await routes.handleRequest(req, res, url, pathname, {
        echo,
        writeJson,
      });
      if (handled) {
        return;
      }
    }

    writeJson(res, { ok: false, error: 'Not found' }, 404);
  })().catch((error) => {
    writeJson(res, { ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  });
});

server.listen(port, host, () => {
  console.log(`[zavorth-echo] API pronta em http://${host}:${port}`);
  console.log('[zavorth-echo] Rotas: /api/v2/echo/* e /api/v2/nexus/*');
});

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
