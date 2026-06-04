import type {
  ZavorthAdaptiveMultilingualRecallInput,
  ZavorthAdaptiveMultilingualRecallResult,
} from '../contracts/ZavorthAdaptiveLearningOsContract.js';
import type { ZavorthMemoryLearningLoopService } from './ZavorthMemoryLearningLoopService.js';

type AdaptiveRecallRuntime = {
  now?: () => Date;
  memoryLearningLoop: Pick<ZavorthMemoryLearningLoopService, 'search'>;
};

const QUERY_ALIASES: Array<{ canonical: string; aliases: RegExp[] }> = [
  {
    canonical: 'direct',
    aliases: [/\bdirect(as?|o|os)?\b/i, /\bdireto?s?\b/i, /\bobjetiv[oa]s?\b/i],
  },
  {
    canonical: 'evidence',
    aliases: [/\bevid[eê]ncias?\b/i, /\bevidencias?\b/i, /\bevidence\b/i, /\bproof\b/i, /\bpruebas?\b/i],
  },
  {
    canonical: 'concise',
    aliases: [/\bconciso?s?\b/i, /\bbreve?s?\b/i, /\bcurt[oa]s?\b/i, /\bshort\b/i],
  },
  {
    canonical: 'portuguese',
    aliases: [/\bportugu[eê]s(a|as|es)?\b/i, /\bportugues(a|as|es)?\b/i],
  },
  {
    canonical: 'response style',
    aliases: [/\brespostas?\b/i, /\banswers?\b/i, /\brespuestas?\b/i, /\breplies?\b/i],
  },
  {
    canonical: 'github pull request changed files test gaps',
    aliases: [/\bgithub\b/i, /\bpull\s+request\b/i, /\bpr\b/i, /\bchanged\s+files?\b/i, /\barchivos?\s+cambiad[oa]s?\b/i],
  },
];

export class ZavorthAdaptiveMultilingualRecallService {
  private readonly now: () => Date;
  private readonly memoryLoop: Pick<ZavorthMemoryLearningLoopService, 'search'>;

  public constructor(runtime: AdaptiveRecallRuntime) {
    this.now = runtime.now || (() => new Date());
    this.memoryLoop = runtime.memoryLearningLoop;
  }

  public async search(input: ZavorthAdaptiveMultilingualRecallInput): Promise<ZavorthAdaptiveMultilingualRecallResult> {
    const query = this.clean(input.query);
    const queriesTried = this.expandQueries(query);
    const entries = new Map<string, ZavorthAdaptiveMultilingualRecallResult['entries'][number]>();
    for (const candidate of queriesTried) {
      const result = await this.memoryLoop.search({
        query: candidate,
        userId: input.userId || null,
        sessionId: input.sessionId || null,
        workspace: input.workspace || null,
        layers: input.layers,
        limit: input.limit,
      });
      for (const entry of result.entries) {
        if (!entries.has(entry.id)) {
          entries.set(entry.id, entry);
        }
      }
      if (entries.size >= Math.max(1, Math.min(input.limit || 8, 24))) break;
    }

    const rankedEntries = Array.from(entries.values())
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
      .slice(0, Math.max(1, Math.min(input.limit || 8, 24)));

    return {
      generatedAt: this.now().toISOString(),
      query,
      queriesTried,
      total: rankedEntries.length,
      entries: rankedEntries,
      safety: {
        localOnly: true,
        topKOnly: true,
        untrustedOnRecall: true,
        noExternalTranslationPerformed: true,
      },
    };
  }

  private expandQueries(query: string): string[] {
    const normalized = this.normalize(query);
    const expansions = new Set<string>();
    if (query) expansions.add(query);
    const canonicalTerms = new Set<string>();
    for (const group of QUERY_ALIASES) {
      if (group.aliases.some((pattern) => pattern.test(query) || pattern.test(normalized))) {
        for (const term of group.canonical.split(/\s+/)) {
          canonicalTerms.add(term);
        }
      }
    }
    if (canonicalTerms.size > 0) {
      if (!canonicalTerms.has('response')) canonicalTerms.add('response');
      if (!canonicalTerms.has('style')) canonicalTerms.add('style');
      if (!canonicalTerms.has('concise')) canonicalTerms.add('concise');
      if (!canonicalTerms.has('portuguese')) canonicalTerms.add('portuguese');
      const ordered = [
        'direct',
        'evidence',
        'concise',
        'portuguese',
        'response',
        'style',
        'github',
        'pull',
        'request',
        'changed',
        'files',
        'test',
        'gaps',
      ].filter((term) => canonicalTerms.has(term));
      expansions.add(ordered.join(' '));
    }
    return Array.from(expansions).filter(Boolean);
  }

  private normalize(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_-]+/g, ' ')
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private clean(value: unknown, maxChars = 600): string {
    return String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxChars);
  }
}
