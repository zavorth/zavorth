/**
 * Real-user style journeys: same user intent on multiple surfaces.
 * No network. Asserts product contracts C1/C2/C3 end-to-end through core services.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SurfaceAgentContractService } from '../../src/services/surface/SurfaceAgentContractService.js';
import { SkillInstallPipelineService } from '../../src/services/SkillInstallPipelineService.js';
import { HighRiskConfirmationService } from '../../src/services/HighRiskConfirmationService.js';
import {
  shouldPassNaturalTextToAgent,
  isSurfaceAgentFirstEnabled,
} from '../../src/domain/surface/presentation/shared-surface/SurfaceAgentFirstMode.js';
import { preDispatchSharedSurfaceCommand } from '../../src/domain/surface/presentation/shared-surface/SharedSurfaceCommandDispatch.js';
import type { SharedSurfaceCommandPreDispatchContext } from '../../src/domain/surface/presentation/shared-surface/SharedSurfaceCommandDispatch.js';
import type { Task } from '../../src/contracts/TaskContract.js';


function writeLocalSkill(root: string, name: string): string {
  const skillDir = path.join(root, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: user journey skill\nversion: 1.0.0\n---\n# ${name}\nUse read_file.\n`,
    'utf8',
  );
  fs.writeFileSync(
    path.join(skillDir, 'manifest.json'),
    JSON.stringify(
      {
        name,
        version: '1.0.0',
        description: 'user journey skill',
        author: 'user-journey',
        category: 'other',
        tags: ['journey'],
        tools: [{ name: 'read_file', description: 'Read a file' }],
      },
      null,
      2,
    ),
    'utf8',
  );
  return skillDir;
}

function mockPreDispatch(
  platform: string,
  rawText: string,
): SharedSurfaceCommandPreDispatchContext {
  return {
    ctx: {
      platform,
      rawText,
      userId: 'user-real-1',
      chatId: 'chat-1',
      isGroup: false,
      reply: async () => undefined,
    } as SharedSurfaceCommandPreDispatchContext['ctx'],
    rawText,
    parsed: rawText.startsWith('/')
      ? {
          command_type: rawText.split(/\s+/)[0],
          command_args: rawText.split(/\s+/).slice(1).join(' '),
          normalized_message: rawText.toLowerCase(),
          explicit_executor: null,
          references_last_task: false,
        }
      : null,
    parse: (t: string) => ({
      command_type: t.startsWith('/') ? t.split(' ')[0] : '/task',
      command_args: t.startsWith('/') ? t.split(' ').slice(1).join(' ') : t,
      normalized_message: t.toLowerCase(),
      explicit_executor: null,
      references_last_task: false,
    }),
    discordSurfacePolicyService: {
      canUseOperationalCommand: () => true,
      formatOperationalCommandDenied: () => 'denied',
      isOperationalCommand: () => false,
    },
  };
}

describe('User-real multi-surface journeys', () => {
  const envKeys = ['ZAVORTH_SURFACE_AGENT_FIRST', 'ZAVORTH_TELEGRAM_AGENT_FIRST'] as const;
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

  it('Journey A — power: same free-text request routes to agent on all surfaces', async () => {
    const userText = 'analyze my repo and list the top risks';
    const surfaces = ['telegram', 'desktop', 'control', 'cli', 'discord', 'web', 'api'];
    const contract = new SurfaceAgentContractService();

    for (const platform of surfaces) {
      expect(isSurfaceAgentFirstEnabled(platform)).toBe(true);
      expect(shouldPassNaturalTextToAgent({ platform, rawText: userText })).toBe(true);

      const routing = contract.routeFreeText({ platform, rawText: userText });
      expect(routing.kind).toBe('pass_to_agent');

      // Shared-surface pre-dispatch (used by channel gateways)
      const pre = await preDispatchSharedSurfaceCommand(mockPreDispatch(platform, userText));
      expect(pre.kind).toBe('pass_to_agent');
    }
  });

  it('Journey B — trust: high-risk action needs approval on every surface', () => {
    const highRisk = new HighRiskConfirmationService();
    const contract = new SurfaceAgentContractService({ highRisk });
    const task = {
      id: 'delete-prod-db',
      risk_level: 5,
      metadata: { requiresHighRiskPin: true },
    } as Task;

    for (const platform of ['telegram', 'desktop', 'control', 'cli']) {
      const gate = highRisk.assertApprovalGate({ task, approvalGranted: false });
      expect(gate.ok).toBe(false);

      const evaled = contract.evaluate({
        platform,
        routing: { platform, rawText: 'delete production database' },
        highRisk: { task },
      });
      expect(evaled.gates.trust.highRisk.required).toBe(true);
      expect(evaled.gates.trust.highRisk.approvalRequired).toBe(true);
      expect(evaled.gates.trust.highRisk.canAutoApprove).toBe(false);
      expect(evaled.gates.power.routing.kind).toBe('pass_to_agent');
    }
  });

  it('Journey C — extend: preview → consent → install → ready (surface-agnostic pipeline)', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-user-journey-'));
    try {
      const source = writeLocalSkill(tmp, 'journey-skill');
      const projectRoot = path.join(tmp, 'project');
      fs.mkdirSync(path.join(projectRoot, 'skills'), { recursive: true });

      const pipeline = new SkillInstallPipelineService({
        projectRoot,
        skillsDir: path.join(projectRoot, 'skills'),
        receiptsDir: path.join(projectRoot, 'data', 'runtime', 'skill-install-receipts'),
      });
      const contract = new SurfaceAgentContractService();

      // User opens install from Desktop / CLI / Telegram / Control — same contract + pipeline
      for (const platform of ['desktop', 'cli', 'telegram', 'control']) {
        const previewGate = contract.evaluateSkillInstall({ mode: 'preview' });
        expect(previewGate.previewAllowed).toBe(true);

        const plan = pipeline.preview({ source });
        expect(plan.previewOnly).toBe(true);

        const withoutConsent = contract.evaluateSkillInstall({ mode: 'apply', consent: false });
        expect(withoutConsent.applyAllowed).toBe(false);
        expect(platform).toBeTruthy();
      }

      const allowed = contract.evaluateSkillInstall({ mode: 'apply', consent: true });
      expect(allowed.applyAllowed).toBe(true);

      const prev = path.resolve(__dirname, '../../');
      process.chdir(projectRoot);
      try {
        const receipt = await pipeline.apply({ source, consent: true });
        expect(['applied', 'partial']).toContain(receipt.status);
        expect(receipt.materialized).toBe(true);
        expect(receipt.approvalGranted).toBe(true);
        expect(fs.existsSync(path.join(projectRoot, 'skills', 'journey-skill', 'SKILL.md'))).toBe(
          true,
        );
      } finally {
        process.chdir(prev);
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('Journey D — mixed: slash approve stays deterministic while free text stays agent', async () => {
    const contract = new SurfaceAgentContractService();
    for (const platform of ['telegram', 'desktop', 'cli']) {
      const slash = await preDispatchSharedSurfaceCommand(
        mockPreDispatch(platform, '/approve task-99'),
      );
      expect(slash.kind).not.toBe('pass_to_agent');

      const free = contract.routeFreeText({
        platform,
        rawText: 'please continue the last task carefully',
      });
      expect(free.kind).toBe('pass_to_agent');
    }
  });
});
