import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { NodePairingService } from './NodePairingService.js';

import {
  ZAVORTH_APPS_SATELLITE_NODES_CONTRACT_VERSION,
  type ZavorthAppsSatelliteAction,
  type ZavorthAppsSatelliteHealth,
  type ZavorthAppsSatelliteInput,
  type ZavorthAppsSatelliteMobileSpec,
  type ZavorthAppsSatelliteNodeKind,
  type ZavorthAppsSatelliteOfflineQueue,
  type ZavorthAppsSatellitePairing,
  type ZavorthAppsSatellitePush,
  type ZavorthAppsSatelliteReceipt,
  type ZavorthAppsSatelliteSnapshot,
  type ZavorthAppsSatelliteStatus,
  type ZavorthAppsSatelliteSurface,
  type ZavorthAppsSatelliteDesktopTraySpec,
} from '../contracts/ZavorthAppsSatelliteNodesContract.js';

type AppsSatelliteDeps = {
  now?: () => Date;
  env?: Record<string, string | undefined>;
  cwd?: string;
  exists?: (file: string) => boolean;
  pairingService?: NodePairingService;
};

const DEFAULT_TTL_SECONDS = 10 * 60;
const MAX_TTL_SECONDS = 60 * 60;
const QUEUE_MAX_ITEMS = 500;

export class ZavorthAppsSatelliteNodesService {
  private readonly now: () => Date;
  private readonly env: Record<string, string | undefined>;
  private readonly cwd: string;
  private readonly exists: (file: string) => boolean;
  private readonly pairingService?: NodePairingService;

  public constructor(deps: AppsSatelliteDeps = {}) {
    this.now = deps.now || (() => new Date());
    this.env = deps.env || process.env;
    this.cwd = path.resolve(deps.cwd || process.cwd());
    this.exists = deps.exists || fs.existsSync;
    this.pairingService = deps.pairingService;
  }

  public execute(input: ZavorthAppsSatelliteInput = {}): ZavorthAppsSatelliteSnapshot {
    const action = normalizeAction(input.action);
    const nodeKind = normalizeNodeKind(input.nodeKind);
    const workspace = path.resolve(input.workspace || this.cwd);
    const ttlSeconds = normalizeTtl(input.ttlSeconds);
    const surfaces = this.buildSurfaces();
    const health = this.buildHealth();
    const offlineQueue = this.buildOfflineQueue();
    const push = this.buildPush(input);
    const mobileCompanionSpec = this.buildMobileSpec();
    const desktopTraySpec = this.buildDesktopTraySpec();
    const receipts: ZavorthAppsSatelliteReceipt[] = [
      receipt('health', 'done', `Satellite app health is ${health.status}; PWA=${health.satellitePwaReady}, nodeHost=${health.nodeHostReady}.`),
      receipt('offline-queue', offlineQueue.available ? 'done' : 'needs-configuration', `Offline queue durable=${offlineQueue.durable}; pending=${offlineQueue.pending}; deadLetter=${offlineQueue.deadLetter}.`),
      receipt('push', pushReceiptStatus(push.status), `Push plan is ${push.status}; liveSendPerformed=false.`),
      receipt('mobile-spec', 'planned', 'Mobile companion remains spec-ready until the owner ships signed wrappers or uses the PWA path.'),
      receipt('tray-spec', desktopTraySpec.enabled ? 'done' : 'planned', 'Desktop tray is represented as a governed companion surface, not a hidden background agent.'),
    ];
    const pairing = this.buildPairing({
      action,
      nodeKind,
      label: input.label,
      actorId: input.actorId,
      workspace,
      ttlSeconds,
      materialize: Boolean(input.materialize),
      approvalId: input.approvalId,
      receipts,
    });
    const status = this.resolveStatus({ action, pairing, health, push });

    receipts.push(receipt('policy', 'done', 'Apps and satellite nodes stay least-privilege: pairing, push and remote invocation require consent, allowlists and receipts.'));

    return {
      contractVersion: ZAVORTH_APPS_SATELLITE_NODES_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      source: 'ZavorthAppsSatelliteNodesService',
      action,
      status,
      workspace: normalizePath(workspace),
      pairing,
      health,
      offlineQueue,
      push,
      mobileCompanionSpec,
      desktopTraySpec,
      surfaces,
      receipts,
      safety: {
        noRawPairingSecretsSerialized: true,
        qrPayloadUsesOpaqueShortLivedCode: true,
        pairingMaterializationRequiresApproval: true,
        pushRequiresConsentAndConfiguredProvider: true,
        offlineQueueReceiptsRequired: true,
        mobileAndTraySpecsDoNotClaimAppStoreBinaries: true,
        satelliteNodesStayLeastPrivilege: true,
      },
      commands: {
        status: 'zavorth apps',
        pairingQr: 'zavorth apps --action pairing.qr',
        materializePairing: 'zavorth apps --action pairing.qr --materialize --approval-id <id>',
        pushPlan: 'zavorth apps --action push.plan',
        check: 'npm run zavorth:apps-satellite-nodes:check --silent',
      },
      nextSafeAction: nextSafeAction(status, action),
    };
  }

