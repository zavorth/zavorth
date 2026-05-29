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
  let selectedExperienceProfile = '';
  let pendingGuidedFlow = '';
  let pendingWorkspaceSelection = null;

  const attachmentTray = document.createElement('div');
  attachmentTray.className = 'compose-attachments';
  attachmentTray.setAttribute('aria-live', 'polite');

  const composerContextBar = document.createElement('div');
  composerContextBar.className = 'compose-context-bar';
  composerContextBar.hidden = true;
  composerContextBar.setAttribute('aria-live', 'polite');

  const skillPopover = document.createElement('div');
  skillPopover.className = 'compose-skill-popover hidden';
  skillPopover.setAttribute('role', 'dialog');
  skillPopover.setAttribute('aria-label', 'Choose skill');

  if (composeFrame && composeInput) {
    composeFrame.insertBefore(attachmentTray, composeInput.nextSibling);
    composeFrame.insertBefore(composerContextBar, attachmentTray.nextSibling);
    (composeDock || composeFrame).appendChild(skillPopover);
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
        ${items.map((file) => `
          <div class="chat-attachment-card" title="${escapeHtml(file.name)}">
              <div class="chat-attachment-card__icon">${escapeHtml(attachmentKindLabel(file))}</div>
            <div class="chat-attachment-card__body">
              <div class="chat-attachment-card__name">${escapeHtml(String(file.name || 'file').replace(/\.[^.]+$/, ''))}</div>
              <div class="chat-attachment-card__meta">${escapeHtml(attachmentKindLabel(file))} - ${formatBytes(file.size)} - ${escapeHtml(attachmentStatusLabel(file))}</div>
              ${file.media?.kind ? `<div class="chat-attachment-card__status">${file.media.kind === 'audio' ? 'Queued for transcription' : file.media.kind === 'video' ? 'Queued for video analysis' : 'Queued for visual analysis'}</div>` : ''}
            </div>
          </div>
        `).join('')}
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

  function setSelectedExperienceProfile(profile) {
    selectedExperienceProfile = String(profile || '').trim().toLowerCase();
    document.querySelectorAll('[data-profile]').forEach((node) => {
      const active = String(node.getAttribute('data-profile') || '').toLowerCase() === selectedExperienceProfile;
      node.classList.toggle('is-selected', active);
      node.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (selectedExperienceProfile) {
      recordTraceEvent({
        type: 'step',
        title: 'Experience profile selected',
        detail: selectedExperienceProfile,
        meta: 'dashboard',
        status: 'ready',
      });
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
    lastVoiceInput = null;
    traceSheetQuery = { runId: '', traceId: '', sessionId: '', source: '' };
    traceEvents.length = 0;
    traceEventIds.clear();
    refreshAttachmentHint();
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
  });

  let transmitSignalImpl = () => {};
  function transmitSignal() {
    transmitSignalImpl();
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
    openArtifactPane,
    renderApprovals,
    renderRemoteMeshApprovals,
    renderArtifacts,
    renderTranscript,
    recordTraceEvent,
    ingestRuntimeEvents,
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
      title: 'Session started',
      detail: 'Dashboard connected to the local runtime.',
      meta: location.origin,
      status: 'online',
    });
    const divider = document.createElement('div');
    divider.className = 'echo-divider';
    divider.innerHTML = `
      <span class="echo-divider__line"></span>
      <span class="echo-divider__label">Session Started</span>
      <span class="echo-divider__line"></span>
    `;
    neuralFeed.appendChild(divider);

    setTimeout(() => {
      const cells = buildLogicCell(
        'gateway_connect',
        'M22 12h-4l-3 9L9 3l-3 9H2',
        'Connected to local gateway in 42ms',
        `Protocol: WebSocket/SSE\nEndpoint: ${location.origin}/api\nModel:    ${getCurrentModelLabel()}\nRoute:    ${getCurrentModelRouteLabel()}`
      );
      appendEcho('core',
        'Zavorth is online. The local gateway is connected.\n\nAsk naturally; I will show preview, risk and approval when an action needs it.',
        cells
      );
    }, 400);
  }

  // --------- Boot Sequence ---------
  const bootGate = document.getElementById('boot-gate');
  const bootStatus = document.getElementById('boot-status');

  if (bootGate) {
    setTimeout(() => {
      bootStatus.innerHTML = '<div class="boot-spinner"></div> Authenticating with local core...';
      setTimeout(() => {
        bootStatus.innerHTML = '<span style="color:var(--b-ok)">System Ready</span>';
        setTimeout(() => {
          bootGate.classList.add('hidden');
          seedNeuralFeed();
          window.emitSignal('success', 'Ready', 'Connected to local runtime.');
        }, 600);
      }, 800);
    }, 600);
  } else {
    seedNeuralFeed();
  }

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
