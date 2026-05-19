#!/usr/bin/env tsx
import { ZavorthMnemosProceduralMemoryService } from '../src/services/ZavorthMnemosProceduralMemoryService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const service = new ZavorthMnemosProceduralMemoryService();

function valueAfter(flag: string): string | null {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] || null : null;
}

const action = args.find((entry) => ['preview', 'apply', 'list', 'query', 'revoke'].includes(entry)) || 'list';
const text = valueAfter('--text') || args.filter((entry) => !entry.startsWith('--') && entry !== action).join(' ');
const approvalId = valueAfter('--approval-id');
const id = valueAfter('--id');
const reason = valueAfter('--reason');
const scope = (valueAfter('--scope') || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

const snapshot = action === 'preview'
  ? service.preview({ text, scope })
  : action === 'apply'
    ? service.apply({ text, scope, approvalId })
    : action === 'query'
      ? service.query({ query: text || valueAfter('--query') || '' })
      : action === 'revoke'
        ? service.revoke({ id: id || '', approvalId, reason })
        : service.list();

if (json) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  console.log(`Mnemos procedural memory: ${snapshot.status}`);
  console.log(`Action: ${snapshot.action}`);
  console.log(`Rules: total ${snapshot.summary.total}, active ${snapshot.summary.active}, revoked ${snapshot.summary.revoked}`);
  if (snapshot.rule) {
    console.log(`Rule: ${snapshot.rule.id}`);
    console.log(`Kind: ${snapshot.rule.kind}`);
    console.log(`Risk: ${snapshot.rule.risk}`);
    console.log(`Statement: ${snapshot.rule.statement}`);
  }
  for (const rule of snapshot.rules.slice(0, 10)) {
    console.log(`- ${rule.id} [${rule.status}/${rule.kind}/${rule.risk}] ${rule.statement}`);
  }
}

if (snapshot.status === 'blocked') {
  process.exitCode = 1;
}
