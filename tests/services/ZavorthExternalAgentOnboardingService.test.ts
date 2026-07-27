import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ZAVORTH_EXTERNAL_AGENT_ONBOARDING_CONTRACT_VERSION,
} from '../../src/contracts/ZavorthExternalAgentOnboardingContract.js';
import { ZavorthExternalAgentOnboardingService } from '../../src/services/ZavorthExternalAgentOnboardingService.js';

describe('ZavorthExternalAgentOnboardingService', () => {
  it('asks for a user hint before any discovery runs', () => {
    const service = createService();
    const snapshot = service.buildSnapshot({ writeSnapshot: false });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: ZAVORTH_EXTERNAL_AGENT_ONBOARDING_CONTRACT_VERSION,
      surface: 'external-agent-onboarding',
      status: 'needs-user-hint',
    }));
    expect(snapshot.policy).toEqual(expect.objectContaining({
      automaticDiscoveryEnabled: false,
      userDeclaredHintsFirst: true,
      discoveryDoesNotRegisterOrUseAgents: true,
    }));
    expect(snapshot.inspection.performed).toBe(false);
    expect(snapshot.candidates).toEqual([]);
    expect(service.renderText(snapshot)).toContain('Quer me dizer se existe algum agente externo');
  });

  it('blocks a declared path until explicit read-only consent exists', () => {
    const fixture = createAgentFixture('blocked-agent');
    const snapshot = createService().buildSnapshot({
      pathHint: fixture,
      consent: false,
      writeSnapshot: false,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.consent.provided).toBe(false);
    expect(snapshot.inspection.performed).toBe(false);
    expect(snapshot.candidates).toHaveLength(0);
    expect(snapshot.safety.noFilesystemScanWithoutConsent).toBe(true);
  });

  it('inspects only the consented exact path and returns candidate-only external agent records', () => {
    const fixture = createAgentFixture('fixture-acp-agent');
    const snapshot = createService().buildSnapshot({
      pathHint: fixture,
      consent: true,
      writeSnapshot: false,
    });

    expect(snapshot.status).toBe('ready-for-review');
    expect(snapshot.inspection.performed).toBe(true);
    expect(snapshot.inspection.inspectedRoots).toContain(fixture);
    expect(snapshot.inspection.filesRead.some((entry) => entry.endsWith('package.json'))).toBe(true);
    expect(snapshot.candidates[0]).toEqual(expect.objectContaining({
      confidence: 'high',
      suggestedAdapter: 'acp',
      registration: expect.objectContaining({
        status: 'candidate-only',
        requiresUserApproval: true,
        liveExecutionEnabled: false,
        dryRunAvailable: true,
      }),
      safety: expect.objectContaining({
        readOnlyInspection: true,
        noProcessStarted: true,
        noNetworkProbe: true,
        noToolExposure: true,
        noDefaultRuntimeBinding: true,
      }),
    }));
    expect(snapshot.candidates[0].protocols).toContain('acp');
    expect(snapshot.candidates[0].gatewayProfileDraft).toEqual(expect.objectContaining({
      adapter: 'acp',
      root: fixture,
      canRegisterAutomatically: true,
    }));
    expect(snapshot.safety.noExternalRuntimeExecution).toBe(true);
  });

  it('supports approximate path onboarding with capped, consented search', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-onboarding-root-'));
    const nested = path.join(root, 'tools', 'my-agent-runtime');
    fs.mkdirSync(path.join(nested, 'agents'), { recursive: true });
    fs.writeFileSync(path.join(nested, 'mcp.json'), '{"name":"fixture-mcp-agent"}\n', 'utf8');

    const snapshot = createService().buildSnapshot({
      approximatePathHint: root,
      consent: true,
      maxDepth: 3,
      writeSnapshot: false,
    });

    expect(snapshot.status).toBe('ready-for-review');
    expect(snapshot.candidates.some((candidate) => candidate.protocols.includes('mcp'))).toBe(true);
    expect(snapshot.policy.consentRequiredForPathSearch).toBe(true);
  });

  it('detects CLI command candidates from PATH without executing the command', () => {
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-onboarding-bin-'));
    const executable = process.platform === 'win32' ? 'claude.cmd' : 'claude';
    fs.writeFileSync(path.join(bin, executable), 'echo fixture\n', 'utf8');
    const snapshot = createService({ envPath: bin }).buildSnapshot({
      commandHint: 'claude',
      consent: true,
      writeSnapshot: false,
    });

    expect(snapshot.status).toBe('ready-for-review');
    expect(snapshot.candidates[0].label).toContain('known CLI');
    expect(snapshot.candidates[0].protocols).toContain('cli');
    expect(snapshot.candidates[0].gatewayProfileDraft).toEqual(expect.objectContaining({
      adapter: 'cli',
      command: 'claude',
      canRegisterAutomatically: true,
    }));
    expect(snapshot.candidates[0].safety.noProcessStarted).toBe(true);
  });

  it('materializes a CLI candidate into an approved gateway profile without invoking it', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-onboarding-project-'));
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-onboarding-bin-'));
    const executable = process.platform === 'win32' ? 'claude.cmd' : 'claude';
    fs.writeFileSync(path.join(bin, executable), 'echo fixture\n', 'utf8');
    const service = createService({ envPath: bin, projectRoot });

    const result = service.materializeGatewayProfile({
      commandHint: 'claude',
      consent: true,
      approveRegistration: true,
      enableLive: true,
      writeSnapshot: false,
      requestedBy: 'test-operator',
    });

    expect(result.status).toBe('registered');
    expect(result.receipt?.execution.adapterInvoked).toBe(false);
    expect(result.receipt?.profile).toEqual(expect.objectContaining({
      adapter: 'cli',
      command: 'claude',
      liveExecutionEnabled: true,
      provenance: expect.objectContaining({ source: 'onboarding-candidate' }),
    }));
  });

  it('records endpoint candidates without probing the network', () => {
    const snapshot = createService().buildSnapshot({
      endpointHint: 'http://127.0.0.1:8765/acp',
      consent: true,
      writeSnapshot: false,
    });

    expect(snapshot.status).toBe('ready-for-review');
    expect(snapshot.candidates[0]).toEqual(expect.objectContaining({
      suggestedAdapter: 'acp',
      safety: expect.objectContaining({
        noNetworkProbe: true,
        noProcessStarted: true,
      }),
    }));
    expect(snapshot.candidates[0].protocols).toEqual(expect.arrayContaining(['acp', 'http']));
  });
});

function createService(options: { envPath-: string; projectRoot-: string } = {}): ZavorthExternalAgentOnboardingService {
  return new ZavorthExternalAgentOnboardingService({
    now: () => new Date('2026-05-17T01:30:00.000Z'),
    projectRoot: options.projectRoot c path.join(os.tmpdir(), 'zavorth-agent-onboarding-project'),
    envPath: options.envPath ?? '',
  });
}

function createAgentFixture(name: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-onboarding-'));
  fs.mkdirSync(path.join(root, 'agent'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    name,
    keywords: ['agent', 'acp'],
    scripts: { acp: 'node agent/server.js' },
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(root, 'agent', 'run_agent.py'), 'print("fixture")\n', 'utf8');
  return root;
}
