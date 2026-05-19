import crypto from 'crypto';
import os from 'os';
import path from 'path';
import type {
  NodeInvocationRecord,
  NodeInvocationResult,
  NodeMeshCapabilityId,
  NodeMeshHeartbeatResult,
  NodeMeshPairingClaim,
  NodeMeshPairingDraft,
} from '../contracts/NodeMeshContract.js';
import type { NodeHostExecutionResult } from '../domain/nodes/infrastructure/node-host-capability/NodeHostCapabilityTypes.js';
import { NodeHeartbeatService } from './NodeHeartbeatService.js';
import { NodeHostCapabilityService } from './NodeHostCapabilityService.js';
import { NodeInvocationStoreService } from './NodeInvocationStoreService.js';
import { NodeInvokeService } from './NodeInvokeService.js';
import { NodePairingService } from './NodePairingService.js';
import { NodeRegistryService } from './NodeRegistryService.js';

type SatelliteDeviceLiveRuntime = {
  now?: () => Date;
  workspaceRoot?: string;
  tempRoot?: string;
  registryService?: NodeRegistryService;
  invocationStoreService?: NodeInvocationStoreService;
  pairingService?: NodePairingService;
  heartbeatService?: NodeHeartbeatService;
  invokeService?: NodeInvokeService;
  hostCapabilityService?: NodeHostCapabilityService;
};

export type SatelliteBrowserPhoneProofInput = {
  nodeId?: string | null;
  label?: string | null;
  approvedCapabilityIds?: NodeMeshCapabilityId[] | null;
  cameraContentBase64?: string | null;
  location?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number | null;
    label?: string | null;
  } | null;
  includeHaptic?: boolean;
};

export type SatelliteBrowserPhoneProof = {
  ok: boolean;
  nodeId: string;
  pairingClaimed: boolean;
  heartbeatAccepted: boolean;
  queuedInvocationIds: string[];
  claimedAssignmentIds: string[];
  invokedCapabilityIds: NodeMeshCapabilityId[];
  completedCapabilityIds: NodeMeshCapabilityId[];
  acceptedResults: number;
  cameraArtifactPath: string | null;
  confirmationRequired: true;
  sensitiveApprovalSource: string | null;
  unsupportedNativeApisExplicit: true;
  secretValuesSerialized: false;
  receipt: {
    id: string;
    liveIoPerformed: true;
    pairingCodeSerialized: false;
    sharedSecretSerialized: false;
    cameraLocationConfirmationProven: boolean;
  };
};

export type SatelliteSensitiveApprovalProbe = {
  ok: boolean;
  blocked: boolean;
  nodeId: string;
  capabilityId: NodeMeshCapabilityId;
  policySource: string | null;
  reason: string;
  sensitiveInvokeBypassesTrust: false;
  secretValuesSerialized: false;
};

export type SatelliteOfflineQueueProof = {
  ok: boolean;
  nodeId: string;
  queuedWhileOffline: boolean;
  deliveredOnHeartbeat: boolean;
  queuedInvocationId: string | null;
  claimedAssignmentIds: string[];
  secretValuesSerialized: false;
};

export type SatelliteNativeSupportDecision = {
  targetId: 'bonjour';
  status: 'explicit-native-wrapper-decision';
  pwa: {
    cameraCapture: 'supported-by-browser-api';
    geolocation: 'supported-by-browser-api';
    notifications: 'permission-gated-browser-api';
    haptics: 'supported-when-navigator-vibrate-exists';
    webAuthn: 'supported-by-browser-api';
  };
  nativeOnly: {
    bonjourDiscovery: 'native-wrapper-required-for-background-mdns';
    backgroundPushReliability: 'native-wrapper-required-when-browser-push-is-insufficient';
  };
  unsupportedNativeApisHidden: false;
  secretValuesSerialized: false;
};

const PHONE_CAPABILITY_IDS: NodeMeshCapabilityId[] = [
  'device.info',
  'camera.capture',
  'location.read',
  'device.confirm',
  'haptics.vibrate',
];

export class SatelliteDeviceLiveService {
  private readonly now: () => Date;
  private readonly workspaceRoot: string;
  private readonly tempRoot: string;
  private readonly registryService: NodeRegistryService;
  private readonly invocationStoreService: NodeInvocationStoreService;
  private readonly pairingService: NodePairingService;
  private readonly heartbeatService: NodeHeartbeatService;
  private readonly invokeService: NodeInvokeService;
  private readonly hostCapabilityService: NodeHostCapabilityService;

