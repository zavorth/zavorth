import { execSync } from 'node:child_process';

const raw = execSync('npx tsx scripts/zavorth-capability-atlas.ts --json', {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
const snapshot = JSON.parse(raw);
const ids = new Set((snapshot.entries || []).map((entry) => entry.id));
const required = [
  'action-harness',
  'capability-atlas',
  'echo',
  'mnemos',
  'nexus',
  'provider-mesh',
  'channel-mesh',
  'skill-curator',
  'runtime-tui',
];
const missing = required.filter((id) => !ids.has(id));
if (snapshot.surface !== 'capability-atlas') {
  throw new Error(`Unexpected surface: ${snapshot.surface}`);
}
if (missing.length > 0) {
  throw new Error(`Capability Atlas missing required entries: ${missing.join(', ')}`);
}
if (!String(snapshot.llmContextBlock || '').includes('Capability Atlas')) {
  throw new Error('Capability Atlas did not generate LLM context block.');
}
console.log(`[zavorth-capability-atlas] passed entries=${snapshot.summary.total} ready=${snapshot.summary.ready} partial=${snapshot.summary.partial}`);
