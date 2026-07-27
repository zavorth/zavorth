import { RuntimeBrowserSidecarService, type RuntimeBrowserSidecarAction } from './RuntimeBrowserSidecarService.js';

import crypto from 'node:crypto';
import { assertPublicHttpTargetAllowed } from '../ai-gateway/lib/security/egressGuard.js';
import {
  ZAVORTH_NATIVE_BROWSER_COMPUTER_USE_CONTRACT_VERSION,
  type ZavorthNativeBrowserComputerUseAction,
  type ZavorthNativeBrowserComputerUseCapability,
  type ZavorthNativeBrowserComputerUseInput,
  type ZavorthNativeBrowserComputerUseReceipt,
  type ZavorthNativeBrowserComputerUseSnapshot,
  type ZavorthNativeBrowserComputerUseStatus,
} from '../contracts/ZavorthNativeBrowserComputerUseContract.js';

import { ZavorthComputerControlPlaneService } from './ZavorthComputerControlPlaneService.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

type NativeBrowserComputerUseDeps = {
  sidecar?: Pick<RuntimeBrowserSidecarService, 'execute' | 'isConfigured'> | null;
  computer?: Pick<ZavorthComputerControlPlaneService, 'execute'>;
  now?: () => Date;
};

type DomainDecision = {
  policy: ZavorthNativeBrowserComputerUseSnapshot['target']['domainPolicy'];
  decision: ZavorthNativeBrowserComputerUseSnapshot['policy']['decision'];
  reason: string;
  origin: string | null;
  blocked: boolean;
};

const BROWSER_ACTIONS = new Set<ZavorthNativeBrowserComputerUseAction>([
  'browser.cdp.status',
  'browser.navigate',
  'browser.screenshot',
  'browser.click',
  'browser.type',
  'browser.extract',
]);

const COMPUTER_ACTIONS = new Set<ZavorthNativeBrowserComputerUseAction>([
  'computer.observe',
  'computer.plan',
  'computer.cancel',
]);

const MUTATING_BROWSER_ACTIONS = new Set<ZavorthNativeBrowserComputerUseAction>([
  'browser.click',
  'browser.type',
]);

export class ZavorthNativeBrowserComputerUseService {
  private readonly sidecar: Pick<RuntimeBrowserSidecarService, 'execute' | 'isConfigured'>;
  private readonly computer: Pick<ZavorthComputerControlPlaneService, 'execute'>;
  private readonly now: () => Date;

  constructor(deps: NativeBrowserComputerUseDeps = {}) {
    this.sidecar = deps.sidecar === undefined ? new RuntimeBrowserSidecarService() : deps.sidecar || disabledSidecar();
    this.computer = deps.computer || new ZavorthComputerControlPlaneService();
    this.now = deps.now || (() => new Date());
  }

