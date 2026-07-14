import { DesktopAutomationTool } from '../../tools/DesktopAutomationTool.js';
import type {
  SystemOverlordAdapterResult,
  SystemOverlordRuntimeAdapter,
} from '../../contracts/SystemOverlordAdapterContract.js';
import type {
  SystemOverlordActionRequest,
  SystemOverlordCapabilityDecision,
} from '../../contracts/SystemOverlordContract.js';
import { decideSecurityPolicy } from '../../security/SecurityPolicyBroker.js';
import {
  OperatorContinuityKernel,
  decisionFromBroker,
  digestOperatorPayload,
  resultFromToolOutcome,
  type OperatorContinuityEnvelope,
} from '../../runtime/operator/OperatorContinuityEnvelope.js';
import { numberField, readStructuredInput, stringField } from './SupervisedAdapterInput.js';

type DesktopToolLike = Pick<DesktopAutomationTool, 'execute'>;

const ALLOWED_DESKTOP_ACTIONS = new Set([
  'focus-window',
  'click-element',
  'type-text',
  'press-key',
  'screenshot',
  'list-elements',
]);

const READ_ONLY_DESKTOP_ACTIONS = new Set([
  'focus-window',
  'screenshot',
  'list-elements',
]);

export class SupervisedDesktopAutomationAdapter implements SystemOverlordRuntimeAdapter {
  public readonly id = 'desktop-automation-supervised';
  public readonly label = 'Desktop Automation Supervision Adapter';
  private readonly tool: DesktopToolLike;
  private readonly platform: NodeJS.Platform;
  private readonly continuityKernel: OperatorContinuityKernel;
  private lastContinuityEnvelope: OperatorContinuityEnvelope | null = null;

  constructor(options: {
    desktopTool?: DesktopToolLike;
    platform?: NodeJS.Platform;
    continuityKernel?: OperatorContinuityKernel;
  } = {}) {
    this.tool = options.desktopTool || new DesktopAutomationTool();
    this.platform = options.platform || process.platform;
    this.continuityKernel = options.continuityKernel || new OperatorContinuityKernel();
  }

  public getLastContinuityEnvelope(): OperatorContinuityEnvelope | null {
    return this.lastContinuityEnvelope;
  }

  public canHandle(
    request: SystemOverlordActionRequest,
    decision: SystemOverlordCapabilityDecision,
  ): boolean {
    return request.capability === 'desktop.automation' && decision.runtimeTarget === 'desktop';
  }

