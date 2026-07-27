import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const checks = [
  {
    file: 'src/contracts/ZavorthMaturityContract.ts',
    markers: [
      'zavorth-maturity.v1',
      'ZavorthMaturitySnapshot',
      'productionLiveReady',
      'dashboardVisualQaClaimed',
      'hostLiveCertificationHonest',
      'dataLifecycleComplete',
    ],
  },
  {
    file: 'src/services/ZavorthMaturityService.ts',
    markers: [
      'ChannelExperienceCertificationService',
      'LiveReadinessCertificationService',
      'ZavorthHostLiveCertificationService',
      'ZavorthDataLifecyclePolicyService',
      'ZavorthDashboardVisualQaService',
      'OperationalMaturityService',
      'local-partial-truth-ledger',
      'host-live-certification',
      'contract-vs-live-boundary',
      'privacy-data-lifecycle',
    ],
  },
  {
    file: 'scripts/zavorth-maturity.ts',
    markers: [
      'ZavorthMaturityService',
      '--require-pass',
      '--require-mature',
    ],
  },
  {
    file: 'tests/services/ZavorthMaturityService.test.ts',
    markers: [
      'builds a daily-use-ready maturity snapshot',
      'blocks maturity when channel contracts fail',
    ],
  },
  {
    file: 'package.json',
    markers: [
      'zavorth:maturity',
      'zavorth:maturity:check',
      'security:doctor',
      'security:continuous',
      'security:preset',
      'zavorth:live-host',
      'zavorth:data-lifecycle',
      'zavorth:zavorthControl-visual-qa',
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
  console.error('Zavorth maturity check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Zavorth maturity check passed.');
