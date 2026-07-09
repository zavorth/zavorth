import crypto from 'node:crypto';
import type {
  DocumentExtractionArtifact,
  DocumentExtractionReceipt,
} from '../../contracts/SourceMemoryDocumentTerminalPackContract.js';type Runtime = {
  now?: () => Date;
};

type ReadabilityShape = new (document: unknown) => {
  parse(): null | {
    title?: string | null;
    textContent?: string | null;
    content?: string | null;
    excerpt?: string | null;
    byline?: string | null;
    siteName?: string | null;
  };
};

type JSDOMShape = new (html: string, options?: Record<string, unknown>) => {
  window: {
    document: unknown;
  };
};

export class ReadabilityExtractionAdapter {
  private readonly now: () => Date;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public extract(input: {
    html: string;
    sourceName?: string;
    mimeType?: string;
    url?: string | null;
  }): { artifact: DocumentExtractionArtifact; receipt: DocumentExtractionReceipt } {
    const sourceName = input.sourceName || input.url || 'article.html';
    const mimeType = input.mimeType || 'text/html';
    const extracted = extractReadableHtml(input.html, input.url || null);
    const artifactId = `credential-vault.document.html.${hashId(`${sourceName}:${extracted.text}`)}`;
    const receiptId = `${artifactId}.receipt`;
    const producedAt = this.now().toISOString();
    const artifact: DocumentExtractionArtifact = {
      id: artifactId,
      kind: 'html',
      sourceName,
      mimeType,
      title: extracted.title,
      text: extracted.text,
      excerpt: extracted.excerpt || extracted.text.slice(0, 500),
      metadata: {
        parser: extracted.parser,
        readabilityAvailable: extracted.readabilityAvailable,
        url: input.url || null,
        byline: extracted.byline,
        siteName: extracted.siteName,
        bytes: Buffer.byteLength(input.html, 'utf8'),
      },
      producedAt,
      receiptId,
      secretValuesSerialized: false,
    };
    const receipt: DocumentExtractionReceipt = {
      id: receiptId,
      status: artifact.text.trim() ? 'artifact-created' : 'failed',
      kind: 'html',
      artifactId: artifact.text.trim() ? artifact.id : null,
      parser: extracted.parser,
      bytes: Buffer.byteLength(input.html, 'utf8'),
      artifactFirst: true,
      replayable: true,
      liveIoPerformed: false,
      secretValuesSerialized: false,
      reason: artifact.text.trim()
        ? 'HTML article text extracted into an artifact-first receipt.'
        : 'HTML extraction did not produce readable article text.',
    };

    return { artifact, receipt };
  }
}

function extractReadableHtml(html: string, url: string | null): {
  title: string | null;
  text: string;
  excerpt: string | null;
  parser: string;
  readabilityAvailable: boolean;
  byline: string | null;
  siteName: string | null;
} {
  const readability = loadReadability();
  if (readability) {
    try {
      const dom = new readability.JSDOM(html, url ? { url } : undefined);
      const article = new readability.Readability(dom.window.document).parse();
      const text = cleanText(article?.textContent || stripHtml(article?.content || ''));
      if (text) {
        return {
          title: cleanText(article?.title || extractTitle(html)) || null,
          text,
          excerpt: cleanText(article?.excerpt || text.slice(0, 500)) || null,
          parser: '@mozilla/readability',
          readabilityAvailable: true,
          byline: cleanText(article?.byline || '') || null,
          siteName: cleanText(article?.siteName || '') || null,
        };
      }
    } catch (error: unknown) {// Fall through to the deterministic extractor.
    }
  }

  const title = extractTitle(html);
  const articleText = extractArticleText(html);
  return {
    title: title || null,
    text: articleText,
    excerpt: articleText.slice(0, 500),
    parser: 'fallback-html-article-extractor',
    readabilityAvailable: Boolean(readability),
    byline: null,
    siteName: null,
  };
}

function loadReadability(): { Readability: ReadabilityShape; JSDOM: JSDOMShape } | null {
  try {
    const readabilityModule = require('@mozilla/readability') as { Readability: ReadabilityShape };
    const jsdomModule = require('jsdom') as { JSDOM: JSDOMShape };
    return {
      Readability: readabilityModule.Readability,
      JSDOM: jsdomModule.JSDOM,
    };
  } catch (error: unknown) {return null;
  }
}

function extractTitle(html: string): string {
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const title = h1 || html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
  return cleanText(stripHtml(title));
}

function extractArticleText(html: string): string {
  const withoutChrome = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header\b[\s\S]*?<\/header>/gi, ' ');
  const article = withoutChrome.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]
    || withoutChrome.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    || withoutChrome.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]
    || withoutChrome;
  return cleanText(stripHtml(
    article
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|h1|h2|h3|section|article|div)>/gi, '\n'),
  ));
}

function stripHtml(value: string): string {
  return String(value || '').replace(/<[^>]+>/g, ' ');
}

function cleanText(value: string): string {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function hashId(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}
