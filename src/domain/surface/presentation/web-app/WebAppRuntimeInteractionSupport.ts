import * as http from 'http';
import type { HybridMemoryRecallInput, HybridMemoryRecallResult, HybridMemorySourcesResult } from '../../../../contracts/HybridMemoryContract.js';

import type { WebAppRuntimeRouteDeps } from './WebAppRuntimeRouteService.js';
type RuntimeRecord = Record<string, unknown>;
type WebSessionContext = RuntimeRecord & {
  userId: string;
  sessionId: string;
  chatId?: string | null;
};

type UiSurfaceHintsInput = {
  localControlEntry: string;
  localControlReady: boolean;
  telegramReady: boolean;
  discordReady: boolean;
  cliReady: boolean;
};

export type WebAppRuntimeStateRouteHelpers = {
  buildSessionContext: (sessionId: string) => WebSessionContext;
  isFullDetailRequested: (url: URL) => boolean;
  previewGatewayMemoryRecall: (input: HybridMemoryRecallInput) => Promise<HybridMemoryRecallResult>;
  listGatewayMemorySources: (input: Pick<HybridMemoryRecallInput, 'sessionId' | 'chatId' | 'userId' | 'platform' | 'workspaceHint'>) => Promise<HybridMemorySourcesResult>;
  buildRecallQueryFromSnapshot: (snapshot: RuntimeRecord | null | undefined) => string;
  buildLightweightStateResponse: (state: RuntimeRecord) => RuntimeRecord;
  buildProductMode: () => RuntimeRecord | null;
  buildUiSurfaceHints: (productMode: RuntimeRecord | null, input: UiSurfaceHintsInput) => RuntimeRecord | null;
  buildCanonicalStatePayload: (sessionId: string, options: RuntimeRecord) => Promise<RuntimeRecord>;
  isCanonicalSessionPlaneRoute: (pathname: string) => boolean;
};

import type { WebAppRuntimeStateRouteService } from './WebAppRuntimeStateRouteService.js';

export class WebAppRuntimeInteractionSupport {
  public constructor(private readonly owner: WebAppRuntimeStateRouteService) {}

  public async handleZavorthControlActionRequest(req: http.IncomingMessage, res: http.ServerResponse, deps: WebAppRuntimeRouteDeps): Promise<void> {
    if (!deps.publicApi) {
      deps.writeJson(
        res,
        {
          ok: false,
          error: 'canonical_public_api_unavailable',
          detail: 'ZavorthControl action wiring requires the runtime API v1 service.',
        },
        503,
      );
      return;
    }

    const body = await deps.readJsonBody(req);
    const action = String(body?.action || body?.kind || '')
      .trim()
      .toLowerCase();
    const requestedBy = String(body?.requestedBy || 'control-ui').trim() || 'control-ui';
    let result: RuntimeRecord;

    switch (action) {
      case 'approval.approve':
      case 'approval.approve_once':
      case 'approve':
        result = (await deps.publicApi.approveApproval({
          approvalId: String(body?.approvalId || body?.id || '').trim(),
          decidedBy: requestedBy,
          note: String(body?.note || body?.reason || '').trim() || null,
        })) as RuntimeRecord;
        break;
      case 'approval.deny':
      case 'approval.reject':
      case 'deny':
      case 'reject':
        result = (await deps.publicApi.denyApproval({
          approvalId: String(body?.approvalId || body?.id || '').trim(),
          decidedBy: requestedBy,
          reason: String(body?.reason || body?.note || '').trim() || null,
        })) as RuntimeRecord;
        break;
      case 'mission.cancel':
      case 'cancel':
        result = (await deps.publicApi.cancelMission({
          missionId: String(body?.missionId || body?.id || '').trim(),
          requestedBy,
          reason: String(body?.reason || body?.note || '').trim() || null,
        })) as RuntimeRecord;
        break;
      case 'provider.test':
        result = (await deps.publicApi.testProvider({
          providerId: String(body?.providerId || body?.id || '').trim(),
          live: body?.live === true,
          approved: body?.approved === true || body?.confirmed === true,
        })) as RuntimeRecord;
        break;
      case 'channel.action':
        result = (await deps.publicApi.executeChannelAction({
          channelId: String(body?.channelId || body?.id || '').trim(),
          actionId: String(body?.actionId || '').trim(),
          requestedBy,
          approved: body?.approved === true || body?.confirmed === true,
        })) as RuntimeRecord;
        break;
      default:
        deps.writeJson(
          res,
          {
            ok: false,
            error: 'unsupported_command_center_action',
            detail: 'Use approval.approve, approval.deny, mission.cancel, provider.test or channel.action.',
            safety: {
              controllerMutatedDirectly: false,
              zavorthControlCanExecute: false,
              policyBrokerRequiredForMutableActions: true,
            },
          },
          400,
        );
        return;
    }

    deps.writeJson(
      res,
      {
        ok: result.ok !== false,
        generatedAt: new Date().toISOString(),
        action,
        result,
        safety: {
          controllerMutatedDirectly: false,
          delegatedToRuntimeApiV1: true,
          zavorthControlCanExecute: false,
          policyBrokerRequiredForMutableActions: true,
          rawSecretsSerialized: false,
        },
      },
      200,
    );
  }

