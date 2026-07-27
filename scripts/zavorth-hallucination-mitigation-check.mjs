import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const checks = [
  {
    file: 'src/contracts/ZavorthHallucinationMitigationContract.ts',
    markers: [
      'zavorth-hallucination-mitigation.v1',
      'ZavorthHallucinationMitigationReview',
      'executionClaimWithoutReceipt',
    ],
  },
  {
    file: 'src/services/ZavorthHallucinationMitigationService.ts',
    markers: [
      'ZavorthHallucinationMitigationService',
      'DISCIPLINA ANTI-ALUCINACAO',
      'Do not invent citations',
      'I do not have an execution receipt',
    ],
  },
  {
    file: 'src/agents/ConversationalAgent.ts',
    markers: [
      'ZavorthHallucinationMitigationService',
      'hallucinationMitigation.reviewResponse',
      'hallucinationMitigation.buildInstruction',
    ],
  },
  {
    file: 'src/runtime/agent/AgentRunLlmRuntimeExecutor.ts',
    markers: [
      'ZavorthHallucinationMitigationService',
      'hallucinationMitigation',
      'countToolReceipts',
    ],
  },
  {
    file: 'tests/services/ZavorthHallucinationMitigationService.test.ts',
    markers: [
      'mitigates current factual claims without evidence',
      'mitigates execution claims without receipts',
      'allows grounded evidence-sensitive answers',
    ],
  },
  {
    file: 'package.json',
    markers: [
      'zavorth:hallucination-mitigation:check',
    ],
  },
];

const failures = [];

for (const check of checks) {
  const content = readFileSync(resolve(root, check.file), 'utf8');
  for (const marker of check.markers) {
    if (!content.includes(marker)) {
      failures.push(`${check.file} missing marker: ${marker}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Zavorth hallucination mitigation check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Zavorth hallucination mitigation check passed.');
