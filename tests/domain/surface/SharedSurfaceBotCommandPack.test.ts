import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { SharedSurfaceBotCommandPack } from '../../../src/domain/surface/presentation/shared-surface/SharedSurfaceBotCommandPack.js';
import { PersonaRegistryService } from '../../../src/runtime/agent/roster/PersonaRegistryService.js';
import { DynamicPersonaCompilerService } from '../../../src/runtime/agent/roster/DynamicPersonaCompilerService.js';
import type { PersonaTaskRunner } from '../../../src/runtime/agent/roster/PersonaTaskRunnerContract.js';
import type { IMessageContext } from '../../../src/contracts/IMessageBroker.js';

describe('SharedSurfaceBotCommandPack', () => {
  const testStorageDir = path.join(os.tmpdir(), `zavorth-bot-pack-test-${Date.now()}`);
  let registry: PersonaRegistryService;
  let pack: SharedSurfaceBotCommandPack;

  beforeAll(async () => {
    fs.mkdirSync(testStorageDir, { recursive: true });
    registry = new PersonaRegistryService({ storageDir: testStorageDir });
    await registry.initialize();
    pack = new SharedSurfaceBotCommandPack({
      personaRegistryService: registry,
      dynamicCompilerService: new DynamicPersonaCompilerService(),
    });
  });

  afterAll(() => {
    try {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  function createMockMessageContext(rawText: string = ''): IMessageContext {
    return {
      platform: 'telegram',
      userId: 'test-user-123',
      chatId: 'test-chat-456',
      messageId: 'msg-789',
      rawText,
      reply: jest.fn(async () => undefined),
    } as unknown as IMessageContext;
  }

  it('should ignore commands other than /bot', async () => {
    const ctx = createMockMessageContext();
    const handled = await pack.maybeHandle(ctx, '/ping', '');
    expect(handled).toBe(false);
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('should list registered personas on /bot list', async () => {
    const ctx = createMockMessageContext();
    const handled = await pack.maybeHandle(ctx, '/bot', 'list');

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Zavorth Autonomous Personas Roster'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('@executor'));
  });

  it('should dynamically create and register a persona on /bot create', async () => {
    const ctx = createMockMessageContext();
    const handled = await pack.maybeHandle(ctx, '/bot', 'create PostgreSQL database performance expert');

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Persona Created: @database-specialist'));
    expect(registry.hasPersona('database-specialist')).toBe(true);
  });

  it('should inspect an existing persona on /bot inspect', async () => {
    const ctx = createMockMessageContext();
    const handled = await pack.maybeHandle(ctx, '/bot', 'inspect executor');

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Persona Details: @executor'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Practical Code Implementation Specialist'));
  });

  it('should delete a persona on /bot delete', async () => {
    const ctx = createMockMessageContext();
    const handled = await pack.maybeHandle(ctx, '/bot', 'delete database-specialist');

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Persona @database-specialist successfully deleted'));
    expect(registry.hasPersona('database-specialist')).toBe(false);
  });

  it('should render help text on invalid sub-command', async () => {
    const ctx = createMockMessageContext();
    const handled = await pack.maybeHandle(ctx, '/bot', 'unknown_subcommand');

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Zavorth Bot Command Reference'));
  });

  it('should trigger dialectic deliberation on /bot review <topic>', async () => {
    const ctx = createMockMessageContext();
    const handled = await pack.maybeHandle(ctx, '/bot', 'review Refactor authentication layer');

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Peer Review Dialectic Deliberation'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Thesis'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Antithesis'));
  });

  it('should trigger dialectic deliberation on canonical /review <topic>', async () => {
    const ctx = createMockMessageContext();
    const handled = await pack.maybeHandle(ctx, '/review', 'Migrate to Bun runtime');

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Peer Review Dialectic Deliberation: "Migrate to Bun runtime"'));
  });

  it('should report honestly when no execution backend is configured for /bot chat', async () => {
    const ctx = createMockMessageContext();
    const handled = await pack.maybeHandle(ctx, '/bot', 'chat executor write tests for auth module');

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('no execution backend is configured'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('/bot inspect executor'));
  });

  it('should delegate /bot chat to the persona task runner when configured', async () => {
    const runner: PersonaTaskRunner = {
      runPersonaTask: jest.fn(async () => ({
        ok: true,
        output: 'Swarm launched for executor: status=running',
      })),
    };
    const runnerPack = new SharedSurfaceBotCommandPack({
      personaRegistryService: registry,
      dynamicCompilerService: new DynamicPersonaCompilerService(),
      personaRunner: runner,
    });

    const ctx = createMockMessageContext();
    const handled = await runnerPack.maybeHandle(ctx, '/bot', 'chat executor write tests for auth module');

    expect(handled).toBe(true);
    expect(runner.runPersonaTask).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'write tests for auth module',
      persona: expect.objectContaining({ id: 'executor' }),
    }));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('@executor'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Swarm launched'));
  });

  it('should surface a typed failure when the persona task runner errors', async () => {
    const runner: PersonaTaskRunner = {
      runPersonaTask: jest.fn(async () => ({
        ok: false,
        output: '',
        error: 'no roles configured',
      })),
    };
    const runnerPack = new SharedSurfaceBotCommandPack({
      personaRegistryService: registry,
      dynamicCompilerService: new DynamicPersonaCompilerService(),
      personaRunner: runner,
    });

    const ctx = createMockMessageContext();
    const handled = await runnerPack.maybeHandle(ctx, '/bot', 'chat executor run heavy migration');

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('failed to dispatch'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('no roles configured'));
  });
});
