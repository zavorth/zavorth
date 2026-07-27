#!/usr/bin/env node
import fs from 'fs';
import http from 'http';
import path from 'path';
import { spawnSync } from 'child_process';
import { HostedSiteOperationsService } from '../src/services/HostedSiteOperationsService.js';
import {
  HOSTED_SITE_REQUIRED_ROUTES,
  HOSTED_SITE_SCREENSHOTS,
  type HostedSiteScreenshotSpec,
} from '../src/contracts/HostedSiteOperationsContract.js';

type BrowserModule = typeof import('playwright');

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
const shouldBuild = argv.includes('--build') || requirePass;
const shouldSmoke = argv.includes('--smoke') || requirePass;
const shouldCaptureScreenshots =
  argv.includes('--screenshots') || (requirePass && !argv.includes('--no-screenshots'));
const websiteRoot = resolveWebsiteRoot();
const qaDir = path.join(websiteRoot, '.qa', 'hosted-site');
const smokeArtifactPath = path.join(qaDir, 'smoke.json');

async function main(): Promise<void> {
  if (shouldBuild) {
    runWebsiteBuild(websiteRoot);
  }

  if (shouldSmoke) {
    await runHostedSiteSmoke(websiteRoot, smokeArtifactPath);
  }

  if (shouldCaptureScreenshots) {
    await captureHostedScreenshots(websiteRoot, qaDir);
  }

  const service = new HostedSiteOperationsService({
    websiteRoot,
    requireExport: shouldBuild || requirePass,
    requireSmoke: shouldSmoke,
    requireScreenshots: shouldCaptureScreenshots,
    smokeArtifactPath,
    screenshotDir: qaDir,
  });
  const snapshot = service.buildSnapshot();

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(`${service.renderReport(snapshot)}\n`);
  }

  if (requirePass && !snapshot.summary.ok) {
    process.exitCode = 1;
  }
}

function resolveWebsiteRoot(): string {
  const inline = argv.find((arg) => arg.startsWith('--website-root='));
  const cliValue = inline ? inline.split('=').slice(1).join('=').trim() : '';
  const envValue = String(process.env.ZAVORTH_WEBSITE_REPO_ROOT || '').trim();
  return path.resolve(cliValue || envValue || path.join(process.cwd(), '..', '..', 'zavorth-website'));
}

function runWebsiteBuild(root: string): void {
  if (!fs.existsSync(root)) {
    throw new Error(`public site not found at ${root}`);
  }
  if (!fs.existsSync(path.join(root, 'node_modules')) && fs.existsSync(path.join(root, 'package-lock.json'))) {
    runNpm(root, ['install']);
  }
  runNpm(root, ['run', 'website:build']);
}

function runNpm(cwd: string, args: string[]): void {
  const env = {
    ...process.env,
    ZAVORTH_NEXT_DIST_DIR: '.next-zavorth-qa',
    NEXT_TELEMETRY_DISABLED: '1',
  };
  const result = process.platform === 'win32'
    ? spawnSync(
      process.env.ComSpec || 'cmd.exe',
      ['/d', '/s', '/c', ['npm', ...args].map(quoteWindowsArg).join(' ')],
      {
        cwd,
        stdio: 'inherit',
        shell: false,
        env,
      },
    )
    : spawnSync('npm', args, {
      cwd,
      stdio: 'inherit',
      shell: false,
      env,
    });
  if (result.error) {
    throw result.error;
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(`npm ${args.join(' ')} failed with code ${result.status}`);
  }
  if (result.signal) {
    throw new Error(`npm ${args.join(' ')} encerrado por sinal ${result.signal}`);
  }
}

