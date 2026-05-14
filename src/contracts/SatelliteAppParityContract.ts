import type { NodeMeshCapabilityId } from './NodeMeshContract.js';
import type { ZavorthPluginManifest } from './PluginManifestContract.js';

export const ZAVORTH_SATELLITE_APP_PARITY_CONTRACT_VERSION = '2026-05-04.phase-6';

export type SatelliteAppParitySurface =
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

export type SatelliteAppParityStatus =
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

export type SatelliteAppParityEntry = {
  surface: SatelliteAppParitySurface;
  primitiveId: SatelliteAppCapabilityPrimitive;
  nodeCapabilityId: NodeMeshCapabilityId | null;
  status: SatelliteAppParityStatus;
  summary: string;
  targetFiles: {
    contract: string;
    service: string;
    client: string;
    policy: string;
  };
  evidence: SatelliteAppEvidence[];
  simulation: {
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

export type SatelliteAppParitySnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SATELLITE_APP_PARITY_CONTRACT_VERSION;
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
  entries: SatelliteAppParityEntry[];
  gaps: SatelliteAppParityEntry[];
  generatedPluginManifests: ZavorthPluginManifest[];
  nativeWrapperDecision: {
    required: boolean;
    recommendation: 'keep-pwa-first' | 'add-native-wrappers' | 'undecided';
    reason: string;
  };
};
