import fs from 'fs';
import os from 'os';
import path from 'path';
import { PublishHistoryService } from '../../src/services/PublishHistoryService';

function writeFile(root: string, relativePath: string, content: string) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
}

describe('PublishHistoryService', () => {
  it('builds history summaries with diff against the previous publish', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-publish-history-'));
    try {
      const archiveA = path.join(root, 'data', 'publish-archives', 'archive-a');
      const archiveB = path.join(root, 'data', 'publish-archives', 'archive-b');

      writeFile(path.join(archiveA, 'docs'), 'index.html', 'docs-a');
      writeFile(path.join(archiveA, 'remote-console'), 'app.js', 'console-a');

      writeFile(path.join(archiveB, 'docs'), 'index.html', 'docs-b');
      writeFile(path.join(archiveB, 'docs'), 'guide.md', 'added');
      writeFile(path.join(archiveB, 'remote-console'), 'app.js', 'console-b');

      const service = new PublishHistoryService(root);
      const summaries = service.summarize([
        {
          commit: 'bbb22222',
          archive: {
            id: 'archive-b',
            targets: {
              docs: 'data/publish-archives/archive-b/docs',
              remoteConsole: 'data/publish-archives/archive-b/remote-console',
            },
          },
        },
        {
          commit: 'aaa11111',
          archive: {
            id: 'archive-a',
            targets: {
              docs: 'data/publish-archives/archive-a/docs',
              remoteConsole: 'data/publish-archives/archive-a/remote-console',
            },
          },
        },
      ]);

      expect(summaries[0].descriptor?.id).toBe('archive-b');
      expect(summaries[0].comparisonToPrevious?.overall).toEqual({
        added: 1,
        removed: 0,
        changed: 2,
        unchanged: 0,
      });
      expect(summaries[0].comparisonToPrevious?.summary).toContain('commit mudou');
      expect(summaries[1].comparisonToPrevious).toBeNull();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
