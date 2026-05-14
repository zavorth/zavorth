import type { ZavorthBridgeRemoteNativeStatus } from './ZavorthBridgeRemoteNativeService.js';
import type { ZavorthBridgeRemoteDoctorActionKey } from './ZavorthBridgeRemoteDoctorService.js';

export type ZavorthBridgeRemoteIncidentCode =
  | 'healthy'
  | 'session_blocked'
  | 'bridge_offline'
  | 'sidecar_unready'
  | 'sidecar_http_unhealthy'
  | 'remote_mode_inactive';

export type ZavorthBridgeRemoteIncidentSeverity = 'info' | 'warning' | 'error' | 'critical';

export type ZavorthBridgeRemoteIncidentSummary = {
  primaryCode: ZavorthBridgeRemoteIncidentCode;
  severity: ZavorthBridgeRemoteIncidentSeverity;
  codes: ZavorthBridgeRemoteIncidentCode[];
  autoRepairableActions: ZavorthBridgeRemoteDoctorActionKey[];
};

const INCIDENT_PRIORITY: ZavorthBridgeRemoteIncidentCode[] = [
  'session_blocked',
  'bridge_offline',
  'sidecar_http_unhealthy',
  'sidecar_unready',
  'remote_mode_inactive',
  'healthy',
];

export class ZavorthBridgeRemoteIncidentService {
  public classify(status: ZavorthBridgeRemoteNativeStatus): ZavorthBridgeRemoteIncidentSummary {
    const codes: ZavorthBridgeRemoteIncidentCode[] = [];
    const actions = new Set<ZavorthBridgeRemoteDoctorActionKey>();

    if (status.session.accessible === false) {
      codes.push('session_blocked');
    }
    if (!status.bridge.online) {
      codes.push('bridge_offline');
      if (status.session.accessible !== false) {
        actions.add('launch-zavorth-bridge-app');
      }
    }
    if (!status.sidecarHealth.ok) {
      codes.push('sidecar_http_unhealthy');
      actions.add('start-sidecar');
    }
    if (!status.sidecar?.ready) {
      codes.push('sidecar_unready');
      actions.add('start-sidecar');
    }
    if (status.remoteMode.active === false) {
      codes.push('remote_mode_inactive');
      actions.add('activate-remote-mode');
    }

    if (codes.length === 0) {
      return {
        primaryCode: 'healthy',
        severity: 'info',
        codes: ['healthy'],
        autoRepairableActions: [],
      };
    }

    const sortedCodes = codes
      .slice()
      .sort((left, right) => INCIDENT_PRIORITY.indexOf(left) - INCIDENT_PRIORITY.indexOf(right));
    const primaryCode = sortedCodes[0];

    return {
      primaryCode,
      severity: this.resolveSeverity(primaryCode),
      codes: sortedCodes,
      autoRepairableActions: Array.from(actions),
    };
  }

  private resolveSeverity(code: ZavorthBridgeRemoteIncidentCode): ZavorthBridgeRemoteIncidentSeverity {
    switch (code) {
      case 'session_blocked':
        return 'critical';
      case 'bridge_offline':
      case 'sidecar_http_unhealthy':
        return 'error';
      case 'sidecar_unready':
      case 'remote_mode_inactive':
        return 'warning';
      default:
        return 'info';
    }
  }
}