  public formatSnapshotText(snapshot: ZavorthAppsSatelliteSnapshot): string {
    return [
      'Zavorth Apps / Satellite Nodes',
      '',
      `Status: ${snapshot.status}`,
      `Action: ${snapshot.action}`,
      `Pairing: ${snapshot.pairing.status} | ${snapshot.pairing.nodeKind} | expires ${snapshot.pairing.expiresAt}`,
      `QR: ${snapshot.pairing.qrPayload}`,
      `Health: ${snapshot.health.status} | gateway=${snapshot.health.gatewayReachable} | pwa=${snapshot.health.satellitePwaReady}`,
      `Offline queue: ${snapshot.offlineQueue.status} | pending=${snapshot.offlineQueue.pending} | durable=${snapshot.offlineQueue.durable}`,
      `Push: ${snapshot.push.status}`,
      '',
      'Surfaces:',
      ...snapshot.surfaces.map((surface) =>
        `- ${surface.id}: ${surface.status} | ${surface.liveClaim} | ${surface.capabilities.join(', ')}`),
      '',
      `Next: ${snapshot.nextSafeAction}`,
    ].join('\n');
  }

  private buildPairing(input: {
    action: ZavorthAppsSatelliteAction;
    nodeKind: ZavorthAppsSatelliteNodeKind;
    label?: string | null;
    actorId?: string | null;
    workspace: string;
    ttlSeconds: number;
    materialize: boolean;
    approvalId?: string | null;
    receipts: ZavorthAppsSatelliteReceipt[];
  }): ZavorthAppsSatellitePairing {
    const label = String(input.label || '').trim() || labelForNodeKind(input.nodeKind);
    const expiresAt = new Date(this.now().getTime() + input.ttlSeconds * 1000).toISOString();
    const previewCode = this.buildOpaqueSetupCode({
      nodeKind: input.nodeKind,
      label,
      actorId: input.actorId,
      expiresAt,
    });
    const requestedMaterialize = input.materialize && input.action === 'pairing.qr';
    const approvalPresent = Boolean(String(input.approvalId || '').trim());

    if (requestedMaterialize && !approvalPresent) {
      input.receipts.push(receipt('pairing', 'approval-required', 'Pairing QR materialization writes a short-lived claim draft and therefore requires approval.'));
      return this.pairingPayload({
        status: 'approval-required',
        nodeKind: input.nodeKind,
        label,
        setupCode: previewCode,
        expiresAt,
        ttlSeconds: input.ttlSeconds,
        materialized: false,
      });
    }

    if (requestedMaterialize && approvalPresent) {
      const service = this.pairingService || new NodePairingService({ now: this.now });
      const draft = service.createPairingDraft({
        label,
        kind: kindForPairingService(input.nodeKind),
        requestedBy: String(input.actorId || 'operator').trim() || 'operator',
        hostHints: {
          workspace: input.workspace,
          surface: input.nodeKind,
        },
        notes: [
          'Generated by Apps / Satellite Nodes phase 7.',
          'Pairing code expires by operator policy; shared secret is never serialized in this snapshot.',
        ],
      });
      input.receipts.push(receipt('pairing', 'done', `Materialized pairing draft for ${draft.entry.id}; shared secret omitted from snapshot.`));
      return this.pairingPayload({
        status: 'materialized',
        nodeKind: input.nodeKind,
        label: draft.entry.label || label,
        setupCode: draft.pairingCode,
        expiresAt,
        ttlSeconds: input.ttlSeconds,
        materialized: true,
      });
    }

    input.receipts.push(receipt('pairing', 'planned', 'Previewed short-lived QR/setup code only; no node registry entry was created.'));
    return this.pairingPayload({
      status: 'preview',
      nodeKind: input.nodeKind,
      label,
      setupCode: previewCode,
      expiresAt,
      ttlSeconds: input.ttlSeconds,
      materialized: false,
    });
  }

