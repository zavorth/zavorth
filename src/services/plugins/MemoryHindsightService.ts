import fs from 'fs';
import path from 'path';

export interface Decision {
  id: string;
  description: string;
  context: string;
  options: string[];
  chosen: string;
  reasoning: string;
  outcome: string | null;
  outcome_score: number | null;
  tags: string[];
  created_at: string;
  resolved_at: string | null;
  metadata: Record<string, unknown>;
}

export interface HindsightRecommendation {
  decision_id: string;
  original_choice: string;
  recommended_choice: string;
  confidence: number;
  reasoning: string;
  lesson: string;
}

export class MemoryHindsightService {
  private readonly storageDir: string;
  private decisions: Map<string, Decision> = new Map();
  private lessons: Array<{ lesson: string; source_ids: string[]; confidence: number; created_at: string }> = [];
  private readonly MAX_DECISIONS = 5000;
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'hindsight');
    this.ensureStorageDir();
    this.loadData();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private loadData(): void {
    const decisionsPath = path.join(this.storageDir, 'decisions.json');
    const lessonsPath = path.join(this.storageDir, 'lessons.json');

    if (fs.existsSync(decisionsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(decisionsPath, 'utf-8'));
        for (const [id, dec] of Object.entries(data as Record<string, Decision>)) {
          this.decisions.set(id, dec);
        }
      } catch { /* ignore */ }
    }

    if (fs.existsSync(lessonsPath)) {
      try {
        this.lessons = JSON.parse(fs.readFileSync(lessonsPath, 'utf-8'));
      } catch { /* ignore */ }
    }
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (this.dirty) {
        this.dirty = false;
        fs.writeFileSync(path.join(this.storageDir, 'decisions.json'), JSON.stringify(Object.fromEntries(this.decisions), null, 2), 'utf-8');
        fs.writeFileSync(path.join(this.storageDir, 'lessons.json'), JSON.stringify(this.lessons, null, 2), 'utf-8');
      }
    }, 2000);
  }

  public recordDecision(description: string, context: string, options: string[], chosen: string, reasoning: string, tags?: string[]): string {
    if (this.decisions.size >= this.MAX_DECISIONS) {
      this.evictOldest();
    }

    const id = `dec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const decision: Decision = {
      id,
      description,
      context,
      options,
      chosen,
      reasoning,
      outcome: null,
      outcome_score: null,
      tags: tags || [],
      created_at: new Date().toISOString(),
      resolved_at: null,
      metadata: {},
    };

    this.decisions.set(id, decision);
    this.scheduleFlush();
    return `Decision recorded: ${id} | Chosen: "${chosen}" from ${options.length} options`;
  }

  public recordOutcome(decisionId: string, outcome: string, score: number): string {
    const decision = this.decisions.get(decisionId);
    if (!decision) return `Error: decision "${decisionId}" not found.`;

    decision.outcome = outcome;
    decision.outcome_score = Math.max(-1, Math.min(1, score));
    decision.resolved_at = new Date().toISOString();

    this.extractLesson(decision);
    this.scheduleFlush();
    return `Outcome recorded for "${decisionId}": score=${score.toFixed(2)} | ${outcome}`;
  }

  public getRecommendation(context: string, options: string[]): HindsightRecommendation | null {
    const relevantDecisions = Array.from(this.decisions.values()).filter(
      (d) => d.outcome_score !== null && this.contextSimilarity(d.context, context) > 0.3,
    );

    if (relevantDecisions.length === 0) return null;

    const optionScores: Record<string, { totalScore: number; count: number; reasoning: string[] }> = {};
    for (const opt of options) {
      optionScores[opt] = { totalScore: 0, count: 0, reasoning: [] };
    }

    for (const decision of relevantDecisions) {
      const similarity = this.contextSimilarity(decision.context, context);
      const weight = similarity * (decision.outcome_score || 0);

      for (const opt of options) {
        const choiceSimilarity = this.stringSimilarity(decision.chosen, opt);
        if (choiceSimilarity > 0.5) {
          optionScores[opt].totalScore += weight;
          optionScores[opt].count++;
          if (decision.outcome) optionScores[opt].reasoning.push(decision.outcome.slice(0, 100));
        }
      }
    }

    let bestOption = options[0];
    let bestScore = -Infinity;
    for (const opt of options) {
      const avg = optionScores[opt].count > 0 ? optionScores[opt].totalScore / optionScores[opt].count : 0;
      if (avg > bestScore) {
        bestScore = avg;
        bestOption = opt;
      }
    }

    return {
      decision_id: 'recommendation',
      original_choice: bestOption,
      recommended_choice: bestOption,
      confidence: Math.min(1, Math.max(0, (bestScore + 1) / 2)),
      reasoning: `Based on ${relevantDecisions.length} similar past decisions with avg score ${(bestScore * 100).toFixed(0)}%`,
      lesson: this.lessons.find((l) => l.confidence > 0.7)?.lesson || 'No strong lesson extracted yet.',
    };
  }

  public getRecommendationAsString(context: string, options: string[]): string {
    const rec = this.getRecommendation(context, options);
    if (!rec) return 'No past decisions found to base recommendation on.';

    return [
      `Hindsight Recommendation:`,
      `  Recommended: "${rec.recommended_choice}"`,
      `  Confidence: ${(rec.confidence * 100).toFixed(0)}%`,
      `  Reasoning: ${rec.reasoning}`,
      `  Lesson: ${rec.lesson}`,
    ].join('\n');
  }

  public getDecision(decisionId: string): string {
    const decision = this.decisions.get(decisionId);
    if (!decision) return `Error: decision "${decisionId}" not found.`;

    return [
      `Decision: ${decision.id}`,
      `  Description: ${decision.description}`,
      `  Context: ${decision.context}`,
      `  Options: ${decision.options.join(', ')}`,
      `  Chosen: ${decision.chosen}`,
      `  Reasoning: ${decision.reasoning}`,
      `  Outcome: ${decision.outcome || 'pending'}`,
      `  Score: ${decision.outcome_score !== null ? decision.outcome_score.toFixed(2) : 'pending'}`,
      `  Tags: ${decision.tags.join(', ')}`,
      `  Created: ${decision.created_at}`,
      `  Resolved: ${decision.resolved_at || 'pending'}`,
    ].join('\n');
  }

  public getLessons(limit: number = 10): string {
    if (this.lessons.length === 0) return 'No lessons extracted yet.';

    const sorted = [...this.lessons].sort((a, b) => b.confidence - a.confidence);
    const lines: string[] = [`Hindsight Lessons (${sorted.length}):`];
    for (const lesson of sorted.slice(0, limit)) {
      lines.push(`  [${(lesson.confidence * 100).toFixed(0)}%] ${lesson.lesson}`);
      lines.push(`    Sources: ${lesson.source_ids.length} decisions`);
    }
    return lines.join('\n');
  }

  public getDecisionQuality(): string {
    const resolved = Array.from(this.decisions.values()).filter((d) => d.outcome_score !== null);
    if (resolved.length === 0) return 'No resolved decisions to analyze.';

    const scores = resolved.map((d) => d.outcome_score!);
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    const positive = scores.filter((s) => s > 0).length;
    const negative = scores.filter((s) => s < 0).length;
    const neutral = scores.filter((s) => s === 0).length;

    const tagScores: Record<string, { total: number; count: number }> = {};
    for (const decision of resolved) {
      for (const tag of decision.tags) {
        if (!tagScores[tag]) tagScores[tag] = { total: 0, count: 0 };
        tagScores[tag].total += decision.outcome_score!;
        tagScores[tag].count++;
      }
    }

    const tagLines = Object.entries(tagScores)
      .map(([tag, data]) => `    ${tag}: ${(data.total / data.count * 100).toFixed(0)}% (${data.count} decisions)`)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 10)
      .join('\n');

    return [
      `Decision Quality Analysis:`,
      `  Total resolved: ${resolved.length}`,
      `  Average score: ${(avg * 100).toFixed(0)}%`,
      `  Positive outcomes: ${positive} (${((positive / resolved.length) * 100).toFixed(0)}%)`,
      `  Negative outcomes: ${negative} (${((negative / resolved.length) * 100).toFixed(0)}%)`,
      `  Neutral outcomes: ${neutral} (${((neutral / resolved.length) * 100).toFixed(0)}%)`,
      `  By topic:\n${tagLines}`,
    ].join('\n');
  }

  public listPendingDecisions(): string {
    const pending = Array.from(this.decisions.values()).filter((d) => d.outcome === null);
    if (pending.length === 0) return 'No pending decisions.';

    const lines: string[] = [`Pending decisions (${pending.length}):`];
    for (const dec of pending.slice(0, 20)) {
      lines.push(`  ${dec.id}: ${dec.description} | Chosen: "${dec.chosen}" | ${dec.created_at}`);
    }
    return lines.join('\n');
  }

  public delete(decisionId: string): string {
    if (!this.decisions.has(decisionId)) return `Error: decision "${decisionId}" not found.`;
    this.decisions.delete(decisionId);
    this.scheduleFlush();
    return `Decision "${decisionId}" deleted.`;
  }

  public getStats(): string {
    const resolved = Array.from(this.decisions.values()).filter((d) => d.outcome_score !== null);
    const pending = this.decisions.size - resolved.length;
    const avgScore = resolved.length > 0 ? resolved.reduce((s, d) => s + (d.outcome_score || 0), 0) / resolved.length : 0;

    return [
      `Hindsight Stats:`,
      `  Total decisions: ${this.decisions.size}/${this.MAX_DECISIONS}`,
      `  Resolved: ${resolved.length}`,
      `  Pending: ${pending}`,
      `  Lessons learned: ${this.lessons.length}`,
      `  Avg outcome score: ${(avgScore * 100).toFixed(0)}%`,
      `  Resolution rate: ${this.decisions.size > 0 ? ((resolved.length / this.decisions.size) * 100).toFixed(0) : 0}%`,
    ].join('\n');
  }

  private extractLesson(decision: Decision): void {
    if (!decision.outcome_score || decision.outcome_score < 0.3) return;

    const lessonText = `When facing "${decision.description}", choosing "${decision.chosen}" led to ${decision.outcome_score > 0.5 ? 'positive' : 'mixed'} results. ${decision.outcome || ''}`;
    const existing = this.lessons.find((l) => l.source_ids.includes(decision.id));

    if (existing) {
      existing.lesson = lessonText;
      existing.confidence = Math.min(1, existing.confidence + 0.1);
    } else {
      this.lessons.push({
        lesson: lessonText,
        source_ids: [decision.id],
        confidence: 0.5,
        created_at: new Date().toISOString(),
      });
    }
  }

  private contextSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    let overlap = 0;
    for (const word of wordsA) {
      if (wordsB.has(word) && word.length > 3) overlap++;
    }
    const maxSize = Math.max(wordsA.size, wordsB.size);
    return maxSize > 0 ? overlap / maxSize : 0;
  }

  private stringSimilarity(a: string, b: string): number {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    if (aLower === bLower) return 1;
    if (aLower.includes(bLower) || bLower.includes(aLower)) return 0.8;
    const wordsA = new Set(aLower.split(/\s+/));
    const wordsB = new Set(bLower.split(/\s+/));
    let overlap = 0;
    for (const word of wordsA) {
      if (wordsB.has(word)) overlap++;
    }
    return Math.max(wordsA.size, wordsB.size) > 0 ? overlap / Math.max(wordsA.size, wordsB.size) : 0;
  }

  private evictOldest(): void {
    const sorted = Array.from(this.decisions.entries()).sort((a, b) => new Date(a[1].created_at).getTime() - new Date(b[1].created_at).getTime());
    const toRemove = Math.max(1, Math.floor(this.MAX_DECISIONS * 0.1));
    for (let i = 0; i < toRemove && i < sorted.length; i++) {
      this.decisions.delete(sorted[i][0]);
    }
  }
}
