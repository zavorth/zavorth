import type { SmokeGatewayLike, TunnelServiceLike, ExecuteSmokeAction, SystemOverlordSmokeItem } from './smokeTypes.js';
import { failFromSmokeAction } from './smokeActions.js';

export async function runTunnelSmoke(
  probeUrl: string,
  input: {
    publicTunnelService: TunnelServiceLike;
    gateway: SmokeGatewayLike;
    existsSync: (target: string) => boolean;
    executeSmokeAction: ExecuteSmokeAction;
  },
): Promise<{ item: SystemOverlordSmokeItem; startedBySmoke: boolean }> {
  const initial = input.publicTunnelService.readStatus();
  if (!initial.enabled) {
    return {
      item: {
        capability: 'network.tunnel',
        status: 'skipped',
        actionId: null,
        runtimeTarget: 'host',
        summary: 'Supervised public tunnel skipped because the feature is disabled by configuration.',
        detail: initial.message || null,
        error: null,
        operatorNextStep: 'Enable ZAVORTH_PUBLIC_TUNNEL_ENABLED=true and configure the tunnel CLI before validating supervised publishing.',
      },
      startedBySmoke: false,
    };
  }

  if (!input.existsSync(initial.hostScriptPath)) {
    return {
      item: {
        capability: 'network.tunnel',
        status: 'failed',
        actionId: null,
        runtimeTarget: 'host',
        summary: 'Supervised tunnel cannot be validated because the repo host script does not exist.',
        detail: initial.hostScriptPath,
        error: `Host script missing em ${initial.hostScriptPath}.`,
        operatorNextStep: 'Restore the public tunnel host script before running this smoke again.',
      },
      startedBySmoke: false,
    };
  }

  if (initial.ready && initial.publicUrl) {
    return {
      item: {
        capability: 'network.tunnel',
        status: 'passed',
        actionId: null,
        runtimeTarget: 'host',
        summary: `Supervised tunnel was already ready at ${initial.publicUrl}.`,
        detail: initial.message || null,
        error: null,
        operatorNextStep: null,
      },
      startedBySmoke: false,
    };
  }

  const action = await input.executeSmokeAction({
    capability: 'network.tunnel',
    profile: 'dangerous',
    autonomyLevel: 4,
    approved: true,
    timeoutMs: 30_000,
    objective: 'validate publish supervised de um alvo HTTP local.',
    command: JSON.stringify({
      action: 'start',
      targetUrl: probeUrl,
    }),
  });
  if (action.status !== 'completed') {
    return {
      item: failFromSmokeAction(
        'network.tunnel',
        action,
        'Supervised tunnel failed while trying to publish the local smoke target.',
      ),
      startedBySmoke: false,
    };
  }

  const ready = action.metadata?.ready === true;
  const publicUrl = String(action.metadata?.publicUrl || '').trim() || null;
  const startedBySmoke = action.metadata?.started === true;
  if (!ready || !publicUrl) {
    return {
      item: {
        capability: 'network.tunnel',
        status: 'failed',
        actionId: action.actionId,
        runtimeTarget: action.decision.runtimeTarget,
        summary: 'Supervised tunnel responded, but was not ready with a valid public URL.',
        detail: String(action.metadata?.message || action.stdout || '').trim() || null,
        error: action.errorMessage || 'Tunnel did not announce a ready publicUrl.',
        operatorNextStep: 'Review the tunnel CLI, external connectivity, and ZAVORTH_PUBLIC_TUNNEL_* configuration.',
      },
      startedBySmoke,
    };
  }

  if (startedBySmoke && action.rollbackAvailable) {
    const rollback = await input.gateway.rollbackAction({
      actionId: action.actionId,
      requestedBy: 'system-overlord-smoke',
      reason: 'Close the published tunnel only for this smoke check.',
    });
    if (rollback.status !== 'completed') {
      return {
        item: {
          capability: 'network.tunnel',
          status: 'failed',
          actionId: action.actionId,
          runtimeTarget: action.decision.runtimeTarget,
          summary: `Supervised tunnel published ${publicUrl}, but canonical rollback failed after the smoke check.`,
          detail: rollback.stderr || rollback.stdout || null,
          error: rollback.errorMessage || 'Tunnel rollback failed.',
          operatorNextStep: 'Run npm run ops:public:tunnel -- --stop to ensure the temporary publish was closed.',
        },
        startedBySmoke: true,
      };
    }
  }

  return {
    item: {
      capability: 'network.tunnel',
      status: 'passed',
      actionId: action.actionId,
      runtimeTarget: action.decision.runtimeTarget,
      summary: `Supervised tunnel published ${publicUrl}.`,
      detail: startedBySmoke ? 'The smoke check started the tunnel and closed the publish through canonical rollback.'
        : 'The runtime already had supervised publish ready.',
      error: null,
      operatorNextStep: null,
    },
    startedBySmoke: false,
  };
}
