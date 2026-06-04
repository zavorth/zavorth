import fs from 'fs';
import path from 'path';
import type {
  SatelliteAppCapabilityPrimitive,
  SatelliteAppEvidence,
  SatelliteAppConsistencyEntry,
  SatelliteAppConsistencySnapshot,
  SatelliteAppConsistencyStatus,
  SatelliteAppConsistencySurface,
} from '../contracts/SatelliteAppConsistencyContract.js';
import { ZAVORTH_SATELLITE_APP_CONSISTENCY_CONTRACT_VERSION } from '../contracts/SatelliteAppConsistencyContract.js';
import type { NodeMeshCapabilityId } from '../contracts/NodeMeshContract.js';
import type { ZavorthPluginManifest, ZavorthPluginPermission } from '../contracts/PluginManifestContract.js';
import { ZAVORTH_PLUGIN_OS_API_VERSION } from '../contracts/PluginManifestContract.js';

type SatelliteAppConsistencyRuntime = {
  now?: () => Date;
  rootDir?: string;
  files?: Partial<Record<SatelliteSourceFileKey, string>>;
};

type SatelliteSourceFileKey = 'indexHtml' | 'manifestJson' | 'satelliteJs' | 'serviceWorker';

type SurfaceSpec = {
  surface: SatelliteAppConsistencySurface;
  primitiveId: SatelliteAppCapabilityPrimitive;
  nodeCapabilityId: NodeMeshCapabilityId | null;
  summary: string;
  targetFiles: SatelliteAppConsistencyEntry['targetFiles'];
  markers: Array<{
    file: SatelliteSourceFileKey;
    marker: string;
  }>;
  nativeWhenAllPresent?: boolean;
  backendReadyWhenAllPresent?: boolean;
  pwaShellWhenAllPresent?: boolean;
  declaredOnlyWhenAnyPresent?: boolean;
  decisionRequired?: boolean;
  templateReady?: boolean;
};

const SOURCE_FILE_NAMES: Record<SatelliteSourceFileKey, string> = {
  indexHtml: 'src/satellite/index.html',
  manifestJson: 'src/satellite/manifest.json',
  satelliteJs: 'src/satellite/satellite.js',
  serviceWorker: 'src/satellite/sw.js',
};

