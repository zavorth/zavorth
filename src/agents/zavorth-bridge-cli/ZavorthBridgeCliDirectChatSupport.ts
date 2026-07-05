import { config } from '../../config/index.js';
import { normalizeZavorthBridgeUiText } from '../../services/ZavorthBridgeUiResponseHeuristics.js';

export interface UiStateSnapshot {
  ok?: boolean;
  status?: string;
  responseText?: string;
  hasPermissionPrompt?: boolean;
}

interface AutomationSurfaceDiagnostics {
  homeScreenAfter?: boolean;
  homeScreenBefore?: boolean;
  hasInputBar?: boolean;
  promptSurfaceReady?: boolean;
}

interface AutomationSurface {
  ok?: boolean;
  verified?: boolean;
  diagnostics?: AutomationSurfaceDiagnostics;
  message?: string;
}

export interface CompanionBridge {
  supports: (capability: string) => Promise<boolean>;
  executeCommand: (command: string, args: string[], taskId: string, timeoutMs: number, targetInstanceId: string, tolerateMissing?: boolean) => Promise<unknown>;
  sendAgentPrompt: (prompt: string, taskId: string, timeoutMs: number, targetInstanceId: string) => Promise<unknown>;
  resetSession?: (taskId: string, timeoutMs: number, targetInstanceId: string) => Promise<unknown>;
  startNewConversation?: (taskId: string, timeoutMs: number, targetInstanceId: string) => Promise<unknown>;
  closeAllEditors?: (taskId: string, timeoutMs: number, targetInstanceId: string) => Promise<unknown>;
}

export interface WindowAutomator {
  focusWindow: (delayMs: number, processId: number) => Promise<unknown>;
  ensureConversationSurface: (delayMs: number, processId: number) => Promise<AutomationSurface | null>;
  pasteAndSubmit: (prompt: string, initialDelayMs: number, targetPid: number) => Promise<unknown>;
  readLatestResponse?: (sessionId: number, targetPid: number) => Promise<UiStateSnapshot | null>;
  rejectVisibleStep?: (sessionId: number, targetPid: number) => Promise<unknown>;
  waitForPermissionPromptToClear?: (targetPid: number, maxAttempts: number, delayMs: number) => Promise<boolean>;
}

interface DirectChatError extends Error {
  code: string;
}

export async function deliverPromptToLiveSession(input: {
  prompt: string;
  taskId: string;
  targetInstanceId: string;
  targetPid: number;
  readUiStateSnapshot: (targetPid: number) => Promise<UiStateSnapshot>;
  tryDeliverPromptViaCompanionBridge: (prompt: string, taskId: string, targetInstanceId: string) => Promise<string | null>;
  waitForPromptSubmissionEffect: (targetPid: number, baselineUiState: UiStateSnapshot) => Promise<boolean>;
  prepareDirectChatSurface: (taskId: string, targetInstanceId: string, targetPid: number) => Promise<{ deliveryLabel: string; initialDelayMs: number }>;
  windowAutomator: {
    pasteAndSubmit: (prompt: string, initialDelayMs: number, targetPid: number) => Promise<unknown>;
  };
}): Promise<string> {
  const baselineUiState = await input.readUiStateSnapshot(input.targetPid);
  const bridgeDelivery = await input
    .tryDeliverPromptViaCompanionBridge(input.prompt, input.taskId, input.targetInstanceId)
    .catch(() => null);
  if (bridgeDelivery) {
    const bridgeDeliveryConfirmed = await input.waitForPromptSubmissionEffect(input.targetPid, baselineUiState);
    if (bridgeDeliveryConfirmed) {
      return bridgeDelivery;
    }
  }

  const readySurface = await input.prepareDirectChatSurface(input.taskId, input.targetInstanceId, input.targetPid);
  await input.windowAutomator.pasteAndSubmit(input.prompt, readySurface.initialDelayMs, input.targetPid);
  if (bridgeDelivery) {
    return `${bridgeDelivery}-unconfirmed + ${readySurface.deliveryLabel}`;
  }
  return readySurface.deliveryLabel;
}

