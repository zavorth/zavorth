import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthHumanSuperpowersService } from '../../../src/services/ZavorthHumanSuperpowersService.js';
import { setLearningRuntimeMode } from '../../../src/services/ZavorthLearningRuntimePolicy.js';

describe('ZavorthHumanSuperpowersService', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-powers-'));
    setLearningRuntimeMode('autonomous', { projectRoot: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('lists human superpowers with trust labels', () => {
    const service = new ZavorthHumanSuperpowersService({
      projectRoot: tempDir,
      env: { TELEGRAM_BOT_TOKEN: 'x', OPENAI_API_KEY: 'sk-test' },
    });
    const snapshot = service.buildSnapshot();
    expect(snapshot.contractVersion).toBe('zavorth-human-superpowers/1');
    expect(snapshot.powers.length).toBeGreaterThan(4);
    expect(snapshot.powers.some((power) => power.id === 'chat-help')).toBe(true);
    expect(snapshot.powers.find((power) => power.id === 'telegram')?.ready).toBe(true);
    expect(snapshot.promptBlock).toContain('Human superpowers');
    expect(snapshot.digestLines.join('\n')).toMatch(/Conversar|Telegram/i);
  });

  it('does not match free-text NLU (agent-first) but still finds powers by need', () => {
    const service = new ZavorthHumanSuperpowersService({ projectRoot: tempDir, env: {} });
    expect(service.matchNaturalCommand('o que you sabe fazer-')).toBeNull();
    expect(service.matchNaturalCommand('me ajude com files')).toBeNull();
    const found = service.findByNeed('files e pastas');
    expect(found.some((power) => power.id === 'files-safe')).toBe(true);
  });
});
