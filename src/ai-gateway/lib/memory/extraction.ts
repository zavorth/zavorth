import { createMemory } from './store';
import { MemoryType } from './types';
import { logger } from '@/shared/utils/logger';

const MAX_FACT_LENGTH = 500;
const MIN_FACT_LENGTH = 3;

export interface ExtractedFact {
  key: string;
  content: string;
  type: MemoryType;
  category: 'preference' | 'decision' | 'pattern';
}

type StructuredFactInput = {
  key?: unknown;
  content?: unknown;
  type?: unknown;
  category?: unknown;
};

export function extractFactsFromText(text: string): ExtractedFact[] {
  if (!text || typeof text !== 'string') {
    return [];
  }
  const parsed = parseStructuredFacts(text);
  if (!parsed) {
    return [];
  }

  const seen = new Set<string>();
  const facts: ExtractedFact[] = [];
  for (const entry of parsed) {
    const fact = normalizeStructuredFact(entry);
    if (!fact || seen.has(fact.key)) {
      continue;
    }
    seen.add(fact.key);
    facts.push(fact);
  }
  return facts;
}

export function extractFacts(response: string, apiKeyId: string, sessionId: string): void {
  if (!response || !apiKeyId || !sessionId) {
    return;
  }

  setImmediate(() => {
    const facts = extractFactsFromText(response);
    if (facts.length === 0) {
      return;
    }

    for (const fact of facts) {
      createMemory({
        apiKeyId,
        sessionId,
        type: fact.type,
        key: fact.key,
        content: fact.content,
        metadata: {
          category: fact.category,
          extractedAt: new Date().toISOString(),
          source: 'llm_structured_response',
        },
        expiresAt: null,
      }).catch((err) => {
        if (process.env.NODE_ENV !== 'test') {
          logger.warn('[memory:extraction] Failed to store fact:', err?.message);
        }
      });
    }
  });
}

function parseStructuredFacts(text: string): StructuredFactInput[] | null {
  const trimmed = text.trim();
  if (!isJsonLike(trimmed)) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed as StructuredFactInput[];
    }
    if (Array.isArray(parsed?.facts)) {
      return parsed.facts as StructuredFactInput[];
    }
    if (Array.isArray(parsed?.memoryFacts)) {
      return parsed.memoryFacts as StructuredFactInput[];
    }
  } catch {
    return null;
  }
  return null;
}

function normalizeStructuredFact(entry: StructuredFactInput): ExtractedFact | null {
  const category = normalizeCategory(entry.category);
  const content = normalizeContent(entry.content);
  if (!category || !content) {
    return null;
  }
  const type = normalizeMemoryType(entry.type, category);
  const key = normalizeKey(entry.key) || factKey(category, content);
  return { key, content, type, category };
}

function normalizeCategory(value: unknown): ExtractedFact['category'] | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'preference' || normalized === 'decision' || normalized === 'pattern') {
    return normalized;
  }
  return null;
}

function normalizeMemoryType(value: unknown, category: ExtractedFact['category']): MemoryType {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized && Object.prototype.hasOwnProperty.call(MemoryType, normalized)) {
    return MemoryType[normalized as keyof typeof MemoryType];
  }
  return category === 'decision' ? MemoryType.EPISODIC : MemoryType.FACTUAL;
}

function normalizeContent(value: unknown): string | null {
  const content = collapseWhitespace(String(value || '').trim()).slice(0, MAX_FACT_LENGTH);
  return content.length >= MIN_FACT_LENGTH ? content : null;
}

function normalizeKey(value: unknown): string | null {
  const key = collapseWhitespace(String(value || '').trim());
  return key.length >= MIN_FACT_LENGTH ? key : null;
}

function factKey(category: string, content: string): string {
  return `${category}:${slugify(content).slice(0, 40) || 'fact'}`;
}

function isJsonLike(value: string): boolean {
  return (value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'));
}

function collapseWhitespace(value: string): string {
  let output = '';
  let previousWasSpace = false;
  for (const char of value) {
    const isSpace = char.trim().length === 0;
    if (isSpace) {
      if (!previousWasSpace) {
        output += ' ';
      }
      previousWasSpace = true;
      continue;
    }
    output += char;
    previousWasSpace = false;
  }
  return output.trim();
}

function slugify(value: string): string {
  let output = '';
  let previousWasSeparator = false;
  for (const char of value.toLowerCase()) {
    const isAllowed = (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9');
    if (isAllowed) {
      output += char;
      previousWasSeparator = false;
      continue;
    }
    if (!previousWasSeparator) {
      output += '_';
    }
    previousWasSeparator = true;
  }
  while (output.endsWith('_')) {
    output = output.slice(0, -1);
  }
  return output;
}