  public async execute(input: ZavorthNativeBrowserComputerUseInput = {}): Promise<ZavorthNativeBrowserComputerUseSnapshot> {
    const action = normalizeAction(input.action);
    const sourceSurface = String(input.sourceSurface || 'control').trim() || 'control';
    const sidecarConfigured = this.sidecar.isConfigured();
    const receipts: ZavorthNativeBrowserComputerUseReceipt[] = [];
    const visualReceipts: ZavorthNativeBrowserComputerUseSnapshot['visualReceipts'] = [];
    const domain = await this.evaluateDomain(input);
    const mutationRequested = MUTATING_BROWSER_ACTIONS.has(action);
    const approvalRequired = mutationRequested && !String(input.approvalId || '').trim();
    let sidecarUsed = false;
    let sidecarError: string | null = null;
    let computerUsed = false;

    receipts.push(receipt('domain-policy', domain.blocked ? 'blocked' : 'done', domain.reason));

    if (domain.blocked) {
      return this.buildSnapshot({
        input,
        action,
        sourceSurface,
        status: 'blocked',
        domain,
        sidecarConfigured,
        sidecarUsed,
        sidecarError,
        computerUsed,
        receipts,
        visualReceipts,
      });
    }

    if (approvalRequired) {
      receipts.push(receipt('approval', 'approval-required', 'Browser click/type requires owner approval before live sidecar execution.'));
      visualReceipts.push(visualReceipt(action === 'browser.type' ? 'type' : 'click', 'approval-required', 'Prepared as a visual mutation; waiting for approval.'));
      return this.buildSnapshot({
        input,
        action,
        sourceSurface,
        status: 'approval-required',
        domain,
        sidecarConfigured,
        sidecarUsed,
        sidecarError,
        computerUsed,
        receipts,
        visualReceipts,
      });
    }

    if (BROWSER_ACTIONS.has(action) && action !== 'browser.cdp.status') {
      if (!sidecarConfigured) {
        receipts.push(receipt('sidecar', input.live ? 'blocked' : 'skipped', 'CDP/Playwright browser sidecar is not configured; returning preview capability metadata.'));
      } else if (input.live) {
        const live = await this.tryBrowserSidecar(action, input);
        sidecarUsed = live.used;
        sidecarError = live.error;
        receipts.push(receipt('sidecar', live.error ? 'blocked' : 'done', live.error || `Browser sidecar executed ${action}.`));
      }
      const visualKind = visualKindForAction(action);
      if (visualKind) {
        visualReceipts.push(visualReceipt(visualKind, sidecarUsed ? 'ready' : input.live ? 'blocked' : 'skipped', sidecarUsed ? `Visual interaction receipt recorded for ${action}.`
          : `Visual interaction prepared for ${action}.`));
      }
    }

    if (COMPUTER_ACTIONS.has(action)) {
      const computerAction = action as 'computer.observe' | 'computer.plan' | 'computer.cancel';
      const computer = await this.computer.execute({
        action: computerAction,
        objective: input.objective || input.text || null,
        targetWindow: input.targetWindow || null,
        targetKind: input.targetKind || 'unknown',
        approvalId: input.approvalId || null,
        sourceSurface,
        actorId: input.actorId || null,
        live: input.live === true,
      });
      computerUsed = computer.watchMode.used || computer.plan.steps.length > 0;
      receipts.push(receipt('computer-use', computer.status === 'blocked' ? 'blocked' : computer.plan.approvalRequired ? 'approval-required' : 'done', computer.policy.reason));
      visualReceipts.push(visualReceipt('computer-use', computer.status === 'blocked' ? 'blocked' : computer.plan.approvalRequired ? 'approval-required' : 'ready', computer.nextSafeAction));
    }

    const status = this.resolveStatus({
      action,
      sidecarConfigured,
      sidecarError,
      sidecarUsed,
      input,
      computerUsed,
    });

    receipts.push(receipt('policy', status === 'blocked' ? 'blocked' : status === 'approval-required' ? 'approval-required' : 'done', this.policyReason(status, action, sidecarConfigured)));

    return this.buildSnapshot({
      input,
      action,
      sourceSurface,
      status,
      domain,
      sidecarConfigured,
      sidecarUsed,
      sidecarError,
      computerUsed,
      receipts,
      visualReceipts,
    });
  }

  public formatSnapshotText(snapshot: ZavorthNativeBrowserComputerUseSnapshot): string {
    return [
      'Zavorth Native Browser + Computer Use',
      '',
      `Status: ${snapshot.status}`,
      `Action: ${snapshot.action}`,
      `Target: ${snapshot.target.url || snapshot.target.targetWindow || 'none'}`,
      `Domain policy: ${snapshot.target.domainPolicy}`,
      `Sidecar: configured=${snapshot.sidecar.cdpPlaywrightConfigured} used=${snapshot.sidecar.cdpPlaywrightUsed}`,
      `Computer use: available=${snapshot.computerUse.available} used=${snapshot.computerUse.used}`,
      '',
      'Native actions:',
      '- browser navigate / screenshot / click / type / extract',
      '- computer observe / plan / cancel',
      '- click and type require approval',
      '- visual receipts are emitted for browser and computer interactions',
      '',
      `Next: ${snapshot.nextSafeAction}`,
    ].join('\n');
  }

