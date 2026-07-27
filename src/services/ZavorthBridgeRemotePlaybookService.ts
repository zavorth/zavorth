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
    let title = 'ZavorthBridge remote healthy';
    let urgency: ZavorthBridgeRemotePlaybook['urgency'] = 'info';
    let retryGuidance = 'No additional action needed.';
    let escalation: string | null = null;

    if (report.readyAfter) {
      return { title, urgency, automaticActions, manualSteps, retryGuidance, escalation };
    }

    switch (code) {
      case 'session_blocked':
        title = 'Session on Windows is blocking remote access';
        urgency = 'critical';
        manualSteps.push('Desbloqueie a Windows session e confirme que o desktop interactive is accessible.');
        manualSteps.push('after run again `npm run zavorthBridge:remote:doctor`.');
        retryGuidance = 'Automatic repair should not keep retrying while the session is locked.';
        escalation = 'If this happens repeatedly, review screen blocking policies and the host remote session.';
        break;
      case 'bridge_offline':
        title = 'Bridge do ZavorthBridge offline';
        urgency = 'high';
        manualSteps.push('Open the ZavorthBridge app and confirm that the companion bridge was loaded.');
        manualSteps.push('Confira se o app abriu na workspace correta.');
        retryGuidance = report.repairPolicy.cooldownActive
          ? report.repairPolicy.reason || 'Wait for cooldown before trying a new repair.'
          : 'after da bridge voltar, run `npm run zavorthBridge:remote:doctor -- --repair`.';
        escalation = 'If the bridge remains offline with the app open, review the extension and files in `data/agent-bridge/zavorth-bridge`.';
        break;
      case 'sidecar_http_unhealthy':
      case 'sidecar_unready':
        title = 'server remote do ZavorthBridge instavel';
        urgency = 'high';
        manualSteps.push('Confira se a porta `4747` is livre e se o sidecar remote responde em `/health`.');
        manualSteps.push('If necessary, run `npm run zavorthBridge:remote:doctor -- --repair` again.');
        retryGuidance = report.repairPolicy.cooldownActive
          ? report.repairPolicy.reason || 'Wait for before repetir a tentativa.'
          : 'Se o problema persistir, vale reiniciar o sidecar remote e review dependencies do vendor local.';
        escalation = report.repairPolicy.flappingLikely ? 'Ha sinal de flapping; investigue logs do sidecar e evite retry em loop.'
          : null;
        break;
      case 'remote_mode_inactive':
        title = 'Modo remote do ZavorthBridge inactive';
        urgency = 'warning';
        manualSteps.push('Enable remote mode and confirm that the local session remains accessible.');
        retryGuidance = report.repairPolicy.cooldownActive
          ? report.repairPolicy.reason || 'Espere o cooldown before insistir.'
          : 'Run `npm run zavorthBridge:remote:doctor -- --repair` or use `--force` se estiver assumindo o risk conscientemente.';
        escalation = report.repairPolicy.flappingLikely ? 'Remote mode is unstable; review power policy and automatic restore.'
          : null;
        break;
      default:
        title = 'remote do ZavorthBridge com pending items';
        urgency = 'warning';
        manualSteps.push('Revise o diagnostic e aplique as recommendations restantes.');
        retryGuidance = 'after, run o doctor again para confirmar.';
        break;
    }

    return { title, urgency, automaticActions, manualSteps, retryGuidance, escalation };
  }

  private describeAutomaticActions(report: ZavorthBridgeRemoteDoctorReport): string[] {
    const executed = report.actions.map((action) => `${action.key}: ${action.ok ? 'ok' : 'failed'}`);
    if (executed.length > 0) {
      return executed;
    }

    if (report.repairPolicy.cooldownActive && !report.forceRepair) {
      return ['automatic repair suppressed by cooldown'];
    }

    if (report.repairRequested) {
      return ['no safe automatic action was executed'];
    }

    return ['read-only mode'];
  }
}
