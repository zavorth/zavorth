import type { ILlmProvider } from '../../providers/ILlmProvider.js';

export type FreeTextSemanticKind = 'work' | 'conversation' | 'risk' | 'unknown';

export type FreeTextSemanticDecision = {
  kind: FreeTextSemanticKind;
  confidence: number;
  source: 'llm';
  reason?: string;
};

export type FreeTextSemanticClassification = {
  source: 'empty' | 'structured' | 'llm' | 'fallback';
  kind: FreeTextSemanticKind;
  confidence: number;
};

export function parseFreeTextSemanticDecision(raw: string): FreeTextSemanticDecision | null {
  const content = stripJsonFence(raw).trim();
  if (!content) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  const payload = parsed as Record<string, unknown>;
  const kind = typeof payload.kind === 'string' ? normalizeKind(payload.kind) : null;
  if (!kind) {
    return null;
  }
  const confidence = typeof payload.confidence === 'number' ? payload.confidence : 0;
  return {
    kind,
    confidence,
    source: 'llm',
  };
}

export async function classifyFreeTextSemanticIntent(input: {
  userMessage: string;
  structuredHints?: Record<string, unknown> | null;
  allowLlm?: boolean;
  provider?: ILlmProvider | null;
}): Promise<FreeTextSemanticClassification> {
  const userMessage = String(input.userMessage ?? '').trim();
  if (!userMessage) {
    return { source: 'empty', kind: 'unknown', confidence: 0 };
  }
  if (hasStructuredRisk(input.structuredHints)) {
    return { source: 'structured', kind: 'risk', confidence: 1 };
  }
  if (process.env.ZAVORTH_FREE_TEXT_SEMANTIC === '0') {
    return { source: 'fallback', kind: 'unknown', confidence: 0 };
  }
  if (input.allowLlm !== true || !input.provider) {
    return { source: 'fallback', kind: 'unknown', confidence: 0 };
  }
  try {
    const response = await input.provider.chat([
      { role: 'user', content: buildFreeTextPrompt(userMessage) },
    ]);
    const decision = parseFreeTextSemanticDecision(response?.content ?? '');
    if (!decision) {
      return { source: 'fallback', kind: 'unknown', confidence: 0 };
    }
    return { source: 'llm', kind: decision.kind, confidence: decision.confidence };
  } catch {
    return { source: 'fallback', kind: 'unknown', confidence: 0 };
  }
}

function stripJsonFence(raw: string): string {
  return String(raw ?? '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '');
}

function normalizeKind(kind: string): FreeTextSemanticKind | null {
  if (kind === 'danger') {
    return 'risk';
  }
  if (kind === 'work' || kind === 'conversation' || kind === 'risk' || kind === 'unknown') {
    return kind;
  }
  return null;
}

function hasStructuredRisk(hints: Record<string, unknown> | null | undefined): boolean {
  return Boolean(
    hints
    && typeof hints === 'object'
    && !Array.isArray(hints)
    && Object.values(hints).some((value) => Boolean(value)),
  );
}

function buildFreeTextPrompt(userMessage: string): string {
  return [
    'Classify the user intent of the following message into exactly one kind: work, conversation, risk or unknown.',
    `Message: ${userMessage}`,
    'Respond with strict JSON only: {"kind":"<kind>","confidence":0..1,"reason":"<short reason>"}',
  ].join('\n');
}
