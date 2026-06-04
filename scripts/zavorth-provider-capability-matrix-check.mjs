#!/usr/bin/env node
import { execSync } from 'node:child_process';

const raw = execSync('npx tsx scripts/zavorth-provider-capability-matrix.ts --json', {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
const snapshot = JSON.parse(raw);
const providers = new Map((snapshot.providers || []).map((provider) => [provider.id, provider]));

assert(snapshot.surface === 'provider-capability-matrix', 'provider matrix surface is exposed');
assert(snapshot.status === 'ready', 'provider matrix is ready');
assert(snapshot.summary.total >= 50, 'provider matrix includes broad provider catalog');
assert(snapshot.summary.doctorAvailable === snapshot.summary.total, 'every provider has doctor command');
assert(snapshot.summary.canaryAvailable === snapshot.summary.total, 'every provider has canary command');
assert(Boolean(providers.get('openai')), 'openai route is present');
assert(Boolean(providers.get('runway')), 'runway media route is present');
assert((providers.get('runway')?.modalities || []).includes('video'), 'runway exposes video modality');
assert(String(snapshot.llmContextBlock || '').includes('Do not infer provider coverage from src/providers only'), 'LLM discovery warning is present');
assert(JSON.stringify(snapshot).includes('OPENAI_API_KEY'), 'env refs are named');
assert(!JSON.stringify(snapshot).includes('sk-'), 'secret values are not serialized');

console.log(`[zavorth-provider-capability-matrix] passed providers=${snapshot.summary.total} configured=${snapshot.summary.configured}`);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
