import { ZavorthNativeIntelligencePackService } from '../src/services/ZavorthNativeIntelligencePackService.js';
import type { ZavorthNativeSkillPresetId } from '../src/contracts/ZavorthNativeIntelligencePackContract.js';

type CliOptions = {
  json: boolean;
  requirePass: boolean;
  presetId: string | null;
  activate: boolean;
  activateSkillIds: string[];
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    requirePass: false,
    presetId: null,
    activate: false,
    activateSkillIds: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--require-pass' || arg === '--gate') {
      options.requirePass = true;
      continue;
    }
    if (arg === '--activate') {
      options.activate = true;
      continue;
    }
    if (arg === '--preset') {
      options.presetId = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (arg === '--skill' || arg === '--skills') {
      options.activate = true;
      options.activateSkillIds.push(...String(argv[index + 1] || '').split(',').map((entry) => entry.trim()).filter(Boolean));
      index += 1;
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const service = new ZavorthNativeIntelligencePackService();
  const snapshot = service.buildSnapshot({
    presetId: options.presetId as ZavorthNativeSkillPresetId | null,
    activate: options.activate,
    activateSkillIds: options.activateSkillIds,
  });

  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }

  if (options.requirePass && snapshot.status !== 'passed') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[zavorth-native-intelligence-pack] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
