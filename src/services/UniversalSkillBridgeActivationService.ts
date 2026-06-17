import {
  ZAVORTH_UNIVERSAL_SKILL_BRIDGE_ACTIVATION_CONTRACT_VERSION,
  type ZavorthUniversalSkillBridgeActivationAction,
  type ZavorthUniversalSkillBridgeActivationSnapshot,
  type ZavorthUniversalSkillBridgeActivationStatus,
  type ZavorthUniversalSkillBridgeActivationSurfaceAction,
} from '../contracts/ZavorthUniversalSkillBridgeActivationContract.js';
import type {
  ZavorthUniversalSkillBridgeRegistryAction,
  ZavorthUniversalSkillBridgeRegistrySnapshot,
} from '../contracts/ZavorthUniversalSkillBridgeRegistryContract.js';
import { UniversalSkillBridgeRegistryService } from './UniversalSkillBridgeRegistryService.js';

type Runtime = {
  now?: () => Date;
  registryService?: Pick<UniversalSkillBridgeRegistryService, 'buildSnapshot' | 'renderReport'>;
};

export type UniversalSkillBridgeActivationCommandInput = {
  args?: string | null;
  channel?: string | null;
  actorId?: string | null;
  persistReceipt?: boolean;
};

type ParsedCommand = {
  action: ZavorthUniversalSkillBridgeActivationAction;
  selectedId: string | null;
  approvalId: string | null;
  intent: string | null;
  help: boolean;
  live: boolean;
  invoke: boolean;
};

