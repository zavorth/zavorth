import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const checks = [
  {
    file: 'src/contracts/ZavorthDataLifecycleContract.ts',
    markers: [
      'zavorth-data-lifecycle.v1',
      'rawSecretExportAllowed',
      'userContentNeedsLifecycle',
    ],
  },
  {
    file: 'src/services/ZavorthDataLifecyclePolicyService.ts',
    markers: [
      'ZavorthDataLifecyclePolicyService',
      'app-logs',
      'media-cache',
      'db-backups',
      'session-history',
      'approval-receipts',
    ],
  },
  {
    file: 'scripts/zavorth-data-lifecycle.ts',
    markers: [
      '--require-pass',
      'ZavorthDataLifecyclePolicyService',
    ],
  },
  {
    file: 'tests/services/ZavorthDataLifecyclePolicyService.test.ts',
    markers: [
      'covers the complete operational data lifecycle',
      'blocks release when evidence is missing',
    ],
  },
  {
    file: 'package.json',
    markers: [
      'zavorth:data-lifecycle',
      'zavorth:data-lifecycle:check',
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
  console.error('Zavorth data lifecycle check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Zavorth data lifecycle check passed.');
