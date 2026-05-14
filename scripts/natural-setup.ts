import { ZavorthNaturalSetupAssistantApiService } from '../src/services/ZavorthNaturalSetupAssistantApiService.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const text = readOption('--text')
  || readOption('--prompt')
  || args.find((arg) => !arg.startsWith('--'))
  || '';
const actorLabel = readOption('--actor');
const preferredCapabilityId = readOption('--capability') || readOption('--target');
const approvalId = readOption('--approval-id');
const persistSecrets = args.includes('--persist-secrets');
const inspectMode = args.includes('--inspect');

const api = new ZavorthNaturalSetupAssistantApiService();
const input = {
  text,
  actorLabel,
  preferredCapabilityId,
  approvalId,
  persistSecrets,
};
const snapshot = api.buildSnapshot(input);

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else if (inspectMode) {
  console.log('Zavorth Natural Setup Assistant');
  console.log('');
  console.log(`Intent: ${snapshot.detectedIntent.action} (${snapshot.detectedIntent.confidence})`);
  console.log(`Target: ${snapshot.selectedCapability?.id || 'not-found'}`);
  console.log(`Readiness: ${snapshot.readiness.status}`);
  console.log(`Secrets: required=${snapshot.secretPlan.requiredRefs.length} missing=${snapshot.secretPlan.missingRefs.length} serialized=${snapshot.secretPlan.rawSecretValuesSerialized}`);
  console.log(`Approval: ${snapshot.safety.approvalRequired}`);
  console.log('');
  console.log(api.renderReply(input));
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
