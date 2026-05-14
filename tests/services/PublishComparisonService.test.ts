import fs from 'fs';
import os from 'os';
import path from 'path';
import { PublishComparisonService } from '../../src/services/PublishComparisonService';

function writeFile(root: string, relativePath: string, content: string) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
}

describe('PublishComparisonService', () => {
  it('compares snapshot directories and reports added, removed and changed files', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-publish-compare-'));
    try {
      const fromDocs = path.join(root, 'from-docs');
      const toDocs = path.join(root, 'to-docs');
      const fromConsole = path.join(root, 'from-console');
      const toConsole = path.join(root, 'to-console');

      writeFile(fromDocs, 'index.html', '<html>old docs</html>');
      writeFile(fromDocs, 'guide/getting-started.md', '# old');
      writeFile(toDocs, 'index.html', '<html>new docs</html>');
      writeFile(toDocs, 'guide/getting-started.md', '# old');
      writeFile(toDocs, 'guide/advanced.md', '# added');

      writeFile(fromConsole, 'app.js', 'console.log("old")');
      writeFile(fromConsole, 'styles.css', 'body{color:black}');
      writeFile(toConsole, 'app.js', 'console.log("new")');

      const service = new PublishComparisonService();
      const report = service.compareSnapshots(
        {
          id: 'from',
          label: 'publish antigo',
          commit: 'aaa111',
          docsPath: fromDocs,
          remoteConsolePath: fromConsole,
        },
        {
          id: 'to',
          label: 'publish novo',
          commit: 'bbb222',
          docsPath: toDocs,
          remoteConsolePath: toConsole,
        },
      );

      expect(report.commitChanged).toBe(true);
      expect(report.targets.docs).toEqual(
        expect.objectContaining({
          added: ['guide/advanced.md'],
          removed: [],
          changed: ['index.html'],
          unchangedCount: 1,
        }),
      );
      expect(report.targets.remoteConsole).toEqual(
        expect.objectContaining({
          added: [],
          removed: ['styles.css'],
          changed: ['app.js'],
          unchangedCount: 0,
        }),
      );
      expect(report.overall).toEqual({
        added: 1,
        removed: 1,
        changed: 2,
        unchanged: 1,
      });
      expect(report.summary).toContain('publish antigo -> publish novo');
      expect(report.summary).toContain('commit mudou');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
