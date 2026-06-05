import { shouldHandleBusinessAuditFlow, shouldHandleDeveloperReviewFlow, shouldHandlePersonalDayFlow } from './guided-flow-cards';
import { recommendCanvasForPrompt, requestNaturalEngineSwitch } from './runtime-engines-ui';
import { messageFromCaughtError } from './text-utils';

type SignalTransmitterOptions = {
  appendEcho: (role: string, text: string, logicCells?: string) => void;
  appendThinkingState: () => void;
  buildSentAttachmentCards: (files: any[]) => string;
  closeSkillPopover: () => void;
  composeInput: HTMLTextAreaElement | HTMLInputElement;
  generateCoreResponse: (text: string) => void;
  getCurrentModelRouteLabel: () => string;
  getComposerSettingsState: () => Record<string, any>;
  getLastVoiceInput: () => any;
  getPendingAttachments: () => any[];
  getPendingGuidedFlow: () => string;
  getPendingSelectedSkills: () => any[];
  getPendingWorkspaceSelection: () => any;
  getSelectedExperienceProfile: () => string;
  getExperienceProfilePayload: () => any;
  recordTraceEvent: (event: Record<string, unknown>) => void;
  refreshAttachmentHint: () => void;
  removeThinkingState: () => void;
  renderApprovals: (approvals: any[]) => boolean;
  renderArtifacts: (artifacts: any[]) => boolean;
  renderBusinessAuditFlow: (text: string) => void;
  renderDeveloperReviewFlow: (text: string, workspace: any) => void;
  renderDeveloperWorkspacePicker: (text: string) => void;
  renderPersonalDayFlow: (text: string) => void;
  resetLastVoiceInput: () => void;
  resetPendingAttachments: () => void;
  resetPendingGuidedFlow: () => void;
  resetPendingSelectedSkills: () => void;
  setSelectedExperienceProfile: (profile: string) => void;
  tokenCount: HTMLElement | null;
};

declare global {
  interface Window {
    ZavorthControlChat?: {
      setComposerRunState?: (state: 'idle' | 'running' | 'cancelling') => void;
    };
    ZavorthRuntimeBridge?: any;
    ZavorthRuntimeEngines?: {
      getActiveEngineId?: () => string;
      decidePrompt?: (prompt: string, options?: { operation?: string; targetPath?: string | null }) => Promise<any>;
      recommendCanvas?: (prompt: string, options?: { autoOpen?: boolean; reason?: string }) => Promise<boolean>;
      requestNaturalEngineSwitch?: (prompt: string) => Promise<boolean>;
    };
    emitSignal?: (type: string, title: string, detail: string) => void;
  }
}