  private pairingPayload(input: {
    status: ZavorthAppsSatellitePairing['status'];
    nodeKind: ZavorthAppsSatelliteNodeKind;
    label: string;
    setupCode: string;
    expiresAt: string;
    ttlSeconds: number;
    materialized: boolean;
  }): ZavorthAppsSatellitePairing {
    return {
      status: input.status,
      nodeKind: input.nodeKind,
      label: input.label,
      setupCode: input.setupCode,
      qrPayload: `zavorth://pair?code=${encodeURIComponent(input.setupCode)}&surface=${encodeURIComponent(input.nodeKind)}&exp=${encodeURIComponent(input.expiresAt)}`,
      expiresAt: input.expiresAt,
      ttlSeconds: input.ttlSeconds,
      materialized: input.materialized,
      approvalRequired: !input.materialized,
      allowlistRequired: true,
      receiptRequired: true,
      noRawTokenSerialized: true,
      materializeCommand: `zavorth apps --action pairing.qr --surface ${input.nodeKind} --materialize --approval-id <id>`,
      claimCommand: `zavorth companion pair --code ${input.setupCode}`,
    };
  }

  private buildHealth(): ZavorthAppsSatelliteHealth {
    const satellitePwaReady = this.hasRepoFile('src/satellite/satellite.js')
      && this.hasRepoFile('src/satellite/satellite.css');
    const nodeHostReady = this.hasRepoFile('src/services/NodeInvokeService.ts')
      && this.hasRepoFile('src/services/NodeHeartbeatService.ts')
      && this.hasRepoFile('src/services/NodeHostCapabilityService.ts');
    const companionPackReady = this.hasRepoFile('src/services/ZavorthNativeCompanionDevicePackService.ts');
    const approvalCompanionReady = this.hasRepoFile('src/services/ZavorthSatelliteApprovalCompanionService.ts');
    const gatewayReachable = isTruthy(this.env.ZAVORTH_GATEWAY_READY)
      || Boolean(String(this.env.ZAVORTH_GATEWAY_URL || this.env.ZAVORTH_WEB_BASE_URL || '').trim());
    const warnings = [
      !gatewayReachable ? 'Gateway is not proven reachable in this dry-run snapshot.' : null,
      !satellitePwaReady ? 'Satellite PWA assets are missing.' : null,
      !nodeHostReady ? 'Node host services are incomplete.' : null,
      !approvalCompanionReady ? 'Approval companion service is missing.' : null,
    ].filter((entry): entry is string => Boolean(entry));
    return {
      status: warnings.length ? 'attention' : 'ready',
      gatewayReachable,
      satellitePwaReady,
      nodeHostReady,
      companionPackReady,
      approvalCompanionReady,
      warnings,
    };
  }

  private buildOfflineQueue(): ZavorthAppsSatelliteOfflineQueue {
    const available = this.hasRepoFile('src/services/NodeInvocationStoreService.ts')
      && this.hasRepoFile('src/services/NodeInvokeService.ts');
    return {
      status: available ? 'ready' : 'needs-configuration',
      available,
      durable: available,
      pending: readInt(this.env.ZAVORTH_SATELLITE_QUEUE_PENDING, 0),
      deadLetter: readInt(this.env.ZAVORTH_SATELLITE_QUEUE_DEAD_LETTER, 0),
      maxItems: readInt(this.env.ZAVORTH_SATELLITE_QUEUE_MAX_ITEMS, QUEUE_MAX_ITEMS),
      retryPolicy: {
        maxAttempts: readInt(this.env.ZAVORTH_SATELLITE_QUEUE_MAX_ATTEMPTS, 5),
        baseDelayMs: readInt(this.env.ZAVORTH_SATELLITE_QUEUE_BASE_DELAY_MS, 1000),
        maxDelayMs: readInt(this.env.ZAVORTH_SATELLITE_QUEUE_MAX_DELAY_MS, 60000),
      },
      receiptRequired: true,
      storage: {
        kind: 'local-state',
        pathRedacted: '<zavorth-local-state>/offline-queue',
      },
    };
  }

