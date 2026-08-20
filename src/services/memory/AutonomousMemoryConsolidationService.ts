import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ProjectEvolutionMemoryService,
  type MemoryRule,
} from '../../storage/ProjectEvolutionMemoryService.js';
import { SessionPersistenceService } from '../../storage/SessionPersistenceService.js';

export interface ConsolidatedFact {
  readonly id: string;
  readonly category: MemoryRule['category'];
  readonly rule: string;
  readonly confidence: number;
  readonly occurrenceCount: number;
  readonly sources: readonly string[];
}

export interface ConsolidationReport {
  readonly timestamp: number;
  readonly sessionsScanned: number;
  readonly totalMessagesAnalyzed: number;
  readonly factsExtracted: readonly ConsolidatedFact[];
  readonly newRulesPersisted: number;
  readonly memoryFilePath: string;
}

export interface ConsolidationOptions {
  readonly minOccurrences?: number;
  readonly minConfidence?: number;
  readonly maxSessionsToScan?: number;
  readonly projectRoot?: string;
}

export class AutonomousMemoryConsolidationService {
  private readonly projectRoot: string;

  constructor(options: { projectRoot?: string } = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
  }

  public consolidate(options: ConsolidationOptions = {}): ConsolidationReport {
    const minOccurrences = options.minOccurrences || 2;
    const minConfidence = options.minConfidence || 0.7;
    const maxSessions = options.maxSessionsToScan || 50;

    const sessions = SessionPersistenceService.listSessions(maxSessions);
    let totalMessagesAnalyzed = 0;

    const candidateFacts = new Map<string, { category: MemoryRule['category']; count: number; sources: Set<string> }>();

    for (const session of sessions) {
      const messages = session.messages || [];
      totalMessagesAnalyzed += messages.length;

      for (const msg of messages) {
        const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        this.extractEngineeringFactsFromText(text, session.id, candidateFacts);
      }
    }

    const consolidatedFacts: ConsolidatedFact[] = [];
    let newRulesPersisted = 0;

    for (const [ruleText, meta] of candidateFacts.entries()) {
      const confidence = Math.min(1.0, 0.5 + meta.count * 0.15);
      if (meta.count >= minOccurrences && confidence >= minConfidence) {
        const factId = `fact_${Date.now()}_${consolidatedFacts.length + 1}`;
        const fact: ConsolidatedFact = {
          id: factId,
          category: meta.category,
          rule: ruleText,
          confidence,
          occurrenceCount: meta.count,
          sources: Array.from(meta.sources),
        };

        consolidatedFacts.push(fact);

        // Check if rule already exists before persisting
        const existingRules = ProjectEvolutionMemoryService.listRules();
        const alreadyExists = existingRules.some((r) => r.rule.toLowerCase() === ruleText.toLowerCase());

        if (!alreadyExists) {
          ProjectEvolutionMemoryService.addRule(meta.category, ruleText);
          newRulesPersisted++;
        }
      }
    }

    const memoryFilePath = this.syncToMemoryMarkdown(consolidatedFacts);

    return {
      timestamp: Date.now(),
      sessionsScanned: sessions.length,
      totalMessagesAnalyzed,
      factsExtracted: consolidatedFacts,
      newRulesPersisted,
      memoryFilePath,
    };
  }

  private extractEngineeringFactsFromText(
    text: string,
    sessionId: string,
    collector: Map<string, { category: MemoryRule['category']; count: number; sources: Set<string> }>
  ): void {
    const lower = text.toLowerCase();

    // Pattern 1: Architecture conventions
    if (lower.includes('domain-driven design') || lower.includes('ddd boundary') || lower.includes('clean architecture')) {
      this.recordCandidate(
        'Project strictly enforces Domain-Driven Design (DDD) boundaries and modular architecture.',
        'architecture',
        sessionId,
        collector
      );
    }
    if (lower.includes('strict typescript') || lower.includes('zero any') || lower.includes('strict typing')) {
      this.recordCandidate(
        'Enforce strict TypeScript typing across all modules with zero untyped dynamic casting.',
        'code_style',
        sessionId,
        collector
      );
    }
    if (lower.includes('english-first') || lower.includes('100% in english') || lower.includes('en-first')) {
      this.recordCandidate(
        'Codebase is strictly English-first for all symbols, types, tests, and documentation.',
        'code_style',
        sessionId,
        collector
      );
    }
    if (lower.includes('vitest') && lower.includes('desktop')) {
      this.recordCandidate(
        'Use Vitest for testing desktop frontend components and Jest for backend services.',
        'testing',
        sessionId,
        collector
      );
    }
  }

  private recordCandidate(
    rule: string,
    category: MemoryRule['category'],
    source: string,
    collector: Map<string, { category: MemoryRule['category']; count: number; sources: Set<string> }>
  ): void {
    const existing = collector.get(rule);
    if (existing) {
      existing.count++;
      existing.sources.add(source);
    } else {
      collector.set(rule, {
        category,
        count: 1,
        sources: new Set([source]),
      });
    }
  }

  private syncToMemoryMarkdown(facts: readonly ConsolidatedFact[]): string {
    const zavorthDir = path.join(this.projectRoot, '.zavorth');
    if (!fs.existsSync(zavorthDir)) {
      fs.mkdirSync(zavorthDir, { recursive: true });
    }

    const memoryMdPath = path.join(zavorthDir, 'MEMORY.md');
    const lines: string[] = [
      '# Project Consolidated Long-Term Memory',
      '',
      `_Last distilled: ${new Date().toISOString()}_`,
      '',
      '## Architectural & Engineering Invariants',
      '',
    ];

    const allRules = ProjectEvolutionMemoryService.listRules();
    for (const rule of allRules) {
      lines.push(`- **[${rule.category.toUpperCase()}]** ${rule.rule} _(source: ${rule.source})_`);
    }

    if (facts.length > 0) {
      lines.push('');
      lines.push('## Recently Distilled Session Facts');
      lines.push('');
      for (const fact of facts) {
        lines.push(`- **[${fact.category.toUpperCase()}]** ${fact.rule} _(confidence: ${Math.round(fact.confidence * 100)}%, observed: ${fact.occurrenceCount}x)_`);
      }
    }

    lines.push('');
    fs.writeFileSync(memoryMdPath, lines.join('\n'), 'utf8');
    return memoryMdPath;
  }
}
