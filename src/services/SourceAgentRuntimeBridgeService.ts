import fs from 'node:fs';
import path from 'node:path';
import { AcpxBridgeRuntimeAdapter } from '../adapters/claude/AcpxBridgeRuntimeAdapter.js';
import { ClaudeCodeCliBridgeAdapter } from '../adapters/claude/ClaudeCodeCliBridgeAdapter.js';
import type {
  SourceAgentRuntimeBridgePackSnapshot,
  SourceAgentRuntimeBridgeReadiness,
  SourceAgentRuntimeDirectness,
  SourceAgentRuntimePackageEvidence,
  SourceAgentRuntimePackageName,
  SourceAgentRuntimeUsageKind,
} from '../contracts/SourceAgentRuntimeBridgeContract.js';
import {
  SOURCE_AGENT_RUNTIME_PACKAGES,
  ZAVORTH_SOURCE_AGENT_RUNTIME_BRIDGE_CONTRACT_VERSION,
} from '../contracts/SourceAgentRuntimeBridgeContract.js';
import { SourceAgentRuntimeToolPolicyService } from './SourceAgentRuntimeToolPolicyService.js';
import { resolveZavorthSourceRoot } from './ZavorthSourceRootResolver.js';
import { logger } from '../logger.js';

type Runtime = {
  now?: () => Date;
  sourceRoot?: string;
  zavorthRoot?: string;
  policyService?: SourceAgentRuntimeToolPolicyService;
  claudeCodeBridge?: ClaudeCodeCliBridgeAdapter;
  acpxBridge?: AcpxBridgeRuntimeAdapter;
};

type PackageJsonShape = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

type Reference = {
  relativePath: string;
  kind: 'package-json' | 'lockfile' | 'source';
};

const GENERATED_OR_VENDOR_ROOTS = new Set([
  '.git',
  '.next',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'target',
  'tmp',
]);

const LOCKFILE_NAMES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
]);

const SOURCE_EXTENSIONS = new Set([
  '.cjs',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
]);

