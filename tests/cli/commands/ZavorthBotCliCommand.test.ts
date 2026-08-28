import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { handleZavorthBotCliCommand } from '../../../src/cli/commands/ZavorthBotCliCommand.js';
import { PersonaRegistryService } from '../../../src/runtime/agent/roster/PersonaRegistryService.js';
import { DynamicPersonaCompilerService } from '../../../src/runtime/agent/roster/DynamicPersonaCompilerService.js';
import type { CreatePersonaInput } from '../../../src/runtime/agent/roster/PersonaContract.js';
import type { PersonaTaskRunner } from '../../../src/runtime/agent/roster/PersonaTaskRunnerContract.js';
import type { CliWriter, ZavorthCliFlags } from '../../../src/cli/ZavorthCliContract.js';

function createFlags(overrides: Partial<ZavorthCliFlags> = {}): ZavorthCliFlags {
  return {
    command: null,
    repl: false,
    json: false,
    live: false,
    userId: 'bot-cli-test',
    platform: 'web',
    chatId: 'cli:bot-cli-test',
    sessionId: 'session-bot-cli-test',
    workspaceHint: null,
    commandText: null,
    headless: false,
    approvalMode: null,
    ...overrides,
  };
}

const createdStorageDirs: string[] = [];

function makeRegistry(seedDefaults: boolean): PersonaRegistryService {
  const storageDir = path.join(os.tmpdir(), `zavorth-bot-cli-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  createdStorageDirs.push(storageDir);
  return new PersonaRegistryService({ storageDir, autoSeedDefaults: seedDefaults });
}

const compiledFixture: CreatePersonaInput = {
  id: 'sql-guru',
  name: 'SQL Performance Guru',
  role: 'Database Optimization Specialist',
  avatar: 'database',
  systemPrompt: 'You are the SQL Guru. Optimize every query to use index scans.',
  allowedTools: ['database_query', 'read_file'],
  isolationMode: 'direct',
  passiveInspectionEnabled: false,
  scheduleRoutines: [],
};

describe('ZavorthBotCliCommand', () => {
  let lines: string[];
  let errors: string[];
  let writer: CliWriter;

  beforeEach(() => {
    lines = [];
    errors = [];
    writer = {
      line: (text: string) => {
        lines.push(text);
      },
      error: (text: string) => {
        errors.push(text);
      },
    };
  });

  afterEach(() => {
    for (const dir of createdStorageDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup error
      }
    }
    createdStorageDirs.length = 0;
  });

  it('ignores commands that are not bot', async () => {
    const result = await handleZavorthBotCliCommand({
      commandName: 'skills',
      args: 'list',
      flags: createFlags(),
      writer,
    });
    expect(result).toBeNull();
    expect(lines).toHaveLength(0);
  });

  it('lists the roster with id, name, role, isolation mode and passive flag', async () => {
    const registry = makeRegistry(false);
    await registry.initialize();
    await registry.registerPersona(compiledFixture);
    await registry.registerPersona({
      id: 'auditor',
      name: 'Auditor',
      role: 'Security Reviewer',
      systemPrompt: 'You review security boundaries.',
      isolationMode: 'docker',
      passiveInspectionEnabled: true,
    });

    const result = await handleZavorthBotCliCommand({
      commandName: 'bot',
      args: 'list',
      flags: createFlags(),
      writer,
      deps: { personaRegistryService: registry },
    });

    expect(result).toEqual(expect.objectContaining({ ok: true, handled: true }));
    const body = lines.join('\n');
    expect(body).toContain('Zavorth Autonomous Personas Roster');
    expect(body).toContain('@sql-guru (SQL Performance Guru) — Database Optimization Specialist');
    expect(body).toContain('Mode: direct | task');
    expect(body).toContain('@auditor (Auditor) — Security Reviewer');
    expect(body).toContain('Mode: docker | observer');
  });

  it('reports an empty roster', async () => {
    const registry = makeRegistry(false);
    const result = await handleZavorthBotCliCommand({
      commandName: 'bot',
      args: 'list',
      flags: createFlags(),
      writer,
      deps: { personaRegistryService: registry },
    });

    expect(result).toEqual(expect.objectContaining({ ok: true, handled: true }));
    expect(lines.join('\n')).toContain('No personas currently registered.');
  });

  it('creates a persona from intent through the compiler and registers it', async () => {
    const registry = makeRegistry(false);
    const compileFromIntent = jest.fn().mockResolvedValue(compiledFixture);
    const compiler = { compileFromIntent } as unknown as DynamicPersonaCompilerService;

    const result = await handleZavorthBotCliCommand({
      commandName: 'bot',
      args: 'create SQL database optimizer for slow postgres queries',
      flags: createFlags(),
      writer,
      deps: { personaRegistryService: registry, dynamicCompilerService: compiler },
    });

    expect(result).toEqual(expect.objectContaining({ ok: true, handled: true }));
    expect(compileFromIntent).toHaveBeenCalledWith({
      userIntent: 'SQL database optimizer for slow postgres queries',
    });
    expect(registry.hasPersona('sql-guru')).toBe(true);
    const body = lines.join('\n');
    expect(body).toContain('Persona Created: @sql-guru');
    expect(body).toContain('- Name: SQL Performance Guru');
    expect(body).toContain('- Role: Database Optimization Specialist');
    expect(body).toContain('- Isolation Mode: direct');
    expect(body).toContain('Allowed Tools: database_query, read_file');
  });

  it('prints usage when create is missing the intent', async () => {
    const registry = makeRegistry(false);
    const result = await handleZavorthBotCliCommand({
      commandName: 'bot',
      args: 'create',
      flags: createFlags(),
      writer,
      deps: { personaRegistryService: registry },
    });

    expect(result).toEqual(expect.objectContaining({ ok: false, handled: true }));
    expect(errors.join('\n')).toContain('Usage: zavorth bot create <intent>');
  });

  it('reports a typed error when persona creation fails', async () => {
    const registry = makeRegistry(false);
    const compiler = {
      compileFromIntent: jest.fn().mockRejectedValue(new Error('compiler exploded')),
    } as unknown as DynamicPersonaCompilerService;

    const result = await handleZavorthBotCliCommand({
      commandName: 'bot',
      args: 'create some intent',
      flags: createFlags(),
      writer,
      deps: { personaRegistryService: registry, dynamicCompilerService: compiler },
    });

    expect(result).toEqual(expect.objectContaining({ ok: false, handled: true }));
    expect(errors.join('\n')).toContain('Failed to create persona: compiler exploded');
  });

  it('inspects a persona with the same fields as the shared surface', async () => {
    const registry = makeRegistry(false);
    await registry.initialize();
    await registry.registerPersona(compiledFixture);

    const result = await handleZavorthBotCliCommand({
      commandName: 'bot',
      args: 'inspect sql-guru',
      flags: createFlags(),
      writer,
      deps: { personaRegistryService: registry },
    });

    expect(result).toEqual(expect.objectContaining({ ok: true, handled: true }));
    const body = lines.join('\n');
    expect(body).toContain('Persona Details: @sql-guru');
    expect(body).toContain('- Name: SQL Performance Guru');
    expect(body).toContain('- Role: Database Optimization Specialist');
    expect(body).toContain('- Avatar: database');
    expect(body).toContain('- Isolation Mode: direct');
    expect(body).toContain('- Passive Inspection: Disabled');
    expect(body).toContain('You are the SQL Guru. Optimize every query to use index scans.');
  });

  it('reports an unknown persona on inspect', async () => {
    const registry = makeRegistry(false);
    const result = await handleZavorthBotCliCommand({
      commandName: 'bot',
      args: 'inspect nope',
      flags: createFlags(),
      writer,
      deps: { personaRegistryService: registry },
    });

    expect(result).toEqual(expect.objectContaining({ ok: false, handled: true }));
    expect(errors.join('\n')).toContain('Persona @nope not found in the roster.');
  });

  it('prints usage when inspect is missing the id', async () => {
    const registry = makeRegistry(false);
    const result = await handleZavorthBotCliCommand({
      commandName: 'bot',
      args: 'inspect',
      flags: createFlags(),
      writer,
      deps: { personaRegistryService: registry },
    });

    expect(result).toEqual(expect.objectContaining({ ok: false, handled: true }));
    expect(errors.join('\n')).toContain('Usage: zavorth bot inspect <id>');
  });

  it('chats with a persona through the runner on success', async () => {
    const registry = makeRegistry(false);
    await registry.initialize();
    await registry.registerPersona(compiledFixture);
    const runPersonaTask = jest.fn().mockResolvedValue({ ok: true, output: 'Index scan applied.', error: null });
    const runner = { runPersonaTask } as unknown as PersonaTaskRunner;

    const result = await handleZavorthBotCliCommand({
      commandName: 'bot',
      args: 'chat sql-guru optimize the users join',
      flags: createFlags(),
      writer,
      deps: { personaRegistryService: registry, personaRunner: runner },
    });

    expect(result).toEqual(expect.objectContaining({ ok: true, handled: true }));
    expect(runPersonaTask).toHaveBeenCalledWith({
      persona: expect.objectContaining({ id: 'sql-guru' }),
      prompt: 'optimize the users join',
      sessionId: 'session-bot-cli-test',
    });
    const body = lines.join('\n');
    expect(body).toContain('[Persona: @sql-guru (Database Optimization Specialist)]');
    expect(body).toContain('Index scan applied.');
  });

  it('reports the typed error when the runner fails', async () => {
    const registry = makeRegistry(false);
    await registry.initialize();
    await registry.registerPersona(compiledFixture);
    const runner = {
      runPersonaTask: jest.fn().mockResolvedValue({ ok: false, output: '', error: 'ensemble offline' }),
    } as unknown as PersonaTaskRunner;

    const result = await handleZavorthBotCliCommand({
      commandName: 'bot',
      args: 'chat sql-guru run the query',
      flags: createFlags(),
      writer,
      deps: { personaRegistryService: registry, personaRunner: runner },
    });

    expect(result).toEqual(expect.objectContaining({ ok: false, handled: true }));
    expect(errors.join('\n')).toContain('Persona @sql-guru failed to dispatch: ensemble offline');
  });

  it('reports the typed error when the runner throws', async () => {
    const registry = makeRegistry(false);
    await registry.initialize();
    await registry.registerPersona(compiledFixture);
    const runner = {
      runPersonaTask: jest.fn().mockRejectedValue(new Error('runner crashed')),
    } as unknown as PersonaTaskRunner;

    const result = await handleZavorthBotCliCommand({
      commandName: 'bot',
      args: 'chat sql-guru run the query',
      flags: createFlags(),
      writer,
      deps: { personaRegistryService: registry, personaRunner: runner },
    });

    expect(result).toEqual(expect.objectContaining({ ok: false, handled: true }));
    expect(errors.join('\n')).toContain('Persona @sql-guru failed to dispatch: runner crashed');
  });

  it('reports an unknown persona on chat', async () => {
    const registry = makeRegistry(false);
    const runner = { runPersonaTask: jest.fn() } as unknown as PersonaTaskRunner;

    const result = await handleZavorthBotCliCommand({
      commandName: 'bot',
      args: 'chat nope do something',
      flags: createFlags(),
      writer,
      deps: { personaRegistryService: registry, personaRunner: runner },
    });

    expect(result).toEqual(expect.objectContaining({ ok: false, handled: true }));
    expect(errors.join('\n')).toContain('Persona @nope not found.');
    expect(runner.runPersonaTask).not.toHaveBeenCalled();
  });

  it('prints usage when chat is missing the id or prompt', async () => {
    const registry = makeRegistry(false);
    const result = await handleZavorthBotCliCommand({
      commandName: 'bot',
      args: 'chat sql-guru',
      flags: createFlags(),
      writer,
      deps: { personaRegistryService: registry },
    });

    expect(result).toEqual(expect.objectContaining({ ok: false, handled: true }));
    expect(errors.join('\n')).toContain('Usage: zavorth bot chat <id> <prompt>');
  });

  it('prints the reference for unknown subcommands', async () => {
    const registry = makeRegistry(false);
    const result = await handleZavorthBotCliCommand({
      commandName: 'bot',
      args: 'frobnicate',
      flags: createFlags(),
      writer,
      deps: { personaRegistryService: registry },
    });

    expect(result).toEqual(expect.objectContaining({ ok: true, handled: true }));
    const body = lines.join('\n');
    expect(body).toContain('Zavorth Bot Command Reference');
    expect(body).toContain('zavorth bot list');
    expect(body).toContain('zavorth bot create <intent>');
    expect(body).toContain('zavorth bot inspect <id>');
    expect(body).toContain('zavorth bot chat <id> <prompt>');
  });
});