const SPECS: SurfaceSpec[] = [
  {
    surface: 'pwa-shell',
    primitiveId: 'satellite.connect',
    nodeCapabilityId: null,
    summary: 'PWA shell, manifest, service worker, and installable route.',
    targetFiles: baseTargets('src/satellite'),
    markers: [
      { file: 'manifestJson', marker: '"display": "standalone"' },
      { file: 'manifestJson', marker: '"start_url": "/satellite"' },
      { file: 'serviceWorker', marker: 'caches.open' },
      { file: 'serviceWorker', marker: "self.addEventListener('fetch'" },
      { file: 'indexHtml', marker: 'satellite.js' },
    ],
    pwaShellWhenAllPresent: true,
  },
  {
    surface: 'transport',
    primitiveId: 'satellite.connect',
    nodeCapabilityId: null,
    summary: 'WebSocket transport, auth challenge, chat envelope, and streaming response support.',
    targetFiles: baseTargets('src/satellite'),
    markers: [
      { file: 'satelliteJs', marker: 'new WebSocket' },
      { file: 'satelliteJs', marker: '/api/web/satellite/ws' },
      { file: 'satelliteJs', marker: 'auth.challenge' },
      { file: 'satelliteJs', marker: 'auth.response' },
      { file: 'satelliteJs', marker: 'chat.stream_chunk' },
    ],
    nativeWhenAllPresent: true,
  },
  {
    surface: 'pairing',
    primitiveId: 'device.invoke',
    nodeCapabilityId: null,
    summary: 'Node Mesh pairing identity, node id, shared secret, and claim-ready payload shape.',
    targetFiles: {
      contract: 'src/contracts/NodeMeshContract.ts',
      service: 'src/services/NodePairingService.ts',
      client: 'src/satellite/satellite.js',
      policy: 'src/security',
    },
    markers: [
      { file: 'satelliteJs', marker: 'nodeIdInput' },
      { file: 'satelliteJs', marker: 'sharedSecretInput' },
      { file: 'satelliteJs', marker: 'sharedSecret' },
    ],
    backendReadyWhenAllPresent: true,
  },
  {
    surface: 'heartbeat',
    primitiveId: 'device.invoke',
    nodeCapabilityId: null,
    summary: 'Heartbeat sync and completed invocation reporting.',
    targetFiles: {
      contract: 'src/contracts/SatelliteContract.ts',
      service: 'src/services/NodeHeartbeatService.ts',
      client: 'src/satellite/satellite.js',
      policy: 'src/security',
    },
    markers: [
      { file: 'satelliteJs', marker: 'heartbeat.ping' },
      { file: 'satelliteJs', marker: 'heartbeat.pong' },
      { file: 'satelliteJs', marker: 'completedInvocations' },
      { file: 'satelliteJs', marker: 'capabilities' },
    ],
    nativeWhenAllPresent: true,
  },
  {
    surface: 'node-invoke',
    primitiveId: 'device.invoke',
    nodeCapabilityId: null,
    summary: 'Runtime can assign device invocations through Node Mesh heartbeat queue.',
    targetFiles: {
      contract: 'src/contracts/NodeMeshContract.ts',
      service: 'src/services/NodeInvokeService.ts',
      client: 'src/satellite/satellite.js',
      policy: 'src/security',
    },
    markers: [
      { file: 'satelliteJs', marker: 'capability.invoke' },
      { file: 'satelliteJs', marker: 'capability.result' },
      { file: 'satelliteJs', marker: 'completedInvocations' },
    ],
    declaredOnlyWhenAnyPresent: true,
  },
  {
    surface: 'camera',
    primitiveId: 'camera.capture',
    nodeCapabilityId: 'camera.capture',
    summary: 'Browser camera capture via MediaDevices.',
    targetFiles: {
      contract: 'src/contracts/NodeMeshContract.ts',
      service: 'src/services/NodeHostCapabilityService.ts',
      client: 'src/satellite/satellite.js',
      policy: 'src/security',
    },
    markers: [
      { file: 'satelliteJs', marker: 'camera.capture' },
      { file: 'satelliteJs', marker: 'getUserMedia' },
      { file: 'satelliteJs', marker: 'navigator.mediaDevices' },
    ],
    declaredOnlyWhenAnyPresent: true,
  },
  {
    surface: 'location',
    primitiveId: 'location.read',
    nodeCapabilityId: 'location.read',
    summary: 'Browser geolocation read with consent and receipt.',
    targetFiles: {
      contract: 'src/contracts/NodeMeshContract.ts',
      service: 'src/services/NodeHostCapabilityService.ts',
      client: 'src/satellite/satellite.js',
      policy: 'src/security',
    },
    markers: [
      { file: 'satelliteJs', marker: 'location.read' },
      { file: 'satelliteJs', marker: 'navigator.geolocation' },
      { file: 'satelliteJs', marker: 'getCurrentPosition' },
    ],
    declaredOnlyWhenAnyPresent: true,
  },
  {
    surface: 'notification',
    primitiveId: 'notifications.send',
    nodeCapabilityId: 'notifications.send',
    summary: 'Browser notifications through Notification API.',
    targetFiles: {
      contract: 'src/contracts/NodeMeshContract.ts',
      service: 'src/services/NodeHostCapabilityService.ts',
      client: 'src/satellite/satellite.js',
      policy: 'src/security',
    },
    markers: [
      { file: 'satelliteJs', marker: 'notifications.send' },
      { file: 'satelliteJs', marker: 'Notification' },
      { file: 'satelliteJs', marker: 'requestPermission' },
    ],
    declaredOnlyWhenAnyPresent: true,
  },
  {
    surface: 'biometric',
    primitiveId: 'biometric.approve',
    nodeCapabilityId: null,
    summary: 'WebAuthn approval for sensitive device or runtime actions.',
    targetFiles: {
      contract: 'src/contracts/SatelliteAppConsistencyContract.ts',
      service: 'src/services/SatelliteAppConsistencyService.ts',
      client: 'src/satellite/satellite.js',
      policy: 'src/security',
    },
    markers: [
      { file: 'satelliteJs', marker: 'credentials.get' },
      { file: 'satelliteJs', marker: 'PublicKeyCredential' },
      { file: 'satelliteJs', marker: 'webauthn' },
    ],
    backendReadyWhenAllPresent: true,
    templateReady: true,
  },
  {
    surface: 'haptic',
    primitiveId: 'haptic.vibrate',
    nodeCapabilityId: null,
    summary: 'Haptic feedback for run and notification state.',
    targetFiles: {
      contract: 'src/contracts/SatelliteAppConsistencyContract.ts',
      service: 'src/services/SatelliteAppConsistencyService.ts',
      client: 'src/satellite/satellite.js',
      policy: 'src/security',
    },
    markers: [
      { file: 'satelliteJs', marker: 'navigator.vibrate' },
      { file: 'satelliteJs', marker: 'vibrate(' },
    ],
    backendReadyWhenAllPresent: true,
    templateReady: true,
  },
  {
    surface: 'offline',
    primitiveId: 'offline.queue',
    nodeCapabilityId: null,
    summary: 'Offline queue for pending chat/device invocations.',
    targetFiles: {
      contract: 'src/contracts/SatelliteAppConsistencyContract.ts',
      service: 'src/services/SatelliteAppConsistencyService.ts',
      client: 'src/satellite',
      policy: 'src/security',
    },
    markers: [
      { file: 'serviceWorker', marker: 'caches.open' },
      { file: 'satelliteJs', marker: 'offlineQueue' },
      { file: 'satelliteJs', marker: 'navigator.onLine' },
      { file: 'satelliteJs', marker: 'completedInvocations' },
    ],
    declaredOnlyWhenAnyPresent: true,
  },
  {
    surface: 'doctor',
    primitiveId: 'device.doctor',
    nodeCapabilityId: 'device.info',
    summary: 'Device doctor for PWA feature detection and Node Mesh readiness.',
    targetFiles: {
      contract: 'src/contracts/SatelliteAppConsistencyContract.ts',
      service: 'src/services/SatelliteAppConsistencyService.ts',
      client: 'src/satellite/satellite.js',
      policy: 'src/security',
    },
    markers: [
      { file: 'satelliteJs', marker: 'navigator.serviceWorker' },
      { file: 'satelliteJs', marker: 'heartbeatMs' },
      { file: 'satelliteJs', marker: 'localStorage' },
    ],
    backendReadyWhenAllPresent: true,
  },
  {
    surface: 'native-wrapper',
    primitiveId: 'native.wrapper',
    nodeCapabilityId: null,
    summary: 'Native Android/iOS/desktop wrapper decision for app consistency.',
    targetFiles: {
      contract: 'src/contracts/SatelliteAppConsistencyContract.ts',
      service: 'src/services/SatelliteAppConsistencyService.ts',
      client: 'apps/zavorth-satellite',
      policy: 'docs/product-direction.md',
    },
    markers: [
      { file: 'manifestJson', marker: '"display": "standalone"' },
    ],
    backendReadyWhenAllPresent: true,
  },
];

