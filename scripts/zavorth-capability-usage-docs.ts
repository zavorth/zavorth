import fs from 'node:fs';
import path from 'node:path';

import { ZavorthCapabilityUsageDocsService } from '../src/services/ZavorthCapabilityUsageDocsService.js';

const args = new Set(process.argv.slice(2));
const service = new ZavorthCapabilityUsageDocsService({
  projectRoot: process.cwd(),
  env: process.env,
});
const snapshot = service.buildSnapshot();
const markdown = service.renderMarkdown(snapshot);

if (args.has('--write')) {
  fs.mkdirSync(path.dirname(snapshot.docPath), { recursive: true });
  fs.writeFileSync(snapshot.docPath, markdown, 'utf8');
}

if (args.has('--json')) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(markdown);
}
