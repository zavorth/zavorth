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
        summary: 'Tunel publico supervisionado pulado porque o recurso esta desativado por configuracao.',
        detail: initial.message || null,
        error: null,
        operatorNextStep: 'Ative ZAVORTH_PUBLIC_TUNNEL_ENABLED=true e configure o CLI do tunnel antes de validar publish supervisionado.',
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
        summary: 'Tunel supervisionado nao pode ser validado porque o host script do repo nao existe.',
        detail: initial.hostScriptPath,
        error: `Host script ausente em ${initial.hostScriptPath}.`,
        operatorNextStep: 'Restaure o host script do tunel publico antes de rodar este smoke novamente.',
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
        summary: `Tunel supervisionado ja estava pronto em ${initial.publicUrl}.`,
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
    objective: 'Validar publish supervisionado de um alvo HTTP local.',
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
        'Tunel supervisionado falhou ao tentar publicar o alvo local do smoke.',
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
        summary: 'Tunel supervisionado respondeu, mas nao ficou pronto com URL publica valida.',
        detail: String(action.metadata?.message || action.stdout || '').trim() || null,
        error: action.errorMessage || 'Tunel nao anunciou publicUrl pronta.',
        operatorNextStep: 'Revise o CLI do tunnel, a conectividade externa e a configuracao ZAVORTH_PUBLIC_TUNNEL_*.',
      },
      startedBySmoke,
    };
  }

  if (startedBySmoke && action.rollbackAvailable) {
    const rollback = await input.gateway.rollbackAction({
      actionId: action.actionId,
      requestedBy: 'system-overlord-smoke',
      reason: 'Encerrar o tunel publicado apenas para o smoke do System Overlord.',
    });
    if (rollback.status !== 'completed') {
      return {
        item: {
          capability: 'network.tunnel',
          status: 'failed',
          actionId: action.actionId,
          runtimeTarget: action.decision.runtimeTarget,
          summary: `Tunel supervisionado publicou ${publicUrl}, mas o rollback canonico falhou depois do smoke.`,
          detail: rollback.stderr || rollback.stdout || null,
          error: rollback.errorMessage || 'Rollback do tunnel falhou.',
          operatorNextStep: 'Rode npm run ops:public:tunnel -- --stop para garantir que o publish temporario foi encerrado.',
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
      summary: `Tunel supervisionado publicou ${publicUrl}.`,
      detail: startedBySmoke
        ? 'O smoke iniciou o tunel e encerrou o publish pelo rollback canonico.'
        : 'O runtime ja estava com publish supervisionado pronto.',
      error: null,
      operatorNextStep: null,
    },
    startedBySmoke: false,
  };
}
