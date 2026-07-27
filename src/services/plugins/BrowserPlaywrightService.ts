import fs from 'fs';
import os from 'os';
import path from 'path';
import { logger } from '../../logger.js';
export interface BrowserPage {
  url: string;
  title: string;
  content: string;
  screenshot_path: string | null;
  status: number;
  load_time_ms: number;
}

export interface BrowserAction {
  type: 'click' | 'type' | 'scroll' | 'wait' | 'screenshot' | 'navigate' | 'evaluate' | 'fill_form' | 'select' | 'hover' | 'press_key';
  selector?: string;
  value?: string;
  url?: string;
  key?: string;
  x?: number;
  y?: number;
}

export class BrowserPlaywrightService {
  private readonly storageDir: string;
  private readonly defaultTimeout = 30000;
  private sessions: Map<string, { id: string; created_at: string; actions: number }> = new Map();

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'playwright');
    this.ensureStorageDir();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private jsLiteral(value: unknown): string {
    return JSON.stringify(value);
  }

  private assertHttpUrl(url: string): string | null {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return `Error: unsupported URL protocol "${parsed.protocol}".`;
      }
      return null;
    } catch (error: unknown) {logger.warn('[Browser Playwright] network request failed', error); return ''; }
  }

  private cleanupTempScript(tmpScript: string): void {
    try {
      fs.unlinkSync(tmpScript);
    } catch (error: unknown) {// Best-effort cleanup only; execution errors are reported separately.
      logger.warn('[Browser Playwright] file cleanup failed', error);
    }
  }

  public async navigate(url: string, options?: { wait_until?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number }): Promise<string> {
    if (!url) return 'Error: URL is required.';
    const urlError = this.assertHttpUrl(url);
    if (urlError) return urlError;

    const waitUntil = options?.wait_until || 'load';
    const timeout = options?.timeout || this.defaultTimeout;
    const urlLiteral = this.jsLiteral(url);
    const waitUntilLiteral = this.jsLiteral(waitUntil);
    const screenshotLiteral = this.jsLiteral(path.join(this.storageDir, `screenshot_${Date.now()}.png`));

    try {
      const { execFileSync } = await import('child_process');
      const script = `
        const { chromium } = require('playwright');
        (async () => {
          const browser = await chromium.launch({ headless: true });
          const page = await browser.newPage();
          const start = Date.now();
          const targetUrl = ${urlLiteral};
          await page.goto(targetUrl, { waitUntil: ${waitUntilLiteral}, timeout: ${timeout} });
          const title = await page.title();
          const content = (await page.content()).slice(0, 5000);
          const screenshot = ${screenshotLiteral};
          await page.screenshot({ path: screenshot, fullPage: false });
          console.log(JSON.stringify({ url: targetUrl, title, content_length: content.length, screenshot, status: 200, load_time_ms: Date.now() - start }));
          await browser.close();
        })().catch((error) => {
          logger.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
          process.exitCode = 1;
        });
      `;

      const tmpScript = path.join(os.tmpdir(), `pw_nav_${Date.now()}.js`);
      fs.writeFileSync(tmpScript, script);
      try {
        const result = execFileSync('node', [tmpScript], { timeout: timeout + 5000, maxBuffer: 10 * 1024 * 1024 }).toString();
        this.cleanupTempScript(tmpScript);
        const parsed = JSON.parse(result);
        if (parsed.error) return `Playwright error: ${parsed.error}`;
        return `Pagina loaded: "${parsed.title}" (${parsed.load_time_ms}ms)\nURL: ${parsed.url}\nScreenshot: ${parsed.screenshot}\nConteudo: ${parsed.content_length} characters`;
      } catch (error: unknown) { this.cleanupTempScript(tmpScript);
        throw error;
      }
    } catch (error: unknown) {logger.warn('[Browser Playwright] JSON parse failed', error); return ''; }
  }

  public async screenshot(url: string, options?: { full_page?: boolean; selector?: string }): Promise<string> {
    if (!url) return 'Error: URL is required.';
    const urlError = this.assertHttpUrl(url);
    if (urlError) return urlError;
    const timeout = this.defaultTimeout;
    const fullPage = options?.full_page || false;
    const selector = options?.selector;

    try {
      const { execFileSync } = await import('child_process');
      const screenshotPath = path.join(this.storageDir, `screenshot_${Date.now()}.png`);
      const screenshotLiteral = this.jsLiteral(screenshotPath);
      const urlLiteral = this.jsLiteral(url);

      let captureCode = `await page.screenshot({ path: outputPath, fullPage: ${fullPage} })`;
      if (selector) {
        captureCode = `await page.locator(${this.jsLiteral(selector)}).screenshot({ path: outputPath })`;
      }

      const script = `
        const { chromium } = require('playwright');
        (async () => {
          const browser = await chromium.launch({ headless: true });
          const page = await browser.newPage();
          const targetUrl = ${urlLiteral};
          const outputPath = ${screenshotLiteral};
          await page.goto(targetUrl, { waitUntil: 'load', timeout: ${timeout} });
          ${captureCode};
          console.log(JSON.stringify({ screenshot: outputPath, url: targetUrl }));
          await browser.close();
        })().catch((error) => {
          logger.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
          process.exitCode = 1;
        });
      `;

      const tmpScript = path.join(os.tmpdir(), `pw_ss_${Date.now()}.js`);
      fs.writeFileSync(tmpScript, script);
      try {
        const result = execFileSync('node', [tmpScript], { timeout: timeout + 5000 }).toString();
        this.cleanupTempScript(tmpScript);
        const parsed = JSON.parse(result);
        if (parsed.error) return `Error: ${parsed.error}`;
        return `Screenshot salvo: ${parsed.screenshot}`;
      } catch (error: unknown) { this.cleanupTempScript(tmpScript);
        throw error;
      }
    } catch (error: unknown) {logger.warn('[Browser Playwright] JSON parse failed', error); return ''; }
  }

  public async extract(url: string, selectors: Record<string, string>): Promise<string> {
    if (!url) return 'Error: URL is required.';
    const urlError = this.assertHttpUrl(url);
    if (urlError) return urlError;
    const timeout = this.defaultTimeout;

    try {
      const { execFileSync } = await import('child_process');
      const selectorsJson = JSON.stringify(selectors);
      const urlLiteral = this.jsLiteral(url);

      const script = `
        const { chromium } = require('playwright');
        const selectors = ${selectorsJson};
        (async () => {
          const browser = await chromium.launch({ headless: true });
          const page = await browser.newPage();
          const targetUrl = ${urlLiteral};
          await page.goto(targetUrl, { waitUntil: 'load', timeout: ${timeout} });
          const result = {};
          for (const [key, sel] of Object.entries(selectors)) {
            try {
              const els = await page.locator(sel).all();
              result[key] = await Promise.all(els.map(el => el.textContent()));
            } catch (error: unknown) {result[key] = [];
            }
          }
          console.log(JSON.stringify(result));
          await browser.close();
        })().catch((error) => {
          logger.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
          process.exitCode = 1;
        });
      `;

      const tmpScript = path.join(os.tmpdir(), `pw_ext_${Date.now()}.js`);
      fs.writeFileSync(tmpScript, script);
      try {
        const result = execFileSync('node', [tmpScript], { timeout: timeout + 5000, maxBuffer: 10 * 1024 * 1024 }).toString();
        this.cleanupTempScript(tmpScript);
        const parsed = JSON.parse(result);
        if (parsed.error) return `Error: ${parsed.error}`;

        const lines: string[] = [`Extraido de ${url}:`];
        for (const [key, values] of Object.entries(parsed)) {
          const items = values as string[];
          lines.push(`  ${key}: ${items.length} elementos`);
          for (const v of items.slice(0, 5)) {
            lines.push(`    - ${(v || '').slice(0, 100)}`);
          }
        }
        return lines.join('\n');
      } catch (error: unknown) { this.cleanupTempScript(tmpScript);
        throw error;
      }
    } catch (error: unknown) {logger.warn('[Browser Playwright] parsing failed', error); return ''; }
  }

  public async pdf(url: string, outputPath?: string): Promise<string> {
    if (!url) return 'Error: URL is required.';
    const urlError = this.assertHttpUrl(url);
    if (urlError) return urlError;
    const timeout = this.defaultTimeout;
    const pdfPath = outputPath || path.join(this.storageDir, `page_${Date.now()}.pdf`);
    const pdfPathLiteral = this.jsLiteral(pdfPath);
    const urlLiteral = this.jsLiteral(url);

    try {
      const { execFileSync } = await import('child_process');
      const script = `
        const { chromium } = require('playwright');
        (async () => {
          const browser = await chromium.launch({ headless: true });
          const page = await browser.newPage();
          const targetUrl = ${urlLiteral};
          const pdfPath = ${pdfPathLiteral};
          await page.goto(targetUrl, { waitUntil: 'load', timeout: ${timeout} });
          await page.pdf({ path: pdfPath, format: 'A4' });
          console.log(JSON.stringify({ pdf: pdfPath, url: targetUrl }));
          await browser.close();
        })().catch((error) => {
          logger.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
          process.exitCode = 1;
        });
      `;

      const tmpScript = path.join(os.tmpdir(), `pw_pdf_${Date.now()}.js`);
      fs.writeFileSync(tmpScript, script);
      try {
        const result = execFileSync('node', [tmpScript], { timeout: timeout + 10000 }).toString();
        this.cleanupTempScript(tmpScript);
        const parsed = JSON.parse(result);
        if (parsed.error) return `Error: ${parsed.error}`;
        return `Generated PDF: ${parsed.pdf}`;
      } catch (error: unknown) { this.cleanupTempScript(tmpScript);
        throw error;
      }
    } catch (error: unknown) {logger.warn('[Browser Playwright] JSON parse failed', error); return ''; }
  }

  public getStats(): string {
    const screenshots = fs.readdirSync(this.storageDir).filter((f) => f.startsWith('screenshot_')).length;
    return [
      'Playwright Stats:',
      `  Screenshots salvos: ${screenshots}`,
      `  Storage: ${this.storageDir}`,
    ].join('\n');
  }
}
