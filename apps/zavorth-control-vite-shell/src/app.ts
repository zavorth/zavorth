/**
 * Zavorth Nexus --- Core Runtime Logic
 * Manages dock navigation, neural feed (chat), signals, and interactive behaviors.
 */

import { initDockNavigation } from './shell-navigation';
import { attachmentKindLabel, attachmentReadyLabel, readAttachmentFile } from './composer-attachments';
import { buildConversationStateCard, buildEchoDividerHtml, buildEchoGroupHtml, buildThinkingStateHtml } from './chat-renderer';
import { createChatSurfaceRenderers, removeRemoteMeshApprovalCard as removeRemoteMeshApprovalCardNode } from './chat-surface-renderers';
import { composerPresetSettings, composerSettingLabel, getComposePlaceholder, isComposerPresetActive, persistComposerSettings, readComposerSettings } from './composer-settings';
import { bindAttachmentTray, bindComposeInputEvents, bindComposerContextBar, bindComposerFileDrop, bindFileInputEvents, bindToolSheetActions, createHiddenFileInput } from './composer-event-wiring';
import { exportConversation, getExportMenuHtml } from './conversation-export';
import { createControlSheets } from './control-sheets';
import { createDashboardLiveView } from './dashboard-live-view';
import {
  buildExperienceProfilePayload,
  EXPERIENCE_PROFILE_CATALOG,
  getExperienceProfile,
  persistExperienceProfile,
  readStoredExperienceProfile,
  resolveExperienceProfile,
  type ExperienceProfileUiContract,
} from './experience-profile-ui';
import { escapeHtml, renderMarkdown, sanitizeRenderedHtml } from './html-utils';
import { createLocalPreviewResponses } from './local-preview-responses';
import { bindNeuralFeedInteractions } from './neural-feed-interactions';
import { createOverlayController } from './overlay-controller';
import { createSignalTransmitter } from './signal-transmitter';
import { dashboardStatusText, formatBytes, messageFromErrorPayload } from './text-utils';
import { initThemeToggle } from './theme';
import { renderTraceTimelineHtml } from './trace-renderer';
import { compactTraceText, normalizeTraceCapability, normalizeTraceEvent, traceEventClass, traceEventLabel, traceEventMatchesQuery } from './trace-utils';
import { buildSkillOptions, buildSkillPopoverHtml, promptForSkill, skillFromOption } from './skills-popover';
import { bindVoiceDictation } from './voice-dictation';
import { applyControlLocale, installControlLocale } from './locale';
import { initRuntimeEngineUi } from './runtime-engines-ui';
import {
  createPromptQueueItem,
  DEFAULT_PROMPT_QUEUE_STORAGE_KEY,
  hasDuplicateQueuedPrompt,
  promptSubmitKey,
  readPromptQueueForSession,
  serializePromptQueueItem,
  writePromptQueueForSession,
} from './prompt-queue';
import {
  getSlashCommandSuggestions,
  parseSlashCommand,
  renderSlashCommandHelp,
  shouldQueueLocalSlashCommand,
  SLASH_COMMANDS,
} from './slash-commands';

