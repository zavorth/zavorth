import type {
  RemoteMeshSandboxCheckSeverity,
  RemoteMeshSandboxCheckStatus,
  RemoteMeshSandboxComponent,
  RemoteMeshSandboxPolicy,
  RemoteMeshSandboxProbe,
  RemoteMeshSandboxReadinessCheck,
  RemoteMeshSandboxReadinessInput,
  RemoteMeshSandboxReadinessReceipt,
  RemoteMeshSandboxReadinessSnapshot,
  RemoteMeshSandboxTarget,
} from '../contracts/RemoteMeshSandboxReadinessContract.js';
import { ZAVORTH_REMOTE_MESH_SANDBOX_R0_CONTRACT_VERSION } from '../contracts/RemoteMeshSandboxReadinessContract.js';

type RemoteMeshSandboxReadinessRuntime = {
  now?: () => Date;
};

const COMPONENT_ORDER: RemoteMeshSandboxComponent[] = [
  'policy-guardrails',
  'tailscale-cli',
  'tailscale-status',
  'tailscale-peer-route',
  'ssh-cli',
  'mcp-config',
  'termux-environment',
  'proot-distro-cli',
  'docker-cli',
  'docker-rootless',
];

const DEFAULT_POLICY: RemoteMeshSandboxPolicy = {
  allowRemoteMutationDuringReadiness: false,
  allowFreeformShell: false,
  allowUnauthenticatedMcp: false,
  allowDockerGroupPrivilege: false,
  requireTailscale: false,
  requireSshClient: false,
  requireTermuxForMobileNode: false,
  requireProotDistroForMobileNode: false,
  requireDockerRootlessWhenDockerAvailable: false,
};

const DEFAULT_TARGET: RemoteMeshSandboxTarget = {
  nodeId: null,
  expectedTailnetName: null,
  expectedPorts: [22],
};

export class RemoteMeshSandboxReadinessService {
  private readonly now: () => Date;

  constructor(runtime: RemoteMeshSandboxReadinessRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: RemoteMeshSandboxReadinessInput = {}): RemoteMeshSandboxReadinessSnapshot {
    const policy = this.mergePolicy(input.policy);
    const target = this.mergeTarget(input.target);
    const probes = input.probes || {};
    const checks = COMPONENT_ORDER.map((component) =>
      this.buildCheck(component, probes[component] || null, policy, target, probes),
    );
    const receipts = checks.map((check) => this.buildReceipt(check));
    const blocked = this.countStatus(checks, 'blocked');
    const warnings = this.countStatus(checks, 'warning');
    const missing = this.countStatus(checks, 'missing');
    const notRequired = this.countStatus(checks, 'not-required');

    return {
      generatedAt: input.generatedAt || this.now().toISOString(),
      contractVersion: ZAVORTH_REMOTE_MESH_SANDBOX_R0_CONTRACT_VERSION,
      phase: 'R0',
      status: blocked > 0 ? 'blocked' : warnings + missing > 0 ? 'attention' : 'ready',
      target,
      summary: {
        checks: checks.length,
        passed: this.countStatus(checks, 'passed'),
        warnings,
        missing,
        blocked,
        notRequired,
        directRouteObserved: probes['tailscale-peer-route']?.directConnection === true,
        relayRouteObserved: probes['tailscale-peer-route']?.relayConnection === true,
        remoteMutationPerformed: false,
        remoteExecutionRequiredToBuildSnapshot: false,
        freeformShellAllowed: false,
        secretValuesSerialized: false,
      },
      checks,
      receipts,
      policy,
      nextActions: this.buildNextActions(checks, target),
      commands: {
        readiness: 'npx tsx scripts/remote-mesh-sandbox-readiness.ts --json',
        readinessNoLiveProbes: 'npx tsx scripts/remote-mesh-sandbox-readiness.ts --json --no-live-probes',
        focusedTests: 'npx jest tests/services/RemoteMeshSandboxReadinessService.test.ts --runInBand',
        nextAction: 'Remote mesh and sandbox contracts',
      },
    };
  }

