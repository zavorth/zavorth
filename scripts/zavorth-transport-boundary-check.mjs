import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

const files = {
  proxyPlane: 'src/ai-gateway/mitm/proxyPlane.cjs',
  proxyCompat: 'src/ai-gateway/mitm/compat/legacyProxyCompat.cjs',
  mitmServer: 'src/ai-gateway/mitm/server.cjs',
  transportPlane: 'src/ai-gateway/sse/transportPlane.ts',
  transportCompat: 'src/ai-gateway/sse/compat/legacyTransportCompat.ts',
  openSseCompat: 'src/ai-gateway/sse/compat/openSseCompat.ts',
  chatHandler: 'src/ai-gateway/sse/handlers/chat.ts',
  chatHelpers: 'src/ai-gateway/sse/handlers/chatHelpers.ts',
  authService: 'src/ai-gateway/sse/services/auth.ts',
  semanticCache: 'src/ai-gateway/lib/semanticCache.ts',
  cachePage: 'src/ai-gateway/app/(dashboard)/dashboard/cache/page.tsx',
  deletedAuthOrig: 'src/ai-gateway/sse/services/auth.ts.orig',
};

checkRequiredFiles();
checkProxyPlane();
checkSseTransportPlane();
checkOpenSseCompatBoundary();
checkHeaderConsumers();
checkForbiddenResidues();

