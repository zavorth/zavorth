import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { UserModelFactStore } from '../../../src/services/user-model/UserModelFactStore.js';
import { UserModelLegacyMigrationService } from '../../../src/services/user-model/UserModelLegacyMigrationService.js';

describe('UserModelLegacyMigrationService', () => {
  let tmpDir: string;
  let factStore: UserModelFactStore;
  let migrationService: UserModelLegacyMigrationService;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-migration-test-'));
    factStore = new UserModelFactStore({ dataDir: path.join(tmpDir, 'data', 'runtime', 'user-model') });
    await factStore.initialize();
    migrationService = new UserModelLegacyMigrationService({
      projectRoot: tmpDir,
      homeRoot: tmpDir,
      factStore,
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Cleanup
    }
  });

  it('migrates USER.md entries to active facts with source explicit and confidence 1.0', async () => {
    const userMdContent = [
      '# USER.md',
      '',
      '- **Primary language**: English',
      '- **Code style**: Functional and clean',
    ].join('\n');

    fs.writeFileSync(path.join(tmpDir, 'USER.md'), userMdContent, 'utf8');

    const result = await migrationService.runMigration('user-test');
    expect(result.migrated).toBe(true);
    expect(result.factsCount).toBe(2);

    const facts = await factStore.listFactsByUserId('user-test');
    expect(facts).toHaveLength(2);

    const langFact = facts.find((f) => f.category === 'primary_language');
    expect(langFact).toBeDefined();
    expect(langFact?.confidence).toBe(1.0);
    expect(langFact?.source).toBe('explicit');
    expect(langFact?.status).toBe('active');
    expect(langFact?.content).toBe('Primary language: English');
  });

  it('migrates answered dialectic questions to active facts and inferred traits to draft', async () => {
    const runtimeDir = path.join(tmpDir, 'data', 'runtime');
    fs.mkdirSync(runtimeDir, { recursive: true });

    const dialecticProfile = {
      questions: [
        {
          id: 'comm_tone',
          category: 'communication_style',
          question: 'How do you prefer I respond...',
          answer: 'Direct and short',
          answeredAt: '2026-08-20T10:00:00.000Z',
        },
      ],
      userTraits: {
        communication_style: 'Direct and short',
        tool_preferences: 'Prefers VS Code with Vim extension',
      },
    };

    fs.writeFileSync(
      path.join(runtimeDir, 'user-dialectic-profile.json'),
      JSON.stringify(dialecticProfile),
      'utf8',
    );

    const result = await migrationService.runMigration('user-test');
    expect(result.migrated).toBe(true);
    expect(result.factsCount).toBe(2);

    const facts = await factStore.listFactsByUserId('user-test');
    const questionFact = facts.find((f) => f.id === 'fact-q-comm_tone');
    expect(questionFact).toBeDefined();
    expect(questionFact?.confidence).toBe(0.85);
    expect(questionFact?.status).toBe('active');

    const traitFact = facts.find((f) => f.category === 'tool_preferences');
    expect(traitFact).toBeDefined();
    expect(traitFact?.confidence).toBe(0.5);
    expect(traitFact?.status).toBe('draft');
    expect(traitFact?.source).toBe('migration');
  });

  it('is completely idempotent and skips execution if already completed', async () => {
    fs.writeFileSync(path.join(tmpDir, 'USER.md'), '- **Name**: Test Operator\n', 'utf8');

    const firstRun = await migrationService.runMigration('user-test');
    expect(firstRun.migrated).toBe(true);
    expect(firstRun.factsCount).toBe(1);

    const secondRun = await migrationService.runMigration('user-test');
    expect(secondRun.migrated).toBe(false);
    expect(secondRun.reason).toBe('already_completed');
    expect(secondRun.factsCount).toBe(0);
  });
});
