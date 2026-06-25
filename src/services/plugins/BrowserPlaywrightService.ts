import { logger } from '../../logger.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

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

  public async navigate(url: string, options?: { wait_until?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number }): Promise<string> {
    if (!url) return 'Error: URL is required.';
    try { new URL(url); } catch { return `Error: invalid URL "${url}".`; }

    const waitUntil = options?.wait_until || 'load';
    const timeout = options?.timeout || this.defaultTimeout;

    try {
      const { execFileSync } = await import('child_process');
      const script = `
        const { chromium } = require('playwright');
        (async () => {
          const browser = await chromium.launch({ headless: true });
          const page = await browser.newPage();
          const start = Date.now();
          await page.goto('${url}', { waitUntil: '${waitUntil}', timeout: ${timeout} });
          const title = await page.title();
          const content = (await page.content()).slice(0, 5000);
          const screenshot = '${path.join(this.storageDir, `screenshot_${Date.now()}.png`).replace(/\\/g, '\\\\')}';
          await page.screenshot({ path: screenshot, fullPage: false });
          logger.info(JSON.stringify({ url: '${url}', title, content_length: content.length, screenshot, status: 200, load_time_ms: Date.now() - start }));
          await browser.close();
        })().catch(e => { logger.info(JSON.stringify({ error: e.message })); process.exit(1); });
      `;

      const tmpScript = path.join(os.tmpdir(), `pw_nav_${Date.now()}.js`);
      fs.writeFileSync(tmpScript, script);
      try {
        const result = execFileSync('node', [tmpScript], { timeout: timeout + 5000, maxBuffer: 10 * 1024 * 1024 }).toString();
        fs.unlinkSync(tmpScript);
        const parsed = JSON.parse(result);
        if (parsed.error) return `Playwright error: ${parsed.error}`;
        return `Pagina carregada: "${parsed.title}" (${parsed.load_time_ms}ms)\nURL: ${parsed.url}\nScreenshot: ${parsed.screenshot}\nConteudo: ${parsed.content_length} characters`;
      } catch (e) {
        try { fs.unlinkSync(tmpScript); } catch { /* ignore */ }
        throw e;
      }
    } catch (error: unknown) {
      return `Error navigating: ${error instanceof Error ? error.message : String(error)}. Playwright installed? npm install playwright`;
    }
  }

  public async screenshot(url: string, options?: { full_page?: boolean; selector?: string }): Promise<string> {
    const timeout = this.defaultTimeout;
    const fullPage = options?.full_page || false;
    const selector = options?.selector;

    try {
      const { execFileSync } = await import('child_process');
      const screenshotPath = path.join(this.storageDir, `screenshot_${Date.now()}.png`).replace(/\\/g, '\\\\');

      let captureCode = `await page.screenshot({ path: '${screenshotPath}', fullPage: ${fullPage} })`;
      if (selector) {
        captureCode = `await page.locator('${selector}').screenshot({ path: '${screenshotPath}' })`;
      }

      const script = `
        const { chromium } = require('playwright');
        (async () => {
          const browser = await chromium.launch({ headless: true });
          const page = await browser.newPage();
          await page.goto('${url}', { waitUntil: 'load', timeout: ${timeout} });
          ${captureCode};
          logger.info(JSON.stringify({ screenshot: '${screenshotPath}', url: '${url}' }));
          await browser.close();
        })().catch(e => { logger.info(JSON.stringify({ error: e.message })); process.exit(1); });
      `;

      const tmpScript = path.join(os.tmpdir(), `pw_ss_${Date.now()}.js`);
      fs.writeFileSync(tmpScript, script);
      try {
        const result = execFileSync('node', [tmpScript], { timeout: timeout + 5000 }).toString();
        fs.unlinkSync(tmpScript);
        const parsed = JSON.parse(result);
        if (parsed.error) return `Error: ${parsed.error}`;
        return `Screenshot salvo: ${parsed.screenshot}`;
      } catch (e) {
        try { fs.unlinkSync(tmpScript); } catch { /* ignore */ }
        throw e;
      }
    } catch (error: unknown) {
      return `Error in screenshot: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  public async extract(url: string, selectors: Record<string, string>): Promise<string> {
    const timeout = this.defaultTimeout;

    try {
      const { execFileSync } = await import('child_process');
      const selectorsJson = JSON.stringify(selectors);

      const script = `
        const { chromium } = require('playwright');
        const selectors = ${selectorsJson};
        (async () => {
          const browser = await chromium.launch({ headless: true });
          const page = await browser.newPage();
          await page.goto('${url}', { waitUntil: 'load', timeout: ${timeout} });
          const result = {};
          for (const [key, sel] of Object.entries(selectors)) {
            try {
              const els = await page.locator(sel).all();
              result[key] = await Promise.all(els.map(el => el.textContent()));
            } catch { result[key] = []; }
          }
          logger.info(JSON.stringify(result));
          await browser.close();
        })().catch(e => { logger.info(JSON.stringify({ error: e.message })); process.exit(1); });
      `;

      const tmpScript = path.join(os.tmpdir(), `pw_ext_${Date.now()}.js`);
      fs.writeFileSync(tmpScript, script);
      try {
        const result = execFileSync('node', [tmpScript], { timeout: timeout + 5000, maxBuffer: 10 * 1024 * 1024 }).toString();
        fs.unlinkSync(tmpScript);
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
      } catch (e) {
        try { fs.unlinkSync(tmpScript); } catch { /* ignore */ }
        throw e;
      }
    } catch (error: unknown) {
      return `Extraction error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  public async pdf(url: string, outputPath?: string): Promise<string> {
    const timeout = this.defaultTimeout;
    const pdfPath = outputPath || path.join(this.storageDir, `page_${Date.now()}.pdf`);

    try {
      const { execFileSync } = await import('child_process');
      const script = `
        const { chromium } = require('playwright');
        (async () => {
          const browser = await chromium.launch({ headless: true });
          const page = await browser.newPage();
          await page.goto('${url}', { waitUntil: 'load', timeout: ${timeout} });
          await page.pdf({ path: '${pdfPath.replace(/\\/g, '\\\\')}', format: 'A4' });
          logger.info(JSON.stringify({ pdf: '${pdfPath}', url: '${url}' }));
          await browser.close();
        })().catch(e => { logger.info(JSON.stringify({ error: e.message })); process.exit(1); });
      `;

      const tmpScript = path.join(os.tmpdir(), `pw_pdf_${Date.now()}.js`);
      fs.writeFileSync(tmpScript, script);
      try {
        const result = execFileSync('node', [tmpScript], { timeout: timeout + 10000 }).toString();
        fs.unlinkSync(tmpScript);
        const parsed = JSON.parse(result);
        if (parsed.error) return `Error: ${parsed.error}`;
        return `PDF gerado: ${parsed.pdf}`;
      } catch (e) {
        try { fs.unlinkSync(tmpScript); } catch { /* ignore */ }
        throw e;
      }
    } catch (error: unknown) {
      return `Error generating PDF: ${error instanceof Error ? error.message : String(error)}`;
    }
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