  private async tryBrowserSidecar(
    action: ZavorthNativeBrowserComputerUseAction,
    input: ZavorthNativeBrowserComputerUseInput,
  ): Promise<{ used: boolean; error: string | null }> {
    const sidecarAction = mapSidecarAction(action);
    if (!sidecarAction) {
      return { used: false, error: null };
    }
    try {
      await this.sidecar.execute({
        action: sidecarAction,
        args: buildSidecarArgs(action, input),
        timeoutMs: input.timeoutMs || 30_000,
      });
      return { used: true, error: null };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth Native Browser Computer Use] process execution failed', error);
    return {
        used: false,
        error: error instanceof Error ? err.message : String(error),
      };
  }
  }

  private async evaluateDomain(input: ZavorthNativeBrowserComputerUseInput): Promise<DomainDecision> {
    const url = String(input.url || '').trim();
    if (!url) {
      return {
        policy: 'unknown',
        decision: 'preview-only',
        reason: 'No browser URL was provided; domain policy remains preview-only.',
        origin: null,
        blocked: false,
      };
    }
    try {
      const parsed = input.allowPrivateEgress === true
        ? new URL(url)
        : await assertPublicHttpTargetAllowed(url, {
          serviceName: 'Native browser target',
        });
      const host = parsed.hostname.toLowerCase();
      if (/(bank|paypal|stripe|checkout|wallet|auth|login|account|password|mfa|otp)/u.test(host)) {
        return {
          policy: 'approval-required',
          decision: 'require-owner-approval',
          reason: `Sensitive site category detected for ${parsed.origin}; browser mutation requires approval.`,
          origin: parsed.origin,
          blocked: false,
        };
      }
      return {
        policy: 'public-read',
        decision: 'allow-read',
        reason: `Public HTTP target allowed: ${parsed.origin}.`,
        origin: parsed.origin,
        blocked: false,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth Native Browser Computer Use] network request failed', error);
    return {
        policy: 'blocked',
        decision: 'deny',
        reason: error instanceof Error ? err.message : String(error),
        origin: null,
        blocked: true,
      };
  }
  }

  private resolveStatus(input: {
    action: ZavorthNativeBrowserComputerUseAction;
    sidecarConfigured: boolean;
    sidecarUsed: boolean;
    sidecarError: string | null;
    input: ZavorthNativeBrowserComputerUseInput;
    computerUsed: boolean;
  }): ZavorthNativeBrowserComputerUseStatus {
    if (input.sidecarError) {
      return 'blocked';
    }
    if (MUTATING_BROWSER_ACTIONS.has(input.action) && !input.input.approvalId) {
      return 'approval-required';
    }
    if (BROWSER_ACTIONS.has(input.action) && input.action !== 'browser.cdp.status' && input.input.live && !input.sidecarConfigured) {
      return 'needs-configuration';
    }
    if (input.sidecarUsed || input.computerUsed || input.sidecarConfigured) {
      return 'ready';
    }
    return 'preview';
  }

  private policyReason(
    status: ZavorthNativeBrowserComputerUseStatus,
    action: ZavorthNativeBrowserComputerUseAction,
    sidecarConfigured: boolean,
  ): string {
    if (status === 'approval-required') {
      return `${action} requires approval before visual mutation.`;
    }
    if (status === 'needs-configuration') {
      return 'Configure ZAVORTH_BROWSER_SIDECAR_URL or start npm run browser:sidecar for live browser actions.';
    }
    if (status === 'blocked') {
      return 'Native browser/computer-use action was blocked by policy or sidecar error.';
    }
    if (sidecarConfigured) {
      return 'CDP/Playwright sidecar is configured; safe live actions can produce receipts.';
    }
    return 'Native browser/computer-use is available in preview mode until sidecar/watch-mode is configured.';
  }

  private buildSnapshot(input: {
    input: ZavorthNativeBrowserComputerUseInput;
    action: ZavorthNativeBrowserComputerUseAction;
    sourceSurface: string;
    status: ZavorthNativeBrowserComputerUseStatus;
    domain: DomainDecision;
    sidecarConfigured: boolean;
    sidecarUsed: boolean;
    sidecarError: string | null;
    computerUsed: boolean;
    receipts: ZavorthNativeBrowserComputerUseReceipt[];
    visualReceipts: ZavorthNativeBrowserComputerUseSnapshot['visualReceipts'];
  }): ZavorthNativeBrowserComputerUseSnapshot {
    const generatedAt = this.now().toISOString();
    return {
      contractVersion: ZAVORTH_NATIVE_BROWSER_COMPUTER_USE_CONTRACT_VERSION,
      generatedAt,
      source: 'ZavorthNativeBrowserComputerUseService',
      status: input.status,
      action: input.action,
      target: {
        url: input.input.url || null,
        origin: input.domain.origin,
        domainPolicy: input.domain.policy,
        selector: input.input.selector || null,
        targetWindow: input.input.targetWindow || null,
        sourceSurface: input.sourceSurface,
      },
      sidecar: {
        cdpPlaywrightConfigured: input.sidecarConfigured,
        cdpPlaywrightUsed: input.sidecarUsed,
        runtime: input.sidecarConfigured ? 'browser-sidecar' : 'preview-only',
        supportedActions: ['navigate', 'screenshot', 'click', 'type', 'extract'],
        error: input.sidecarError,
      },
      computerUse: {
        adapter: 'ComputerUseAgent',
        controlPlane: 'ZavorthComputerControlPlaneService',
        available: true,
        used: input.computerUsed,
        targetKind: input.input.targetKind || 'unknown',
      },
      policy: {
        decision: input.domain.decision === 'deny'
          ? 'deny'
          : input.status === 'approval-required'
            ? 'require-owner-approval'
            : input.status === 'preview'
              ? 'preview-only'
              : 'allow-read',
        reason: this.policyReason(input.status, input.action, input.sidecarConfigured),
        clickTypeSubmitRequireApproval: true,
        policyByDomainOrSite: true,
        privateNetworkBlockedByDefault: true,
        browserReceiptsRequired: true,
        visualReceiptsRequired: true,
      },
      visualReceipts: input.visualReceipts,
      capabilities: buildCapabilities(input.sidecarConfigured, input.status),
      receipts: input.receipts,
      safety: {
        cdpPlaywrightRunsInSidecar: true,
        screenshotClickTypeExtractAreNative: true,
        computerUseAdapterIsGoverned: true,
        noClickOrTypeWithoutApproval: true,
        noPrivateNetworkByDefault: true,
        noSecretsSerialized: true,
        receiptsForVisualInteractions: true,
        liveActionNotFaked: true,
      },
      commands: {
        status: 'zavorth native browser status',
        sidecar: 'npm run browser:sidecar',
        browser: 'npm run zavorth:native-browser-computer-use -- --action browser.extract --url <url>',
        computer: 'npm run zavorth:native-browser-computer-use -- --action computer.plan',
      },
      nextSafeAction: buildNextSafeAction(input.status, input.action, input.sidecarConfigured),
    };
  }
}