  constructor(runtime: SatelliteDeviceLiveRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.workspaceRoot = path.resolve(runtime.workspaceRoot || process.cwd());
    this.tempRoot = path.resolve(runtime.tempRoot || path.join(os.tmpdir(), 'zavorth-satellite-device-live'));
    this.registryService = runtime.registryService || new NodeRegistryService({
      now: this.now,
      stateFile: path.join(this.tempRoot, 'node-mesh-state.json'),
      secretsFile: path.join(this.tempRoot, 'node-mesh-secrets.json'),
    });
    this.invocationStoreService = runtime.invocationStoreService || new NodeInvocationStoreService({
      now: this.now,
      stateFile: path.join(this.tempRoot, 'node-mesh-invocations.json'),
    });
    this.pairingService = runtime.pairingService || new NodePairingService({
      now: this.now,
      registryService: this.registryService,
    });
    this.invokeService = runtime.invokeService || new NodeInvokeService({
      now: this.now,
      registryService: this.registryService,
      invocationStoreService: this.invocationStoreService,
    });
    this.heartbeatService = runtime.heartbeatService || new NodeHeartbeatService({
      now: this.now,
      registryService: this.registryService,
      pairingService: this.pairingService,
      invokeService: this.invokeService,
    });
    this.hostCapabilityService = runtime.hostCapabilityService || new NodeHostCapabilityService({
      now: this.now,
      workspaceRoot: this.workspaceRoot,
      tempRoot: this.tempRoot,
      allowedRoots: [this.workspaceRoot, this.tempRoot],
    });
  }

  public async runBrowserPhoneProof(input: SatelliteBrowserPhoneProofInput = {}): Promise<SatelliteBrowserPhoneProof> {
    const approvedCapabilityIds = input.approvedCapabilityIds || PHONE_CAPABILITY_IDS;
    const draft = this.createPhoneDraft({
      nodeId: input.nodeId || null,
      label: input.label || 'Intent model1 Browser Phone',
      capabilityIds: PHONE_CAPABILITY_IDS,
      approvedCapabilityIds,
    });
    const claim = this.claimDraft(draft, PHONE_CAPABILITY_IDS);
    const sharedSecret = claim.sharedSecret;

    const invocations = [
      this.invokeRequired(draft.entry.id, 'camera.capture', 'capture', {
        contentBase64: String(input.cameraContentBase64 || Buffer.from('zavorth-checkpoint-11-camera-proof').toString('base64')),
        outputPath: path.join(this.tempRoot, 'captures', `${draft.entry.id}.camera.png`),
      }),
      this.invokeRequired(draft.entry.id, 'location.read', 'read', input.location || {
        latitude: -23.55052,
        longitude: -46.633308,
        accuracyMeters: 12,
        label: 'checkpoint-11-satellite-smoke',
      }),
      this.invokeRequired(draft.entry.id, 'device.confirm', 'confirm', {
        action: 'phone-control-sensitive-command',
        challenge: 'checkpoint-11-webauthn-challenge',
        credentialId: 'credential-redacted',
        userPresent: true,
      }),
    ];
    if (input.includeHaptic !== false) {
      invocations.push(this.invokeRequired(draft.entry.id, 'haptics.vibrate', 'vibrate', {
        supported: true,
        pattern: [30, 40, 30],
      }));
    }

    const assignmentHeartbeat = this.receiveHeartbeatRequired(draft.entry.id, sharedSecret);
    const completions = await Promise.all(
      assignmentHeartbeat.assignments.map((assignment) => this.executeAssignment(assignment)),
    );
    const completionHeartbeat = this.receiveHeartbeatRequired(draft.entry.id, sharedSecret, completions);
    const completedCapabilityIds = assignmentHeartbeat.assignments
      .filter((assignment) => completions.some((completion) => completion.invocationId === assignment.id && completion.ok))
      .map((assignment) => assignment.capabilityId);
    const cameraCompletion = completions.find((completion) => completion.invocationId === assignmentHeartbeat.assignments.find((assignment) => assignment.capabilityId === 'camera.capture')?.id);
    const cameraArtifactPath = typeof cameraCompletion?.data?.path === 'string'
      ? String(cameraCompletion.data.path)
      : null;

    return {
      ok: completionHeartbeat.acceptedResults === completions.length && completions.length >= 3,
      nodeId: draft.entry.id,
      pairingClaimed: true,
      heartbeatAccepted: true,
      queuedInvocationIds: invocations.map((invocation) => String(invocation.invocationId || '')).filter(Boolean),
      claimedAssignmentIds: assignmentHeartbeat.assignments.map((assignment) => assignment.id),
      invokedCapabilityIds: invocations.map((invocation) => invocation.capabilityId),
      completedCapabilityIds,
      acceptedResults: completionHeartbeat.acceptedResults,
      cameraArtifactPath,
      confirmationRequired: true,
      sensitiveApprovalSource: invocations.find((invocation) => invocation.capabilityId === 'camera.capture')?.policyDecision?.source || null,
      unsupportedNativeApisExplicit: true,
      secretValuesSerialized: false,
      receipt: {
        id: `satellite-device-live.browser-phone.${draft.entry.id}.receipt`,
        liveIoPerformed: true,
        pairingCodeSerialized: false,
        sharedSecretSerialized: false,
        cameraLocationConfirmationProven: ['camera.capture', 'location.read', 'device.confirm']
          .every((capabilityId) => completedCapabilityIds.includes(capabilityId)),
      },
    };
  }

