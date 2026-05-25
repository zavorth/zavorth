import * as http from 'http';
import fs from 'fs';
import path from 'path';
import {
  WebConsolePreviewFileService,
  type PreviewAssetPayload,
  type PreviewFilePayload,
} from './WebConsolePreviewFileService.js';
import { buildRuntimeShellHtml } from './WebConsoleRuntimeShellHtml.js';
import { buildRuntimeShellScript } from './WebConsoleRuntimeShellScript.js';
import { buildRuntimeShellStyles } from './WebConsoleRuntimeShellStyles.js';

type WriteJsonResponse = (res: http.ServerResponse, body: unknown, statusCode?: number) => void;

export class WebConsoleAssetService {
  private readonly previewFiles: WebConsolePreviewFileService;
  private readonly dashboardReviewHtmlPath: string;
  private readonly dashboardShellDir: string;

  constructor(workspaceRoot: string = process.cwd()) {
    this.previewFiles = new WebConsolePreviewFileService(workspaceRoot);
    this.dashboardReviewHtmlPath = path.resolve(
      workspaceRoot,
      '.tmp',
      'dashboard-browser-preview',
      'index.html',
    );
    this.dashboardShellDir = path.resolve(workspaceRoot, 'assets', 'dashboard');
  }

  public handleStaticRoute(
    pathname: string,
    res: http.ServerResponse,
    writeJson: WriteJsonResponse,
  ): boolean {
    const isDashboardPath = pathname === '/' || pathname === '/dashboard' || pathname === '/dashboard/';
    const isControlPath = pathname === '/dashboard' || pathname === '/dashboard/';
    const isAppPath = pathname === '/app' || pathname === '/app/';

    if (isDashboardPath || isControlPath) {
      this.writeInline(res, this.readDashboardShellHtml(), 'text/html; charset=utf-8');
      return true;
    }

    if (isAppPath) {
      if (!this.shouldServeLegacySurfaceRoute()) {
        this.redirectToControl(res);
        return true;
      }
      this.writeInline(res, buildRuntimeShellHtml(pathname), 'text/html; charset=utf-8');
      return true;
    }

    if (pathname === '/dashboard/review' || pathname === '/dashboard/review/') {
      if (!this.shouldServeDashboardReviewRoute()) {
        this.redirectToControl(res);
        return true;
      }
      this.writeInline(res, this.readDashboardReviewHtml(), 'text/html; charset=utf-8');
      return true;
    }

    if (pathname === '/classic' || pathname === '/classic/') {
      this.redirectToControl(res);
      return true;
    }

    if (pathname === '/app.js') {
      if (!this.shouldServeLegacySurfaceRoute()) {
        writeJson(res, { error: 'Not found' }, 404);
        return true;
      }
      this.writeInline(res, buildRuntimeShellScript(), 'application/javascript; charset=utf-8');
      return true;
    }

    if (pathname === '/styles.css') {
      if (!this.shouldServeLegacySurfaceRoute()) {
        writeJson(res, { error: 'Not found' }, 404);
        return true;
      }
      this.writeInline(res, buildRuntimeShellStyles(), 'text/css; charset=utf-8');
      return true;
    }

    if (
      pathname.startsWith('/styles/')
      || pathname.startsWith('/scripts/')
      || pathname.startsWith('/assets/')
    ) {
      const staticAsset = this.readDashboardAsset(pathname);
      if (staticAsset) {
        this.writeInline(res, staticAsset.content, staticAsset.contentType);
        return true;
      }
    }

    if (pathname === '/favicon.svg' || pathname === '/icons.svg') {
      this.writeInline(res, this.buildIconSvg(), 'image/svg+xml');
      return true;
    }

    if (pathname.startsWith('/assets/')) {
      writeJson(res, { error: 'Not found' }, 404);
      return true;
    }

    return false;
  }

  public readPreviewFile(targetPath: string): PreviewFilePayload {
    return this.previewFiles.readPreviewFile(targetPath);
  }

  public readPreviewAsset(targetPath: string): PreviewAssetPayload {
    return this.previewFiles.readPreviewAsset(targetPath);
  }

  private shouldServeDashboardReviewRoute(): boolean {
    return this.isDevelopmentOrTestRuntime()
      && this.isTruthyFlag(process.env.ZAVORTH_COMMAND_CENTER_REVIEW_ENABLED);
  }

