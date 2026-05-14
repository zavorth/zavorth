import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const checks = [
  {
    file: 'src/contracts/ZavorthHostLiveCertificationContract.ts',
    markers: [
      'zavorth-host-live-certification.v1',
      'contractReadyIsNotLive',
      'liveRequiresBoundedRecipients',
    ],
  },
  {
    file: 'src/services/ZavorthHostLiveCertificationService.ts',
    markers: [
      'ZavorthHostLiveCertificationService',
      'Provider real configurado',
      'Recipients/allowlist delimitados',
      'noExternalSendDuringCertification',
    ],
  },
  {
    file: 'scripts/zavorth-live-host-certification.ts',
    markers: [
      '--require-live',
      'ZavorthHostLiveCertificationService',
    ],
  },
  {
    file: 'tests/services/ZavorthHostLiveCertificationService.test.ts',
    markers: [
      'keeps contract-ready separate from production live',
      'certifies a channel as live-ready only with provider and recipients',
    ],
  },
  {
    file: 'package.json',
    markers: [
      'zavorth:live-host',
      'zavorth:live-host:check',
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
  console.error('Zavorth live host certification check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Zavorth live host certification check passed.');
