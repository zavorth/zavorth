import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const checks = [
  {
    file: 'src/contracts/ZavorthDashboardVisualQaContract.ts',
    markers: [
      'zavorth-dashboard-visual-qa.v1',
      'evidence-ready',
      'desktop',
      'mobile',
    ],
  },
  {
    file: 'src/services/ZavorthDashboardVisualQaService.ts',
    markers: [
      'ZavorthDashboardVisualQaService',
      'channel-status-and-actions',
      'qr-and-auth-states',
      'runtime-live-shell',
      'auto-subagent-telemetry',
    ],
  },
  {
    file: 'scripts/zavorth-dashboard-visual-qa.ts',
    markers: [
      '--capture',
      'playwright',
      'manifest.json',
    ],
  },
  {
    file: 'tests/services/ZavorthDashboardVisualQaService.test.ts',
    markers: [
      'reports plan-ready when preview exists without screenshots',
      'reports evidence-ready when screenshots and manifest exist',
    ],
  },
  {
    file: 'package.json',
    markers: [
      'zavorth:dashboard-visual-qa',
      'zavorth:dashboard-visual-qa:check',
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
  console.error('Zavorth dashboard visual QA check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Zavorth dashboard visual QA check passed.');
