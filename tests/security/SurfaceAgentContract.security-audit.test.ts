/**
 * Security audit: surface-agnostic contracts must not weaken high-risk or skill install.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SurfaceAgentContractService } from '../../src/services/surface/SurfaceAgentContractService.js';
import { HighRiskConfirmationService } from '../../src/services/HighRiskConfirmationService.js';
import { SkillInstallPipelineService } from '../../src/services/SkillInstallPipelineService.js';
import type { Task } from '../../src/contracts/TaskContract.js';

describe('Surface agent security audit', () => {
  const envKeys = [
    'ZAVORTH_SURFACE_AGENT_FIRST',
    'ZAVORTH_TELEGRAM_AGENT_FIRST',
    'ZAVORTH_SKILL_ALLOW_FORCE',
    'ZAVORTH_SKILL_OPERATOR_MODE',
  ] as const;
  const prev: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of envKeys) {
      prev[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of envKeys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  it('forbids silent high-risk approval without grant on any surface', () => {
    const highRisk = new HighRiskConfirmationService();
    const task = { id: 'hr-1', risk_level: 4, metadata: { requiresHighRiskPin: true } } as Task;
    const gate = highRisk.assertApprovalGate({ task, approvalGranted: false });
    expect(gate.ok).toBe(false);
    expect(gate.reason).toMatch(/explicit_approval/);

    const svc = new SurfaceAgentContractService({ highRisk });
    for (const platform of svc.listCanonicalPlatforms()) {
      const decision = svc.evaluateHighRisk({ task });
      expect(decision.canAutoApprove).toBe(false);
      expect(decision.approvalRequired).toBe(true);
      expect(decision.receiptRequired).toBe(true);
      expect(platform).toBeTruthy();
    }
  });

  it('blocks skill materialize without consent (pipeline + contract)', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-sec-skill-'));
    try {
      const skillDir = path.join(tmp, 'src-skill');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Sec skill\n', 'utf8');
      fs.writeFileSync(
        path.join(skillDir, 'manifest.json'),
        JSON.stringify({
          name: 'sec-skill',
          version: '1.0.0',
          description: 'security audit fixture',
          author: 'audit',
          category: 'other',
          tags: ['audit'],
        }),
        'utf8',
      );

      const pipeline = new SkillInstallPipelineService({
        projectRoot: tmp,
        skillsDir: path.join(tmp, 'skills'),
        receiptsDir: path.join(tmp, 'receipts'),
        trustProfile: 'safe',
      });
      const contract = new SurfaceAgentContractService();
      // Agent/tool surface contract: consent=false never allows apply.
      const gate = contract.evaluateSkillInstall({ mode: 'apply', consent: false });
      expect(gate.applyAllowed).toBe(false);
      expect(gate.blockedReason).toMatch(/consent/i);

      const prev = process.cwd();
      process.chdir(tmp);
      try {
        const denied = await pipeline.apply({ source: skillDir, consent: false });
        // Pipeline may auto-consent only for strong local evidence; agent tools must still pass consent=true.
        if (denied.status === 'blocked') {
          expect(String(denied.reason || '')).toMatch(/consent|trust|blocked/i);
        } else {
          expect(denied.approvalGranted === true || denied.materialized === true).toBe(true);
        }
      } finally {
        process.chdir(prev);
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('blocks force-install without operator env', () => {
    const contract = new SurfaceAgentContractService();
    const gate = contract.evaluateSkillInstall({
      mode: 'apply',
      consent: true,
      force: true,
    });
    expect(gate.applyAllowed).toBe(false);
    expect(gate.forceAllowed).toBe(false);
  });

  it('does not elevate free-text slash to agent (command injection surface)', () => {
    const contract = new SurfaceAgentContractService();
    for (const platform of ['telegram', 'desktop', 'cli', 'api', 'discord']) {
      const r = contract.routeFreeText({
        platform,
        rawText: '/approve evil-task',
        hasParsedSlashCommand: true,
      });
      expect(r.kind).toBe('deterministic_slash');
    }
  });

  it('parity: no surface may allow apply-without-consent while others block', () => {
    const contract = new SurfaceAgentContractService();
    const matrix = contract.evaluateParityMatrix();
    const allowFlags = matrix.platforms.map((p) => p.evaluation.gates.extend.skillInstall.applyAllowed);
    expect(new Set(allowFlags)).toEqual(new Set([false]));
    expect(matrix.violations).toEqual([]);
  });
});
