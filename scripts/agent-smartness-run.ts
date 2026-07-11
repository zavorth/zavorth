import path from 'node:path';
import { AgentSmartnessService } from '../src/services/agent-smartness/AgentSmartnessService.js';
import { ProfileManifestService } from '../src/services/ProfileManifestService.js';

async function main(): Promise<void> {
  const asJson = process.argv.includes('--json');
  const asCheck = process.argv.includes('--check');
  const profileDir = path.join(process.cwd(), 'config', 'profile-manifests');
  const report = await new AgentSmartnessService({
    profileDir,
    profileService: new ProfileManifestService({ profileDir }),
  }).run();

  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${new AgentSmartnessService().renderText(report)}\n`);
  }

  if (asCheck && !report.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
