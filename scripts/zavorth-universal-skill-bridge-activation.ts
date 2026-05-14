import path from 'path';
import { UniversalSkillBridgeActivationService } from '../src/services/UniversalSkillBridgeActivationService.js';
import { UniversalSkillBridgeRegistryService } from '../src/services/UniversalSkillBridgeRegistryService.js';
import { SkillCatalogService } from '../src/skills/SkillCatalogService.js';
import { SkillLoader } from '../src/skills/SkillLoader.js';
import { SkillSourceRegistryService } from '../src/services/SkillSourceRegistryService.js';
import { SkillTrustPolicyService } from '../src/services/SkillTrustPolicyService.js';
import { UniversalSkillBridgeRuntimeService } from '../src/skills/UniversalSkillBridgeRuntimeService.js';

type CliOptions = {
  projectRoot: string | null;
  args: string;
  channel: string | null;
  actorId: string | null;
  persistReceipt: boolean;
  json: boolean;
  requirePass: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    projectRoot: null,
    args: '',
    channel: null,
    actorId: null,
    persistReceipt: true,
    json: false,
    requirePass: false,
  };
  const positional: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project-root') {
      options.projectRoot = path.resolve(String(argv[index + 1] || '').trim() || '.');
      index += 1;
      continue;
    }
    if (arg === '--args' || arg === '--command') {
      options.args = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (arg === '--channel') {
      options.channel = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (arg === '--actor' || arg === '--actor-id' || arg === '--user-id') {
      options.actorId = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (arg === '--no-persist') {
      options.persistReceipt = false;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--require-pass' || arg === '--gate') {
      options.requirePass = true;
      continue;
    }
    positional.push(arg);
  }

  if (!options.args && positional.length > 0) {
    options.args = positional.join(' ').trim();
  }
  return options;
}

function buildService(projectRoot: string | null): UniversalSkillBridgeActivationService {
  if (!projectRoot) {
    return new UniversalSkillBridgeActivationService();
  }
  const registryService = new UniversalSkillBridgeRegistryService({
    skillCatalogService: new SkillCatalogService({
      skillLoader: new SkillLoader({
        sourceRegistryService: new SkillSourceRegistryService({ projectRoot }),
        skillTrustPolicyService: new SkillTrustPolicyService({ projectRoot }),
      }),
    }),
    bridgeRuntimeService: new UniversalSkillBridgeRuntimeService({ projectRoot }),
  });
  return new UniversalSkillBridgeActivationService({ registryService });
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const originalLog = console.log;
  const originalWarn = console.warn;
  if (options.json) {
    console.log = () => undefined;
    console.warn = () => undefined;
  }

  const service = buildService(options.projectRoot);
  const snapshot = await service.executeCommand({
    args: options.args,
    channel: options.channel || 'cli',
    actorId: options.actorId,
    persistReceipt: options.persistReceipt,
  });

  console.log = originalLog;
  console.warn = originalWarn;

  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.renderReport(snapshot));
  }

  if (options.requirePass && ['denied', 'not-found'].includes(snapshot.status)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[universal-skill-bridge-activation] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
