import fs from 'fs';
import path from 'path';

export interface DriftSignal {
  type: 'topic_drift' | 'tone_drift' | 'goal_drift' | 'quality_drop' | 'repetition' | 'hallucination_risk';
  severity: 'low' | 'medium' | 'high';
  description: string;
  detected_at: string;
  evidence: string;
}

export class LLMDriftDetectorService {
  private readonly storageDir: string;
  private signals: DriftSignal[] = [];
  private recentTopics: string[] = [];
  private recentTones: string[] = [];
  private repetitionCount: Map<string, number> = new Map();

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'drift-detector');
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
  }

  public analyze(userMessage: string, assistantResponse: string): DriftSignal[] {
    const signals: DriftSignal[] = [];
    const now = new Date().toISOString();

    const topic = this.extractTopic(userMessage);
    if (this.recentTopics.length > 0) {
      const lastTopic = this.recentTopics[this.recentTopics.length - 1];
      if (topic !== lastTopic && !this.isRelatedTopic(topic, lastTopic)) {
        signals.push({
          type: 'topic_drift',
          severity: 'low',
          description: `Topic shifted from "${lastTopic}" to "${topic}"`,
          detected_at: now,
          evidence: userMessage.slice(0, 100),
        });
      }
    }
    this.recentTopics.push(topic);
    if (this.recentTopics.length > 20) this.recentTopics.shift();

    const responseLower = assistantResponse.toLowerCase();
    const phrases = responseLower.split(/\s+/).slice(0, 20).join(' ');
    const count = this.repetitionCount.get(phrases) || 0;
    this.repetitionCount.set(phrases, count + 1);
    if (count >= 2) {
      signals.push({
        type: 'repetition',
        severity: 'medium',
        description: 'Agent is repeating similar phrases',
        detected_at: now,
        evidence: phrases.slice(0, 100),
      });
    }

    if (responseLower.includes('i think') && responseLower.includes('but i\'m not sure') && responseLower.includes('maybe')) {
      signals.push({
        type: 'quality_drop',
        severity: 'low',
        description: 'Agent expressing low confidence',
        detected_at: now,
        evidence: assistantResponse.slice(0, 100),
      });
    }

    const factPatterns = [
      /\b\d{4}\b.*\b(born|founded|created|invented)\b/i,
      /\b(according to|studies show|research proves)\b/i,
      /\b(always|never|every|all|none)\b.*\b(are|is|was|were)\b/i,
    ];
    for (const pattern of factPatterns) {
      if (pattern.test(assistantResponse)) {
        signals.push({
          type: 'hallucination_risk',
          severity: 'medium',
          description: 'Potential factual claim without citation',
          detected_at: now,
          evidence: assistantResponse.match(pattern)?.[0] || '',
        });
        break;
      }
    }

    this.signals.push(...signals);
    return signals;
  }

  public getSignals(type?: DriftSignal['type']): DriftSignal[] {
    if (type) return this.signals.filter((s) => s.type === type);
    return [...this.signals];
  }

  public getStats(): string {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    for (const s of this.signals) {
      byType[s.type] = (byType[s.type] || 0) + 1;
      bySeverity[s.severity] = (bySeverity[s.severity] || 0) + 1;
    }

    return [
      'Drift Detector Stats:',
      `  Signals: ${this.signals.length}`,
      `  Topics tracked: ${this.recentTopics.length}`,
      `  Repetitions tracked: ${this.repetitionCount.size}`,
      '  By type:',
      ...Object.entries(byType).map(([t, c]) => `    ${t}: ${c}`),
      '  By severity:',
      ...Object.entries(bySeverity).map(([s, c]) => `    ${s}: ${c}`),
    ].join('\n');
  }

  private extractTopic(text: string): string {
    const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const stopWords = new Set(['this', 'that', 'with', 'from', 'have', 'been', 'will', 'would', 'could', 'should', 'about', 'their', 'there', 'where', 'when', 'what', 'which', 'your', 'they', 'them', 'then', 'than']);
    const meaningful = words.filter((w) => !stopWords.has(w));
    return meaningful.slice(0, 3).join(' ') || 'general';
  }

  private isRelatedTopic(a: string, b: string): boolean {
    const wordsA = new Set(a.split(' '));
    const wordsB = new Set(b.split(' '));
    const intersection = [...wordsA].filter((w) => wordsB.has(w));
    return intersection.length > 0;
  }
}
