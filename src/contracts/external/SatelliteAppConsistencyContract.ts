import type { NodeMeshCapabilityId } from '../NodeMeshContract.js';
import type { ZavorthPluginManifest } from '../PluginManifestContract.js';

export const ZAVORTH_SATELLITE_APP_CONSISTENCY_CONTRACT_VERSION = '2026-05-04.gate-6';

export type SatelliteAppConsistencySurface =
  | 'pwa-shell'
  | 'transport'
  | 'pairing'
  | 'heartbeat'
  | 'node-invoke'
  | 'camera'
  | 'location'
  | 'notification'
  | 'biometric'
  | 'haptic'
  | 'offline'
  | 'native-wrapper'
  | 'doctor';

export type SatelliteAppConsistencyStatus =
  | 'native'
  | 'backend-ready'
  | 'pwa-shell'
  | 'declared-only'
  | 'template-ready'
  | 'missing'
  | 'decision-required';

export type SatelliteAppCapabilityPrimitive =
  | 'satellite.connect'
  | 'device.invoke'
  | 'camera.capture'
  | 'location.read'
  | 'notifications.send'
  | 'biometric.approve'
  | 'haptic.vibrate'
  | 'offline.queue'
  | 'device.doctor'
  | 'native.wrapper';

export type SatelliteAppEvidence = {
  file: string;
  marker: string;
  present: boolean;
};

export type SatelliteAppConsistencyEntry = {
  surface: SatelliteAppConsistencySurface;
  primitiveId: SatelliteAppCapabilityPrimitive;
  nodeCapabilityId: NodeMeshCapabilityId | null;
  status: SatelliteAppConsistencyStatus;
  summary: string;
  targetFiles: {
    contract: string;
    service: string;
    client: string;
    policy: string;
  };
  evidence: SatelliteAppEvidence[];
  dryRun: {
    dryRun: true;
    request: Record<string, unknown>;
    response: Record<string, unknown>;
    receiptKind: string;
  };
  smokeGate: {
    id: string;
    command: string;
    liveDeviceRequired: false;
    expected: string;
  };
  findings: string[];
};

export type SatelliteAppConsistencySnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SATELLITE_APP_CONSISTENCY_CONTRACT_VERSION;
  summary: {
    surfaces: number;
    native: number;
    backendReady: number;
    pwaShell: number;
    declaredOnly: number;
    templateReady: number;
    missing: number;
    decisionRequired: number;
    generatedPluginManifests: number;
    liveDeviceRequired: false;
    secretValuesSerialized: false;
  };
  entries: SatelliteAppConsistencyEntry[];
  gaps: SatelliteAppConsistencyEntry[];
  generatedPluginManifests: ZavorthPluginManifest[];
  nativeWrapperDecision: {
    required: boolean;
    recommendation: 'keep-pwa-first' | 'add-native-wrappers' | 'undecided';
    reason: string;
  };
};
