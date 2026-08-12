import type { ILlmProvider } from '../providers/ILlmProvider.js';

export type DayPathRankEntry = {
  id: string;
  score: number;
  why: string;
};

export type DayPathRankResponse = {
  ranked: DayPathRankEntry[];
  confidence: number;
};

export type DayPathCandidate = {
  id: string;
  command: string;
  summary: string;
  whenToUse: string;
  group: string;
  readOnly: boolean;
  onboarding: boolean;
};

export type DayPathRankResult = {
  source: 'semantic' | 'fallback';
  ranked: DayPathRankEntry[];
};

export function parseDayPathRankResponse(raw: string): DayPathRankResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ranked: [], confidence: 0 };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ranked: [], confidence: 0 };
  }
  const payload = parsed as Record<string, unknown>;
  const ranked = Array.isArray(payload.ranked)
    ? payload.ranked
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
        .filter((entry) => typeof entry.id === 'string' && entry.id.length > 0)
        .map((entry) => ({
          id: String(entry.id),
          score: typeof entry.score === 'number' ? entry.score : 0,
          why: typeof entry.why === 'string' ? entry.why : '',
        }))
    : [];
  const confidence = typeof payload.confidence === 'number' ? payload.confidence : 0;
  return { ranked, confidence };
}

export async function rankDayPathCommands(input: {
  userIntent: string;
  candidates: DayPathCandidate[];
  allowLlm?: boolean;
  provider?: ILlmProvider | null;
}): Promise<DayPathRankResult> {
  const userIntent = String(input.userIntent || '').trim();
  const candidates = Array.isArray(input.candidates) ? input.candidates : [];

  if (process.env.ZAVORTH_DAYPATH_SEMANTIC === '0') {
    return { source: 'fallback', ranked: [] };
  }
  if (input.allowLlm !== true || !input.provider) {
    return { source: 'fallback', ranked: [] };
  }

  const candidateIds = new Set(candidates.map((candidate) => String(candidate.id || '')));
  try {
    const response = await input.provider.chat([
      { role: 'user', content: buildRankPrompt(userIntent, candidates) },
    ]);
    const parsed = parseDayPathRankResponse(response?.content ?? '');
    const ranked = parsed.ranked.filter((entry) => candidateIds.has(entry.id));
    if (ranked.length === 0) {
      return { source: 'fallback', ranked: [] };
    }
    return { source: 'semantic', ranked };
  } catch {
    return { source: 'fallback', ranked: [] };
  }
}

function buildRankPrompt(userIntent: string, candidates: DayPathCandidate[]): string {
  const catalog = candidates
    .map((candidate) => `- ${candidate.id}: ${candidate.command} (${candidate.whenToUse})`)
    .join('\n');
  return [
    `Rank the candidate commands by how well they satisfy the user intent: ${userIntent}`,
    'Candidate commands:',
    catalog,
    'Respond with strict JSON only: {"ranked":[{"id":"candidate id","score":0..1,"why":"short reason"}],"confidence":0..1}',
    'Only use ids from the candidate list.',
  ].join('\n');
}
