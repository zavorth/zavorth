import { ZavorthOperationalRefinementService } from '../src/services/ZavorthOperationalRefinementService.js';
import { ZavorthMnemosUnifiedMemoryService } from '../src/services/ZavorthMnemosUnifiedMemoryService.js';
import { VoiceWakeDetectorSetupService } from '../src/services/VoiceWakeDetectorSetupService.js';
import { SkillQuarantinePipelineService } from '../src/services/SkillQuarantinePipelineService.js';
import { ZavorthSatelliteApprovalDailyService } from '../src/services/ZavorthSatelliteApprovalDailyService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');

function valueAfter(flag: string): string | null {
  const index = args.indexOf(flag);
  if (index >= 0) return args[index + 1] || null;
  const prefix = `${flag}=`;
  const found = args.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

async function main(): Promise<void> {
  const command = args.find((arg) => !arg.startsWith('--')) || 'snapshot';

  if (command === 'mnemos-unify') {
    const service = new ZavorthMnemosUnifiedMemoryService();
    const snapshot = service.buildSnapshot({ apply: args.includes('--apply') });
    process.stdout.write(json ? `${JSON.stringify(snapshot, null, 2)}\n` : service.renderText(snapshot));
    return;
  }

  if (command === 'wake-setup') {
    const service = new VoiceWakeDetectorSetupService();
    const snapshot = service.buildPlan({
      choice: args.includes('--disabled') ? 'disabled'
        : args.includes('--custom-command') ? 'custom-command'
          : 'default-local',
      command: valueAfter('--command'),
      args: valueAfter('--args'),
      apply: args.includes('--apply'),
    });
    process.stdout.write(json ? `${JSON.stringify(snapshot, null, 2)}\n` : service.renderText(snapshot));
    return;
  }

  if (command === 'skill-quarantine') {
    const service = new SkillQuarantinePipelineService();
    const snapshot = service.buildSnapshot({
      skillId: valueAfter('--skill-id') || 'learned-daily-procedure',
      title: valueAfter('--title') || 'Learned Daily Procedure',
      summary: valueAfter('--summary') || 'A quarantined skill candidate from the learning loop.',
      applyDraft: args.includes('--apply-draft') || args.includes('--apply'),
      promote: args.includes('--promote'),
      approvalId: valueAfter('--approval-id'),
    });
    process.stdout.write(json ? `${JSON.stringify(snapshot, null, 2)}\n` : service.renderText(snapshot));
    return;
  }

  if (command === 'satellite-approvals') {
    const service = new ZavorthSatelliteApprovalDailyService();
    const snapshot = service.buildSnapshot({ applyReceipt: args.includes('--apply-receipt') });
    process.stdout.write(json ? `${JSON.stringify(snapshot, null, 2)}\n` : service.renderText(snapshot));
    return;
  }

  const service = new ZavorthOperationalRefinementService();
  const snapshot = await service.buildSnapshot({
    applyMemory: args.includes('--apply-memory'),
    applyWakeSetup: args.includes('--apply-wake-setup'),
    wakeChoice: args.includes('--wake-disabled') ? 'disabled'
      : args.includes('--wake-custom-command') ? 'custom-command'
        : 'default-local',
    wakeCommand: valueAfter('--wake-command'),
    wakeArgs: valueAfter('--wake-args'),
    applySkillDraft: args.includes('--apply-skill-draft'),
    promoteSkill: args.includes('--promote-skill'),
    approvalId: valueAfter('--approval-id'),
  });
  process.stdout.write(json ? `${JSON.stringify(snapshot, null, 2)}\n` : service.renderText(snapshot));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[zavorth-operational-refinement] failed: ${message}\n`);
  process.exitCode = 1;
});