function normalizeAction(value: unknown): ZavorthNativeBrowserComputerUseAction {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'status' || normalized === 'native.status') return 'native.status';
  if (normalized === 'cdp' || normalized === 'browser.status' || normalized === 'browser.cdp.status') return 'browser.cdp.status';
  if (normalized === 'navigate' || normalized === 'browser.navigate') return 'browser.navigate';
  if (normalized === 'screenshot' || normalized === 'browser.screenshot') return 'browser.screenshot';
  if (normalized === 'click' || normalized === 'browser.click') return 'browser.click';
  if (normalized === 'type' || normalized === 'browser.type') return 'browser.type';
  if (normalized === 'extract' || normalized === 'browser.extract') return 'browser.extract';
  if (normalized === 'observe' || normalized === 'computer.observe') return 'computer.observe';
  if (normalized === 'plan' || normalized === 'computer.plan') return 'computer.plan';
  if (normalized === 'cancel' || normalized === 'computer.cancel') return 'computer.cancel';
  return 'native.status';
}

function mapSidecarAction(action: ZavorthNativeBrowserComputerUseAction): RuntimeBrowserSidecarAction | null {
  switch (action) {
    case 'browser.navigate':
      return 'browser_navigate';
    case 'browser.screenshot':
      return 'browser_screenshot';
    case 'browser.click':
      return 'browser_click';
    case 'browser.type':
      return 'browser_type';
    case 'browser.extract':
      return 'browser_extract';
    default:
      return null;
  }
}

