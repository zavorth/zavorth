#!/usr/bin/env node
import { MnemosDreamCycleService } from '../src/services/MnemosDreamCycleService.js';

const args = process.argv.slice(2);

main();

function main(): void {
  const service = new MnemosDreamCycleService();
  const snapshot = service.buildCycle({
    storeId: readFlag('--store') || 'mnemos-main',
    existingMemories: [],
    sessions: [
      {
        sessionId: readFlag('--session') || 'sample-session',
        createdAt: new Date().toISOString(),
        summary: readFlag('--summary') || 'User prefers concise answers and reviewable memory updates.',
        observations: [
          {
            id: 'sample-observation',
            kind: normalizeKind(readFlag('--kind')) || 'preference',
            text: readFlag('--observation') || 'User prefers concise answers.',
            evidenceRefs: ['sample-turn'],
            updatedAt: new Date().toISOString(),
            confidence: 0.82,
          },
        ],
      },
    ],
  });

  const action = readFlag('--action');
  if (action === 'apply' || action === 'reject') {
    const result = service.executeReviewAction(snapshot, {
      action,
      actor: readFlag('--actor') || 'operator',
      approvalId: readFlag('--approval'),
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (args.includes('--json')) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  console.log([
    'Mnemos Dream Cycle',
    '',
    `status: ${snapshot.status}`,
    `source: ${snapshot.sourceStore.storeId} (immutable)`,
    `candidate: ${snapshot.candidateStore.storeId}`,
    `memories: ${snapshot.candidateStore.memories.length}`,
    `quarantine: ${snapshot.quarantine.length}`,
    '',
    'actions:',
    ...snapshot.actions.map((actionItem) => `- ${actionItem.kind}: ${actionItem.summary}`),
  ].join('\n'));
}

function readFlag(name: string): string | null {
  const direct = args.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1).trim() || null;
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1]?.trim() || null : null;
}

function normalizeKind(value: string | null) {
  if (
    value === 'preference'
    || value === 'procedure'
    || value === 'project-fact'
    || value === 'user-model'
    || value === 'policy'
  ) {
    return value;
  }
  return null;
}