  public runSensitiveApprovalProbe(): SatelliteSensitiveApprovalProbe {
    const draft = this.createPhoneDraft({
      label: 'Intent model1 Approval Probe',
      capabilityIds: ['device.info', 'camera.capture'],
      approvedCapabilityIds: ['device.info'],
    });
    this.claimDraft(draft, ['device.info', 'camera.capture']);
    const result = this.invokeService.invoke({
      nodeId: draft.entry.id,
      capabilityId: 'camera.capture',
      action: 'capture',
      payload: {
        contentBase64: Buffer.from('blocked-camera-proof').toString('base64'),
      },
      requestedBy: 'checkpoint-11-sensitive-approval-probe',
      surface: 'satellite-device-live-plane',
    });

    return {
      ok: result.ok === false && result.status === 'blocked',
      blocked: result.status === 'blocked',
      nodeId: draft.entry.id,
      capabilityId: 'camera.capture',
      policySource: result.policyDecision?.source || null,
      reason: result.reason,
      sensitiveInvokeBypassesTrust: false,
      secretValuesSerialized: false,
    };
  }

  public runOfflineQueueProof(): SatelliteOfflineQueueProof {
    const draft = this.createPhoneDraft({
      label: 'Intent model1 Offline Queue',
      capabilityIds: ['device.info'],
      approvedCapabilityIds: ['device.info'],
    });
    const claim = this.claimDraft(draft, ['device.info']);
    this.registryService.markNodeOffline(draft.entry.id, 'Intent model1 offline queue proof.');
    const result = this.invokeService.invoke({
      nodeId: draft.entry.id,
      capabilityId: 'device.info',
      action: 'describe',
      payload: {
        deviceModel: 'PWA offline queue fixture',
      },
      requestedBy: 'checkpoint-11-offline-queue-proof',
      surface: 'satellite-device-live-plane',
    });
    const heartbeat = this.receiveHeartbeatRequired(draft.entry.id, claim.sharedSecret, [], ['device.info']);
    return {
      ok: result.ok && result.status === 'queued' && heartbeat.assignments.length > 0,
      nodeId: draft.entry.id,
      queuedWhileOffline: result.status === 'queued',
      deliveredOnHeartbeat: heartbeat.assignments.length > 0,
      queuedInvocationId: result.invocationId || null,
      claimedAssignmentIds: heartbeat.assignments.map((assignment) => assignment.id),
      secretValuesSerialized: false,
    };
  }

  public async runDeviceDoctorProof(requestedCapabilities: NodeMeshCapabilityId[] = PHONE_CAPABILITY_IDS): Promise<Record<string, unknown>> {
    const result = await this.hostCapabilityService.executeAssignment({
      id: `doctor-${crypto.randomUUID().slice(0, 8)}`,
      capabilityId: 'node.maintenance',
      action: 'doctor',
      payload: {
        requestedCapabilities,
      },
    });
    return {
      ok: result.ok,
      resultSummary: result.resultSummary,
      data: result.data || null,
      secretValuesSerialized: false,
    };
  }

