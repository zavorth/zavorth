import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../../src/config/index';
import { Database } from '../../../src/storage/Database';
import { MemoryService } from '../../../src/services/MemoryService';
import { SnippetService } from '../../../src/services/SnippetService';
import { CommandParser } from '../../../src/telegram/CommandParser';
import { TelegramChainController } from '../../../src/telegram/controllers/TelegramChainController';


describe('TelegramChainController', () => {
  const originalDbPath = config.dbPath;
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-chain-'));
    (config as any).dbPath = path.join(tempDir, 'chain.db');
  });

  afterEach(() => {
    ((Database as any).instance as Database | null)?.close?.();
    (config as any).dbPath = originalDbPath;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function createController() {
    return new TelegramChainController({
      parser: new CommandParser(),
      processTextMessage: jest.fn().mockResolvedValue(undefined),
      truncateForTelegram: (content: string) => content,
    });
  }

  it('supports aliases, memory and snippet placeholders across chain steps', async () => {
    const memory = new MemoryService();
    const snippets = new SnippetService();
    await memory.remember('42', 'workspace_preferido', 'C:/workspace/zavorth', 'workspace');
    await snippets.save('42', 'saudacao', 'ola mundo');

    const controller = createController();
    const artifacts = [
      {
        index: 1,
        alias: 'search',
        command: '/research zavorth',
        output: 'Detailed summary of Zavorth',
        summary: 'Short summary of Zavorth',
      },
    ];

    const resolved = await controller.resolveChainTemplates(
      '/snippet save contexto {{var:pesquisa}} | {{memory:workspace_preferido}} | {{snippet:saudacao}} | {{step1.summary}}',
      artifacts,
      '42',
    );

    expect(resolved).toContain('Short summary of Zavorth');
    expect(resolved).toContain('C:/workspace/zavorth');
    expect(resolved).toContain('ola mundo');
    expect(resolved).toContain('Short summary of Zavorth');
  });

  it('parses aliases declared with =>', () => {
    const controller = createController();

    expect(controller.parseChainSegment('/research zavorth => pesquisa')).toEqual({
      command: '/research zavorth',
      alias: 'pesquisa',
    });
  });
});