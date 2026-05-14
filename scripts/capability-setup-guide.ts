import type { CapabilitySetupAudience } from '../src/contracts/CapabilitySetupConversationContract.js';
import { ZavorthCapabilitySetupConversationApiService } from '../src/services/ZavorthCapabilitySetupConversationApiService.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const input = {
  text: readOption('--text') || readOption('--prompt'),
  targetItemId: readOption('--target') || readOption('--capability'),
  packId: readOption('--pack') || readOption('--pack-id'),
  actorLabel: readOption('--actor'),
  approvalId: readOption('--approval-id'),
  audience: (readOption('--audience') || 'everyday') as CapabilitySetupAudience,
  availableSecretRefs: readOptions('--secret-ref'),
  availableEnvKeys: readOptions('--env-key'),
  availableBinaries: readOptions('--binary'),
  completedManualSteps: readOptions('--manual-step'),
  completedReadinessChecks: readOptions('--readiness-check'),
  localRoutes: readRoutes(),
};
const api = new ZavorthCapabilitySetupConversationApiService();
const snapshot = api.buildSnapshot(input);

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(api.renderReply(input));
}

function readOption(name: string): string | null {
  const index = args.indexOf(name);
  if (index < 0) {
    return null;
  }
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    return null;
  }
  return value;
}

function readOptions(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== name) {
      continue;
    }
    const value = args[index + 1];
    if (value && !value.startsWith('--')) {
      values.push(value);
    }
  }
  return values;
}

function readRoutes(): Record<string, boolean> {
  const routes: Record<string, boolean> = {};
  for (const value of readOptions('--local-route')) {
    const [id, state] = value.split('=');
    if (id) {
      routes[id] = state ? state === 'true' || state === '1' || state === 'ok' : true;
    }
  }
  return routes;
}
