/**
 * SkillWebScraper - Scrapes skill listings from any website.
 *
 * Generic web scraper that can extract skill information from:
 * - Static HTML pages
 * - API endpoints that return HTML
 * - Markdown-rendered pages
 *
 * Uses regex patterns and DOM parsing to find:
 * - Skill names, descriptions, tags
 * - Download/install URLs (GitHub, npm, zip, tarball)
 * - Author information
 *
 * SECURITY: Validates URLs before fetching to prevent SSRF attacks.
 * Only allows HTTPS to public hosts, blocks private IPs and localhost.
 */

import { logger } from '../../logger.js';

// ============================================================================
// Types
// ============================================================================

export interface ScrapedSkillInfo {
  /** Skill name */
  name: string;
  /** Description */
  description: string;
  /** Author/publisher */
  author: string;
  /** Tags */
  tags: string[];
  /** Source URL (the page we scraped) */
  sourceUrl: string;
  /** Install URLs found on the page */
  installUrls: InstallUrl[];
  /** Additional metadata */
  metadata: Record<string, string>;
}

export interface InstallUrl {
  /** URL to install from */
  url: string;
  /** Type of install source */
  type: 'github' | 'gitlab' | 'npm' | 'zip' | 'tarball' | 'git' | 'unknown';
  /** Whether this is the primary/recommended install method */
  isPrimary: boolean;
  /** Label for display */
  label: string;
}

export interface ScrapeResult {
  /** Whether scraping succeeded */
  success: boolean;
  /** Scraped skill info */
  skill: ScrapedSkillInfo | null;
  /** Error message if failed */
  error?: string;
  /** Raw HTML content (for debugging) */
  rawContent?: string;
}

// ============================================================================
// SSRF Protection - Blocked hosts/IPs
// ============================================================================

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  'instance-data',
]);

const BLOCKED_IP_PREFIXES = [
  '10.',
  '172.16.',
  '172.17.',
  '172.18.',
  '172.19.',
  '172.20.',
  '172.21.',
  '172.22.',
  '172.23.',
  '172.24.',
  '172.25.',
  '172.26.',
  '172.27.',
  '172.28.',
  '172.29.',
  '172.30.',
  '172.31.',
  '192.168.',
  '169.254.',
];

/**
 * Validate URL to prevent SSRF attacks.
 * Returns null if valid, error message if blocked.
 */
function validateUrlForFetch(url: string): string | null {
  try {
    const parsed = new URL(url);

    // Only allow HTTPS
    if (parsed.protocol !== 'https:') {
      return `Blocked: only HTTPS URLs allowed. Got ${parsed.protocol}`;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check blocked hosts
    if (BLOCKED_HOSTS.has(hostname)) {
      return `Blocked: hostname "${hostname}" is in blocked list`;
    }

    // Check blocked IP prefixes (private ranges)
    for (const prefix of BLOCKED_IP_PREFIXES) {
      if (hostname.startsWith(prefix)) {
        return `Blocked: IP "${hostname}" is in private range`;
      }
    }

    // Check for IP address patterns (IPv4)
    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const [, a, b] = ipv4Match.map(Number);
      // Block private ranges
      if (a === 10 || a === 172 || a === 192 || a === 169) {
        return `Blocked: IP "${hostname}" is in private range`;
      }
    }

    return null; // Valid
  } catch {
    return 'Blocked: invalid URL format';
  }
}

// ============================================================================
// URL Pattern Matchers
// ============================================================================