  private buildCheck(
    component: RemoteMeshSandboxComponent,
    probe: RemoteMeshSandboxProbe | null,
    policy: RemoteMeshSandboxPolicy,
    target: RemoteMeshSandboxTarget,
    probes: Partial<Record<RemoteMeshSandboxComponent, RemoteMeshSandboxProbe>>,
  ): RemoteMeshSandboxReadinessCheck {
    if (component === 'policy-guardrails') {
      return this.buildPolicyCheck(probe, policy, probes);
    }

    if (component === 'tailscale-status' && probes['tailscale-cli']?.observed !== true) {
      return this.check(
        component,
        'not-required',
        'recommended',
        'Tailscale status probe is skipped because the Tailscale CLI was not observed.',
        null,
        ['Install and authenticate Tailscale before remote notebook pairing.'],
        probe,
      );
    }

    if (component === 'tailscale-peer-route' && !target.nodeId) {
      return this.check(
        component,
        'not-required',
        'recommended',
        'No target node was configured for route measurement.',
        null,
        ['Set ZAVORTH_REMOTE_MESH_TARGET or pass --target <tailnet-node> to measure direct versus relay routing.'],
        probe,
      );
    }

    if (component === 'tailscale-peer-route' && probes['tailscale-cli']?.observed !== true) {
      return this.check(
        component,
        'not-required',
        'recommended',
        'Route measurement is skipped because the Tailscale CLI was not observed.',
        null,
        ['Install Tailscale and repeat R0 with a target node configured.'],
        probe,
      );
    }

    if (component === 'docker-rootless' && probes['docker-cli']?.observed !== true) {
      return this.check(
        component,
        'not-required',
        'optional',
        'Docker rootless detection is skipped because Docker CLI was not observed.',
        null,
        ['Install Docker rootless on the notebook before enabling project container orchestration.'],
        probe,
      );
    }

    switch (component) {
      case 'tailscale-cli':
        return this.requiredOrRecommendedCheck({
          component,
          probe,
          required: policy.requireTailscale,
          missingEvidence: 'Tailscale CLI was not observed.',
          missingRemediation: 'Install Tailscale on both mobile and notebook nodes, then authenticate the tailnet.',
        });
      case 'tailscale-status':
        return this.authenticatedCheck({
          component,
          probe,
          missingEvidence: 'Tailscale status could not be read.',
          missingRemediation: 'Run tailscale status locally and confirm the node is logged into the intended tailnet.',
          unauthenticatedEvidence: 'Tailscale exists, but the node is not confirmed as authenticated.',
          unauthenticatedRemediation: 'Run tailscale up or complete the Tailscale login flow before remote control.',
        });
      case 'tailscale-peer-route':
        return this.routeCheck(probe, target);
      case 'ssh-cli':
        return this.requiredOrRecommendedCheck({
          component,
          probe,
          required: policy.requireSshClient,
          missingEvidence: 'SSH client was not observed.',
          missingRemediation: 'Install an SSH client or enable Tailscale SSH before remote notebook actions.',
        });
      case 'mcp-config':
        return this.mcpCheck(probe, policy);
      case 'termux-environment':
        return this.requiredOrRecommendedCheck({
          component,
          probe,
          required: policy.requireTermuxForMobileNode,
          missingEvidence: 'Termux environment was not observed on this node.',
          missingRemediation: 'Run this readiness probe on the mobile node after installing Termux.',
        });
      case 'proot-distro-cli':
        return this.requiredOrRecommendedCheck({
          component,
          probe,
          required: policy.requireProotDistroForMobileNode,
          missingEvidence: 'proot-distro CLI was not observed.',
          missingRemediation: 'Install proot-distro in Termux before enabling ephemeral mobile sandboxes.',
        });
      case 'docker-cli':
        return this.check(
          component,
          probe?.observed ? 'passed' : 'not-required',
          'optional',
          probe?.observed ? probe.evidence : 'Docker CLI was not observed on this node.',
          probe?.command || null,
          ['Use Docker rootless on the notebook for heavier untrusted or semi-trusted code execution.'],
          probe,
        );
      case 'docker-rootless':
        return this.dockerRootlessCheck(probe, policy);
      default:
        return this.check(component, 'missing', 'recommended', 'Unknown readiness component.', null, [], probe);
    }
  }

