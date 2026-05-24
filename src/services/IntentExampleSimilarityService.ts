import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';
import type {
  NaturalFirstIntentKind,
  NaturalFirstRiskLevel,
  NaturalFirstRoute,
} from '../runtime/agent/NaturalFirstRunClassifier.js';

export type IntentExampleRecord = {
  text: string;
  intent: NaturalFirstIntentKind;
  route: NaturalFirstRoute;
  risk: NaturalFirstRiskLevel;
  signals?: string[];
};

export type IntentExampleMatch = IntentExampleRecord & {
  score: number;
};

type IntentExampleSimilarityRuntime = {
  examplesPath?: string;
  readFileSync?: typeof fs.readFileSync;
  existsSync?: typeof fs.existsSync;
};

const DEFAULT_MIN_SCORE = 0.42;

export class IntentExampleSimilarityService {
  private readonly examplesPath: string;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly existsSync: typeof fs.existsSync;
  private cache: IntentExampleRecord[] | null = null;

  constructor(runtime: IntentExampleSimilarityRuntime = {}) {
    this.examplesPath = runtime.examplesPath || path.join(config.projectRoot, 'config', 'intent-examples.json');
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
  }

  public match(text: string, minScore = DEFAULT_MIN_SCORE): IntentExampleMatch | null {
    const queryTokens = tokenize(text);
    if (queryTokens.size === 0) {
      return null;
    }

    let best: IntentExampleMatch | null = null;
    for (const example of this.readExamples()) {
      const score = cosine(queryTokens, tokenize(example.text));
      if (!best || score > best.score) {
        best = { ...example, score: Number(score.toFixed(4)) };
      }
    }
    return best && best.score >= minScore ? best : null;
  }

  public readExamples(): IntentExampleRecord[] {
    if (this.cache) {
      return this.cache;
    }
    if (!this.existsSync(this.examplesPath)) {
      this.cache = [];
      return this.cache;
    }
    try {
      const parsed = JSON.parse(String(this.readFileSync(this.examplesPath, 'utf8') || '{}'));
      const examples = Array.isArray(parsed.examples) ? parsed.examples : [];
      const normalized: IntentExampleRecord[] = examples
        .map(normalizeExample)
        .filter((entry: IntentExampleRecord | null): entry is IntentExampleRecord => Boolean(entry));
      this.cache = normalized;
      return this.cache;
    } catch {
      this.cache = [];
      return this.cache;
    }
  }
}

function normalizeExample(value: unknown): IntentExampleRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const text = String(record.text || '').trim();
  const intent = String(record.intent || '').trim() as NaturalFirstIntentKind;
  const route = String(record.route || '').trim() as NaturalFirstRoute;
  const risk = String(record.risk || '').trim() as NaturalFirstRiskLevel;
  if (!text || !intent || !route || !['safe', 'attention', 'danger'].includes(risk)) {
    return null;
  }
  return {
    text,
    intent,
    route,
    risk,
    signals: Array.isArray(record.signals)
      ? record.signals.map((item) => String(item || '').trim()).filter(Boolean)
      : [],
  };
}

function tokenize(text: string): Map<string, number> {
  const tokens = String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9_.:-]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  const vector = new Map<string, number>();
  for (const token of tokens) {
    vector.set(token, (vector.get(token) || 0) + 1);
  }
  return vector;
}

function cosine(left: Map<string, number>, right: Map<string, number>): number {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (const value of left.values()) {
    leftMagnitude += value * value;
  }
  for (const value of right.values()) {
    rightMagnitude += value * value;
  }
  for (const [token, value] of left.entries()) {
    dot += value * (right.get(token) || 0);
  }
  if (!leftMagnitude || !rightMagnitude) {
    return 0;
  }
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}