export function createSignalTransmitter(options: SignalTransmitterOptions) {
  return async function transmitSignal() {
    const text = options.composeInput.value.trim();
    const pendingAttachments = options.getPendingAttachments();
    if (!text && pendingAttachments.length === 0) return false;

    const outboundAttachments = pendingAttachments.map((file, index) => ({
      id: file.id || `attachment:${index + 1}:${file.name}`,
      name: file.name,
      type: file.type,
      size: file.size,
      text: file.text || null,
      content: file.content || null,
      truncated: Boolean(file.truncated),
      extraction: file.extraction || null,
      media: file.media || null,
      source: 'zavorth-control-browser',
    }));
    const outboundText = text || 'Review the attached files.';
    const outboundSkills = options.getPendingSelectedSkills().slice(0, 8);
    const lastVoiceInput = options.getLastVoiceInput();
    const outboundVoice = lastVoiceInput ? { ...lastVoiceInput } : null;
    const outboundComposerSettings = { ...options.getComposerSettingsState() };
    const outboundExperienceProfile = options.getExperienceProfilePayload();
    const naturalEngineSwitchHandled = text
      ? await (window.ZavorthRuntimeEngines?.requestNaturalEngineSwitch?.(text) || requestNaturalEngineSwitch(text)).catch(() => false)
      : false;
    if (naturalEngineSwitchHandled) {
      options.composeInput.value = '';
      options.composeInput.style.height = 'auto';
      if (options.tokenCount) options.tokenCount.textContent = '0 tokens';
      const sendBtn = document.getElementById('send-btn');
      if (sendBtn) sendBtn.classList.remove('active');
      return true;
    }
    const engineDecision = await window.ZavorthRuntimeEngines?.decidePrompt?.(outboundText, {
      operation: outboundAttachments.length > 0 ? 'read' : undefined,
    }).catch(() => null);
    const selectedEngineId = engineDecision?.decision?.engineId || window.ZavorthRuntimeEngines?.getActiveEngineId?.();
    const canvasHint = canvasHintForRequest(outboundText, outboundAttachments);

    const terminalView = document.getElementById('terminal-view');
    if (terminalView && terminalView.classList.contains('is-empty')) {
      terminalView.classList.remove('is-empty');
    }

    options.recordTraceEvent({
      type: 'request',
      title: 'Request received',
      detail: outboundText,
      meta: [
        outboundAttachments.length ? `${outboundAttachments.length} file(s)` : '',
        outboundSkills.length ? `${outboundSkills.length} tool(s)` : '',
        outboundVoice ? 'voice' : '',
        outboundExperienceProfile?.id ? `profile:${outboundExperienceProfile.id}` : '',
        outboundComposerSettings.model && outboundComposerSettings.model !== 'auto' ? `model:${outboundComposerSettings.model}` : '',
        outboundComposerSettings.sensitivity && outboundComposerSettings.sensitivity !== 'default' ? `sens:${outboundComposerSettings.sensitivity}` : '',
      ].filter(Boolean).join(' - ') || 'chat',
      status: 'queued',
    });
    if (outboundExperienceProfile?.id) {
      options.recordTraceEvent({
        type: 'step',
        title: 'Experience profile applied',
        detail: `${outboundExperienceProfile.label}: ${outboundExperienceProfile.approvalTone}`,
        meta: outboundExperienceProfile.id,
        status: 'ready',
      });
    }
    if (engineDecision?.decision) {
      options.recordTraceEvent({
        type: 'step',
        title: engineDecision.decision.express ? 'Express mode' : `${engineDecision.decision.engineId} route`,
        detail: engineDecision.decision.nextSafeAction || engineDecision.decision.reason,
        meta: engineDecision.decision.mode,
        status: engineDecision.decision.status === 'needs-approval' ? 'waiting' : 'running',
      });
    }

    if (outboundAttachments.length > 0) {
      const mediaAttachments = outboundAttachments.filter((file) =>
        file.media?.kind === 'image' || file.media?.kind === 'audio' || file.media?.kind === 'video');
      options.recordTraceEvent({
        type: 'artifact',
        title: 'Attached context',
        detail: outboundAttachments.map((file) => file.name).join(', '),
        meta: mediaAttachments.length > 0
          ? `${mediaAttachments.length} media payload${mediaAttachments.length === 1 ? '' : 's'} ready`
          : 'compose attachment',
      });
      if (mediaAttachments.length > 0) {
        options.recordTraceEvent({
          type: 'step',
          title: 'Media understanding',
          detail: 'Image, audio, and video payloads will be sent to the backend for OCR, transcription, or media analysis.',
          meta: 'media.understand',
          status: 'queued',
        });
      }
    }
    if (outboundSkills.length > 0) {
      options.recordTraceEvent({
        type: 'step',
        title: 'Selected tools',
        detail: outboundSkills.map((skill) => skill.title || skill.id).join(', '),
        meta: 'tool exposure',
      });
    }

    options.appendEcho('operator', text || 'Review attached files', options.buildSentAttachmentCards(outboundAttachments));
    if (canvasHint.recommended) {
      const recommendCanvas = window.ZavorthRuntimeEngines?.recommendCanvas || recommendCanvasForPrompt;
      recommendCanvas(outboundText, {
        autoOpen: canvasHint.autoOpen,
        reason: canvasHint.reason,
      }).catch(() => undefined);
    }
    options.composeInput.value = '';
    options.composeInput.style.height = 'auto';
    if (options.tokenCount) options.tokenCount.textContent = '0 tokens';
    options.resetPendingAttachments();
    options.resetPendingSelectedSkills();
    options.resetLastVoiceInput();
    options.refreshAttachmentHint();
    options.closeSkillPopover();

    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) sendBtn.classList.remove('active');

    const guidedFlow = options.getPendingGuidedFlow();
    options.resetPendingGuidedFlow();
    if (shouldHandlePersonalDayFlow(outboundText, guidedFlow)) {
      if (!options.getSelectedExperienceProfile()) options.setSelectedExperienceProfile('personal');
      options.recordTraceEvent({
        type: 'step',
        title: 'Personal mission preview',
        detail: 'Planning only. No external action is executed.',
        meta: 'read-only',
        status: 'running',
      });
      await delayedThinking(options, () => options.renderPersonalDayFlow(outboundText));
      return true;
    }

    if (shouldHandleDeveloperReviewFlow(outboundText, guidedFlow)) {
      const pendingWorkspaceSelection = options.getPendingWorkspaceSelection();
      if (!options.getSelectedExperienceProfile()) options.setSelectedExperienceProfile('developer');
      options.recordTraceEvent({
        type: 'step',
        title: 'Developer mission preview',
        detail: pendingWorkspaceSelection
          ? `Read-only repository review for ${pendingWorkspaceSelection.root}.`
          : 'Workspace selection required before review.',
        meta: 'read-only',
        status: pendingWorkspaceSelection ? 'running' : 'waiting',
      });
      await delayedThinking(options, () => {
        if (pendingWorkspaceSelection) options.renderDeveloperReviewFlow(outboundText, pendingWorkspaceSelection);
        else options.renderDeveloperWorkspacePicker(outboundText);
      });
      return true;
    }

    if (shouldHandleBusinessAuditFlow(outboundText, guidedFlow)) {
      if (!options.getSelectedExperienceProfile()) options.setSelectedExperienceProfile('business');
      options.recordTraceEvent({
        type: 'step',
        title: 'Business audit preview',
        detail: 'Policy, approval channel, scope, TTL and blocked actions are being projected.',
        meta: 'business',
        status: 'running',
      });
      await delayedThinking(options, () => options.renderBusinessAuditFlow(outboundText));
      return true;
    }

    const runtimeBridge = window.ZavorthRuntimeBridge;
    if (runtimeBridge && typeof runtimeBridge.sendChat === 'function') {
      const runtimeState = runtimeBridge.state || {};
      const protectedRuntime = Boolean(runtimeState.zavorthControl?.authRequired && !runtimeState.zavorthControl?.live);
      if (protectedRuntime) {
        options.recordTraceEvent({
          type: 'approval',
          title: 'Runtime protected',
          detail: 'Live execution requires the local token before this request can be sent.',
          meta: 'local access',
          status: 'waiting',
        });
        options.appendEcho(
          'core',
          [
            'The dashboard is protected.',
            '',
            'Unlock this tab with the local Zavorth token before sending live requests.',
            'I kept your request in the chat and did not send it for execution.',
          ].join('\n'),
        );
        if (typeof runtimeBridge.openUnlockModal === 'function') {
          runtimeBridge.openUnlockModal('To send live messages, unlock this tab with the local Zavorth token.');
        }
        return false;
      }
      options.recordTraceEvent({
        type: 'step',
        title: 'Live gateway',
        detail: 'Request sent to the live Zavorth runtime.',
        meta: options.getCurrentModelRouteLabel(),
        status: 'running',
      });
      window.ZavorthControlChat?.setComposerRunState?.("running");
      options.appendThinkingState();
      try {
        await runtimeBridge.sendChat(
          outboundText,
          {
            appendEcho: options.appendEcho,
            removeThinkingState: options.removeThinkingState,
            renderApprovals: options.renderApprovals,
            renderArtifacts: options.renderArtifacts,
            emitSignal: window.emitSignal,
          },
          {
            attachments: outboundAttachments,
            selectedSkills: outboundSkills,
            voice: outboundVoice,
            composerSettings: outboundComposerSettings,
            experienceProfile: outboundExperienceProfile,
            engineId: selectedEngineId,
            engineDecision: engineDecision?.decision || null,
          },
        );
        window.ZavorthControlChat?.setComposerRunState?.("idle");
        return true;
      } catch (error: any) {
        options.removeThinkingState();
        window.ZavorthControlChat?.setComposerRunState?.("idle");
        const detail = messageFromCaughtError(error);
        options.recordTraceEvent({
          type: 'error',
          title: 'Runtime failed',
          detail,
          status: 'failed',
        });
        if (!error?.uiHandled) {
          options.appendEcho('core', `I could not send this to the live runtime.\n\n${detail}`);
        }
        return false;
      }
    }

    options.recordTraceEvent({
      type: 'step',
      title: 'Local preview runtime',
      detail: 'No live bridge is available; using the local dashboard response.',
      status: 'fallback',
    });
    window.ZavorthControlChat?.setComposerRunState?.("running");
    await delayedThinking(options, () => options.generateCoreResponse(outboundText), 300, 1200 + Math.random() * 800);
    window.ZavorthControlChat?.setComposerRunState?.("idle");
    return true;
  };
}

