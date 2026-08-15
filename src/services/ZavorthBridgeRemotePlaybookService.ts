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
        manualSteps.push('Unblock the Windows session and confirm that the interactive desktop is accessible.');
        manualSteps.push('Then run `npm run zavorthBridge:remote:doctor` again.');
        retryGuidance = 'Automatic repair should not keep retrying while the session is locked.';
        escalation = 'If this happens repeatedly, review screen blocking policies and the host remote session.';
        break;
      case 'bridge_offline':
        title = 'ZavorthBridge offline';
        urgency = 'high';
        manualSteps.push('Open the ZavorthBridge app and confirm that the companion bridge was loaded.');
        manualSteps.push('Check that the app opened in the correct workspace.');
        retryGuidance = report.repairPolicy.cooldownActive
          ? report.repairPolicy.reason || 'Wait for cooldown before trying a new repair.'
          : 'After the bridge comes back, run `npm run zavorthBridge:remote:doctor -- --repair`.';        escalation = 'If the bridge remains offline with the app open, review the extension and files in `data/agent-bridge/zavorth-bridge`.';
        break;
      case 'sidecar_http_unhealthy':
      case 'sidecar_unready':
        title = 'ZavorthBridge remote server unstable';
        urgency = 'high';
        manualSteps.push('Check that port `4747` is free and that the remote sidecar responds on `/health`.');
        manualSteps.push('If necessary, run `npm run zavorthBridge:remote:doctor -- --repair` again.');
        retryGuidance = report.repairPolicy.cooldownActive
          ? report.repairPolicy.reason || 'Wait for cooldown before retrying.'
          : 'If the problem persists, consider restarting the remote sidecar and reviewing local vendor dependencies.';
        escalation = report.repairPolicy.flappingLikely ? 'There are signs of flapping; investigate sidecar logs and avoid retry loops.'
          : null;
        break;
      case 'remote_mode_inactive':
        title = 'ZavorthBridge remote mode inactive';
        urgency = 'warning';
        manualSteps.push('Enable remote mode and confirm that the local session remains accessible.');
        retryGuidance = report.repairPolicy.cooldownActive
          ? report.repairPolicy.reason || 'Wait for cooldown before insisting.'
          : 'Run `npm run zavorthBridge:remote:doctor -- --repair` or use `--force` if you are knowingly accepting the risk.';
        escalation = report.repairPolicy.flappingLikely ? 'Remote mode is unstable; review power policy and automatic restore.'
          : null;
        break;
      default:
        title = 'ZavorthBridge remote with pending items';
        urgency = 'warning';
        manualSteps.push('Review the diagnostic and apply the remaining recommendations.');
        retryGuidance = 'Then run the doctor again to confirm.';
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