export class UniversalSkillBridgeActivationService {
  private readonly now: () => Date;
  private readonly registry: Pick<UniversalSkillBridgeRegistryService, 'buildSnapshot' | 'renderReport'>;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.registry = runtime.registryService || new UniversalSkillBridgeRegistryService();
  }

  public async executeCommand(
    input: UniversalSkillBridgeActivationCommandInput = {},
  ): Promise<ZavorthUniversalSkillBridgeActivationSnapshot> {
    const args = String(input.args || '').trim();
    const channel = normalizeChannel(input.channel);
    const actorId = normalizeNullable(input.actorId);
    const parsed = parseActivationCommand(args);

    if (parsed.help) {
      return this.buildSnapshot({
        args,
        channel,
        actorId,
        parsed,
        registry: null,
      });
    }

    const registry = await this.registry.buildSnapshot({
      selectedId: parsed.selectedId,
      query: parsed.selectedId,
      invoke: parsed.invoke,
      mode: parsed.live ? 'live' : 'dry-run',
      live: parsed.live,
      channel,
      ownerApprovalId: parsed.approvalId,
      intent: parsed.intent,
      persistReceipt: parsed.invoke && input.persistReceipt !== false,
    });

    return this.buildSnapshot({
      args,
      channel,
      actorId,
      parsed,
      registry,
    });
  }

  public renderReport(snapshot: ZavorthUniversalSkillBridgeActivationSnapshot): string {
    return snapshot.report;
  }

  private buildSnapshot(input: {
    args: string;
    channel: string;
    actorId: string | null;
    parsed: ParsedCommand;
    registry: ZavorthUniversalSkillBridgeRegistrySnapshot | null;
  }): ZavorthUniversalSkillBridgeActivationSnapshot {
    const status = resolveStatus(input.parsed, input.registry);
    const registryActions = input.registry?.actions || [];
    const surfaceActions = buildSurfaceActions(input.registry, input.parsed);
    const report = this.formatReport({
      parsed: input.parsed,
      registry: input.registry,
      status,
      channel: input.channel,
      surfaceActions,
    });

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_UNIVERSAL_SKILL_BRIDGE_ACTIVATION_CONTRACT_VERSION,
      args: input.args,
      channel: input.channel,
      actorId: input.actorId,
      action: input.parsed.action,
      status,
      selectedId: input.parsed.selectedId,
      approvalId: input.parsed.approvalId,
      intent: input.parsed.intent,
      report,
      registry: input.registry,
      registryActions,
      surfaceActions,
      policy: {
        activationDoesNotExecuteUpstreamCode: true,
        activationUsesRegistryAndBridgeOnly: true,
        dryRunIsDefault: true,
        liveRequiresOwnerApproval: true,
        untrustedSkillContentRemainsWrapped: true,
        channelFallbacksMustKeepSameCommands: true,
      },
      commands: {
        help: '/skills bridge',
        inspect: '/skills bridge <skill>',
        dryRun: '/skills run <skill>',
        live: '/skills live <skill> --approval-id <approval-id>',
        origin: '/skills origin <skill>',
        check: 'npm run zavorth:universal-skill-bridge-activation:check --silent',
        nextStage: 'Runtime gateway - Trust-Governed Skill Expansion at Scale',
      },
    };
  }

  private formatReport(input: {
    parsed: ParsedCommand;
    registry: ZavorthUniversalSkillBridgeRegistrySnapshot | null;
    status: ZavorthUniversalSkillBridgeActivationStatus;
    channel: string;
    surfaceActions: ZavorthUniversalSkillBridgeActivationSurfaceAction[];
  }): string {
    if (input.parsed.help) {
      return [
        'Universal Skill Bridge Activation',
        '',
        'Safe commands for using general skills in Zavorth:',
        '- /skills bridge shows imported skills that are ready for the bridge.',
        '- /skills bridge <skill> inspects origin, license, risk and actions.',
        '- /skills run <skill> prepares a governed dry-run.',
        '- /skills live <skill> --approval-id <approval-id> prepares live mode with approval.',
        '- /skills origin <skill> reviews provenance before use.',
        '',
        'Guarantee: this layer uses only the registry and bridge, keeps dry-run by default and does not execute upstream code.',
      ].join('\n');
    }

    const registry = input.registry;
    const selected = registry?.selected || null;
    const invocation = registry?.invocation || null;
    const lines = [
      'Universal Skill Bridge Activation',
      '',
      `Action: ${input.parsed.action} | Status: ${input.status} | Channel: ${input.channel}.`,
    ];

    if (!registry) {
      lines.push('Registry unavailable for this command.');
      return lines.join('\n');
    }

    lines.push(registry.narrative.operatorSummary);
    lines.push('Shortcuts: /skills bridge <skill> | /skills run <skill> | /skills live <skill> --approval-id <approval-id>.');

    if (input.parsed.selectedId && !selected) {
      lines.push(`Skill not found: ${input.parsed.selectedId}.`);
    }

    if (selected) {
      lines.push(
        '',
        `Skill: ${selected.skillName}`,
        `Policy status: ${selected.status}.`,
        `Source: ${selected.sourceLabel || selected.sourceId || 'n/a'} | trust: ${selected.sourceTrust || 'n/a'} | license: ${selected.license || 'n/a'}.`,
      );
      if (selected.blockers.length > 0) {
        lines.push(`Blockers: ${selected.blockers.join(' ')}`);
      }
    }

    if (invocation) {
      lines.push(
        '',
        `Bridge: ${invocation.status}.`,
        `Envelope prepared: ${invocation.promptEnvelope ? 'yes' : 'no'}.`,
        `Receipt: ${invocation.receipts?.[0]?.id || 'n/a'}.`,
      );
      if (invocation.summary?.executionPerformed === false) {
        lines.push('Upstream execution: not performed.');
      }
    }

    if (!selected && registry.entries.length > 0) {
      lines.push('', 'Visible skills:');
      for (const entry of registry.entries.slice(0, 8)) {
        lines.push(`- ${entry.skillName}: ${entry.status}`);
      }
    }

    if (input.surfaceActions.length > 0) {
      lines.push('', 'Next actions:');
      for (const action of input.surfaceActions.slice(0, 6)) {
        lines.push(`- ${action.label}: ${action.command}`);
      }
    }

    lines.push('', 'Policy: dry-run by default, live requires approval, and skill content remains untrusted.');
    return lines.join('\n');
  }
}

function parseActivationCommand(args: string): ParsedCommand {
  const tokens = tokenize(args);
  const verb = String(tokens.shift() || '').trim().toLowerCase();
  const result: ParsedCommand = {
    action: 'help',
    selectedId: null,
    approvalId: null,
    intent: null,
    help: false,
    live: false,
    invoke: false,
  };

  if (!verb || verb === 'help' || verb === '?') {
    return { ...result, help: true };
  }

  if (verb === 'bridge' || verb === 'inspect') {
    result.action = 'inspect';
  } else if (verb === 'origin' || verb === 'provenance') {
    result.action = 'origin';
  } else if (verb === 'run' || verb === 'invoke' || verb === 'dry-run' || verb === 'dryrun') {
    result.action = 'dry-run';
    result.invoke = true;
  } else if (verb === 'live' || verb === 'activate') {
    result.action = 'live-prepare';
    result.live = true;
    result.invoke = true;
  } else {
    result.action = 'inspect';
    tokens.unshift(verb);
  }

  const selectedParts: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--live') {
      result.action = 'live-prepare';
      result.live = true;
      result.invoke = true;
      continue;
    }
    if (token === '--dry-run' || token === '--dryrun') {
      result.action = 'dry-run';
      result.live = false;
      result.invoke = true;
      continue;
    }
    if (token === '--approval-id' || token === '--owner-approval-id' || token === 'approval') {
      result.approvalId = normalizeNullable(tokens[index + 1]);
      index += 1;
      continue;
    }
    if (token === '--intent' || token === '--task') {
      result.intent = normalizeNullable(tokens.slice(index + 1).join(' '));
      break;
    }
    selectedParts.push(token);
  }

  result.selectedId = normalizeNullable(selectedParts.join(' '));
  if (!result.selectedId && result.action !== 'inspect') {
    result.action = 'denied';
    result.invoke = false;
    result.live = false;
  }
  return result;
}