export class SourceAgentRuntimeBridgeService {
  private readonly now: () => Date;
  private readonly sourceRoot?: string;
  private readonly zavorthRoot?: string;
  private readonly policyService: SourceAgentRuntimeToolPolicyService;
  private readonly claudeCodeBridge: ClaudeCodeCliBridgeAdapter;
  private readonly acpxBridge: AcpxBridgeRuntimeAdapter;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.sourceRoot = runtime.sourceRoot;
    this.zavorthRoot = runtime.zavorthRoot;
    this.policyService = runtime.policyService || new SourceAgentRuntimeToolPolicyService({
      now: this.now,
    });
    this.claudeCodeBridge = runtime.claudeCodeBridge || new ClaudeCodeCliBridgeAdapter();
    this.acpxBridge = runtime.acpxBridge || new AcpxBridgeRuntimeAdapter();
  }

  public buildSnapshot(input: {
    sourceRoot?: string | null;
    zavorthRoot?: string | null;
  } = {}): SourceAgentRuntimeBridgePackSnapshot {
    const zavorthRoot = path.resolve(input.zavorthRoot || this.zavorthRoot || process.cwd());
    const sourceRoot = resolveZavorthSourceRoot({
      sourceRoot: input.sourceRoot || this.sourceRoot,
      zavorthRoot,
    });
    const packageEvidence = SOURCE_AGENT_RUNTIME_PACKAGES.map((packageName) =>
      this.buildPackageEvidence({
        packageName,
        sourceRoot,
        zavorthRoot,
      }),
    );
    const adapterGuards = this.buildAdapterGuards(zavorthRoot);
    const toolPolicyDoctor = this.policyService.buildDoctor({
      mode: 'configured',
      requestedTools: ['Read', 'Glob', 'Grep', 'LS', 'Write', 'Edit', 'Bash'],
      allowedTools: ['Read', 'Glob', 'Grep', 'LS', 'Write', 'Edit', 'Bash'],
      approvedToolIds: ['Read', 'Glob', 'Grep', 'LS'],
      approvalGranted: true,
    });
    const bridges = this.buildBridges({
      packageEvidence,
      adapterGuards,
    });
    const packagesPresentInSource = packageEvidence.filter((evidence) =>
      evidence.directness !== 'not-present',
    ).length;
    const packagesImplementedInZavorth = packageEvidence.filter((evidence) =>
      evidence.inZavorthPackageJson,
    ).length;
    const bridgesReady = bridges.filter((bridge) => bridge.status === 'ready').length;
    const bridgesOwnerGated = bridges.filter((bridge) => bridge.requiresOwnerApproval).length;
    const status = this.resolveStatus({
      adapterGuards,
      toolPolicyDoctorStatus: toolPolicyDoctor.status,
      bridges,
    });

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SOURCE_AGENT_RUNTIME_BRIDGE_CONTRACT_VERSION,
      status,
      phase: 2,
      statement: 'Source agent runtimes are absorbed as optional Zavorth-native runtime bridges with policy, cwd control and artifact-first receipts.',
      sourceRoot: normalizePath(sourceRoot),
      zavorthRoot: normalizePath(zavorthRoot),
      packageEvidence,
      bridges,
      adapterGuards,
      toolPolicyDoctor,
      summary: {
        packagesTracked: SOURCE_AGENT_RUNTIME_PACKAGES.length,
        packagesPresentInSource,
        packagesImplementedInZavorth,
        bridgesReady,
        bridgesOwnerGated,
        liveExecutionPerformed: false,
        enabledByDefault: false,
        unsafeDefaultToolExecution: false,
        bypassPermissionsAllowed: false,
      },
      configRoutes: {
        apiKey: 'ANTHROPIC_API_KEY',
        bedrock: 'ZAVORTH_CLAUDE_AGENT_SDK_ROUTE=bedrock',
        vertex: 'ZAVORTH_CLAUDE_AGENT_SDK_ROUTE=vertex',
        foundry: 'ZAVORTH_CLAUDE_AGENT_SDK_ROUTE=foundry',
        localModelRecommendation: 'Provider Mesh via Ollama, LM Studio, vLLM or OpenAI-compatible local providers',
      },
      policy: {
        noSourceSourceCopy: true,
        noAnthropicApiImpersonation: true,
        noProviderBypass: true,
        claudeAgentSdkNeverEnabledByDefault: true,
        claudeCodeCliNeverEnabledByDefault: true,
        acpxNeverEnabledByDefault: true,
        sandboxCwdControlled: true,
        artifactFirstReceipts: true,
      },
      commands: {
        inspect: 'npm run source-agent-runtime-bridge --silent',
        inspectJson: 'npm run source-agent-runtime-bridge:json --silent',
        check: 'npm run source-agent-runtime-bridge:check --silent',
        qa: 'npm run qa:source-agent-runtime-bridge --silent',
        nextStage: 'Approval gate - Provider Mesh Expansion Pack',
      },
    };
  }

  public formatSnapshotText(snapshot = this.buildSnapshot()): string {
    const lines = [
      'Zavorth Source Agent Runtime Bridge - Preview engine',
      `Status: ${snapshot.status}`,
      `Contract: ${snapshot.contractVersion}`,
      `Source runtime packages tracked: ${snapshot.summary.packagesTracked}`,
      `Runtime packages present in Source: ${snapshot.summary.packagesPresentInSource}`,
      `Runtime packages implemented in Zavorth: ${snapshot.summary.packagesImplementedInZavorth}`,
      `Ready bridges: ${snapshot.summary.bridgesReady}`,
      `Owner-gated bridges: ${snapshot.summary.bridgesOwnerGated}`,
      `Live execution performed: ${snapshot.summary.liveExecutionPerformed}`,
      `Enabled by default: ${snapshot.summary.enabledByDefault}`,
      `Bypass permissions allowed: ${snapshot.summary.bypassPermissionsAllowed}`,
    ];

    lines.push('Package evidence:');
    for (const evidence of snapshot.packageEvidence) {
      lines.push(`- ${evidence.packageName}: ${evidence.directness}, ${evidence.usageKind}, files=${evidence.sourceReferenceFiles.length}`);
    }

    lines.push('Bridge readiness:');
    for (const bridge of snapshot.bridges) {
      lines.push(`- ${bridge.bridgeId}: ${bridge.status}, decision=${bridge.decision}, dryRun=${bridge.dryRunAvailable}`);
    }

    lines.push(`Tool policy: allowed=${snapshot.toolPolicyDoctor.summary.allowed}, approvalRequired=${snapshot.toolPolicyDoctor.summary.approvalRequired}, denied=${snapshot.toolPolicyDoctor.summary.denied}`);
    lines.push(`Local models: ${snapshot.configRoutes.localModelRecommendation}`);
    lines.push(`Next: ${snapshot.commands.nextStage}`);
    return lines.join('\n');
  }

  private buildPackageEvidence(input: {
    packageName: SourceAgentRuntimePackageName;
    sourceRoot: string;
    zavorthRoot: string;
  }): SourceAgentRuntimePackageEvidence {
    const sourceReferences = this.findPackageReferences(input.sourceRoot, input.packageName);
    const zavorthReferences = this.findPackageReferences(input.zavorthRoot, input.packageName);
    const inSourcePackageJson = sourceReferences.some((reference) => reference.kind === 'package-json');
    const inSourceLockfile = sourceReferences.some((reference) => reference.kind === 'lockfile');
    const inSourceSource = sourceReferences.some((reference) => reference.kind === 'source');
    const inZavorthPackageJson = zavorthReferences.some((reference) => reference.kind === 'package-json');
    const inZavorthLockfile = zavorthReferences.some((reference) => reference.kind === 'lockfile');
    const directness = resolveDirectness({
      inPackageJson: inSourcePackageJson,
      inSource: inSourceSource,
      inLockfile: inSourceLockfile,
      packageName: input.packageName,
      sourceReferences,
    });
    const usageKind = resolveUsageKind(input.packageName, directness);

    return {
      packageName: input.packageName,
      usageKind,
      directness,
      inSourcePackageJson,
      inSourceLockfile,
      inSourceSource,
      inZavorthPackageJson,
      inZavorthLockfile,
      sourceReferenceFiles: sourceReferences.map((reference) => reference.relativePath),
      zavorthReferenceFiles: zavorthReferences.map((reference) => reference.relativePath),
      notes: notesForPackage(input.packageName, directness, usageKind),
    };
  }

  private buildBridges(input: {
    packageEvidence: SourceAgentRuntimePackageEvidence[];
    adapterGuards: SourceAgentRuntimeBridgePackSnapshot['adapterGuards'];
  }): SourceAgentRuntimeBridgeReadiness[] {
    const hasClaudeAgentSdkPackage = input.packageEvidence.some((evidence) =>
      evidence.packageName === '@anthropic-ai/claude-agent-sdk'
      && evidence.inZavorthPackageJson,
    );
    const claudeAgentSdkReady = hasClaudeAgentSdkPackage
      && input.adapterGuards.hasClaudeAgentSdkAdapter
      && input.adapterGuards.hasCanUseToolGuard
      && input.adapterGuards.hasCwdControl
      && input.adapterGuards.forbidsBypassPermissions;

    return [
      {
        bridgeId: 'claude-agent-sdk',
        status: claudeAgentSdkReady ? 'ready' : 'missing',
        decision: claudeAgentSdkReady ? 'implemented' : 'optional-bridge-owner-gated',
        usageKind: 'claude-agent-sdk-runtime',
        packages: ['@anthropic-ai/claude-agent-sdk'],
        enabledByDefault: false,
        enabledByEnv: process.env.ZAVORTH_CLAUDE_AGENT_SDK_ENABLED === 'true',
        liveExecutionPerformed: false,
        dryRunAvailable: true,
        requiresOwnerApproval: false,
        activationEnvVars: [
          'ZAVORTH_CLAUDE_AGENT_SDK_ENABLED=true',
          'ANTHROPIC_API_KEY',
          'ZAVORTH_CLAUDE_AGENT_SDK_ROUTE',
          'ZAVORTH_CLAUDE_AGENT_SDK_CWD',
          'ZAVORTH_CLAUDE_AGENT_SDK_WORKSPACE_ROOTS',
          'ZAVORTH_CLAUDE_AGENT_SDK_TOOL_POLICY',
          'ZAVORTH_CLAUDE_AGENT_SDK_ALLOWED_TOOLS',
          'ZAVORTH_CLAUDE_AGENT_SDK_REQUIRE_APPROVAL',
        ],
        cwdPolicy: {
          controlledCwdRequired: true,
          workspaceRootsRequired: true,
        },
        toolPolicy: {
          zavorthPolicyRequired: true,
          canUseToolRequired: true,
          approvalRequiredForWritesAndShell: true,
          bypassPermissionsAllowed: false,
        },
        artifactReceipts: {
          required: true,
          kinds: [
            'llm-runtime.route-receipt',
            'claude-agent-sdk.permission-decision',
            'agent-runtime.bridge-certification',
          ],
        },
        reason: claudeAgentSdkReady
          ? 'Claude Agent SDK is implemented as an optional Zavorth LLM runtime provider with cwd control, canUseTool policy and receipts.'
          : 'Claude Agent SDK package or guard implementation is missing.',
      },
      {
        bridgeId: 'anthropic-direct-sdk',
        status: this.packagePresent(input.packageEvidence, '@anthropic-ai/sdk') ? 'disabled' : 'missing',
        decision: 'zavorth-native-provider',
        usageKind: 'direct-provider-sdk',
        packages: ['@anthropic-ai/sdk'],
        enabledByDefault: false,
        enabledByEnv: false,
        liveExecutionPerformed: false,
        dryRunAvailable: true,
        requiresOwnerApproval: false,
        activationEnvVars: ['ANTHROPIC_API_KEY'],
        cwdPolicy: {
          controlledCwdRequired: true,
          workspaceRootsRequired: false,
        },
        toolPolicy: {
          zavorthPolicyRequired: true,
          canUseToolRequired: false,
          approvalRequiredForWritesAndShell: true,
          bypassPermissionsAllowed: false,
        },
        artifactReceipts: {
          required: true,
          kinds: ['provider-mesh.route-receipt', 'llm-runtime.provider-receipt'],
        },
        reason: 'Direct Anthropic SDK usage is not copied; Zavorth routes Anthropic-class calls through native provider/runtime contracts.',
      },
      {
        bridgeId: 'anthropic-vertex-sdk',
        status: this.packagePresent(input.packageEvidence, '@anthropic-ai/vertex-sdk') ? 'disabled' : 'missing',
        decision: 'provider-mesh-only',
        usageKind: 'direct-vertex-sdk',
        packages: ['@anthropic-ai/vertex-sdk'],
        enabledByDefault: false,
        enabledByEnv: false,
        liveExecutionPerformed: false,
        dryRunAvailable: true,
        requiresOwnerApproval: true,
        activationEnvVars: ['ZAVORTH_CLAUDE_AGENT_SDK_ROUTE=vertex'],
        cwdPolicy: {
          controlledCwdRequired: true,
          workspaceRootsRequired: false,
        },
        toolPolicy: {
          zavorthPolicyRequired: true,
          canUseToolRequired: false,
          approvalRequiredForWritesAndShell: true,
          bypassPermissionsAllowed: false,
        },
        artifactReceipts: {
          required: true,
          kinds: ['provider-mesh.vertex-route-receipt'],
        },
        reason: 'Vertex-specific Anthropic access is exposed as a provider route decision, not an Anthropic API impersonation layer.',
      },
      this.claudeCodeBridge.buildReadiness({
        enabledByEnv: process.env.ZAVORTH_CLAUDE_CODE_CLI_BRIDGE_ENABLED === 'true',
        packageEvidence: input.packageEvidence,
      }),
      this.acpxBridge.buildReadiness({
        enabledByEnv: process.env.ZAVORTH_ACPX_BRIDGE_ENABLED === 'true',
        packageEvidence: input.packageEvidence,
      }),
      {
        bridgeId: 'codex-acp',
        status: this.packagePresent(input.packageEvidence, '@zed-industries/codex-acp')
          ? 'owner_decision_required'
          : 'missing',
        decision: 'optional-bridge-owner-gated',
        usageKind: 'acp-bridge',
        packages: ['@zed-industries/codex-acp'],
        enabledByDefault: false,
        enabledByEnv: process.env.ZAVORTH_CODEX_ACP_BRIDGE_ENABLED === 'true',
        liveExecutionPerformed: false,
        dryRunAvailable: true,
        requiresOwnerApproval: true,
        activationEnvVars: [
          'ZAVORTH_CODEX_ACP_BRIDGE_ENABLED=true',
          'ZAVORTH_CODEX_ACP_BRIDGE_ALLOWED_SERVERS',
        ],
        cwdPolicy: {
          controlledCwdRequired: true,
          workspaceRootsRequired: true,
        },
        toolPolicy: {
          zavorthPolicyRequired: true,
          canUseToolRequired: true,
          approvalRequiredForWritesAndShell: true,
          bypassPermissionsAllowed: false,
        },
        artifactReceipts: {
          required: true,
          kinds: ['agent-runtime.codex-acp.plan', 'agent-runtime.codex-acp.receipt'],
        },
        reason: 'Codex ACP is tracked as part of the optional ACP bridge family and remains owner-gated.',
      },
    ];
  }

  private buildAdapterGuards(zavorthRoot: string): SourceAgentRuntimeBridgePackSnapshot['adapterGuards'] {
    const relativePath = 'src/adapters/claude/ClaudeAgentSdkRuntimeAdapter.ts';
    const adapterPath = path.join(zavorthRoot, relativePath);
    const source = readText(adapterPath);

    return {
      adapterPath: normalizePath(relativePath),
      hasClaudeAgentSdkAdapter: Boolean(source),
      hasCanUseToolGuard: source.includes('canUseTool') && source.includes('buildCanUseTool'),
      hasCwdControl: source.includes('allowedWorkspaceRoots') && source.includes('isCwdAllowed'),
      hasPlanMode: source.includes("'plan'"),
      hasDontAskModeOnlyAfterPolicy: source.includes("'dontAsk'") && source.includes('effectiveAllowedTools'),
      forbidsBypassPermissions: !source.includes('bypassPermissions'),
      noSecretSerializationClaim: true,
    };
  }

  private resolveStatus(input: {
    adapterGuards: SourceAgentRuntimeBridgePackSnapshot['adapterGuards'];
    toolPolicyDoctorStatus: 'passed' | 'failed';
    bridges: SourceAgentRuntimeBridgeReadiness[];
  }): 'passed' | 'failed' {
    const claudeAgentSdk = input.bridges.find((bridge) => bridge.bridgeId === 'claude-agent-sdk');
    if (input.toolPolicyDoctorStatus !== 'passed') return 'failed';
    if (!input.adapterGuards.forbidsBypassPermissions) return 'failed';
    if (!input.adapterGuards.hasCanUseToolGuard) return 'failed';
    if (!input.adapterGuards.hasCwdControl) return 'failed';
    if (claudeAgentSdk?.status !== 'ready') return 'failed';
    return 'passed';
  }

  private packagePresent(
    evidence: SourceAgentRuntimePackageEvidence[],
    packageName: SourceAgentRuntimePackageName,
  ): boolean {
    return evidence.some((entry) =>
      entry.packageName === packageName
      && entry.directness !== 'not-present',
    );
  }

  private findPackageReferences(root: string, packageName: SourceAgentRuntimePackageName): Reference[] {
    if (!fs.existsSync(root)) {
      return [];
    }
    const references: Reference[] = [];
    for (const file of collectCandidateFiles(root)) {
      const text = readText(file);
      if (!text.includes(packageName)) {
        continue;
      }
      const relativePath = normalizePath(path.relative(root, file));
      if (path.basename(file) === 'package.json') {
        const packageJson = parseJson(text);
        if (packageJsonHasDependency(packageJson, packageName)) {
          references.push({
            relativePath: `${relativePath}${dependencySections(packageJson, packageName)}`,
            kind: 'package-json',
          });
          continue;
        }
      }
      references.push({
        relativePath,
        kind: LOCKFILE_NAMES.has(path.basename(file)) ? 'lockfile' : 'source',
      });
    }
    return dedupeReferences(references);
  }
}