async function delayedThinking(
  options: Pick<SignalTransmitterOptions, 'appendThinkingState' | 'removeThinkingState'>,
  render: () => void,
  beforeMs = 180,
  activeMs = 640,
) {
  await new Promise((resolve) => window.setTimeout(resolve, beforeMs));
  options.appendThinkingState();
  await new Promise((resolve) => window.setTimeout(resolve, activeMs));
  options.removeThinkingState();
  render();
}

function canvasHintForRequest(text: string, attachments: any[]) {
  const haystack = [
    text,
    attachments.map((file) => `${file.name || ''} ${file.type || ''} ${file.media?.kind || ''}`).join(' '),
  ].join(' ');
  const visual = /\b(ui|ux|interface|layout|screen|page|site|website|frontend|react|vite|css|html|style|design|figma|component|visual|tela|aparencia|pagina|estilo)\b/i.test(haystack);
  const diff = /\b(diff|patch|preview|apply|change|edit|modify|alterar|editar|mudanca)\b/i.test(haystack);
  const media = attachments.some((file) => ['image', 'video'].includes(String(file.media?.kind || '').toLowerCase()));
  if (visual || media) {
    return {
      recommended: true,
      autoOpen: true,
      reason: 'Visual or interface work is easier to review in Z-Canvas before applying changes.',
    };
  }
  if (diff) {
    return {
      recommended: true,
      autoOpen: false,
      reason: 'Diff or preview work can be reviewed safely in Z-Canvas.',
    };
  }
  return { recommended: false, autoOpen: false, reason: '' };
}