function resolveStatus(
  parsed: ParsedCommand,
  registry: ZavorthUniversalSkillBridgeRegistrySnapshot | null,
): ZavorthUniversalSkillBridgeActivationStatus {
  if (parsed.help) {
    return 'help';
  }
  if (parsed.action === 'denied') {
    return 'denied';
  }
  if (parsed.selectedId && !registry?.selected) {
    return 'not-found';
  }
  if (registry?.invocation?.status === 'approval-required') {
    return 'approval-required';
  }
  if (registry?.invocation?.status === 'dry-run') {
    return 'dry-run';
  }
  const selected = registry?.selected || null;
  if (selected && (selected.status === 'blocked' || selected.status === 'local-only')) {
    return 'denied';
  }
  if (selected && parsed.live && selected.liveRequiresApproval) {
    return 'approval-required';
  }
  return 'ready';
}

function buildSurfaceActions(
  registry: ZavorthUniversalSkillBridgeRegistrySnapshot | null,
  parsed: ParsedCommand,
): ZavorthUniversalSkillBridgeActivationSurfaceAction[] {
  const selectedName = registry?.selected?.skillName || parsed.selectedId || null;
  const actions = (registry?.actions || []).map(mapRegistryAction);
  if (!selectedName) {
    return actions;
  }

  const encoded = encodeURIComponent(selectedName);
  return uniqueActions([
    {
      id: `activation-inspect:${selectedName}`,
      label: 'Inspect skill',
      command: `/skills bridge ${selectedName}`,
      callbackData: `/skills bridge ${selectedName}`,
      apiPath: `/api/skills/bridge?id=${encoded}`,
      style: 'secondary',
      requiresApproval: false,
      safeDefault: true,
      reason: 'Inspection does not prepare execution.',
    },
    {
      id: `activation-dry-run:${selectedName}`,
      label: 'Safe dry-run',
      command: `/skills run ${selectedName}`,
      callbackData: `/skills run ${selectedName}`,
      apiPath: `/api/skills/bridge?id=${encoded}&invoke=1`,
      style: 'primary',
      requiresApproval: false,
      safeDefault: true,
      reason: 'Dry-run prepares a governed envelope without upstream execution.',
    },
    {
      id: `activation-live:${selectedName}`,
      label: 'Prepare live',
      command: `/skills live ${selectedName} --approval-id <approval-id>`,
      callbackData: `/skills live ${selectedName} --approval-id <approval-id>`,
      apiPath: `/api/skills/bridge?id=${encoded}&invoke=1&mode=live&approvalId=<approval-id>`,
      style: 'warning',
      requiresApproval: true,
      safeDefault: false,
      reason: 'Live requires explicit owner approval.',
    },
    ...actions,
  ]);
}

function mapRegistryAction(
  action: ZavorthUniversalSkillBridgeRegistryAction,
): ZavorthUniversalSkillBridgeActivationSurfaceAction {
  return {
    id: action.id,
    label: action.label,
    command: action.command,
    callbackData: action.command,
    apiPath: action.apiPath,
    style: action.requiresApproval ? 'warning' : action.kind === 'dry-run' ? 'primary' : 'secondary',
    requiresApproval: action.requiresApproval,
    safeDefault: action.safeDefault,
    reason: action.reason,
  };
}

function tokenize(value: string): string[] {
  const tokens: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) {
    tokens.push(String(match[1] || match[2] || match[3] || '').trim());
  }
  return tokens.filter(Boolean);
}

function normalizeChannel(value: string | null | undefined): string {
  return String(value || 'shared-surface').trim().toLowerCase().replace(/[^a-z0-9_.:-]+/g, '-') || 'shared-surface';
}

function normalizeNullable(value: string | null | undefined): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function uniqueActions(
  actions: ZavorthUniversalSkillBridgeActivationSurfaceAction[],
): ZavorthUniversalSkillBridgeActivationSurfaceAction[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = action.command;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
