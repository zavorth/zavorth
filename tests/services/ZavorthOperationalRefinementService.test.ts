import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ZavorthOperationalRefinementService } from '../../src/services/ZavorthOperationalRefinementService.js';
import { ZavorthMnemosUnifiedMemoryService } from '../../src/services/ZavorthMnemosUnifiedMemoryService.js';
import { VoiceWakeDetectorSetupService } from '../../src/services/VoiceWakeDetectorSetupService.js';
import { SkillQuarantinePipelineService } from '../../src/services/SkillQuarantinePipelineService.js';
import { ZavorthSatelliteApprovalDailyService } from '../../src/services/ZavorthSatelliteApprovalDailyService.js';

function makeRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-operational-refinement-'));
}

describe('Zavorth operational refinement pack', () => {
  it('proves A2UI, Mnemos, Satellite, wake setup and skill quarantine as one snapshot', async () => {
    const snapshot = await new ZavorthOperationalRefinementService().buildSnapshot();

    expect(snapshot.contractVersion).toBe('zavorth-operational-refinement/1');
    expect(snapshot.a2uiCanvas.actionBridgeReady).toBe(true);
    expect(snapshot.a2uiCanvas.security.hostAccess).toBe('blocked');
    expect(snapshot.a2uiCanvas.security.actionDispatch).toBe('transaction-plane');
    expect(snapshot.satelliteApprovals.executionAuthority).toBe(false);
    expect(snapshot.wakeDetectorSetup.privacy.rawAudioPersisted).toBe(false);
    expect(snapshot.skillQuarantine.safety.approvalRequiredForPromotion).toBe(true);
    expect(JSON.stringify(snapshot)).not.toMatch(/sk-[A-Za-z0-9_-]{12,}|hf_[A-Za-z0-9]{12,}|AIza[0-9A-Za-z_-]{16,}/);
  });

  it('unifies Mnemos artifacts without leaking secrets and writes only when apply is set', () => {
    const root = makeRoot();
    fs.mkdirSync(path.join(root, '.zavorth', 'wiki'), { recursive: true });
    fs.writeFileSync(path.join(root, '.zavorth', 'wiki', 'index.json'), JSON.stringify({
      pages: [{ id: 'note', path: '.zavorth/wiki/note.md', title: 'Note', tags: ['test'] }],
    }));
    fs.writeFileSync(path.join(root, '.zavorth', 'wiki', 'note.md'), 'hello token=super-secret-value');
    fs.writeFileSync(path.join(root, '.zavorth', 'sessions.json'), JSON.stringify([{ id: 's1', title: 'session' }]));

    const preview = new ZavorthMnemosUnifiedMemoryService({ projectRoot: root }).buildSnapshot();
    expect(preview.applyPerformed).toBe(false);
    expect(fs.existsSync(preview.outputPath)).toBe(false);

    const applied = new ZavorthMnemosUnifiedMemoryService({ projectRoot: root }).buildSnapshot({ apply: true });
    expect(applied.applyPerformed).toBe(true);
    expect(applied.documentsIndexed).toBeGreaterThanOrEqual(2);
    expect(fs.readFileSync(applied.outputPath, 'utf8')).toContain('[REDACTED_SECRET]');
    expect(fs.readFileSync(applied.outputPath, 'utf8')).not.toContain('super-secret-value');
  });

  it('writes wake detector setup through setup-studio env merge only when applied', () => {
    const root = makeRoot();
    fs.writeFileSync(path.join(root, '.env'), 'EXISTING=value\n');
    const service = new VoiceWakeDetectorSetupService({ projectRoot: root });

    const preview = service.buildPlan({ choice: 'custom-command', command: 'wake-detector', args: '--model tiny' });
    expect(preview.applyPerformed).toBe(false);
    expect(fs.readFileSync(path.join(root, '.env'), 'utf8')).not.toContain('ZAVORTH_WAKE_COMMAND');

    const applied = service.buildPlan({
      choice: 'custom-command',
      command: 'wake-detector',
      args: '--token=abc123 --model tiny',
      apply: true,
    });
    const env = fs.readFileSync(path.join(root, '.env'), 'utf8');
    expect(applied.applyPerformed).toBe(true);
    expect(env).toContain('ZAVORTH_WAKE_COMMAND=wake-detector');
    expect(env).toContain('ZAVORTH_WAKE_ARGS="--token=abc123 --model tiny"');
    expect(applied.envUpdates.find((entry) => entry.key === 'ZAVORTH_WAKE_ARGS')?.redactedValue).toContain('[REDACTED_SECRET]');
  });

  it('keeps learned skills quarantined until an approval id promotes them', () => {
    const root = makeRoot();
    const service = new SkillQuarantinePipelineService({ projectRoot: root });
    const draft = service.buildSnapshot({
      skillId: 'budget-helper',
      title: 'Budget Helper',
      summary: 'Summarize local expenses.',
      applyDraft: true,
    });

    expect(draft.draftWritten).toBe(true);
    expect(draft.promotionPerformed).toBe(false);
    expect(fs.existsSync(path.join(root, '.zavorth', 'skills', 'quarantine', 'budget-helper', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'skill-library', 'native', 'budget-helper', 'SKILL.md'))).toBe(false);

    const promoted = service.buildSnapshot({
      skillId: 'budget-helper',
      title: 'Budget Helper',
      summary: 'Summarize local expenses.',
      promote: true,
      approvalId: 'approval-test',
    });
    expect(promoted.promotionPerformed).toBe(true);
    expect(fs.existsSync(path.join(root, 'skill-library', 'native', 'budget-helper', 'SKILL.md'))).toBe(true);
  });

  it('projects Satellite approval as companion authority, not runtime execution', () => {
    const root = makeRoot();
    const snapshot = new ZavorthSatelliteApprovalDailyService({ projectRoot: root }).buildSnapshot();

    expect(snapshot.route).toBe('/satellite');
    expect(snapshot.approvalCards).toBeGreaterThan(0);
    expect(snapshot.executionAuthority).toBe(false);
    expect(snapshot.pairingPreviewReady).toBe(true);
  });
});