  private buildPush(input: ZavorthAppsSatelliteInput): ZavorthAppsSatellitePush {
    const webPushReady = Boolean(this.env.ZAVORTH_WEB_PUSH_PUBLIC_KEY && this.env.ZAVORTH_WEB_PUSH_PRIVATE_REF);
    const mobilePushReady = Boolean(this.env.ZAVORTH_MOBILE_PUSH_PROVIDER && this.env.ZAVORTH_MOBILE_PUSH_CREDENTIAL_REF);
    const desktopTrayReady = isTruthy(this.env.ZAVORTH_DESKTOP_TRAY_ENABLED);
    const telegramReady = Boolean(this.env.TELEGRAM_BOT_TOKEN || this.env.ZAVORTH_TELEGRAM_BOT_TOKEN);
    const consentPresent = Boolean(String(input.consentId || '').trim());
    const channels: ZavorthAppsSatellitePush['channels'] = [
      {
        id: 'web-push',
        label: 'Web Push',
        status: webPushReady ? consentPresent ? 'ready' : 'approval-required' : 'needs-configuration',
        requiredEnv: ['ZAVORTH_WEB_PUSH_PUBLIC_KEY', 'ZAVORTH_WEB_PUSH_PRIVATE_REF'],
        consentRequired: true,
        liveSendPerformed: false,
      },
      {
        id: 'mobile-push',
        label: 'Mobile push provider',
        status: mobilePushReady ? consentPresent ? 'ready' : 'approval-required' : 'needs-configuration',
        requiredEnv: ['ZAVORTH_MOBILE_PUSH_PROVIDER', 'ZAVORTH_MOBILE_PUSH_CREDENTIAL_REF'],
        consentRequired: true,
        liveSendPerformed: false,
      },
      {
        id: 'desktop-tray',
        label: 'Desktop tray notification',
        status: desktopTrayReady ? consentPresent ? 'ready' : 'approval-required' : 'needs-configuration',
        requiredEnv: ['ZAVORTH_DESKTOP_TRAY_ENABLED'],
        consentRequired: true,
        liveSendPerformed: false,
      },
      {
        id: 'telegram-fallback',
        label: 'Telegram fallback notification',
        status: telegramReady ? consentPresent ? 'ready' : 'approval-required' : 'needs-configuration',
        requiredEnv: ['TELEGRAM_BOT_TOKEN or ZAVORTH_TELEGRAM_BOT_TOKEN'],
        consentRequired: true,
        liveSendPerformed: false,
      },
    ];
    const anyConfigured = channels.some((channel) => channel.status !== 'needs-configuration');
    const anyReady = channels.some((channel) => channel.status === 'ready');
    return {
      status: anyReady ? 'ready' : anyConfigured ? 'approval-required' : 'needs-configuration',
      channels,
      consentRequired: true,
      credentialsRequired: !anyConfigured,
      liveSendPerformed: false,
      planCommand: 'zavorth apps --action push.plan --consent-id <id>',
    };
  }

  private buildMobileSpec(): ZavorthAppsSatelliteMobileSpec {
    const pwaReady = this.hasRepoFile('src/satellite/satellite.js');
    return {
      status: pwaReady ? 'spec-ready' : 'needs-configuration',
      ios: {
        status: 'spec-ready',
        capabilities: ['pairing QR', 'approval cards', 'camera permission', 'push notification spec', 'offline queue sync'],
        storeBinaryClaimed: false,
      },
      android: {
        status: 'spec-ready',
        capabilities: ['pairing QR', 'approval cards', 'camera permission', 'push notification spec', 'offline queue sync'],
        storeBinaryClaimed: false,
      },
      pwa: {
        status: pwaReady ? 'ready' : 'needs-configuration',
        capabilities: ['pairing claim', 'heartbeat', 'approval companion', 'offline queue replay', 'device confirmation'],
      },
      requirements: [
        'short-lived setup code or QR',
        'paired device allowlist',
        'camera/location/browser permission before capture',
        'push consent and credential reference before live notification',
        'receipt for every sensitive invocation',
      ],
      setupCommand: 'zavorth apps --action mobile.spec',
    };
  }

  private buildDesktopTraySpec(): ZavorthAppsSatelliteDesktopTraySpec {
    const enabled = isTruthy(this.env.ZAVORTH_DESKTOP_TRAY_ENABLED);
    return {
      status: enabled ? 'ready' : 'spec-ready',
      platforms: ['windows', 'macos', 'linux'],
      capabilities: ['status indicator', 'approval notification', 'open ZavorthControl', 'pairing QR', 'offline queue status'],
      enabled,
      binaryClaimed: false,
      setupCommand: 'zavorth apps --action tray.spec',
      openCommand: 'zavorth open',
    };
  }