  private shouldServeLegacySurfaceRoute(): boolean {
    return this.isDevelopmentOrTestRuntime()
      && this.isTruthyFlag(process.env.ZAVORTH_LEGACY_SURFACES_ENABLED);
  }

  private isDevelopmentOrTestRuntime(): boolean {
    const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
    const zavorthEnv = String(process.env.ZAVORTH_ENV || '').trim().toLowerCase();
    return nodeEnv === 'development'
      || nodeEnv === 'test'
      || zavorthEnv === 'development'
      || zavorthEnv === 'test';
  }

  private isTruthyFlag(value: unknown): boolean {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
  }

  private readDashboardReviewHtml(): string {
    const explicitPath = String(process.env.ZAVORTH_COMMAND_CENTER_REVIEW_HTML || '').trim();
    const candidates = [
      explicitPath ? path.resolve(explicitPath) : null,
      this.dashboardReviewHtmlPath,
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return fs.readFileSync(candidate, 'utf8');
      }
    }

    return this.buildDashboardReviewFallbackHtml();
  }

  private readDashboardShellHtml(): string {
    const shellPath = path.join(this.dashboardShellDir, 'index.html');
    if (fs.existsSync(shellPath)) {
      return fs.readFileSync(shellPath, 'utf8');
    }
    return this.readDashboardReviewHtml();
  }

  private readDashboardAsset(
    pathname: string,
  ): { content: string | Buffer; contentType: string } | null {
    const normalizedPath = pathname.replace(/^\/+/, '').replace(/\//g, path.sep);
    const candidate = path.resolve(this.dashboardShellDir, normalizedPath);
    if (!candidate.startsWith(this.dashboardShellDir + path.sep) || !fs.existsSync(candidate)) {
      return null;
    }
    const stat = fs.statSync(candidate);
    if (!stat.isFile()) {
      return null;
    }
    return {
      content: fs.readFileSync(candidate),
      contentType: this.resolveDashboardAssetContentType(candidate),
    };
  }

  private resolveDashboardAssetContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.css') return 'text/css; charset=utf-8';
    if (ext === '.js') return 'application/javascript; charset=utf-8';
    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.svg') return 'image/svg+xml';
    if (ext === '.webp') return 'image/webp';
    return 'application/octet-stream';
  }

  private buildDashboardReviewFallbackHtml(): string {
    return `<!doctype html>
<html lang="en-US">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Zavorth Dashboard Review</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: radial-gradient(circle at top, rgba(21, 158, 135, .18), transparent 36%), #050708; color: #edf8f6; }
      main { width: min(760px, calc(100vw - 40px)); border: 1px solid rgba(139, 255, 228, .18); border-radius: 28px; background: rgba(255,255,255,.045); box-shadow: 0 30px 120px rgba(0,0,0,.48); padding: 34px; }
      p { color: rgba(237, 248, 246, .72); line-height: 1.7; }
      code { color: #8bffe4; background: rgba(139,255,228,.08); border: 1px solid rgba(139,255,228,.14); border-radius: 8px; padding: 2px 7px; }
      .tag { color: #8bffe4; letter-spacing: .18em; text-transform: uppercase; font-size: 12px; font-weight: 800; }
    </style>
  </head>
  <body>
    <main>
      <span class="tag">Dashboard Review</span>
      <h1>The visual review bench has not been generated yet.</h1>
      <p>This route is internal and only reads HTML generated by the official fixture bench.</p>
      <p>Run <code>npm run dashboard:preview -- --fixture=safe-run</code> and reload <code>/dashboard/review?fixture=awaiting-approval</code>.</p>
    </main>
  </body>
</html>`;
  }

  private buildIconSvg(): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <rect width="64" height="64" rx="18" fill="#0f6c5c"/>
  <path d="M20 44V20h13.2c7.8 0 12.8 4.4 12.8 11.7S41 44 33.2 44H20Zm8.2-6.5h4.4c3.7 0 6.3-2.1 6.3-5.8s-2.6-5.8-6.3-5.8h-4.4v11.6Z" fill="white"/>
</svg>`;
  }

  private writeInline(
    res: http.ServerResponse,
    content: string | Buffer,
    contentType: string,
    statusCode: number = 200,
  ): void {
    res.writeHead(statusCode, { 'Content-Type': contentType });
    res.end(content);
  }

  private redirectToControl(res: http.ServerResponse): void {
    res.writeHead(302, {
      Location: '/dashboard',
      'Cache-Control': 'no-store',
    });
    res.end();
  }
}
