/**
 * Stealth Browser Scraper Service.
 * Inspired by Hermes-Agent (Camofox stealth browser provider) and OpenClaw anti-detection scraping.
 * Executes resilient, stealth HTTP & headless browser scraping with anti-bot fingerprint spoofing,
 * client-hints emulation, and clean markdown content extraction.
 */

import { safeFetch } from '../../security/SafeFetchService.js';
import { EgressNetPolicyGuard } from '../../security/EgressNetPolicyGuard.js';
import { asErrorLike } from '../../utils/errorLike.js';

export interface StealthScrapeOptions {
  timeoutMs?: number;
  maxContentLength?: number;
  preserveLinks?: boolean;
  spoofPlatform?: 'windows' | 'mac' | 'linux';
  customHeaders?: Record<string, string>;
}

export interface StealthScrapeResult {
  url: string;
  status: number;
  title: string;
  markdown: string;
  contentLength: number;
  latencyMs: number;
  fingerprintUsed: {
    userAgent: string;
    platform: string;
    clientHints: Record<string, string>;
  };
}

export class StealthBrowserScraperService {
  private static readonly USER_AGENTS = {
    windows:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    mac:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    linux:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  };

  /**
   * Generates randomized anti-detection browser headers.
   */
  static generateStealthHeaders(platform: 'windows' | 'mac' | 'linux' = 'windows'): Record<string, string> {
    const userAgent = this.USER_AGENTS[platform];
    const secPlatform = platform === 'windows' ? '"Windows"' : platform === 'mac' ? '"macOS"' : '"Linux"';

    return {
      'User-Agent': userAgent,
      'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Ch-Ua': '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': secPlatform,
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0',
    };
  }

  /**
   * Scrapes a URL with anti-detection fingerprinting and extracts clean markdown.
   */
  static async scrape(url: string, options: StealthScrapeOptions = {}): Promise<StealthScrapeResult> {
    // 1. Egress security verification
    const securityCheck = EgressNetPolicyGuard.checkUrl(url);
    if (!securityCheck.allowed) {
      throw new Error(`[Stealth Scraper] Blocked by security policy: ${securityCheck.reason}`);
    }

    const platform = options.spoofPlatform || 'windows';
    const stealthHeaders = this.generateStealthHeaders(platform);
    const headers = {
      ...stealthHeaders,
      ...(options.customHeaders || {}),
    };

    const startTime = Date.now();
    try {
      const response = await safeFetch(url, {
        method: 'GET',
        headers,
        signal: options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined,
      }, { serviceName: 'StealthBrowserScraper' });

      const rawHtml = await response.text();
      const latencyMs = Date.now() - startTime;
      const title = this.extractTitle(rawHtml);
      const markdown = this.extractReadableMarkdown(rawHtml, options);

      return {
        url,
        status: response.status,
        title,
        markdown,
        contentLength: markdown.length,
        latencyMs,
        fingerprintUsed: {
          userAgent: stealthHeaders['User-Agent'],
          platform,
          clientHints: {
            'Sec-Ch-Ua': stealthHeaders['Sec-Ch-Ua'],
            'Sec-Ch-Ua-Platform': stealthHeaders['Sec-Ch-Ua-Platform'],
          },
        },
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      throw new Error(`[Stealth Scraper] Failed to scrape '${url}': ${err.message}`);
    }
  }

  /**
   * Extracts page title from raw HTML.
   */
  static extractTitle(html: string): string {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return titleMatch ? titleMatch[1].trim() : 'Untitled Page';
  }

  /**
   * Converts raw HTML to clean, token-efficient markdown.
   */
  static extractReadableMarkdown(html: string, options: StealthScrapeOptions = {}): string {
    let clean = html;

    // 1. Remove script, style, svg, and iframe tags
    clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    clean = clean.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');
    clean = clean.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    clean = clean.replace(/<!--[\s\S]*?-->/g, '');

    // 2. Convert standard HTML headers to Markdown
    clean = clean.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
    clean = clean.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
    clean = clean.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
    clean = clean.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');

    // 3. Convert paragraphs, linebreaks, and list items
    clean = clean.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');
    clean = clean.replace(/<br\s*\/?>/gi, '\n');
    clean = clean.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n* $1');

    // 4. Links handling
    if (options.preserveLinks !== false) {
      clean = clean.replace(/<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
    } else {
      clean = clean.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1');
    }

    // 5. Code blocks and pre tags
    clean = clean.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n');
    clean = clean.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

    // 6. Strip all remaining HTML tags
    clean = clean.replace(/<[^>]+>/g, '');

    // 7. Decode HTML entities
    clean = clean
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // 8. Collapse multiple whitespace and blank lines
    clean = clean.replace(/[ \t]+/g, ' ');
    clean = clean.replace(/\n\s*\n\s*\n+/g, '\n\n');

    const maxLength = options.maxContentLength || 32_000;
    if (clean.length > maxLength) {
      clean = clean.slice(0, maxLength) + '\n\n[Content truncated by Stealth Scraper limit...]';
    }

    return clean.trim();
  }
}
