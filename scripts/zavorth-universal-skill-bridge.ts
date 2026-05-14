import path from 'path';
import { UniversalSkillBridgeRuntimeService } from '../src/skills/UniversalSkillBridgeRuntimeService.js';
import type { ZavorthUniversalSkillBridgeMode } from '../src/contracts/ZavorthUniversalSkillBridgeRuntimeContract.js';

type CliOptions = {
  projectRoot: string | null;
  skillName: string;
  intent: string | null;
  mode: ZavorthUniversalSkillBridgeMode;
  channel: string | null;
  ownerApprovalId: string | null;
  securityProfile: string | null;
  maxPromptChars: number | null;
  allowLocalSkills: boolean;
  persistReceipt: boolean;
  json: boolean;
  requirePass: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    projectRoot: null,
    skillName: '',
    intent: null,
    mode: 'dry-run',
    channel: null,
    ownerApprovalId: null,
    securityProfile: null,
    maxPromptChars: null,
    allowLocalSkills: false,
    persistReceipt: true,
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
    if (arg === '--skill' || arg === '--skill-name') {
      options.skillName = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (arg === '--intent' || arg === '--task') {
      options.intent = String(argv[index + 1] || '').trim();
      index += 1;
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
      const value = String(argv[index + 1] || '').trim();
      options.mode = value === 'live' ? 'live' : 'dry-run';
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
    if (arg === '--profile' || arg === '--security-profile') {
      options.securityProfile = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (arg === '--max-prompt-chars') {
      const parsed = Number(argv[index + 1]);
      options.maxPromptChars = Number.isFinite(parsed) ? parsed : null;
      index += 1;
      continue;
    }
    if (arg === '--allow-local-skills') {
      options.allowLocalSkills = true;
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
  const service = new UniversalSkillBridgeRuntimeService({
    projectRoot: options.projectRoot || undefined,
  });
  const snapshot = await service.invoke({
    skillName: options.skillName,
    intent: options.intent,
    mode: options.mode,
    channel: options.channel,
    ownerApprovalId: options.ownerApprovalId,
    securityProfile: options.securityProfile,
    maxPromptChars: options.maxPromptChars || undefined,
    allowLocalSkills: options.allowLocalSkills,
    persistReceipt: options.persistReceipt,
  });

  if (options.json) {
    originalLog(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }

  console.log = originalLog;
  console.warn = originalWarn;

  if (options.requirePass && !['dry-run', 'prepared'].includes(snapshot.status)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[universal-skill-bridge] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