export function initControlApp() {
  installControlLocale();
  initRuntimeEngineUi();
  installRuntimeTextSanitizer();

  // --------- Markdown & Syntax Highlighting ---------
  if (window.marked) {
    marked.setOptions({ breaks: true, gfm: true });
  }

  // --------- Dock Navigation ---------
  const coreFrame = document.getElementById('core-frame');
  const dockNodes = document.querySelectorAll('.dock-node[data-sector]');
  const sectors = document.querySelectorAll('.sector');
  const bridgeCurrent = document.getElementById('bridge-current');

  initDockNavigation({
    coreFrame,
    dockNodes,
    sectors,
    bridgeCurrent,
    onOverviewActivated: updateDashboardGlass,
  });

  // --------- Neural Feed (Chat) Input ---------
  const composeInput = document.getElementById('compose-input');
  const composeDock = document.querySelector('.compose-dock');
  const composeFrame = document.querySelector('.compose-dock__input-frame');
  const tokenCount = document.getElementById('token-count');
  let composerSettingsState = readComposerSettings();
  let pendingAttachments = [];
  let pendingSelectedSkills = [];
  let lastVoiceInput = null;
  let isListening = false;
  let traceSheetQuery = { runId: '', traceId: '', sessionId: '', source: '' };
  let selectedExperienceProfile = readStoredExperienceProfile(getPromptQueueStorage());
  let pendingGuidedFlow = '';
  let pendingWorkspaceSelection = null;
  let isTransmittingSignal = false;
  let isDrainingPromptQueue = false;
  let promptQueueSessionKey = getPromptQueueSessionKey();
  let promptQueue = readPromptQueueForSession(getPromptQueueStorage(), promptQueueSessionKey);
  let promptQueueDrainTimer = 0;
  let lastPromptQueueRuntimeRefreshAt = 0;
  const inFlightSubmitKeys = new Set();

  const attachmentTray = document.createElement('div');
  attachmentTray.className = 'compose-attachments';
  attachmentTray.setAttribute('aria-live', 'polite');

  const composerContextBar = document.createElement('div');
  composerContextBar.className = 'compose-context-bar';
  composerContextBar.hidden = true;
  composerContextBar.setAttribute('aria-live', 'polite');

  const promptQueueBar = document.createElement('div');
  promptQueueBar.className = 'compose-prompt-queue';
  promptQueueBar.hidden = true;
  promptQueueBar.setAttribute('aria-live', 'polite');

  const sideChannelPanel = document.createElement('div');
  sideChannelPanel.className = 'compose-side-channel';
  sideChannelPanel.hidden = true;
  sideChannelPanel.setAttribute('aria-live', 'polite');

  const skillPopover = document.createElement('div');
  skillPopover.className = 'compose-skill-popover hidden';
  skillPopover.setAttribute('role', 'dialog');
  skillPopover.setAttribute('aria-label', 'Choose skill');

  const autocompletePopover = document.createElement('div');
  autocompletePopover.className = 'compose-autocomplete-popover hidden';
  autocompletePopover.setAttribute('role', 'dialog');
  autocompletePopover.setAttribute('aria-label', 'Command autocomplete');

  let autocompleteVisible = false;
  let autocompleteFiltered = [];
  let autocompleteIndex = 0;

  function renderAutocomplete() {
    if (autocompleteFiltered.length === 0) {
      autocompletePopover.classList.add('hidden');
      autocompleteVisible = false;
      return;
    }
    
    autocompletePopover.innerHTML = autocompleteFiltered.map((item, idx) => `
      <div class="autocomplete-option ${idx === autocompleteIndex ? 'is-active' : ''}" data-cmd="/${escapeHtml(item.name)}">
        <span class="autocomplete-option__cmd">/${escapeHtml(item.name)}${item.args ? ` ${escapeHtml(item.args)}` : ''}</span>
        <span class="autocomplete-option__desc">${escapeHtml(item.description)}</span>
      </div>
    `).join('');
    
    autocompletePopover.classList.remove('hidden');
    autocompleteVisible = true;
    
    autocompletePopover.querySelectorAll('.autocomplete-option').forEach((opt, idx) => {
      opt.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectAutocompleteOption(idx);
      });
    });
  }

  function selectAutocompleteOption(idx) {
    const option = autocompleteFiltered[idx];
    if (!option || !composeInput) return;
    
    const value = (composeInput as HTMLTextAreaElement).value;
    const slashIdx = value.lastIndexOf('/');
    if (slashIdx !== -1) {
      (composeInput as HTMLTextAreaElement).value = value.slice(0, slashIdx) + `/${option.name} `;
    } else {
      (composeInput as HTMLTextAreaElement).value = `/${option.name} `;
    }
    
    composeInput.dispatchEvent(new Event('input'));
    composeInput.focus();
    hideAutocomplete();
  }

  function hideAutocomplete() {
    autocompletePopover.classList.add('hidden');
    autocompleteVisible = false;
    autocompleteIndex = 0;
  }

  if (composeFrame && composeInput) {
    composeFrame.insertBefore(attachmentTray, composeInput.nextSibling);
    composeFrame.insertBefore(composerContextBar, attachmentTray.nextSibling);
    composeFrame.insertBefore(promptQueueBar, composerContextBar.nextSibling);
    composeFrame.insertBefore(sideChannelPanel, promptQueueBar.nextSibling);
    (composeDock || composeFrame).appendChild(skillPopover);
    (composeDock || composeFrame).appendChild(autocompletePopover);
  }

  function writeComposerSettings(nextSettings) {
    composerSettingsState = persistComposerSettings(nextSettings);
    applyComposerSettingsToUi();
  }

  function applyComposerSettingsToUi() {
    document.querySelectorAll('[data-composer-setting]').forEach((field) => {
      const key = field.getAttribute('data-composer-setting');
      if (!key || !(key in composerSettingsState)) return;
      field.value = composerSettingsState[key];
    });
    document.querySelectorAll('[data-composer-toggle]').forEach((toggle) => {
      const key = toggle.getAttribute('data-composer-toggle');
      const enabled = Boolean(composerSettingsState[key]);
      toggle.classList.toggle('is-active', enabled);
      toggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    });
    document.querySelectorAll('[data-composer-preset]').forEach((preset) => {
      const key = preset.getAttribute('data-composer-preset');
      const active = isComposerPresetActive(key, composerSettingsState);
      preset.classList.toggle('is-active', Boolean(active));
    });
    document.body.classList.toggle('zavorth-chat-focus-mode', Boolean(composerSettingsState.focus));
    if (composeInput && pendingAttachments.length === 0) {
      composeInput.placeholder = getComposePlaceholder(composerSettingsState);
    }
    updateComposerContextBar();
  }

  function emitLocalNotice(message) {
    if (window.emitSignal) {
      window.emitSignal('info', window.ZavorthLocale?.t('Dashboard') || 'Dashboard', message);
      return;
    }
    appendEcho('core', message);
  }

  function clearComposerInput() {
    if (!composeInput) return;
    composeInput.value = '';
    composeInput.style.height = 'auto';
    composeInput.dispatchEvent(new Event('input'));
  }

  function getPromptQueueStorage() {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  function getPromptQueueSessionKey() {
    try {
      const url = new URL(window.location.href);
      const fromUrl = String(url.searchParams.get('sessionId') || '').trim();
      if (fromUrl) return fromUrl;
      const fromBridge = String(window.ZavorthRuntimeBridge?.readSessionId?.() || '').trim();
      if (fromBridge) return fromBridge;
      const fromStorage = String(sessionStorage.getItem('zavorth.zavorthControl.sessionId') || '').trim();
      return fromStorage || 'local';
    } catch {
      return 'local';
    }
  }

  function persistPromptQueue() {
    writePromptQueueForSession(
      getPromptQueueStorage(),
      promptQueueSessionKey,
      promptQueue,
      DEFAULT_PROMPT_QUEUE_STORAGE_KEY,
    );
  }

  function syncPromptQueueSession() {
    const nextSessionKey = getPromptQueueSessionKey();
    if (nextSessionKey === promptQueueSessionKey) return;
    persistPromptQueue();
    promptQueueSessionKey = nextSessionKey;
    promptQueue = readPromptQueueForSession(
      getPromptQueueStorage(),
      promptQueueSessionKey,
      DEFAULT_PROMPT_QUEUE_STORAGE_KEY,
    );
  }

  function getActiveRuntimeRun() {
    const bridge = window.ZavorthRuntimeBridge;
    const run = typeof bridge?.getActiveRun === 'function'
      ? bridge.getActiveRun()
      : bridge?.state?.zavorthControl?.snapshot?.activeRun
        || bridge?.state?.zavorthControl?.snapshot?.runs?.[0]
        || null;
    const status = String(run?.status || '').trim().toLowerCase();
    if (['queued', 'thinking', 'running', 'waiting_approval', 'planning', 'in_progress', 'processing'].includes(status)) {
      return run;
    }

    const activeStream = document.querySelector('.echo-group--agent-stream:not(.is-complete)');
    const streamRunId = String(activeStream?.getAttribute('data-zavorth-agent-stream-id') || '')
      .split(':')[0]
      .trim();
    const fallbackRunId = streamRunId || String(sessionStorage.getItem('zavorth.zavorthControl.runId') || '').trim();
    if (activeStream && fallbackRunId) {
      return {
        id: fallbackRunId,
        runId: fallbackRunId,
        status: 'running',
      };
    }
    return null;
  }

  function isRuntimeChatBusy() {
    return Boolean(isTransmittingSignal || getActiveRuntimeRun());
  }

  function schedulePromptQueueDrain(delayMs = 450) {
    if (promptQueueDrainTimer) return;
    promptQueueDrainTimer = window.setTimeout(() => {
      promptQueueDrainTimer = 0;
      drainPromptQueue().catch((error) => {
        recordTraceEvent({
          type: 'error',
          title: 'Prompt queue failed',
          detail: error?.message || String(error),
          meta: 'queue',
          status: 'failed',
        });
      });
    }, delayMs);
  }

  function maybeRefreshRuntimeForQueue() {
    const bridge = window.ZavorthRuntimeBridge;
    if (!bridge || typeof bridge.refresh !== 'function') return;
    const now = Date.now();
    if (now - lastPromptQueueRuntimeRefreshAt < 4500) return;
    lastPromptQueueRuntimeRefreshAt = now;
    bridge.refresh({ skipSessionHydrate: true }).catch(() => undefined);
  }

  function snapshotQueuedPrompt(text, overrides = {}) {
    return createPromptQueueItem({
      text,
      attachments: overrides.attachments || pendingAttachments,
      selectedSkills: overrides.selectedSkills || pendingSelectedSkills,
      voice: 'voice' in overrides ? overrides.voice : (lastVoiceInput ? { ...lastVoiceInput } : null),
      guidedFlow: 'guidedFlow' in overrides ? overrides.guidedFlow : pendingGuidedFlow,
      workspaceSelection: 'workspaceSelection' in overrides ? overrides.workspaceSelection : pendingWorkspaceSelection,
      sessionId: promptQueueSessionKey,
      localCommandName: overrides.localCommandName || null,
      localCommandArgs: overrides.localCommandArgs || null,
      kind: overrides.kind || undefined,
    });
  }

  function clearQueuedComposerState() {
    clearComposerInput();
    pendingAttachments = [];
    pendingSelectedSkills = [];
    pendingGuidedFlow = '';
    lastVoiceInput = null;
    refreshAttachmentHint();
    updateComposerContextBar();
    updateSendAffordance();
  }

  function restoreQueuedPrompt(item) {
    if (!item || !composeInput) return;
    composeInput.value = item.text || '';
    pendingAttachments = Array.isArray(item.attachments) ? item.attachments.slice() : [];
    pendingSelectedSkills = Array.isArray(item.selectedSkills) ? item.selectedSkills.slice() : [];
    pendingGuidedFlow = item.guidedFlow || '';
    pendingWorkspaceSelection = item.workspaceSelection || pendingWorkspaceSelection;
    lastVoiceInput = item.voice || null;
    composeInput.dispatchEvent(new Event('input'));
    refreshAttachmentHint();
    updateComposerContextBar();
    updateSendAffordance();
  }

  function promptQueueItemMeta(item) {
    const parts = [];
    if (item.localCommandName) parts.push(`/${item.localCommandName}`);
    if (item.attachments?.length) parts.push(`${item.attachments.length} file${item.attachments.length === 1 ? '' : 's'}`);
    if (item.selectedSkills?.length) parts.push(`${item.selectedSkills.length} tool${item.selectedSkills.length === 1 ? '' : 's'}`);
    if (item.attempts > 0 || item.maxAttempts) parts.push(`${item.attempts}/${item.maxAttempts || 3} attempts`);
    if (item.backoffMs) parts.push(`${item.backoffMs}ms backoff`);
    if (item.nextRetryAt && item.nextRetryAt > Date.now()) parts.push(`retry ${Math.ceil((item.nextRetryAt - Date.now()) / 1000)}s`);
    if (item.steeringAckId) parts.push(`ack ${item.steeringAckId}`);
    if (item.status === 'failed') parts.push('retry pending');
    return parts.join(' | ') || 'message';
  }

  function renderPromptQueue() {
    if (!promptQueueBar) return;
    promptQueueBar.hidden = promptQueue.length === 0;
    if (promptQueue.length === 0) {
      promptQueueBar.innerHTML = '';
      return;
    }
    const activeRun = getActiveRuntimeRun();
    promptQueueBar.innerHTML = `
      <div class="compose-prompt-queue__header">
        <span>${promptQueue.length} queued prompt${promptQueue.length === 1 ? '' : 's'}${activeRun ? ` - run ${escapeHtml(String(activeRun.id || activeRun.runId || 'active'))}` : ''}</span>
        <div class="compose-prompt-queue__actions">
          <button type="button" data-prompt-queue-flush>Flush</button>
          <button type="button" data-prompt-queue-clear>Clear</button>
        </div>
      </div>
      ${promptQueue.map((item, index) => `
        <div class="compose-prompt-queue__item compose-prompt-queue__item--${escapeHtml(item.status || 'queued')}" data-prompt-queue-id="${escapeHtml(item.id)}">
          <strong>${index + 1}</strong>
          <span title="${escapeHtml(promptQueueItemMeta(item))}">${escapeHtml(compactTraceText(item.text || item.localCommandArgs || `/${item.localCommandName || 'command'}`, 76))}</span>
          ${activeRun && !item.localCommandName ? `<button type="button" data-prompt-queue-steer="${escapeHtml(item.id)}">Steer</button>` : ''}
          <button type="button" data-prompt-queue-send="${escapeHtml(item.id)}">Send now</button>
          <button type="button" data-prompt-queue-remove="${escapeHtml(item.id)}" aria-label="Cancel queued prompt">Cancel</button>
        </div>
      `).join('')}
    `;
  }

  function enqueuePrompt(text, overrides = {}) {
    syncPromptQueueSession();
    const item = overrides.item
      ? serializePromptQueueItem({ ...overrides.item, sessionId: promptQueueSessionKey })
      : snapshotQueuedPrompt(text, overrides);
    if (!item.text && item.attachments.length === 0 && !item.localCommandName) return false;
    if (hasDuplicateQueuedPrompt(promptQueue, item)) {
      emitLocalNotice('That prompt is already queued for this session.');
      clearQueuedComposerState();
      return true;
    }
    promptQueue.push(item);
    persistPromptQueue();
    renderPromptQueue();
    recordTraceEvent({
      type: item.localCommandName ? 'step' : 'request',
      title: item.localCommandName ? `/${item.localCommandName} queued` : 'Prompt queued',
      detail: item.text || item.localCommandArgs || '',
      meta: promptQueueItemMeta(item),
      status: 'queued',
    });
    emitLocalNotice('Prompt queued. It will run when the current agent run is idle.');
    clearQueuedComposerState();
    schedulePromptQueueDrain();
    return true;
  }

  function requeuePromptAtFront(item, error) {
    if (!item) return;
    const attempts = Number(item.attempts || 0) + 1;
    const maxAttempts = Math.max(1, Number(item.maxAttempts || 3));
    const baseBackoffMs = Math.max(0, Number(item.backoffMs || 1200));
    const backoffMs = attempts >= maxAttempts
      ? 0
      : Math.min(60_000, baseBackoffMs * (2 ** Math.max(0, attempts - 1)));
    const next = serializePromptQueueItem({
      ...item,
      attempts,
      maxAttempts,
      backoffMs: baseBackoffMs,
      nextRetryAt: backoffMs > 0 ? Date.now() + backoffMs : null,
      status: 'failed',
      lastError: error?.message || String(error || 'Send failed.'),
      pendingRunId: null,
      sessionId: promptQueueSessionKey,
    });
    promptQueue = [next, ...promptQueue.filter((candidate) => candidate.id !== next.id)];
    persistPromptQueue();
    renderPromptQueue();
    recordTraceEvent({
      type: 'error',
      title: 'Prompt requeued',
      detail: attempts >= maxAttempts
        ? `${next.lastError || 'Send failed.'} Max attempts reached.`
        : `${next.lastError || 'Send failed.'} Retry scheduled in ${Math.ceil(backoffMs / 1000)}s.`,
      meta: promptQueueItemMeta(next),
      status: 'retry',
    });
  }

  async function sendQueuedPrompt(item) {
    if (!item) return false;
    if (item.localCommandName) {
      return dispatchLocalSlashCommand(item.localCommandName, item.localCommandArgs || '', {
        fromQueue: true,
        queueItem: item,
      });
    }
    restoreQueuedPrompt(item);
    return transmitSignal({ fromQueue: true, queueItem: item });
  }

  async function drainPromptQueue() {
    syncPromptQueueSession();
    if (isDrainingPromptQueue || promptQueue.length === 0) return;
    if (isRuntimeChatBusy()) {
      maybeRefreshRuntimeForQueue();
      renderPromptQueue();
      schedulePromptQueueDrain(900);
      return;
    }
    isDrainingPromptQueue = true;
    try {
      while (promptQueue.length > 0 && !isRuntimeChatBusy()) {
        const now = Date.now();
        const nextIndex = promptQueue.findIndex((item) => (
          !item.pendingRunId
          && Number(item.attempts || 0) < Number(item.maxAttempts || 3)
          && (!item.nextRetryAt || Number(item.nextRetryAt) <= now)
        ));
        if (nextIndex < 0) break;
        const [next] = promptQueue.splice(nextIndex, 1);
        persistPromptQueue();
        renderPromptQueue();
        const sent = await sendQueuedPrompt(next);
        if (!sent) {
          break;
        }
      }
    } finally {
      isDrainingPromptQueue = false;
      persistPromptQueue();
      renderPromptQueue();
      if (promptQueue.length > 0) {
        const retryTimes = promptQueue
          .map((item) => Number(item.nextRetryAt || 0))
          .filter((value) => value > Date.now());
        const delay = retryTimes.length > 0
          ? Math.max(450, Math.min(30_000, Math.min(...retryTimes) - Date.now()))
          : 450;
        schedulePromptQueueDrain(delay);
      }
    }
  }

  function removeQueuedPrompt(id) {
    syncPromptQueueSession();
    const item = promptQueue.find((entry) => entry.id === id || entry.id.startsWith(id));
    promptQueue = promptQueue.filter((entry) => entry !== item);
    persistPromptQueue();
    renderPromptQueue();
    if (item) {
      recordTraceEvent({
        type: 'status',
        title: 'Queued prompt cancelled',
        detail: item.text || item.localCommandArgs || item.id,
        meta: 'queue',
        status: 'done',
      });
      emitLocalNotice('Queued prompt cancelled.');
    }
  }

  function replaceQueuedPrompt(id, text) {
    syncPromptQueueSession();
    const normalized = String(text || '').trim();
    const item = promptQueue.find((entry) => entry.id === id || entry.id.startsWith(id));
    if (!item || !normalized) return false;
    item.text = normalized;
    item.localCommandArgs = item.localCommandName ? normalized : item.localCommandArgs;
    item.status = 'queued';
    item.pendingRunId = null;
    item.nextRetryAt = null;
    item.lastError = null;
    persistPromptQueue();
    renderPromptQueue();
    emitLocalNotice('Queued prompt replaced.');
    return true;
  }

  function configureQueuedPromptBackoff(id, backoffMs) {
    syncPromptQueueSession();
    const item = promptQueue.find((entry) => entry.id === id || entry.id.startsWith(id));
    const value = Math.max(0, Number(backoffMs || 0));
    if (!item || !Number.isFinite(value)) return false;
    item.backoffMs = value;
    persistPromptQueue();
    renderPromptQueue();
    emitLocalNotice(`Queued prompt backoff set to ${value}ms.`);
    return true;
  }

  function configureQueuedPromptAttempts(id, maxAttempts) {
    syncPromptQueueSession();
    const item = promptQueue.find((entry) => entry.id === id || entry.id.startsWith(id));
    const value = Math.max(1, Number(maxAttempts || 0));
    if (!item || !Number.isFinite(value)) return false;
    item.maxAttempts = value;
    persistPromptQueue();
    renderPromptQueue();
    emitLocalNotice(`Queued prompt max attempts set to ${value}.`);
    return true;
  }

  function clearPromptQueue() {
    syncPromptQueueSession();
    promptQueue = [];
    persistPromptQueue();
    renderPromptQueue();
    emitLocalNotice('Prompt queue cleared.');
  }

  function updateSendAffordance() {
    const send = document.getElementById('send-btn');
    if (!send || !composeInput) return;
    const hasText = composeInput.value.trim().length > 0;
    const hasFiles = pendingAttachments.length > 0;
    send.classList.toggle('active', hasText || hasFiles);
    send.setAttribute('aria-label', hasFiles && !hasText ? 'Send files to Zavorth' : 'Send message');
  }

  function setBadge(node, value, visible) {
    if (!node) return;
    node.textContent = String(value);
    node.hidden = !visible;
  }

  function updateComposerContextBar() {
    if (!composerContextBar) return;
    const chips = [];
    if (pendingAttachments.length > 0) {
      chips.push(`<span class="compose-context-chip compose-context-chip--files"><strong>${pendingAttachments.length}</strong> file${pendingAttachments.length === 1 ? '' : 's'} ready</span>`);
    }
    pendingSelectedSkills.slice(0, 4).forEach((skill) => {
      chips.push(`
        <span class="compose-context-chip compose-context-chip--tool" title="${escapeHtml(skill.prompt || skill.title || skill.id)}">
          <strong>${escapeHtml(skill.title || skill.id)}</strong>
          <button type="button" data-compose-remove-skill="${escapeHtml(skill.id)}" aria-label="Remove ${escapeHtml(skill.title || skill.id)}">&times;</button>
        </span>
      `);
    });
    if (lastVoiceInput) {
      chips.push(`<span class="compose-context-chip compose-context-chip--voice"><strong>Voice</strong>${escapeHtml(compactTraceText(lastVoiceInput.transcript || 'captured', 42))}</span>`);
    } else if (isListening) {
      chips.push('<span class="compose-context-chip compose-context-chip--voice"><strong>Voice</strong>listening</span>');
    }
    const voiceLabel = composerSettingLabel('voice', composerSettingsState.voice);
    if (voiceLabel) chips.push(`<span class="compose-context-chip"><strong>Voice</strong>${escapeHtml(voiceLabel)}</span>`);
    composerContextBar.innerHTML = chips.join('');
    composerContextBar.hidden = chips.length === 0;
  }

  function updateComposerBadges() {
    setBadge(attachmentCountBadge, pendingAttachments.length, pendingAttachments.length > 0);
    setBadge(toolCountBadge, pendingSelectedSkills.length, pendingSelectedSkills.length > 0);
    setBadge(voiceStateBadge, isListening ? 'on' : 'voice', isListening || Boolean(lastVoiceInput));
    setBadge(historyCountBadge, traceEvents.length > 99 ? '99+' : traceEvents.length, traceEvents.length > 0);
    if (skillsBtn) {
      skillsBtn.classList.toggle('is-active', pendingSelectedSkills.length > 0 || !skillPopover.classList.contains('hidden'));
      skillsBtn.setAttribute('aria-label', pendingSelectedSkills.length > 0
        ? `${pendingSelectedSkills.length} selected tool${pendingSelectedSkills.length === 1 ? '' : 's'}`
        : 'Tools');
    }
    if (voiceBtn) {
      voiceBtn.classList.toggle('has-voice', Boolean(lastVoiceInput));
    }
    updateComposerContextBar();
    if (toolSheet && !toolSheet.classList.contains('hidden')) updateToolSheetState();
  }

  function refreshAttachmentHint() {
    const count = pendingAttachments.length;
    const fileLabel = attachmentReadyLabel(count);
    const mediaCount = pendingAttachments.filter((file) => file.media?.kind === 'image' || file.media?.kind === 'audio' || file.media?.kind === 'video').length;
    if (composeInput) {
      composeInput.placeholder = count > 0
        ? mediaCount > 0
          ? `${fileLabel}. Ask Zavorth to describe, transcribe, or extract text.`
          : `${fileLabel}. Tell Zavorth what to do.`
        : getComposePlaceholder(composerSettingsState);
    }
    if (attachBtn) {
      attachBtn.classList.toggle('is-active', count > 0);
      attachBtn.setAttribute('aria-label', count > 0 ? (count === 1 ? '1 file attached' : `${count} files attached`) : 'Open tools');
    }
    if (attachFileTrigger) {
      attachFileTrigger.classList.toggle('is-active', count > 0);
      attachFileTrigger.setAttribute('aria-label', count > 0 ? (count === 1 ? '1 file attached' : `${count} files attached`) : 'Attach file');
    }
    if (attachmentTray) {
      attachmentTray.innerHTML = pendingAttachments.map((file, index) => `
        <span class="compose-attachment-chip ${file.media?.kind ? 'compose-attachment-chip--media' : ''}" title="${escapeHtml(file.extraction?.detail || file.name)}">
          <span class="compose-attachment-chip__icon">${escapeHtml(attachmentChipIcon(file))}</span>
          <span class="compose-attachment-chip__name">${escapeHtml(file.name)}</span>
          <span class="compose-attachment-chip__size">${formatBytes(file.size)} - ${escapeHtml(attachmentStatusLabel(file))}</span>
          <button type="button" class="compose-attachment-chip__remove" data-attachment-index="${index}" aria-label="Remove ${escapeHtml(file.name)}">&times;</button>
        </span>
      `).join('');
      attachmentTray.classList.toggle('is-visible', count > 0);
    }
    updateComposerBadges();
    updateSendAffordance();
  }

  async function addAttachmentFiles(fileList) {
    const incoming = Array.from(fileList || []).slice(0, Math.max(0, 5 - pendingAttachments.length));
    if (incoming.length === 0) return;
    const parsed = await Promise.all(incoming.map(readAttachmentFile));
    pendingAttachments = [...pendingAttachments, ...parsed].slice(0, 5);
    refreshAttachmentHint();
    const readyMedia = parsed.filter((file) => file.media?.kind === 'image' || file.media?.kind === 'audio' || file.media?.kind === 'video');
    emitLocalNotice(readyMedia.length > 0
      ? `${readyMedia.length === 1 ? 'Media file is' : `${readyMedia.length} media files are`} ready for analysis. Ask Zavorth what to extract or understand.`
      : incoming.length === 1
        ? `File ready: ${incoming[0].name}. Now tell Zavorth what to do with it.`
        : `${incoming.length} files ready. Now tell Zavorth what to do with them.`);
  }

  function buildSentAttachmentCards(files) {
    const items = Array.isArray(files) ? files : [];
    if (items.length === 0) return '';
    return `
      <div class="chat-attachment-grid" aria-label="Uploaded files">
        ${items.map((file, fileIdx) => {
          const isAudio = file.media?.kind === 'audio';
          const isTextPreview = file.text && file.text.trim().length > 0;
          
          const quickLookBtn = isTextPreview ? `
            <button type="button" class="chat-attachment-card__quicklook" data-quick-look-text="${escapeHtml(file.text)}" data-quick-look-name="${escapeHtml(file.name)}" title="Quick Look Preview">👁️</button>
          ` : '';

          if (isAudio) {
            return `
              <div class="chat-attachment-card chat-attachment-card--audio" title="${escapeHtml(file.name)}">
                <div class="chat-attachment-card__icon">🎵</div>
                <div class="chat-attachment-card__body">
                  <div class="chat-attachment-card__name">${escapeHtml(String(file.name || 'file').replace(/\.[^.]+$/, ''))}</div>
                  <div class="audio-waveform-player" data-audio-content="${file.content || ''}" data-audio-mime="${file.media?.mimeType || 'audio/wav'}">
                    <button class="audio-waveform-play-btn" type="button">▶</button>
                    <div class="audio-waveform-bars">
                      ${Array.from({ length: 16 }).map(() => `<span class="audio-waveform-bar"></span>`).join('')}
                    </div>
                    <span class="audio-waveform-time">0:00</span>
                  </div>
                  <div class="chat-attachment-card__meta">${formatBytes(file.size)} - Audio Player</div>
                </div>
              </div>
            `;
          }

          return `
            <div class="chat-attachment-card" title="${escapeHtml(file.name)}">
              ${quickLookBtn}
              <div class="chat-attachment-card__icon">${escapeHtml(attachmentKindLabel(file))}</div>
              <div class="chat-attachment-card__body">
                <div class="chat-attachment-card__name">${escapeHtml(String(file.name || 'file').replace(/\.[^.]+$/, ''))}</div>
                <div class="chat-attachment-card__meta">${escapeHtml(attachmentKindLabel(file))} - ${formatBytes(file.size)} - ${escapeHtml(attachmentStatusLabel(file))}</div>
                ${file.media?.kind ? `<div class="chat-attachment-card__status">${file.media.kind === 'video' ? 'Queued for video analysis' : 'Queued for visual analysis'}</div>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function attachmentStatusLabel(file) {
    if (file.media?.kind === 'image' && file.content) return 'Ready for visual analysis';
    if (file.media?.kind === 'audio' && file.content) return 'Ready for transcription';
    if (file.media?.kind === 'video' && file.content) return 'Ready for video analysis';
    return file.extraction?.label || (file.text ? 'Text extracted' : 'Attached');
  }

  function attachmentChipIcon(file) {
    if (file.media?.kind === 'image') return 'img';
    if (file.media?.kind === 'audio') return 'aud';
    if (file.media?.kind === 'video') return 'vid';
    return file.text ? 'doc' : 'file';
  }

  bindComposeInputEvents({
    composeInput,
    tokenCount,
    onSubmit: transmitSignal,
    onSendAffordance: updateSendAffordance,
  });

  // Feature 1: Autocomplete Event Wiring
  if (composeInput) {
    composeInput.addEventListener('input', () => {
      const text = (composeInput as HTMLTextAreaElement).value;
      const cursor = (composeInput as HTMLTextAreaElement).selectionStart || 0;
      const beforeCursor = text.slice(0, cursor);
      const lastSlashIdx = beforeCursor.lastIndexOf('/');
      
      if (lastSlashIdx !== -1 && !/\s/.test(beforeCursor.slice(lastSlashIdx))) {
        const query = beforeCursor.slice(lastSlashIdx).toLowerCase();
        autocompleteFiltered = getSlashCommandSuggestions(query, 9);
        autocompleteIndex = 0;
        renderAutocomplete();
      } else {
        hideAutocomplete();
      }
    });

    composeInput.addEventListener('keydown', (event) => {
      if (!autocompleteVisible) return;
      
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopImmediatePropagation();
        autocompleteIndex = (autocompleteIndex + 1) % autocompleteFiltered.length;
        renderAutocomplete();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopImmediatePropagation();
        autocompleteIndex = (autocompleteIndex - 1 + autocompleteFiltered.length) % autocompleteFiltered.length;
        renderAutocomplete();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        event.stopImmediatePropagation();
        selectAutocompleteOption(autocompleteIndex);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        hideAutocomplete();
      }
    }, { capture: true });

    document.addEventListener('click', (e) => {
      if (!autocompletePopover.contains(e.target as Node) && e.target !== composeInput) {
        hideAutocomplete();
      }
    });
  }

  // Audio Playback Cache & Waves States
  let activeAudioElement: HTMLAudioElement | null = null;
  let activeWaveformPlayer: HTMLElement | null = null;
  let waveAnimFrame: number | null = null;

  // Feature 2, 3 & 5 global click handlers
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    // --- FEATURE 2: Audio Waveform Player Click ---
    const playBtn = target.closest('.audio-waveform-play-btn');
    if (playBtn) {
      event.preventDefault();
      event.stopPropagation();
      
      const player = playBtn.closest('.audio-waveform-player') as HTMLElement;
      if (!player) return;

      const base64 = player.getAttribute('data-audio-content') || '';
      const mime = player.getAttribute('data-audio-mime') || 'audio/wav';
      if (!base64) {
        window.emitSignal?.('info', 'Audio player', 'No audio content available to play.');
        return;
      }

      if (activeAudioElement && activeWaveformPlayer === player) {
        if (activeAudioElement.paused) {
          activeAudioElement.play();
          playBtn.textContent = '⏸';
          startWaveformAnimation(player);
        } else {
          activeAudioElement.pause();
          playBtn.textContent = '▶';
          stopWaveformAnimation(player);
        }
        return;
      }

      if (activeAudioElement) {
        activeAudioElement.pause();
        if (activeWaveformPlayer) {
          const prevBtn = activeWaveformPlayer.querySelector('.audio-waveform-play-btn');
          if (prevBtn) prevBtn.textContent = '▶';
          stopWaveformAnimation(activeWaveformPlayer);
        }
      }

      const audioUrl = base64.startsWith('data:') ? base64 : `data:${mime};base64,${base64}`;
      const audio = new Audio(audioUrl);
      activeAudioElement = audio;
      activeWaveformPlayer = player;

      audio.addEventListener('timeupdate', () => {
        const timeSpan = player.querySelector('.audio-waveform-time');
        if (timeSpan) {
          const minutes = Math.floor(audio.currentTime / 60);
          const seconds = Math.floor(audio.currentTime % 60);
          timeSpan.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        }
        const progress = (audio.currentTime / audio.duration) * 100;
        player.style.setProperty('--wave-progress', `${progress}%`);
      });

      audio.addEventListener('ended', () => {
        playBtn.textContent = '▶';
        const timeSpan = player.querySelector('.audio-waveform-time');
        if (timeSpan) timeSpan.textContent = '0:00';
        player.style.setProperty('--wave-progress', '0%');
        stopWaveformAnimation(player);
        activeAudioElement = null;
        activeWaveformPlayer = null;
      });

      audio.play().then(() => {
        playBtn.textContent = '⏸';
        startWaveformAnimation(player);
      }).catch(() => {
        window.emitSignal?.('info', 'Audio error', 'Failed to play the audio stream.');
      });
      return;
    }

    // --- FEATURE 3: Quick Look Preview Click ---
    const quickLookBtn = target.closest('.chat-attachment-card__quicklook');
    if (quickLookBtn) {
      event.preventDefault();
      event.stopPropagation();
      const text = quickLookBtn.getAttribute('data-quick-look-text') || '';
      const name = quickLookBtn.getAttribute('data-quick-look-name') || 'document.txt';
      openQuickLookModal(name, text);
      return;
    }

    // --- FEATURE 5: Terminal Replay Launcher Click ---
    const replayBtn = target.closest('.trace-sheet__replay-btn');
    if (replayBtn) {
      event.preventDefault();
      event.stopPropagation();
      const runId = replayBtn.getAttribute('data-replay-run-id') || '';
      const traceId = replayBtn.getAttribute('data-replay-trace-id') || '';
      launchTerminalReplay(runId, traceId);
      return;
    }

    const memoryNode = target.closest('.zavorth-mem-node');
    if (memoryNode) {
      const tree = memoryNode.closest('#zavorth-memory-tree');
      const inspector = document.getElementById('zavorth-memory-inspection-body');
      if (tree && inspector) {
        event.preventDefault();
        event.stopPropagation();
        tree.querySelectorAll('.zavorth-mem-node').forEach((node) => node.classList.remove('is-inspected'));
        memoryNode.classList.add('is-inspected');
        renderMemoryInspectorFallback(memoryNode.id, inspector);
      }
      return;
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target as Element | null;
    const memoryNode = target?.closest?.('.zavorth-mem-node') as HTMLElement | null;
    if (!memoryNode) return;
    const tree = memoryNode.closest('#zavorth-memory-tree');
    const inspector = document.getElementById('zavorth-memory-inspection-body');
    if (!tree || !inspector) return;
    tree.querySelectorAll('.zavorth-mem-node').forEach((node) => node.classList.remove('is-inspected'));
    memoryNode.classList.add('is-inspected');
    renderMemoryInspectorFallback(memoryNode.id, inspector);
  }, { capture: true });

  function startWaveformAnimation(player: HTMLElement) {
    const bars = player.querySelectorAll('.audio-waveform-bar');
    if (bars.length === 0) return;
    
    function animate() {
      bars.forEach((bar) => {
        const height = Math.random() * 0.8 + 0.2;
        (bar as HTMLElement).style.transform = `scaleY(${height})`;
      });
      waveAnimFrame = requestAnimationFrame(animate);
    }
    animate();
  }

  function stopWaveformAnimation(player: HTMLElement) {
    if (waveAnimFrame) {
      cancelAnimationFrame(waveAnimFrame);
      waveAnimFrame = null;
    }
    const bars = player.querySelectorAll('.audio-waveform-bar');
    bars.forEach((bar) => {
      (bar as HTMLElement).style.transform = 'scaleY(0.2)';
    });
  }

  // Feature 3: Quick Look Modal
  function openQuickLookModal(fileName: string, fileContent: string) {
    document.getElementById('zavorth-quicklook-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'zavorth-quicklook-overlay active';
    overlay.id = 'zavorth-quicklook-overlay';
    
    const lines = fileContent.split('\n');
    const linedTextHtml = lines.map((line, idx) => `
      <div class="quicklook-line">
        <span class="quicklook-line-num">${idx + 1}</span>
        <span class="quicklook-line-text">${escapeHtml(line)}</span>
      </div>
    `).join('');

    overlay.innerHTML = `
      <div class="quicklook-backdrop"></div>
      <div class="quicklook-frame">
        <div class="quicklook-header">
          <div class="quicklook-header__copy">
            <span class="quicklook-eyebrow">👁️ Quick Look Preview</span>
            <h2>${escapeHtml(fileName)}</h2>
          </div>
          <div class="quicklook-actions">
            <button class="quicklook-copy-btn" type="button">Copy Content</button>
            <button class="quicklook-close-btn" type="button">&times;</button>
          </div>
        </div>
        <div class="quicklook-body">
          <div class="quicklook-code-viewport">
            ${linedTextHtml}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('.quicklook-close-btn')?.addEventListener('click', () => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 200);
    });
    
    overlay.querySelector('.quicklook-backdrop')?.addEventListener('click', () => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 200);
    });

    overlay.querySelector('.quicklook-copy-btn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(fileContent).then(() => {
        window.emitSignal?.('success', 'Content copied', 'Copied text from Quick Look to clipboard.');
      });
    });
  }

  function renderMemoryInspectorFallback(nodeId: string, inspector: HTMLElement) {
    const trustedFolders = Array.from(document.querySelectorAll('.trusted-workspace-card')).map((card) => ({
      label: card.querySelector('strong')?.textContent?.trim() || 'Trusted workspace',
      path: card.querySelector('span')?.textContent?.trim() || 'Path unavailable',
    }));
    const recentTrace = traceEvents
      .slice(-5)
      .map((event: any) => String(event?.title || event?.type || '').trim())
      .filter(Boolean);
    const persistedFacts = Array.isArray((window as any).ZavorthRuntimeBridge?.state?.memoryFacts?.facts)
      ? (window as any).ZavorthRuntimeBridge.state.memoryFacts.facts
      : [];
    const currentProvider = document.querySelector('[data-provider-model-catalog-summary]')?.textContent?.trim()
      || document.querySelector('[data-live-provider]')?.textContent?.trim()
      || 'Provider state not published yet';
    const memoryFacts = persistedFacts.length
      ? persistedFacts.slice(0, 12).map((fact: any) => `
          <div class="fact-item" id="memory-fact-${escapeHtml(fact.id || fact.key || '')}">
            <span>${escapeHtml(fact.content || fact.key || 'Persisted memory fact')}</span>
            <button type="button" class="fact-forget-btn" data-memory-key="${escapeHtml(fact.id || fact.key || '')}">Forget</button>
          </div>
        `).join('')
      : recentTrace.length
        ? recentTrace.map((title, index) => `
          <div class="fact-item" id="dashboard-trace-fact-${index + 1}">
            <span>${escapeHtml(title)}</span>
            <button type="button" class="fact-forget-btn" data-memory-key="dashboard-trace-fact-${index + 1}">Forget</button>
          </div>
        `).join('')
        : '<p class="no-facts-left">No persisted memory facts are published in this dashboard snapshot.</p>';
    const htmlByNode: Record<string, string> = {
      'mem-node-mind': `
        <div class="zavorth-inspection-card">
          <h3>Zavorth Core Mind</h3>
          <p>Current dashboard coordinator state, backed by the active Zavorth session when the runtime bridge is available.</p>
          <div class="inspection-fact-row"><span>Trace events</span><strong>${traceEvents.length}</strong></div>
          <div class="inspection-fact-row"><span>Bridge</span><strong>${(window as any).ZavorthRuntimeBridge ? 'available' : 'waiting'}</strong></div>
        </div>
      `,
      'mem-node-workspaces': `
        <div class="zavorth-inspection-card">
          <h3>Active Workspaces</h3>
          <p>Trusted folders currently rendered from the runtime settings API.</p>
          <div class="inspection-workspace-list">
            ${trustedFolders.length ? trustedFolders.map((folder) => `
              <div class="workspace-item"><strong>${escapeHtml(folder.label)}</strong><span>${escapeHtml(folder.path)}</span></div>
            `).join('') : '<p class="no-facts-left">No trusted workspace registered yet.</p>'}
          </div>
        </div>
      `,
      'mem-node-vault': `
        <div class="zavorth-inspection-card">
          <h3>Durable Fact Vault</h3>
          <p>Runtime-published facts appear here. In this fallback view, recent trace receipts are shown as session facts.</p>
          <div class="inspection-fact-vault" id="fact-vault-list">${memoryFacts}</div>
        </div>
      `,
      'mem-node-agents': `
        <div class="zavorth-inspection-card">
          <h3>Linked Agents</h3>
          <p>Agent and provider signals from the active dashboard session.</p>
          <div class="inspection-fact-row"><span>Provider catalog</span><strong>${escapeHtml(compactTraceText(currentProvider, 120))}</strong></div>
        </div>
      `,
      'mem-node-environments': `
        <div class="zavorth-inspection-card">
          <h3>Safe Environments</h3>
          <p>Execution and approval state exposed by the local runtime bridge.</p>
          <div class="inspection-fact-row"><span>Runtime bridge</span><strong>${(window as any).ZavorthRuntimeBridge ? 'connected' : 'not connected'}</strong></div>
          <div class="inspection-fact-row"><span>Trace buffer</span><strong>${traceEvents.length} event(s)</strong></div>
        </div>
      `,
    };
    inspector.innerHTML = htmlByNode[nodeId] || htmlByNode['mem-node-mind'];
    inspector.querySelectorAll('.fact-forget-btn').forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.preventDefault();
        const button = btn as HTMLButtonElement;
        const key = button.getAttribute('data-memory-key') || '';
        button.disabled = true;
        try {
          const bridge = (window as any).ZavorthRuntimeBridge;
          if (bridge?.forgetMemoryFact) {
            await bridge.forgetMemoryFact({ id: key });
            window.emitSignal?.('success', 'Memory forget requested', `Sent governed forget request for ${key}.`);
            button.closest('.fact-item')?.classList.add('forgetting');
            setTimeout(() => button.closest('.fact-item')?.remove(), 500);
          } else if (bridge?.sendChat) {
            await bridge.sendChat(`/memory forget ${key}`);
            window.emitSignal?.('success', 'Memory forget requested', `Sent governed forget request for ${key}.`);
            button.closest('.fact-item')?.classList.add('forgetting');
            setTimeout(() => button.closest('.fact-item')?.remove(), 500);
          } else {
            window.emitSignal?.('info', 'Memory forget unavailable', 'No runtime bridge is available for memory mutation.');
            button.disabled = false;
          }
        } catch (error: any) {
          window.emitSignal?.('info', 'Memory forget failed', String(error?.message || error || 'Request failed.'));
          button.disabled = false;
        }
      });
    });
  }

  // Feature 5: Terminal Replay Console Logic
  function launchTerminalReplay(runId: string, traceId: string) {
    document.getElementById('zavorth-terminal-replay-modal')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'zavorth-terminal-replay active';
    overlay.id = 'zavorth-terminal-replay-modal';

    overlay.innerHTML = `
      <div class="zavorth-terminal-replay__backdrop"></div>
      <div class="zavorth-terminal-replay__frame">
        <div class="zavorth-terminal-replay__header">
          <div class="zavorth-terminal-replay__header-dots">
            <span></span><span></span><span></span>
          </div>
          <div class="zavorth-terminal-replay__header-title">Zavorth Terminal Observatory [Replay: ${escapeHtml(runId || traceId || 'Live Run')}]</div>
          <button class="zavorth-terminal-replay__close" type="button">&times;</button>
        </div>
        <div class="zavorth-terminal-replay__body">
          <div class="zavorth-terminal-replay__screen">
            <div class="zavorth-terminal-replay__scanlines"></div>
            <div class="zavorth-terminal-replay__content" id="zavorth-terminal-replay-content">
              <!-- Replay lines will be typed here -->
            </div>
          </div>
        </div>
        <div class="zavorth-terminal-replay__footer">
          <span class="zavorth-terminal-replay__status">SYSTEM STATUS: REPLAYING_RUN</span>
          <div class="zavorth-terminal-replay__controls">
            <button class="replay-ctrl-btn active" id="replay-speed-1x" type="button">1x</button>
            <button class="replay-ctrl-btn" id="replay-speed-2x" type="button">2x</button>
            <button class="replay-ctrl-btn" id="replay-pause" type="button">Pause</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const eventMatchesReplay = (event: any) => {
      if (!runId && !traceId) return true;
      const replay = event?.replay || {};
      return [event?.runId, event?.agentRunId, event?.id, replay.runId].filter(Boolean).includes(runId)
        || [event?.traceId, replay.traceId].filter(Boolean).includes(traceId);
    };
    const replayEvents = traceEvents
      .filter(eventMatchesReplay)
      .slice(-80);
    const logs = [
      { type: 'system', text: `>> REPLAYING ZAVORTH TRACE [${runId || traceId || 'current-session'}]` },
      ...replayEvents.map((event: any) => {
        const type = /error|failed|blocked|rejected/i.test(`${event?.type || ''} ${event?.status || ''}`)
          ? 'error'
          : /receipt|success|done|completed/i.test(`${event?.type || ''} ${event?.status || ''}`)
            ? 'success'
            : /command|terminal|tool|mcp/i.test(`${event?.type || ''} ${event?.title || ''}`)
              ? 'cmd'
              : 'log';
        const title = event?.title || event?.type || 'runtime event';
        const detail = event?.detail || event?.meta || event?.preview || '';
        const time = event?.time || event?.createdAt || new Date().toLocaleTimeString();
        return {
          type,
          text: `[${time}] [${String(event?.type || 'event').toUpperCase()}] ${title}${detail ? ` - ${detail}` : ''}`,
        };
      }),
      replayEvents.length
        ? { type: 'success', text: `>> REPLAY COMPLETE. ${replayEvents.length} real trace event(s) rendered.` }
        : { type: 'system', text: '>> NO MATCHING TRACE EVENTS YET. Run a task first, then replay its receipt.' },
    ];

    let replayIndex = 0;
    let speedMs = 80;
    let isPaused = false;

    const content = overlay.querySelector('#zavorth-terminal-replay-content') as HTMLElement;
    const speed1xBtn = overlay.querySelector('#replay-speed-1x');
    const speed2xBtn = overlay.querySelector('#replay-speed-2x');
    const pauseBtn = overlay.querySelector('#replay-pause');

    function printNextLine() {
      if (isPaused) return;
      if (replayIndex >= logs.length) {
        const doneDiv = document.createElement('div');
        doneDiv.className = 'terminal-replay-line terminal-replay-line--success';
        doneDiv.textContent = '>> REPLAY SEQUENCE COMPLETED.';
        content.appendChild(doneDiv);
        content.scrollTop = content.scrollHeight;
        return;
      }

      const log = logs[replayIndex];
      const lineDiv = document.createElement('div');
      lineDiv.className = `terminal-replay-line terminal-replay-line--${log.type}`;
      content.appendChild(lineDiv);

      let charIdx = 0;
      const text = log.text;
      const typing = setInterval(() => {
        if (isPaused) {
          clearInterval(typing);
          return;
        }
        if (charIdx >= text.length) {
          clearInterval(typing);
          replayIndex++;
          setTimeout(printNextLine, 100);
        } else {
          lineDiv.textContent += text[charIdx];
          charIdx++;
          content.scrollTop = content.scrollHeight;
        }
      }, speedMs === 40 ? 5 : 10);
    }

    printNextLine();

    const closeModal = () => {
      isPaused = true;
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 200);
    };

    overlay.querySelector('.zavorth-terminal-replay__close')?.addEventListener('click', closeModal);
    overlay.querySelector('.zavorth-terminal-replay__backdrop')?.addEventListener('click', closeModal);

    speed1xBtn?.addEventListener('click', () => {
      speedMs = 80;
      speed1xBtn.classList.add('active');
      speed2xBtn?.classList.remove('active');
    });

    speed2xBtn?.addEventListener('click', () => {
      speedMs = 40;
      speed2xBtn.classList.add('active');
      speed1xBtn?.classList.remove('active');
    });

    pauseBtn?.addEventListener('click', () => {
      isPaused = !isPaused;
      pauseBtn.classList.toggle('active', isPaused);
      pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
      if (!isPaused) printNextLine();
    });
  }

  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) sendBtn.addEventListener('click', () => {
    closeMobileComposerActions();
    transmitSignal();
  });

  const toolSheet = document.getElementById('tool-sheet');
  const toolSheetTrigger = document.getElementById('tool-sheet-trigger');
  const toolSheetClose = document.getElementById('tool-sheet-close');
  const toolSheetActions = document.querySelectorAll('[data-tool-sheet-action]');
  const traceSheet = document.getElementById('trace-sheet');
  const traceSheetTrigger = document.getElementById('trace-sheet-trigger');
  const traceSheetClose = document.getElementById('trace-sheet-close');
  const traceSheetTimeline = document.getElementById('trace-sheet-timeline');
  const traceStepCount = document.getElementById('trace-step-count');
  const traceApprovalCount = document.getElementById('trace-approval-count');
  const traceReceiptCount = document.getElementById('trace-receipt-count');
  const attachFileTrigger = document.getElementById('attach-file-trigger');
  const composerSettingsTrigger = document.getElementById('compose-settings-trigger');
  const composerSettingsPanel = document.getElementById('compose-settings-panel');
  const exportChatTrigger = document.getElementById('export-chat-trigger');
  const newSessionTrigger = document.getElementById('new-session-trigger');
  const stopRunTrigger = document.getElementById('stop-run-trigger') as HTMLButtonElement | null;
  const runtimeProgressPill = document.querySelector('[data-runtime-progress-pill]') as HTMLElement | null;
  const attachmentCountBadge = document.getElementById('attachment-count-badge');
  const voiceStateBadge = document.getElementById('voice-state-badge');
  const toolCountBadge = document.getElementById('tool-count-badge');
  const historyCountBadge = document.getElementById('history-count-badge');
  const attachBtn = toolSheetTrigger || document.querySelector('.compose-dock__btn[title="Tools"]');
  const skillsBtn = document.querySelector('.compose-dock__btn[title="Tools"]');
  const voiceBtn = document.getElementById('voice-trigger') || document.querySelector('.compose-dock__btn[title="Voice"]');
  const fileInput = createHiddenFileInput();
  const directoryInput = createHiddenFileInput({ directory: true });
  const mobileComposerActions = createMobileComposerActions();
  const traceEvents = [];
  const traceEventIds = new Set();
  const TRACE_EVENT_LIMIT = 90;
  let suppressTraceCapture = false;
  let dashboardLiveView = null;

  function isMobileComposerActions() {
    return true;
  }

  function createMobileComposerActions() {
    if (!composeFrame || document.getElementById('compose-mobile-actions')) {
      return document.getElementById('compose-mobile-actions');
    }
    const tray = document.createElement('div');
    tray.className = 'compose-mobile-actions';
    tray.id = 'compose-mobile-actions';
    tray.setAttribute('aria-hidden', 'true');
    tray.innerHTML = `
      <button type="button" data-mobile-compose-action="attach" aria-label="Attach file">
        <svg viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
        <span>Attach file</span>
      </button>
      <button type="button" data-mobile-compose-action="tools" aria-label="Tools">
        <svg viewBox="0 0 24 24"><path d="M12 3v18"/><path d="M3 12h18"/></svg>
        <span>Tools</span>
      </button>
      <button type="button" data-mobile-compose-action="history" aria-label="History">
        <svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 15l3-3 3 2 5-7"/></svg>
        <span>History</span>
      </button>
      <button type="button" data-mobile-compose-action="settings" aria-label="Message settings">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
        <span>Settings</span>
      </button>
      <button type="button" data-mobile-compose-action="new" aria-label="New session">
        <svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        <span>New session</span>
      </button>
      <button type="button" data-mobile-compose-action="export" aria-label="Export chat">
        <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
        <span>Export</span>
      </button>
    `;
    composeFrame.appendChild(tray);
    return tray;
  }

  function setMobileComposerActionsOpen(open) {
    if (!mobileComposerActions || !toolSheetTrigger) return;
    const willOpen = Boolean(open);
    composeDock?.classList.toggle('is-mobile-actions-open', willOpen);
    composeFrame?.classList.toggle('is-mobile-actions-open', willOpen);
    mobileComposerActions.setAttribute('aria-hidden', willOpen ? 'false' : 'true');
    toolSheetTrigger.classList.toggle('is-mobile-menu-open', willOpen);
    toolSheetTrigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    toolSheetTrigger.setAttribute('aria-label', willOpen ? 'Close composer actions' : 'More composer actions');
    toolSheetTrigger.setAttribute('title', willOpen ? 'Close actions' : 'More actions');
  }

  function closeMobileComposerActions() {
    setMobileComposerActionsOpen(false);
  }

  function toggleMobileComposerActions() {
    const open = !composeFrame?.classList.contains('is-mobile-actions-open');
    setMobileComposerActionsOpen(open);
    if (open) {
      closeToolSheet(false);
      closeTraceSheet(false);
      closeSkillPopover();
      closeComposerSettings();
    }
  }

  function updateDashboardGlass() {
    dashboardLiveView?.updateDashboardGlass();
    window.ZavorthLocale?.apply();
    if (typeof hydrateConsoleLogs === 'function') hydrateConsoleLogs();
  }

  function setComposerRunState(state: 'idle' | 'running' | 'cancelling') {
    const active = state === 'running' || state === 'cancelling';
    if (runtimeProgressPill) {
      runtimeProgressPill.hidden = !active;
      runtimeProgressPill.textContent = state === 'cancelling' ? 'Stopping' : 'In progress';
      runtimeProgressPill.dataset.runtimeState = state;
    }
    if (sendBtn) {
      sendBtn.hidden = active;
      sendBtn.setAttribute('aria-disabled', active ? 'true' : 'false');
    }
    if (stopRunTrigger) {
      stopRunTrigger.hidden = !active;
      stopRunTrigger.disabled = state === 'cancelling';
      stopRunTrigger.dataset.runtimeState = state;
    }
    composeDock?.classList.toggle('is-runtime-active', active);
  }

  window.addEventListener('zavorth-control-locale-change', () => {
    applyComposerSettingsToUi();
    refreshAttachmentHint();
    updateDashboardGlass();
  });

  const overlays = createOverlayController({
    coreFrame,
    sanitizeTrustedHtml: (content) => sanitizeRenderedHtml(content, { allowTrustedUi: true }),
    onDismiss: () => {
      closeToolSheet(false);
      closeTraceSheet(false);
    },
    onActivateSector: (sectorId) => {
      const dockNode = document.querySelector(`.dock-node[data-sector="${sectorId}"]`);
      if (dockNode) dockNode.click();
    },
  });
  const getOverlayShade = overlays.getOverlayShade;
  const markOverlayOpened = overlays.markOverlayOpened;
  const dismissOverlays = overlays.dismissOverlays;

  function recordTraceEvent(event = {}) {
    if (suppressTraceCapture) return;
    const type = String(event.type || 'event').trim() || 'event';
    const stableId = String(event.id || '').trim();
    if (stableId && traceEventIds.has(stableId)) {
      return;
    }
    const entry = normalizeTraceEvent(event, currentTimestamp);
    traceEvents.push(entry);
    if (stableId) traceEventIds.add(stableId);
    if (traceEvents.length > TRACE_EVENT_LIMIT) traceEvents.splice(0, traceEvents.length - TRACE_EVENT_LIMIT);
    renderTraceSheet();
    updateComposerBadges();
    updateDashboardGlass();
    
    if (typeof appendConsoleLog === 'function') appendConsoleLog(entry);
  }

  function ingestRuntimeEvents(events = [], options = {}) {
    if (!Array.isArray(events) || events.length === 0) {
      updateDashboardGlass();
      return false;
    }
    let changed = false;
    const previousSuppress = suppressTraceCapture;
    suppressTraceCapture = false;
    for (const event of events) {
      const id = String(event?.id || '').trim();
      if (id && traceEventIds.has(id)) continue;
      recordTraceEvent({
        ...event,
        id,
        source: event?.source || options.source || 'runtime-history',
      });
      changed = true;
    }
    suppressTraceCapture = previousSuppress;
    if (changed) {
      traceEvents.sort((a, b) => {
        const left = String(a.time || '').localeCompare(String(b.time || ''));
        return left || String(a.id || '').localeCompare(String(b.id || ''));
      });
      if (traceEvents.length > TRACE_EVENT_LIMIT) traceEvents.splice(0, traceEvents.length - TRACE_EVENT_LIMIT);
    }
    renderTraceSheet();
    updateComposerBadges();
    updateDashboardGlass();
    return changed;
  }

  function capabilityFromElement(node) {
    if (!node?.dataset) return null;
    return normalizeTraceCapability({
      label: node.dataset.capabilityLabel,
      kind: node.dataset.capabilityKind,
      sideEffect: node.dataset.capabilitySideEffect,
      scope: node.dataset.capabilityScope,
      risk: node.dataset.capabilityRisk,
      preview: node.dataset.capabilityPreview,
      reason: node.dataset.capabilityReason,
      approval: node.dataset.status,
    });
  }

  function renderTraceSheet() {
    if (!traceSheetTimeline) return;
    const visibleEvents = traceEvents.filter((event) => traceEventMatchesQuery(event));
    const steps = visibleEvents.filter((event) => traceEventClass(event.type) === 'step' || traceEventClass(event.type) === 'message').length;
    const approvals = visibleEvents.filter((event) => traceEventClass(event.type) === 'approval').length;
    const receipts = visibleEvents.filter((event) => traceEventClass(event.type) === 'receipt').length;
    if (traceStepCount) traceStepCount.textContent = String(steps);
    if (traceApprovalCount) traceApprovalCount.textContent = String(approvals);
    if (traceReceiptCount) traceReceiptCount.textContent = String(receipts);

    traceSheetTimeline.innerHTML = renderTraceTimelineHtml(visibleEvents, traceSheetQuery);

    requestAnimationFrame(() => {
      traceSheetTimeline.scrollTop = traceSheetTimeline.scrollHeight;
    });
  }

  dashboardLiveView = createDashboardLiveView({
    getTraceEvents: () => traceEvents,
    getNeuralFeed: () => neuralFeed,
    getCurrentModelLabel,
    getCurrentModelRouteLabel,
    dashboardStatusText,
    compactTraceText,
    traceEventClass,
    traceEventLabel,
    escapeHtml,
  });

  const controlSheets = createControlSheets({
    closeSkillPopover,
    escapeHtml,
    getOverlayShade,
    getToolSheetState: () => ({
      attachmentCount: pendingAttachments.length,
      hasMedia: pendingAttachments.some((file) => /^(image|video|audio)\//i.test(file.type || '')),
      hasVoice: Boolean(lastVoiceInput),
      isListening,
      selectedSkills: pendingSelectedSkills,
    }),
    markOverlayOpened,
    onTraceQueryChange: (query) => {
      traceSheetQuery = query;
    },
    renderTraceSheet,
    toolSheet,
    toolSheetTrigger,
    traceSheet,
    traceSheetTrigger,
  });
  const {
    closeToolSheet,
    closeTraceSheet,
    openToolSheet,
    openTraceSheet,
    updateToolSheetState,
  } = controlSheets;

  function focusComposeWithPrompt(prompt) {
    if (!composeInput) return;
    const current = composeInput.value.trim();
    composeInput.value = current ? `${prompt}\n\n${current}` : prompt;
    composeInput.dispatchEvent(new Event('input'));
    composeInput.focus();
  }

  function getCurrentExperienceProfile(): ExperienceProfileUiContract {
    return getExperienceProfile(selectedExperienceProfile || 'personal');
  }

  function renderExperienceProfilePanel(profile: ExperienceProfileUiContract) {
    const terminalHero = document.getElementById('terminal-hero');
    if (!terminalHero) return;
    let panel = document.getElementById('experience-profile-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'experience-profile-panel';
      panel.className = 'experience-profile-panel';
      panel.addEventListener('click', (event) => {
        const button = (event.target as HTMLElement | null)?.closest?.('[data-profile]');
        const profile = button?.getAttribute('data-profile');
        if (!profile) return;
        setSelectedExperienceProfile(profile);
        focusComposeWithPrompt(`Use ${getExperienceProfile(profile).label} mode for this request.`);
      });
      terminalHero.appendChild(panel);
    }
    const channelBadges = profile.suggestedChannels
      .map((channel) => `<span>${escapeHtml(channel)}</span>`)
      .join('');
    const capabilityBadges = profile.suggestedCapabilities
      .slice(0, 5)
      .map((capability) => `<span>${escapeHtml(capability)}</span>`)
      .join('');
    const checklist = profile.checklist
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join('');
    const buttons = EXPERIENCE_PROFILE_CATALOG
      .map((item) => `
        <button type="button" data-profile="${escapeHtml(item.id)}" aria-pressed="${item.id === profile.id ? 'true' : 'false'}" class="${item.id === profile.id ? 'is-selected' : ''}">
          ${escapeHtml(item.label)}
        </button>
      `)
      .join('');
    panel.innerHTML = `
      <div class="experience-profile-panel__header">
        <span>Current profile</span>
        <strong>${escapeHtml(profile.label)}</strong>
        <small>${escapeHtml(profile.summary)}</small>
      </div>
      <div class="experience-profile-panel__body">
        <div>
          <span class="experience-profile-panel__label">Start here</span>
          <ul>${checklist}</ul>
        </div>
        <div>
          <span class="experience-profile-panel__label">Suggested routes</span>
          <div class="experience-profile-panel__badges">${channelBadges}</div>
          <div class="experience-profile-panel__badges experience-profile-panel__badges--muted">${capabilityBadges}</div>
        </div>
      </div>
      <div class="experience-profile-panel__switcher" aria-label="Experience profile">
        ${buttons}
      </div>
      <p class="experience-profile-panel__hint">Say "${escapeHtml(profile.naturalPrompts[0])}" any time. This changes wording and setup, not execution authority.</p>
    `;
  }

  function setSelectedExperienceProfile(profile) {
    const resolved = resolveExperienceProfile(profile, selectedExperienceProfile || 'personal');
    selectedExperienceProfile = resolved.id;
    persistExperienceProfile(getPromptQueueStorage(), resolved.id);
    document.querySelectorAll('[data-profile]').forEach((node) => {
      const active = String(node.getAttribute('data-profile') || '').toLowerCase() === selectedExperienceProfile;
      node.classList.toggle('is-selected', active);
      node.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (selectedExperienceProfile) {
      renderExperienceProfilePanel(resolved);
      recordTraceEvent({
        type: 'step',
        title: 'Experience profile selected',
        detail: `${resolved.label}: ${resolved.approvalTone}`,
        meta: 'dashboard',
        status: 'ready',
      });
    }
  }

  function applyNaturalExperienceProfileSwitch(text) {
    const normalized = String(text || '').trim().toLowerCase();
    if (!/\b(use|switch|mode|profile|modo|perfil|troque|usar|quero)\b/.test(normalized)) return;
    const resolved = resolveExperienceProfile(normalized, selectedExperienceProfile || 'personal');
    if (resolved.id !== selectedExperienceProfile) {
      setSelectedExperienceProfile(resolved.id);
    }
  }

  function chooseAttachmentFiles(accept) {
    if (accept) fileInput.setAttribute('accept', accept);
    else fileInput.removeAttribute('accept');
    fileInput.click();
  }

  function chooseWorkspaceFolder() {
    directoryInput.value = '';
    directoryInput.click();
  }

  function closeComposerSettings() {
    if (!composerSettingsPanel) return;
    composerSettingsPanel.classList.add('hidden');
    composerSettingsTrigger?.classList.remove('is-active');
    composerSettingsTrigger?.setAttribute('aria-expanded', 'false');
  }

  function toggleComposerSettings() {
    if (!composerSettingsPanel) return;
    const willOpen = composerSettingsPanel.classList.contains('hidden');
    if (willOpen) ensureComposerPresets();
    composerSettingsPanel.classList.toggle('hidden', !willOpen);
    composerSettingsTrigger?.classList.toggle('is-active', willOpen);
    composerSettingsTrigger?.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    if (willOpen) closeSkillPopover();
  }

  function ensureComposerPresets() {
    if (!composerSettingsPanel || composerSettingsPanel.querySelector('.compose-settings-presets')) return;
    const presets = document.createElement('div');
    presets.className = 'compose-settings-presets';
    presets.innerHTML = `
      <span>Presets</span>
      <button type="button" data-composer-preset="balanced">Balanced</button>
      <button type="button" data-composer-preset="safe-review">Safe review</button>
      <button type="button" data-composer-preset="fast-local">Fast local</button>
    `;
    composerSettingsPanel.insertBefore(presets, composerSettingsPanel.firstChild);
    presets.addEventListener('click', (event) => {
      const button = event.target.closest('[data-composer-preset]');
      if (!button) return;
      const preset = button.getAttribute('data-composer-preset');
      const next = composerPresetSettings(preset);
      writeComposerSettings({ ...composerSettingsState, ...next });
      emitLocalNotice(`Composer preset applied: ${button.textContent.trim()}.`);
    });
  }

  function getConversationExportContext() {
    return {
      sessionId: sessionStorage.getItem('zavorth.zavorthControl.sessionId') || '',
      traceEvents,
      composer: {
        settings: composerSettingsState,
        selectedTools: pendingSelectedSkills,
        attachments: pendingAttachments.map((file) => ({
          name: file.name,
          type: file.type,
          size: file.size,
          truncated: Boolean(file.truncated),
          extraction: file.extraction || null,
        })),
      },
    };
  }

  function exportCurrentConversation(format = 'md') {
    emitLocalNotice(exportConversation(format, getConversationExportContext()));
  }

  function openExportMenu() {
    if (typeof window.openCoreModal !== 'function') {
      exportCurrentConversation('md');
      return;
    }
    window.openCoreModal('Export conversation', getExportMenuHtml());
    const cancel = document.getElementById('core-modal-cancel');
    const confirm = document.getElementById('core-modal-confirm');
    if (cancel) {
      cancel.textContent = 'Close';
      cancel.onclick = dismissOverlays;
    }
    if (confirm) {
      confirm.textContent = 'Export Markdown';
      confirm.disabled = false;
      confirm.onclick = () => {
        exportCurrentConversation('md');
        dismissOverlays();
      };
    }
    document.querySelectorAll('.zavorth-export-menu button').forEach((button, index) => {
      const format = ['md', 'json', 'txt'][index] || 'md';
      button.addEventListener('click', () => {
        exportCurrentConversation(format);
        dismissOverlays();
      });
    });
  }

  function startNewLocalSession() {
    const sessionId = `web-${Date.now().toString(36)}`;
    try {
      sessionStorage.setItem('zavorth.zavorthControl.sessionId', sessionId);
      sessionStorage.removeItem('zavorth.zavorthControl.runId');
      const url = new URL(window.location.href);
      url.searchParams.set('sessionId', sessionId);
      url.searchParams.delete('runId');
      history.replaceState(null, '', url);
    } catch {
      // Session storage can be unavailable in restricted browsers.
    }
    const feed = document.getElementById('neural-feed');
    if (feed) feed.innerHTML = '';
    const terminalView = document.getElementById('terminal-view');
    if (terminalView) terminalView.classList.add('is-empty');
    if (composeInput) {
      composeInput.value = '';
      composeInput.style.height = 'auto';
      composeInput.focus();
      composeInput.dispatchEvent(new Event('input'));
    }
    pendingAttachments = [];
    pendingSelectedSkills = [];
    pendingGuidedFlow = '';
    persistPromptQueue();
    promptQueueSessionKey = sessionId;
    promptQueue = [];
    persistPromptQueue();
    lastVoiceInput = null;
    traceSheetQuery = { runId: '', traceId: '', sessionId: '', source: '' };
    traceEvents.length = 0;
    traceEventIds.clear();
    refreshAttachmentHint();
    renderPromptQueue();
    renderTraceSheet();
    window.ZavorthRuntimeBridge?.suppressTranscriptRender?.(2500);
    recordTraceEvent({
      type: 'session',
      title: 'New local session',
      detail: sessionId,
      meta: 'composer',
      status: 'ready',
    });
    window.ZavorthRuntimeBridge?.disconnectRealtime?.('new-session');
    emitLocalNotice('New session ready. Write the next request for Zavorth.');
  }

  function summarizeWorkspaceSelection(fileList) {
    const files = Array.from(fileList || []);
    const firstPath = String(files[0]?.webkitRelativePath || files[0]?.name || 'selected workspace');
    const root = firstPath.includes('/') ? firstPath.split('/')[0] : 'selected workspace';
    const extensionCounts = new Map();
    const sampleFiles = [];
    let totalBytes = 0;
    for (const file of files.slice(0, 3000)) {
      totalBytes += Number(file.size || 0);
      const relativePath = String(file.webkitRelativePath || file.name || '').replace(/\\/g, '/');
      if (sampleFiles.length < 8 && relativePath) sampleFiles.push(relativePath);
      const name = relativePath.split('/').pop() || relativePath;
      const extension = name.includes('.') ? `.${name.split('.').pop().toLowerCase()}` : '(none)';
      extensionCounts.set(extension, (extensionCounts.get(extension) || 0) + 1);
    }
    const topExtensions = Array.from(extensionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([extension, count]) => ({ extension, count }));
    return {
      source: 'folder-picker',
      root,
      fileCount: files.length,
      sampledFileCount: Math.min(files.length, 3000),
      totalBytes,
      topExtensions,
      sampleFiles,
      selectedAt: new Date().toISOString(),
    };
  }

  if (attachBtn) {
    attachBtn.addEventListener('click', (event) => {
      if (isMobileComposerActions()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        toggleMobileComposerActions();
        return;
      }
      openToolSheet();
    });
  }
  if (attachFileTrigger) {
    attachFileTrigger.addEventListener('click', () => chooseAttachmentFiles(''));
  }
  if (composerSettingsTrigger) {
    composerSettingsTrigger.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleComposerSettings();
    });
  }
  if (exportChatTrigger) {
    exportChatTrigger.addEventListener('click', openExportMenu);
  }
  if (newSessionTrigger) {
    newSessionTrigger.addEventListener('click', startNewLocalSession);
  }
  if (stopRunTrigger) {
    stopRunTrigger.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      setComposerRunState('cancelling');
      try {
        const runtimeBridge = window.ZavorthRuntimeBridge;
        if (runtimeBridge && typeof runtimeBridge.cancelActiveRun === 'function') {
          await runtimeBridge.cancelActiveRun({
            reason: 'User pressed Stop in ZavorthControl.',
            emitSignal: window.emitSignal,
          });
        } else {
          removeThinkingState();
          window.ZavorthRuntimeBridge?.disconnectRealtime?.('user-stop');
        }
        recordTraceEvent({
          type: 'step',
          title: 'Run stop requested',
          detail: 'The active Zavorth run was asked to stop from the composer.',
          status: 'cancelled',
        });
      } catch (error: any) {
        window.emitSignal?.('error', 'Stop failed', error?.message || 'Could not cancel the active run.');
      } finally {
        removeThinkingState();
        setComposerRunState('idle');
        updateDashboardGlass();
      }
    });
  }
  if (mobileComposerActions) {
    mobileComposerActions.addEventListener('click', (event) => {
      const button = event.target.closest?.('[data-mobile-compose-action]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const action = button.getAttribute('data-mobile-compose-action');
      closeMobileComposerActions();
      if (action === 'attach') chooseAttachmentFiles('');
      if (action === 'tools') openToolSheet();
      if (action === 'history') openTraceSheet();
      if (action === 'settings') toggleComposerSettings();
      if (action === 'new') startNewLocalSession();
      if (action === 'export') openExportMenu();
    });
  }
  if (promptQueueBar) {
    promptQueueBar.addEventListener('click', (event) => {
      const target = event.target;
      const clear = target.closest?.('[data-prompt-queue-clear]');
      if (clear) {
        clearPromptQueue();
        return;
      }
      const flush = target.closest?.('[data-prompt-queue-flush]');
      if (flush) {
        drainPromptQueue().catch(() => undefined);
        return;
      }
      const remove = target.closest?.('[data-prompt-queue-remove]');
      if (remove) {
        removeQueuedPrompt(remove.getAttribute('data-prompt-queue-remove') || '');
        return;
      }
      const steer = target.closest?.('[data-prompt-queue-steer]');
      if (steer) {
        steerQueuedPrompt(steer.getAttribute('data-prompt-queue-steer') || '').catch(() => undefined);
        return;
      }
      const send = target.closest?.('[data-prompt-queue-send]');
      if (send) {
        const id = send.getAttribute('data-prompt-queue-send') || '';
        const index = promptQueue.findIndex((item) => item.id === id);
        if (index >= 0) {
          const [item] = promptQueue.splice(index, 1);
          promptQueue.unshift(item);
          renderPromptQueue();
          drainPromptQueue().catch(() => undefined);
        }
      }
    });
  }
  document.addEventListener('click', (event) => {
    if (!composeFrame?.classList.contains('is-mobile-actions-open')) return;
    if (composeFrame.contains(event.target)) return;
    closeMobileComposerActions();
  });
  window.addEventListener('resize', () => {
    if (!isMobileComposerActions()) closeMobileComposerActions();
  });
  document.querySelectorAll('[data-composer-setting]').forEach((field) => {
    field.addEventListener('change', () => {
      const key = field.getAttribute('data-composer-setting');
      if (!key) return;
      writeComposerSettings({ ...composerSettingsState, [key]: field.value });
    });
  });
  document.querySelectorAll('[data-composer-toggle]').forEach((toggle) => {
    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const key = toggle.getAttribute('data-composer-toggle');
      if (!key) return;
      writeComposerSettings({ ...composerSettingsState, [key]: !composerSettingsState[key] });
      if (key === 'tools' && composerSettingsState.tools) openSkillPopover();
      if (key === 'focus') emitLocalNotice(composerSettingsState.focus ? 'Focus mode on.' : 'Focus mode off.');
    });
  });
  document.addEventListener('click', (event) => {
    if (!composerSettingsPanel || composerSettingsPanel.classList.contains('hidden')) return;
    if (composerSettingsPanel.contains(event.target) || composerSettingsTrigger?.contains(event.target)) return;
    closeComposerSettings();
  });
  applyComposerSettingsToUi();

  if (toolSheetClose) toolSheetClose.addEventListener('click', () => closeToolSheet());
  if (traceSheetTrigger) traceSheetTrigger.addEventListener('click', () => {
    closeMobileComposerActions();
    openTraceSheet();
  });
  if (traceSheetClose) traceSheetClose.addEventListener('click', () => closeTraceSheet());

  bindToolSheetActions({
    toolSheetActions,
    closeToolSheet,
    chooseAttachmentFiles,
    openSkillPopover,
    triggerVoice: () => voiceBtn?.click(),
    focusComposeWithPrompt,
  });

  bindAttachmentTray({
    attachmentTray,
    removeAttachmentAt: (index) => {
      pendingAttachments.splice(index, 1);
      refreshAttachmentHint();
    },
  });

  bindComposerContextBar({
    composerContextBar,
    removeSkill: (skillId) => {
      pendingSelectedSkills = pendingSelectedSkills.filter((skill) => skill.id !== skillId);
      updateComposerBadges();
      updateSendAffordance();
    },
  });

  bindFileInputEvents({
    fileInput,
    directoryInput,
    onFiles: addAttachmentFiles,
    onDirectory: (files) => {
    pendingWorkspaceSelection = summarizeWorkspaceSelection(files);
    emitLocalNotice(`Workspace selected: ${pendingWorkspaceSelection.root} (${pendingWorkspaceSelection.fileCount} files).`);
    pendingGuidedFlow = 'developer-review-workspace';
    if (!selectedExperienceProfile) setSelectedExperienceProfile('developer');
    if (composeInput) {
      composeInput.value = `Review this repository safely: ${pendingWorkspaceSelection.root}. Read first, list risks, show patch preview, and do not edit without approval.`;
      composeInput.dispatchEvent(new Event('input'));
    }
    window.setTimeout(transmitSignal, 60);
    },
  });

  bindComposerFileDrop({
    composeFrame,
    composeInput,
    onFiles: addAttachmentFiles,
  });

  function closeSkillPopover() {
    if (!skillPopover) return;
    skillPopover.classList.add('hidden');
    if (skillsBtn) skillsBtn.classList.remove('is-active');
    updateComposerBadges();
  }

  function openSkillPopover() {
    if (!skillPopover) return;
    const options = buildSkillOptions();
    skillPopover.innerHTML = buildSkillPopoverHtml(options, pendingSelectedSkills);
    skillPopover.querySelectorAll('.compose-skill-option').forEach((option) => {
      option.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        applySelectedSkill(option);
      });
    });
    skillPopover.classList.remove('hidden');
    if (skillsBtn) skillsBtn.classList.add('is-active');
    updateComposerBadges();
  }

  function applySelectedSkill(option) {
    if (!option || !composeInput) return;
    const selectedSkill = skillFromOption(option);
    if (!selectedSkill) return;
    if (!pendingSelectedSkills.some((skill) => skill.id === selectedSkill.id)) {
      pendingSelectedSkills.push(selectedSkill);
    }
    const skillPrompt = promptForSkill(selectedSkill);
    const current = composeInput.value.trim();
    composeInput.value = current ? `${skillPrompt}

${current}` : skillPrompt;
    composeInput.dispatchEvent(new Event('input'));
    composeInput.focus();
    closeSkillPopover();
    updateComposerBadges();
  }

  if (skillsBtn) {
    skillsBtn.addEventListener('click', (event) => {
      if (isMobileComposerActions()) {
        event.preventDefault();
        return;
      }
      if (!skillPopover) return;
      if (skillPopover.classList.contains('hidden')) openSkillPopover();
      else closeSkillPopover();
    });
  }

  if (skillPopover) {
    skillPopover.addEventListener('click', (event) => {
      const close = event.target.closest('.compose-skill-popover__close');
      if (close) {
        closeSkillPopover();
        return;
      }
      const option = event.target.closest('[data-skill-prompt]');
      if (!option) return;
      applySelectedSkill(option);
    });
  }

  document.addEventListener('click', (event) => {
    if (!skillPopover || skillPopover.classList.contains('hidden')) return;
    if (skillPopover.contains(event.target) || skillsBtn?.contains(event.target)) return;
    closeSkillPopover();
  });

  function setVoiceState(isActive) {
    isListening = Boolean(isActive);
    if (!voiceBtn) return;
    voiceBtn.classList.toggle('is-listening', isListening);
    voiceBtn.setAttribute('aria-label', isListening ? 'Stop dictation' : 'Voice dictation');
    voiceBtn.setAttribute('title', isListening ? 'Stop voice' : 'Voice');
    updateComposerBadges();
  }

  function clearLocalConversation() {
    if (neuralFeed) neuralFeed.innerHTML = '';
    const terminalView = document.getElementById('terminal-view');
    if (terminalView) terminalView.classList.add('is-empty');
    clearComposerInput();
    recordTraceEvent({
      type: 'session',
      title: 'Conversation cleared',
      detail: 'Local chat surface cleared by slash command.',
      meta: 'slash',
      status: 'done',
    });
    appendEchoDivider('Conversation cleared');
    emitLocalNotice('Conversation cleared.');
  }

  function setFocusMode(enabled = true) {
    writeComposerSettings({ ...composerSettingsState, focus: enabled });
    document.body.classList.toggle('zavorth-chat-focus-mode', enabled);
    emitLocalNotice(enabled ? 'Focus mode on.' : 'Focus mode off.');
  }

  function extractSideChannelReply(payload) {
    const messages = payload?.snapshot?.messages || payload?.data?.snapshot?.messages || [];
    const assistant = Array.isArray(messages)
      ? [...messages].reverse().find((message) => String(message?.role || '').toLowerCase() === 'assistant')
      : null;
    const content = assistant?.content;
    if (typeof content === 'string' && content.trim()) return content.trim();
    if (Array.isArray(content)) {
      const text = content.map((part) => part?.text || part?.content || '').filter(Boolean).join('\n').trim();
      if (text) return text;
    }
    return String(payload?.chat?.nextAction || payload?.data?.nextAction || payload?.message || 'Detached side-channel completed.').trim();
  }

  function renderSideChannelResult(kind, message, payload, status = 'done') {
    if (!sideChannelPanel) return;
    const reply = extractSideChannelReply(payload);
    sideChannelPanel.hidden = false;
    sideChannelPanel.innerHTML = `
      <div class="compose-side-channel__header">
        <span>/${escapeHtml(kind)} detached</span>
        <small>${escapeHtml(status)}</small>
      </div>
      <div class="compose-side-channel__prompt">${escapeHtml(compactTraceText(message, 120))}</div>
      <div class="compose-side-channel__reply">${sanitizeRenderedHtml(renderMarkdown(reply))}</div>
      <div class="compose-side-channel__meta">
        <span>side session: ${escapeHtml(String(payload?.sideSessionId || payload?.sessionId || 'runtime'))}</span>
        ${payload?.runId || payload?.taskId ? `<span>run: ${escapeHtml(String(payload.runId || payload.taskId))}</span>` : ''}
      </div>
    `;
  }

  async function sendSideMessage(kind, message, composerSnapshot = null) {
    const text = String(message || '').trim();
    const snapshot = composerSnapshot || snapshotQueuedPrompt(text || 'Review attached files.');
    if (!text && snapshot.attachments.length === 0) {
      emitLocalNotice(`/${kind} needs a message.`);
      return false;
    }
    clearComposerInput();
    pendingAttachments = [];
    pendingSelectedSkills = [];
    pendingGuidedFlow = '';
    lastVoiceInput = null;
    refreshAttachmentHint();
    updateComposerContextBar();
    recordTraceEvent({
      type: 'request',
      title: `Detached ${kind} message`,
      detail: text || 'Review attached files',
      meta: snapshot.attachments.length ? `side-channel | ${snapshot.attachments.length} file(s)` : 'side-channel',
      status: 'running',
    });
    const runtimeBridge = window.ZavorthRuntimeBridge;
    if (!runtimeBridge || typeof runtimeBridge.sendSideChat !== 'function') {
      const unavailable = 'The detached side channel is not available in this runtime yet. I did not send this message into the main conversation.';
      restoreQueuedPrompt(snapshot);
      emitLocalNotice(unavailable);
      recordTraceEvent({
        type: 'error',
        title: 'Detached side channel unavailable',
        detail: 'ZavorthRuntimeBridge.sendSideChat is not exposed.',
        meta: 'side-channel',
        status: 'blocked',
      });
      return false;
    }
    try {
      const payload = await runtimeBridge.sendSideChat(text || 'Review the attached files.', {
        kind,
        attachments: snapshot.attachments,
        selectedSkills: snapshot.selectedSkills,
        voice: snapshot.voice,
        composerSettings: composerSettingsState,
        emitSignal: window.emitSignal,
      });
      renderSideChannelResult(kind, text || 'Review attached files', payload, 'completed');
      emitLocalNotice(`Detached /${kind} completed outside the main transcript.`);
      recordTraceEvent({
        type: 'receipt',
        title: `Detached /${kind} completed`,
        detail: payload?.sideSessionId || payload?.sessionId || 'side-channel',
        meta: 'side-channel',
        status: 'done',
      });
      return true;
    } catch (error) {
      restoreQueuedPrompt(snapshot);
      renderSideChannelResult(kind, text || 'Review attached files', {
        message: error?.message || String(error),
        sideSessionId: 'not sent',
      }, 'failed');
      recordTraceEvent({
        type: 'error',
        title: 'Detached side channel failed',
        detail: error?.message || String(error),
        meta: 'side-channel',
        status: 'failed',
      });
      return false;
    }
  }

  async function sendSteerMessage(message, snapshot = null) {
    const text = String(message || '').trim();
    const activeRun = getActiveRuntimeRun();
    if (!activeRun) {
      emitLocalNotice('No active run is available for /steer.');
      return false;
    }
    const runtimeBridge = window.ZavorthRuntimeBridge;
    if (!runtimeBridge || typeof runtimeBridge.sendSteerChat !== 'function') {
      emitLocalNotice('This runtime does not expose active-run steering yet.');
      return false;
    }
    const payloadSnapshot = snapshot || snapshotQueuedPrompt(text || 'Steer the active run.');
    if (!text && payloadSnapshot.attachments.length === 0) {
      emitLocalNotice('/steer needs a message or a queued prompt.');
      return false;
    }
    const runId = String(activeRun.id || activeRun.runId || '').trim();
    recordTraceEvent({
      type: 'step',
      title: 'Steer active run',
      detail: text || 'Review attached files',
      meta: runId || 'active run',
      status: 'running',
    });
    const payload = await runtimeBridge.sendSteerChat(text || 'Review the attached files.', {
      runId,
      queueItemId: payloadSnapshot.id || null,
      backoffMs: payloadSnapshot.backoffMs || 0,
      maxAttempts: payloadSnapshot.maxAttempts || 1,
      attachments: payloadSnapshot.attachments,
      selectedSkills: payloadSnapshot.selectedSkills,
      voice: payloadSnapshot.voice,
      composerSettings: composerSettingsState,
      emitSignal: window.emitSignal,
    });
    recordTraceEvent({
      type: 'receipt',
      title: 'Steer accepted',
      detail: payload?.ack?.id || payload?.runId || payload?.taskId || runId || 'active run',
      meta: payload?.steering?.id || 'steer',
      status: 'done',
    });
    return true;
  }

  function renderDeveloperWorkflowResult(command, payload) {
    const snapshot = payload?.snapshot || payload?.result || payload;
    if (!snapshot) return `/${command} returned no workflow snapshot.`;
    if (command === 'review' && snapshot.review) {
      const findings = snapshot.review?.verification?.acceptedFindingCount ?? snapshot.review?.findings?.length ?? 0;
      return [
        `/${command} governed review`,
        '',
        `Status: ${snapshot.status || snapshot.review?.status || 'unknown'}`,
        `Target: ${snapshot.target || 'workspace-diff'}`,
        `Review: ${snapshot.review?.reviewId || 'n/a'}`,
        `Findings: ${findings}`,
        `Dashboard: ${snapshot.visual?.route || '/dashboard/reviews'}`,
        '',
        snapshot.summary || snapshot.review?.summary || '',
      ].filter(Boolean).join('\n');
    }
    const plan = Array.isArray(snapshot.plannedCommands)
      ? snapshot.plannedCommands.map((entry) => `${entry.command} ${entry.args?.join?.(' ') || ''}`).join(' && ')
      : '';
    return [
      `/${command} git workflow`,
      '',
      `Status: ${snapshot.status || 'unknown'}`,
      `Branch: ${snapshot.branch || 'unknown'}`,
      `Dirty files: ${snapshot.dirtyFiles ?? 'unknown'}`,
      plan ? `Plan: ${plan}` : '',
      snapshot.approval?.required ? `Approval: ${snapshot.approval.satisfied ? snapshot.approval.approvalId : 'required for apply'}` : '',
      snapshot.receipt?.receiptId ? `Receipt: ${snapshot.receipt.receiptId}` : '',
      '',
      snapshot.summary || '',
    ].filter(Boolean).join('\n');
  }

  async function runDeveloperWorkflowSlash(command, args) {
    const runtimeBridge = window.ZavorthRuntimeBridge;
    if (!runtimeBridge || typeof runtimeBridge.runDeveloperWorkflowCommand !== 'function') {
      emitLocalNotice(`/${command} is not connected to the runtime bridge yet.`);
      return false;
    }
    clearComposerInput();
    recordTraceEvent({
      type: 'request',
      title: `/${command} workflow`,
      detail: String(args || '').trim() || 'status',
      meta: 'git-workflow',
      status: 'running',
    });
    try {
      const payload = await runtimeBridge.runDeveloperWorkflowCommand(command, args, {
        approvedBy: 'dashboard',
      });
      appendEcho('core', renderDeveloperWorkflowResult(command, payload));
      recordTraceEvent({
        type: 'receipt',
        title: `/${command} workflow completed`,
        detail: payload?.snapshot?.receipt?.receiptId || payload?.snapshot?.review?.reviewId || payload?.snapshot?.summary || 'workflow snapshot',
        meta: payload?.snapshot?.status || 'git-workflow',
        status: payload?.snapshot?.status === 'blocked' || payload?.snapshot?.status === 'failed' ? 'failed' : 'done',
      });
      return true;
    } catch (error) {
      appendEcho('core', `/${command} failed: ${error?.message || String(error)}`);
      recordTraceEvent({
        type: 'error',
        title: `/${command} workflow failed`,
        detail: error?.message || String(error),
        meta: 'git-workflow',
        status: 'failed',
      });
      return false;
    }
  }

  async function steerQueuedPrompt(id) {
    syncPromptQueueSession();
    const activeRun = getActiveRuntimeRun();
    if (!activeRun) {
      emitLocalNotice('No active run is available to steer.');
      return false;
    }
    const index = promptQueue.findIndex((item) => item.id === id);
    if (index < 0) return false;
    const item = promptQueue[index];
    promptQueue[index] = {
      ...item,
      status: 'sending',
      pendingRunId: String(activeRun.id || activeRun.runId || '').trim() || null,
    };
    persistPromptQueue();
    renderPromptQueue();
    try {
      const ok = await sendSteerMessage(item.text, item);
      if (!ok) {
        promptQueue[index] = item;
        persistPromptQueue();
        renderPromptQueue();
        return false;
      }
      promptQueue[index] = {
        ...item,
        status: 'steered',
      };
      promptQueue = promptQueue.filter((entry) => entry.id !== id);
      persistPromptQueue();
      renderPromptQueue();
      emitLocalNotice('Queued prompt steered into the active run.');
      return true;
    } catch (error) {
      promptQueue[index] = {
        ...item,
        status: 'failed',
        pendingRunId: null,
        attempts: Number(item.attempts || 0) + 1,
        lastError: error?.message || String(error),
      };
      persistPromptQueue();
      renderPromptQueue();
      emitLocalNotice(`Queued steer failed: ${error?.message || String(error)}`);
      return false;
    }
  }

  async function dispatchLocalSlashCommand(commandName, args = '', options = {}) {
    const command = String(commandName || '').toLowerCase();
    if (command === 'help') {
      clearComposerInput();
      appendEcho('core', renderSlashCommandHelp(SLASH_COMMANDS));
      return true;
    }
    if (command === 'clear') {
      clearLocalConversation();
      return true;
    }
    if (command === 'new') {
      clearComposerInput();
      startNewLocalSession();
      return true;
    }
    if (command === 'export') {
      const normalized = String(args || '').toLowerCase();
      const format = ['md', 'markdown', 'json', 'txt', 'text'].includes(normalized) ? normalized : '';
      clearComposerInput();
      exportCurrentConversation(format === 'markdown' ? 'md' : format === 'text' ? 'txt' : format || 'md');
      return true;
    }
    if (command === 'focus') {
      clearComposerInput();
      const normalized = String(args || '').toLowerCase();
      setFocusMode(normalized === 'off' || normalized === 'false' ? false : true);
      return true;
    }
    if (command === 'btw' || command === 'side') {
      const snapshot = snapshotQueuedPrompt(args || 'Review attached files.');
      await sendSideMessage(command, args, snapshot);
      return true;
    }
    if (command === 'branch' || command === 'commit' || command === 'pr' || command === 'review') {
      return runDeveloperWorkflowSlash(command, args);
    }
    if (command === 'queue') {
      clearComposerInput();
      const rawAction = String(args || 'show').trim();
      const action = rawAction.toLowerCase();
      const [rawVerb, id, ...rest] = rawAction.split(/\s+/);
      const verb = String(rawVerb || '').toLowerCase();
      if (action === 'clear') {
        clearPromptQueue();
        return true;
      }
      if (action === 'flush' || action === 'drain') {
        await drainPromptQueue();
        return true;
      }
      if (verb === 'cancel' || verb === 'remove') {
        if (!id) emitLocalNotice('/queue cancel needs a queue id.');
        else removeQueuedPrompt(id);
        return true;
      }
      if (verb === 'replace') {
        const replacement = rest.join(' ').trim();
        if (!id || !replacement || !replaceQueuedPrompt(id, replacement)) {
          emitLocalNotice('/queue replace needs a queue id and new message.');
        }
        return true;
      }
      if (verb === 'backoff') {
        if (!id || !configureQueuedPromptBackoff(id, Number(rest[0] || 0))) {
          emitLocalNotice('/queue backoff needs a queue id and milliseconds.');
        }
        return true;
      }
      if (verb === 'attempts') {
        if (!id || !configureQueuedPromptAttempts(id, Number(rest[0] || 0))) {
          emitLocalNotice('/queue attempts needs a queue id and count.');
        }
        return true;
      }
      renderPromptQueue();
      emitLocalNotice(promptQueue.length ? `${promptQueue.length} prompt(s) queued for this session.` : 'Prompt queue is empty.');
      return true;
    }
    if (command === 'steer') {
      const raw = String(args || '').trim();
      const [candidateId, ...rest] = raw.split(/\s+/);
      const queued = candidateId
        ? promptQueue.find((item) => item.id === candidateId || item.id.startsWith(candidateId))
        : promptQueue[0];
      if (queued && (!rest.length || candidateId === queued.id || queued.id.startsWith(candidateId))) {
        clearComposerInput();
        return steerQueuedPrompt(queued.id);
      }
      const snapshot = options.queueItem || snapshotQueuedPrompt(raw);
      clearQueuedComposerState();
      return sendSteerMessage(raw, snapshot);
    }
    return false;
  }

  function handleLocalSlashCommand(text) {
    const parsed = parseSlashCommand(text);
    if (!parsed) return false;
    const { command, args } = parsed;
    if (isRuntimeChatBusy() && shouldQueueLocalSlashCommand(command)) {
      enqueuePrompt(text, {
        localCommandName: command.key,
        localCommandArgs: args,
        kind: 'local-command',
        attachments: [],
        selectedSkills: [],
        voice: null,
        guidedFlow: '',
        workspaceSelection: null,
      });
      return true;
    }
    dispatchLocalSlashCommand(command.key, args, { originalText: text }).catch((error) => {
      recordTraceEvent({
        type: 'error',
        title: `/${command.name} failed`,
        detail: error?.message || String(error),
        meta: 'slash',
        status: 'failed',
      });
      emitLocalNotice(`/${command.name} failed: ${error?.message || String(error)}`);
    });
    return true;
  }

  bindVoiceDictation({
    voiceButton: voiceBtn,
    composeInput,
    getLanguage: () => composerSettingsState.voice && composerSettingsState.voice !== 'default'
      ? composerSettingsState.voice
      : navigator.language || 'en-US',
    isListening: () => isListening,
    onListeningChange: setVoiceState,
    onTranscript: (voiceInput) => {
      lastVoiceInput = voiceInput;
      updateComposerBadges();
      updateComposerContextBar();
    },
    onNotice: emitLocalNotice,
    onAttachFile: addAttachmentFiles,
  });

  let transmitSignalImpl = async () => false;
  async function transmitSignal(options = {}) {
    if (!composeInput) return false;
    syncPromptQueueSession();
    const text = composeInput.value.trim();
    const hasPayload = text || pendingAttachments.length > 0;
    if (!hasPayload) return false;

    if (!options.fromQueue && handleLocalSlashCommand(text)) {
      return true;
    }
    if (!options.fromQueue) {
      applyNaturalExperienceProfileSwitch(text);
    }

    const submittedItem = options.queueItem || snapshotQueuedPrompt(text);
    const submitKey = promptSubmitKey(submittedItem);
    if (inFlightSubmitKeys.has(submitKey) && !options.fromQueue) {
      emitLocalNotice('That prompt is already being sent.');
      return true;
    }

    if (isRuntimeChatBusy() && !options.fromQueue) {
      enqueuePrompt(text);
      return true;
    }

    isTransmittingSignal = true;
    inFlightSubmitKeys.add(submitKey);
    try {
      const sent = await transmitSignalImpl();
      if (!sent) {
        if (options.fromQueue) {
          requeuePromptAtFront(submittedItem, new Error('The runtime did not accept the queued prompt.'));
        } else {
          restoreQueuedPrompt(submittedItem);
          emitLocalNotice('The runtime did not accept the message. I restored it in the composer.');
        }
      }
      return Boolean(sent);
    } finally {
      inFlightSubmitKeys.delete(submitKey);
      isTransmittingSignal = false;
      schedulePromptQueueDrain(120);
    }
  }
  // --------- Suggestion Chips Logic ---------
  const suggestionChips = document.querySelectorAll('.suggestion-chip');
  suggestionChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const profile = chip.getAttribute('data-profile');
      if (profile) setSelectedExperienceProfile(profile);
      const mission = chip.getAttribute('data-mission');
      if (mission === 'organize-day') {
        if (!selectedExperienceProfile) setSelectedExperienceProfile('personal');
        pendingGuidedFlow = 'personal-organize-day';
      }
      if (mission === 'review-workspace') {
        if (!selectedExperienceProfile) setSelectedExperienceProfile('developer');
        pendingGuidedFlow = 'developer-review-workspace';
      }
      if (mission === 'business-audit') {
        if (!selectedExperienceProfile) setSelectedExperienceProfile('business');
        pendingGuidedFlow = 'business-audit';
      }
      if (composeInput) {
        composeInput.value = chip.dataset.prompt || '';
        // Trigger the input event to auto-resize the textarea
        composeInput.dispatchEvent(new Event('input'));
        composeInput.focus();
      }
      if (chip.getAttribute('data-auto-submit') !== 'false') {
        window.setTimeout(transmitSignal, 40);
      }
    });
  });
  setSelectedExperienceProfile(selectedExperienceProfile || 'personal');

  // --------- Neural Echo Rendering ---------
  const neuralFeed = document.getElementById('neural-feed');
  const neuralStream = document.getElementById('neural-stream');

  function scrollFeedToEnd() {
    if (!neuralStream) return;
    const apply = () => {
      const previousScrollBehavior = neuralStream.style.scrollBehavior;
      neuralStream.style.scrollBehavior = 'auto';
      neuralStream.scrollTop = neuralStream.scrollHeight;
      neuralStream.style.scrollBehavior = previousScrollBehavior;
    };
    apply();
    requestAnimationFrame(apply);
    setTimeout(apply, 50);
  }

  function currentTimestamp() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function getCurrentModelLabel() {
    const runtimeBridge = window.ZavorthRuntimeBridge;
    if (runtimeBridge && typeof runtimeBridge.getCurrentModelLabel === 'function') {
      return runtimeBridge.getCurrentModelLabel();
    }
    return 'Zavorth Runtime';
  }

  function getCurrentModelRouteLabel() {
    const runtimeBridge = window.ZavorthRuntimeBridge;
    if (runtimeBridge && typeof runtimeBridge.getCurrentModelRouteLabel === 'function') {
      return runtimeBridge.getCurrentModelRouteLabel();
    }
    return 'runtime';
  }

  const agentStreamGroups = new Map<string, any>();

  function appendEcho(role, text, logicCells) {
    const group = document.createElement('div');
    group.className = `echo-group ${role}`;
    group.innerHTML = buildEchoGroupHtml({
      role,
      text,
      logicCells,
      timestamp: currentTimestamp(),
      modelLabel: getCurrentModelLabel(),
      routeLabel: getCurrentModelRouteLabel(),
    });

    neuralFeed.appendChild(group);
    if (window.Prism) window.Prism.highlightAllUnder?.(group);
    if (role === 'core') {
      recordTraceEvent({
        type: 'reply',
        title: 'Reply emitted',
        detail: text,
        meta: getCurrentModelLabel(),
        status: 'done',
      });
    }
    scrollFeedToEnd();
  }

  function resolveAgentStreamId(payload: any = {}) {
    const raw = payload.streamId || (payload.runId ? `${payload.runId}:assistant` : '') || payload.traceId || payload.sessionId || 'active';
    return String(raw || 'active').replace(/[^\w:.-]/g, '-') || 'active';
  }

  function agentStreamStatusText(payload: any = {}) {
    const title = String(payload.title || 'Generating response').trim();
    const summary = String(payload.summary || '').trim();
    if (summary && summary !== title) return `${title}\n\n${summary}`;
    return title;
  }

  function ensureAgentStreamGroup(payload: any = {}) {
    if (!neuralFeed) return null;
    const streamId = resolveAgentStreamId(payload);
    const existing = agentStreamGroups.get(streamId);
    if (existing?.group?.isConnected) {
      existing.updatedAt = Date.now();
      return existing;
    }

    removeThinkingState();
    const group = document.createElement('div');
    group.className = 'echo-group core echo-group--agent-stream is-streaming';
    group.setAttribute('data-zavorth-agent-stream-id', streamId);
    group.innerHTML = buildEchoGroupHtml({
      role: 'core',
      text: agentStreamStatusText(payload),
      timestamp: currentTimestamp(),
      modelLabel: getCurrentModelLabel(),
      routeLabel: 'streaming',
    });
    neuralFeed.appendChild(group);
    const bubble = group.querySelector('.echo-bubble');
    bubble?.classList.add('echo-bubble--agent-stream');
    const state = {
      group,
      bubble,
      streamId,
      text: '',
      done: false,
      updatedAt: Date.now(),
    };
    agentStreamGroups.set(streamId, state);
    scrollFeedToEnd();
    return state;
  }

  function updateAgentStreamBubble(state: any, text: unknown, done = false) {
    if (!state?.bubble) return false;
    const nextText = String(text || '').trim() || 'Generating response...';
    state.text = nextText;
    state.done = Boolean(done);
    state.updatedAt = Date.now();
    state.bubble.innerHTML = renderMarkdown(nextText);
    state.group?.classList.toggle('is-streaming', !state.done);
    state.group?.classList.toggle('is-complete', state.done);
    if (window.Prism) window.Prism.highlightAllUnder?.(state.group);
    scrollFeedToEnd();
    return true;
  }

  function ingestAgentStreamEvent(event: any = {}) {
    const payload = event.payload || event || {};
    const runtimeType = String(payload.eventType || event.eventType || event.type || '').trim();
    if (!runtimeType) return false;

    if (runtimeType === 'agent.execution.started' || runtimeType === 'agent.stream.lifecycle') {
      const state = ensureAgentStreamGroup({
        ...payload,
        title: payload.title || 'Generating response',
        summary: payload.summary || 'The run is active and can still receive /steer updates.',
      });
      if (!state) return false;
      updateAgentStreamBubble(state, agentStreamStatusText({
        ...payload,
        title: payload.title || 'Generating response',
        summary: payload.summary || 'The run is active and can still receive /steer updates.',
      }), false);
      return true;
    }

    if (runtimeType !== 'agent.stream.assistant') {
      return false;
    }

    const phase = String(payload.phase || '').trim();
    const state = ensureAgentStreamGroup(payload);
    if (!state) return false;
    const done = payload.done === true || phase === 'done';
    const accumulated = String(payload.accumulated || '').trim();
    const delta = String(payload.delta || '');
    const nextText = accumulated || `${state.text || ''}${delta}`;
    updateAgentStreamBubble(state, nextText, done);
    if (done) {
      recordTraceEvent({
        id: `agent-stream:${state.streamId}:done`,
        type: 'reply',
        title: 'Response stream completed',
        detail: nextText,
        meta: payload.providerNativeTokenStreaming ? 'provider-native-stream' : 'runtime-delta-stream',
        status: 'done',
      });
    }
    return true;
  }

  function finalizeAgentStream(payload: any = {}) {
    const runId = String(
      payload.runId
      || payload?.run?.id
      || payload?.chat?.runId
      || payload?.data?.runId
      || payload?.snapshot?.activeRun?.id
      || '',
    ).trim();
    if (runId) {
      const direct = agentStreamGroups.get(`${runId}:assistant`) || agentStreamGroups.get(runId);
      if (direct?.done) return true;
    }
    const now = Date.now();
    return Array.from(agentStreamGroups.values()).some((state) => (
      state.done && now - state.updatedAt < 15_000
    ));
  }

  function appendEchoDivider(label) {
    if (!neuralFeed) return;
    const divider = document.createElement('div');
    divider.className = 'echo-divider';
    divider.innerHTML = buildEchoDividerHtml(label);
    neuralFeed.appendChild(divider);
  }

  function renderTranscript(messages, options = {}) {
    if (!neuralFeed || !Array.isArray(messages) || messages.length === 0) {
      return false;
    }

    const terminalView = document.getElementById('terminal-view');
    if (terminalView) {
      terminalView.classList.remove('is-empty');
    }

    neuralFeed.innerHTML = '';
    agentStreamGroups.clear();
    appendEchoDivider(options.label || 'Live history');

    suppressTraceCapture = true;
    messages
      .filter((message) => String(message?.content || message?.text || '').trim())
      .slice(-80)
      .forEach((message) => {
        const role = String(message.role || message.source || '').trim().toLowerCase();
        const visualRole = ['user', 'operator', 'human'].includes(role) ? 'operator' : 'core';
        appendEcho(visualRole, String(message.content || message.text || '').trim());
      });
    suppressTraceCapture = false;
    recordTraceEvent({
      type: 'session',
      title: 'History loaded',
      detail: `${messages.length} message(s) projected into chat.`,
      meta: options.label || 'transcript',
    });

    return true;
  }

  function appendThinkingState() {
    recordTraceEvent({
      type: 'thinking',
      title: 'Thinking started',
      detail: 'Zavorth is planning the next response.',
      status: 'running',
    });
    const indicator = document.createElement('div');
    indicator.className = 'echo-group core';
    indicator.id = 'thinking-state';
    indicator.innerHTML = buildThinkingStateHtml({
      timestamp: currentTimestamp(),
      modelLabel: getCurrentModelLabel(),
      stateCardHtml: buildConversationStateCard('thinking', 'Working on your request', 'Zavorth is using the natural route first, then escalating only if tools or approvals are needed.', [
          'Understand the request in plain language',
          'Choose the lightest safe route',
          'Keep approvals and receipts inside this conversation',
        ], { badge: 'live', meta: 'safe route' }),
    });
    neuralFeed.appendChild(indicator);
    scrollFeedToEnd();
    updateDashboardGlass();
  }

  function removeThinkingState() {
    const el = document.getElementById('thinking-state');
    if (el) el.remove();
    recordTraceEvent({
      type: 'thinking',
      title: 'Thinking finished',
      detail: 'The processing indicator was closed.',
      status: 'done',
    });
  }

  // Global counter for unique IDs
  let cellIdCounter = 0;

  function buildLogicCell(name, icon, detail, content) {
    cellIdCounter++;
    const cellId = `logic-cell-${cellIdCounter}`;
    const safeName = escapeHtml(name);
    const safeDetail = escapeHtml(detail);
    recordTraceEvent({
      type: 'step',
      title: name,
      detail: content || detail,
      meta: detail,
      status: 'logged',
    });
    return `
      <div class="logic-cell b-fade-in" id="${cellId}" style="animation-delay:100ms">
        <div class="logic-cell__header" onclick="document.getElementById('${cellId}').classList.toggle('is-expanded')">
          <div class="logic-cell__title">
            <span class="logic-cell__icon"><svg viewBox="0 0 24 24"><path d="${icon}"/></svg></span>
            ${safeName}
          </div>
          <span class="logic-cell__status">
            ${safeDetail} <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="6 9 12 15 18 9"/></svg>
          </span>
        </div>
        ${content ? `<div class="logic-cell__body"><pre class="logic-cell__log"><code>${renderMarkdown(content)}</code></pre></div>` : ''}
      </div>
    `;
  }

  function buildInteractiveButtons() {
    return `
      <div class="interactive-actions b-fade-in" style="animation-delay: 300ms">
        <button class="interactive-btn interactive-btn--primary"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Authorize Action</button>
        <button class="interactive-btn interactive-btn--danger"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Deny</button>
      </div>
    `;
  }

  function buildSystemTrace(message) {
    const safeMessage = escapeHtml(message);
    recordTraceEvent({
      type: 'step',
      title: 'System trace',
      detail: message,
      status: 'observed',
    });
    return `<div class="system-trace b-fade-in">${safeMessage}</div>`;
  }

  const artifactPane = document.getElementById('artifact-pane');
  const artifactTitle = document.getElementById('artifact-title');
  const artifactBody = document.getElementById('artifact-body');
  const artifactClose = document.getElementById('artifact-close');

  const chatSurfaces = createChatSurfaceRenderers({
    neuralFeed,
    artifactPane,
    artifactTitle,
    artifactBody,
    currentTimestamp,
    getCurrentModelLabel,
    getCurrentModelRouteLabel,
    recordTraceEvent,
    updateDashboardGlass,
    scrollFeedToEnd,
    dismissOverlays,
    sanitizeRenderedHtml,
    escapeHtml,
  });
  const {
    openApprovalScopeEditor,
    openArtifactPane,
    renderApprovals,
    renderArtifacts,
    renderRemoteMeshApprovals,
  } = chatSurfaces;
  const removeRemoteMeshApprovalCard = (card) => removeRemoteMeshApprovalCardNode(card, updateDashboardGlass);

  window.ZavorthControlChat = {
    appendEcho,
    appendThinkingState,
    removeThinkingState,
    setComposerRunState,
    openArtifactPane,
    renderApprovals,
    renderRemoteMeshApprovals,
    renderArtifacts,
    renderTranscript,
    recordTraceEvent,
    ingestRuntimeEvents,
    ingestAgentStreamEvent,
    finalizeAgentStream,
    refreshDashboard: updateDashboardGlass,
    openTraceSheet,
    scrollFeedToEnd,
  };

  const localPreviewResponses = createLocalPreviewResponses({
    appendEcho,
    buildInteractiveButtons,
    buildLogicCell,
    buildSystemTrace,
    getCurrentModelLabel,
    getCurrentModelRouteLabel,
    getPendingWorkspaceSelection: () => pendingWorkspaceSelection,
    getSelectedExperienceProfile: () => selectedExperienceProfile,
    recordTraceEvent,
    setSelectedExperienceProfile,
  });
  const {
    generateCoreResponse,
    renderBusinessAuditFlow,
    renderDeveloperReviewFlow,
    renderDeveloperWorkspacePicker,
    renderPersonalDayFlow,
  } = localPreviewResponses;

  transmitSignalImpl = createSignalTransmitter({
    appendEcho,
    appendThinkingState,
    buildSentAttachmentCards,
    closeSkillPopover,
    composeInput,
    generateCoreResponse,
    getCurrentModelRouteLabel,
    getComposerSettingsState: () => composerSettingsState,
    getLastVoiceInput: () => lastVoiceInput,
    getPendingAttachments: () => pendingAttachments,
    getPendingGuidedFlow: () => pendingGuidedFlow,
    getPendingSelectedSkills: () => pendingSelectedSkills,
    getPendingWorkspaceSelection: () => pendingWorkspaceSelection,
    getSelectedExperienceProfile: () => selectedExperienceProfile,
    getExperienceProfilePayload: () => buildExperienceProfilePayload(getCurrentExperienceProfile()),
    recordTraceEvent,
    refreshAttachmentHint,
    removeThinkingState,
    renderApprovals,
    renderArtifacts,
    renderBusinessAuditFlow,
    renderDeveloperReviewFlow,
    renderDeveloperWorkspacePicker,
    renderPersonalDayFlow,
    resetLastVoiceInput: () => {
      lastVoiceInput = null;
    },
    resetPendingAttachments: () => {
      pendingAttachments = [];
    },
    resetPendingGuidedFlow: () => {
      pendingGuidedFlow = '';
    },
    resetPendingSelectedSkills: () => {
      pendingSelectedSkills = [];
    },
    setSelectedExperienceProfile,
    tokenCount,
  });

  // --------- Artifact Pane Logic ---------
  if (artifactClose) {
    artifactClose.addEventListener('click', () => {
      artifactPane.classList.add('hidden');
    });
  }

  bindNeuralFeedInteractions(neuralFeed, {
    appendEcho,
    artifactBody,
    artifactPane,
    artifactTitle,
    capabilityFromElement,
    chooseWorkspaceFolder,
    composeInput,
    escapeHtml,
    getSelectedExperienceProfile: () => selectedExperienceProfile,
    openApprovalScopeEditor,
    openArtifactPane,
    openTraceSheet,
    recordTraceEvent,
    removeRemoteMeshApprovalCard,
    renderApprovals,
    renderTranscript,
    sanitizeRenderedHtml,
    setPendingGuidedFlow: (flow) => {
      pendingGuidedFlow = flow;
    },
    setPendingWorkspaceSelection: (workspace) => {
      pendingWorkspaceSelection = workspace;
    },
    setSelectedExperienceProfile,
    transmitSignal,
    updateDashboardGlass,
  });
  // --------- Signal System (Toasts) ---------
  const signalFeed = document.getElementById('signal-feed');
  window.emitSignal = function(type, title, msg) {
    if (!signalFeed) return;
    recordTraceEvent({
      type: type === 'error' ? 'error' : 'signal',
      title: title || 'Signal',
      detail: msg || '',
      meta: type || 'info',
      status: type || '',
    });
    const icons = {
      info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
      success: '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
      error: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
    };

    const signal = document.createElement('div');
    signal.className = 'signal-toast';
    signal.innerHTML = `
      <div class="signal-toast__icon ${type}"><svg viewBox="0 0 24 24">${icons[type] || icons.info}</svg></div>
      <div class="signal-toast__body">
        <div class="signal-toast__title">${title}</div>
        ${msg ? `<div class="signal-toast__msg">${msg}</div>` : ''}
      </div>
    `;
    signalFeed.appendChild(signal);

    setTimeout(() => {
      signal.classList.add('signal-toast--fading');
      setTimeout(() => signal.remove(), 300);
    }, type === 'success' ? 2200 : 4000);
  };

  // --------- Command Palette ---------
  overlays.bind();
  dockNodes.forEach(node => {
    node.addEventListener('click', () => overlays.syncDrawerActive(node.dataset.sector));
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      overlays.openPalette();
    }
    if (e.key === 'Escape') {
      dismissOverlays();
      if (artifactPane) artifactPane.classList.add('hidden');
    }
  });

  window.openCoreModal = overlays.openCoreModal;

  // --------- Seed Initial Neural Feed ---------
  function seedNeuralFeed() {
    recordTraceEvent({
      type: 'session',
      title: 'Dashboard opened',
      detail: 'Local runtime access is being checked.',
      meta: location.origin,
      status: 'checking',
    });
    const divider = document.createElement('div');
    divider.className = 'echo-divider';
    divider.innerHTML = `
      <span class="echo-divider__line"></span>
      <span class="echo-divider__label">Dashboard Ready</span>
      <span class="echo-divider__line"></span>
    `;
    neuralFeed.appendChild(divider);

    setTimeout(() => {
      const cells = buildLogicCell(
        'local_access_check',
        'M22 12h-4l-3 9L9 3l-3 9H2',
        'Checking local runtime access',
        `Protocol: WebSocket/SSE\nEndpoint: ${location.origin}/api\nModel:    ${getCurrentModelLabel()}\nRoute:    ${getCurrentModelRouteLabel()}`
      );
      const profile = getCurrentExperienceProfile();
      appendEcho('core',
        [
          'Dashboard is ready.',
          '',
          `Current profile: ${profile.label}. ${profile.summary}`,
          `Suggested setup: ${profile.suggestedChannels.join(', ')}. Capabilities: ${profile.suggestedCapabilities.slice(0, 4).join(', ')}.`,
          '',
          'If this browser needs access, paste the local token. I will mark the runtime connected only after the local bridge confirms it.',
          `You can say "${profile.naturalPrompts[0]}" or choose another profile any time. I will adapt wording and setup without bypassing approvals.`,
          'Nothing sensitive is written to memory until you confirm it.',
        ].join('\n'),


        cells
      );
    }, 400);
  }

  seedNeuralFeed();

  // --------- Retro-Futuristic Event Console & Interactive Features ---------
  
  function appendConsoleLog(event: any) {
    const consoleContainer = document.getElementById('zavorth-console-events');
    if (!consoleContainer) return;
    
    const line = document.createElement('div');
    const typeClass = String(event.type || 'system').toLowerCase();
    line.className = `zavorth-console-line zavorth-console-line--${typeClass}`;
    
    const time = event.time || currentTimestamp();
    const title = event.title || 'Event';
    const detail = event.detail || '';
    
    line.innerHTML = `
      <span class="zavorth-console-time">[${escapeHtml(time)}]</span>
      <span class="zavorth-console-tag">[${escapeHtml(typeClass.toUpperCase())}]</span>
      <span class="zavorth-console-text"><strong>${escapeHtml(title)}</strong>: ${escapeHtml(detail)}</span>
    `;
    
    consoleContainer.appendChild(line);
    while (consoleContainer.childNodes.length > 50) {
      consoleContainer.removeChild(consoleContainer.firstChild);
    }
    consoleContainer.scrollTop = consoleContainer.scrollHeight;
  }

  function hydrateConsoleLogs() {
    const consoleContainer = document.getElementById('zavorth-console-events');
    if (!consoleContainer) return;
    
    consoleContainer.innerHTML = '';
    const recentEvents = traceEvents.slice(-30);
    if (recentEvents.length === 0) {
      const line = document.createElement('div');
      line.className = 'zavorth-console-line zavorth-console-line--system';
      line.innerHTML = `
        <span class="zavorth-console-time">[${currentTimestamp()}]</span>
        <span class="zavorth-console-tag">[SYSTEM]</span>
        <span class="zavorth-console-text">Console initialized. Listening to real-time events...</span>
      `;
      consoleContainer.appendChild(line);
    } else {
      recentEvents.forEach(appendConsoleLog);
    }
  }

  // Clear console event listener
  document.addEventListener('click', (event) => {
    const clearBtn = (event.target as HTMLElement)?.closest('.zavorth-console-clear');
    if (!clearBtn) return;
    const consoleContainer = document.getElementById('zavorth-console-events');
    if (consoleContainer) {
      consoleContainer.innerHTML = `
        <div class="zavorth-console-line zavorth-console-line--system">
          <span class="zavorth-console-time">[${currentTimestamp()}]</span>
          <span class="zavorth-console-tag">[SYSTEM]</span>
          <span class="zavorth-console-text">Console logs cleared by operator.</span>
        </div>
      `;
    }
  });

  // OTP Pairing Flow
  document.addEventListener('click', async (event) => {
    const otpBtn = (event.target as HTMLElement)?.closest('#zavorth-otp-generate-btn');
    if (!otpBtn) return;
    
    const otpDisplay = document.getElementById('zavorth-otp-key-display');
    const otpCode = document.getElementById('zavorth-otp-code-val');
    const otpTimerVal = document.getElementById('zavorth-otp-timer-val');
    const otpStatus = document.getElementById('zavorth-otp-status');
    const otpStatusText = document.getElementById('zavorth-otp-status-text');

    if ((window as any)._zavorthOtpInterval) {
      clearInterval((window as any)._zavorthOtpInterval);
    }
    
    if (otpStatus) otpStatus.style.display = 'flex';
    if (otpStatusText) {
      otpStatusText.textContent = 'Requesting a real Node Mesh pairing draft from Zavorth...';
      otpStatus.className = 'zavorth-pairing-status zavorth-pairing-status--waiting';
    }

    let draft: any = null;
    try {
      const response = await fetch('/api/web/nodes/pairing-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          profileId: 'desktop-companion',
          label: 'Dashboard companion node',
          requestedBy: 'zavorth-control-dashboard',
          hostHints: {
            surface: 'zavorth-control-vite-shell',
            platform: navigator.platform || '',
            userAgent: navigator.userAgent || '',
          },
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !payload?.draft?.pairingCode) {
        throw new Error(payload?.error || `Pairing draft rejected (${response.status})`);
      }
      draft = payload.draft;
    } catch (error: any) {
      if (otpDisplay) otpDisplay.style.display = 'none';
      if (otpStatusText) {
        otpStatusText.textContent = `Pairing unavailable: ${error?.message || 'Zavorth did not return a pairing draft.'}`;
        otpStatus.className = 'zavorth-pairing-status zavorth-pairing-status--expired';
      }
      recordTraceEvent({
        type: 'error',
        title: 'Node pairing unavailable',
        detail: error?.message || 'Zavorth did not return a pairing draft.',
        meta: 'nodes-os',
        status: 'failed',
      });
      return;
    }

    const code = String(draft.pairingCode || '').trim();
    const nodeId = String(draft.entry?.id || '').trim();

    if (otpCode) otpCode.textContent = code;
    if (otpDisplay) otpDisplay.style.display = 'flex';
    if (otpStatusText) {
      otpStatusText.innerHTML = `<em>Pairing draft active:</em> ${escapeHtml(nodeId || 'Node')} is waiting for a companion claim.`;
      otpStatus.className = 'zavorth-pairing-status zavorth-pairing-status--waiting';
    }

    recordTraceEvent({
      type: 'session',
      title: 'Node pairing draft created',
      detail: nodeId ? `Pairing code issued for ${nodeId}.` : 'Pairing code issued by Zavorth Node Mesh.',
      meta: 'nodes-os',
      status: 'waiting',
    });

    let secondsLeft = 60;
    if (otpTimerVal) otpTimerVal.textContent = `Expires in ${secondsLeft}s`;

    (window as any)._zavorthOtpInterval = setInterval(() => {
      secondsLeft -= 1;
      if (otpTimerVal) otpTimerVal.textContent = `Expires in ${secondsLeft}s`;

      if (secondsLeft <= 0) {
        clearInterval((window as any)._zavorthOtpInterval);
        (window as any)._zavorthOtpInterval = null;
        if (otpDisplay) otpDisplay.style.display = 'none';
        if (otpStatusText) {
          otpStatusText.textContent = `OTP code expired. Generate a new key.`;
          otpStatus.className = 'zavorth-pairing-status zavorth-pairing-status--expired';
        }
      }
    }, 1000);
  });

  // Raw JSON Config Editor Logic
  document.addEventListener('input', (event) => {
    const textarea = event.target as HTMLTextAreaElement;
    if (textarea?.id !== 'zavorth-config-editor-textarea') return;
    
    const configSaveBtn = document.getElementById('zavorth-config-save-btn') as HTMLButtonElement | null;
    const configStatus = document.getElementById('zavorth-config-status');
    
    try {
      JSON.parse(textarea.value);
      if (configStatus) {
        configStatus.textContent = 'JSON status: OK';
        configStatus.className = 'zavorth-config-editor-status zavorth-config-editor-status--ok';
      }
      if (configSaveBtn) configSaveBtn.disabled = false;
    } catch (error: any) {
      if (configStatus) {
        configStatus.textContent = `Error: ${error.message}`;
        configStatus.className = 'zavorth-config-editor-status zavorth-config-editor-status--error';
      }
      if (configSaveBtn) configSaveBtn.disabled = true;
    }
  });

  document.addEventListener('click', (event) => {
    const configSaveBtn = (event.target as HTMLElement)?.closest('#zavorth-config-save-btn');
    if (!configSaveBtn) return;
    
    const configTextarea = document.getElementById('zavorth-config-editor-textarea') as HTMLTextAreaElement | null;
    const configStatus = document.getElementById('zavorth-config-status');
    
    if (configTextarea) {
      try {
        const parsed = JSON.parse(configTextarea.value);
        const runtimeProjection = parsed?.zavorthControl && typeof parsed.zavorthControl === 'object'
          ? parsed.zavorthControl
          : parsed;
        if (window.ZavorthRuntimeBridge?.state) {
          window.ZavorthRuntimeBridge.state.zavorthControl = {
            ...window.ZavorthRuntimeBridge.state.zavorthControl,
            ...runtimeProjection
          };
        }
        
        if (configStatus) {
          configStatus.textContent = 'Session projection applied locally.';
          configStatus.className = 'zavorth-config-editor-status zavorth-config-editor-status--saved';
        }
        
        recordTraceEvent({
          type: 'session',
          title: 'Session projection updated',
          detail: 'Active dashboard projection updated locally via Raw JSON editor.',
          meta: 'settings',
          status: 'done',
        });
        
        updateDashboardGlass();
      } catch (error: any) {
        if (configStatus) {
          configStatus.textContent = `Failed to save: ${error.message}`;
          configStatus.className = 'zavorth-config-editor-status zavorth-config-editor-status--error';
        }
      }
    }
  });

  // Expose helpers globally so they are fully available
  (window as any).appendConsoleLog = appendConsoleLog;
  (window as any).hydrateConsoleLogs = hydrateConsoleLogs;

  // --------- Theme Toggle ---------
  initThemeToggle();

}

function installRuntimeTextSanitizer() {
  const isBadValue = (value: unknown) => /^(nan|null|undefined)$/i.test(String(value ?? '').trim());
  const replacement = () => window.ZavorthLocale?.t('waiting') || 'waiting';
  const sanitize = (root: ParentNode = document) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest('script, style, code, pre')) return NodeFilter.FILTER_REJECT;
        return isBadValue(node.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    nodes.forEach((node) => {
      node.textContent = replacement();
    });

    root.querySelectorAll?.('[data-dashboard-prompt], [data-skill-status], [data-skill-search-text], [title], [aria-label], [placeholder]').forEach((el) => {
      ['data-dashboard-prompt', 'data-skill-status', 'data-skill-search-text', 'title', 'aria-label', 'placeholder'].forEach((attr) => {
        if (isBadValue(el.getAttribute(attr))) el.setAttribute(attr, replacement());
      });
    });
  };

  sanitize();
  if (typeof MutationObserver !== 'undefined' && document.body) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            sanitize(node as Element);
            applyControlLocale(node as Element);
          }
          if (node.nodeType === Node.TEXT_NODE && isBadValue(node.textContent)) {
            node.textContent = replacement();
          }
          if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
            applyControlLocale(node.parentElement);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

initControlApp();
