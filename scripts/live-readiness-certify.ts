import {
  LiveReadinessCertificationService,
} from '../src/services/LiveReadinessCertificationService.js';
import type {
  LiveReadinessCertificationProfile,
} from '../src/contracts/LiveReadinessCertificationContract.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const requireCertified = args.includes('--require-certified');
const profile = readProfile(readArg('--profile') || 'staging-live');
const service = new LiveReadinessCertificationService();
const snapshot = service.buildSnapshot({ profile });

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.formatCertificationText(snapshot));
}

if (requireCertified && snapshot.status !== 'certified') {
  process.exitCode = 1;
}

function readArg(name: string): string | null {
  const direct = args.find((arg) => arg.startsWith(`${name}=`));
  if (direct) {
    return direct.slice(name.length + 1);
  }
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1];
  }
  return null;
}

function readProfile(value: string): LiveReadinessCertificationProfile {
  if (value === 'staging-live' || value === 'production-live') {
    return value;
  }
  console.error(`[live-readiness-certify] unsupported profile: ${value}`);
  process.exit(1);
}
