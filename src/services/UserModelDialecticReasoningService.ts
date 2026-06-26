import fs from 'fs';
import path from 'path';

export type DialecticDepth = 1 | 2 | 3;

export type DialecticInsight = {
  id: string;
  category: string;
  observation: string;
  confidence: number;
  evidence: string[];
  createdAt: string;
  source: 'conversation' | 'behavior' | 'inference' | 'question';
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
};

export type DialecticReasoningConfig = {
  depth: DialecticDepth;
  maxInsights: number;
  minConversationPairs: number;
  traitCategories: string[];
};

export type DialecticReasoningRuntime = {
  homeRoot?: string;
  now?: () => Date;
  config?: Partial<DialecticReasoningConfig>;
};

const DEFAULT_CONFIG: DialecticReasoningConfig = {
  depth: 2,
  maxInsights: 20,
  minConversationPairs: 3,
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

export class UserModelDialecticReasoningService {
  private readonly homeRoot: string;
  private readonly now: () => Date;
  private readonly config: DialecticReasoningConfig;

  constructor(runtime: DialecticReasoningRuntime = {}) {
    this.homeRoot = runtime.homeRoot || process.cwd();
    this.now = runtime.now || (() => new Date());
    this.config = { ...DEFAULT_CONFIG, ...runtime.config };
  }

  synthesize(conversations: Array<{ user: string; assistant: string }>, options?: {
    userId?: string;
    sessionId?: string;
  }): DialecticSynthesis {
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

    this.saveSynthesis(synthesis);
    return synthesis;
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
    } catch {
      return null;
    }
  }

  private getFilePath(): string {
    return path.join(this.homeRoot, SYNTHESIS_FILE);
  }
}