  public async handleZavorthControlChatRequest(req: http.IncomingMessage, res: http.ServerResponse, deps: WebAppRuntimeRouteDeps): Promise<void> {
    if (!deps.processChatSend && !deps.publicApi) {
      deps.writeJson(
        res,
        {
          ok: false,
          error: 'canonical_chat_runtime_unavailable',
          detail: 'ZavorthControl chat wiring requires the canonical web conversation runtime.',
        },
        503,
      );
      return;
    }

    const body = await deps.readJsonBody(req);
    const message = String(body?.message || body?.text || '').trim();
    if (!message) {
      deps.writeJson(
        res,
        {
          ok: false,
          error: 'empty_zavorthControl_message',
          detail: 'ZavorthControl chat requires a non-empty message.',
        },
        400,
      );
      return;
    }
    if (deps.processChatSend) {
      const requestMetadata = this.owner.isRecord(body?.metadata) ? body.metadata : {};
      const workflowIntent = this.owner.resolveMetadataRecord(body?.workflowIntent, requestMetadata.workflowIntent);
      const composerSettings = this.owner.resolveMetadataRecord(body?.composerSettings, requestMetadata.composerSettings);
      const experienceProfile = this.owner.resolveExperienceProfileMetadata(body?.experienceProfile, requestMetadata.experienceProfile);
      const result = await deps.processChatSend({
        ...body,
        message,
        source: 'zavorth-control',
        metadata: {
          ...requestMetadata,
          zavorthControlChat: true,
          ...(workflowIntent ? { workflowIntent } : {}),
          ...(composerSettings ? { composerSettings } : {}),
          ...(experienceProfile ? { experienceProfile } : {}),
        },
      });
      deps.writeJson(
        res,
        {
          ok: true,
          generatedAt: new Date().toISOString(),
          sessionId: result.sessionId,
          taskId: result.taskId || null,
          runId: result.taskId || null,
          chat: result,
          data: result,
          snapshot: result.snapshot,
          safety: {
            delegatedToCanonicalWebRuntime: true,
            zavorthControlCanExecute: false,
            policyBrokerRequiredForTools: true,
            rawSecretsSerialized: false,
          },
        },
        200,
      );
      return;
    }

    const publicApi = deps.publicApi;
    if (!publicApi) {
      deps.writeJson(
        res,
        {
          ok: false,
          error: 'canonical_public_api_unavailable',
          detail: 'ZavorthControl chat fallback requires the runtime API v1 service.',
        },
        503,
      );
      return;
    }

    const result = await publicApi.submitChat({
      message,
      sessionId: String(body?.sessionId || '').trim() || null,
      live: body?.live === true || body?.execute === true,
    });

    deps.writeJson(
      res,
      {
        ok: result.accepted,
        generatedAt: new Date().toISOString(),
        chat: result,
        data: result,
        mission: result.mission,
        safety: {
          delegatedToRuntimeApiV1: true,
          zavorthControlCanExecute: false,
          dryRunByDefault: true,
          liveRequiresExplicitFlag: true,
          policyBrokerRequiredForTools: true,
          rawSecretsSerialized: false,
        },
      },
      200,
    );
  }

  public async handleZavorthControlSideChatRequest(req: http.IncomingMessage, res: http.ServerResponse, deps: WebAppRuntimeRouteDeps): Promise<void> {
    if (!deps.processChatSend) {
      deps.writeJson(
        res,
        {
          ok: false,
          error: 'canonical_chat_runtime_unavailable',
          detail: 'Detached zavorthControl chat requires the canonical web conversation runtime.',
        },
        503,
      );
      return;
    }

    const body = await deps.readJsonBody(req);
    const message = String(body?.message || body?.text || '').trim();
    const kind =
      String(body?.kind || 'side')
        .trim()
        .toLowerCase() || 'side';
    const attachments = Array.isArray(body?.attachments) ? body.attachments : [];
    if (!message && attachments.length === 0) {
      deps.writeJson(
        res,
        {
          ok: false,
          error: 'empty_detached_message',
          detail: 'Detached side-channel messages need text or attachments.',
        },
        400,
      );
      return;
    }
    const sourceSessionId = String(body?.sessionId || '').trim();
    const sideSessionId = String(body?.sideSessionId || [sourceSessionId || 'web', kind.replace(/[^a-z0-9_-]/gi, '') || 'side', Date.now().toString(36)].filter(Boolean).join(':')).trim();
    const result = await deps.processChatSend({
      ...body,
      message: message || 'Review the attached files.',
      sessionId: sideSessionId,
      source: 'zavorth-control-side-channel',
      detached: true,
      excludeFromTranscript: true,
      parentSessionId: sourceSessionId || null,
      metadata: {
        ...(this.owner.isRecord(body?.metadata) ? body.metadata : {}),
        detachedSideChannel: true,
        sideChannelKind: kind,
        parentSessionId: sourceSessionId || null,
      },
    });

    deps.writeJson(
      res,
      {
        ok: true,
        generatedAt: new Date().toISOString(),
        detached: true,
        excludeFromTranscript: true,
        kind,
        sideSessionId,
        sourceSessionId: sourceSessionId || null,
        sessionId: sideSessionId,
        taskId: result.taskId || null,
        runId: result.taskId || null,
        chat: result,
        data: result,
        snapshot: result.snapshot,
        safety: {
          delegatedToCanonicalWebRuntime: true,
          detachedFromMainTranscript: true,
          parentTranscriptUntouched: true,
          sideSessionIsolated: true,
          rawSecretsSerialized: false,
        },
      },
      200,
    );
  }