if (failures.length > 0) {
  console.error('[transport-boundary] failed');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[transport-boundary] ok: proxy plane, SSE transport, compat boundary, headers, and legacy residue guard passed.');

function checkRequiredFiles() {
  for (const [label, filePath] of Object.entries(files)) {
    if (label === 'deletedAuthOrig') continue;
    if (!fs.existsSync(abs(filePath))) {
      failures.push(`${filePath}: missing`);
    }
  }
  if (fs.existsSync(abs(files.deletedAuthOrig))) {
    failures.push(`${files.deletedAuthOrig}: should remain deleted`);
  }
}

function checkProxyPlane() {
  const proxy = read(files.proxyPlane);
  const compat = read(files.proxyCompat);
  const server = read(files.mitmServer);

  expectIncludes(files.proxyPlane, proxy, [
    'ZAVORTH_PROXY_PLANE',
    'dataDirName: "Zavorth"',
    'compatibilityDataDirName: ZAVORTH_LEGACY_PROXY_COMPAT.dataDirName',
    'sourceHeader: "x-zavorth-source"',
    'sourceHeaderValue: "zavorth"',
    'getMitmDataDir',
    'getMitmRouterBaseUrl',
    'shouldBypassGatewayLoop',
    'fs.existsSync(legacyDir)',
  ]);
  expectIncludes(files.proxyCompat, compat, [
    'ZAVORTH_LEGACY_PROXY_COMPAT',
    'ZavorthGateway',
    'ZavorthGateway_API_KEY',
    'ZavorthGateway_BASE_URL',
    'x-zavorth-gateway-source',
  ]);
  expectIncludes(files.mitmServer, server, [
    'require("./proxyPlane.cjs")',
    'getMitmApiKey',
    'getMitmDataDir',
    'getMitmRouterBaseUrl',
    'shouldBypassGatewayLoop',
    'passthrough(req, res, bodyBuffer)',
    'intercept(req, res, bodyBuffer, mappedModel)',
  ]);
  forbid(files.proxyPlane, proxy, [
    'ZavorthGateway_API_KEY',
    'ZavorthGateway_BASE_URL',
    'x-zavorth-gateway-source',
    'zavorth-gateway',
  ]);
}

function checkSseTransportPlane() {
  const transport = read(files.transportPlane);
  const compat = read(files.transportCompat);

  expectIncludes(files.transportPlane, transport, [
    'ZAVORTH_COMPATIBLE_API_SURFACE',
    'X-Zavorth-Session-Id',
    'X-Zavorth-No-Cache',
    '_zavorthSkipContextRelay',
    '_zavorthInternalRequest',
    'ZAVORTH_LEGACY_TRANSPORT_COMPAT',
    'isZavorthCacheBypassRequested',
    'withZavorthSessionHeader',
    'getZavorthNoCacheHeaders',
  ]);
  expectIncludes(files.transportCompat, compat, [
    'ZAVORTH_LEGACY_TRANSPORT_COMPAT',
    'X-ZavorthGateway-Session-Id',
    'X-ZavorthGateway-No-Cache',
    '_ZavorthGatewaySkipContextRelay',
    '_ZavorthGatewayInternalRequest',
  ]);
  forbid(files.transportPlane, transport, [
    'X-ZavorthGateway-Session-Id',
    'X-ZavorthGateway-No-Cache',
    '_ZavorthGatewaySkipContextRelay',
    '_ZavorthGatewayInternalRequest',
  ]);
}

function checkOpenSseCompatBoundary() {
  const sseRoot = path.join(root, 'src', 'ai-gateway', 'sse');
  const compatPath = abs(files.openSseCompat);

  for (const filePath of walk(sseRoot)) {
    if (!/\.(ts|tsx)$/.test(filePath)) continue;
    const source = fs.readFileSync(filePath, 'utf8');
    if (source.includes('@ZavorthGateway/open-sse') && path.resolve(filePath) !== path.resolve(compatPath)) {
      failures.push(`${rel(filePath)} imports @ZavorthGateway/open-sse outside sse/compat/openSseCompat.ts`);
    }
  }

  expectIncludes(files.openSseCompat, read(files.openSseCompat), [
    '@ZavorthGateway/open-sse',
    'handleChatCore',
    'errorResponse',
    'unavailableResponse',
    'runWithProxyContext',
  ]);
}

function checkHeaderConsumers() {
  const semanticCache = read(files.semanticCache);
  const cachePage = read(files.cachePage);
  const chat = read(files.chatHandler);
  const helpers = read(files.chatHelpers);
  const auth = read(files.authService);

  expectIncludes(files.semanticCache, semanticCache, [
    'isZavorthCacheBypassRequested',
    'X-Zavorth-No-Cache: true',
  ]);
  expectIncludes(files.cachePage, cachePage, ['X-Zavorth-No-Cache: true']);
  expectIncludes(files.chatHandler, chat, [
    '../compat/openSseCompat',
    '../transportPlane',
    'isZavorthContextRelaySkipped',
    'isZavorthInternalContextHandoffRequest',
  ]);
  expectIncludes(files.chatHelpers, helpers, [
    '../compat/openSseCompat',
    'withZavorthSessionHeader',
  ]);
  expectIncludes(files.authService, auth, ['../compat/openSseCompat']);
  forbid(files.semanticCache, semanticCache, ['X-ZavorthGateway-No-Cache']);
  forbid(files.cachePage, cachePage, ['X-ZavorthGateway-No-Cache']);
}

function checkForbiddenResidues() {
  const legacyRouteMarker = ['Omni', 'Route'].join('');
  const forbidden = [
    new RegExp(legacyRouteMarker, 'i'),
    /9router/i,
    /sk_zavorthBridge/i,
    /OMNIROUTE_BASE_URL/i,
    /x-zavorth-bridge-source/i,
    /\.zavorthBridge/i,
    /@zavorthBridge/i,
  ];
  const roots = [
    path.join(root, 'src', 'ai-gateway', 'mitm'),
    path.join(root, 'src', 'ai-gateway', 'sse'),
  ];

  for (const scanRoot of roots) {
    for (const filePath of walk(scanRoot)) {
      if (!/\.(ts|tsx|cjs|js|mjs)$/.test(filePath)) continue;
      const source = fs.readFileSync(filePath, 'utf8');
      for (const pattern of forbidden) {
        if (pattern.test(source)) {
          failures.push(`${rel(filePath)}: forbidden legacy residue ${pattern}`);
        }
      }
    }
  }
}

function expectIncludes(filePath, source, snippets) {
  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      failures.push(`${filePath}: expected to include ${snippet}`);
    }
  }
}

function forbid(filePath, source, snippets) {
  for (const snippet of snippets) {
    if (source.includes(snippet)) {
      failures.push(`${filePath}: should not include ${snippet}`);
    }
  }
}

function read(filePath) {
  const fullPath = abs(filePath);
  if (!fs.existsSync(fullPath)) return '';
  return fs.readFileSync(fullPath, 'utf8');
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

function abs(filePath) {
  return path.join(root, filePath);
}

function rel(filePath) {
  return path.relative(root, filePath);
}