export async function tryDeliverPromptViaCompanionBridge(input: {
  prompt: string;
  taskId: string;
  targetInstanceId: string;
  companionBridge: CompanionBridge;
}): Promise<string | null> {
  if (!(await input.companionBridge.supports('canSendAgentPrompt'))) {
    return null;
  }

  const preparationCommands = [
    'zavorthBridge.openAgent',
    'zavorthBridge.agentSidePanel.open',
    'zavorthBridge.agentSidePanel.focus',
    'zavorthBridge.agentSidePanel.expandView',
  ];

  for (const command of preparationCommands) {
    await input.companionBridge
      .executeCommand(command, [], input.taskId, 2500, input.targetInstanceId, true)
      .catch(() => undefined);
  }

  await input.companionBridge.sendAgentPrompt(input.prompt, input.taskId, 8000, input.targetInstanceId);
  return 'companion-bridge:send-agent-prompt';
}

export function normalizeUiProbeText(value: string | null | undefined): string {
  return normalizeZavorthBridgeUiText(value);
}

export function normalizeUiProbeStatus(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

export async function waitForPromptSubmissionEffect(input: {
  targetPid: number;
  baselineUiState: UiStateSnapshot;
  readUiStateSnapshot: (targetPid: number) => Promise<UiStateSnapshot>;
}): Promise<boolean> {
  if (!config.zavorthBridgeAutomationEnabled || input.targetPid <= 0) {
    return true;
  }

  const baselineStatus = normalizeUiProbeStatus(input.baselineUiState?.status);
  const baselineResponse = normalizeUiProbeText(input.baselineUiState?.responseText);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const snapshot = await input.readUiStateSnapshot(input.targetPid);
    if (!snapshot?.ok) {
      continue;
    }

    if (snapshot.hasPermissionPrompt) {
      return true;
    }

    const currentStatus = normalizeUiProbeStatus(snapshot.status);
    if (currentStatus === 'generating') {
      return true;
    }

    const currentResponse = normalizeUiProbeText(snapshot.responseText);
    if (currentResponse && currentResponse !== baselineResponse) {
      return true;
    }

    if (baselineStatus !== currentStatus && currentStatus === 'ready' && currentResponse) {
      return true;
    }
  }

  return false;
}

export async function clearBlockingPermissionPrompt(input: {
  taskId: string;
  targetInstanceId: string;
  targetPid: number;
  windowAutomator: WindowAutomator;
  companionBridge: CompanionBridge;
}): Promise<string | null> {
  if (typeof input.windowAutomator.readLatestResponse !== 'function') {
    return null;
  }

  const snapshot = await input.windowAutomator.readLatestResponse(0, input.targetPid).catch(() => null);
  if (!snapshot?.ok || !snapshot.hasPermissionPrompt) {
    return null;
  }

  if (input.windowAutomator.rejectVisibleStep) {
    await input.windowAutomator.rejectVisibleStep(0, input.targetPid).catch(() => undefined);
  }

  const clearedAfterReject = input.windowAutomator.waitForPermissionPromptToClear
    ? await input.windowAutomator.waitForPermissionPromptToClear(input.targetPid, 3, 250).catch(() => false)
    : false;
  if (clearedAfterReject) {
    return 'window-automation:reject-stale-permission-prompt';
  }

  if (await input.companionBridge.supports('canResetSession') && input.companionBridge.resetSession) {
    await input.companionBridge.resetSession(input.taskId, 12000, input.targetInstanceId).catch(() => undefined);
    const clearedAfterReset = input.windowAutomator.waitForPermissionPromptToClear
      ? await input.windowAutomator.waitForPermissionPromptToClear(input.targetPid, 4, 400).catch(() => false)
      : false;
    if (clearedAfterReset) {
      return 'companion-bridge:reset-session';
    }
  }

  if (await input.companionBridge.supports('canStartNewConversation') && input.companionBridge.startNewConversation) {
    await input.companionBridge.startNewConversation(input.taskId, 8000, input.targetInstanceId).catch(() => undefined);
    const clearedAfterRestart = input.windowAutomator.waitForPermissionPromptToClear
      ? await input.windowAutomator.waitForPermissionPromptToClear(input.targetPid, 4, 400).catch(() => false)
      : false;
    if (clearedAfterRestart) {
      return 'companion-bridge:start-new-conversation';
    }
  }

  throw buildDirectChatUnavailableError(
    'O ZavorthBridge ficou preso em um prompt de permissao antigo e eu nao consegui limpa-lo automaticamente. Use /agreset e tente de novo.',
  );
}

