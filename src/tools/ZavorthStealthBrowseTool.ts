/**
 * Zavorth Stealth Browse Tool.
 * Exposes Camofox-inspired stealth web scraping and anti-detection page extraction via Cognitive Firewall.
 */

import { StealthBrowserScraperService } from '../services/browser/StealthBrowserScraperService.js';

export interface ZavorthStealthBrowseInput {
  action: 'scrape' | 'extract_markdown' | 'generate_fingerprint';
  url?: string;
  rawHtml?: string;
  spoofPlatform?: 'windows' | 'mac' | 'linux';
  preserveLinks?: boolean;
  maxContentLength?: number;
}

export class ZavorthStealthBrowseTool {
  public static readonly name = 'zavorth_stealth_browse';
  public static readonly description =
    'Executes stealth web scraping with anti-bot fingerprint spoofing (Camofox-style client hints, user-agent rotation), bypassing anti-bot blockers and returning clean markdown content.';

  public static readonly schema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['scrape', 'extract_markdown', 'generate_fingerprint'],
        description: 'Action to perform: scrape a URL with stealth spoofing, extract markdown from HTML, or generate stealth headers.',
      },
      url: {
        type: 'string',
        description: 'The target HTTP/HTTPS URL to scrape.',
      },
      rawHtml: {
        type: 'string',
        description: 'Raw HTML content to parse into clean markdown (when action is extract_markdown).',
      },
      spoofPlatform: {
        type: 'string',
        enum: ['windows', 'mac', 'linux'],
        description: 'The platform fingerprint to emulate (default: windows).',
      },
      preserveLinks: {
        type: 'boolean',
        description: 'Whether to preserve markdown hyperlink targets [text](url) or convert to plain text.',
      },
      maxContentLength: {
        type: 'number',
        description: 'Maximum characters of markdown content to return.',
      },
    },
    required: ['action'],
  };

  public static async execute(input: ZavorthStealthBrowseInput): Promise<string> {
    switch (input.action) {
      case 'scrape': {
        if (!input.url) {
          return JSON.stringify({
            status: 'error',
            message: 'A target URL is required to execute stealth scrape.',
          });
        }
        try {
          const result = await StealthBrowserScraperService.scrape(input.url, {
            spoofPlatform: input.spoofPlatform,
            preserveLinks: input.preserveLinks,
            maxContentLength: input.maxContentLength,
          });
          return JSON.stringify({
            status: 'success',
            action: 'scrape',
            url: result.url,
            title: result.title,
            httpStatus: result.status,
            latencyMs: result.latencyMs,
            fingerprint: result.fingerprintUsed,
            contentLength: result.contentLength,
            markdown: result.markdown,
          });
        } catch (err: unknown) {
          return JSON.stringify({
            status: 'error',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }

      case 'extract_markdown': {
        if (!input.rawHtml) {
          return JSON.stringify({
            status: 'error',
            message: 'rawHtml is required to extract markdown.',
          });
        }
        const markdown = StealthBrowserScraperService.extractReadableMarkdown(input.rawHtml, {
          preserveLinks: input.preserveLinks,
          maxContentLength: input.maxContentLength,
        });
        const title = StealthBrowserScraperService.extractTitle(input.rawHtml);
        return JSON.stringify({
          status: 'success',
          action: 'extract_markdown',
          title,
          contentLength: markdown.length,
          markdown,
        });
      }

      case 'generate_fingerprint': {
        const platform = input.spoofPlatform || 'windows';
        const headers = StealthBrowserScraperService.generateStealthHeaders(platform);
        return JSON.stringify({
          status: 'success',
          action: 'generate_fingerprint',
          platform,
          headers,
        });
      }

      default:
        return JSON.stringify({
          status: 'error',
          message: `Unknown action: ${String(input.action)}`,
        });
    }
  }
}