export class SatelliteAppConsistencyService {
  private readonly now: () => Date;
  private readonly files: Record<SatelliteSourceFileKey, string>;

  constructor(runtime: SatelliteAppConsistencyRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.files = {
      indexHtml: this.readSource(runtime, 'indexHtml'),
      manifestJson: this.readSource(runtime, 'manifestJson'),
      satelliteJs: this.readSource(runtime, 'satelliteJs'),
      serviceWorker: this.readSource(runtime, 'serviceWorker'),
    };
  }

  public buildSnapshot(): SatelliteAppConsistencySnapshot {
    const entries = SPECS.map((spec) => this.buildEntry(spec));
    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SATELLITE_APP_CONSISTENCY_CONTRACT_VERSION,
      summary: {
        surfaces: entries.length,
        native: entries.filter((entry) => entry.status === 'native').length,
        backendReady: entries.filter((entry) => entry.status === 'backend-ready').length,
        pwaShell: entries.filter((entry) => entry.status === 'pwa-shell').length,
        declaredOnly: entries.filter((entry) => entry.status === 'declared-only').length,
        templateReady: entries.filter((entry) => entry.status === 'template-ready').length,
        missing: entries.filter((entry) => entry.status === 'missing').length,
        decisionRequired: entries.filter((entry) => entry.status === 'decision-required').length,
        generatedPluginManifests: 1,
        liveDeviceRequired: false,
        secretValuesSerialized: false,
      },
      entries,
      gaps: entries.filter((entry) =>
        ['declared-only', 'template-ready', 'missing', 'decision-required'].includes(entry.status),
      ),
      generatedPluginManifests: [this.buildPluginManifest(entries)],
      nativeWrapperDecision: {
        required: false,
        recommendation: 'keep-pwa-first',
        reason: 'PWA-first is signed for this release path because the installable Satellite shell covers pairing, transport, heartbeat, local device APIs, offline queue, and device doctor without app-store dependency.',
      },
    };
  }

  public buildEntryForSurface(surface: SatelliteAppConsistencySurface): SatelliteAppConsistencyEntry {
    const spec = SPECS.find((item) => item.surface === surface);
    if (!spec) {
      throw new Error(`Unknown Satellite/App surface: ${surface}`);
    }
    return this.buildEntry(spec);
  }

  private buildEntry(spec: SurfaceSpec): SatelliteAppConsistencyEntry {
    const evidence = this.collectEvidence(spec);
    const present = evidence.filter((item) => item.present).length;
    const allPresent = present === evidence.length;
    const status = this.resolveStatus(spec, present, allPresent);
    return {
      surface: spec.surface,
      primitiveId: spec.primitiveId,
      nodeCapabilityId: spec.nodeCapabilityId,
      status,
      summary: spec.summary,
      targetFiles: spec.targetFiles,
      evidence,
      simulation: this.buildSimulation(spec, status),
      smokeGate: {
        id: `satellite-app:${spec.surface}`,
        command: `SatelliteAppConsistencyService.buildEntryForSurface(${JSON.stringify(spec.surface)})`,
        liveDeviceRequired: false,
        expected: 'device/app capability shape can be inspected without a live mobile device',
      },
      findings: this.buildFindings(spec, status, evidence),
    };
  }

  private resolveStatus(spec: SurfaceSpec, present: number, allPresent: boolean): SatelliteAppConsistencyStatus {
    if (spec.decisionRequired) {
      return 'decision-required';
    }
    if (spec.nativeWhenAllPresent && allPresent) {
      return 'native';
    }
    if (spec.backendReadyWhenAllPresent && allPresent) {
      return 'backend-ready';
    }
    if (spec.pwaShellWhenAllPresent && allPresent) {
      return 'pwa-shell';
    }
    if (spec.templateReady && present === 0) {
      return 'template-ready';
    }
    if (spec.declaredOnlyWhenAnyPresent && present > 0) {
      return allPresent ? 'backend-ready' : 'declared-only';
    }
    return present > 0 ? 'declared-only' : 'missing';
  }

  private collectEvidence(spec: SurfaceSpec): SatelliteAppEvidence[] {
    return spec.markers.map((marker) => ({
      file: SOURCE_FILE_NAMES[marker.file],
      marker: marker.marker,
      present: this.files[marker.file].includes(marker.marker),
    }));
  }

  private buildSimulation(
    spec: SurfaceSpec,
    status: SatelliteAppConsistencyStatus,
  ): SatelliteAppConsistencyEntry['simulation'] {
    return {
      dryRun: true,
      request: {
        primitiveId: spec.primitiveId,
        nodeCapabilityId: spec.nodeCapabilityId,
        surface: spec.surface,
        payload: this.samplePayload(spec),
      },
      response: {
        ok: !['missing', 'decision-required'].includes(status),
        status,
        artifactExpected: ['camera', 'location', 'notification', 'biometric', 'haptic', 'offline'].includes(spec.surface),
      },
      receiptKind: `satellite.${spec.surface}.receipt`,
    };
  }

  private samplePayload(spec: SurfaceSpec): Record<string, unknown> {
    switch (spec.surface) {
      case 'camera':
        return { facingMode: 'environment', quality: 'dry-run' };
      case 'location':
        return { accuracy: 'coarse', reason: 'dry-run' };
      case 'notification':
        return { title: 'Zavorth', body: 'Dry notification' };
      case 'biometric':
        return { challengeId: 'dry-webauthn-challenge' };
      case 'haptic':
        return { pattern: [40, 60, 40] };
      case 'offline':
        return { queueId: 'dry-offline-queue' };
      default:
        return { dryRun: true };
    }
  }

  private buildFindings(
    spec: SurfaceSpec,
    status: SatelliteAppConsistencyStatus,
    evidence: SatelliteAppEvidence[],
  ): string[] {
    if (status === 'native' || status === 'backend-ready' || status === 'pwa-shell') {
      return [`${spec.surface} has governed Satellite/App consistency evidence`];
    }
    if (status === 'decision-required') {
      return ['native wrapper remains a product decision; keep PWA-first until browser capability consistency is real'];
    }
    const missing = evidence.filter((item) => !item.present).map((item) => item.marker);
    if (status === 'declared-only') {
      return [`${spec.surface} is declared but missing runtime markers: ${missing.join(', ')}`];
    }
    if (status === 'template-ready') {
      return [`${spec.surface} needs client implementation template before runtime certification`];
    }
    return [`${spec.surface} is missing Satellite/App consistency evidence`];
  }

  private buildPluginManifest(entries: SatelliteAppConsistencyEntry[]): ZavorthPluginManifest {
    const permissions: ZavorthPluginPermission[] = [
      {
        kind: 'node.invoke',
        scope: 'workspace',
        reason: 'Satellite invokes approved Node Mesh capabilities.',
        required: true,
      },
      {
        kind: 'artifact.write',
        scope: 'workspace',
        reason: 'Device outputs can become artifacts or receipts.',
        required: false,
      },
    ];
    return {
      schemaVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
      id: 'zavorth.device.satellite',
      label: 'Zavorth Satellite',
      version: '0.1.0-template',
      moduleKind: 'bridge',
      summary: 'Plugin OS PWA/device companion module for Node Mesh app consistency.',
      description: 'Zavorth-native Satellite module that binds pairing, heartbeat, device invocation, and browser companion capabilities to governed receipts.',
      tags: ['satellite', 'device', 'pwa', 'node-mesh'],
      source: {
        kind: 'generated',
        locator: 'zavorth-normalized://satellite-app-consistency',
        digest: null,
        trusted: false,
      },
      compatibility: {
        zavorthVersion: '>=1.1.0',
        pluginApiVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
      },
      capabilities: entries.map((entry) => ({
        id: entry.primitiveId,
        intent: this.intentFor(entry.primitiveId),
        label: this.labelFor(entry.primitiveId),
        summary: entry.summary,
        artifactKinds: [entry.simulation.receiptKind],
        command: entry.primitiveId === 'satellite.connect'
          ? {
              name: 'satellite',
              aliases: ['device'],
              usage: '<connect|doctor|invoke>',
            }
          : null,
      })),
      permissions,
      entrypoint: {
        module: 'modules/satellite/index.js',
        exportName: 'createZavorthSatelliteModule',
        runtime: 'browser',
      },
      lifecycle: {
        actions: ['install', 'enable', 'disable', 'uninstall', 'invoke', 'doctor', 'upgrade'],
        defaultAction: 'invoke',
      },
      policy: {
        defaultTrust: 'review',
        requiresApproval: true,
        allowNetworkByDefault: false,
        allowFilesystemWriteByDefault: false,
        allowProcessSpawnByDefault: false,
        sandboxProfile: 'restricted',
      },
      artifactKinds: entries.flatMap((entry) => [entry.simulation.receiptKind]),
      receiptKinds: entries.map((entry) => entry.simulation.receiptKind),
    };
  }

  private intentFor(primitiveId: SatelliteAppCapabilityPrimitive): string {
    switch (primitiveId) {
      case 'satellite.connect':
        return 'satellite_management';
      case 'device.invoke':
        return 'device_invocation';
      case 'camera.capture':
        return 'camera_capture';
      case 'location.read':
        return 'location_read';
      case 'notifications.send':
        return 'notification_send';
      case 'biometric.approve':
        return 'biometric_approval';
      case 'haptic.vibrate':
        return 'haptic_feedback';
      case 'offline.queue':
        return 'offline_queue';
      case 'device.doctor':
        return 'device_doctor';
      case 'native.wrapper':
        return 'native_wrapper';
      default:
        return 'device_capability';
    }
  }

  private labelFor(primitiveId: SatelliteAppCapabilityPrimitive): string {
    return primitiveId
      .split('.')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private readSource(runtime: SatelliteAppConsistencyRuntime, key: SatelliteSourceFileKey): string {
    if (typeof runtime.files?.[key] === 'string') {
      return runtime.files[key] as string;
    }
    const rootDir = runtime.rootDir || process.cwd();
    const absolutePath = path.join(rootDir, SOURCE_FILE_NAMES[key]);
    try {
      return fs.readFileSync(absolutePath, 'utf8');
    } catch {
      return '';
    }
  }
}

function baseTargets(client: string): SatelliteAppConsistencyEntry['targetFiles'] {
  return {
    contract: 'src/contracts/SatelliteContract.ts',
    service: 'src/services/SatelliteTransportService.ts',
    client,
    policy: 'src/security',
  };
}