export async function clearBlockingArtifactEditor(input: {
  taskId: string;
  targetInstanceId: string;
  activeEditor: string | null | undefined;
  companionBridge: CompanionBridge;
}): Promise<string | null> {
  if (!isArtifactEditorBlockingDirectChat(input.activeEditor)) {
    return null;
  }

  const actions: string[] = [];

  if (await input.companionBridge.supports('canCloseAllEditors') && input.companionBridge.closeAllEditors) {
    await input.companionBridge.closeAllEditors(input.taskId, 8000, input.targetInstanceId).catch(() => undefined);
    actions.push('companion-bridge:close-all-editors-from-artifact-editor');
  } else if (await input.companionBridge.supports('canResetSession') && input.companionBridge.resetSession) {
    await input.companionBridge.resetSession(input.taskId, 12000, input.targetInstanceId).catch(() => undefined);
    actions.push('companion-bridge:reset-session-from-artifact-editor');
  }

  if (await input.companionBridge.supports('canStartNewConversation') && input.companionBridge.startNewConversation) {
    await input.companionBridge.startNewConversation(input.taskId, 8000, input.targetInstanceId).catch(() => undefined);
    actions.push('companion-bridge:start-new-conversation-from-artifact-editor');
  }

  return actions.length > 0 ? actions.join(' + ') : null;
}

export async function prepareDirectChatSurface(input: {
  taskId: string;
  targetInstanceId: string;
  targetPid: number;
  companionBridge: CompanionBridge;
  tryPrepareAutomationSurface: (processId: number, focusDelayMs: number, surfaceDelayMs: number) => Promise<{ ready: boolean; failureMessage: string | null }>;
}): Promise<{ deliveryLabel: string; initialDelayMs: number }> {
  if (!config.zavorthBridgeAutomationEnabled) {
    throw buildDirectChatUnavailableError('A automacao de janela do ZavorthBridge esta desativada neste runtime.');
  }

  const initialAttempt = await input.tryPrepareAutomationSurface(input.targetPid, 200, 600);
  if (initialAttempt.ready) {
    return {
      deliveryLabel: 'window-automation:paste-and-submit',
      initialDelayMs: 200,
    };
  }

  const commandSequences: Array<{
    label: string;
    commands?: string[];
    startConversation?: boolean;
  }> = [
    {
      label: 'companion-bridge:open-agent',
      commands: ['zavorthBridge.openAgent'],
    },
    {
      label: 'companion-bridge:open-agent-panel',
      commands: [
        'zavorthBridge.agentSidePanel.open',
        'zavorthBridge.agentSidePanel.focus',
        'zavorthBridge.agentSidePanel.expandView',
      ],
    },
    {
      label: 'companion-bridge:toggle-chat-focus',
      commands: ['zavorthBridge.toggleChatFocus'],
    },
    {
      label: 'companion-bridge:switch-workspace-agent',
      commands: ['zavorthBridge.switchBetweenWorkspaceAndAgent'],
    },
    {
      label: 'companion-bridge:open-agent + open-panel + toggle-chat-focus',
      commands: [
        'zavorthBridge.openAgent',
        'zavorthBridge.agentSidePanel.open',
        'zavorthBridge.agentSidePanel.focus',
        'zavorthBridge.agentSidePanel.expandView',
        'zavorthBridge.toggleChatFocus',
      ],
    },
    {
      label: 'companion-bridge:start-new-conversation',
      startConversation: true,
    },
  ];

  let lastFailureMessage = initialAttempt.failureMessage;

  for (const sequence of commandSequences) {
    if (sequence.startConversation) {
      if (await input.companionBridge.supports('canStartNewConversation') && input.companionBridge.startNewConversation) {
        await input.companionBridge.startNewConversation(input.taskId, 8000, input.targetInstanceId).catch(() => undefined);
      } else {
        continue;
      }
    }

    for (const command of sequence.commands || []) {
      await input.companionBridge.executeCommand(command, [], input.taskId, 5000, input.targetInstanceId).catch(() => undefined);
    }

    const retryAttempt = await input.tryPrepareAutomationSurface(input.targetPid, 350, 900);
    if (retryAttempt.ready) {
      return {
        deliveryLabel: `${sequence.label} + window-automation:paste-and-submit`,
        initialDelayMs: 250,
      };
    }

    lastFailureMessage = retryAttempt.failureMessage || lastFailureMessage;
  }

  throw buildDirectChatUnavailableError(
    lastFailureMessage ||
      'A superficie direta do chat do ZavorthBridge nao ficou pronta para automacao confiavel.',
  );
}

