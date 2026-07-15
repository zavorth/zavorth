/**
 * Package B structural check: golden path script + docs + npm wiring present.
 * Does not run the full hermetic path (use npm run knowledge:golden-path for that).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function mustExist(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) failures.push(`missing ${rel}`);
}

function mustContain(rel, markers) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    failures.push(`missing ${rel}`);
    return;
  }
  const text = fs.readFileSync(full, 'utf8');
  for (const [label, marker] of markers) {
    if (!text.includes(marker)) failures.push(`${rel}: missing ${label} (${marker})`);
  }
}

mustExist('scripts/learned-knowledge-golden-path.ts');
mustExist('docs/product/learned-knowledge-first-use.md');
mustExist('docs/product/learned-knowledge-plane.md');
mustExist('docs/product/demo-scripts.md');

mustContain('package.json', [
  ['npm knowledge:golden-path', 'knowledge:golden-path'],
  ['npm qa knowledge golden path', 'qa:zavorth-learned-knowledge-golden-path'],
]);

mustContain('scripts/learned-knowledge-golden-path.ts', [
  ['workflow draft step', 'workflow-draft'],
  ['pack inject step', 'pack-inject'],
  ['story timeline step', 'story-timeline'],
  ['hub snapshot step', 'hub-snapshot'],
  ['dream preview step', 'dream-preview'],
  ['forget step', 'forget-workflow'],
  ['free-text purity step', 'free-text-purity'],
  ['hermetic claim', 'claimsLiveIntelligence: false'],
]);

mustContain('docs/product/learned-knowledge-first-use.md', [
  ['10 minute trail', '10 minutes'],
  ['golden path command', 'knowledge:golden-path'],
  ['four pillars', 'Workflows'],
]);

mustContain('docs/product/demo-scripts.md', [
  ['Script D', 'Script D'],
  ['learned knowledge', 'knowledge:golden-path'],
]);

mustContain('docs/product/HOW-TO-TEST-VALUE.md', [['learned knowledge golden path', 'knowledge:golden-path']]);

if (failures.length) {
  console.error('learned-knowledge-golden-path-check FAIL');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('[pass] learned-knowledge-golden-path structural check');
process.exit(0);
