import type {
  ZavorthAdaptiveSemanticClassification,
  ZavorthAdaptiveSemanticClassifier,
  ZavorthAdaptiveSemanticClassifierInput,
  ZavorthAdaptiveSemanticLlmGate,
} from '../contracts/native/ZavorthAdaptiveLearningSemanticContract.js';
import type {
  ZavorthAdaptiveLearningLaneId,
  ZavorthAdaptiveLearningSensitivity,
  ZavorthUserModelUse,
} from '../contracts/native/ZavorthAdaptiveLearningOsContract.js';
import type { ZavorthLearningMemoryRisk } from '../contracts/ZavorthMemoryLearningLoopContract.js';
import { logger } from '../logger.js';

type SemanticClassifierRuntime = {
  llmGate?: ZavorthAdaptiveSemanticLlmGate | null;
  llmGateTimeoutMs?: number;
};

const LLM_GATE_RESPONSE_SCHEMA =
  '{"language":"string","recommendedLane":"green|yellow|red","sensitivity":"normal|sensitive|blocked","risk":"low|medium|high","confidence":0.0,"reasons":["string"],"usedFor":["response_style|planning_depth|tool_routing|skill_recommendation|memory_recall|safety_only"],"claim":"string|null"}';

export class ZavorthAdaptiveSemanticClassifierService implements ZavorthAdaptiveSemanticClassifier {
  private readonly llmGate: ZavorthAdaptiveSemanticLlmGate | null;
  private readonly llmGateTimeoutMs: number;

  public constructor(runtime: SemanticClassifierRuntime = {}) {
    this.llmGate = runtime.llmGate || null;
    this.llmGateTimeoutMs = Math.max(250, Math.min(Number(runtime.llmGateTimeoutMs || 2500), 10_000));
  }

  public async classify(input: ZavorthAdaptiveSemanticClassifierInput): Promise<ZavorthAdaptiveSemanticClassification> {
    const local = this.localClassify(input);
    if (!this.shouldUseLlmGate(local, input)) {
      return local;
    }
    return this.classifyWithLlmGate(input, local);
  }

  private localClassify(input: ZavorthAdaptiveSemanticClassifierInput): ZavorthAdaptiveSemanticClassification {
    const language = 'unknown';
    const sensitiveTechnical = input.technicalFindings.includes('sensitive-user-state');
    if (sensitiveTechnical) {
      return this.classification({
        language,
        confidence: 0.86,
        recommendedLane: 'red',
        sensitivity: 'sensitive',
        risk: 'medium',
        reasons: ['technical-sensitive-user-state'],
        usedFor: ['safety_only'],
        claim: 'Sensitive user-state inference detected; keep as review-only safety context, not a durable profile belief.',
        evidence: ['semantic-local:sensitive-user-state'],
      });
    }

    return this.classification({
      language,
      confidence: 0.58,
      recommendedLane: 'yellow',
      sensitivity: 'normal',
      risk: 'low',
      reasons: ['semantic-provider-needed'],
      usedFor: ['memory_recall'],
      claim: null,
      evidence: ['semantic-local:low-confidence-observation'],
    });
  }

  private async classifyWithLlmGate(
    input: ZavorthAdaptiveSemanticClassifierInput,
    local: ZavorthAdaptiveSemanticClassification,
  ): Promise<ZavorthAdaptiveSemanticClassification> {
    if (!this.llmGate) return local;
    try {
      const response = await this.withTimeout(
        this.llmGate.classify({
          systemPrompt: [
            'You classify adaptive learning observations for Zavorth.',
            'Use only the redacted text. Do not infer a clinical diagnosis.',
            'Do not approve security-policy, approval, sandbox, shell, secret, or authority changes.',
            'Green is only for high-confidence low-risk reversible preferences.',
            'Yellow is for uncertain or procedural digest review.',
            'Red is for sensitive user-state or approval-required safety context.',
            'Return only valid JSON matching the schema. No prose.',
          ].join('\n'),
          redactedText: this.redact(input.redactedText || input.text),
          technicalFindings: input.technicalFindings,
          sourceSurface: input.sourceSurface || null,
          responseSchema: LLM_GATE_RESPONSE_SCHEMA,
          localClassification: {
            language: local.language,
            confidence: local.confidence,
            recommendedLane: local.recommendedLane,
            sensitivity: local.sensitivity,
            risk: local.risk,
            reasons: local.reasons,
          },
        }),
        this.llmGateTimeoutMs,
      );
      const parsed = this.parseGateResponse(response);
      if (!parsed) {
        return {
          ...local,
          recommendedLane: local.recommendedLane === 'green' && local.confidence < 0.75 ? 'yellow' : local.recommendedLane,
          reasons: Array.from(new Set([...local.reasons, 'semantic-provider-unusable'])),
        };
      }
      return this.providerClassification(parsed, local);
    } catch (error: unknown) {logger.warn('[Zavorth Adaptive Semantic Classifier] parsing failed', error);
    return {
        ...local,
        recommendedLane: local.recommendedLane === 'green' && local.confidence < 0.75 ? 'yellow' : local.recommendedLane,
        reasons: Array.from(new Set([...local.reasons, 'semantic-provider-timeout-or-error'])),
      };
  }
  }

