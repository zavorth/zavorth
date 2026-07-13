import { WebSurfaceProjector } from './WebSurfaceProjector.js';
import type { SurfaceProjectorInput, SurfaceProjectorOutput } from './SurfaceProjectorContract.js';
import { SURFACE_PROJECTOR_CONTRACT_VERSION } from './SurfaceProjectorContract.js';

export type DesktopShortcut = {
  key: string;
  optionId: string;
  label: string;
  choice?: string | null;
  callbackData?: string | null;
  command?: string | null;
};

export type DesktopCopyTarget = {
  id: string;
  label: string;
  value: string;
};

/**
 * F5c — Desktop rich controls: shortcuts 1–9, copy targets, receipt open.
 * Shell owns real UI; projector supplies a structured payload.
 */
export class DesktopSurfaceProjector extends WebSurfaceProjector {
  public override readonly channel = 'desktop';

  public override project(input: SurfaceProjectorInput): SurfaceProjectorOutput {
    const base = super.project(input);
    const actions = input.response.actions || [];
    const meta = (input.response.metadata || {}) as Record<string, unknown>;
    const approvalId = String(meta.approvalId || '').trim();

    const shortcuts: DesktopShortcut[] = actions.slice(0, 9).map((action, index) => {
      const key = String(index + 1);
      const choice = extractChoiceFromAction(action.id, action.callbackData, action.command);
      return {
        key,
        optionId: action.id,
        label: action.label,
        choice,
        callbackData: action.callbackData ?? null,
        command: action.command ?? null,
      };
    });

    const copyTargets: DesktopCopyTarget[] = [];
    if (approvalId) {
      copyTargets.push({
        id: 'approvalId',
        label: 'Copy approval id',
        value: approvalId,
      });
    }
    for (const action of actions) {
      if (action.callbackData) {
        copyTargets.push({
          id: `callback:${action.id}`,
          label: `Copy ${action.label}`,
          value: action.callbackData,
        });
      }
    }

    const receiptHref =
      actions.find((a) => a.kind === 'url' && a.href)?.href ||
      (typeof meta.receiptUrl === 'string' ? meta.receiptUrl : null) ||
      (typeof meta.receiptHref === 'string' ? meta.receiptHref : null);

    const openReceipt = receiptHref
      ? { label: 'Open receipt', href: receiptHref }
      : approvalId
        ? { label: 'Open receipt', approvalId }
        : null;

    return {
      ...base,
      contractVersion: SURFACE_PROJECTOR_CONTRACT_VERSION,
      channel: 'desktop',
      replyOptions: {
        ...(base.replyOptions || {}),
        surface: 'desktop',
        keyboardShortcuts: true,
        shortcuts,
        copyTargets: copyTargets.slice(0, 8),
        openReceipt,
        surfaceActions: actions,
        surfaceResponseId: input.response.id,
        intent: input.response.intent,
        approvalId: approvalId || null,
        ephemeralSupported: true,
      },
      usedNativeButtons: actions.length > 0,
    };
  }
}

function extractChoiceFromAction(
  id: string,
  callbackData?: string | null,
  command?: string | null,
): string | null {
  const blob = `${id} ${callbackData || ''} ${command || ''}`.toLowerCase();
  for (const choice of ['once', 'session', 'always', 'deny'] as const) {
    if (blob.includes(choice) || blob.includes(`perm-${choice}`)) {
      return choice;
    }
  }
  if (blob.includes('reject')) return 'deny';
  if (blob.includes('approve')) return 'once';
  return null;
}