const INSTALL_URL_PATTERNS: Array<{ pattern: RegExp; type: InstallUrl['type']; label: string }> = [
  // GitHub URLs
  { pattern: /https?:\/\/github\.com\/[^/]+\/[^/]+(?:\/tree\/[^/]+)?(?:\/[^/]*)?/g, type: 'github', label: 'GitHub Repository' },
  { pattern: /https?:\/\/github\.com\/[^/]+\/[^/]+\/archive\/[^/]+\.zip/g, type: 'zip', label: 'GitHub ZIP Archive' },

  // GitLab URLs
  { pattern: /https?:\/\/gitlab\.com\/[^/]+\/[^/]+(?:\/-\/tree\/[^/]+)?(?:\/[^/]*)?/g, type: 'gitlab', label: 'GitLab Repository' },

  // npm URLs
  { pattern: /https?:\/\/www\.npmjs\.com\/package\/[^/]+/g, type: 'npm', label: 'npm Package' },
  { pattern: /npm:([a-zA-Z0-9@/._-]+)/g, type: 'npm', label: 'npm Package' },

  // Archive URLs
  { pattern: /https?:\/\/[^/]+\.zip(?=\s|$|"|')/gi, type: 'zip', label: 'ZIP Archive' },
  { pattern: /https?:\/\/[^/]+\.(?:tar\.gz|tgz)(?=\s|$|"|')/gi, type: 'tarball', label: 'Tarball Archive' },

  // Generic Git URLs
  { pattern: /https?:\/\/[^/]+\.git(?:\s|$|"|')/g, type: 'git', label: 'Git Repository' },
];

// ============================================================================
// Main Scraper
// ============================================================================

export class SkillWebScraper {
  private readonly requestTimeoutMs: number;

  constructor(options?: { requestTimeoutMs?: number }) {
    this.requestTimeoutMs = options?.requestTimeoutMs ?? 30000;
  }

  /**
   * Scrape a webpage for skill information.
   * SECURITY: Validates URL before fetching to prevent SSRF.
   */
  async scrape(url: string): Promise<ScrapeResult> {
    try {
      // Validate URL before fetching (SSRF protection)
      const validationError = validateUrlForFetch(url);
      if (validationError) {
        logger.warn(`[SkillWebScraper] ${validationError}: ${url}`);
        return {
          success: false,
          skill: null,
          error: validationError,
        };
      }

      logger.info(`[SkillWebScraper] Scraping: ${url}`);

      // Fetch the page content
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Zavorth-SkillBrowser/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return {
          success: false,
          skill: null,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const contentType = response.headers.get('content-type') || '';
      let content: string;

      if (contentType.includes('text/html')) {
        content = await response.text();
      } else if (contentType.includes('text/markdown') || contentType.includes('text/plain')) {
        content = await response.text();
      } else {
        // Try to parse as text
        content = await response.text();
      }

      // Parse the content
      const skill = this.parseContent(content, url);

      return {
        success: true,
        skill,
        rawContent: content.slice(0, 10000), // Limit for debugging
      };
    } catch (error) {
      logger.warn(`[SkillWebScraper] Failed to scrape ${url}:`, error);
      return {
        success: false,
        skill: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Scrape multiple URLs in parallel.
   */
  async scrapeMultiple(urls: string[]): Promise<ScrapeResult[]> {
    const results = await Promise.allSettled(
      urls.map(url => this.scrape(url))
    );

    return results.map(result =>
      result.status === 'fulfilled'
        ? result.value
        : { success: false, skill: null, error: 'Request failed' }
    );
  }

  /**
   * Parse HTML/markdown content to extract skill information.
   */
  private parseContent(content: string, sourceUrl: string): ScrapedSkillInfo {
    // Extract title
    const name = this.extractTitle(content);

    // Extract description
    const description = this.extractDescription(content);

    // Extract author
    const author = this.extractAuthor(content);

    // Extract tags
    const tags = this.extractTags(content);

    // Extract install URLs
    const installUrls = this.extractInstallUrls(content);

    // Extract additional metadata
    const metadata = this.extractMetadata(content);

    return {
      name,
      description,
      author,
      tags,
      sourceUrl,
      installUrls,
      metadata,
    };
  }

  /**
   * Extract the skill/page title.
   */
  private extractTitle(content: string): string {
    // Try HTML title tag
    const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      return this.cleanText(titleMatch[1]);
    }

    // Try first H1
    const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
      return this.cleanText(h1Match[1]);
    }

    // Try markdown heading
    const mdMatch = content.match(/^#\s+(.+)$/m);
    if (mdMatch) {
      return this.cleanText(mdMatch[1]);
    }

    return 'Unknown Skill';
  }

  /**
   * Extract the skill description.
   */
  private extractDescription(content: string): string {
    // Try meta description
    const metaMatch = content.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    if (metaMatch) {
      return this.cleanText(metaMatch[1]);
    }

    // Try first paragraph after title
    const pMatch = content.match(/<p[^>]*>([^<]{20,})<\/p>/i);
    if (pMatch) {
      return this.cleanText(pMatch[1]).slice(0, 200);
    }

    // Try markdown paragraph
    const mdMatch = content.match(/^([^#\n]{20,})$/m);
    if (mdMatch) {
      return this.cleanText(mdMatch[1]).slice(0, 200);
    }

    return '';
  }

  /**
   * Extract the author/publisher.
   */
  private extractAuthor(content: string): string {
    // Try meta author
    const metaMatch = content.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i);
    if (metaMatch) {
      return this.cleanText(metaMatch[1]);
    }

    // Try "by" or "author" patterns
    const byMatch = content.match(/(?:by|author|published by|created by)[:\s]+([^\s<"]+)/i);
    if (byMatch) {
      return this.cleanText(byMatch[1]);
    }

    // Try GitHub username from URL
    const githubMatch = content.match(/github\.com\/([^/]+)\//i);
    if (githubMatch) {
      return githubMatch[1];
    }

    return 'unknown';
  }

  /**
   * Extract tags/keywords.
   */
  private extractTags(content: string): string[] {
    const tags: string[] = [];

    // Try meta keywords
    const metaMatch = content.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i);
    if (metaMatch) {
      tags.push(...metaMatch[1].split(',').map(t => t.trim().toLowerCase()));
    }

    // Try data-tags attribute
    const tagsAttrMatch = content.match(/data-tags=["']([^"']+)["']/i);
    if (tagsAttrMatch) {
      tags.push(...tagsAttrMatch[1].split(',').map(t => t.trim().toLowerCase()));
    }

    // Try hashtags
    const hashtagMatch = content.match(/#([a-zA-Z0-9_]+)/g);
    if (hashtagMatch) {
      tags.push(...hashtagMatch.map(t => t.slice(1).toLowerCase()));
    }

    // Try common tag patterns
    const tagPatterns = [
      /tags?:\s*\[([^\]]+)\]/i,
      /keywords?:\s*\[([^\]]+)\]/i,
      /categories?:\s*\[([^\]]+)\]/i,
    ];

    for (const pattern of tagPatterns) {
      const match = content.match(pattern);
      if (match) {
        tags.push(...match[1].split(',').map(t => t.trim().replace(/['"]/g, '').toLowerCase()));
      }
    }

    // Deduplicate
    return [...new Set(tags)].slice(0, 20);
  }

  /**
   * Extract install/download URLs.
   */
  private extractInstallUrls(content: string): InstallUrl[] {
    const urls: InstallUrl[] = [];
    const seen = new Set<string>();

    for (const { pattern, type, label } of INSTALL_URL_PATTERNS) {
      // Reset regex lastIndex
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(content)) !== null) {
        const url = match[0].trim();

        // Skip if already seen or looks like an image
        if (seen.has(url) || url.match(/\.(png|jpg|jpeg|gif|svg|ico)(\?|$)/i)) {
          continue;
        }

        seen.add(url);
        urls.push({
          url,
          type,
          isPrimary: urls.length === 0, // First found is primary
          label,
        });
      }
    }

    return urls;
  }

  /**
   * Extract additional metadata.
   */
  private extractMetadata(content: string): Record<string, string> {
    const metadata: Record<string, string> = {};

    // Try to extract version
    const versionMatch = content.match(/version[:\s]+([0-9]+\.[0-9]+\.[0-9]+)/i);
    if (versionMatch) {
      metadata.version = versionMatch[1];
    }

    // Try to extract license
    const licenseMatch = content.match(/license[:\s]+([^\s<"]+)/i);
    if (licenseMatch) {
      metadata.license = licenseMatch[1];
    }

    // Try to extract stars/downloads
    const starsMatch = content.match(/(\d+(?:\.\d+)?)\s*(?:stars?|★)/i);
    if (starsMatch) {
      metadata.stars = starsMatch[1];
    }

    const downloadsMatch = content.match(/(\d+(?:\.\d+)?)\s*(?:downloads?|installs?)/i);
    if (downloadsMatch) {
      metadata.downloads = downloadsMatch[1];
    }

    return metadata;
  }

  /**
   * Clean text by removing HTML tags and extra whitespace.
   */
  private cleanText(text: string): string {
    return text
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/&[a-z]+;/gi, ' ') // Remove HTML entities
      .replace(/["']/g, '') // Remove quotes
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
}