  public async execute(
    request: SystemOverlordActionRequest,
    decision: SystemOverlordCapabilityDecision,
  ): Promise<SystemOverlordAdapterResult> {
    if (this.platform !== 'win32') {
      return {
        ok: false,
        errorCode: 'desktop_windows_required',
        errorMessage: 'Supervised DesktopAutomationTool requires Windows UIAutomation.',
      };
    }

    const input = readStructuredInput(request.command, request.metadata || null);
    const action = stringField(input, 'action', 'desktopAction');
    const windowTitle = stringField(input, 'windowTitle', 'targetWindow', 'window');
    const targetText = stringField(input, 'targetText', 'target', 'elementText');
    const payload = stringField(input, 'payload', 'text', 'keys');
    const processId = numberField(input, 'processId', 'pid');

    const validationError = this.validateAction(action, windowTitle, processId, targetText, payload);
    if (validationError) {
      return {
        ok: false,
        errorCode: 'desktop_action_rejected',
        errorMessage: validationError,
      };
    }

    if (!READ_ONLY_DESKTOP_ACTIONS.has(action) && !request.approved) {
      return {
        ok: false,
        errorCode: 'desktop_action_approval_required',
        errorMessage: `Desktop action "${action}" requires explicit approval.`,
      };
    }

    const readOnly = READ_ONLY_DESKTOP_ACTIONS.has(action);
    const toolArgs = {
      action,
      windowTitle,
      targetText,
      payload,
      processId: processId || undefined,
    };
    const sealed = await this.continuityKernel.runMutation({
      request: {
        surface: 'desktop-automation',
        operation: readOnly ? 'desktop.observe' : 'desktop.mutate',
        target: action,
        actorId: String(request.metadata?.actorId || '').trim() || null,
        sourceSurface: String(request.metadata?.sourceSurface || 'system-overlord').trim() || 'system-overlord',
        argsDigest: digestOperatorPayload({
          action,
          windowTitle: windowTitle || null,
          processId: processId || null,
          hasTargetText: Boolean(targetText),
          payloadLength: payload ? payload.length : 0,
        }),
        metadata: {
          adapterId: this.id,
          approved: request.approved === true,
          runtimeTarget: decision.runtimeTarget,
        },
      },
      decide: () => decisionFromBroker(decideSecurityPolicy({
        surface: 'desktop-automation',
        operation: readOnly ? 'desktop.observe' : 'desktop.mutate',
        target: action,
        sourceTrust: 'trusted-user',
        metadata: {
          adapterId: this.id,
          approved: request.approved === true,
          windowTitle: windowTitle || null,
        },
        toolDecision: {
          action: 'allow',
          allowed: true,
          risk: readOnly ? 'safe' : 'review',
          toolName: 'desktop_automation',
          surface: 'native-tool',
          capabilities: readOnly ? ['desktop', 'local-observation'] : ['desktop'],
          requiresConfirmation: false,
          reasons: [
            readOnly
              ? 'Supervised desktop observation is sealed by operator continuity.'
              : 'Supervised desktop mutation was approved and sealed by operator continuity.',
          ],
          rule: 'SUPERVISED_DESKTOP_CONTINUITY',
        },
        reasons: [
          'Supervised desktop automation execution was sealed by the operator continuity kernel.',
        ],
      })),
      execute: async () => this.tool.execute(toolArgs),
      mapResult: (output) => {
        const failed = /^(error|failed)\b/i.test(String(output || '').trim());
        return resultFromToolOutcome({
          ok: !failed,
          status: failed ? 'failed' : (readOnly ? 'observation' : 'applied'),
          summary: failed
            ? `Desktop action "${action}" failed.`
            : `Desktop action "${action}" completed.`,
          output,
          data: { action, adapterId: this.id },
        });
      },
    });

    this.lastContinuityEnvelope = sealed.envelope;
    const publicView = this.continuityKernel.toPublicView(sealed.envelope);

    if (sealed.value === undefined) {
      return {
        ok: false,
        errorCode: 'desktop_action_policy_blocked',
        errorMessage: sealed.envelope.result?.summary
          || sealed.envelope.decision?.reasons.join(' ')
          || `Desktop action "${action}" blocked by continuity policy.`,
        metadata: {
          adapterId: this.id,
          action,
          operatorContinuity: publicView,
        },
      };
    }

    const result = sealed.value;
    const ok = !/^(error|failed)\b/i.test(String(result || '').trim());

    return {
      ok,
      stdout: ok ? result : null,
      stderr: ok ? null : result,
      errorCode: ok ? null : 'desktop_tool_failed',
      errorMessage: ok ? null : result,
      rollbackAvailable: false,
      metadata: {
        adapterId: this.id,
        action,
        windowTitle: windowTitle || null,
        processId: processId || null,
        targetText: targetText || null,
        runtimeTarget: decision.runtimeTarget,
        operatorContinuity: publicView,
      },
    };
  }

  private validateAction(
    action: string,
    windowTitle: string,
    processId: number | null,
    targetText: string,
    payload: string,
  ): string | null {
    if (!ALLOWED_DESKTOP_ACTIONS.has(action)) {
      return `Invalid or unsupervised desktop action: "${action || 'n/a'}".`;
    }
    if (!windowTitle && !processId) {
      return 'Provide windowTitle or processId to scope desktop automation.';
    }
    if (action === 'click-element' && !targetText) {
      return 'click-element requires targetText.';
    }
    if ((action === 'type-text' || action === 'press-key') && !payload) {
      return `${action} requires payload.`;
    }
    if (action === 'type-text' && payload.length > 500) {
      return 'type-text is limited to 500 characters per supervised action.';
    }
    if (action === 'press-key' && !/^[\^%+{}A-Za-z0-9_\-\s]+$/.test(payload)) {
      return 'press-key received a payload outside the safe SendKeys format.';
    }
    return null;
  }
}
