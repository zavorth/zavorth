import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthHumanReachService } from '../../../src/services/ZavorthHumanReachService.js';

describe('ZavorthHumanReachService', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-reach-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('lists stable paths and marks telegram ready when token exists', () => {
    const service = new ZavorthHumanReachService({
      projectRoot: tempDir,
      env: { TELEGRAM_BOT_TOKEN: '123:abc' },
    });
    const snapshot = service.buildSnapshot();
    expect(snapshot.contractVersion).toBe('zavorth-human-reach/1');
    expect(snapshot.paths.some((pathItem) => pathItem.id === 'desktop' && pathItem.stable)).toBe(true);
    expect(snapshot.paths.find((pathItem) => pathItem.id === 'telegram')?.ready).toBe(true);
    expect(snapshot.paths.find((pathItem) => pathItem.id === 'whatsapp-baileys')?.status).toBe('experimental');
    expect(snapshot.promptBlock).toContain('prefer stable paths');
    expect(snapshot.digestLines.join('\n')).toMatch(/Telegram|Desktop/i);
  });

  it('uses first-run surface as preferred path', () => {
    const runtimeDir = path.join(tempDir, 'data', 'runtime');
    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.writeFileSync(path.join(runtimeDir, 'first-run-human.json'), JSON.stringify({
      version: 1,
      completed: true,
      surface: 'telegram',
      language: 'pt',
      allowLearning: true,
    }));
    const service = new ZavorthHumanReachService({ projectRoot: tempDir, env: {} });
    expect(service.buildSnapshot().preferredPathId).toBe('telegram');
  });

  it('does not match free-text reach NLU (Hermes-style) and still guides telegram setup via API', () => {
    const service = new ZavorthHumanReachService({ projectRoot: tempDir, env: {} });
    expect(service.matchNaturalCommand('onde te acho?')).toBeNull();
    expect(service.matchNaturalCommand('como configurar telegram')).toBeNull();
    const guide = service.formatPathGuide('telegram').join('\n');
    expect(guide).toMatch(/BotFather|TELEGRAM_BOT_TOKEN/i);
  });
});
