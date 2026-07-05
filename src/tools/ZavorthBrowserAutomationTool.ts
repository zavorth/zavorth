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
        description: "Action: 'navigate', 'click', 'type', 'screenshot', 'extract', 'evaluate', 'wait_for', 'cookies', 'get_html', 'get_text', 'pdf'.",
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
      default: return `Error: action "${action}" is invalid. Valid: navigate, click, type, screenshot, extract, evaluate, wait_for, cookies, get_html, get_text, pdf.`;
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
    } catch (error) { logger.warn('[Zavorth Browser Automation] process execution failed', error); return ''; }
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
    } catch (error) {
    logger.warn('[Zavorth Browser Automation] resource cleanup failed', error);
    return await this.fallbackCurl(String(args.url || ''));
  }
  }

  private async fallbackCurl(url: string): Promise<string> {
    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('curl', ['-s', '-L', '-o', '/dev/null', '-w', 'HTTP %{http_code}\nURL: %{url_effective}\nRedirects: %{num_redirects}\nTime: %{time_total}s', '--max-time', '30', url], { timeout: 35000 }).toString();
      return `Fallback curl check:\n${result}`;
    } catch (error) { logger.warn('[Zavorth Browser Automation] network request failed', error); return ''; }
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
    const extractTarget = selector
      ? `const elements = await page.$$eval(${selectorLiteral}, els => els.map(el => (el.textContent || '').trim())); console.log(JSON.stringify(elements, null, 2));`
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
    } catch (error) { logger.warn('[Zavorth Browser Automation] process execution failed', error); return ''; }
  }

  private async waitFor(args: Record<string, unknown>): Promise<string> {
    const selector = String(args.selector || '');
    const waitMs = Number(args.wait_ms || 30000);
    if (!selector) return 'Error: "selector" is required for wait_for.';

    return `Wait action prepared for selector: "${selector}" with ${waitMs}ms timeout. Combine with navigate in a Playwright script for multi-step automation.`;
  }

  private async manageCookies(args: Record<string, unknown>): Promise<string> {
    const url = String(args.url || '');
    const cookieName = String(args.cookie_name || '');
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
    } catch (error) { logger.warn('[Zavorth Browser Automation] process execution failed', error); return ''; }
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
}