  private buildPolicyCheck(
    probe: RemoteMeshSandboxProbe | null,
    policy: RemoteMeshSandboxPolicy,
    probes: Partial<Record<RemoteMeshSandboxComponent, RemoteMeshSandboxProbe>>,
  ): RemoteMeshSandboxReadinessCheck {
    const risks: string[] = [];
    const remediation: string[] = [];

    if (policy.allowFreeformShell || probes['mcp-config']?.freeformShellExposed === true) {
      risks.push('Freeform shell exposure would allow prompt-to-shell escalation.');
      remediation.push('Expose declarative tools and command templates instead of shell.run/system.exec.');
    }

    if (policy.allowUnauthenticatedMcp || probes['mcp-config']?.unauthenticatedMcpExposed === true) {
      risks.push('Unauthenticated MCP over the mesh can become a remote execution surface.');
      remediation.push('Require authentication, scoped tokens, and per-tool authorization for MCP HTTP transports.');
    }

    if (policy.allowDockerGroupPrivilege || probes['docker-rootless']?.dockerGroupPrivilegeDetected === true) {
      risks.push('Docker group access grants root-equivalent host control.');
      remediation.push('Prefer Docker rootless or a dedicated user limited to approved wrappers.');
    }

    const status: RemoteMeshSandboxCheckStatus = risks.length > 0 ? 'blocked' : 'passed';

    return this.check(
      'policy-guardrails',
      status,
      'policy',
      status === 'passed'
        ? 'R0 policy blocks remote mutation, freeform shell, unauthenticated MCP, and Docker group privilege by default.'
        : 'R0 policy found unsafe authority paths that must be closed before remote execution.',
      probe?.command || null,
      remediation,
      probe,
      risks,
    );
  }

  private requiredOrRecommendedCheck(input: {
    component: RemoteMeshSandboxComponent;
    probe: RemoteMeshSandboxProbe | null;
    required: boolean;
    missingEvidence: string;
    missingRemediation: string;
  }): RemoteMeshSandboxReadinessCheck {
    if (input.probe?.observed) {
      return this.check(
        input.component,
        'passed',
        input.required ? 'required' : 'recommended',
        input.probe.evidence,
        input.probe.command,
        [],
        input.probe,
      );
    }

    return this.check(
      input.component,
      input.required ? 'missing' : 'warning',
      input.required ? 'required' : 'recommended',
      input.missingEvidence,
      input.probe?.command || null,
      [input.missingRemediation],
      input.probe,
    );
  }

  private authenticatedCheck(input: {
    component: RemoteMeshSandboxComponent;
    probe: RemoteMeshSandboxProbe | null;
    missingEvidence: string;
    missingRemediation: string;
    unauthenticatedEvidence: string;
    unauthenticatedRemediation: string;
  }): RemoteMeshSandboxReadinessCheck {
    if (!input.probe?.observed) {
      return this.check(
        input.component,
        'warning',
        'recommended',
        input.missingEvidence,
        input.probe?.command || null,
        [input.missingRemediation],
        input.probe,
      );
    }

    if (input.probe.authenticated === false) {
      return this.check(
        input.component,
        'warning',
        'recommended',
        input.unauthenticatedEvidence,
        input.probe.command,
        [input.unauthenticatedRemediation],
        input.probe,
      );
    }

    return this.check(
      input.component,
      'passed',
      'recommended',
      input.probe.evidence,
      input.probe.command,
      [],
      input.probe,
    );
  }

  private routeCheck(
    probe: RemoteMeshSandboxProbe | null,
    target: RemoteMeshSandboxTarget,
  ): RemoteMeshSandboxReadinessCheck {
    if (!probe?.observed) {
      return this.check(
        'tailscale-peer-route',
        'warning',
        'recommended',
        `No route measurement was observed for target ${target.nodeId || 'unknown'}.`,
        probe?.command || null,
        ['Run the readiness command with --target <tailnet-node> from the mobile node and compare direct versus DERP relay.'],
        probe,
      );
    }

    if (probe.relayConnection === true && probe.directConnection !== true) {
      return this.check(
        'tailscale-peer-route',
        'warning',
        'recommended',
        probe.evidence,
        probe.command,
        ['Investigate NAT traversal, firewall rules, or Tailscale DERP fallback before relying on low-latency streaming.'],
        probe,
        ['Route appears to use relay/DERP; discrete commands may work, but streaming logs or remote visual control can degrade.'],
      );
    }

    return this.check('tailscale-peer-route', 'passed', 'recommended', probe.evidence, probe.command, [], probe);
  }

  private mcpCheck(
    probe: RemoteMeshSandboxProbe | null,
    policy: RemoteMeshSandboxPolicy,
  ): RemoteMeshSandboxReadinessCheck {
    if (probe?.freeformShellExposed || probe?.unauthenticatedMcpExposed) {
      const risks = [
        ...(probe.freeformShellExposed ? ['MCP exposes a freeform shell-like capability.'] : []),
        ...(probe.unauthenticatedMcpExposed ? ['MCP appears to be unauthenticated.'] : []),
      ];
      return this.check(
        'mcp-config',
        'blocked',
        'policy',
        probe.evidence,
        probe.command,
        [
          'Replace generic shell tools with scoped MCP tools such as notebook.docker.logs or notebook.git.status.',
          'Require authentication and per-tool authorization for MCP HTTP transports.',
        ],
        probe,
        risks,
      );
    }

    if (policy.allowFreeformShell || policy.allowUnauthenticatedMcp) {
      return this.check(
        'mcp-config',
        'blocked',
        'policy',
        'The active policy allows unsafe MCP authority.',
        probe?.command || null,
        ['Disable freeform shell and unauthenticated MCP before enabling notebook control.'],
        probe,
      );
    }

    if (!probe?.observed) {
      return this.check(
        'mcp-config',
        'warning',
        'recommended',
        'No scoped MCP configuration was observed.',
        probe?.command || null,
        ['Define MCP tools as scoped, authenticated, schema-bound actions before using the notebook as a remote executor.'],
        probe,
      );
    }

    return this.check('mcp-config', 'passed', 'recommended', probe.evidence, probe.command, [], probe);
  }

