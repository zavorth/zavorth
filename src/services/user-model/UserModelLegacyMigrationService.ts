import fs from 'node:fs';
import path from 'node:path';
import type { UserModelFact } from '../../contracts/user-model/UserModelFactContract.js';
import { logger } from '../../logger.js';
import type { UserModelFactStore } from './UserModelFactStore.js';

export type MigrationDeps = {
  projectRoot?: string;
  homeRoot?: string;
  factStore: UserModelFactStore;
  now?: () => Date;
};

export type MigrationResult = {
  migrated: boolean;
  factsCount: number;
  reason?: string;
};

export class UserModelLegacyMigrationService {
  private readonly projectRoot: string;
  private readonly homeRoot: string;
  private readonly factStore: UserModelFactStore;
  private readonly now: () => Date;
  private readonly markerPath: string;

  public constructor(deps: MigrationDeps) {
    this.projectRoot = deps.projectRoot || process.cwd();
    this.homeRoot = deps.homeRoot || this.projectRoot;
    this.factStore = deps.factStore;
    this.now = deps.now || (() => new Date());
    this.markerPath = path.join(this.projectRoot, 'data', 'runtime', 'user-model', '.migration_completed');
  }

  public async runMigration(defaultUserId = 'local-user'): Promise<MigrationResult> {
    if (fs.existsSync(this.markerPath)) {
      return { migrated: false, factsCount: 0, reason: 'already_completed' };
    }

    const timestamp = this.now().toISOString();
    const migratedFacts: UserModelFact[] = [];

    // 1. Migrate USER.md
    const userMdFacts = this.parseUserMd(defaultUserId, timestamp);
    migratedFacts.push(...userMdFacts);

    // 2. Migrate user-dialectic-profile.json
    const dialecticFacts = this.parseDialecticProfile(defaultUserId, timestamp);
    migratedFacts.push(...dialecticFacts);

    for (const fact of migratedFacts) {
      try {
        await this.factStore.saveFact(fact);
        await this.factStore.recordLifecycleEvent({
          id: `migration-event-${fact.id}`,
          factId: fact.id,
          userId: fact.userId,
          eventType: 'created',
          timestamp,
          details: { migrationSource: fact.source },
        });
      } catch (err: unknown) {
        logger.warn('Failed to persist migrated fact', {
          factId: fact.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    try {
      const markerDir = path.dirname(this.markerPath);
      if (!fs.existsSync(markerDir)) {
        fs.mkdirSync(markerDir, { recursive: true });
      }
      fs.writeFileSync(
        this.markerPath,
        JSON.stringify({ completedAt: timestamp, count: migratedFacts.length }, null, 2),
        'utf8',
      );
    } catch (err: unknown) {
      logger.warn('Failed to write migration marker', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return {
      migrated: true,
      factsCount: migratedFacts.length,
    };
  }

  private parseUserMd(userId: string, timestamp: string): UserModelFact[] {
    const facts: UserModelFact[] = [];
    const candidates = [
      path.join(this.projectRoot, 'USER.md'),
      path.join(this.homeRoot, 'USER.md'),
    ];

    let userMdContent = '';
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        try {
          userMdContent = fs.readFileSync(candidate, 'utf8');
          break;
        } catch {
          // Continue
        }
      }
    }

    if (!userMdContent.trim()) return facts;

    const lines = userMdContent.split('\n');
    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed.startsWith('- ') && !trimmed.startsWith('* ')) continue;

      const withoutBullet = trimmed.slice(2).trim();
      const colonIndex = withoutBullet.indexOf(':');
      if (colonIndex <= 0) continue;

      const rawKey = withoutBullet.slice(0, colonIndex).replaceAll('**', '').trim();
      const rawValue = withoutBullet.slice(colonIndex + 1).replaceAll('**', '').trim();

      if (!rawKey || !rawValue) continue;

      const safeKey = rawKey.toLowerCase().replaceAll(' ', '_');
      facts.push({
        id: `fact-md-${safeKey}`,
        userId,
        content: `${rawKey}: ${rawValue}`,
        kind: 'preference',
        category: safeKey,
        status: 'active',
        version: 1,
        confidence: 1.0,
        evidence: [
          {
            citation: 'Imported from USER.md',
            timestamp,
          },
        ],
        source: 'explicit',
        language: 'en',
        surface: null,
        lastObservedAt: timestamp,
        occurrences: 1,
        targetTools: [],
      });
    }

    return facts;
  }

  private parseDialecticProfile(userId: string, timestamp: string): UserModelFact[] {
    const facts: UserModelFact[] = [];
    const candidates = [
      path.join(this.projectRoot, 'data', 'runtime', 'user-dialectic-profile.json'),
      path.join(this.homeRoot, 'user-dialectic-profile.json'),
      path.join(this.homeRoot, '.zavorth', 'user-dialectic-profile.json'),
    ];

    let profileRaw = '';
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        try {
          profileRaw = fs.readFileSync(candidate, 'utf8');
          break;
        } catch {
          // Continue
        }
      }
    }

    if (!profileRaw.trim()) return facts;

    try {
      const profile = JSON.parse(profileRaw) as {
        questions?: Array<{
          id: string;
          category: string;
          question: string;
          answer: string | null;
          answeredAt: string | null;
        }>;
        userTraits?: Record<string, string>;
      };

      const answeredCategories = new Set<string>();

      if (Array.isArray(profile.questions)) {
        for (const q of profile.questions) {
          if (!q.answer) continue;

          answeredCategories.add(q.category);
          facts.push({
            id: `fact-q-${q.id}`,
            userId,
            content: `${q.question}: ${q.answer}`,
            kind: 'preference',
            category: q.category || 'general',
            status: 'active',
            version: 1,
            confidence: 0.85,
            evidence: [
              {
                citation: `Dialectic Q&A: ${q.question} -> ${q.answer}`,
                timestamp: q.answeredAt || timestamp,
              },
            ],
            source: 'question',
            language: 'en',
            surface: null,
            lastObservedAt: q.answeredAt || timestamp,
            occurrences: 1,
            targetTools: [],
          });
        }
      }

      if (profile.userTraits && typeof profile.userTraits === 'object') {
        for (const [category, observation] of Object.entries(profile.userTraits)) {
          if (answeredCategories.has(category) || !observation) continue;

          facts.push({
            id: `fact-trait-${category}`,
            userId,
            content: observation,
            kind: 'preference',
            category,
            status: 'draft',
            version: 1,
            confidence: 0.5,
            evidence: [
              {
                citation: `Legacy inferred trait for ${category}`,
                timestamp,
              },
            ],
            source: 'migration',
            language: 'en',
            surface: null,
            lastObservedAt: timestamp,
            occurrences: 1,
            targetTools: [],
          });
        }
      }
    } catch (err: unknown) {
      logger.warn('Failed to parse legacy dialectic profile during migration', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return facts;
  }
}
