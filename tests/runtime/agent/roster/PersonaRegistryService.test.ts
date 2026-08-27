import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PersonaRegistryService } from '../../../../src/runtime/agent/roster/PersonaRegistryService.js';

describe('PersonaRegistryService', () => {
  const testStorageDir = path.join(os.tmpdir(), `zavorth-roster-test-${Date.now()}`);
  let registry: PersonaRegistryService;

  beforeAll(async () => {
    fs.mkdirSync(testStorageDir, { recursive: true });
    registry = new PersonaRegistryService({ storageDir: testStorageDir });
    await registry.initialize();
  });

  afterAll(() => {
    try {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('should initialize with default seeded personas', () => {
    const personas = registry.listPersonas();
    expect(personas.length).toBeGreaterThanOrEqual(4);
    expect(registry.hasPersona('executor')).toBe(true);
    expect(registry.hasPersona('researcher')).toBe(true);
    expect(registry.hasPersona('architect')).toBe(true);
    expect(registry.hasPersona('security-evaluator')).toBe(true);
  });

  it('should register a new persona, persist files to disk, and index in memory', async () => {
    const created = await registry.registerPersona({
      id: 'sql-guru',
      name: 'SQL Performance Guru',
      role: 'Database Optimization Specialist',
      systemPrompt: 'You are the SQL Guru. Optimize every query to use index scans.',
      allowedTools: ['database_query', 'read_file'],
      allowedDomains: ['*.supabase.co', '*.neon.tech'],
      isolationMode: 'direct',
      passiveInspectionEnabled: false,
    });

    expect(created.id).toBe('sql-guru');
    expect(registry.hasPersona('sql-guru')).toBe(true);

    const botDir = path.join(testStorageDir, 'sql-guru');
    expect(fs.existsSync(path.join(botDir, 'IDENTITY.md'))).toBe(true);
    expect(fs.existsSync(path.join(botDir, 'SOUL.md'))).toBe(true);
    expect(fs.existsSync(path.join(botDir, 'persona.json'))).toBe(true);

    const soulContent = fs.readFileSync(path.join(botDir, 'SOUL.md'), 'utf8');
    expect(soulContent).toContain('SQL Guru');
  });

  it('should filter personas by passive inspection flag', () => {
    const passiveOnly = registry.listPersonas({ passiveOnly: true });
    expect(passiveOnly.some((p) => p.id === 'security-evaluator')).toBe(true);
    expect(passiveOnly.some((p) => p.id === 'executor')).toBe(false);

    const activeOnly = registry.listPersonas({ activeOnly: true });
    expect(activeOnly.some((p) => p.id === 'executor')).toBe(true);
    expect(activeOnly.some((p) => p.id === 'security-evaluator')).toBe(false);
  });

  it('should update an existing persona', async () => {
    const updated = await registry.updatePersona('sql-guru', {
      name: 'SQL & Query Master',
      role: 'Senior Performance DBA',
    });

    expect(updated.name).toBe('SQL & Query Master');
    expect(updated.role).toBe('Senior Performance DBA');
    expect(registry.getPersona('sql-guru')?.name).toBe('SQL & Query Master');
  });

  it('should resolve @mentions correctly from incoming message turns', () => {
    const resolved1 = registry.resolveMention('@executor: write an integration test for the auth controller');
    expect(resolved1).not.toBeNull();
    expect(resolved1?.persona.id).toBe('executor');
    expect(resolved1?.strippedPrompt).toBe('write an integration test for the auth controller');

    const resolved2 = registry.resolveMention('@sql-guru optimize this query: SELECT * FROM users');
    expect(resolved2).not.toBeNull();
    expect(resolved2?.persona.id).toBe('sql-guru');
    expect(resolved2?.strippedPrompt).toBe('optimize this query: SELECT * FROM users');

    const unresolvedUnknown = registry.resolveMention('@nonexistent-bot do something');
    expect(unresolvedUnknown).toBeNull();

    const normalText = registry.resolveMention('Hello Zavorth, can you help me?');
    expect(normalText).toBeNull();
  });

  it('should delete a persona and remove its storage directory', async () => {
    await registry.registerPersona({
      id: 'temporary-bot',
      name: 'Temp Bot',
      role: 'Temporary worker',
      systemPrompt: 'I will be deleted soon.',
    });

    expect(registry.hasPersona('temporary-bot')).toBe(true);
    const botDir = path.join(testStorageDir, 'temporary-bot');
    expect(fs.existsSync(botDir)).toBe(true);

    const deleted = await registry.deletePersona('temporary-bot');
    expect(deleted).toBe(true);
    expect(registry.hasPersona('temporary-bot')).toBe(false);
    expect(fs.existsSync(botDir)).toBe(false);
  });
});
