import fs from 'fs';
import path from 'path';

import { ZavorthLlmRuntimeService } from './ZavorthLlmRuntimeService.js';
import { logger } from '../logger.js';

export type DialecticDepth = 1 | 2 | 3 | 4;

export type DialecticInsight = {
  id: string;
  category: string;
  observation: string;
  confidence: number;
  evidence: string[];
  createdAt: string;
  source: 'conversation' | 'behavior' | 'inference' | 'question' | 'llm_synthesis';
};

export type DialecticSynthesis = {
  contractVersion: string;
  generatedAt: string;
  userId: string | null;
  sessionId: string | null;
  insights: DialecticInsight[];
  traits: Record<string, string>;
  patterns: string[];
  recommendations: string[];
  depth: DialecticDepth;
  confidence: number;
  llmSynthesis?: {
    providerName: string;
    modelName: string | null;
    rawOutput: string;
    deepInsights: string[];
    inputTokens: number;
    outputTokens: number;
  };
};

export type DialecticReasoningConfig = {
  depth: DialecticDepth;
  maxInsights: number;
  minConversationPairs: number;
  traitCategories: string[];
  llmProvider?: string;
  llmModel?: string;
  llmMaxPasses: number;
};

export type DialecticReasoningRuntime = {
  homeRoot?: string;
  now?: () => Date;
  config?: Partial<DialecticReasoningConfig>;
  llmService?: ZavorthLlmRuntimeService;
};

const DEFAULT_CONFIG: DialecticReasoningConfig = {
  depth: 2,
  maxInsights: 20,
  minConversationPairs: 3,
  llmMaxPasses: 3,
  traitCategories: [
    'communication_style',
    'work_preferences',
    'domain_expertise',
    'tool_preferences',
    'schedule',
    'personality',
  ],
};

const SYNTHESIS_FILE = 'data/runtime/user-dialectic-synthesis.json';

const INFERENCE_PATTERNS: Array<{ pattern: RegExp; trait: string; confidence: number }> = [
  { pattern: /\b(direto|curto|rapido|succinto|brief)\b/i, trait: 'communication_style', confidence: 0.6 },
  { pattern: /\b(detalhado|completo|exemplo|explicacao|profundo)\b/i, trait: 'communication_style', confidence: 0.6 },
  { pattern: /\b(python|typescript|javascript|rust|go|java)\b/i, trait: 'domain_expertise', confidence: 0.5 },
  { pattern: /\b(producao|deploy|docker|kubernetes|ci\/cd)\b/i, trait: 'domain_expertise', confidence: 0.5 },
  { pattern: /\b(revisar|review|audit|analisar)\b/i, trait: 'tool_preferences', confidence: 0.4 },
  { pattern: /\b(criar|escrever|implementar|build)\b/i, trait: 'tool_preferences', confidence: 0.4 },
  { pattern: /\b(manha|cedo|morning)\b/i, trait: 'schedule', confidence: 0.3 },
  { pattern: /\b(noite|tarde|evening)\b/i, trait: 'schedule', confidence: 0.3 },
  { pattern: /\b(humor|engracado|engraçado|divertido)\b/i, trait: 'personality', confidence: 0.4 },
  { pattern: /\b(serio|formal|profissional)\b/i, trait: 'personality', confidence: 0.4 },
];

