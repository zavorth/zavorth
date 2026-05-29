import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const checks = [
  {
    file: 'src/contracts/ZavorthControlVisualQaContract.ts',
    markers: [
      'zavorth-control-visual-qa.v1',
      'evidence-ready',
      'desktop',
      'mobile',
    ],
  },
  {
    file: 'src/services/ZavorthControlVisualQaService.ts',
    markers: [
      'ZavorthControlVisualQaService',
      'channel-status-and-actions',
      'qr-and-auth-states',
      'runtime-live-shell',
      'auto-subagent-telemetry',
    ],
  },
  {
    file: 'scripts/zavorth-control-visual-qa.ts',
    markers: [
      '--capture',
      'playwright',
      'manifest.json',
    ],
  },
  {
    file: 'tests/services/ZavorthControlVisualQaService.test.ts',
    markers: [
      'reports plan-ready when preview exists without screenshots',
      'reports evidence-ready when screenshots and manifest exist',
    ],
  },
  {
    file: 'package.json',
    markers: [
      'zavorth:zavorthControl-visual-qa',
      'zavorth:zavorthControl-visual-qa:check',
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
  console.error('Zavorth zavorthControl visual QA check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Zavorth zavorthControl visual QA check passed.');