function resolveDirectness(input: {
  inPackageJson: boolean;
  inSource: boolean;
  inLockfile: boolean;
  packageName: SourceAgentRuntimePackageName;
  sourceReferences: Reference[];
}): SourceAgentRuntimeDirectness {
  if (input.inPackageJson || input.inSource) {
    return 'direct';
  }
  if (!input.inLockfile) {
    return 'not-present';
  }
  if (input.packageName === '@anthropic-ai/claude-agent-sdk') {
    const acpLockPresent = input.sourceReferences.some((reference) =>
      reference.relativePath.includes('pnpm-lock.yaml'),
    );
    return acpLockPresent ? 'indirect' : 'lockfile-only';
  }
  return 'lockfile-only';
}

function resolveUsageKind(
  packageName: SourceAgentRuntimePackageName,
  directness: SourceAgentRuntimeDirectness,
): SourceAgentRuntimeUsageKind {
  if (directness === 'lockfile-only') return 'lockfile-only';
  switch (packageName) {
    case '@anthropic-ai/sdk':
      return 'direct-provider-sdk';
    case '@anthropic-ai/vertex-sdk':
      return 'direct-vertex-sdk';
    case '@anthropic-ai/claude-agent-sdk':
      return directness === 'indirect' ? 'transitive-acp-runtime' : 'claude-agent-sdk-runtime';
    case '@anthropic-ai/claude-code':
      return 'claude-code-cli-backend';
    case '@agentclientprotocol/claude-agent-acp':
    case 'acpx':
    case '@zed-industries/codex-acp':
      return 'acp-bridge';
    default:
      return 'unknown';
  }
}

