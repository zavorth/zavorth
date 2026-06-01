import { ZavorthMnemosFtsIndexService } from '../src/services/ZavorthMnemosFtsIndexService.js';

const json = process.argv.includes('--json');
const service = new ZavorthMnemosFtsIndexService();
const snapshot = service.rebuild();

if (json) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write([
    'Zavorth Mnemos FTS Index',
    `status: ${snapshot.status}`,
    `fts5: ${snapshot.fts5Available ? 'available' : 'unavailable'}`,
    `pages: ${snapshot.pagesIndexed}`,
    `db: ${snapshot.dbPath}`,
    snapshot.reason ? `reason: ${snapshot.reason}` : '',
  ].filter(Boolean).join('\n'));
  process.stdout.write('\n');
}
