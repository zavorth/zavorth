import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const requiredMarkers = [
  {
    file: 'src/contracts/ChannelExperienceCertificationContract.ts',
    markers: [
      'channel-experience-certification.v1',
      'ChannelExperienceCertificationEntry',
      'releaseReady',
    ],
  },
  {
    file: 'src/services/ChannelExperienceCertificationService.ts',
    markers: [
      'REQUIRED_CERTIFIED_CHANNELS',
      'REQUIRED_CHANNEL_EXPERIENCE_COMMANDS',
      'login-qr',
      '/api/webhooks/instagram',
      'safeCallbacksReady',
      'renderSurfaceResponseForTarget',
      'buildSmokePlan',
    ],
  },
  {
    file: 'scripts/channel-experience-certification.ts',
    markers: [
      '--require-pass',
      '--channel=',
      'ChannelExperienceCertificationService',
    ],
  },
  {
    file: 'tests/services/ChannelExperienceCertificationService.test.ts',
    markers: [
      'release-ready certification',
      'blocks certification when a required channel is missing',
      'keeps WhatsApp QR and Instagram webhook visible',
    ],
  },
  {
    file: 'package.json',
    markers: [
      'channel-experience-certification',
      'channel-experience-certification:check',
      'qa:channel-experience-certification',
    ],
  },
];

const failures = [];

for (const requirement of requiredMarkers) {
  const content = readFileSync(resolve(root, requirement.file), 'utf8');
  for (const marker of requirement.markers) {
    if (!content.includes(marker)) {
      failures.push(`${requirement.file} missing marker: ${marker}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Channel experience certification check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Channel experience certification check passed.');