export async function tryPrepareAutomationSurface(input: {
  processId: number;
  focusDelayMs: number;
  surfaceDelayMs: number;
  windowAutomator: WindowAutomator;
}): Promise<{ ready: boolean; failureMessage: string | null }> {
  await input.windowAutomator.focusWindow(input.focusDelayMs, input.processId).catch(() => undefined);
  const surface = await input.windowAutomator.ensureConversationSurface(input.surfaceDelayMs, input.processId).catch(() => null);
  if (isAutomationSurfaceReady(surface)) {
    return { ready: true, failureMessage: null };
  }

  const diagnostics = surface?.diagnostics || {};
  const parts: string[] = [];
  if (surface?.message) {
    parts.push(surface.message);
  }
  if (diagnostics.homeScreenAfter === true || diagnostics.homeScreenBefore === true) {
    parts.push('O ZavorthBridge permaneceu na home screen.');
  }
  if (diagnostics.hasInputBar === false) {
    parts.push('A barra de input do chat nao ficou visivel.');
  }
  if (diagnostics.promptSurfaceReady === false) {
    parts.push('A surface do chat nao foi verificada como pronta.');
  }

  return {
    ready: false,
    failureMessage: parts.join(' ').trim() || 'A surface do chat nao ficou pronta.',
  };
}

export function isAutomationSurfaceReady(surface: AutomationSurface | null): boolean {
  if (!surface?.ok || surface.verified === false) {
    return false;
  }

  const diagnostics = surface.diagnostics || {};
  if (diagnostics.promptSurfaceReady === false) {
    return false;
  }

  if (diagnostics.hasInputBar === false) {
    return false;
  }

  return true;
}

export function buildDirectChatUnavailableError(message: string): DirectChatError {
  const error = new Error(
    `${message} Eu nao vou usar envio cego pela ponte nesse estado porque isso esta gerando respostas falsas ou contaminadas.`,
  ) as DirectChatError;
  error.code = 'direct_chat_unavailable';
  error.name = 'ZavorthBridgeDirectChatUnavailableError';
  return error;
}

export function isArtifactEditorBlockingDirectChat(activeEditor: string | null | undefined): boolean {
  const normalized = String(activeEditor || '')
    .trim()
    .replace(/\\/g, '/')
    .toLowerCase();

  if (!normalized) {
    return false;
  }

  return (
    normalized.includes('/data/agent-bridge/zavorth-bridge/handoffs/') ||
    normalized.includes('/data/agent-bridge/zavorth-bridge/responses/')
  );
}
