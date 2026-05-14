import type { ZavorthBridgeRemoteDoctorReport } from './ZavorthBridgeRemoteDoctorService.js';

export type ZavorthBridgeRemotePlaybook = {
  title: string;
  urgency: 'info' | 'warning' | 'high' | 'critical';
  automaticActions: string[];
  manualSteps: string[];
  retryGuidance: string;
  escalation: string | null;
};

export class ZavorthBridgeRemotePlaybookService {
  public build(report: ZavorthBridgeRemoteDoctorReport): ZavorthBridgeRemotePlaybook {
    const code = report.finalIncidents.primaryCode;
    const automaticActions = this.describeAutomaticActions(report);
    const manualSteps: string[] = [];
    let title = 'Remoto do ZavorthBridge saudavel';
    let urgency: ZavorthBridgeRemotePlaybook['urgency'] = 'info';
    let retryGuidance = 'Nenhuma acao adicional necessaria.';
    let escalation: string | null = null;

    if (report.readyAfter) {
      return { title, urgency, automaticActions, manualSteps, retryGuidance, escalation };
    }

    switch (code) {
      case 'session_blocked':
        title = 'Sessao do Windows bloqueando o remoto';
        urgency = 'critical';
        manualSteps.push('Desbloqueie a sessao do Windows e confirme que o desktop interativo esta acessivel.');
        manualSteps.push('Depois rode novamente `npm run zavorthBridge:remote:doctor`.');
        retryGuidance = 'Nao adianta insistir em reparo automatico enquanto a sessao estiver bloqueada.';
        escalation = 'Se isso acontecer repetidamente, revise politicas de bloqueio de tela e sessao remota do host.';
        break;
      case 'bridge_offline':
        title = 'Bridge do ZavorthBridge offline';
        urgency = 'high';
        manualSteps.push('Abra o app do ZavorthBridge e confirme que a companion bridge foi carregada.');
        manualSteps.push('Confira se o app abriu na workspace correta.');
        retryGuidance = report.repairPolicy.cooldownActive
          ? report.repairPolicy.reason || 'Espere o cooldown antes de tentar novo reparo.'
          : 'Depois da bridge voltar, rode `npm run zavorthBridge:remote:doctor -- --repair`.';
        escalation = 'Se a bridge continuar offline com o app aberto, revise a extensao e os arquivos em `data/agent-bridge/zavorth-bridge`.';
        break;
      case 'sidecar_http_unhealthy':
      case 'sidecar_unready':
        title = 'Servidor remoto do ZavorthBridge instavel';
        urgency = 'high';
        manualSteps.push('Confira se a porta `4747` esta livre e se o sidecar remoto responde em `/health`.');
        manualSteps.push('Se necessario, rode `npm run zavorthBridge:remote:doctor -- --repair` novamente.');
        retryGuidance = report.repairPolicy.cooldownActive
          ? report.repairPolicy.reason || 'Aguarde antes de repetir a tentativa.'
          : 'Se o problema persistir, vale reiniciar o sidecar remoto e revisar dependencias do vendor local.';
        escalation = report.repairPolicy.flappingLikely
          ? 'Ha sinal de flapping; investigue logs do sidecar e evite retry em loop.'
          : null;
        break;
      case 'remote_mode_inactive':
        title = 'Modo remoto do ZavorthBridge inativo';
        urgency = 'warning';
        manualSteps.push('Ative o modo remoto e confirme que a sessao local continua acessivel.');
        retryGuidance = report.repairPolicy.cooldownActive
          ? report.repairPolicy.reason || 'Espere o cooldown antes de insistir.'
          : 'Rode `npm run zavorthBridge:remote:doctor -- --repair` ou use `--force` se estiver assumindo o risco conscientemente.';
        escalation = report.repairPolicy.flappingLikely
          ? 'O modo remoto vem oscilando; revise politica de energia e restauracao automatica.'
          : null;
        break;
      default:
        title = 'Remoto do ZavorthBridge com pendencias';
        urgency = 'warning';
        manualSteps.push('Revise o diagnostico e aplique as recomendacoes restantes.');
        retryGuidance = 'Depois, rode o doctor novamente para confirmar.';
        break;
    }

    return { title, urgency, automaticActions, manualSteps, retryGuidance, escalation };
  }

  private describeAutomaticActions(report: ZavorthBridgeRemoteDoctorReport): string[] {
    const executed = report.actions.map((action) => `${action.key}: ${action.ok ? 'ok' : 'falhou'}`);
    if (executed.length > 0) {
      return executed;
    }

    if (report.repairPolicy.cooldownActive && !report.forceRepair) {
      return ['reparo automatico suprimido por cooldown'];
    }

    if (report.repairRequested) {
      return ['nenhuma acao automatica segura foi executada'];
    }

    return ['modo somente leitura'];
  }
}
