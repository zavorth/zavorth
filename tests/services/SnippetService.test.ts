import fs from 'fs';
import os from 'os';
import path from 'path';
import { SnippetService } from '../../src/services/SnippetService';
import { Database } from '../../src/storage/Database';
import { config } from '../../src/config/index';

describe('SnippetService', () => {
  const originalDbPath = config.dbPath;
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-snippet-'));
    (config as any).dbPath = path.join(tempDir, 'snippets.db');
  });

  afterEach(() => {
    ((Database as any).instance as Database | null)?.close?.();
    (config as any).dbPath = originalDbPath;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('updates an existing snippet instead of duplicating it', async () => {
    const service = new SnippetService();

    await service.save('u1', 'build', 'npm test');
    await service.save('u1', 'build', 'npm run build');

    const snippets = await service.list('u1');
    expect(snippets).toHaveLength(1);
    expect(await service.get('u1', ' build ')).toEqual(
      expect.objectContaining({ content: 'npm run build' }),
    );
  });

  it('deletes snippets using normalized names', async () => {
    const service = new SnippetService();

    await service.save('u2', 'deploy', 'vercel --prod');
    expect(await service.delete('u2', ' deploy ')).toBe(true);
    expect(await service.get('u2', 'deploy')).toBeUndefined();
  });
});