function quoteWindowsArg(value: string): string {
  const normalized = String(value || '');
  if (!normalized) {
    return '""';
  }
  if (!/[\s"&()<>^|%!]/.test(normalized)) {
    return normalized;
  }
  const escaped = normalized.replace(/(["^&|<>()%!])/g, '^$1');
  return `"${escaped}"`;
}

async function runHostedSiteSmoke(root: string, targetPath: string): Promise<void> {
  const outRoot = path.join(root, 'out');
  if (!fs.existsSync(outRoot)) {
    throw new Error(`export estatico missing em ${outRoot}; run hosted-site --build before do smoke`);
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const server = await startStaticServer(outRoot);

  try {
    const routes = [];
    for (const route of HOSTED_SITE_REQUIRED_ROUTES) {
      routes.push(await fetchSmokeRoute(server.url, route.route));
    }
    const artifact = {
      generatedAt: new Date().toISOString(),
      baseUrl: server.url,
      ok: routes.every((route) => route.ok && route.status === 200),
      routes,
    };
    fs.writeFileSync(targetPath, `${JSON.stringify(artifact, null, 2)}\n`);
  } finally {
    await server.close();
  }
}

async function fetchSmokeRoute(baseUrl: string, route: string): Promise<{
  route: string;
  status: number;
  ok: boolean;
  bytes: number;
}> {
  const url = new URL(route, baseUrl).toString();
  const response = await fetch(url);
  const text = await response.text();
  return {
    route,
    status: response.status,
    ok: response.ok && text.length > 100,
    bytes: text.length,
  };
}

async function captureHostedScreenshots(root: string, targetDir: string): Promise<void> {
  const outRoot = path.join(root, 'out');
  if (!fs.existsSync(outRoot)) {
    throw new Error(`export estatico missing em ${outRoot}; run hosted-site --build before dos screenshots`);
  }

  fs.mkdirSync(targetDir, { recursive: true });
  const server = await startStaticServer(outRoot);
  let browser: Awaited<ReturnType<BrowserModule['chromium']['launch']>> | null = null;

  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true });
    for (const screenshot of HOSTED_SITE_SCREENSHOTS) {
      await captureScreenshot(browser, server.url, screenshot, targetDir);
    }
  } finally {
    if (browser) {
      await browser.close();
    }
    await server.close();
  }
}

async function captureScreenshot(
  browser: Awaited<ReturnType<BrowserModule['chromium']['launch']>>,
  baseUrl: string,
  screenshot: HostedSiteScreenshotSpec,
  targetDir: string,
): Promise<void> {
  const page = await browser.newPage({ viewport: screenshot.viewport });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });

  await page.goto(new URL(screenshot.route, baseUrl).toString(), { waitUntil: 'load' });
  await page.waitForTimeout(900);
  await page.screenshot({
    path: path.join(targetDir, screenshot.fileName),
    fullPage: false,
  });
  await page.close();

  const blockingErrors = errors.filter((message) => !message.includes('Failed to load resource'));
  if (blockingErrors.length > 0) {
    throw new Error(`console/page errors durante screenshot ${screenshot.id}: ${blockingErrors.join(' | ')}`);
  }
}

async function startStaticServer(outRoot: string): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer((request, response) => {
    const filePath = resolveStaticPath(outRoot, request.url || '/');
    if (!filePath) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('not found');
      return;
    }
    response.writeHead(200, { 'content-type': contentType(filePath) });
    fs.createReadStream(filePath).pipe(response);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('could not obtain static server port');
  }
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function resolveStaticPath(outRoot: string, rawUrl: string): string | null {
  const url = new URL(rawUrl, 'http://127.0.0.1');
  const pathname = decodeURIComponent(url.pathname);
  const normalized = path.normalize(pathname).replace(/^([/\\])+/, '');
  if (normalized.startsWith('..')) {
    return null;
  }

  const candidates = pathname === '/'
    ? ['index.html']
    : [
      normalized,
      `${normalized}.html`,
      path.join(normalized, 'index.html'),
    ];

  for (const candidate of candidates) {
    const absolute = path.resolve(outRoot, candidate);
    if (!absolute.startsWith(outRoot) || !fs.existsSync(absolute)) {
      continue;
    }
    if (fs.statSync(absolute).isFile()) {
      return absolute;
    }
  }
  return null;
}

function contentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
  };
  return types[extension] || 'application/octet-stream';
}

main().catch((error) => {
  console.error('[hosted-site] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
