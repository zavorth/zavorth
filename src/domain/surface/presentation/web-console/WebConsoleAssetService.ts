import * as http from 'http';
import fs from 'fs';
import path from 'path';
import {
  WebConsolePreviewFileService,
  type PreviewAssetPayload,
  type PreviewFilePayload,
} from './WebConsolePreviewFileService.js';

type WriteJsonResponse = (res: http.ServerResponse, body: unknown, statusCode?: number) => void;

export class WebConsoleAssetService {
  private readonly previewFiles: WebConsolePreviewFileService;
  private readonly zavorthControlReviewHtmlPath: string;
  private readonly zavorthControlShellDir: string;

  constructor(workspaceRoot: string = process.cwd()) {
    this.previewFiles = new WebConsolePreviewFileService(workspaceRoot);
    this.zavorthControlReviewHtmlPath = path.resolve(
      workspaceRoot,
      '.tmp',
      'zavorthControl-browser-preview',
      'index.html',
    );
    this.zavorthControlShellDir = path.resolve(workspaceRoot, 'assets', 'zavorthControl');
  }

  public handleStaticRoute(
    pathname: string,
    res: http.ServerResponse,
    writeJson: WriteJsonResponse,
  ): boolean {
    const isZavorthControlPath = pathname === '/' || pathname === '/zavorthControl' || pathname === '/zavorthControl/';
    const isControlPath = pathname === '/zavorthControl' || pathname === '/zavorthControl/';
    const isRemovedSurfacePath = pathname === '/app'
      || pathname === '/app/'
      || pathname === '/classic'
      || pathname === '/classic/';

    if (isZavorthControlPath || isControlPath) {
      this.writeInline(res, this.readZavorthControlShellHtml(), 'text/html; charset=utf-8');
      return true;
    }

    if (isRemovedSurfacePath) {
      writeJson(res, {
        ok: false,
        error: 'This web surface has been removed. Use /zavorthControl.',
        zavorthControlUrl: '/zavorthControl',
      }, 410);
      return true;
    }

    if (pathname === '/zavorthControl/review' || pathname === '/zavorthControl/review/') {
      if (!this.shouldServeZavorthControlReviewRoute()) {
        this.redirectToControl(res);
        return true;
      }
      this.writeInline(res, this.readZavorthControlReviewHtml(), 'text/html; charset=utf-8');
      return true;
    }

    if (pathname === '/app.js') {
      writeJson(res, { error: 'Not found' }, 404);
      return true;
    }

    if (pathname === '/styles.css') {
      writeJson(res, { error: 'Not found' }, 404);
      return true;
    }

    if (
      pathname.startsWith('/styles/')
      || pathname.startsWith('/scripts/')
      || pathname.startsWith('/assets/')
    ) {
      const staticAsset = this.readZavorthControlAsset(pathname);
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

  private shouldServeZavorthControlReviewRoute(): boolean {
    return this.isDevelopmentOrTestRuntime()
      && this.isTruthyFlag(process.env.ZAVORTH_COMMAND_CENTER_REVIEW_ENABLED);
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

  private readZavorthControlReviewHtml(): string {
    const explicitPath = String(process.env.ZAVORTH_COMMAND_CENTER_REVIEW_HTML || '').trim();
    const candidates = [
      explicitPath ? path.resolve(explicitPath) : null,
      this.zavorthControlReviewHtmlPath,
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return fs.readFileSync(candidate, 'utf8');
      }
    }

    return this.buildZavorthControlReviewFallbackHtml();
  }

  private readZavorthControlShellHtml(): string {
    const shellPath = path.join(this.zavorthControlShellDir, 'index.html');
    if (fs.existsSync(shellPath)) {
      return fs.readFileSync(shellPath, 'utf8');
    }
    return this.readZavorthControlReviewHtml();
  }

  private readZavorthControlAsset(
    pathname: string,
  ): { content: string | Buffer; contentType: string } | null {
    const normalizedPath = pathname.replace(/^\/+/, '').replace(/\//g, path.sep);
    const candidate = path.resolve(this.zavorthControlShellDir, normalizedPath);
    if (!candidate.startsWith(this.zavorthControlShellDir + path.sep) || !fs.existsSync(candidate)) {
      return null;
    }
    const stat = fs.statSync(candidate);
    if (!stat.isFile()) {
      return null;
    }
    return {
      content: fs.readFileSync(candidate),
      contentType: this.resolveZavorthControlAssetContentType(candidate),
    };
  }

  private resolveZavorthControlAssetContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.css') return 'text/css; charset=utf-8';
    if (ext === '.js') return 'application/javascript; charset=utf-8';
    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.svg') return 'image/svg+xml';
    if (ext === '.webp') return 'image/webp';
    return 'application/octet-stream';
  }

  private buildZavorthControlReviewFallbackHtml(): string {
    return `<!doctype html>
<html lang="en-US">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Zavorth ZavorthControl Review</title>
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
      <span class="tag">ZavorthControl Review</span>
      <h1>The visual review bench has not been generated yet.</h1>
      <p>This route is internal and only reads HTML generated by the official fixture bench.</p>
      <p>Run <code>npm run zavorthControl:preview -- --fixture=safe-run</code> and reload <code>/zavorthControl/review?fixture=awaiting-approval</code>.</p>
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
      Location: '/zavorthControl',
      'Cache-Control': 'no-store',
    });
    res.end();
  }
}