  private buildSurfaces(): ZavorthAppsSatelliteSurface[] {
    return [
      surface({
        id: 'satellite-pwa',
        label: 'Satellite PWA',
        status: this.hasRepoFile('src/satellite/satellite.js') ? 'ready' : 'needs-configuration',
        liveClaim: this.hasRepoFile('src/satellite/satellite.js') ? 'live-ready' : 'configurable',
        capabilities: ['pairing claim', 'heartbeat', 'approval companion', 'offline queue', 'browser permissions'],
        setupCommand: 'zavorth apps --action pairing.qr --surface satellite-pwa',
        healthCommand: 'npm run satellite-device-live-plane:check --silent',
        limitations: ['Browser permissions and push consent are still required per device.'],
      }),
      surface({
        id: 'mobile-companion',
        label: 'Mobile companion',
        status: 'planned',
        liveClaim: 'spec-ready',
        capabilities: ['iOS spec', 'Android spec', 'PWA fallback', 'push notification plan'],
        setupCommand: 'zavorth apps --action mobile.spec',
        healthCommand: 'npm run zavorth-native-companion-device-pack:check --silent',
        limitations: ['No app-store binary is claimed by this phase.'],
      }),
      surface({
        id: 'desktop-tray',
        label: 'Desktop tray',
        status: isTruthy(this.env.ZAVORTH_DESKTOP_TRAY_ENABLED) ? 'ready' : 'planned',
        liveClaim: isTruthy(this.env.ZAVORTH_DESKTOP_TRAY_ENABLED) ? 'configurable' : 'spec-ready',
        capabilities: ['approval notifications', 'quick status', 'open ZavorthControl', 'pairing QR'],
        setupCommand: 'zavorth apps --action tray.spec',
        healthCommand: 'zavorth apps --action health',
        limitations: ['Native tray binary remains explicit and owner-gated.'],
      }),
      surface({
        id: 'desktop-companion',
        label: 'Desktop companion',
        status: this.hasRepoFile('src/nodes/companion/CompanionBootstrapper.ts') ? 'ready' : 'needs-configuration',
        liveClaim: this.hasRepoFile('src/nodes/companion/CompanionBootstrapper.ts') ? 'live-ready' : 'configurable',
        capabilities: ['pairing', 'heartbeat', 'local capability report', 'approval relay'],
        setupCommand: 'npm run companion:start -- --passcode <node:code>',
        healthCommand: 'npm run zavorth-native-companion-device-pack:check --silent',
        limitations: ['Clipboard/screen/native capabilities remain gated by device policy.'],
      }),
      surface({
        id: 'node-host',
        label: 'Node host',
        status: this.hasRepoFile('src/services/NodeInvokeService.ts') ? 'ready' : 'needs-configuration',
        liveClaim: this.hasRepoFile('src/services/NodeInvokeService.ts') ? 'live-ready' : 'configurable',
        capabilities: ['headless pairing', 'heartbeat', 'offline assignment queue', 'capability doctor'],
        setupCommand: 'npm run nodes:host -- --pairing-code <code>',
        healthCommand: 'zavorth nodes health',
        limitations: ['Remote execution still requires approved capabilities and receipts.'],
      }),
      surface({
        id: 'approval-companion',
        label: 'Approval companion',
        status: this.hasRepoFile('src/services/ZavorthSatelliteApprovalCompanionService.ts') ? 'ready' : 'needs-configuration',
        liveClaim: this.hasRepoFile('src/services/ZavorthSatelliteApprovalCompanionService.ts') ? 'live-ready' : 'configurable',
        capabilities: ['approval cards', 'risk summary', 'receipt preview', 'cross-surface decision sync'],
        setupCommand: 'npm run zavorth:satellite-approval-companion --silent',
        healthCommand: 'npm run zavorth:satellite-approval-companion:check --silent',
        limitations: ['Sensitive decisions require operator identity and action-card validation.'],
      }),
    ];
  }

  private resolveStatus(input: {
    action: ZavorthAppsSatelliteAction;
    pairing: ZavorthAppsSatellitePairing;
    health: ZavorthAppsSatelliteHealth;
    push: ZavorthAppsSatellitePush;
  }): ZavorthAppsSatelliteStatus {
    if (input.pairing.status === 'approval-required') return 'approval-required';
    if (input.action === 'push.plan') return input.push.status;
    if (input.action === 'mobile.spec' || input.action === 'tray.spec') return 'planned';
    if (input.action === 'health') return input.health.status === 'ready' ? 'ready' : 'preview';
    return input.health.status === 'ready' ? 'ready' : 'preview';
  }