  private classification(input: Omit<ZavorthAdaptiveSemanticClassification, 'provider'>): ZavorthAdaptiveSemanticClassification {
    return {
      provider: 'local-heuristic',
      ...input,
      confidence: this.clamp(input.confidence),
      reasons: input.reasons.length ? input.reasons : ['semantic-local-classification'],
      usedFor: this.uniqueUses(input.usedFor),
      evidence: input.evidence.length ? input.evidence : ['semantic-local'],
    };
  }

  private providerClassification(
    parsed: Record<string, unknown>,
    local: ZavorthAdaptiveSemanticClassification,
  ): ZavorthAdaptiveSemanticClassification {
    const confidence = this.clamp(Number(parsed.confidence ?? 0));
    let recommendedLane = this.validLane(parsed.recommendedLane) || local.recommendedLane;
    let sensitivity = this.validSensitivity(parsed.sensitivity) || local.sensitivity;
    let risk = this.validRisk(parsed.risk) || local.risk;
    const reasons = this.stringArray(parsed.reasons, 'semantic-provider-classification');
    const usedFor = this.validUses(parsed.usedFor, sensitivity);
    const language = this.cleanScalar(parsed.language, local.language, 24);
    const claim = typeof parsed.claim === 'string' && parsed.claim.trim()
      ? this.redact(parsed.claim, 260)
      : null;

    if (risk === 'high' || sensitivity === 'blocked') {
      recommendedLane = 'red';
      sensitivity = 'blocked';
      risk = 'high';
    } else if (sensitivity === 'sensitive' || recommendedLane === 'red') {
      recommendedLane = 'red';
      sensitivity = 'sensitive';
      risk = risk === 'low' ? 'medium' : risk;
    } else if (recommendedLane === 'green' && (confidence < 0.85 || risk !== 'low')) {
      recommendedLane = 'yellow';
      reasons.push('semantic-provider-low-confidence-staged');
    }

    return {
      provider: 'semantic-provider',
      language,
      confidence,
      recommendedLane,
      sensitivity,
      risk,
      reasons: Array.from(new Set(reasons)),
      usedFor,
      claim,
      evidence: ['semantic-provider:llm-gated-json'],
    };
  }

  private shouldUseLlmGate(
    local: ZavorthAdaptiveSemanticClassification,
    input: ZavorthAdaptiveSemanticClassifierInput,
  ): boolean {
    if (!this.llmGate) return false;
    if (input.technicalFindings.includes('sensitive-user-state')) return false;
    if (local.confidence >= 0.75 && local.recommendedLane !== 'yellow') return false;
    return true;
  }

  private parseGateResponse(value: unknown): Record<string, unknown> | null {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const jsonText = raw.match(/\{[\s\S]*\}/)?.[0] || raw;
    try {
      const parsed = JSON.parse(jsonText);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch (error: unknown) {logger.warn('[Zavorth Adaptive Semantic Classifier] JSON parse failed', error); return null; }
  }

  private validLane(value: unknown): ZavorthAdaptiveLearningLaneId | null {
    return value === 'green' || value === 'yellow' || value === 'red' ? value : null;
  }

  private validSensitivity(value: unknown): ZavorthAdaptiveLearningSensitivity | null {
    return value === 'normal' || value === 'sensitive' || value === 'blocked' ? value : null;
  }

  private validRisk(value: unknown): ZavorthLearningMemoryRisk | null {
    return value === 'low' || value === 'medium' || value === 'high' ? value : null;
  }

  private validUses(value: unknown, sensitivity: ZavorthAdaptiveLearningSensitivity): ZavorthUserModelUse[] {
    if (sensitivity !== 'normal') return ['safety_only'];
    const allowed = new Set<ZavorthUserModelUse>([
      'response_style',
      'planning_depth',
      'tool_routing',
      'skill_recommendation',
      'memory_recall',
      'safety_only',
    ]);
    const uses = Array.isArray(value)
      ? value.filter((entry): entry is ZavorthUserModelUse => allowed.has(entry as ZavorthUserModelUse))
      : [];
    return uses.length ? Array.from(new Set(uses)) : ['memory_recall'];
  }

  private stringArray(value: unknown, fallback: string): string[] {
    const entries = Array.isArray(value)
      ? value.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [];
    return entries.length ? entries.slice(0, 8) : [fallback];
  }

  private cleanScalar(value: unknown, fallback: string, maxChars: number): string {
    const text = String(value ?? '').trim();
    return (text || fallback).replace(/\s+/g, '-').slice(0, maxChars) || fallback;
  }

  private redact(value: unknown, maxChars = 1200): string {
    return String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxChars)
      .replace(/\b(token|secret|password|api[_ -]...key|private[_ -]...key|credential)\s*[:=]\s*\S+/gi, '$1=[REDACTED]')
      .replace(/\b(?:sk-|hf_|AIza|xoxb-|ghp_)[A-Za-z0-9_-]{6,}\b/g, '[REDACTED_SECRET]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]');
  }

  private uniqueUses(uses: ZavorthUserModelUse[]): ZavorthUserModelUse[] {
    return Array.from(new Set(uses));
  }

  private clamp(value: number): number {
    return Number(Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)).toFixed(3));
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error('semantic llm gate timed out')), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
