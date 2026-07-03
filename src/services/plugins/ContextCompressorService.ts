import fs from 'fs';
import path from 'path';

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  tokens?: number;
  tool_calls?: Array<{ name: string; args: Record<string, unknown> }>;
}

export interface CompressedContext {
  original_turns: number;
  compressed_turns: number;
  original_tokens: number;
  compressed_tokens: number;
  compression_ratio: number;
  summary: string;
  key_facts: string[];
  preserved_turns: ConversationTurn[];
  archived_turns: ConversationTurn[];
}

export interface CompressionStrategy {
  name: string;
  description: string;
  max_turns: number;
  max_tokens: number;
  preserve_recent: number;
  summarize_old: boolean;
  extract_facts: boolean;
  keep_tool_results: boolean;
}

export class ContextCompressorService {
  private readonly storageDir: string;
  private strategies: Map<string, CompressionStrategy> = new Map();
  private compressionHistory: Array<{ timestamp: string; strategy: string; before: number; after: number }> = [];

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'context-compression');
    this.ensureStorageDir();
    this.initDefaultStrategies();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private initDefaultStrategies(): void {
    this.strategies.set('conservative', {
      name: 'Conservative',
      description: 'Keep most context, summarize only when necessary',
      max_turns: 50,
      max_tokens: 32000,
      preserve_recent: 20,
      summarize_old: true,
      extract_facts: true,
      keep_tool_results: true,
    });

    this.strategies.set('balanced', {
      name: 'Balanced',
      description: 'Balance between context and token savings',
      max_turns: 30,
      max_tokens: 16000,
      preserve_recent: 10,
      summarize_old: true,
      extract_facts: true,
      keep_tool_results: false,
    });

    this.strategies.set('aggressive', {
      name: 'Aggressive',
      description: 'Maximum compression, keep only essential context',
      max_turns: 15,
      max_tokens: 8000,
      preserve_recent: 5,
      summarize_old: true,
      extract_facts: true,
      keep_tool_results: false,
    });

    this.strategies.set('fact-only', {
      name: 'Fact Only',
      description: 'Keep only extracted facts and recent turns',
      max_turns: 10,
      max_tokens: 4000,
      preserve_recent: 3,
      summarize_old: false,
      extract_facts: true,
      keep_tool_results: false,
    });
  }

  public compress(turns: ConversationTurn[], strategyName: string = 'balanced'): CompressedContext {
    const strategy = this.strategies.get(strategyName) || this.strategies.get('balanced')!;
    const originalTokens = this.estimateTokens(turns);

    if (turns.length <= strategy.max_turns && originalTokens <= strategy.max_tokens) {
      return {
        original_turns: turns.length,
        compressed_turns: turns.length,
        original_tokens: originalTokens,
        compressed_tokens: originalTokens,
        compression_ratio: 1.0,
        summary: '',
        key_facts: [],
        preserved_turns: turns,
        archived_turns: [],
      };
    }

    const recentTurns = turns.slice(-strategy.preserve_recent);
    const oldTurns = turns.slice(0, -strategy.preserve_recent);

    const keyFacts = strategy.extract_facts ? this.extractFacts(oldTurns) : [];
    const summary = strategy.summarize_old ? this.generateSummary(oldTurns) : '';

    const preservedTurns: ConversationTurn[] = [];

    if (summary) {
      preservedTurns.push({
        role: 'system',
        content: `[Context Summary] ${summary}`,
        timestamp: new Date().toISOString(),
      });
    }

    if (keyFacts.length > 0) {
      preservedTurns.push({
        role: 'system',
        content: `[Key Facts] ${keyFacts.join('; ')}`,
        timestamp: new Date().toISOString(),
      });
    }

    for (const turn of recentTurns) {
      if (!strategy.keep_tool_results && turn.role === 'tool') continue;
      preservedTurns.push(turn);
    }

    const compressedTokens = this.estimateTokens(preservedTurns);

    this.compressionHistory.push({
      timestamp: new Date().toISOString(),
      strategy: strategyName,
      before: originalTokens,
      after: compressedTokens,
    });

    return {
      original_turns: turns.length,
      compressed_turns: preservedTurns.length,
      original_tokens: originalTokens,
      compressed_tokens: compressedTokens,
      compression_ratio: originalTokens > 0 ? compressedTokens / originalTokens : 1.0,
      summary,
      key_facts: keyFacts,
      preserved_turns: preservedTurns,
      archived_turns: oldTurns,
    };
  }

  public compressForProvider(turns: ConversationTurn[], providerMaxTokens: number): CompressedContext {
    const totalTokens = this.estimateTokens(turns);

    if (totalTokens <= providerMaxTokens * 0.7) {
      return this.compress(turns, 'conservative');
    }
    if (totalTokens <= providerMaxTokens * 0.9) {
      return this.compress(turns, 'balanced');
    }
    return this.compress(turns, 'aggressive');
  }

  private extractFacts(turns: ConversationTurn[]): string[] {
    const facts: string[] = [];
    for (const turn of turns) {
      if (turn.role !== 'user' && turn.role !== 'assistant') continue;
      const content = turn.content.toLowerCase();

      if (/\b(my name is|i'm called|i am)\b/.test(content)) {
        const match = turn.content.match(/(?:my name is|i'm called|i am)\s+([A-Z]\w+)/i);
        if (match) facts.push(`User name: ${match[1]}`);
      }

      if (/\b(i prefer|i like|i always|i never)\b/.test(content)) {
        facts.push(`Preference: ${turn.content.slice(0, 100)}`);
      }

      if (/\b(the answer is|the result is|it turns out)\b/.test(content)) {
        facts.push(`Fact: ${turn.content.slice(0, 100)}`);
      }

      if (turn.tool_calls && turn.tool_calls.length > 0) {
        for (const tc of turn.tool_calls) {
          facts.push(`Used tool: ${tc.name}`);
        }
      }
    }

    return [...new Set(facts)].slice(0, 20);
  }

  private generateSummary(turns: ConversationTurn[]): string {
    const userTurns = turns.filter((t) => t.role === 'user');
    const assistantTurns = turns.filter((t) => t.role === 'assistant');
    const toolCalls = turns.flatMap((t) => t.tool_calls || []);

    const topics = new Set<string>();
    for (const turn of userTurns) {
      const words = turn.content.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
      for (const word of words.slice(0, 5)) topics.add(word);
    }

    return [
      `Conversation with ${userTurns.length} user messages and ${assistantTurns.length} assistant responses.`,
      `Tools used: ${toolCalls.length > 0 ? [...new Set(toolCalls.map((tc) => tc.name))].join(', ') : 'none'}.`,
      `Topics: ${[...topics].slice(0, 5).join(', ')}.`,
    ].join(' ');
  }

  private estimateTokens(turns: ConversationTurn[]): number {
    let totalChars = 0;
    for (const turn of turns) {
      totalChars += turn.content.length;
      if (turn.tool_calls) {
        totalChars += JSON.stringify(turn.tool_calls).length;
      }
    }
    return Math.ceil(totalChars / 4);
  }

  public listStrategies(): string {
    const lines: string[] = ['Compression Strategies:'];
    for (const [name, s] of this.strategies) {
      lines.push(`  ${name}: ${s.description} (max_turns:${s.max_turns} max_tokens:${s.max_tokens} preserve_recent:${s.preserve_recent})`);
    }
    return lines.join('\n');
  }

  public getStrategy(strategyName: string): string {
    const strategy = this.strategies.get(strategyName);
    if (!strategy) return `Strategy "${strategyName}" not found.`;
    return [
      `Strategy: ${strategy.name}`,
      `  Description: ${strategy.description}`,
      `  Max turns: ${strategy.max_turns}`,
      `  Max tokens: ${strategy.max_tokens}`,
      `  Preserve recent: ${strategy.preserve_recent}`,
    ].join('\n');
  }

  public getStats(): string {
    const totalBefore = this.compressionHistory.reduce((sum, h) => sum + h.before, 0);
    const totalAfter = this.compressionHistory.reduce((sum, h) => sum + h.after, 0);
    const avgRatio = this.compressionHistory.length > 0
      ? this.compressionHistory.reduce((sum, h) => sum + (h.before > 0 ? h.after / h.before : 1), 0) / this.compressionHistory.length
      : 1;

    return [
      'Context Compression Stats:',
      `  Compressions: ${this.compressionHistory.length}`,
      `  Total tokens before: ${totalBefore}`,
      `  Total tokens after: ${totalAfter}`,
      `  Tokens saved: ${totalBefore - totalAfter}`,
      `  Average ratio: ${(avgRatio * 100).toFixed(1)}%`,
    ].join('\n');
  }
}
