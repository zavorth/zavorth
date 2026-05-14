import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthSemanticAgentRuntimeCertificationService } from '../../src/services/ZavorthSemanticAgentRuntimeCertificationService.js';

describe('ZavorthSemanticAgentRuntimeCertificationService S2', () => {
  const now = () => new Date('2026-05-05T15:00:00.000Z');
  let tempRoot: string;
  let sourceRoot: string;
  let zavorthRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-semantic-agent-runtime-'));
    sourceRoot = path.join(tempRoot, 'source');
    zavorthRoot = path.join(tempRoot, 'zavorth');
    createFixtureSource(sourceRoot);
    createFixtureZavorth(zavorthRoot);
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('certifies S2 agent runtime semantics without live execution or default enablement', () => {
    const snapshot = new ZavorthSemanticAgentRuntimeCertificationService({
      now,
      sourceRoot,
      zavorthRoot,
    }).buildSnapshot();

    expect(snapshot.status).toBe('passed');
    expect(snapshot.semanticPhase).toBe('S2');
    expect(snapshot.bridgeStatus).toBe('passed');
    expect(snapshot.summary).toEqual(expect.objectContaining({
      semanticClaims: 29,
      gaps: 0,
      packagesClassified: 7,
      bridgesCertified: 6,
      toolPolicyScenariosPassed: 4,
      liveExecutionPerformed: false,
      enabledByDefault: false,
      bypassPermissionsAllowed: false,
      sourceCodeCopied: false,
      secretValuesSerialized: false,
    }));
    expect(snapshot.summary.bridgeStatuses).toEqual(expect.objectContaining({
      'claude-agent-sdk': 'ready',
      'claude-code-cli': 'owner_decision_required',
      acpx: 'owner_decision_required',
      'codex-acp': 'owner_decision_required',
    }));
    expect(snapshot.summary.receiptBackedClaims).toBe(snapshot.summary.semanticClaims);
    expect(snapshot.policy).toEqual(expect.objectContaining({
      toolPolicyRequiredBeforeLiveTools: true,
      writesAndShellRequireExplicitApproval: true,
      canUseToolMustDenyOutsidePolicy: true,
      acpAndCliBridgesOwnerGated: true,
      noAnthropicApiImpersonation: true,
      noProviderBypass: true,
    }));
  });

  it('keeps package and bridge decisions explicit by semantic status', () => {
    const snapshot = new ZavorthSemanticAgentRuntimeCertificationService({
      now,
      sourceRoot,
      zavorthRoot,
    }).buildSnapshot();

    expect(packageClaim(snapshot, '@anthropic-ai/claude-agent-sdk')).toEqual(expect.objectContaining({
      status: 'covered',
      usageKind: 'transitive-acp-runtime',
    }));
    expect(packageClaim(snapshot, '@anthropic-ai/sdk')).toEqual(expect.objectContaining({
      status: 'replaced',
      usageKind: 'direct-provider-sdk',
    }));
    expect(packageClaim(snapshot, '@anthropic-ai/vertex-sdk')).toEqual(expect.objectContaining({
      status: 'replaced',
      usageKind: 'direct-vertex-sdk',
    }));
    expect(packageClaim(snapshot, 'acpx')).toEqual(expect.objectContaining({
      status: 'owner-gated',
      usageKind: 'acp-bridge',
    }));
    expect(bridgeClaim(snapshot, 'claude-code-cli')).toEqual(expect.objectContaining({
      status: 'owner-gated',
    }));
    expect(bridgeClaim(snapshot, 'claude-agent-sdk')).toEqual(expect.objectContaining({
      status: 'covered',
    }));
    expect(snapshot.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'provider-route',
        status: 'rejected',
        expectedBehavior: 'The architecture must reject pretending to be the Anthropic API.',
      }),
      expect.objectContaining({
        kind: 'provider-route',
        status: 'rejected',
        expectedBehavior: 'The architecture must reject provider bypass paths.',
      }),
    ]));
  });

  it('certifies tool policy scenarios for disabled read-only configured and approved-tool modes', () => {
    const snapshot = new ZavorthSemanticAgentRuntimeCertificationService({
      now,
      sourceRoot,
      zavorthRoot,
    }).buildSnapshot();
    const scenarios = Object.fromEntries(snapshot.toolPolicyScenarios.map((scenario) => [scenario.id, scenario]));

    expect(scenarios['disabled-tools']).toEqual(expect.objectContaining({
      status: 'passed',
      doctor: expect.objectContaining({
        summary: expect.objectContaining({
          allowed: 0,
          denied: 3,
        }),
      }),
    }));
    expect(scenarios['read-only-tools']?.doctor.summary.readOnlyToolsAllowed).toBeGreaterThanOrEqual(4);
    expect(scenarios['configured-without-write-approval']?.doctor.summary).toEqual(expect.objectContaining({
      allowed: 0,
      approvalRequired: 2,
    }));
    expect(scenarios['configured-single-write-approval']?.doctor.decisions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        toolName: 'Write',
        decision: 'allow',
      }),
      expect.objectContaining({
        toolName: 'Bash',
        decision: 'approval_required',
      }),
    ]));
    expect(snapshot.claims.filter((claim) => claim.kind === 'tool-policy')).toHaveLength(4);
  });

  it('formats a readable S2 operator summary', () => {
    const service = new ZavorthSemanticAgentRuntimeCertificationService({
      now,
      sourceRoot,
      zavorthRoot,
    });
    const text = service.formatSnapshotText(service.buildSnapshot());

    expect(text).toContain('Zavorth Semantic Agent Runtime Certification - S2');
    expect(text).toContain('Status: passed');
    expect(text).toContain('Next: S3 - Provider Mesh Semantics');
  });
});

