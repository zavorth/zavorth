import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SourceAgentRuntimeBridgeService } from '../../src/services/SourceAgentRuntimeBridgeService.js';
import { SourceAgentRuntimeToolPolicyService } from '../../src/services/SourceAgentRuntimeToolPolicyService.js';

describe('SourceAgentRuntimeBridgeService Preview engine', () => {
  const now = () => new Date('2026-05-05T14:00:00.000Z');
  let tempRoot: string;
  let sourceRoot: string;
  let zavorthRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-source-agent-runtime-'));
    sourceRoot = path.join(tempRoot, 'source');
    zavorthRoot = path.join(tempRoot, 'zavorth');
    createFixtureSource(sourceRoot);
    createFixtureZavorth(zavorthRoot);
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('classifies Claude tools and blocks write or shell execution until approval', () => {
    const doctor = new SourceAgentRuntimeToolPolicyService({
      now,
    }).buildDoctor({
      mode: 'configured',
      requestedTools: ['Read', 'Write', 'Bash'],
      allowedTools: ['Read', 'Write', 'Bash'],
      approvedToolIds: ['Read'],
      approvalGranted: true,
    });

    expect(doctor.status).toBe('passed');
    expect(doctor.summary).toEqual(
      expect.objectContaining({
        allowed: 1,
        approvalRequired: 2,
        denied: 0,
        dangerousToolsWithoutApproval: 2,
        readOnlyToolsAllowed: 1,
      }),
    );
    expect(doctor.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toolName: 'Read',
          risk: 'safe',
          decision: 'allow',
        }),
        expect.objectContaining({
          toolName: 'Write',
          risk: 'danger',
          decision: 'approval_required',
        }),
        expect.objectContaining({
          toolName: 'Bash',
          risk: 'danger',
          decision: 'approval_required',
        }),
      ]),
    );
  });

  it('denies every tool when the Claude Agent SDK bridge is in disabled tool mode', () => {
    const doctor = new SourceAgentRuntimeToolPolicyService({
      now,
    }).buildDoctor({
      mode: 'disabled',
      requestedTools: ['Read', 'Bash', 'Write'],
    });

    expect(doctor.status).toBe('passed');
    expect(doctor.summary).toEqual(
      expect.objectContaining({
        allowed: 0,
        denied: 3,
        approvalRequired: 0,
      }),
    );
    expect(doctor.decisions.every((decision) => decision.decision === 'deny')).toBe(true);
  });

  it('scans exact Source Claude SDK and ACP package usage', () => {
    const snapshot = new SourceAgentRuntimeBridgeService({
      now,
      sourceRoot,
      zavorthRoot,
    }).buildSnapshot();

    expect(snapshot.status).toBe('passed');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        packagesTracked: 7,
        packagesPresentInSource: 7,
        packagesImplementedInZavorth: 1,
        bridgesReady: 1,
        liveExecutionPerformed: false,
        enabledByDefault: false,
        unsafeDefaultToolExecution: false,
        bypassPermissionsAllowed: false,
      }),
    );
    expect(packageEvidence(snapshot, '@anthropic-ai/sdk')).toEqual(
      expect.objectContaining({
        directness: 'direct',
        usageKind: 'direct-provider-sdk',
        inSourcePackageJson: true,
        inSourceSource: true,
      }),
    );
    expect(packageEvidence(snapshot, '@anthropic-ai/vertex-sdk')).toEqual(
      expect.objectContaining({
        directness: 'direct',
        usageKind: 'direct-vertex-sdk',
      }),
    );
    expect(packageEvidence(snapshot, '@anthropic-ai/claude-agent-sdk')).toEqual(
      expect.objectContaining({
        directness: 'indirect',
        usageKind: 'transitive-acp-runtime',
        inSourceLockfile: true,
        inZavorthPackageJson: true,
      }),
    );
    expect(packageEvidence(snapshot, '@anthropic-ai/claude-code')).toEqual(
      expect.objectContaining({
        directness: 'direct',
        usageKind: 'claude-code-cli-backend',
      }),
    );
    expect(packageEvidence(snapshot, '@agentclientprotocol/claude-agent-acp')).toEqual(
      expect.objectContaining({
        directness: 'direct',
        usageKind: 'acp-bridge',
      }),
    );
    expect(packageEvidence(snapshot, 'acpx')).toEqual(
      expect.objectContaining({
        directness: 'direct',
        usageKind: 'acp-bridge',
      }),
    );
    expect(packageEvidence(snapshot, '@zed-industries/codex-acp')).toEqual(
      expect.objectContaining({
        directness: 'direct',
        usageKind: 'acp-bridge',
      }),
    );
  });

  it('emits bridge readiness for Claude Agent SDK and owner-gated CLI/ACPX bridges', () => {
    const service = new SourceAgentRuntimeBridgeService({
      now,
      sourceRoot,
      zavorthRoot,
    });
    const snapshot = service.buildSnapshot();
    const text = service.formatSnapshotText(snapshot);

    expect(bridge(snapshot, 'claude-agent-sdk')).toEqual(
      expect.objectContaining({
        status: 'ready',
        decision: 'implemented',
        enabledByDefault: false,
        liveExecutionPerformed: false,
      }),
    );
    expect(bridge(snapshot, 'claude-code-cli')).toEqual(
      expect.objectContaining({
        status: 'owner_decision_required',
        decision: 'optional-bridge-owner-gated',
        dryRunAvailable: true,
      }),
    );
    expect(bridge(snapshot, 'acpx')).toEqual(
      expect.objectContaining({
        status: 'owner_decision_required',
        decision: 'optional-bridge-owner-gated',
        dryRunAvailable: true,
      }),
    );
    expect(snapshot.adapterGuards).toEqual(
      expect.objectContaining({
        hasClaudeAgentSdkAdapter: true,
        hasCanUseToolGuard: true,
        hasCwdControl: true,
        forbidsBypassPermissions: true,
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        noSourceSourceCopy: true,
        noAnthropicApiImpersonation: true,
        noProviderBypass: true,
        sandboxCwdControlled: true,
        artifactFirstReceipts: true,
      }),
    );
    expect(snapshot.commands.nextAction).toBe('Approval gate - Provider Mesh Expansion Pack');
    expect(text).toContain('Zavorth Source Agent Runtime Bridge - Preview engine');
    expect(text).toContain('Next: Approval gate - Provider Mesh Expansion Pack');
  });
});