const LLM_SYNTHESIS_SYSTEM_PROMPT = `You are a user-behavior analyst for a conversational AI agent called Zavorth.

Given a set of user-assistant conversation pairs, analyze the user's behavior and extract deep insights about:

1. **Communication style**: How does the user prefer to communicate? Direct/verbose, formal/casual, question-heavy or command-heavy?
2. **Domain expertise**: What technical domains does the user work in? What is their apparent skill level?
3. **Work preferences**: How do they prefer to work? Do they want the agent to act autonomously or ask first?
4. **Personality traits**: What personality patterns emerge? Do they value humor, directness, thoroughness?
5. **Tool preferences**: What tools and workflows do they favor?
6. **Schedule patterns**: Any indicators of work schedule or preferred interaction times?
7. **Hidden patterns**: Any deeper behavioral patterns not immediately obvious from surface-level analysis?

For each insight, provide:
- category: one of communication_style, work_preferences, domain_expertise, tool_preferences, schedule, personality, hidden_pattern
- observation: a clear description of the insight
- confidence: a number between 0 and 1
- reasoning: WHY you believe this, citing specific evidence from the conversations

Return your analysis as a JSON array of objects with fields: category, observation, confidence, reasoning.
Focus on INSIGHTS that go beyond simple keyword matching — what can you infer about this user as a person and professional?

Example output:
[
  {
    "category": "domain_expertise",
    "observation": "Senior backend engineer with strong DevOps background, likely 5+ years experience",
    "confidence": 0.85,
    "reasoning": "User mentions Docker, Kubernetes, CI/CD naturally without explanation, uses production terminology correctly, and asks about deployment patterns rather than basics"
  }
]`;

export class UserModelDialecticReasoningService {
  private readonly homeRoot: string;
  private readonly now: () => Date;
  private readonly config: DialecticReasoningConfig;
  private readonly llmService: ZavorthLlmRuntimeService | null;

  constructor(runtime: DialecticReasoningRuntime = {}) {
    this.homeRoot = runtime.homeRoot || process.cwd();
    this.now = runtime.now || (() => new Date());
    this.config = { ...DEFAULT_CONFIG, ...runtime.config };
    this.llmService = runtime.llmService || null;
  }