function buildSidecarArgs(
  action: ZavorthNativeBrowserComputerUseAction,
  input: ZavorthNativeBrowserComputerUseInput,
): Record<string, unknown> {
  return {
    url: input.url || undefined,
    selector: input.selector || undefined,
    text: action === 'browser.type' ? input.text || '' : undefined,
    approvalId: input.approvalId || undefined,
    approved: Boolean(input.approvalId),
  };
}

function buildCapabilities(
  sidecarConfigured: boolean,
  status: ZavorthNativeBrowserComputerUseStatus,
): ZavorthNativeBrowserComputerUseCapability[] {
  return [
    {
      id: 'browser-cdp-playwright-sidecar',
      label: 'CDP/Playwright sidecar',
      runtime: 'cdp-playwright-sidecar',
      status: sidecarConfigured ? 'available' : 'needs-configuration',
      actions: ['browser.navigate', 'browser.screenshot', 'browser.click', 'browser.type', 'browser.extract'],
      requiresApprovalForMutation: true,
      receiptKinds: ['sidecar', 'browser', 'visual', 'policy'],
    },
    {
      id: 'computer-use-adapter',
      label: 'Computer use adapter',
      runtime: 'computer-use-adapter',
      status: status === 'blocked' ? 'blocked' : 'available',
      actions: ['computer.observe', 'computer.plan', 'computer.cancel'],
      requiresApprovalForMutation: true,
      receiptKinds: ['computer-use', 'visual', 'policy'],
    },
    {
      id: 'browser-domain-policy',
      label: 'Policy by domain/site',
      runtime: 'policy-kernel',
      status: 'available',
      actions: ['native.status', 'browser.cdp.status'],
      requiresApprovalForMutation: true,
      receiptKinds: ['domain-policy', 'policy'],
    },
  ];
}

function receipt(
  kind: ZavorthNativeBrowserComputerUseReceipt['kind'],
  status: ZavorthNativeBrowserComputerUseReceipt['status'],
  summary: string,
): ZavorthNativeBrowserComputerUseReceipt {
  return {
    id: `native-browser-computer-${kind}-${crypto.createHash('sha256').update(`${kind}:${status}:${summary}`).digest('hex').slice(0, 12)}`,
    kind,
    status,
    summary,
    rawSecretSerialized: false,
  };
}

function visualReceipt(
  kind: ZavorthNativeBrowserComputerUseSnapshot['visualReceipts'][number]['kind'],
  status: ZavorthNativeBrowserComputerUseSnapshot['visualReceipts'][number]['status'],
  summary: string,
): ZavorthNativeBrowserComputerUseSnapshot['visualReceipts'][number] {
  return {
    id: `visual-${kind}-${crypto.createHash('sha256').update(`${kind}:${status}:${summary}`).digest('hex').slice(0, 10)}`,
    kind,
    status,
    summary,
    redacted: true,
  };
}

function visualKindForAction(
  action: ZavorthNativeBrowserComputerUseAction,
): ZavorthNativeBrowserComputerUseSnapshot['visualReceipts'][number]['kind'] | null {
  if (action === 'browser.screenshot') return 'screenshot';
  if (action === 'browser.click') return 'click';
  if (action === 'browser.type') return 'type';
  if (action === 'browser.extract') return 'extract';
  return null;
}

function buildNextSafeAction(
  status: ZavorthNativeBrowserComputerUseStatus,
  action: ZavorthNativeBrowserComputerUseAction,
  sidecarConfigured: boolean,
): string {
  if (status === 'approval-required') {
    return `Approve the scoped ${action} plan before live visual mutation.`;
  }
  if (!sidecarConfigured && BROWSER_ACTIONS.has(action)) {
    return 'Start npm run browser:sidecar and set ZAVORTH_BROWSER_SIDECAR_URL for live browser control.';
  }
  if (status === 'blocked') {
    return 'Inspect the policy receipt and choose a safer public-read target.';
  }
  return 'Use browser.extract or computer.plan with approval gates for the next governed interaction.';
}

function disabledSidecar(): Pick<RuntimeBrowserSidecarService, 'execute' | 'isConfigured'> {
  return {
    isConfigured: () => false,
    execute: async () => {
      throw new Error('Browser sidecar is disabled.');
    },
  };
}