  private dockerRootlessCheck(
    probe: RemoteMeshSandboxProbe | null,
    policy: RemoteMeshSandboxPolicy,
  ): RemoteMeshSandboxReadinessCheck {
    if (probe?.dockerGroupPrivilegeDetected && !policy.allowDockerGroupPrivilege) {
      return this.check(
        'docker-rootless',
        'blocked',
        'policy',
        probe.evidence,
        probe.command,
        ['Remove broad Docker group authority from the Zavorth executor user or switch to Docker rootless.'],
        probe,
        ['Docker group membership is root-equivalent on the host.'],
      );
    }

    if (probe?.rootless === true) {
      return this.check('docker-rootless', 'passed', 'recommended', probe.evidence, probe.command, [], probe);
    }

    if (policy.requireDockerRootlessWhenDockerAvailable) {
      return this.check(
        'docker-rootless',
        'missing',
        'required',
        probe?.evidence || 'Docker rootless mode was not confirmed.',
        probe?.command || null,
        ['Enable Docker rootless or disable remote container execution for this node.'],
        probe,
      );
    }

    return this.check(
      'docker-rootless',
      'warning',
      'recommended',
      probe?.evidence || 'Docker rootless mode was not confirmed.',
      probe?.command || null,
      ['Prefer Docker rootless for notebook execution of heavier code and keep raw Docker access out of LLM-generated commands.'],
      probe,
    );
  }

  private check(
    component: RemoteMeshSandboxComponent,
    status: RemoteMeshSandboxCheckStatus,
    severity: RemoteMeshSandboxCheckSeverity,
    evidence: string,
    command: string | null,
    remediation: string[],
    probe: RemoteMeshSandboxProbe | null,
    risks: string[] = [],
  ): RemoteMeshSandboxReadinessCheck {
    return {
      component,
      status,
      severity,
      evidence,
      command,
      details: probe?.details || [],
      risks: [...(probe?.risks || []), ...risks],
      remediation,
    };
  }

  private buildReceipt(check: RemoteMeshSandboxReadinessCheck): RemoteMeshSandboxReadinessReceipt {
    return {
      id: `remote-mesh-sandbox-r0:${check.component}`,
      component: check.component,
      status: check.status,
      noRemoteMutation: true,
      noFreeformShell: true,
      secretValuesSerialized: false,
    };
  }

  private buildNextActions(
    checks: RemoteMeshSandboxReadinessCheck[],
    target: RemoteMeshSandboxTarget,
  ): string[] {
    const actions = new Set<string>();

    for (const check of checks) {
      check.remediation.forEach((item) => actions.add(item));
    }

    if (!target.nodeId) {
      actions.add('Choose the first remote notebook node and rerun R0 with --target <tailnet-node>.');
    }

    if (actions.size === 0) {
      actions.add('Proceed to R1 by formalizing RemoteNode, RemoteAction, SandboxSession, and audit receipt contracts.');
    }

    return [...actions];
  }

  private mergePolicy(policy: Partial<RemoteMeshSandboxPolicy> = {}): RemoteMeshSandboxPolicy {
    return {
      ...DEFAULT_POLICY,
      ...policy,
      allowRemoteMutationDuringReadiness: false,
    };
  }

  private mergeTarget(target: Partial<RemoteMeshSandboxTarget> = {}): RemoteMeshSandboxTarget {
    return {
      nodeId: target.nodeId ?? DEFAULT_TARGET.nodeId,
      expectedTailnetName: target.expectedTailnetName ?? DEFAULT_TARGET.expectedTailnetName,
      expectedPorts: target.expectedPorts || DEFAULT_TARGET.expectedPorts,
    };
  }

  private countStatus(
    checks: RemoteMeshSandboxReadinessCheck[],
    status: RemoteMeshSandboxCheckStatus,
  ): number {
    return checks.filter((check) => check.status === status).length;
  }
}
