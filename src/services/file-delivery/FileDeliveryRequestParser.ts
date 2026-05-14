import type { RequestDescriptor, RootKey, TimeFilter } from './FileDeliveryTypes.js';
import { STOPWORDS } from './FileDeliveryTypes.js';

export class FileDeliveryRequestParser {
  public parseRequest(rawRequest: string): RequestDescriptor {
    const normalized = String(rawRequest || '').trim();
    const lowered = normalized.toLowerCase();
    const explicitPath = this.extractExplicitPath(normalized);
    const wantsListing = /\b(o que tem|quais arquivos|quais pastas|listar|liste|lista|conteudo|mostra o que tem|mostrar arquivos)\b/i.test(normalized);
    const hasDirectoryHint = /\b(pasta|diretorio|folder)\b/i.test(normalized);
    const hasFileHint = /\b(pdf|html|htm|css|js|json|md|ts|tsx|jsx|arquivo|documento|planilha|imagem|foto|png|jpg|jpeg|gif|csv|xlsx|docx|txt)\b/i.test(normalized);
    const desiredExtensionMatch = lowered.match(/\b(pdf|txt|csv|zip|png|jpg|jpeg|gif|docx|xlsx|html|htm|css|js|json|md|ts|tsx|jsx)\b/);
    const desiredType = hasFileHint ? 'file' : hasDirectoryHint ? 'directory' : 'either';
    const timeFilter = this.parseTimeFilter(normalized);

    return {
      explicitPath,
      preferredRoots: this.detectRootHints(lowered),
      desiredType,
      desiredExtension: desiredExtensionMatch ? `.${desiredExtensionMatch[1].replace('jpeg', 'jpg')}` : null,
      searchTerm: this.extractSearchTerm(normalized, explicitPath),
      wantsLatest: /\b(mais recente|mais novo|ultima|ultimo|ultimas|ultimos)\b/i.test(normalized),
      wantsListing,
      modifiedSinceMs: timeFilter.sinceMs,
      modifiedUntilMs: timeFilter.untilMs,
      timeFilterLabel: timeFilter.label,
    };
  }

  public parseTimeFilter(rawRequest: string): TimeFilter {
    const text = String(rawRequest || '').toLowerCase();
    const now = new Date();

    if (/\bhoje\b/.test(text)) {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      return { sinceMs: start.getTime(), untilMs: end.getTime(), label: 'de hoje' };
    }
    if (/\bontem\b/.test(text)) {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { sinceMs: start.getTime(), untilMs: end.getTime(), label: 'de ontem' };
    }
    if (/\b(essa|esta)\s+semana\b/.test(text)) {
      const start = new Date(now);
      const day = start.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      start.setDate(start.getDate() + mondayOffset);
      start.setHours(0, 0, 0, 0);
      return { sinceMs: start.getTime(), untilMs: null, label: 'desta semana' };
    }
    if (/\b(esse|este)\s+mes\b/.test(text)) {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { sinceMs: start.getTime(), untilMs: null, label: 'deste mes' };
    }

    const lastDaysMatch = text.match(/\bultim(?:os|as)?\s+(\d+)\s+dias?\b/);
    if (lastDaysMatch) {
      const days = Number.parseInt(lastDaysMatch[1], 10);
      if (days > 0) {
        return { sinceMs: Date.now() - days * 24 * 60 * 60 * 1000, untilMs: null, label: `dos ultimos ${days} dias` };
      }
    }

    return { sinceMs: null, untilMs: null, label: null };
  }

  public detectRootHints(loweredRequest: string): RootKey[] {
    const roots: RootKey[] = [];
    if (/\b(download|downloads|baixados?)\b/i.test(loweredRequest)) roots.push('downloads');
    if (/\b(desktop|area de trabalho)\b/i.test(loweredRequest)) roots.push('desktop');
    if (/\b(documentos|documento|documents|docs)\b/i.test(loweredRequest)) roots.push('documents');
    if (/\b(workspace|repo|repositorio|projeto|zavorth)\b/i.test(loweredRequest)) roots.push('workspace');
    return roots.length > 0 ? roots : ['downloads', 'desktop', 'documents', 'workspace'];
  }

  public extractExplicitPath(rawRequest: string): string | null {
    const quoted = rawRequest.match(/["']([^"']*[\\/][^"']+)["']/);
    if (quoted?.[1]) return quoted[1].trim();
    const drivePath = rawRequest.match(/[a-zA-Z]:(?:[\\/][^\n\r]+)+/);
    if (drivePath?.[0]) return drivePath[0].trim().replace(/[.,;:!?]+$/, '');
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
      .replace(/\/(?:arquivo|task)\b/gi, ' ')
      .replace(/\b(download|downloads|desktop|documentos?|docs|workspace|repo|repositorio|projeto)\b/gi, ' ')
      .replace(/\b(achar|encontrar|localizar|buscar|procura|procure|cad[eÃª]|olha|olhe)\b/gi, ' ')
      .replace(/\b(mais recente|mais novo|ultima|ultimo|ultimas|ultimos|hoje|ontem|essa semana|esta semana|esse mes|este mes)\b/gi, ' ')
      .replace(/[^\w.\- ]+/g, ' ')
      .toLowerCase();

    const extraStopwords = new Set(['abra', 'abre', 'abrir', 'chamada', 'chamado', 'com', 'desse', 'dessa', 'deste', 'desta', 'dentro', 'mostre', 'so', 'veja', 'ver']);
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
    const normalized = text.toLowerCase();
    const sendIntent = /(me\s+envia|me\s+envie|me\s+manda|manda\s+pra\s+mim|envie|enviar|manda|anexa|anexa\s+pra\s+mim|me\s+mande)/i;
    const listIntent = /(o\s+que\s+tem|quais\s+arquivos|quais\s+pastas|listar|liste|lista|mostra\s+o\s+que\s+tem|mostrar\s+arquivos|conteudo\s+da\s+pasta|conteudo\s+de)/i;
    const searchIntent = /(achar|encontrar|localizar|buscar|procura|procure|cad[eÃª]|olha|olhe)/i;
    const filePattern = /(arquivo|pdf|html|htm|css|js|json|md|tsx?|jsx|pasta|zip|documento|planilha|imagem|foto|downloads?|desktop|documentos?|docs|workspace|repositorio|repo|c:\\|\\|\/)/i;
    return filePattern.test(normalized) && (sendIntent.test(normalized) || listIntent.test(normalized) || searchIntent.test(normalized));
  }
}
