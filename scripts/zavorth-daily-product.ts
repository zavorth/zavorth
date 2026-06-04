import { ZavorthDailyProductQuietAutonomyService } from '../src/services/ZavorthDailyProductQuietAutonomyService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const strict = args.includes('--strict');
const profileId = readArg('--profile') || process.env.ZAVORTH_PROFILE || process.env.ZAVORTH_EXPERIENCE_PROFILE || 'personal';

const service = new ZavorthDailyProductQuietAutonomyService();
const snapshot = service.buildSnapshot({ profileId });

if (strict) {
  const failures = [
    snapshot.status !== 'ready' ? `status=${snapshot.status}` : '',
    snapshot.dailyProduct.primarySurface !== 'chat' ? 'primary surface is not chat' : '',
    snapshot.dailyProduct.visibleTabs.length < 7 ? 'daily tabs are incomplete' : '',
    snapshot.quietAutonomy.activePolicy.silentLanes.length === 0 ? 'active profile has no quiet lanes' : '',
    snapshot.quietAutonomy.neverSilent.includes('external_send') ? '' : 'external_send is not approval-bound',
    snapshot.quietAutonomy.neverSilent.includes('secret') ? '' : 'secret is not approval-bound',
    snapshot.quietAutonomy.backgroundReceipts.rawSecretsSerialized === false ? '' : 'quiet receipts may serialize secrets',
  ].filter(Boolean);
  if (failures.length > 0) {
    throw new Error(`Daily Product + Quiet Autonomy check failed: ${failures.join('; ')}`);
  }
}

if (json) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(service.renderText(snapshot));
}

function readArg(name: string): string | null {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1] || null;
  const prefix = `${name}=`;
  const found = args.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}