  public async handleZavorthControlSteerChatRequest(req: http.IncomingMessage, res: http.ServerResponse, deps: WebAppRuntimeRouteDeps): Promise<void> {
    if (!deps.agentGateway?.steer) {
      deps.writeJson(
        res,
        {
          ok: false,
          error: 'native_agent_run_steering_unavailable',
          detail: 'Active-run steering requires ZavorthAgentGateway.steer.',
        },
        503,
      );
      return;
    }

    const body = await deps.readJsonBody(req);
    const message = String(body?.message || body?.text || '').trim();
    const sessionId = String(body?.sessionId || '').trim();
    const runId = String(body?.runId || body?.activeRunId || '').trim();
    const action = ['cancel', 'replace'].includes(
      String(body?.action || body?.steerAction || '')
        .trim()
        .toLowerCase(),
    )
      ? (String(body?.action || body?.steerAction)
          .trim()
          .toLowerCase() as 'cancel' | 'replace')
      : 'add';
    if (!sessionId) {
      deps.writeJson(
        res,
        {
          ok: false,
          error: 'session_id_required',
          detail: 'Active-run steering requires the current canonical session id.',
        },
        400,
      );
      return;
    }
    const attachments = Array.isArray(body?.attachments) ? body.attachments : [];
    if (action !== 'cancel' && !message && attachments.length === 0) {
      deps.writeJson(
        res,
        {
          ok: false,
          error: 'empty_steer_message',
          detail: 'Steering requires text or attachments.',
        },
        400,
      );
      return;
    }
    if (action !== 'add' && !String(body?.steeringId || body?.replaceTargetId || body?.queueItemId || '').trim()) {
      deps.writeJson(
        res,
        {
          ok: false,
          error: 'steering_id_required',
          detail: 'Cancel/replace steering requires a steering id or queue item id.',
        },
        400,
      );
      return;
    }

    const result = deps.agentGateway.steer({
      action,
      runId: runId || null,
      sessionId,
      source: 'zavorth-control-steer',
      text: message || (action === 'cancel' ? 'Cancelled by operator.' : 'Review the attached files.'),
      queueItemId: String(body?.queueItemId || '').trim() || null,
      steeringId: String(body?.steeringId || '').trim() || null,
      replaceTargetId: String(body?.replaceTargetId || '').trim() || null,
      backoffMs: Number(body?.backoffMs || 0),
      maxAttempts: Number(body?.maxAttempts || 1),
      metadata: {
        ...(this.owner.isRecord(body?.metadata) ? body.metadata : {}),
        activeRunSteer: true,
        nativeAgentRunSteering: true,
        steerTargetRunId: runId || null,
        action,
        attachments,
        selectedSkills: Array.isArray(body?.selectedSkills) ? body.selectedSkills : [],
        voice: this.owner.isRecord(body?.voice) ? body.voice : null,
        composerSettings: this.owner.isRecord(body?.composerSettings) ? body.composerSettings : null,
      },
    });
    if (!result.ok) {
      deps.writeJson(
        res,
        {
          ok: false,
          generatedAt: new Date().toISOString(),
          steered: false,
          action,
          error: result.error || 'steering_not_accepted',
          runId: result.run?.id || runId || null,
          sessionId,
          run: result.run,
          safety: {
            delegatedToNativeAgentGateway: true,
            nativeAgentRunSteering: true,
            rawSecretsSerialized: false,
          },
        },
        result.error === 'active_run_not_found' ? 404 : 409,
      );
      return;
    }

    deps.writeJson(
      res,
      {
        ok: true,
        generatedAt: new Date().toISOString(),
        steered: true,
        action,
        ack: result.ack,
        steering: result.steering,
        runId: result.run?.id || runId || null,
        sessionId,
        run: result.run,
        chat: result,
        data: result,
        snapshot: {
          activeRun: result.run,
          runs: result.run ? [result.run] : [],
          steering: result.run?.steering || [],
        },
        safety: {
          delegatedToNativeAgentGateway: true,
          nativeAgentRunSteering: true,
          transcriptScope: 'active-session',
          rawSecretsSerialized: false,
        },
      },
      200,
    );
  }
}
