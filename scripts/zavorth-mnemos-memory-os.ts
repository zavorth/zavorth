import { buildZavorthMnemosMemoryOsContractSnapshot } from '../src/contracts/ZavorthMnemosMemoryOsContract.js';
import { ContextCompactionService, type ContextCompactionMessage } from '../src/services/ContextCompactionService.js';

const json = process.argv.includes('--json');

const sampleMessages: ContextCompactionMessage[] = [
  {
    role: 'user',
    content: 'Build a memory engine with compaction, wiki, handoff and safety receipts.',
  },
  {
    role: 'tool',
    toolName: 'shell',
    status: 'ok',
    content: Array.from({ length: 160 }, (_, index) => `line ${index}: verbose build output`).join('\n'),
  },
  {
    role: 'assistant',
    content: 'Implemented the first contract and prepared the next step.',
  },
  {
    role: 'user',
    content: 'Next, keep the recent instructions verbatim and do not leak api_key=abc123secret.',
  },
];

function main(): void {
  const now = new Date();
  const contract = buildZavorthMnemosMemoryOsContractSnapshot(now);
  const compactor = new ContextCompactionService();
  const compaction = compactor.compact({
    messages: sampleMessages,
    now,
    lastActivityAt: new Date(now.getTime() - 61 * 60 * 1000),
    usableContextTokens: 120,
    reservedTokenBuffer: 30,
    recentVerbatimTurns: 2,
  });

  const snapshot = {
    generatedAt: now.toISOString(),
    status: 'ready',
    contract: {
      version: contract.version,
      tiers: contract.summary.tiers,
      compactionModes: contract.summary.compactionModes,
      wikiRoot: contract.wiki.root,
      hardRules: contract.hardRules,
    },
    compaction: {
      mode: compaction.mode,
      triggered: compaction.triggered,
      reductionTokens: compaction.reductionTokens,
      clearedToolOutputs: compaction.clearedToolOutputs,
      compactedOlderMessages: compaction.compactedOlderMessages,
      providerCall: compaction.receipt.providerCall,
      durableMutation: compaction.receipt.durableMutation,
    },
    next: contract.nextStages[0],
  };

  if (json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  console.log('Zavorth Mnemos Memory OS');
  console.log(`status: ${snapshot.status}`);
  console.log(`version: ${snapshot.contract.version}`);
  console.log(`tiers: ${snapshot.contract.tiers}`);
  console.log(`compaction modes: ${snapshot.contract.compactionModes}`);
  console.log(`wiki root: ${snapshot.contract.wikiRoot}`);
  console.log(`sample compaction: ${snapshot.compaction.mode}`);
  console.log(`sample reduction: ${snapshot.compaction.reductionTokens} token(s)`);
  console.log(`next: ${snapshot.next}`);
}

main();
