import { ZavorthCapabilityPackReadinessDoctorApiService } from '../src/services/ZavorthCapabilityPackReadinessDoctorApiService.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const input = {
  packId: readOption('--pack') || readOption('--pack-id'),
  targetItemId: readOption('--target') || readOption('--capability'),
  availableSecretRefs: readOptions('--secret-ref'),
  availableEnvKeys: readOptions('--env-key'),
  availableBinaries: readOptions('--binary'),
  completedManualSteps: readOptions('--manual-step'),
  completedReadinessChecks: readOptions('--readiness-check'),
  localRoutes: readRoutes(),
};
const api = new ZavorthCapabilityPackReadinessDoctorApiService();
const snapshot = api.buildSnapshot(input);

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(api.renderReport(input));
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