  private buildOpaqueSetupCode(input: {
    nodeKind: ZavorthAppsSatelliteNodeKind;
    label: string;
    actorId?: string | null;
    expiresAt: string;
  }): string {
    const seed = [
      input.nodeKind,
      input.label,
      input.actorId || 'operator',
      input.expiresAt,
      this.now().toISOString(),
    ].join('|');
    return `ZA-${crypto.createHash('sha256').update(seed).digest('base64url').slice(0, 12).toUpperCase()}`;
  }

  private hasRepoFile(file: string): boolean {
    return this.exists(path.join(this.cwd, file));
  }
}

function normalizeAction(value: ZavorthAppsSatelliteInput['action']): ZavorthAppsSatelliteAction {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'pair' || normalized === 'pairing.plan') return 'pairing.plan';
  if (normalized === 'qr' || normalized === 'pairing.qr') return 'pairing.qr';
  if (normalized === 'queue' || normalized === 'queue.status') return 'queue.status';
  if (normalized === 'push' || normalized === 'push.plan') return 'push.plan';
  if (normalized === 'mobile' || normalized === 'mobile.spec') return 'mobile.spec';
  if (normalized === 'tray' || normalized === 'tray.spec') return 'tray.spec';
  if (normalized === 'health') return 'health';
  return 'apps.status';
}

function normalizeNodeKind(value: ZavorthAppsSatelliteInput['nodeKind']): ZavorthAppsSatelliteNodeKind {
  const normalized = String(value || '').trim().toLowerCase();
  if (
    normalized === 'satellite-pwa'
    || normalized === 'mobile-companion'
    || normalized === 'desktop-tray'
    || normalized === 'desktop-companion'
    || normalized === 'node-host'
    || normalized === 'approval-companion'
  ) {
    return normalized;
  }
  return 'satellite-pwa';
}

function normalizeTtl(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return DEFAULT_TTL_SECONDS;
  return Math.min(Math.max(Math.floor(number), 60), MAX_TTL_SECONDS);
}

function kindForPairingService(kind: ZavorthAppsSatelliteNodeKind) {
  if (kind === 'mobile-companion' || kind === 'satellite-pwa') return 'mobile';
  if (kind === 'desktop-tray' || kind === 'desktop-companion') return 'desktop';
  if (kind === 'approval-companion') return 'browser';
  return 'headless';
}

function labelForNodeKind(kind: ZavorthAppsSatelliteNodeKind): string {
  switch (kind) {
    case 'mobile-companion':
      return 'Mobile companion';
    case 'desktop-tray':
      return 'Desktop tray';
    case 'desktop-companion':
      return 'Desktop companion';
    case 'node-host':
      return 'Node host';
    case 'approval-companion':
      return 'Approval companion';
    default:
      return 'Satellite PWA';
  }
}

function surface(input: ZavorthAppsSatelliteSurface): ZavorthAppsSatelliteSurface {
  return input;
}

function receipt(
  kind: ZavorthAppsSatelliteReceipt['kind'],
  status: ZavorthAppsSatelliteReceipt['status'],
  summary: string,
): ZavorthAppsSatelliteReceipt {
  return {
    id: `apps-satellite-${kind}-${crypto.createHash('sha256').update(`${kind}:${status}:${summary}`).digest('hex').slice(0, 12)}`,
    kind,
    status,
    summary,
    rawSecretSerialized: false,
  };
}

function pushReceiptStatus(status: ZavorthAppsSatellitePush['status']): ZavorthAppsSatelliteReceipt['status'] {
  return status === 'ready' ? 'done' : status;
}

function readInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

function isTruthy(value: unknown): boolean {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/');
}

function nextSafeAction(status: ZavorthAppsSatelliteStatus, action: ZavorthAppsSatelliteAction): string {
  if (status === 'approval-required') {
    return 'Review the pairing or push scope, then provide a scoped approval or consent id.';
  }
  if (status === 'needs-configuration') {
    return 'Configure the requested push/provider credentials, then rerun the same Apps/Satellite command.';
  }
  if (action === 'pairing.qr') {
    return 'Use the preview QR for UX review, or materialize it with approval before a real companion claim.';
  }
  if (action === 'push.plan') {
    return 'Configure one push route and pass a consent id before live notification delivery.';
  }
  return 'Pair a companion, inspect health, or open ZavorthControl for cross-surface approvals.';
}