  async synthesize(conversations: Array<{ user: string; assistant: string }>, options?: {
    userId?: string;
    sessionId?: string;
  }): Promise<DialecticSynthesis> {
    const insights: DialecticInsight[] = [];
    const allTraits: Record<string, string[]> = {};
    const patterns: string[] = [];

    for (const pair of conversations) {
      const userInsights = this.extractInsights(pair.user, 'user_message');
      insights.push(...userInsights);

      for (const insight of userInsights) {
        if (!allTraits[insight.category]) allTraits[insight.category] = [];
        allTraits[insight.category].push(insight.observation);
      }
    }

    if (this.config.depth >= 2) {
      const crossPatterns = this.findCrossConversationPatterns(conversations);
      patterns.push(...crossPatterns);
    }

    if (this.config.depth >= 3) {
      const inferredTraits = this.inferTraitsFromPatterns(patterns);
      for (const [category, values] of Object.entries(inferredTraits)) {
        if (!allTraits[category]) allTraits[category] = [];
        allTraits[category].push(...values);
      }
    }

    const traits: Record<string, string> = {};
    for (const [category, values] of Object.entries(allTraits)) {
      traits[category] = this.resolveTraitValue(values);
    }

    const recommendations = this.generateRecommendations(traits, patterns);

    const synthesis: DialecticSynthesis = {
      contractVersion: 'zavorth-dialectic-reasoning/1',
      generatedAt: this.now().toISOString(),
      userId: options?.userId || null,
      sessionId: options?.sessionId || null,
      insights: insights.slice(0, this.config.maxInsights),
      traits,
      patterns,
      recommendations,
      depth: this.config.depth,
      confidence: this.calculateConfidence(insights, conversations.length),
    };

    if (this.config.depth >= 4 && this.llmService) {
      const llmResult = await this.runLlmSynthesis(conversations, synthesis);
      if (llmResult) {
        synthesis.llmSynthesis = llmResult;
        for (const deepInsight of llmResult.deepInsights) {
          synthesis.insights.push({
            id: `llm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            category: 'llm_synthesis',
            observation: deepInsight,
            confidence: 0.8,
            evidence: ['LLM multi-pass analysis'],
            createdAt: this.now().toISOString(),
            source: 'llm_synthesis',
          });
        }
        synthesis.confidence = Math.min(synthesis.confidence + 0.15, 1.0);
      }
    }

    this.saveSynthesis(synthesis);
    return synthesis;
  }

  private async runLlmSynthesis(
    conversations: Array<{ user: string; assistant: string }>,
    baseSynthesis: DialecticSynthesis,
  ): Promise<DialecticSynthesis['llmSynthesis'] | null> {
    if (!this.llmService) return null;

    const conversationSummary = conversations
      .slice(0, 20)
      .map((c, i) => `[Turn ${i + 1}]\nUser: ${c.user.slice(0, 500)}\nAssistant: ${c.assistant.slice(0, 500)}`)
      .join('\n\n');

    const baseContext = `\n\n--- Pre-analysis from regex-based reasoning ---\n` +
      `Traits detected: ${JSON.stringify(baseSynthesis.traits)}\n` +
      `Patterns found: ${baseSynthesis.patterns.join('; ')}\n` +
      `Confidence: ${baseSynthesis.confidence}\n` +
      `--- End pre-analysis ---`;

    const maxPasses = Math.max(1, Math.min(this.config.llmMaxPasses, 3));
    let lastOutput = '';
    const allDeepInsights: string[] = [];

    for (let pass = 0; pass < maxPasses; pass++) {
      const passPrompt = pass === 0
        ? `Analyze these conversation pairs and extract deep user behavior insights.\n${conversationSummary}${baseContext}`
        : `Pass ${pass + 1}: Refine your previous analysis. Focus on subtler patterns, contradictions, or deeper inferences.\n\nPrevious analysis:\n${lastOutput}\n\nRe-read the conversations:\n${conversationSummary}`;

      const result = await this.llmService.synthesize(LLM_SYNTHESIS_SYSTEM_PROMPT, passPrompt, {
        providerName: this.config.llmProvider,
        modelName: this.config.llmModel,
        allowFallback: true,
      });

      lastOutput = result.content;

      try {
        const parsed = this.parseLlmOutput(result.content);
        for (const item of parsed) {
          const obs = String(item.observation || '').trim();
          if (obs && !allDeepInsights.includes(obs)) {
            allDeepInsights.push(obs);
          }
        }
      } catch (error: unknown) {if (lastOutput.trim().length > 20) {
          allDeepInsights.push(lastOutput.trim().slice(0, 500));
        }
      }
    }

    if (allDeepInsights.length === 0 && lastOutput.trim().length > 0) {
      allDeepInsights.push(lastOutput.trim().slice(0, 500));
    }

    return {
      providerName: this.config.llmProvider || this.llmService.getPreferredProviderName(),
      modelName: this.config.llmModel || null,
      rawOutput: lastOutput,
      deepInsights: allDeepInsights.slice(0, 15),
      inputTokens: 0,
      outputTokens: 0,
    };
  }

  private parseLlmOutput(content: string): Array<{ category: string; observation: string; confidence: number; reasoning: string }> {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  }

  private extractInsights(text: string, source: 'user_message' | 'assistant_response'): DialecticInsight[] {
    const insights: DialecticInsight[] = [];

    for (const { pattern, trait, confidence } of INFERENCE_PATTERNS) {
      if (pattern.test(text)) {
        insights.push({
          id: `insight-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          category: trait,
          observation: text.slice(0, 200),
          confidence,
          evidence: [text.slice(0, 100)],
          createdAt: this.now().toISOString(),
          source: source === 'user_message' ? 'conversation' : 'behavior',
        });
      }
    }

    const questionPatterns = /\b(como|qual|onde|quando|por que|porque|prefiro|gosto|nao gosto|quero|preciso)\b/i;
    if (questionPatterns.test(text) && text.length > 20) {
      insights.push({
        id: `inquiry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        category: 'inquiry',
        observation: text.slice(0, 200),
        confidence: 0.3,
        evidence: [text.slice(0, 100)],
        createdAt: this.now().toISOString(),
        source: 'inference',
      });
    }

    return insights;
  }

  private findCrossConversationPatterns(conversations: Array<{ user: string; assistant: string }>): string[] {
    const patterns: string[] = [];
    const userMessages = conversations.map((c) => c.user.toLowerCase());

    const repeatedTopics = new Map<string, number>();
    for (const msg of userMessages) {
      const words = msg.split(/\s+/).filter((w) => w.length > 3);
      for (const word of words) {
        repeatedTopics.set(word, (repeatedTopics.get(word) || 0) + 1);
      }
    }

    for (const [word, count] of repeatedTopics) {
      if (count >= 3) {
        patterns.push(`Repeated topic: "${word}" (${count} times)`);
      }
    }

    const questionCount = userMessages.filter((m) => /\?/.test(m)).length;
    if (questionCount > userMessages.length * 0.5) {
      patterns.push('User asks many questions (inquiry-heavy style)');
    }

    const commandCount = userMessages.filter((m) => /\b(faça|execute|rode|run|crie|create|delet|edit)\b/i.test(m)).length;
    if (commandCount > userMessages.length * 0.3) {
      patterns.push('User gives many direct commands (command-heavy style)');
    }

    return patterns;
  }

  private inferTraitsFromPatterns(patterns: string[]): Record<string, string[]> {
    const traits: Record<string, string[]> = {};

    for (const pattern of patterns) {
      if (pattern.includes('inquiry-heavy')) {
        traits.communication_style = traits.communication_style || [];
        traits.communication_style.push('提问型 - 偏好提问和讨论');
      }
      if (pattern.includes('command-heavy')) {
        traits.communication_style = traits.communication_style || [];
        traits.communication_style.push('指令型 - 偏好直接命令');
      }
    }

    return traits;
  }

  private resolveTraitValue(values: string[]): string {
    const counts = new Map<string, number>();
    for (const v of values) {
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    let best = values[0] || '';
    let bestCount = 0;
    for (const [value, count] of counts) {
      if (count > bestCount) {
        best = value;
        bestCount = count;
      }
    }
    return best;
  }

  private generateRecommendations(traits: Record<string, string>, patterns: string[]): string[] {
    const recs: string[] = [];

    if (traits.communication_style) {
      recs.push(`Adapt response style: ${traits.communication_style}`);
    }
    if (traits.schedule) {
      recs.push(`Respect schedule preference: ${traits.schedule}`);
    }
    if (patterns.some((p) => p.includes('inquiry-heavy'))) {
      recs.push('User prefers questions and discussion over direct action');
    }
    if (patterns.some((p) => p.includes('command-heavy'))) {
      recs.push('User prefers direct execution over discussion');
    }

    return recs;
  }

  private calculateConfidence(insights: DialecticInsight[], conversationCount: number): number {
    if (conversationCount === 0) return 0;
    const avgConfidence = insights.length > 0
      ? insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length
      : 0;
    const volumeFactor = Math.min(conversationCount / 10, 1);
    return Math.round(avgConfidence * volumeFactor * 100) / 100;
  }

  private saveSynthesis(synthesis: DialecticSynthesis): void {
    const fp = this.getFilePath();
    const dir = path.dirname(fp);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fp, JSON.stringify(synthesis, null, 2), 'utf-8');
  }

  loadSynthesis(): DialecticSynthesis | null {
    const fp = this.getFilePath();
    if (!fs.existsSync(fp)) return null;
    try {
      return JSON.parse(fs.readFileSync(fp, 'utf-8'));
    } catch (error: unknown) {logger.warn('[User Model Dialectic Reasoning] JSON parse failed', error); return null; }
  }

  private getFilePath(): string {
    return path.join(this.homeRoot, SYNTHESIS_FILE);
  }
}
