import type { RequestDescriptor, RootKey, TimeFilter } from './FileDeliveryTypes.js';
import { STOPWORDS } from './FileDeliveryTypes.js';

export class FileDeliveryRequestParser {
  public parseRequest(rawRequest: string): RequestDescriptor {
    const normalized = String(rawRequest || '').trim();
    const lowered = normalized.toLowerCase();
    const explicitPath = this.extractExplicitPath(normalized);
    const wantsListing = false;
    const desiredExtensionMatch = explicitPath?.match(/\.(pdf|txt|csv|zip|png|jpg|jpeg|gif|docx|xlsx|html|htm|css|js|json|md|ts|tsx|jsx)$/i) || null;
    const desiredType = explicitPath ? 'file' : 'either';
    const timeFilter = this.parseTimeFilter(normalized);

    return {
      explicitPath,
      preferredRoots: this.detectRootHints(lowered),
      desiredType,
      desiredExtension: desiredExtensionMatch ? `.${desiredExtensionMatch[1].replace('jpeg', 'jpg')}` : null,
      searchTerm: this.extractSearchTerm(normalized, explicitPath),
      wantsLatest: false,
      wantsListing,
      modifiedSinceMs: timeFilter.sinceMs,
      modifiedUntilMs: timeFilter.untilMs,
      timeFilterLabel: timeFilter.label,
    };
  }

  public parseTimeFilter(_rawRequest: string): TimeFilter {
    return { sinceMs: null, untilMs: null, label: null };
  }

  public detectRootHints(_loweredRequest: string): RootKey[] {
    return ['downloads', 'desktop', 'documents', 'workspace'];
  }

  public extractExplicitPath(rawRequest: string): string | null {
    const quoted = rawRequest.match(/["']([^"']*[\\/][^"']+)["']/);
    if (quoted?.[1]) return quoted[1].trim();
    const drivePath = rawRequest.match(/[a-zA-Z]:(?:[\\/][^\n\r]+)+/);
    if (drivePath?.[0]) return drivePath[0].trim().replace(/[.,;:!...]+$/, '');
    const tildePath = rawRequest.match(/~[\\/][^\s]+/);
    if (tildePath?.[0]) return tildePath[0].trim();
    return null;
  }

  public extractSearchTerm(rawRequest: string, explicitPath: string | null): string {
    const requestWithoutPath = explicitPath ? rawRequest.replace(explicitPath, ' ') : rawRequest;
    const quotedLabel = requestWithoutPath.match(/["']([^"']+)["']/);
    if (quotedLabel?.[1] && !quotedLabel[1].includes('\\') && !quotedLabel[1].includes('/')) {
      return quotedLabel[1].trim();
    }

    const normalized = requestWithoutPath
      .replace(/\/(?:file|task)\b/gi, ' ')
      .replace(/\b(download|downloads|desktop|documents?|docs|workspace|repo|repository|project)\b/gi, ' ')
      .replace(/\b(find|locate|search|lookup|search|look)\b/gi, ' ')
      .replace(/\b(most recent|newest|last|latest|today|yesterday|this week|this month)\b/gi, ' ')
      .replace(/[^\w.\- ]+/g, ' ')
      .toLowerCase();

    const extraStopwords = new Set(['open', 'opens', 'opening', 'call', 'called', 'with', 'from', 'from', 'from', 'from', 'inside', 'show', 'just', 'see', 'view']);
    return normalized
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 1 && !STOPWORDS.has(token) && !extraStopwords.has(token))
      .join(' ')
      .trim();
  }

  public hasSpecificQuery(searchTerm: string, desiredExtension: string | null): boolean {
    return Boolean(searchTerm) || Boolean(desiredExtension);
  }

  public looksLikeFileRequest(text: string): boolean {
    return Boolean(this.extractExplicitPath(text));
  }
}