type Snapshot = ReturnType<ZavorthSemanticAgentRuntimeCertificationService['buildSnapshot']>;

function packageClaim(snapshot: Snapshot, packageName: string) {
  const claim = snapshot.claims.find((entry) =>
    entry.kind === 'package-usage' && entry.packageName === packageName,
  );
  if (!claim) {
    throw new Error(`missing package claim ${packageName}`);
  }
  return claim;
}

function bridgeClaim(snapshot: Snapshot, bridgeId: string) {
  const claim = snapshot.claims.find((entry) =>
    entry.kind === 'bridge-policy' && entry.bridgeId === bridgeId,
  );
  if (!claim) {
    throw new Error(`missing bridge claim ${bridgeId}`);
  }
  return claim;
}

function createFixtureSource(root: string): void {
  fs.mkdirSync(path.join(root, 'src', 'providers'), { recursive: true });
  fs.mkdirSync(path.join(root, 'extensions', 'anthropic'), { recursive: true });
  fs.mkdirSync(path.join(root, 'extensions', 'acpx'), { recursive: true });
  writeJson(path.join(root, 'package.json'), {
    name: 'source-fixture',
    dependencies: {
      '@anthropic-ai/sdk': '^0.67.0',
      '@anthropic-ai/vertex-sdk': '^0.10.0',
    },
  });
  fs.writeFileSync(path.join(root, 'src', 'providers', 'anthropic.ts'), [
    "import Anthropic from '@anthropic-ai/sdk';",
    "import { AnthropicVertex } from '@anthropic-ai/vertex-sdk';",
    'export const provider = { Anthropic, AnthropicVertex };',
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'extensions', 'anthropic', 'cli-backend.ts'), [
    "import { query } from '@anthropic-ai/claude-code';",
    'export const backend = query;',
  ].join('\n'));
  writeJson(path.join(root, 'extensions', 'acpx', 'package.json'), {
    name: '@source/acpx-extension',
    dependencies: {
      '@agentclientprotocol/claude-agent-acp': '^0.2.0',
      '@zed-industries/codex-acp': '^0.1.0',
      acpx: '^0.3.0',
    },
  });
  fs.writeFileSync(path.join(root, 'extensions', 'acpx', 'index.ts'), [
    "import '@agentclientprotocol/claude-agent-acp';",
    "import 'acpx';",
    "import '@zed-industries/codex-acp';",
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'pnpm-lock.yaml'), [
    'packages:',
    '  "@agentclientprotocol/claude-agent-acp@0.2.0":',
    '    dependencies:',
    '      "@anthropic-ai/claude-agent-sdk": 0.2.121',
  ].join('\n'));
}

function createFixtureZavorth(root: string): void {
  fs.mkdirSync(path.join(root, 'src', 'adapters', 'claude'), { recursive: true });
  writeJson(path.join(root, 'package.json'), {
    name: 'zavorth-fixture',
    dependencies: {
      '@anthropic-ai/claude-agent-sdk': '^0.2.121',
    },
  });
  fs.writeFileSync(path.join(root, 'src', 'adapters', 'claude', 'ClaudeAgentSdkRuntimeAdapter.ts'), [
    'export class ClaudeAgentSdkRuntimeAdapter {',
    '  allowedWorkspaceRoots = [];',
    "  mode = 'plan';",
    "  approvedMode = 'dontAsk';",
    '  resolvePermissionMode(effectiveAllowedTools: string[]) { return effectiveAllowedTools.length > 0 ? this.approvedMode : this.mode; }',
    '  isCwdAllowed() { return true; }',
    '  buildCanUseTool() { return async function canUseTool() { return { behavior: "deny" }; }; }',
    '}',
  ].join('\n'));
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