function notesForPackage(
  packageName: SourceAgentRuntimePackageName,
  directness: SourceAgentRuntimeDirectness,
  usageKind: SourceAgentRuntimeUsageKind,
): string[] {
  if (directness === 'not-present') {
    return ['package not present in scanned Source checkout'];
  }
  if (packageName === '@anthropic-ai/claude-agent-sdk' && directness === 'indirect') {
    return ['Claude Agent SDK appears as a transitive ACP dependency in Source lockfile evidence'];
  }
  if (usageKind === 'claude-code-cli-backend') {
    return ['Claude Code usage is treated as an optional CLI backend bridge, never a default provider bypass'];
  }
  if (usageKind === 'acp-bridge') {
    return ['ACP/ACPX usage is treated as an optional bridge behind owner approval and Zavorth policy'];
  }
  return ['package usage is tracked by Preview engine bridge certification'];
}

function collectCandidateFiles(root: string): string[] {
  const files: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    for (const entry of readDir(current)) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (GENERATED_OR_VENDOR_ROOTS.has(entry.name)) continue;
        stack.push(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (isCandidateFile(entry.name)) {
        files.push(absolutePath);
      }
    }
  }

  return files.sort();
}

function isCandidateFile(fileName: string): boolean {
  if (fileName === 'package.json' || LOCKFILE_NAMES.has(fileName)) {
    return true;
  }
  return SOURCE_EXTENSIONS.has(path.extname(fileName));
}

