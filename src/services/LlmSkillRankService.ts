/**
 * Optional LLM ranking over a **closed** candidate list.
 * Never invents ids; soft-fails to input order when LLM unavailable.
 */

export type LlmSkillRankCandidate = {
  id: string;
  name?: string;
  description?: string;
  tools?: string[];
  tags?: string[];
  source?: string;
};

export type LlmSkillRankResult = {
  ok: boolean;
  usedLlm: boolean;
  orderedIds: string[];
  reason: string;
};

export type LlmSkillRankChat = {
  /**
   * Minimal chat surface — returns assistant text.
   * Implementations should not throw for soft-fail; may throw and be caught.
   */
  complete: (prompt: string) => Promise<string>;
};

export type LlmSkillRankRuntime = {
  chat?: LlmSkillRankChat | null;
  /** When false, never call LLM (default: respect input.useLlm only). */
  enabled?: boolean;
};

export class LlmSkillRankService {
  private readonly chat: LlmSkillRankChat | null;
  private readonly enabled: boolean;

  constructor(runtime: LlmSkillRankRuntime = {}) {
    this.chat = runtime.chat ?? null;
    this.enabled = runtime.enabled !== false;
  }

  /**
   * Rank candidates for a user query. Only reorders known ids.
   */
  public async rank(input: {
    query: string;
    candidates: LlmSkillRankCandidate[];
    useLlm?: boolean;
  }): Promise<LlmSkillRankResult> {
    const query = String(input.query || '').trim();
    const candidates = Array.isArray(input.candidates) ? input.candidates : [];
    const ids = candidates.map((c) => String(c.id || '').trim()).filter(Boolean);
    const uniqueIds = Array.from(new Set(ids));

    if (!uniqueIds.length) {
      return { ok: true, usedLlm: false, orderedIds: [], reason: 'no candidates' };
    }

    if (!input.useLlm || !this.enabled || !this.chat || !query) {
      return {
        ok: true,
        usedLlm: false,
        orderedIds: uniqueIds,
        reason: input.useLlm
          ? 'LLM rank requested but unavailable; keeping deterministic order'
          : 'deterministic order (LLM not requested)',
      };
    }

    try {
      const catalog = candidates.slice(0, 40).map((c) => ({
        id: c.id,
        name: c.name || c.id,
        description: String(c.description || '').slice(0, 240),
        tools: (c.tools || []).slice(0, 12),
        source: c.source || '',
      }));
      const prompt = [
        'Rank the following skill candidates for the user query.',
        'Reply with JSON only: {"orderedIds":["id1","id2",...]}',
        'Only use ids from the candidate list. Do not invent ids.',
        `Query: ${query}`,
        `Candidates: ${JSON.stringify(catalog)}`,
      ].join('\n');
      const text = await this.chat.complete(prompt);
      const ordered = parseOrderedIds(text, uniqueIds);
      if (!ordered.length) {
        return {
          ok: true,
          usedLlm: true,
          orderedIds: uniqueIds,
          reason: 'LLM response unparseable; keeping deterministic order',
        };
      }
      // Append any missing ids in original order
      for (const id of uniqueIds) {
        if (!ordered.includes(id)) ordered.push(id);
      }
      return {
        ok: true,
        usedLlm: true,
        orderedIds: ordered,
        reason: 'LLM ranked closed candidate list',
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        ok: true,
        usedLlm: false,
        orderedIds: uniqueIds,
        reason: `LLM rank soft-failed: ${msg.slice(0, 120)}`,
      };
    }
  }
}

function parseOrderedIds(text: string, allowed: string[]): string[] {
  const allowedSet = new Set(allowed);
  const raw = String(text || '').trim();
  if (!raw) return [];
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { orderedIds?: unknown; ranked?: unknown };
      const list = Array.isArray(parsed.orderedIds)
        ? parsed.orderedIds
        : Array.isArray(parsed.ranked)
          ? parsed.ranked
          : [];
      return list.map((x) => String(x || '').trim()).filter((id) => allowedSet.has(id));
    }
  } catch {
    /* fall through */
  }
  // Fallback: lines that look like bare ids
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const id = line.replace(/^[\s\-*0-9.]+/, '').trim();
    if (allowedSet.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}
