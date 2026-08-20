import { ZavorthSatelliteApprovalCompanionService } from '../src/services/ZavorthSatelliteApprovalCompanionService.js';

const args = process.argv.slice(2);
const service = new ZavorthSatelliteApprovalCompanionService();
const snapshot = service.buildSnapshot({
  user: readFlag('user') || 'local-operator',
  missionId: readFlag('mission') || null,
  includeAdvanced: args.includes('--advanced'),
  includeAdvancedStory: args.includes('--advanced-story') || args.includes('--advanced'),
});

if (args.includes('--json')) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(service.renderText(snapshot));
}

function readFlag(name: string): string | null {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : null;
}
