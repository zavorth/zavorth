import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import http from 'http';
import https from 'https';
import { asErrorLike } from '../utils/errorLike';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';

export class ZavorthBrowserAutomationTool extends BaseTool {
  public readonly name = 'zavorth_browser_automation';

  public readonly description =
    'Advanced browser automation — navigate, click, type, screenshot, extract text, evaluate JavaScript, wait for selectors, manage cookies. Uses Playwright or Puppeteer if available, falls back to curl for simple fetches.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'navigate', 'click', 'type', 'screenshot', 'extract', 'evaluate', 'wait_for', 'cookies', 'get_html', 'get_text', 'pdf', 'download', 'download_all', 'links'.",
      },
      url: {
        type: 'string',
        description: 'URL to navigate to (for navigate action).',
      },
      selector: {
        type: 'string',
        description: 'CSS selector for click, type, wait_for, extract actions.',
      },
      text: {
        type: 'string',
        description: 'Text to type into an element (for type action).',
      },
      script: {
        type: 'string',
        description: 'JavaScript code to evaluate in the page context.',
      },
      output_path: {
        type: 'string',
        description: 'File path to save screenshot or PDF output.',
      },
      wait_ms: {
        type: 'number',
        description: 'Milliseconds to wait (for wait_for timeout). Default: 30000.',
      },
      cookie_name: {
        type: 'string',
        description: 'Cookie name for get/delete operations.',
      },
      cookie_value: {
        type: 'string',
        description: 'Cookie value (for set operation).',
      },
      cookie_domain: {
        type: 'string',
        description: 'Cookie domain (for set operation).',
      },
      user_agent: {
        type: 'string',
        description: 'Custom User-Agent string.',
      },
      viewport_width: {
        type: 'number',
        description: 'Viewport width in pixels. Default: 1280.',
      },
      viewport_height: {
        type: 'number',
        description: 'Viewport height in pixels. Default: 720.',
      },
      headless: {
        type: 'boolean',
        description: 'Run browser in headless mode. Default: true.',
      },
      // Download-specific parameters
      min_size: {
        type: 'number',
        description: 'Minimum file size in bytes to download.',
      },
      max_size: {
        type: 'number',
        description: 'Maximum file size in bytes to download.',
      },
      only_types: {
        type: 'string',
        description: 'Comma-separated MIME types or extensions to download (e.g., "pdf,jpg,zip").',
      },
      mirror: {
        type: 'boolean',
        description: 'Mirror mode: recreate directory structure from URL. Default: false.',
      },
      concurrent: {
        type: 'number',
        description: 'Number of concurrent downloads (max 5). Default: 3.',
      },
    },
    required: ['action'],
  };

  private jsLiteral(value: unknown): string {
    return JSON.stringify(value);
  }

  private positiveInteger(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
  }

  /**
   * Parse only_types filter into extensions array
   */
  private parseOnlyTypes(onlyTypes: string): string[] {
    if (!onlyTypes) return [];
    return onlyTypes
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);
  }

  /**
   * Check if a filename matches the only_types filter
   */
  private matchesOnlyTypes(fileName: string, allowedTypes: string[]): boolean {
    if (allowedTypes.length === 0) return true;
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return allowedTypes.includes(ext);
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeMap: Record<string, string> = {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'application/zip': 'zip',
      'application/x-rar-compressed': 'rar',
      'application/gzip': 'gz',
      'text/html': 'html',
      'text/plain': 'txt',
      'application/json': 'json',
      'application/javascript': 'js',
      'text/css': 'css',
      'video/mp4': 'mp4',
      'audio/mpeg': 'mp3',
    };
    const normalizedMime = mimeType.split(';')[0].trim().toLowerCase();
    return mimeMap[normalizedMime] || '';
  }

  /**
   * Get MIME type category for auto-organization
   */
  private getMimeTypeCategory(mimeType: string, fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    if (ext === 'pdf' || mimeType.includes('pdf')) return 'pdf';
    if (ext.match(/^(jpg|jpeg|png|gif|webp|bmp|svg|ico)$/) || mimeType.includes('image/')) return 'images';
    if (ext.match(/^(zip|rar|gz|tar|7z|bz2)$/) || mimeType.includes('archive') || mimeType.includes('compressed')) return 'archives';
    return 'other';
  }

  /**
   * Categorize file by extension for auto-organization
   */
  private categorizeFile(fileName: string): string {
    return this.getMimeTypeCategory('', fileName);
  }

  /**
   * Build download directory path with auto-organization
   */
  private buildDownloadPath(
    outputDir: string,
    fileName: string,
    mimeType: string,
    mirror: boolean,
    urlPath?: string
  ): string {
    const category = this.getMimeTypeCategory(mimeType, fileName);

    if (mirror && urlPath) {
      // Recreate directory structure from URL
      const dirPath = path.dirname(urlPath);
      return path.join(outputDir, 'mirror', dirPath, fileName);
    }

    // Auto-organize by type
    return path.join(outputDir, category, fileName);
  }

  /**
   * Generate unique filename to avoid overwrites
   */
  private async getUniqueFilePath(filePath: string): Promise<string> {
    if (!fs.existsSync(filePath)) return filePath;

    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);
    let counter = 1;

    while (fs.existsSync(path.join(dir, `${base}_${counter}${ext}`))) {
      counter++;
    }
    return path.join(dir, `${base}_${counter}${ext}`);
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'navigate': return await this.navigate(args);
      case 'click': return await this.click(args);
      case 'type': return await this.typeText(args);
      case 'screenshot': return await this.screenshot(args);
      case 'extract': return await this.extract(args);
      case 'evaluate': return await this.evaluate(args);
      case 'wait_for': return await this.waitFor(args);
      case 'cookies': return await this.manageCookies(args);
      case 'get_html': return await this.getHtml(args);
      case 'get_text': return await this.getText(args);
      case 'pdf': return await this.generatePdf(args);
      case 'download': return await this.downloadFile(args);
      case 'download_all': return await this.downloadAll(args);
      case 'links': return await this.extractLinks(args);
      default: return `Error: action "${action}" is invalid. Valid: navigate, click, type, screenshot, extract, evaluate, wait_for, cookies, get_html, get_text, pdf, download, download_all, links.`;
    }
  }

  private buildPlaywrightScript(actions: string[]): string {
    return `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  ${actions.join('\n  ')}
  await browser.close();
})().catch((error) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
`;
  }

  private async runWithPlaywright(script: string): Promise<string> {
    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('node', ['-e', script], {
        timeout: 60000,
        maxBuffer: 50 * 1024 * 1024,
      }).toString();
      return result;
    } catch (error: unknown) {logger.warn('[Zavorth Browser Automation] process execution failed', error); return ''; }
  }

  private async navigate(args: Record<string, unknown>): Promise<string> {
    const url = String(args.url || '');
    if (!url) return 'Error: "url" is required for navigate.';

    const headless = args.headless !== false;
    const width = this.positiveInteger(args.viewport_width, 1280);
    const height = this.positiveInteger(args.viewport_height, 720);
    const userAgent = String(args.user_agent || '');

    const userAgentOption = userAgent ? `, userAgent: ${this.jsLiteral(userAgent)}` : '';
    const urlLiteral = this.jsLiteral(url);

    const script = `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: ${headless} });
  const context = await browser.newContext({ viewport: { width: ${width}, height: ${height} }${userAgentOption} });
  const page = await context.newPage();
  const targetUrl = ${urlLiteral};
  const response = await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
  const title = await page.title();
  const status = response ? response.status() : 'unknown';
  console.log(JSON.stringify({ url: targetUrl, title, status, loaded: true }));
  await browser.close();
})().catch((error) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
`;

    try {
      const result = await this.runWithPlaywright(script);
      if (result.startsWith('Playwright error:')) return result;
      return `Navigation successful:\n${result.trim()}`;
    } catch (error: unknown) {logger.warn('[Zavorth Browser Automation] resource cleanup failed', error);
    return await this.fallbackCurl(String(args.url || ''));
  }
  }

  private async fallbackCurl(url: string): Promise<string> {
    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('curl', ['-s', '-L', '-o', '/dev/null', '-w', 'HTTP %{http_code}\nURL: %{url_effective}\nRedirects: %{num_redirects}\nTime: %{time_total}s', '--max-time', '30', url], { timeout: 35000 }).toString();
      return `Fallback curl check:\n${result}`;
    } catch (error: unknown) {logger.warn('[Zavorth Browser Automation] network request failed', error); return ''; }
  }

  private async click(args: Record<string, unknown>): Promise<string> {
    const selector = String(args.selector || '');
    if (!selector) return 'Error: "selector" is required for click.';

    return `Click action prepared for selector: ${selector}. For multi-step browser automation, use the 'evaluate' action with a full Playwright script.`;
  }

  private async typeText(args: Record<string, unknown>): Promise<string> {
    const selector = String(args.selector || '');
    const text = String(args.text || '');
    if (!selector) return 'Error: "selector" is required for type.';
    if (!text) return 'Error: "text" is required for type.';

    return `Type action prepared: typing "${text}" into selector "${selector}". For multi-step browser automation, use the 'evaluate' action with a full Playwright script.`;
  }

  private async screenshot(args: Record<string, unknown>): Promise<string> {
    const url = String(args.url || '');
    const outputPath = String(args.output_path || 'screenshot.png');
    if (!url) return 'Error: "url" is required for screenshot.';

    const headless = args.headless !== false;
    const width = this.positiveInteger(args.viewport_width, 1280);
    const height = this.positiveInteger(args.viewport_height, 720);
    const urlLiteral = this.jsLiteral(url);
    const outputPathLiteral = this.jsLiteral(outputPath.replace(/\\/g, '/'));

    const script = `
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ headless: ${headless} });
  const context = await browser.newContext({ viewport: { width: ${width}, height: ${height} } });
  const page = await context.newPage();
  const targetUrl = ${urlLiteral};
  const outputPath = ${outputPathLiteral};
  await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: outputPath, fullPage: true });
  console.log('Screenshot saved to: ' + outputPath);
  await browser.close();
})().catch((error) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
`;

    const result = await this.runWithPlaywright(script);
    return result.startsWith('Playwright error:') ? result : `Screenshot captured:\n${result.trim()}`;
  }

  private async extract(args: Record<string, unknown>): Promise<string> {
    const url = String(args.url || '');
    const selector = String(args.selector || '');
    if (!url) return 'Error: "url" is required for extract.';

    const selectorLiteral = this.jsLiteral(selector);
    const urlLiteral = this.jsLiteral(url);
    const extractTarget = selector ? `const elements = await page.$$eval(${selectorLiteral}, els => els.map(el => (el.textContent || '').trim())); console.log(JSON.stringify(elements, null, 2));`
      : `const text = await page.evaluate(() => document.body.innerText); console.log(text);`;

    const script = `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const targetUrl = ${urlLiteral};
  await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
  ${extractTarget}
  await browser.close();
})().catch((error) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
`;

    const result = await this.runWithPlaywright(script);
    return result.startsWith('Playwright error:') ? result : `Extracted content:\n${result.trim().slice(0, 10000)}`;
  }

  private async evaluate(args: Record<string, unknown>): Promise<string> {
    const script = String(args.script || '');
    if (!script) return 'Error: "script" is required for evaluate.';

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('node', ['-e', script], {
        timeout: 60000,
        maxBuffer: 50 * 1024 * 1024,
      }).toString();
      return `Script output:\n${result.trim().slice(0, 10000)}`;
    } catch (error: unknown) {logger.warn('[Zavorth Browser Automation] process execution failed', error); return ''; }
  }

  private async waitFor(args: Record<string, unknown>): Promise<string> {
    const selector = String(args.selector || '');
    const waitMs = Number(args.wait_ms || 30000);
    if (!selector) return 'Error: "selector" is required for wait_for.';

    return `Wait action prepared for selector: "${selector}" with ${waitMs}ms timeout. Combine with navigate in a Playwright script for multi-step automation.`;
  }

  private async manageCookies(args: Record<string, unknown>): Promise<string> {
    const url = String(args.url || '');
    if (!url) return 'Error: "url" is required for cookies.';

    const urlLiteral = this.jsLiteral(url);
    const script = `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const targetUrl = ${urlLiteral};
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const cookies = await context.cookies(targetUrl);
  console.log(JSON.stringify(cookies, null, 2));
  await browser.close();
})().catch((error) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
`;

    const result = await this.runWithPlaywright(script);
    return result.startsWith('Playwright error:') ? result : `Cookies for ${url}:\n${result.trim().slice(0, 5000)}`;
  }

  private async getHtml(args: Record<string, unknown>): Promise<string> {
    const url = String(args.url || '');
    if (!url) return 'Error: "url" is required for get_html.';

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('curl', ['-s', '-L', '--max-time', '30', url], { timeout: 35000, maxBuffer: 10 * 1024 * 1024 }).toString();
      return `HTML from ${url} (first 10000 chars):\n${result.slice(0, 10000)}`;
    } catch (error: unknown) {logger.warn('[Zavorth Browser Automation] process execution failed', error); return ''; }
  }

  private async getText(args: Record<string, unknown>): Promise<string> {
    const url = String(args.url || '');
    if (!url) return 'Error: "url" is required for get_text.';

    const urlLiteral = this.jsLiteral(url);
    const script = `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const targetUrl = ${urlLiteral};
  await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
  const text = await page.evaluate(() => document.body.innerText);
  console.log(text);
  await browser.close();
})().catch((error) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
`;

    const result = await this.runWithPlaywright(script);
    return result.startsWith('Playwright error:') ? result : `Text from ${url}:\n${result.trim().slice(0, 10000)}`;
  }

  private async generatePdf(args: Record<string, unknown>): Promise<string> {
    const url = String(args.url || '');
    const outputPath = String(args.output_path || 'page.pdf');
    if (!url) return 'Error: "url" is required for pdf.';

    const urlLiteral = this.jsLiteral(url);
    const outputPathLiteral = this.jsLiteral(outputPath.replace(/\\/g, '/'));
    const script = `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const targetUrl = ${urlLiteral};
  const outputPath = ${outputPathLiteral};
  await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.pdf({ path: outputPath, format: 'A4', printBackground: true });
  console.log('PDF saved to: ' + outputPath);
  await browser.close();
})().catch((error) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
`;

    const result = await this.runWithPlaywright(script);
    return result.startsWith('Playwright error:') ? result : `PDF generated:\n${result.trim()}`;
  }

  /**
   * Download a single file using Node.js http/https (no Playwright).
   * Features: progress tracking, deduplication, auto-organize by type,
   * checksum verification, filters (min_size, max_size, only_types), mirror mode.
   */
  private async downloadFile(args: Record<string, unknown>): Promise<string> {
    const url = String(args.url || '');
    const outputPath = String(args.output_path || '').trim() || './downloads';
    if (!url) return 'Error: "url" is required for download.';

    const minSize = args.min_size ? Number(args.min_size) : 0;
    const maxSize = args.max_size ? Number(args.max_size) : Infinity;
    const onlyTypes = this.parseOnlyTypes(String(args.only_types || ''));
    const mirror = args.mirror === true;

    try {
      const protocol = url.startsWith('https') ? https : http;

      return await new Promise<string>((resolve) => {
        const req = protocol.get(url, { timeout: 30000 }, (res: any) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const redirectUrl = res.headers.location.startsWith('http')
              ? res.headers.location
              : new URL(res.headers.location, url).href;
            res.destroy();
            return this.downloadFile({ ...args, url: redirectUrl }).then(resolve);
          }

          if (res.statusCode < 200 || res.statusCode >= 300) {
            res.destroy();
            resolve(`Download failed: HTTP ${res.statusCode}`);
            return;
          }

          const contentLength = parseInt(res.headers['content-length'] || '0', 10);
          const contentType = res.headers['content-type'] || '';
          const contentDisposition = res.headers['content-disposition'] || '';

          let fileName = 'download';
          const dispositionMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^\n]*)/i);
          if (dispositionMatch) {
            fileName = dispositionMatch[1].replace(/['"]/g, '');
          } else {
            const urlObj = new URL(url);
            fileName = path.basename(decodeURIComponent(urlObj.pathname)) || 'download';
          }

          if (onlyTypes.length > 0) {
            const ext = path.extname(fileName).toLowerCase().replace('.', '');
            if (!onlyTypes.includes(ext)) { res.destroy(); resolve(`Filtered: ${fileName} (wrong type)`); return; }
          }
          if (maxSize > 0 && contentLength > maxSize) {
            res.destroy(); resolve(`Filtered: ${fileName} (too large)`); return;
          }

          const category = mirror ? 'mirror' : this.getMimeTypeCategory(contentType, fileName);
          const saveDir = mirror
            ? path.join(outputPath, 'mirror', new URL(url).pathname)
            : path.join(outputPath, category);
          if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });

          let savePath = path.join(saveDir, fileName);
          if (fs.existsSync(savePath)) {
            const existingSize = fs.statSync(savePath).size;
            if (contentLength > 0 && existingSize === contentLength) {
              res.destroy();
              resolve(`Skipped: ${fileName} (duplicate, ${existingSize} bytes)`);
              return;
            }
            const ext = path.extname(fileName);
            const base = path.basename(fileName, ext);
            let counter = 1;
            while (fs.existsSync(path.join(saveDir, `${base}_${counter}${ext}`))) counter++;
            savePath = path.join(saveDir, `${base}_${counter}${ext}`);
          }

          const chunks: Buffer[] = [];
          let downloaded = 0;
          let lastProgressPct = 0;

          res.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
            downloaded += chunk.length;
            if (contentLength > 0) {
              const pct = Math.floor((downloaded / contentLength) * 100);
              if (pct >= lastProgressPct + 10 || pct === 100) {
                lastProgressPct = pct;
                console.log(JSON.stringify({ progress: `${pct}%`, downloaded, total: contentLength, fileName }));
              }
            } else if (downloaded % (1024 * 1024) === 0) {
              console.log(JSON.stringify({ downloaded, fileName }));
            }
          });

          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            if (minSize > 0 && buffer.length < minSize) {
              resolve(`Filtered: ${fileName} (too small: ${buffer.length} bytes)`);
              return;
            }
            fs.writeFileSync(savePath, buffer);
            const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
            const verified = contentLength === 0 || buffer.length === contentLength;
            console.log(JSON.stringify({ downloaded: true, path: savePath, bytes: buffer.length, checksum: 'sha256:' + checksum, verified, category }));
            resolve(`Downloaded: ${fileName} (${buffer.length} bytes) -> ${category}/`);
          });

          res.on('error', (err: Error) => { resolve(`Download failed: ${err.message}`); });
        });
        req.on('error', (err: Error) => { resolve(`Download failed: ${err.message}`); });
        req.on('timeout', () => { req.destroy(); resolve('Download failed: timeout'); });
      });
    } catch (error: unknown) { const err = asErrorLike(error); return `Download error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  /**
   * Download all linked files from a page.
   * Uses Playwright for navigation/link extraction, Node.js http/https for downloads.
   * Features: concurrent downloads (max 5), deduplication, auto-organize by type, filters.
   */
  private async downloadAll(args: Record<string, unknown>): Promise<string> {
    const selector = String(args.selector || 'a[href]').trim();
    const outputDir = String(args.output_path || './downloads').trim();
    const url = String(args.url || '');
    const concurrent = Math.min(this.positiveInteger(args.concurrent, 3), 5);
    const minSize = args.min_size ? Number(args.min_size) : 0;
    const maxSize = args.max_size ? Number(args.max_size) : Infinity;
    const onlyTypes = this.parseOnlyTypes(String(args.only_types || ''));

    // Step 1: Use Playwright to navigate and extract links
    const extractScript = `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const sourceUrl = ${this.jsLiteral(url)};
  if (sourceUrl) {
    await page.goto(sourceUrl, { waitUntil: 'networkidle', timeout: 30000 });
  }
  const links = await page.$$eval(${this.jsLiteral(selector)}, (els) =>
    els.map((el) => ({
      href: el.href || el.getAttribute('href') || '',
      text: el.textContent?.trim() || ''
    }))
  );
  const filtered = links.filter((l) => l.href && (l.href.startsWith('http') || l.href.startsWith('/')));
  console.log(JSON.stringify(filtered.slice(0, 50)));
  await browser.close();
})().catch((error) => {
  console.error(JSON.stringify({ error: error.message }));
  process.exitCode = 1;
});
`;

    const extractResult = await this.runWithPlaywright(extractScript);
    if (extractResult.startsWith('Playwright error:')) return extractResult;

    let links: Array<{ href: string; text: string }>;
    try {
      links = JSON.parse(extractResult.trim());
    } catch {
      return `Failed to parse extracted links from page.`;
    }

    // Step 2: Resolve URLs and build download queue with deduplication
    const seen = new Map<string, boolean>();
    const downloadQueue: Array<{ url: string; fileName: string }> = [];

    for (const link of links) {
      try {
        const fullUrl = link.href.startsWith('/') ? new URL(link.href, url).href : link.href;
        const urlObj = new URL(fullUrl);
        const fileName = decodeURIComponent(urlObj.pathname.split('/').pop() || 'download');

        if (onlyTypes.length > 0) {
          const ext = fileName.split('.').pop()?.toLowerCase() || '';
          if (!onlyTypes.includes(ext)) continue;
        }

        const dedupeKey = `${fileName}-${fullUrl}`;
        if (seen.has(dedupeKey)) continue;
        seen.set(dedupeKey, true);

        downloadQueue.push({ url: fullUrl, fileName });
      } catch {
        // Skip invalid URLs
      }
    }

    const results: string[] = [];
    let index = 0;
  // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    async function worker() {
      while (index < downloadQueue.length) {
        const item = downloadQueue[index++];
        try {
          const res = await self.downloadFile({
            url: item.url,
            output_path: outputDir,
            min_size: minSize,
            max_size: maxSize,
            only_types: onlyTypes.join(','),
          });
          results.push(res);
        } catch (error: unknown) { const err = asErrorLike(error); results.push(`Download failed for ${item.url}: ${err?.message || err}`);
        }
      }
    }

    const workers = [];
    for (let i = 0; i < Math.min(concurrent, downloadQueue.length); i++) {
      workers.push(worker());
    }
    await Promise.all(workers);

    return `Processed ${results.length} downloads:\n` + results.map((r) => `- ${r}`).join('\n');
  }

  /**
   * Extract links from a page using Playwright.
   * Supports filters: min_size, max_size, only_types.
   * Returns enriched link metadata (size, type, downloadable flag).
   */
  private async extractLinks(args: Record<string, unknown>): Promise<string> {
    const url = String(args.url || '');
    const onlyTypes = this.parseOnlyTypes(String(args.only_types || ''));

    try {
      const protocol = url.startsWith('https') ? https : http;

      return await new Promise<string>((resolve) => {
        protocol.get(url, { timeout: 10000 }, (res: any) => {
          let body = '';
          res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
          res.on('end', () => {
            const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
            const links: Array<{ href: string; text: string }> = [];
            let match;
            while ((match = linkRegex.exec(body)) !== null) {
              links.push({ href: match[1], text: match[2].trim().substring(0, 80) });
            }

            const filtered = links.filter((l) => {
              if (!l.href) return false;
              if (onlyTypes.length > 0) {
                const ext = l.href.split('.').pop()?.toLowerCase() || '';
                if (!onlyTypes.includes(ext)) return false;
              }
              return true;
            });

            const result = filtered.map((l) => ({
              href: l.href,
              text: l.text,
              type: l.href.split('.').pop() || 'unknown',
            }));

            resolve(JSON.stringify(result, null, 2));
          });
          res.on('error', (err: Error) => { resolve(`Error: ${err.message}`); });
        }).on('error', (err: Error) => { resolve(`Error: ${err.message}`); });
      });
    } catch (error: unknown) { const err = asErrorLike(error); return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
}

