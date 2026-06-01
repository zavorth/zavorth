import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const requiredFiles = [
  'src/contracts/ZavorthOperationalRefinementContract.ts',
  'src/services/ZavorthOperationalRefinementService.ts',
  'src/services/ZavorthMnemosUnifiedMemoryService.ts',
  'src/services/VoiceWakeDetectorSetupService.ts',
  'src/services/ZavorthSatelliteApprovalDailyService.ts',
  'src/services/SkillQuarantinePipelineService.ts',
  'scripts/zavorth-operational-refinement.ts',
  'tests/services/ZavorthOperationalRefinementService.test.ts',
];

const failures = [];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`);
}

const scriptResult = spawnSync(
  process.platform === 'win32' ? 'cmd.exe' : 'npx',
  process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npx tsx scripts/zavorth-operational-refinement.ts --json']
    : ['tsx', 'scripts/zavorth-operational-refinement.ts', '--json'],
  { cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024 * 20 },
);

if (scriptResult.status !== 0) {
  failures.push(`operational refinement script failed: ${scriptResult.stderr || scriptResult.stdout}`);
} else {
  try {
    const snapshot = JSON.parse(scriptResult.stdout);
    if (snapshot.contractVersion !== 'zavorth-operational-refinement/1') failures.push('unexpected contract version');
    for (const key of ['a2uiCanvas', 'mnemosUnifiedMemory', 'satelliteApprovals', 'wakeDetectorSetup', 'skillQuarantine']) {
      if (!snapshot[key]) failures.push(`missing snapshot section ${key}`);
    }
    if (snapshot.a2uiCanvas?.actionBridgeReady !== true) failures.push('A2UI action bridge is not proven');
    if (snapshot.a2uiCanvas?.security?.hostAccess !== 'blocked') failures.push('A2UI host access is not blocked');
    if (snapshot.satelliteApprovals?.executionAuthority !== false) failures.push('Satellite must not execute target actions');
    if (snapshot.wakeDetectorSetup?.privacy?.rawAudioPersisted !== false) failures.push('Wake setup must not persist raw audio');
    if (snapshot.skillQuarantine?.safety?.approvalRequiredForPromotion !== true) failures.push('Skill promotion approval invariant missing');
    if (JSON.stringify(snapshot).match(/sk-[A-Za-z0-9_-]{12,}|hf_[A-Za-z0-9]{12,}|AIza[0-9A-Za-z_-]{16,}/)) {
      failures.push('snapshot leaked a secret-looking token');
    }
  } catch (error) {
    failures.push(`failed to parse snapshot JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const packageJson = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
for (const marker of ['zavorth:operational-refinement', 'qa:zavorth-operational-refinement']) {
  if (!packageJson.includes(marker)) failures.push(`package script ${marker} missing`);
}

if (failures.length > 0) {
  console.error('[zavorth-operational-refinement-check] failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[zavorth-operational-refinement-check] ok');
