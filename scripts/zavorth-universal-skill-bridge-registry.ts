import path from 'path';
import { UniversalSkillBridgeRegistryService } from '../src/services/UniversalSkillBridgeRegistryService.js';
import type { ZavorthUniversalSkillBridgeMode } from '../src/contracts/ZavorthUniversalSkillBridgeRuntimeContract.js';
import { SkillCatalogService } from '../src/skills/SkillCatalogService.js';
import { SkillLoader } from '../src/skills/SkillLoader.js';
import { SkillSourceRegistryService } from '../src/services/SkillSourceRegistryService.js';
import { SkillTrustPolicyService } from '../src/services/SkillTrustPolicyService.js';
import { UniversalSkillBridgeRuntimeService } from '../src/skills/UniversalSkillBridgeRuntimeService.js';

type CliOptions = {
  projectRoot: string | null;
  selectedId: string | null;
  query: string | null;
  invoke: boolean;
  mode: ZavorthUniversalSkillBridgeMode;
  channel: string | null;
  ownerApprovalId: string | null;
  intent: string | null;
  persistReceipt: boolean;
  json: boolean;
  requirePass: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    projectRoot: null,
    selectedId: null,
    query: null,
    invoke: false,
    mode: 'dry-run',
    channel: null,
    ownerApprovalId: null,
    intent: null,
    persistReceipt: false,
    json: false,
    requirePass: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project-root') {
      options.projectRoot = path.resolve(String(argv[index + 1] || '').trim() || '.');
      index += 1;
      continue;
    }
    if (arg === '--skill' || arg === '--id' || arg === '--selected') {
      options.selectedId = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (arg === '--query' || arg === '--q') {
      options.query = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (arg === '--invoke') {
      options.invoke = true;
      continue;
    }
    if (arg === '--live') {
      options.mode = 'live';
      continue;
    }
    if (arg === '--dry-run') {
      options.mode = 'dry-run';
      continue;
    }
    if (arg === '--mode') {
      options.mode = String(argv[index + 1] || '').trim() === 'live' ? 'live' : 'dry-run';
      index += 1;
      continue;
    }
    if (arg === '--channel') {
      options.channel = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (arg === '--approval-id' || arg === '--owner-approval-id') {
      options.ownerApprovalId = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (arg === '--intent' || arg === '--task') {
      options.intent = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (arg === '--persist') {
      options.persistReceipt = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--require-pass' || arg === '--gate') {
      options.requirePass = true;
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const originalLog = console.log;
  const originalWarn = console.warn;
  if (options.json) {
    console.log = () => undefined;
    console.warn = () => undefined;
  }

  const service = options.projectRoot
    ? new UniversalSkillBridgeRegistryService({
      skillCatalogService: new SkillCatalogService({
        skillLoader: new SkillLoader({
          sourceRegistryService: new SkillSourceRegistryService({ projectRoot: options.projectRoot }),
          skillTrustPolicyService: new SkillTrustPolicyService({ projectRoot: options.projectRoot }),
        }),
      }),
      bridgeRuntimeService: new UniversalSkillBridgeRuntimeService({ projectRoot: options.projectRoot }),
    })
    : new UniversalSkillBridgeRegistryService();
  const snapshot = await service.buildSnapshot({
    selectedId: options.selectedId,
    query: options.query,
    invoke: options.invoke,
    mode: options.mode,
    channel: options.channel,
    ownerApprovalId: options.ownerApprovalId,
    intent: options.intent,
    persistReceipt: options.persistReceipt,
  });

  console.log = originalLog;
  console.warn = originalWarn;

  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.renderReport(snapshot));
  }

  if (options.requirePass && snapshot.summary.blocked > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[universal-skill-bridge-registry] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