type Snapshot = ReturnType<SourceAgentRuntimeBridgeService['buildSnapshot']>;

function packageEvidence(snapshot: Snapshot, packageName: string) {
  const evidence = snapshot.packageEvidence.find((entry) => entry.packageName === packageName);
  if (!evidence) {
    throw new Error(`missing package evidence for ${packageName}`);
  }
  return evidence;
}

function bridge(snapshot: Snapshot, bridgeId: string) {
  const entry = snapshot.bridges.find((candidate) => candidate.bridgeId === bridgeId);
  if (!entry) {
    throw new Error(`missing bridge ${bridgeId}`);
  }
  return entry;
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
      '@anthropic-ai/claude-agent-sdk': '^0.2.128',
    },
  });
  fs.writeFileSync(path.join(root, 'src', 'adapters', 'claude', 'ClaudeAgentSdkRuntimeAdapter.ts'), [
    'export class ClaudeAgentSdkRuntimeAdapter {',
    "  private allowedWorkspaceRoots: string[] = [];",
    "  private isCwdAllowed() { return this.allowedWorkspaceRoots.length >= 0; }",
    "  private resolvePermissionMode(tools: string[]): 'plan' | 'dontAsk' { return tools.length > 0 ? 'dontAsk' : 'plan'; }",
    '  private buildCanUseTool() { return { canUseTool: true, effectiveAllowedTools: [] }; }',
    '}',
  ].join('\n'));
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}
