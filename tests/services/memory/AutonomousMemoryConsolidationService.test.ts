import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { AutonomousMemoryConsolidationService } from '../../../src/services/memory/AutonomousMemoryConsolidationService.js';
import { SessionPersistenceService, type StoredSession } from '../../../src/storage/SessionPersistenceService.js';

describe('AutonomousMemoryConsolidationService', () => {
  let service: AutonomousMemoryConsolidationService;
  let tempRoot: string;
  const ses1 = 'ses_dream_test_1';
  const ses2 = 'ses_dream_test_2';

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dream-test-'));
    service = new AutonomousMemoryConsolidationService({ projectRoot: tempRoot });

    const s1: StoredSession = {
      id: ses1,
      title: 'Session 1',
      createdAt: Date.now() - 5000,
      updatedAt: Date.now(),
      messages: [
        { role: 'user', content: 'We must adhere to domain-driven design and strict typescript.' },
      ],
      todos: [],
    };

    const s2: StoredSession = {
      id: ses2,
      title: 'Session 2',
      createdAt: Date.now() - 2000,
      updatedAt: Date.now(),
      messages: [
        { role: 'user', content: 'Remember that DDD boundary checks and strict typescript are mandatory.' },
      ],
      todos: [],
    };

    SessionPersistenceService.saveSession(s1);
    SessionPersistenceService.saveSession(s2);
  });

  afterEach(() => {
    SessionPersistenceService.deleteSession(ses1);
    SessionPersistenceService.deleteSession(ses2);
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      // Cleanup fail-safe
    }
  });

  it('scans past sessions, consolidates recurring facts, and updates MEMORY.md', () => {
    const report = service.consolidate({
      minOccurrences: 2,
      minConfidence: 0.6,
      projectRoot: tempRoot,
    });

    expect(report.sessionsScanned).toBeGreaterThanOrEqual(2);
    expect(report.factsExtracted.length).toBeGreaterThan(0);

    const dddFact = report.factsExtracted.find((f) => f.rule.includes('Domain-Driven Design'));
    expect(dddFact).toBeDefined();
    expect(dddFact?.occurrenceCount).toBeGreaterThanOrEqual(2);

    expect(fs.existsSync(report.memoryFilePath)).toBe(true);
    const mdContent = fs.readFileSync(report.memoryFilePath, 'utf8');
    expect(mdContent).toContain('Project Consolidated Long-Term Memory');
    expect(mdContent).toContain('Domain-Driven Design');
  });
});