function packageJsonHasDependency(packageJson: PackageJsonShape | null, packageName: string): boolean {
  if (!packageJson) return false;
  return dependencySectionNames().some((section) =>
    Boolean(packageJson[section]?.[packageName]),
  );
}

function dependencySections(packageJson: PackageJsonShape | null, packageName: string): string {
  if (!packageJson) return '';
  const sections = dependencySectionNames().filter((section) =>
    Boolean(packageJson[section]?.[packageName]),
  );
  return sections.length > 0 ? `#${sections.join(',')}` : '';
}

function dependencySectionNames(): Array<keyof PackageJsonShape> {
  return ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
}

function parseJson(text: string): PackageJsonShape | null {
  try {
    return JSON.parse(text) as PackageJsonShape;
  } catch (error) { logger.warn('[Source Agent Runtime Bridge] JSON parse failed', error); return null; }
}

function dedupeReferences(references: Reference[]): Reference[] {
  const seen = new Map<string, Reference>();
  for (const reference of references) {
    seen.set(`${reference.kind}:${reference.relativePath}`, reference);
  }
  return Array.from(seen.values()).sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );
}

function readDir(absolutePath: string): fs.Dirent[] {
  try {
    return fs.readdirSync(absolutePath, { withFileTypes: true });
  } catch (error) { logger.warn('[Source Agent Runtime Bridge] filesystem operation failed', error); return []; }
}

function readText(absolutePath: string): string {
  try {
    const stat = fs.statSync(absolutePath);
    if (stat.size > 25 * 1024 * 1024) {
      return '';
    }
    return fs.readFileSync(absolutePath, 'utf8');
  } catch (error) { logger.warn('[Source Agent Runtime Bridge] filesystem operation failed', error); return ''; }
}

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/');
}
