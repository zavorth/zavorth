import { SurfaceAgentContractService } from '../../src/services/surface/SurfaceAgentContractService.js';
import { ZAVORTH_SURFACE_AGENT_CONTRACT_VERSION } from '../../src/contracts/surface/SurfaceAgentContract.js';
import type { Task } from '../../src/contracts/TaskContract.js';

describe('SurfaceAgentContractService', () => {
  const envKeys = [
    'ZAVORTH_SURFACE_AGENT_FIRST',
    'ZAVORTH_TELEGRAM_AGENT_FIRST',
    'ZAVORTH_SKILL_ALLOW_FORCE',
    'ZAVORTH_SKILL_OPERATOR_MODE',
  ] as const;
  const prev: Record<string, string | undefined> = {};
  let service: SurfaceAgentContractService;

  beforeEach(() => {
    for (const k of envKeys) {
      prev[k] = process.env[k];
      delete process.env[k];
    }
    service = new SurfaceAgentContractService();
  });

  afterEach(() => {
    for (const k of envKeys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  it('C1: free text passes to agent on every canonical surface by default', () => {
    for (const platform of service.listCanonicalPlatforms()) {
      const routing = service.routeFreeText({
        platform,
        rawText: 'review my project and fix the build',
      });
      expect(routing.kind).toBe('pass_to_agent');
      expect(routing.agentFirstEnabled).toBe(true);
    }
  });

  it('C1: slash stays deterministic on every surface', () => {
    for (const platform of ['telegram', 'desktop', 'cli', 'discord'] as const) {
      const routing = service.routeFreeText({
        platform,
        rawText: '/approve task-1',
        hasParsedSlashCommand: true,
      });
      expect(routing.kind).toBe('deterministic_slash');
    }
  });

  it('C1: global kill switch disables agent-first everywhere', () => {
    process.env.ZAVORTH_SURFACE_AGENT_FIRST = '0';
    for (const platform of ['telegram', 'desktop', 'control', 'cli']) {
      const routing = service.routeFreeText({ platform, rawText: 'hello' });
      expect(routing.agentFirstEnabled).toBe(false);
      expect(routing.kind).toBe('parse_only');
    }
  });

  it('C1: telegram-only kill does not disable desktop/cli', () => {
    process.env.ZAVORTH_TELEGRAM_AGENT_FIRST = '0';
    expect(service.routeFreeText({ platform: 'telegram', rawText: 'hi' }).kind).toBe('parse_only');
    expect(service.routeFreeText({ platform: 'desktop', rawText: 'hi' }).kind).toBe('pass_to_agent');
    expect(service.routeFreeText({ platform: 'cli', rawText: 'hi' }).kind).toBe('pass_to_agent');
  });

  it('C2: high-risk never auto-approves and requires receipt', () => {
    const task = { id: 't1', risk_level: 3, metadata: {} } as Task;
    const gate = service.evaluateHighRisk({ task });
    expect(gate.required).toBe(true);
    expect(gate.canAutoApprove).toBe(false);
    expect(gate.approvalRequired).toBe(true);
    expect(gate.receiptRequired).toBe(true);
  });

  it('C3: apply without consent is blocked on every surface', () => {
    const gate = service.evaluateSkillInstall({ mode: 'apply', consent: false });
    expect(gate.applyAllowed).toBe(false);
    expect(gate.consentRequired).toBe(true);
    expect(gate.blockedReason).toMatch(/consent/i);
  });

  it('C3: force without operator gate is blocked', () => {
    const gate = service.evaluateSkillInstall({
      mode: 'apply',
      consent: true,
      force: true,
    });
    expect(gate.applyAllowed).toBe(false);
    expect(gate.forceAllowed).toBe(false);
  });

  it('C3: force with operator env is allowed with consent', () => {
    process.env.ZAVORTH_SKILL_ALLOW_FORCE = '1';
    const gate = service.evaluateSkillInstall({
      mode: 'apply',
      consent: true,
      force: true,
    });
    expect(gate.applyAllowed).toBe(true);
    expect(gate.forceAllowed).toBe(true);
  });

  it('parity matrix aligns free-text + trust + consent across surfaces', () => {
    const matrix = service.evaluateParityMatrix('list open files and summarize risk');
    expect(matrix.contractVersion).toBe(ZAVORTH_SURFACE_AGENT_CONTRACT_VERSION);
    expect(matrix.allAgentFirstAligned).toBe(true);
    expect(matrix.violations).toEqual([]);
    expect(matrix.platforms.length).toBeGreaterThanOrEqual(5);
    for (const row of matrix.platforms) {
      expect(row.routing.kind).toBe('pass_to_agent');
      expect(row.evaluation.gates.extend.skillInstall.applyAllowed).toBe(false);
      expect(row.evaluation.gates.trust.highRisk.canAutoApprove).toBe(false);
    }
  });

  it('evaluate reports ok for healthy multi-gate snapshot', () => {
    const evaluation = service.evaluate({
      platform: 'desktop',
      routing: { platform: 'desktop', rawText: 'run a safe workspace review' },
      highRisk: { task: { id: 'safe', risk_level: 1 } as Task },
      skillInstall: { mode: 'apply', consent: true },
    });
    expect(evaluation.ok).toBe(true);
    expect(evaluation.violations).toEqual([]);
    expect(evaluation.gates.power.routing.kind).toBe('pass_to_agent');
    expect(evaluation.gates.extend.skillInstall.applyAllowed).toBe(true);
  });
});