  public buildNativeSupportDecision(): SatelliteNativeSupportDecision {
    return {
      targetId: 'bonjour',
      status: 'explicit-native-wrapper-decision',
      pwa: {
        cameraCapture: 'supported-by-browser-api',
        geolocation: 'supported-by-browser-api',
        notifications: 'permission-gated-browser-api',
        haptics: 'supported-when-navigator-vibrate-exists',
        webAuthn: 'supported-by-browser-api',
      },
      nativeOnly: {
        bonjourDiscovery: 'native-wrapper-required-for-background-mdns',
        backgroundPushReliability: 'native-wrapper-required-when-browser-push-is-insufficient',
      },
      unsupportedNativeApisHidden: false,
      secretValuesSerialized: false,
    };
  }

  private createPhoneDraft(input: {
    nodeId?: string | null;
    label?: string | null;
    capabilityIds: NodeMeshCapabilityId[];
    approvedCapabilityIds: NodeMeshCapabilityId[];
  }): NodeMeshPairingDraft {
    return this.pairingService.createPairingDraft({
      nodeId: input.nodeId || `intent-model1-phone-${crypto.randomUUID().slice(0, 8)}`,
      profileId: 'mobile-companion',
      label: input.label || 'Intent model1 Phone',
      kind: 'mobile',
      transport: 'remote',
      capabilityIds: input.capabilityIds,
      approvedCapabilityIds: input.approvedCapabilityIds,
      requestedBy: 'checkpoint-11-satellite-device-live-plane',
      hostHints: {
        hostname: 'checkpoint-11-phone',
        platform: 'browser-pwa',
        surface: 'satellite-pwa',
        deviceModel: 'Browser Phone',
        appVersion: 'checkpoint-11',
        networkType: 'loopback-smoke',
      },
      notes: ['Intent model1 Satellite/device live proof.'],
    });
  }

  private claimDraft(draft: NodeMeshPairingDraft, capabilityIds: NodeMeshCapabilityId[]): NodeMeshPairingClaim {
    const claim = this.heartbeatService.claimPairing({
      nodeId: draft.entry.id,
      pairingCode: draft.pairingCode,
      capabilityIds,
      hostHints: {
        hostname: 'checkpoint-11-phone',
        platform: 'browser-pwa',
        surface: 'satellite-pwa',
        latencyMs: 8,
      },
    });
    if (!claim) {
      throw new Error('Intent model1 could not claim the Satellite pairing draft.');
    }
    return claim;
  }

  private invokeRequired(
    nodeId: string,
    capabilityId: NodeMeshCapabilityId,
    action: string,
    payload: Record<string, unknown>,
  ): NodeInvocationResult {
    const result = this.invokeService.invoke({
      nodeId,
      capabilityId,
      action,
      payload,
      requestedBy: 'checkpoint-11-satellite-device-live-plane',
      surface: 'satellite-device-live-plane',
      correlation: {
        approvalId: capabilityId === 'device.confirm' ? 'checkpoint-11-device-confirmation' : null,
      },
    });
    if (!result.ok || result.status !== 'queued') {
      throw new Error(`Intent model1 could not queue ${capabilityId}: ${result.reason}`);
    }
    return result;
  }

  private receiveHeartbeatRequired(
    nodeId: string,
    sharedSecret: string,
    results: NodeHostExecutionResult[] = [],
    capabilityIds: NodeMeshCapabilityId[] = PHONE_CAPABILITY_IDS,
  ): NodeMeshHeartbeatResult {
    const heartbeat = this.heartbeatService.receiveHeartbeat({
      nodeId,
      sharedSecret,
      status: 'online',
      capabilityIds,
      hostHints: {
        hostname: 'checkpoint-11-phone',
        platform: 'browser-pwa',
        surface: 'satellite-pwa',
        latencyMs: 7,
      },
      results: results.map((result) => ({
        invocationId: result.invocationId,
        ok: result.ok,
        resultSummary: result.resultSummary,
        stdout: result.stdout || null,
        stderr: result.stderr || null,
        exitCode: result.exitCode ?? null,
        data: result.data || null,
      })),
    });
    if (!heartbeat) {
      throw new Error('Intent model1 heartbeat was rejected by the Node Mesh.');
    }
    return heartbeat;
  }

  private async executeAssignment(assignment: NodeInvocationRecord): Promise<NodeHostExecutionResult> {
    return this.hostCapabilityService.executeAssignment({
      id: assignment.id,
      capabilityId: assignment.capabilityId,
      action: assignment.action,
      payload: assignment.payload || null,
    });
  }
}
