/**
 * Zavorth Nexus â€” Core Runtime Logic
 * Manages dock navigation, neural feed (chat), signals, and interactive behaviors.
 */

(function () {
  'use strict';

  // â•â•â• Markdown & Syntax Highlighting â•â•â•
  if (window.marked) {
    marked.setOptions({ breaks: true, gfm: true });
  }

  // â•â•â• Dock Navigation â•â•â•
  const coreFrame = document.getElementById('core-frame');
  const dockNodes = document.querySelectorAll('.dock-node[data-sector]');
  const sectors = document.querySelectorAll('.sector');
  const bridgeCurrent = document.getElementById('bridge-current');

  const sectorLabels = {
    terminal: 'Chat', overview: 'Dashboard', channels: 'Channels',
    'sales-os': 'Sales OS',
    instances: 'Nodes', sessions: 'Sessions', usage: 'Usage',
    agents: 'Agents', skills: 'Skills', nodes: 'Network',
    dreams: 'Rest', config: 'Settings', docs: 'Docs', cron: 'Schedule'
  };

  dockNodes.forEach(node => {
    node.addEventListener('click', (e) => {
      e.preventDefault();
      const sectorId = node.dataset.sector;

      // Update dock active state
      dockNodes.forEach(n => n.classList.remove('active'));
      node.classList.add('active');

      // Switch sector
      sectors.forEach(s => s.classList.remove('active'));
      const target = document.getElementById('sector-' + sectorId);
      if (target) target.classList.add('active');

      // Update bridge breadcrumb
      if (bridgeCurrent) bridgeCurrent.textContent = sectorLabels[sectorId] || sectorId;
      if (sectorId === 'overview') requestAnimationFrame(updateDashboardGlass);
    });
  });

  // â•â•â• Neural Feed (Chat) Input â•â•â•
  const composeInput = document.getElementById('compose-input');
  const composeDock = document.querySelector('.compose-dock');
  const composeFrame = document.querySelector('.compose-dock__input-frame');
  const tokenCount = document.getElementById('token-count');
  let pendingAttachments = [];
  let pendingSelectedSkills = [];
  let lastVoiceInput = null;
  let activeRecognition = null;
  let isListening = false;
  let traceSheetQuery = { runId: '', traceId: '', sessionId: '', source: '' };
  let selectedExperienceProfile = '';
  let pendingGuidedFlow = '';
  let pendingWorkspaceSelection = null;

  const attachmentTray = document.createElement('div');
  attachmentTray.className = 'compose-attachments';
  attachmentTray.setAttribute('aria-live', 'polite');

  const skillPopover = document.createElement('div');
  skillPopover.className = 'compose-skill-popover hidden';
  skillPopover.setAttribute('role', 'dialog');
  skillPopover.setAttribute('aria-label', 'Choose skill');

  if (composeFrame && composeInput) {
    composeFrame.insertBefore(attachmentTray, composeInput.nextSibling);
    (composeDock || composeFrame).appendChild(skillPopover);
  }

  function emitLocalNotice(message) {
    if (window.emitSignal) {
      window.emitSignal('info', 'Dashboard', message);
      return;
    }
    appendEcho('core', message);
  }

  function formatBytes(size) {
    const value = Number(size || 0);
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  }

  function updateSendAffordance() {
    const send = document.getElementById('send-btn');
    if (!send || !composeInput) return;
    const hasText = composeInput.value.trim().length > 0;
    const hasFiles = pendingAttachments.length > 0;
    send.classList.toggle('active', hasText || hasFiles);
    send.setAttribute('aria-label', hasFiles && !hasText ? 'Send files to Zavorth' : 'Send message');
  }

  function refreshAttachmentHint() {
    const count = pendingAttachments.length;
    const fileLabel = count === 1 ? '1 arquivo pronto' : `${count} arquivos prontos`;
    if (composeInput) {
      composeInput.placeholder = count > 0
        ? `${fileLabel}. Diga o que o Zavorth deve fazer.`
        : 'Ask Zavorth';
    }
    if (attachBtn) {
      attachBtn.classList.toggle('is-active', count > 0);
      attachBtn.setAttribute('aria-label', count > 0 ? (count === 1 ? '1 arquivo anexado' : `${count} arquivos anexados`) : 'Abrir ferramentas');
    }
    if (attachmentTray) {
      attachmentTray.innerHTML = pendingAttachments.map((file, index) => `
        <span class="compose-attachment-chip" title="${escapeHtml(file.name)}">
          <span class="compose-attachment-chip__icon">${file.text ? 'doc' : 'file'}</span>
          <span class="compose-attachment-chip__name">${escapeHtml(file.name)}</span>
          <span class="compose-attachment-chip__size">${formatBytes(file.size)}</span>
          <button type="button" class="compose-attachment-chip__remove" data-attachment-index="${index}" aria-label="Remover ${escapeHtml(file.name)}">&times;</button>
        </span>
      `).join('');
      attachmentTray.classList.toggle('is-visible', count > 0);
    }
    updateSendAffordance();
  }

  async function addAttachmentFiles(fileList) {
    const incoming = Array.from(fileList || []).slice(0, Math.max(0, 5 - pendingAttachments.length));
    if (incoming.length === 0) return;
    const parsed = await Promise.all(incoming.map(readAttachmentFile));
    pendingAttachments = [...pendingAttachments, ...parsed].slice(0, 5);
    refreshAttachmentHint();
    emitLocalNotice(incoming.length === 1
      ? `Arquivo pronto: ${incoming[0].name}. Agora diga o que devo fazer com ele.`
      : `${incoming.length} arquivos prontos. Agora diga o que devo fazer com eles.`);
  }

  async function readAttachmentFile(file) {
    const maxInlineBytes = 64 * 1024;
    const textLike = /^(text\/|application\/(json|xml|javascript|typescript|x-yaml|yaml))/i.test(file.type || '')
      || /\.(txt|md|json|csv|log|ts|tsx|js|jsx|mjs|cjs|py|html|css|yml|yaml|toml|ini|sql|xml)$/i.test(file.name || '');
    const attachment = {
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      text: null,
      truncated: false,
    };
    if (textLike && file.size <= maxInlineBytes) {
      attachment.text = await file.text();
    } else if (textLike && file.size > maxInlineBytes) {
      attachment.text = (await file.slice(0, maxInlineBytes).text());
      attachment.truncated = true;
    }
    return attachment;
  }

  function attachmentKindLabel(file) {
    const name = String(file?.name || '');
    const extension = name.includes('.') ? name.split('.').pop().slice(0, 5).toUpperCase() : '';
    if (extension) return extension;
    const type = String(file?.type || '');
    if (type.startsWith('text/')) return 'TXT';
    if (type.startsWith('image/')) return 'IMG';
    if (type.includes('pdf')) return 'PDF';
    return 'FILE';
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
              <div class="chat-attachment-card__name">${escapeHtml(String(file.name || 'arquivo').replace(/\.[^.]+$/, ''))}</div>
              <div class="chat-attachment-card__meta">${escapeHtml(attachmentKindLabel(file))} · ${formatBytes(file.size)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  if (composeInput) {
    composeInput.addEventListener('input', () => {
      composeInput.style.height = 'auto';
      composeInput.style.height = Math.min(composeInput.scrollHeight, 150) + 'px';
      const text = composeInput.value.trim();
      const words = text.split(/\s+/).filter(Boolean).length;
      const tokens = Math.ceil(words * 1.3);
      if (tokenCount) tokenCount.textContent = tokens + ' tokens';

      updateSendAffordance();
    });

    composeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        transmitSignal();
      }
    });
  }

  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) sendBtn.addEventListener('click', transmitSignal);

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
  const attachBtn = toolSheetTrigger || document.querySelector('.compose-dock__btn[title="Anexar"]');
  let overlayOpenedAt = 0;
  const skillsBtn = document.querySelector('.compose-dock__btn[title="Habilidades"]');
  const voiceBtn = document.getElementById('voice-trigger') || document.querySelector('.compose-dock__btn[title="Voz"]');
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);
  const directoryInput = document.createElement('input');
  directoryInput.type = 'file';
  directoryInput.multiple = true;
  directoryInput.setAttribute('webkitdirectory', '');
  directoryInput.setAttribute('directory', '');
  directoryInput.style.display = 'none';
  document.body.appendChild(directoryInput);
  const traceEvents = [];
  const traceEventIds = new Set();
  const TRACE_EVENT_LIMIT = 90;
  let suppressTraceCapture = false;

  function getOverlayShade() {
    return document.getElementById('overlay-shade');
  }

  function markOverlayOpened() {
    overlayOpenedAt = Date.now();
  }

  function compactTraceText(value, max = 180) {
    return String(value ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);
  }

  function traceEventClass(type) {
    const normalized = String(type || 'event').trim().toLowerCase();
    if (['approval', 'remote-approval', 'approval-decision'].includes(normalized)) return 'approval';
    if (['artifact', 'receipt', 'remote-apply'].includes(normalized)) return 'receipt';
    if (['error', 'failure'].includes(normalized)) return 'error';
    if (['request', 'reply'].includes(normalized)) return 'message';
    if (['thinking', 'step', 'signal', 'session'].includes(normalized)) return 'step';
    return 'event';
  }

  function traceEventLabel(type) {
    const normalized = String(type || 'event').trim().toLowerCase();
    const labels = {
      request: 'Request',
      reply: 'Reply',
      thinking: 'Thinking',
      step: 'Step',
      approval: 'Approval',
      'remote-approval': 'Remote approval',
      'approval-decision': 'Decision',
      artifact: 'Artifact',
      receipt: 'Receipt',
      'remote-apply': 'MCP receipt',
      signal: 'Signal',
      session: 'Session',
      error: 'Error',
    };
    return labels[normalized] || 'Event';
  }

  function traceEventTimeLabel(event = {}) {
    const raw = event.time || event.createdAt || event.created_at || '';
    const date = new Date(String(raw || ''));
    if (Number.isFinite(date.getTime())) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return currentTimestamp();
  }

  function traceString(value, max = 80) {
    const cleaned = compactTraceText(value, max);
    return cleaned || '';
  }

  function normalizeTraceCapability(value = {}) {
    if (!value || typeof value !== 'object') return null;
    const label = traceString(value.label || value.id || value.name || value.toolName || '', 64);
    const kind = traceString(value.kind || value.type || '', 36);
    const sideEffect = traceString(value.sideEffect || value.side_effect || value.effect || '', 40);
    const risk = traceString(value.risk || value.riskLevel || value.risk_level || '', 32);
    const scope = traceString(value.scope || value.allowedScope || value.allowed_scope || '', 88);
    const reason = traceString(value.reason || value.selectionReason || value.selection_reason || '', 140);
    const approval = traceString(value.approval || value.approvalRequired || value.approval_required || '', 44);
    const preview = value.previewRequired || value.preview_required || value.preview
      ? traceString(value.previewLabel || value.preview || 'preview required', 80)
      : '';
    if (!label && !kind && !sideEffect && !risk && !scope && !reason && !approval && !preview) return null;
    return { label, kind, sideEffect, risk, scope, reason, approval, preview };
  }

  function normalizeTraceReceipt(value = {}) {
    if (!value || typeof value !== 'object') return null;
    const id = traceString(value.id || value.receiptId || value.receipt_id || '', 76);
    const status = traceString(value.status || '', 36);
    const summary = traceString(value.summary || value.message || value.detail || '', 180);
    const artifact = traceString(value.artifactId || value.artifact_id || value.artifact || value.path || '', 96);
    const rollback = traceString(value.rollback || value.rollbackInstruction || value.rollback_instruction || '', 140);
    if (!id && !status && !summary && !artifact && !rollback) return null;
    return { id, status, summary, artifact, rollback };
  }

  function normalizeTraceReplay(value = {}) {
    if (!value || typeof value !== 'object') return null;
    const runId = traceString(value.runId || value.run_id || value.id || '', 76);
    const traceId = traceString(value.traceId || value.trace_id || '', 76);
    const sessionId = traceString(value.sessionId || value.session_id || '', 76);
    const policy = traceString(value.policy || value.mode || '', 76);
    if (!runId && !traceId && !sessionId && !policy) return null;
    return { runId, traceId, sessionId, policy };
  }

  function recordTraceEvent(event = {}) {
    if (suppressTraceCapture) return;
    const type = String(event.type || 'event').trim() || 'event';
    const stableId = String(event.id || '').trim();
    if (stableId && traceEventIds.has(stableId)) {
      return;
    }
    const entry = {
      id: stableId || `trace:${Date.now()}:${Math.random().toString(16).slice(2)}`,
      type,
      title: compactTraceText(event.title || traceEventLabel(type), 80),
      detail: compactTraceText(event.detail || '', 240),
      meta: compactTraceText(event.meta || '', 140),
      status: compactTraceText(event.status || '', 40),
      time: traceEventTimeLabel(event),
      source: compactTraceText(event.source || '', 80),
      runId: traceString(event.runId || event.replay?.runId || '', 76),
      traceId: traceString(event.traceId || event.replay?.traceId || '', 76),
      sessionId: traceString(event.sessionId || event.replay?.sessionId || '', 76),
      capability: normalizeTraceCapability(event.capability || event.tool || event.permission || null),
      receipt: normalizeTraceReceipt(event.receipt || null),
      replay: normalizeTraceReplay(event.replay || {
        runId: event.runId,
        traceId: event.traceId,
        sessionId: event.sessionId,
      }),
      approvalId: traceString(event.approvalId || '', 76),
      preview: traceString(event.preview || event.previewSummary || '', 180),
    };
    traceEvents.push(entry);
    if (stableId) traceEventIds.add(stableId);
    if (traceEvents.length > TRACE_EVENT_LIMIT) traceEvents.splice(0, traceEvents.length - TRACE_EVENT_LIMIT);
    renderTraceSheet();
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
    updateDashboardGlass();
    return changed;
  }

  function renderTraceChips(event = {}) {
    const chips = [];
    const capability = event.capability || null;
    if (capability?.label) chips.push(capability.label);
    if (capability?.kind) chips.push(capability.kind);
    if (capability?.sideEffect) chips.push(capability.sideEffect);
    if (capability?.risk) chips.push(`risk: ${capability.risk}`);
    if (capability?.preview) chips.push(capability.preview);
    if (capability?.approval) chips.push(`approval: ${capability.approval}`);
    if (capability?.scope) chips.push(`scope: ${capability.scope}`);
    if (!chips.length) return '';
    return `<div class="trace-sheet__chips">${chips.slice(0, 7).map((chip) => `<span class="trace-sheet__chip">${escapeHtml(chip)}</span>`).join('')}</div>`;
  }

  function renderTraceReceipt(event = {}) {
    const receipt = event.receipt || null;
    if (!receipt) return '';
    return `
      <div class="trace-sheet__receipt" aria-label="Receipt seguro">
        <span>Receipt</span>
        ${receipt.id ? `<code>${escapeHtml(receipt.id)}</code>` : ''}
        ${receipt.status ? `<small>${escapeHtml(receipt.status)}</small>` : ''}
        ${receipt.summary ? `<p>${escapeHtml(receipt.summary)}</p>` : ''}
        ${receipt.artifact ? `<small>artifact: ${escapeHtml(receipt.artifact)}</small>` : ''}
        ${receipt.rollback ? `<small>rollback: ${escapeHtml(receipt.rollback)}</small>` : ''}
      </div>
    `;
  }

  function renderTraceReplay(event = {}) {
    const replay = event.replay || null;
    if (!replay) return '';
    return `
      <div class="trace-sheet__replay" aria-label="Contexto de replay seguro">
        <span>Replay context</span>
        ${replay.runId ? `<code>run ${escapeHtml(replay.runId)}</code>` : ''}
        ${replay.traceId ? `<code>trace ${escapeHtml(replay.traceId)}</code>` : ''}
        ${replay.sessionId ? `<code>session ${escapeHtml(replay.sessionId)}</code>` : ''}
        <small>${escapeHtml(replay.policy || 'receipts only')}</small>
      </div>
    `;
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

  function normalizeTraceSheetQuery(query = {}) {
    return {
      runId: traceString(query.runId || '', 76),
      traceId: traceString(query.traceId || '', 76),
      sessionId: traceString(query.sessionId || '', 76),
      source: traceString(query.source || '', 80),
    };
  }

  function hasTraceSheetQuery(query = traceSheetQuery) {
    return Boolean(query?.runId || query?.traceId || query?.sessionId);
  }

  function traceEventMatchesQuery(event = {}, query = traceSheetQuery) {
    if (!hasTraceSheetQuery(query)) return true;
    const runId = event.runId || event.replay?.runId || '';
    const traceId = event.traceId || event.replay?.traceId || '';
    const sessionId = event.sessionId || event.replay?.sessionId || '';
    if (query.runId || query.traceId) {
      return Boolean(
        (query.runId && runId === query.runId)
        || (query.traceId && traceId === query.traceId)
      );
    }
    return Boolean(
      query.sessionId && sessionId === query.sessionId
    );
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

    if (visibleEvents.length === 0) {
      const focused = hasTraceSheetQuery();
      traceSheetTimeline.innerHTML = `
        <div class="trace-sheet__empty">
          <span class="trace-sheet__empty-dot"></span>
          <strong>${focused ? 'Sem eventos para esta run' : 'Waiting for activity'}</strong>
          <small>${focused ? 'The observatory returned no persistent events for this filter.' : 'Send a task to inspect the runtime from inside.'}</small>
        </div>
      `;
      return;
    }

    const latestReceipt = visibleEvents.slice().reverse().find((event) => traceEventClass(event.type) === 'receipt');
    const latestApproval = visibleEvents.slice().reverse().find((event) => traceEventClass(event.type) === 'approval');
    const queryLine = hasTraceSheetQuery()
      ? [
        traceSheetQuery.runId ? `run ${traceSheetQuery.runId}` : '',
        traceSheetQuery.traceId ? `trace ${traceSheetQuery.traceId}` : '',
        traceSheetQuery.sessionId ? `session ${traceSheetQuery.sessionId}` : '',
      ].filter(Boolean).join(' · ')
      : 'sessao atual';
    const summary = `
      <div class="trace-sheet__summary">
        <strong>Explicacao segura do run</strong>
        <span>Mostra steps, tools, approvals, receipts e replay por evidencias. Raciocinio bruto do modelo permanece privado.</span>
        <div class="trace-sheet__summary-grid">
          <small>${escapeHtml(queryLine)}</small>
          <small>${latestApproval ? `ultimo approval: ${escapeHtml(latestApproval.status || latestApproval.title)}` : 'sem approval ativo'}</small>
          <small>${latestReceipt ? `ultimo receipt: ${escapeHtml(latestReceipt.status || latestReceipt.title)}` : 'sem receipt ainda'}</small>
        </div>
      </div>
    `;

    traceSheetTimeline.innerHTML = summary + visibleEvents.slice(-60).map((event) => {
      const kind = traceEventClass(event.type);
      const status = event.status ? `<span class="trace-sheet__item-status">${escapeHtml(event.status)}</span>` : '';
      const meta = event.meta ? `<div class="trace-sheet__item-meta">${escapeHtml(event.meta)}</div>` : '';
      const detail = event.detail ? `<div class="trace-sheet__item-detail">${escapeHtml(event.detail)}</div>` : '';
      const preview = event.preview ? `<div class="trace-sheet__preview"><span>Preview</span>${escapeHtml(event.preview)}</div>` : '';
      return `
        <article class="trace-sheet__item trace-sheet__item--${kind}">
          <div class="trace-sheet__item-rail"><span></span></div>
          <div class="trace-sheet__item-body">
            <div class="trace-sheet__item-top">
              <span class="trace-sheet__item-kind">${escapeHtml(traceEventLabel(event.type))}</span>
              <span class="trace-sheet__item-time">${escapeHtml(event.time)}</span>
              ${status}
            </div>
            <strong class="trace-sheet__item-title">${escapeHtml(event.title)}</strong>
            ${detail}
            ${renderTraceChips(event)}
            ${preview}
            ${event.capability?.reason ? `<div class="trace-sheet__policy"><span>Motivo</span>${escapeHtml(event.capability.reason)}</div>` : ''}
            ${renderTraceReceipt(event)}
            ${renderTraceReplay(event)}
            ${meta}
          </div>
        </article>
      `;
    }).join('');

    requestAnimationFrame(() => {
      traceSheetTimeline.scrollTop = traceSheetTimeline.scrollHeight;
    });
  }

  function countTraceByClass(kind) {
    return traceEvents.filter((event) => traceEventClass(event.type) === kind).length;
  }

  function setDashboardText(selector, value) {
    document.querySelectorAll(selector).forEach((node) => {
      node.textContent = String(value);
    });
  }

  function latestTraceEvents(limit = 3) {
    return traceEvents.slice(Math.max(0, traceEvents.length - limit)).reverse();
  }

  function dashboardStatusText(value, fallback = 'ready') {
    const cleaned = compactTraceText(value || '', 26);
    return cleaned || fallback;
  }

  function getDashboardSnapshot() {
    const requestCount = traceEvents.filter((event) => String(event.type).toLowerCase() === 'request').length;
    const pendingApprovals = document.querySelectorAll('.zavorth-approval-card').length;
    const pendingRemoteMesh = document.querySelectorAll('.zavorth-remote-mesh-card[data-status="pending"], .zavorth-remote-mesh-card[data-status="retryable"]').length;
    const artifactCards = document.querySelectorAll('.zavorth-artifact-card').length;
    const receiptEvents = countTraceByClass('receipt');
    const approvalEvents = countTraceByClass('approval');
    const errorEvents = countTraceByClass('error');
    const thinking = Boolean(document.querySelector('.thinking-indicator'));
    const lastEvent = traceEvents[traceEvents.length - 1] || null;
    const latestModelNode = neuralFeed ? Array.from(neuralFeed.querySelectorAll('.echo-meta__model')).pop() : null;
    const modelLabel = compactTraceText(latestModelNode?.textContent || getCurrentModelLabel(), 28) || 'runtime';
    return {
      requestCount,
      pendingApprovals,
      pendingRemoteMesh,
      activeApprovals: pendingApprovals + pendingRemoteMesh,
      approvalCount: Math.max(pendingApprovals + pendingRemoteMesh, approvalEvents),
      artifactCount: Math.max(artifactCards, receiptEvents),
      receiptEvents,
      approvalEvents,
      errorEvents,
      thinking,
      lastEvent,
      modelLabel,
      totalEvents: traceEvents.length,
    };
  }

  function updateDashboardTimeline(events) {
    const timeline = document.querySelector('[data-dashboard-timeline]');
    if (!timeline) return;
    if (events.length === 0) {
      timeline.hidden = true;
      timeline.innerHTML = '';
      return;
    }
    timeline.hidden = false;
    timeline.innerHTML = `
      <div class="platform-section-title">Recent activity</div>
      <div class="dashboard-mini-timeline">
        ${events.slice(0, 3).map((event) => `
      <div class="dashboard-timeline-item dashboard-timeline-item--${escapeHtml(traceEventClass(event.type))}">
        <span></span>
        <p>${escapeHtml(event.title || traceEventLabel(event.type))}</p>
        <strong>${escapeHtml(event.status || event.time || 'event')}</strong>
      </div>
        `).join('')}
      </div>
    `;
  }

  function updateDashboardGlass() {
    const root = document.querySelector('.dashboard-glass');
    if (!root) return;
    const snapshot = getDashboardSnapshot();
    setDashboardText('[data-dashboard-metric="runs"]', snapshot.requestCount);
    setDashboardText('[data-dashboard-metric="approvals"]', snapshot.approvalCount);
    setDashboardText('[data-dashboard-metric="artifacts"]', snapshot.artifactCount);

    setDashboardText('[data-dashboard-meta="runs"]', snapshot.thinking
      ? 'mission running now'
      : snapshot.requestCount > 0
        ? `${snapshot.totalEvents} trace event(s)`
        : 'waiting for first mission');
    setDashboardText('[data-dashboard-meta="approvals"]', snapshot.activeApprovals > 0
      ? `${snapshot.activeApprovals} pending approval(s)`
      : snapshot.approvalEvents > 0
        ? `${snapshot.approvalEvents} policy event(s)`
        : 'no pending permissions');
    setDashboardText('[data-dashboard-meta="artifacts"]', snapshot.artifactCount > 0
      ? `${snapshot.receiptEvents} receipt(s) recorded`
      : 'no artifact in this session');

    const runtimeTitle = snapshot.thinking
      ? 'Mission running'
      : snapshot.lastEvent
        ? `Latest event: ${traceEventLabel(snapshot.lastEvent.type)}`
        : 'Waiting for a mission';
    const runtimeText = snapshot.lastEvent
      ? compactTraceText(snapshot.lastEvent.detail || snapshot.lastEvent.title, 170)
      : 'The dashboard gateway is online. Runtime events appear when live snapshots arrive.';
    setDashboardText('[data-dashboard-runtime-title]', runtimeTitle);
    setDashboardText('[data-dashboard-runtime-text]', runtimeText);

    setDashboardText('[data-dashboard-remote="mcp"]', snapshot.pendingRemoteMesh > 0
      ? `${snapshot.pendingRemoteMesh} pending approval`
      : snapshot.receiptEvents > 0
        ? 'receipt recorded'
        : 'token protected');
    setDashboardText('[data-dashboard-remote="docker"]', snapshot.pendingRemoteMesh > 0 ? 'waiting for approval' : 'approval required');
    setDashboardText('[data-dashboard-remote="files"]', snapshot.artifactCount > 0 ? 'artifact scoped' : 'read scoped');

    setDashboardText('[data-dashboard-strip="status"]', snapshot.thinking ? 'running' : 'online');
    setDashboardText('[data-dashboard-strip-detail="status"]', snapshot.lastEvent
      ? dashboardStatusText(snapshot.lastEvent.title, 'runtime updated')
      : 'local runtime available');
    setDashboardText('[data-dashboard-strip="model"]', snapshot.modelLabel);
    setDashboardText('[data-dashboard-strip-detail="model"]', getCurrentModelRouteLabel());
    setDashboardText('[data-dashboard-strip="budget"]', snapshot.totalEvents > 0 ? `${snapshot.totalEvents} evt` : 'per mission');
    setDashboardText('[data-dashboard-strip-detail="budget"]', snapshot.errorEvents > 0 ? `${snapshot.errorEvents} trace error(s)` : 'local trace in real time');
    setDashboardText('[data-dashboard-strip="security"]', snapshot.activeApprovals > 0 ? 'approval' : 'active');
    setDashboardText('[data-dashboard-strip-detail="security"]', snapshot.activeApprovals > 0 ? 'pending decision' : 'policy, preview and receipt');

    updateDashboardTimeline(latestTraceEvents(3));
  }

  function openToolSheet() {
    if (!toolSheet || !toolSheetTrigger) return;
    closeTraceSheet(false);
    closeSkillPopover();
    const shade = getOverlayShade();
    if (shade) shade.classList.add('active');
    markOverlayOpened();
    toolSheet.classList.remove('hidden');
    void toolSheet.offsetWidth;
    toolSheet.classList.add('active');
    toolSheet.setAttribute('aria-hidden', 'false');
    toolSheetTrigger.classList.add('is-active');
    toolSheetTrigger.setAttribute('aria-expanded', 'true');
  }

  function closeToolSheet(clearShade = true) {
    if (!toolSheet) return;
    toolSheet.classList.remove('active');
    toolSheet.setAttribute('aria-hidden', 'true');
    if (toolSheetTrigger) {
      toolSheetTrigger.classList.toggle('is-active', pendingAttachments.length > 0);
      toolSheetTrigger.setAttribute('aria-expanded', 'false');
    }
    if (clearShade) {
      const shade = getOverlayShade();
      if (shade) shade.classList.remove('active');
    }
    setTimeout(() => {
      if (!toolSheet.classList.contains('active')) toolSheet.classList.add('hidden');
    }, 180);
  }

  function openTraceSheet(query = null) {
    if (!traceSheet || !traceSheetTrigger) return;
    if (query && typeof query === 'object') {
      traceSheetQuery = normalizeTraceSheetQuery(query);
    }
    closeToolSheet(false);
    closeSkillPopover();
    renderTraceSheet();
    const shade = getOverlayShade();
    if (shade) shade.classList.add('active');
    markOverlayOpened();
    traceSheet.classList.remove('hidden');
    void traceSheet.offsetWidth;
    traceSheet.classList.add('active');
    traceSheet.setAttribute('aria-hidden', 'false');
    traceSheetTrigger.classList.add('is-active');
    traceSheetTrigger.setAttribute('aria-expanded', 'true');
  }

  function closeTraceSheet(clearShade = true) {
    if (!traceSheet) return;
    traceSheet.classList.remove('active');
    traceSheet.setAttribute('aria-hidden', 'true');
    if (traceSheetTrigger) {
      traceSheetTrigger.classList.remove('is-active');
      traceSheetTrigger.setAttribute('aria-expanded', 'false');
    }
    if (clearShade) {
      const shade = getOverlayShade();
      if (shade) shade.classList.remove('active');
    }
    setTimeout(() => {
      if (!traceSheet.classList.contains('active')) traceSheet.classList.add('hidden');
    }, 180);
  }

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
    attachBtn.addEventListener('click', openToolSheet);
  }

  if (toolSheetClose) toolSheetClose.addEventListener('click', () => closeToolSheet());
  if (traceSheetTrigger) traceSheetTrigger.addEventListener('click', openTraceSheet);
  if (traceSheetClose) traceSheetClose.addEventListener('click', () => closeTraceSheet());

  toolSheetActions.forEach((actionButton) => {
    actionButton.addEventListener('click', (event) => {
      event.stopPropagation();
      const action = actionButton.getAttribute('data-tool-sheet-action');
      if (action === 'attach') {
        closeToolSheet();
        chooseAttachmentFiles('');
        return;
      }
      if (action === 'media') {
        closeToolSheet();
        chooseAttachmentFiles('image/*,video/*,audio/*');
        return;
      }
      if (action === 'skills') {
        closeToolSheet();
        openSkillPopover();
        return;
      }
      if (action === 'voice') {
        closeToolSheet();
        voiceBtn?.click();
        return;
      }
      if (action === 'mcp') {
        closeToolSheet();
        focusComposeWithPrompt('Use the notebook MCP to prepare a safe remote action. Show the target, risk, preview and ask for approval before execution.');
        return;
      }
      if (action === 'docs') {
        closeToolSheet();
        focusComposeWithPrompt('Use os docs e o contexto do projeto Zavorth para responder este pedido:');
        return;
      }
      if (action === 'terminal') {
        closeToolSheet();
        focusComposeWithPrompt('Prepare a governed terminal execution. First show preview, impact, risk, rollback and whether approval is required:');
      }
    });
  });

  if (attachmentTray) {
    attachmentTray.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-attachment-index]');
      if (!remove) return;
      const index = Number(remove.getAttribute('data-attachment-index'));
      if (!Number.isFinite(index)) return;
      pendingAttachments.splice(index, 1);
      refreshAttachmentHint();
    });
  }

  fileInput.addEventListener('change', async () => {
    await addAttachmentFiles(fileInput.files || []);
    fileInput.value = '';
    fileInput.removeAttribute('accept');
  });

  directoryInput.addEventListener('change', () => {
    const files = directoryInput.files || [];
    if (!files.length) return;
    pendingWorkspaceSelection = summarizeWorkspaceSelection(files);
    emitLocalNotice(`Workspace selected: ${pendingWorkspaceSelection.root} (${pendingWorkspaceSelection.fileCount} files).`);
    pendingGuidedFlow = 'developer-review-workspace';
    if (!selectedExperienceProfile) setSelectedExperienceProfile('developer');
    if (composeInput) {
      composeInput.value = `Review this repository safely: ${pendingWorkspaceSelection.root}. Read first, list risks, show patch preview, and do not edit without approval.`;
      composeInput.dispatchEvent(new Event('input'));
    }
    window.setTimeout(transmitSignal, 60);
  });

  if (composeFrame) {
    composeFrame.addEventListener('dragover', (event) => {
      if (!event.dataTransfer?.files?.length) return;
      event.preventDefault();
      composeFrame.classList.add('is-dragging-files');
    });
    composeFrame.addEventListener('dragleave', () => composeFrame.classList.remove('is-dragging-files'));
    composeFrame.addEventListener('drop', async (event) => {
      if (!event.dataTransfer?.files?.length) return;
      event.preventDefault();
      composeFrame.classList.remove('is-dragging-files');
      await addAttachmentFiles(event.dataTransfer.files);
    });
  }

  if (composeInput) {
    composeInput.addEventListener('paste', async (event) => {
      const files = Array.from(event.clipboardData?.files || []);
      if (files.length === 0) return;
      event.preventDefault();
      await addAttachmentFiles(files);
    });
  }

  function buildSkillOptions() {
    const bridge = window.ZavorthRuntimeBridge;
    const runtimeSkills = bridge && typeof bridge.getAvailableSkills === 'function'
      ? bridge.getAvailableSkills()
      : [];
    const defaults = [
      { id: 'read_file', title: 'Analisar arquivos', prompt: 'Analise os arquivos ou pasta que eu indicar e me de um resumo claro.', status: 'local' },
      { id: 'network_fetch', title: 'Pesquisar na web', prompt: 'Pesquise fontes recentes sobre este assunto e me traga um resumo com links.', status: 'web' },
      { id: 'pdf.generate', title: 'Gerar relatorio', prompt: 'Gere um relatorio organizado com os pontos principais.', status: 'relatorio' },
    ];
    const byId = new Map();
    [...runtimeSkills, ...defaults].forEach((skill) => {
      const id = String(skill?.id || skill?.title || '').trim();
      if (!id || byId.has(id)) return;
      byId.set(id, {
        id,
        title: String(skill.title || skill.name || id).trim(),
        prompt: String(skill.prompt || skill.summary || skill.description || `Use a habilidade ${id} para este pedido.`).trim(),
        status: String(skill.status || 'disponivel').trim(),
      });
    });
    return Array.from(byId.values()).slice(0, 8);
  }

  function closeSkillPopover() {
    if (!skillPopover) return;
    skillPopover.classList.add('hidden');
    if (skillsBtn) skillsBtn.classList.remove('is-active');
  }

  function openSkillPopover() {
    if (!skillPopover) return;
    const options = buildSkillOptions();
    skillPopover.innerHTML = `
      <div class="compose-skill-popover__header">
        <span>Skills</span>
        <button type="button" class="compose-skill-popover__close" aria-label="Close skills">?</button>
      </div>
      <div class="compose-skill-popover__list">
        ${options.map((skill) => `
          <button type="button" class="compose-skill-option" data-skill-id="${escapeHtml(skill.id)}" data-skill-title="${escapeHtml(skill.title)}" data-skill-status="${escapeHtml(skill.status)}" data-skill-prompt="${escapeHtml(skill.prompt)}">
            <span class="compose-skill-option__title">${escapeHtml(skill.title)}</span>
            <span class="compose-skill-option__meta">${escapeHtml(skill.status)}</span>
          </button>
        `).join('')}
      </div>
      <div class="compose-skill-popover__footer">Choose a skill to prepare the request. Nothing runs by itself.</div>
    `;
    skillPopover.classList.remove('hidden');
    if (skillsBtn) skillsBtn.classList.add('is-active');
  }

  if (skillsBtn) {
    skillsBtn.addEventListener('click', () => {
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
      if (!option || !composeInput) return;
      const skillId = option.getAttribute('data-skill-id') || '';
      const skillTitle = option.getAttribute('data-skill-title') || skillId;
      const skillStatus = option.getAttribute('data-skill-status') || '';
      const prompt = option.getAttribute('data-skill-prompt') || '';
      if (skillId && !pendingSelectedSkills.some((skill) => skill.id === skillId)) {
        pendingSelectedSkills.push({
          id: skillId,
          title: skillTitle,
          status: skillStatus,
          prompt,
        });
      }
      const current = composeInput.value.trim();
      composeInput.value = current ? `${prompt}

${current}` : prompt;
      composeInput.dispatchEvent(new Event('input'));
      composeInput.focus();
      closeSkillPopover();
    });
  }

  document.addEventListener('click', (event) => {
    if (!skillPopover || skillPopover.classList.contains('hidden')) return;
    if (skillPopover.contains(event.target) || skillsBtn?.contains(event.target)) return;
    closeSkillPopover();
  });

  function setVoiceState(nextState) {
    isListening = nextState === 'listening';
    if (!voiceBtn) return;
    voiceBtn.classList.toggle('is-listening', isListening);
    voiceBtn.setAttribute('aria-label', isListening ? 'Parar ditado' : 'Ditado por voz');
    voiceBtn.setAttribute('title', isListening ? 'Parar voz' : 'Voz');
  }

  if (voiceBtn) {
    let voiceOverlay = document.getElementById('voice-listening-overlay');
    if (!voiceOverlay) {
      voiceOverlay = document.createElement('div');
      voiceOverlay.id = 'voice-listening-overlay';
      voiceOverlay.className = 'voice-overlay hidden';
      voiceOverlay.innerHTML = `
        <div class="voice-overlay__backdrop"></div>
        <div class="voice-overlay__content">
          <div class="voice-overlay__levels">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
          <div class="voice-overlay__text">Estou ouvindo... Fale agora.</div>
        </div>
      `;
      document.body.appendChild(voiceOverlay);

      voiceOverlay.addEventListener('click', () => {
        if (activeRecognition && isListening) {
          activeRecognition.stop();
          setVoiceState('idle');
          voiceOverlay.classList.add('hidden');
        }
      });
    }

    voiceBtn.addEventListener('click', () => {
      if (activeRecognition && isListening) {
        activeRecognition.stop();
        setVoiceState('idle');
        voiceOverlay.classList.add('hidden');
        return;
      }
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        emitLocalNotice('Voice is not available in this browser yet. Type or paste the transcribed text.');
        return;
      }
      const recognition = new SpeechRecognition();
      activeRecognition = recognition;
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      let finalTranscript = '';
      recognition.onstart = () => {
        setVoiceState('listening');
        voiceOverlay.classList.remove('hidden');
        voiceOverlay.querySelector('.voice-overlay__text').textContent = 'Ouvindo... Fale agora.';
      };
      recognition.onerror = () => {
        setVoiceState('idle');
        voiceOverlay.classList.add('hidden');
        emitLocalNotice('I could not capture audio. Try again or type.');
      };
      recognition.onend = () => {
        setVoiceState('idle');
        voiceOverlay.classList.add('hidden');
        activeRecognition = null;
      };
      recognition.onresult = (event) => {
        if (!composeInput) return;
        let interim = '';
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const transcript = String(event.results[index]?.[0]?.transcript || '').trim();
          if (!transcript) continue;
          if (event.results[index].isFinal) finalTranscript = `${finalTranscript} ${transcript}`.trim();
          else interim = `${interim} ${transcript}`.trim();
        }
        const spoken = [finalTranscript, interim].filter(Boolean).join(' ').trim();
        if (!spoken) return;
        lastVoiceInput = {
          transcript: spoken,
          language: recognition.lang || 'en-US',
          source: 'speech-recognition',
          confidence: null,
        };

        voiceOverlay.querySelector('.voice-overlay__text').textContent = `"${spoken}"`;

        composeInput.value = spoken;
        composeInput.dispatchEvent(new Event('input'));
        composeInput.focus();
      };
      recognition.start();
    });
  }

  function transmitSignal() {
    const text = composeInput.value.trim();
    if (!text && pendingAttachments.length === 0) return;
    const outboundAttachments = pendingAttachments.map((file, index) => ({
      id: file.id || `attachment:${index + 1}:${file.name}`,
      name: file.name,
      type: file.type,
      size: file.size,
      text: file.text || null,
      truncated: Boolean(file.truncated),
      source: 'command-center-browser',
    }));
    const outboundText = text || 'Analise os arquivos em anexo.';
    const outboundSkills = pendingSelectedSkills.slice(0, 8);
    const outboundVoice = lastVoiceInput ? { ...lastVoiceInput } : null;

    // Transition out of empty state on first message
    const terminalView = document.getElementById('terminal-view');
    if (terminalView && terminalView.classList.contains('is-empty')) {
      terminalView.classList.remove('is-empty');
    }

    recordTraceEvent({
      type: 'request',
      title: 'Pedido recebido',
      detail: outboundText,
      meta: [
        outboundAttachments.length ? `${outboundAttachments.length} arquivo(s)` : '',
        outboundSkills.length ? `${outboundSkills.length} skill(s)` : '',
        outboundVoice ? 'voice' : '',
      ].filter(Boolean).join(' · ') || 'chat',
      status: 'queued',
    });
    if (outboundAttachments.length > 0) {
      recordTraceEvent({
        type: 'artifact',
        title: 'Contexto anexado',
        detail: outboundAttachments.map((file) => file.name).join(', '),
        meta: 'compose attachment',
      });
    }
    if (outboundSkills.length > 0) {
      recordTraceEvent({
        type: 'step',
        title: 'Skills selecionadas',
        detail: outboundSkills.map((skill) => skill.title || skill.id).join(', '),
        meta: 'tool exposure',
      });
    }

    appendEcho('operator', text || 'Analisar arquivos em anexo', buildSentAttachmentCards(outboundAttachments));
    composeInput.value = '';
    composeInput.style.height = 'auto';
    if (tokenCount) tokenCount.textContent = '0 tokens';
    pendingAttachments = [];
    pendingSelectedSkills = [];
    lastVoiceInput = null;
    refreshAttachmentHint();
    closeSkillPopover();

    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) sendBtn.classList.remove('active');

    const guidedFlow = pendingGuidedFlow;
    pendingGuidedFlow = '';
    if (shouldHandlePersonalDayFlow(outboundText, guidedFlow)) {
      if (!selectedExperienceProfile) setSelectedExperienceProfile('personal');
      recordTraceEvent({
        type: 'step',
        title: 'Personal mission preview',
        detail: 'Planning only. No external action is executed.',
        meta: 'read-only',
        status: 'running',
      });
      setTimeout(() => {
        appendThinkingState();
        setTimeout(() => {
          removeThinkingState();
          renderPersonalDayFlow(outboundText);
        }, 640);
      }, 180);
      return;
    }
    if (shouldHandleDeveloperReviewFlow(outboundText, guidedFlow)) {
      if (!selectedExperienceProfile) setSelectedExperienceProfile('developer');
      recordTraceEvent({
        type: 'step',
        title: 'Developer mission preview',
        detail: pendingWorkspaceSelection
          ? `Read-only repository review for ${pendingWorkspaceSelection.root}.`
          : 'Workspace selection required before review.',
        meta: 'read-only',
        status: pendingWorkspaceSelection ? 'running' : 'waiting',
      });
      setTimeout(() => {
        appendThinkingState();
        setTimeout(() => {
          removeThinkingState();
          if (pendingWorkspaceSelection) renderDeveloperReviewFlow(outboundText, pendingWorkspaceSelection);
          else renderDeveloperWorkspacePicker(outboundText);
        }, 640);
      }, 180);
      return;
    }
    if (shouldHandleBusinessAuditFlow(outboundText, guidedFlow)) {
      if (!selectedExperienceProfile) setSelectedExperienceProfile('business');
      recordTraceEvent({
        type: 'step',
        title: 'Business audit preview',
        detail: 'Policy, approval channel, scope, TTL and blocked actions are being projected.',
        meta: 'business',
        status: 'running',
      });
      setTimeout(() => {
        appendThinkingState();
        setTimeout(() => {
          removeThinkingState();
          renderBusinessAuditFlow(outboundText);
        }, 640);
      }, 180);
      return;
    }

    const runtimeBridge = window.ZavorthRuntimeBridge;
    if (runtimeBridge && typeof runtimeBridge.sendChat === 'function') {
      recordTraceEvent({
        type: 'step',
        title: 'Gateway universal',
        detail: 'Pedido enviado ao runtime real do Zavorth.',
        meta: getCurrentModelRouteLabel(),
        status: 'running',
      });
      appendThinkingState();
      runtimeBridge.sendChat(
        outboundText,
        {
          appendEcho,
          removeThinkingState,
          renderApprovals,
          renderArtifacts,
          emitSignal: window.emitSignal,
        },
        {
          attachments: outboundAttachments,
          selectedSkills: outboundSkills,
          voice: outboundVoice,
        },
      ).catch((error) => {
        removeThinkingState();
        recordTraceEvent({
          type: 'error',
          title: 'Falha no runtime',
          detail: error?.message || 'Tente novamente em instantes.',
          status: 'failed',
        });
        appendEcho('core', `Nao consegui enviar ao runtime real.\n\n${error?.message || 'Tente novamente em instantes.'}`);
      });
      return;
    }

    recordTraceEvent({
      type: 'step',
      title: 'Runtime local de preview',
      detail: 'No live bridge is available; using the local dashboard response.',
      status: 'fallback',
    });
    setTimeout(() => {
      appendThinkingState();
      setTimeout(() => {
        removeThinkingState();
        generateCoreResponse(outboundText);
      }, 1200 + Math.random() * 800);
    }, 300);
  }

  // â•â•â• Suggestion Chips Logic â•â•â•
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
      if (chip.getAttribute('data-auto-submit') === 'true') {
        window.setTimeout(transmitSignal, 40);
      }
    });
  });

  // â•â•â• Neural Echo Rendering â•â•â•
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

  function buildEchoQuickActions(role) {
    if (role !== 'core') return '';
    return `
      <div class="echo-action-row" aria-label="Response actions">
        <button type="button" data-prompt="Show the trace for the latest response in simple language.">Trace</button>
        <button type="button" data-prompt="Show pending approvals with approve and reject actions.">Approvals</button>
        <button type="button" data-prompt="Show the latest receipt or explain why none exists yet.">Receipt</button>
      </div>
    `;
  }

  function appendEcho(role, text, logicCells) {
    const group = document.createElement('div');
    group.className = `echo-group ${role}`;

    const avatarClass = role === 'operator' ? 'operator' : 'core';
    const avatarLabel = role === 'operator' ? 'You' : 'Z';
    const modelLabel = escapeHtml(getCurrentModelLabel());
    const routeLabel = escapeHtml(getCurrentModelRouteLabel());
    const actionRow = buildEchoQuickActions(role);

    group.innerHTML = `
      <div class="echo-avatar ${avatarClass}">${avatarLabel}</div>
      <div class="echo-group__messages">
        <div class="echo-group__header">
          <span class="echo-sender">${role === 'operator' ? 'You' : 'Zavorth'}</span>
          <span class="echo-timestamp">${currentTimestamp()}</span>
          ${role === 'core' ? `<span class="echo-meta"><span class="echo-meta__model">${modelLabel}</span><span class="echo-meta__cost">${routeLabel}</span></span>` : ''}
        </div>
        <div class="echo-bubble b-fade-in">
          ${renderMarkdown(text)}
        </div>
        ${logicCells ? logicCells : ''}
        ${actionRow}
      </div>
    `;

    neuralFeed.appendChild(group);
    if (window.Prism) Prism.highlightAllUnder(group);
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
    const safeLabel = escapeHtml(label || 'Session');
    divider.innerHTML = `
      <span class="echo-divider__line"></span>
      <span class="echo-divider__label">${safeLabel}</span>
      <span class="echo-divider__line"></span>
    `;
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
      title: 'Historico carregado',
      detail: `${messages.length} mensagem(ns) projetadas no chat.`,
      meta: options.label || 'transcript',
    });

    return true;
  }

  const ALLOWED_MARKDOWN_TAGS = new Set([
    'a', 'b', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'hr', 'i', 'iframe',
    'img', 'li', 'ol', 'p', 'pre', 's', 'span', 'strong', 'table', 'tbody', 'td',
    'th', 'thead', 'tr', 'u', 'ul',
  ]);
  const DROP_MARKDOWN_TAGS = new Set([
    'base', 'embed', 'form', 'input', 'link', 'meta', 'object', 'script', 'style', 'template',
  ]);
  const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
  const SAFE_EMBED_PROTOCOLS = new Set(['blob:']);
  const TRUSTED_UI_TAGS = new Set(['button', 'form', 'input', 'label', 'textarea']);

  function isSafeUrl(value, allowedProtocols) {
    try {
      const parsed = new URL(String(value || ''), window.location.origin);
      return allowedProtocols.has(parsed.protocol);
    } catch {
      return false;
    }
  }

  function sanitizeClassName(value) {
    return String(value || '')
      .split(/\s+/)
      .map((entry) => entry.replace(/[^\w:-]/g, ''))
      .filter(Boolean)
      .join(' ');
  }

  function sanitizeRenderedHtml(html, options = {}) {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    const nodes = Array.from(template.content.querySelectorAll('*'));
    const allowedTags = options.allowTrustedUi
      ? new Set([...ALLOWED_MARKDOWN_TAGS, ...TRUSTED_UI_TAGS])
      : ALLOWED_MARKDOWN_TAGS;
    for (const node of nodes) {
      const tag = node.tagName.toLowerCase();
      if (DROP_MARKDOWN_TAGS.has(tag)) {
        node.remove();
        continue;
      }
      if (!allowedTags.has(tag)) {
        node.replaceWith(...Array.from(node.childNodes));
        continue;
      }

      for (const attr of Array.from(node.attributes)) {
        const name = attr.name.toLowerCase();
        const value = attr.value;
        const keepGlobal =
          name === 'title'
          || name === 'aria-label'
          || name === 'role'
          || (name === 'class' && sanitizeClassName(value));

        if (name.startsWith('on') || name === 'style' || name === 'srcdoc') {
          node.removeAttribute(attr.name);
          continue;
        }

        if (name === 'class') {
          const safeClassName = sanitizeClassName(value);
          if (safeClassName) node.setAttribute('class', safeClassName);
          else node.removeAttribute(attr.name);
          continue;
        }

        if (tag === 'a' && name === 'href') {
          if (isSafeUrl(value, SAFE_LINK_PROTOCOLS)) {
            node.setAttribute('href', value);
            node.setAttribute('rel', 'noopener noreferrer');
            node.setAttribute('target', '_blank');
          } else {
            node.removeAttribute(attr.name);
          }
          continue;
        }

        if (tag === 'img' && name === 'src') {
          if (isSafeUrl(value, SAFE_EMBED_PROTOCOLS)) node.setAttribute('src', value);
          else node.removeAttribute(attr.name);
          continue;
        }

        if (tag === 'iframe' && name === 'src') {
          if (isSafeUrl(value, SAFE_EMBED_PROTOCOLS)) node.setAttribute('src', value);
          else node.removeAttribute(attr.name);
          continue;
        }

        if (tag === 'img' && ['alt', 'loading'].includes(name)) continue;
        if (tag === 'iframe' && ['title', 'allowfullscreen'].includes(name)) continue;
        if (options.allowTrustedUi && ['form', 'input', 'label', 'textarea', 'button'].includes(tag)) {
          if (['id', 'name', 'type', 'placeholder', 'autocomplete', 'for', 'value', 'disabled'].includes(name)) continue;
        }
        if (keepGlobal) continue;

        node.removeAttribute(attr.name);
      }
    }
    return template.innerHTML;
  }

  function renderMarkdown(text) {
    if (window.marked) return sanitizeRenderedHtml(marked.parse(String(text ?? '')));
    return sanitizeRenderedHtml(String(text ?? '')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>'));
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function appendThinkingState() {
    recordTraceEvent({
      type: 'thinking',
      title: 'Thinking started',
      detail: 'O Zavorth esta planejando a proxima resposta.',
      status: 'running',
    });
    const indicator = document.createElement('div');
    indicator.className = 'echo-group core';
    indicator.id = 'thinking-state';
    indicator.innerHTML = `
      <div class="echo-avatar core">Z</div>
      <div class="echo-group__messages">
        <div class="echo-group__header">
          <span class="echo-sender">Zavorth</span>
          <span class="echo-timestamp">${currentTimestamp()}</span>
          <span class="echo-meta"><span class="echo-meta__model">${escapeHtml(getCurrentModelLabel())}</span><span class="echo-meta__cost">working</span></span>
        </div>
        <div class="thinking-indicator">
          <div class="thinking-indicator__dots">
            <span></span><span></span><span></span>
          </div>
          <div class="thinking-indicator__copy">
            <strong>Planning the next safe step</strong>
            <small>Preview, approval and receipt stay visible here.</small>
          </div>
        </div>
      </div>
    `;
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
        <button class="interactive-btn interactive-btn--danger"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Recusar</button>
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

  function deriveApprovalCapability(approval = {}) {
    const capability = approval.capability || approval.tool || approval.permission || {};
    const rawTitle = String(approval.title || '');
    const rawReason = String(approval.summary || approval.reason || '');
    const inferredLabel = /shell\.exec|terminal|npm|powershell/i.test(`${rawTitle} ${rawReason}`)
      ? 'shell.exec'
      : /apply_patch|patch|editar|write/i.test(`${rawTitle} ${rawReason}`)
        ? 'apply_patch'
        : capability.label || capability.id || approval.toolName || approval.kind || 'capability';
    const kind = /shell|terminal|npm|powershell/i.test(inferredLabel)
      ? 'shell'
      : /apply_patch|write|edit/i.test(inferredLabel)
        ? 'workspace'
        : capability.kind || approval.kind || 'tool';
    const sideEffect = capability.sideEffect
      || approval.sideEffect
      || (kind === 'shell' ? 'process' : /apply_patch|write|edit/i.test(inferredLabel) ? 'write' : 'unknown');
    const scope = capability.scope || approval.scope || (sideEffect === 'write' ? 'workspace' : 'session');
    return {
      label: inferredLabel,
      kind,
      sideEffect,
      scope,
      risk: approval.risk || capability.risk || 'review',
      previewRequired: Boolean(capability.previewRequired || approval.previewRequired || sideEffect === 'process' || sideEffect === 'write'),
      reason: approval.reason || approval.summary || capability.reason || '',
      approval: 'required',
    };
  }

  function buildApprovalCard(approval) {
    const approvalId = escapeHtml(approval.id);
    const approvalKind = escapeHtml(approval.kind);
    const runId = escapeHtml(approval.runId || approval.agentRunId || approval.correlation?.runId || '');
    const traceId = escapeHtml(approval.traceId || approval.correlation?.traceId || '');
    const sessionId = escapeHtml(approval.sessionId || approval.correlation?.sessionId || '');
    const capability = deriveApprovalCapability(approval);
    const capabilityLabel = escapeHtml(capability.label);
    const capabilityKind = escapeHtml(capability.kind);
    const sideEffect = escapeHtml(capability.sideEffect);
    const scope = escapeHtml(capability.scope);
    const previewLabel = capability.previewRequired ? 'preview required' : 'preview clean';
    const title = escapeHtml(approval.title || 'Pending action');
    const summary = escapeHtml(approval.summary || approval.reason || 'Zavorth needs your decision to continue.');
    const risk = escapeHtml(approval.risk || 'review');
    const allowLabel = sideEffect === 'write' || scope.toLowerCase().includes('workspace')
      ? 'Allow in Workspace'
      : capabilityKind === 'docker' || capabilityKind === 'mcp'
        ? 'Allow via MCP'
        : capabilityKind === 'shell'
          ? 'Allow once'
        : 'Allow';
    const capabilityAttrs = [
      `data-capability-label="${capabilityLabel}"`,
      `data-capability-kind="${capabilityKind}"`,
      `data-capability-side-effect="${sideEffect}"`,
      `data-capability-scope="${scope}"`,
      `data-capability-risk="${risk}"`,
      `data-capability-preview="${escapeHtml(previewLabel)}"`,
      `data-capability-reason="${escapeHtml(approval.reason || approval.summary || '')}"`,
    ].join(' ');
    const traceButton = runId || traceId
      ? `<button class="zavorth-permission-card__btn zavorth-permission-card__btn--trace" type="button" data-zavorth-trace-action="open" data-run-id="${runId}" data-trace-id="${traceId}" data-session-id="${sessionId}">View trace</button>`
      : '';
    return `
      <div class="zavorth-permission-card b-fade-in zavorth-approval-card" data-zavorth-approval-id="${approvalId}" data-zavorth-approval-kind="${approvalKind}" data-status="pending" data-run-id="${runId}" data-trace-id="${traceId}" data-session-id="${sessionId}" ${capabilityAttrs}>
        <div class="zavorth-permission-card__state">Waiting for user input</div>
        <div class="zavorth-permission-card__panel">
          <div class="zavorth-permission-card__request">
            <span class="zavorth-permission-card__eyebrow">Access</span>
            <span class="zavorth-permission-card__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 3l8 4v5c0 5-3.4 8.7-8 9-4.6-.3-8-4-8-9V7l8-4z"/><path d="M9 12l2 2 4-4"/></svg>
            </span>
            <span class="zavorth-permission-card__target">${capabilityLabel}</span>
            <span class="zavorth-permission-card__risk">${risk}</span>
          </div>
          <div class="zavorth-permission-card__title">${title}</div>
          <div class="zavorth-permission-card__summary">${summary}</div>
          <div class="zavorth-permission-card__meta">${capabilityKind} ? ${sideEffect} ? ${previewLabel} ? scope: ${scope}</div>
        </div>
        <div class="zavorth-permission-card__actions b-fade-in" style="animation-delay: 120ms">
          <button class="zavorth-permission-card__btn" data-zavorth-approval-decision="reject" data-zavorth-approval-id="${approvalId}" data-zavorth-approval-kind="${approvalKind}">
            Deny
          </button>
          <button class="zavorth-permission-card__btn zavorth-permission-card__btn--primary" data-zavorth-approval-decision="approve" data-zavorth-approval-id="${approvalId}" data-zavorth-approval-kind="${approvalKind}">
            ${allowLabel}
          </button>
          <button class="zavorth-permission-card__btn zavorth-permission-card__btn--caret" type="button" aria-label="Permission options" disabled>
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          ${traceButton}
        </div>
      </div>
    `;
  }

  function renderApprovals(approvals) {
    if (!neuralFeed || !Array.isArray(approvals)) return false;
    const pending = approvals.filter((approval) => String(approval?.status || 'pending') === 'pending' && approval?.id);
    neuralFeed.querySelectorAll('#zavorth-approvals-group, .zavorth-approval-card').forEach((node) => {
      const group = node.closest('#zavorth-approvals-group');
      (group || node).remove();
    });
    if (pending.length === 0) {
      updateDashboardGlass();
      return false;
    }

    const terminalView = document.getElementById('terminal-view');
    if (terminalView) terminalView.classList.remove('is-empty');
    recordTraceEvent({
      type: 'approval',
      title: 'Pending approval',
      detail: pending.map((approval) => approval.title || approval.kind || approval.id).join(', '),
      meta: `${pending.length} item(s)`,
      status: 'waiting',
      approvalId: pending[0]?.id,
      capability: deriveApprovalCapability(pending[0]),
    });

    const cards = pending.slice(0, 4).map(buildApprovalCard).join('');
    const group = document.createElement('div');
    group.id = 'zavorth-approvals-group';
    group.className = 'echo-group core b-fade-in';
    group.innerHTML = `
      <div class="echo-avatar core">Z</div>
      <div class="echo-group__messages">
        <div class="echo-group__header">
          <span class="echo-sender">Zavorth</span>
          <span class="echo-timestamp">${currentTimestamp()}</span>
          <span class="echo-meta"><span class="echo-meta__model">${escapeHtml(getCurrentModelLabel())}</span><span class="echo-meta__cost">${escapeHtml(getCurrentModelRouteLabel())}</span></span>
        </div>
        <div class="echo-bubble">
          ${pending.length === 1
            ? 'Uma acao precisa da sua autorizacao para continuar.'
            : `${pending.length} acoes precisam da sua autorizacao para continuar.`}
        </div>
        <div class="artifacts-grid" style="display: grid; gap: 0.75rem; margin-top: 0.75rem;">
          ${cards}
        </div>
      </div>
    `;
    neuralFeed.appendChild(group);
    scrollFeedToEnd();
    updateDashboardGlass();
    return true;
  }

  function buildRemoteMeshApprovalCard(card) {
    const approvalId = escapeHtml(card.id);
    const runId = escapeHtml(card.runId || card.agentRunId || card.correlation?.runId || '');
    const traceId = escapeHtml(card.traceId || card.correlation?.traceId || '');
    const sessionId = escapeHtml(card.sessionId || card.correlation?.sessionId || '');
    const title = escapeHtml(card.title || 'Remote Mesh approval');
    const summary = escapeHtml(card.summary || 'Revise a acao remota antes de aplicar no notebook MCP.');
    const risk = escapeHtml(card.risk || 'medium');
    const targetKind = escapeHtml(card.targetKind || 'notebook');
    const targetLabel = escapeHtml(card.targetLabel || 'Notebook MCP');
    const scope = escapeHtml(card.scope || card.targetLabel || 'Notebook MCP');
    const sideEffect = escapeHtml(card.sideEffect || (card.targetKind === 'project-file' ? 'read' : 'remote'));
    const allowLabel = escapeHtml(card.targetKind === 'project-file' ? 'Allow in Workspace' : (card.primaryActionLabel || 'Allow via MCP'));
    const capabilityAttrs = [
      `data-capability-label="${targetLabel}"`,
      `data-capability-kind="${targetKind}"`,
      `data-capability-side-effect="${sideEffect}"`,
      `data-capability-scope="${scope}"`,
      `data-capability-risk="${risk}"`,
      'data-capability-preview="server-side preview"',
      `data-capability-reason="${summary}"`,
    ].join(' ');
    const traceButton = runId || traceId
      ? `<button class="zavorth-permission-card__btn zavorth-permission-card__btn--trace" type="button" data-zavorth-trace-action="open" data-run-id="${runId}" data-trace-id="${traceId}" data-session-id="${sessionId}">View trace</button>`
      : '';
    return `
      <div class="zavorth-permission-card b-fade-in zavorth-remote-mesh-card" data-zavorth-remote-mesh-approval-id="${approvalId}" data-status="pending" data-run-id="${runId}" data-trace-id="${traceId}" data-session-id="${sessionId}" ${capabilityAttrs}>
        <div class="zavorth-permission-card__state">Waiting for user input</div>
        <div class="zavorth-permission-card__panel">
          <div class="zavorth-permission-card__request">
            <span class="zavorth-permission-card__eyebrow">Access</span>
            <span class="zavorth-permission-card__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 3l8 4v5c0 5-3.4 8.7-8 9-4.6-.3-8-4-8-9V7l8-4z"/><path d="M9 12l2 2 4-4"/></svg>
            </span>
            <span class="zavorth-permission-card__target">${targetLabel}</span>
            <span class="zavorth-permission-card__risk">${risk}</span>
          </div>
          <div class="zavorth-permission-card__title">${title}</div>
          <div class="zavorth-permission-card__summary">${summary}</div>
          <div class="zavorth-permission-card__meta">${targetKind} · ${sideEffect} · server-side proxy · token protected</div>
        </div>
        <div class="zavorth-permission-card__actions b-fade-in" style="animation-delay: 120ms">
          <button class="zavorth-permission-card__btn" data-zavorth-remote-mesh-action="deny" data-zavorth-remote-mesh-approval-id="${approvalId}">
            Deny
          </button>
          <button class="zavorth-permission-card__btn zavorth-permission-card__btn--primary" data-zavorth-remote-mesh-action="apply" data-zavorth-remote-mesh-approval-id="${approvalId}">
            ${allowLabel}
          </button>
          <button class="zavorth-permission-card__btn zavorth-permission-card__btn--caret" type="button" aria-label="Permission options" disabled>
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          ${traceButton}
        </div>
      </div>
    `;
  }

  const REMOTE_MESH_DISMISSED_APPROVALS_KEY = 'zavorth.remoteMesh.dismissedApprovals.v1';

  function readDismissedRemoteMeshApprovals() {
    try {
      const raw = window.localStorage?.getItem(REMOTE_MESH_DISMISSED_APPROVALS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : []);
    } catch {
      return new Set();
    }
  }

  function rememberDismissedRemoteMeshApproval(id) {
    if (!id) return;
    try {
      const dismissed = readDismissedRemoteMeshApprovals();
      dismissed.add(String(id));
      window.localStorage?.setItem(REMOTE_MESH_DISMISSED_APPROVALS_KEY, JSON.stringify(Array.from(dismissed).slice(-100)));
    } catch {
      // Ignore storage failures; the current UI state is still updated.
    }
  }

  function removeRemoteMeshApprovalCard(card) {
    if (!card) return;
    const group = card.closest('#zavorth-remote-mesh-approvals-group');
    card.remove();
    if (group && !group.querySelector('.zavorth-remote-mesh-card')) {
      group.remove();
    }
    updateDashboardGlass();
  }

  function renderRemoteMeshApprovals(cards) {
    if (!neuralFeed || !Array.isArray(cards)) return false;
    const dismissed = readDismissedRemoteMeshApprovals();
    const pending = cards.filter((card) => String(card?.status || 'pending') === 'pending' && card?.id && !dismissed.has(String(card.id)));
    neuralFeed.querySelectorAll('#zavorth-remote-mesh-approvals-group, .zavorth-remote-mesh-card').forEach((node) => {
      const group = node.closest('#zavorth-remote-mesh-approvals-group');
      (group || node).remove();
    });
    if (pending.length === 0) {
      updateDashboardGlass();
      return false;
    }

    const terminalView = document.getElementById('terminal-view');
    if (terminalView) terminalView.classList.remove('is-empty');
    recordTraceEvent({
      type: 'remote-approval',
      title: 'Remote Mesh approval',
      detail: pending.map((card) => card.title || card.targetLabel || card.id).join(', '),
      meta: 'Notebook MCP',
      status: 'waiting',
      approvalId: pending[0]?.id,
      capability: {
        label: pending[0]?.targetLabel || 'Notebook MCP',
        kind: pending[0]?.targetKind || 'notebook',
        sideEffect: pending[0]?.sideEffect || (pending[0]?.targetKind === 'project-file' ? 'read' : 'remote'),
        risk: pending[0]?.risk || 'medium',
        scope: pending[0]?.scope || pending[0]?.targetLabel || 'Notebook MCP',
        reason: pending[0]?.summary,
        approval: 'required',
        previewRequired: true,
      },
    });

    const cardsHtml = pending.slice(0, 4).map(buildRemoteMeshApprovalCard).join('');
    const group = document.createElement('div');
    group.id = 'zavorth-remote-mesh-approvals-group';
    group.className = 'echo-group core b-fade-in';
    group.innerHTML = `
      <div class="echo-avatar core">Z</div>
      <div class="echo-group__messages">
        <div class="echo-group__header">
          <span class="echo-sender">Zavorth Remote Mesh</span>
          <span class="echo-timestamp">${currentTimestamp()}</span>
          <span class="echo-meta"><span class="echo-meta__model">Notebook MCP</span><span class="echo-meta__cost">server-side proxy</span></span>
        </div>
        <div class="echo-bubble">
          ${pending.length === 1
            ? 'Uma acao remota do notebook esta pronta para approval via MCP real.'
            : `${pending.length} acoes remotas do notebook estao prontas para approval via MCP real.`}
        </div>
        <div class="artifacts-grid" style="display: grid; gap: 0.75rem; margin-top: 0.75rem;">
          ${cardsHtml}
        </div>
      </div>
    `;
    neuralFeed.appendChild(group);
    scrollFeedToEnd();
    updateDashboardGlass();
    return true;
  }

  function buildArtifactCard(artifact) {
    const artifactId = escapeHtml(artifact.id);
    const runId = escapeHtml(artifact.runId || artifact.toolRunId || artifact.agentRunId || '');
    const traceId = escapeHtml(artifact.traceId || '');
    const sessionId = escapeHtml(artifact.sessionId || '');
    const title = escapeHtml(artifact.title || artifact.name || artifact.path || 'Artifact');
    const kind = escapeHtml(artifact.kind || 'arquivo');
    const summary = escapeHtml(artifact.summary || artifact.path || 'Output generated by Zavorth.');
    return `
      <div class="logic-cell b-fade-in zavorth-artifact-card" data-zavorth-artifact-id="${artifactId}" data-run-id="${runId}" data-trace-id="${traceId}" data-session-id="${sessionId}">
        <div class="logic-cell__header">
          <div class="logic-cell__title">
            <span class="logic-cell__icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>
            ${title}
          </div>
          <span class="logic-cell__status">${kind}</span>
        </div>
        <div class="logic-cell__detail">${summary}</div>
        <div class="interactive-actions b-fade-in" style="animation-delay: 120ms">
          <button class="interactive-btn interactive-btn--primary" data-zavorth-artifact-id="${artifactId}">
            Abrir artefato
          </button>
          ${(runId || traceId) ? `<button class="interactive-btn interactive-btn--trace" type="button" data-zavorth-trace-action="open" data-run-id="${runId}" data-trace-id="${traceId}" data-session-id="${sessionId}">Ver trace</button>` : ''}
        </div>
      </div>
    `;
  }

  function isRelevantChatArtifact(artifact) {
    if (!artifact || !artifact.id) return false;
    const source = String(artifact.source || '').trim().toLowerCase();
    return Boolean(
      artifact.runId
      || artifact.toolRunId
      || artifact.path
      || artifact.content
      || artifact.diff
      || ['tool-run', 'agent-run', 'file'].includes(source)
    );
  }

  function renderArtifacts(artifacts, context = {}) {
    if (!neuralFeed || !Array.isArray(artifacts)) return false;
    neuralFeed.querySelectorAll('#zavorth-artifacts-group').forEach((node) => node.remove());

    if (!context || !context.reason) {
      updateDashboardGlass();
      return false;
    }
    const visibleArtifacts = artifacts.filter(isRelevantChatArtifact);
    if (visibleArtifacts.length === 0) {
      updateDashboardGlass();
      return false;
    }

    const terminalView = document.getElementById('terminal-view');
    if (terminalView) terminalView.classList.remove('is-empty');
    recordTraceEvent({
      type: 'receipt',
      title: 'Registered artifacts',
      detail: visibleArtifacts.map((artifact) => artifact.title || artifact.name || artifact.path || artifact.id).join(', '),
      meta: `${visibleArtifacts.length} item(ns)`,
      status: 'available',
      receipt: {
        id: visibleArtifacts[0]?.receiptId || visibleArtifacts[0]?.id,
        status: 'available',
        summary: visibleArtifacts[0]?.summary || visibleArtifacts[0]?.title,
        artifact: visibleArtifacts[0]?.path || visibleArtifacts[0]?.id,
      },
      replay: {
        runId: visibleArtifacts[0]?.runId || visibleArtifacts[0]?.toolRunId,
        traceId: visibleArtifacts[0]?.traceId,
        sessionId: visibleArtifacts[0]?.sessionId,
        policy: 'receipts only',
      },
    });

    const cards = visibleArtifacts.slice(0, 5).map(buildArtifactCard).join('');

    const group = document.createElement('div');
    group.id = 'zavorth-artifacts-group';
    group.className = 'echo-group core b-fade-in';
    group.innerHTML = `
      <div class="echo-avatar core">ðŸ</div>
      <div class="echo-group__messages">
        <div class="echo-group__header">
          <span class="echo-sender">Zavorth</span>
          <span class="echo-timestamp">${currentTimestamp()}</span>
          <span class="echo-meta"><span class="echo-meta__model">Workspace</span></span>
        </div>
        <div class="echo-bubble">
          ${visibleArtifacts.length === 1 ? 'Artifact generated and available for inspection:' : `${visibleArtifacts.length} artifacts generated and available for inspection:`}
        </div>
        <div class="artifacts-grid" style="display: grid; gap: 0.75rem; margin-top: 0.75rem;">
          ${cards}
        </div>
      </div>
    `;

    neuralFeed.appendChild(group);
    scrollFeedToEnd();
    updateDashboardGlass();
    return true;
  }

  function openArtifactPane(title, bodyHtml) {
    if (!artifactPane || !artifactTitle || !artifactBody) return false;
    recordTraceEvent({
      type: 'artifact',
      title: 'Artifact opened',
      detail: title || 'Artifact',
      status: 'viewed',
    });
    artifactTitle.textContent = title || 'Artifact';
    artifactBody.innerHTML = sanitizeRenderedHtml(bodyHtml || `<div class="empty-state"><div class="empty-state__icon">Doc</div><div class="empty-state__title">Artifact without preview</div><div class="empty-state__desc">Zavorth registered this output, but it has no viewable content in this tab.</div></div>`);
    if (window.Prism) Prism.highlightAllUnder(artifactBody);
    artifactPane.classList.remove('hidden');
    updateDashboardGlass();
    return true;
  }

  window.ZavorthCommandCenterChat = {
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

  function generateCoreResponse(userText) {
    const lower = userText.toLowerCase();

    if (shouldHandlePersonalDayFlow(userText, '')) {
      renderPersonalDayFlow(userText);
    }
    else if (shouldHandleDeveloperReviewFlow(userText, '')) {
      if (pendingWorkspaceSelection) renderDeveloperReviewFlow(userText, pendingWorkspaceSelection);
      else renderDeveloperWorkspacePicker(userText);
    }
    else if (shouldHandleBusinessAuditFlow(userText, '')) {
      renderBusinessAuditFlow(userText);
    }
    else if (lower.includes('status') || lower.includes('health') || lower.includes('teste')) {
      const traces = buildSystemTrace("Scanning the gateway...") + buildSystemTrace("Checking PID 4821...");
      const cells = buildLogicCell(
        'system_health_check',
        'M22 12h-4l-3 9L9 3l-3 9H2',
        '0.4s',
        `Gateway:   Connected\nAgent:     Running\nModel:     ${getCurrentModelLabel()}\nRoute:     ${getCurrentModelRouteLabel()}`
      );
      appendEcho('core', 'Systems are operational. Full report below:', traces + cells);
    }
    else if (lower.includes('agente') || lower.includes('criar')) {
      const traces = buildSystemTrace("Compiling the new agent manifest...") + buildSystemTrace("Waiting for operator approval.");
      const cells = buildLogicCell(
        'generate_manifest',
        'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z',
        '1.2s',
        `{\n  "name": "Data Analyst",\n  "model": ${JSON.stringify(getCurrentModelLabel())},\n  "tools": ["python_exec", "db_read"]\n}`
      );
      const buttons = buildInteractiveButtons();
      appendEcho('core', 'Manifest created successfully. Do you want me to deploy it to the mesh?', traces + cells + buttons);
    }
    else if (lower.includes('run') || lower.includes('exec') || lower.includes('comando')) {
      const traces = buildSystemTrace("Conectando ao shell TTY1...");
      const cells = buildLogicCell(
        'run_command',
        'M4 17l6-6-6-6M12 19h8',
        '2.1s',
        '$ pnpm check:changed\n\nCore prod typecheck passed\nLint passed (0 warnings)\n47 tests passed\n\nAll gates green.'
      );
      appendEcho('core', 'Command completed successfully:', traces + cells);
    }
    else {
      const traces = buildSystemTrace("Analyzing operator intent...") + buildSystemTrace("Mapping required tools...");
      appendEcho('core', `Understood: "${userText}"\n\nStarting governed execution. The system feed will update in real time.`, traces);
    }
  }

  function shouldHandlePersonalDayFlow(userText, guidedFlow) {
    if (guidedFlow === 'personal-organize-day') return true;
    const lower = String(userText || '').toLowerCase();
    const asksOrganizeDay = /(organize|plan|arrange|structure).{0,28}\b(day|today|routine|schedule)\b/.test(lower)
      || lower.includes('organize my day')
      || lower.includes('personal mode');
    const asksCodeOrBusiness = /\b(workspace|repository|repo|business|audit|provider|channel|sandbox|terminal|command)\b/.test(lower);
    return asksOrganizeDay && !asksCodeOrBusiness;
  }

  function renderPersonalDayFlow(userText) {
    const profile = selectedExperienceProfile || 'personal';
    const planId = `personal-day-${Date.now().toString(36)}`;
    recordTraceEvent({
      type: 'receipt',
      title: 'Personal mission receipt',
      detail: 'Daily plan generated without external changes.',
      meta: planId,
      status: 'preview',
      receipt: {
        id: planId,
        status: 'preview',
        summary: 'Read-only daily plan. No reminders, messages, files or calendar events were created.',
        rollback: 'not needed',
      },
    });
    const body = [
      `Personal mode is active. I can help organize the day without touching anything outside this dashboard.`,
      '',
      `Here is a simple plan you can use now. I did not create reminders, send messages, edit files or change your calendar.`,
      '',
      `If you later ask me to create a reminder, send a message, edit a calendar or change an external app, I will pause and ask for approval first.`,
    ].join('\n');
    appendEcho('core', body, buildPersonalDayFlowCards({ planId, profile, userText }));
  }

  function buildPersonalDayFlowCards({ planId, profile, userText }) {
    const request = escapeHtml(String(userText || 'Organize my day safely.'));
    const safeProfile = escapeHtml(profile || 'personal');
    const safePlanId = escapeHtml(planId);
    return `
      <div class="personal-flow-grid" data-personal-flow="organize-day" data-selected-profile="${safeProfile}">
        <article class="personal-flow-card personal-flow-card--plan">
          <div class="personal-flow-card__header">
            <span>Daily plan</span>
            <strong>read-only</strong>
          </div>
          <ol class="personal-flow-steps">
            <li><strong>Now</strong><span>Write the 3 most important outcomes for today.</span></li>
            <li><strong>Next</strong><span>Group quick tasks into a 30 minute cleanup block.</span></li>
            <li><strong>Focus</strong><span>Protect one deep-work block before messages and errands.</span></li>
            <li><strong>Close</strong><span>End with a 10 minute review: done, blocked, tomorrow.</span></li>
          </ol>
        </article>
        <article class="personal-flow-card personal-flow-card--approval">
          <div class="personal-flow-card__header">
            <span>Approval rule</span>
            <strong>simple</strong>
          </div>
          <p>No approval is needed for planning only.</p>
          <p>Approval is required before creating reminders, sending messages, editing calendars, changing files or using external apps.</p>
        </article>
        <article class="personal-flow-card personal-flow-receipt" data-personal-flow-receipt="${safePlanId}">
          <div class="personal-flow-card__header">
            <span>Simple receipt</span>
            <strong>done</strong>
          </div>
          <dl>
            <div><dt>Request</dt><dd>${request}</dd></div>
            <div><dt>Mode</dt><dd>${safeProfile}</dd></div>
            <div><dt>Changed</dt><dd>Nothing outside this dashboard</dd></div>
            <div><dt>Approval</dt><dd>Not needed for this read-only plan</dd></div>
            <div><dt>Rollback</dt><dd>Not needed</dd></div>
          </dl>
        </article>
      </div>
    `;
  }

  function shouldHandleDeveloperReviewFlow(userText, guidedFlow) {
    if (guidedFlow === 'developer-review-workspace') return true;
    const lower = String(userText || '').toLowerCase();
    const asksReview = /\b(review|audit|analyze|analyse|inspect)\b.{0,42}\b(repository|repo|workspace|project|codebase|folder)\b/.test(lower)
      || lower.includes('review this workspace')
      || lower.includes('review this repository')
      || lower.includes('developer mode');
    const asksPersonal = /\b(day|routine|reminder|calendar|message)\b/.test(lower);
    return asksReview && !asksPersonal;
  }

  function renderDeveloperWorkspacePicker(userText) {
    const body = [
      'Developer mode is active.',
      '',
      'To review a repository safely, choose a folder or use the current runtime workspace. I will start read-only, list risks, show a patch preview, and require approval before any edit.',
    ].join('\n');
    appendEcho('core', body, buildDeveloperWorkspacePickerCard(userText));
  }

  function buildDeveloperWorkspacePickerCard(userText) {
    const request = escapeHtml(String(userText || 'Review this repository safely.'));
    return `
      <div class="developer-flow-grid" data-developer-flow="workspace-picker">
        <article class="developer-flow-card developer-flow-card--wide">
          <div class="developer-flow-card__header">
            <span>Select workspace</span>
            <strong>read-only first</strong>
          </div>
          <p>Choose a repository folder so Zavorth can inspect file names and structure from the browser, or use the runtime workspace already configured on this host.</p>
          <div class="developer-flow-actions">
            <button type="button" class="interactive-btn interactive-btn--primary" data-developer-flow-action="select-folder">Select folder</button>
            <button type="button" class="interactive-btn" data-developer-flow-action="use-current-workspace">Use current workspace</button>
          </div>
        </article>
        <article class="developer-flow-card">
          <div class="developer-flow-card__header">
            <span>Request</span>
            <strong>queued</strong>
          </div>
          <p>${request}</p>
        </article>
        <article class="developer-flow-card">
          <div class="developer-flow-card__header">
            <span>Safety</span>
            <strong>approval gated</strong>
          </div>
          <p>Patch preview is allowed. Editing files requires scoped approval and rollback evidence.</p>
        </article>
      </div>
    `;
  }

  function renderDeveloperReviewFlow(userText, workspace) {
    const receiptId = `developer-review-${Date.now().toString(36)}`;
    const safeWorkspace = workspace || {
      root: 'current runtime workspace',
      fileCount: 0,
      sampledFileCount: 0,
      totalBytes: 0,
      topExtensions: [],
      sampleFiles: [],
      source: 'runtime',
    };
    recordTraceEvent({
      type: 'artifact',
      title: 'Patch preview prepared',
      detail: `${safeWorkspace.root}: preview only, no files edited.`,
      meta: 'developer',
      status: 'preview',
      receipt: {
        id: receiptId,
        status: 'preview',
        summary: 'Developer review completed as read-only preview. Patch proposal requires approval before editing.',
        rollback: 'git diff / reverse patch evidence required before mutation',
      },
    });
    recordTraceEvent({
      type: 'approval',
      title: 'Patch approval required',
      detail: 'Editing files is blocked until the operator approves a scoped patch.',
      meta: receiptId,
      status: 'pending',
    });
    const body = [
      `Developer mode is active for ${safeWorkspace.root}.`,
      '',
      'I reviewed the workspace in preview mode. No files were edited, no commands were executed, and no network access was used.',
      '',
      'A patch proposal is ready below. Applying it requires scoped approval and rollback evidence.',
    ].join('\n');
    appendEcho('core', body, buildDeveloperReviewCards({ receiptId, workspace: safeWorkspace, userText }));
  }

  function buildDeveloperReviewCards({ receiptId, workspace, userText }) {
    const safeReceiptId = escapeHtml(receiptId);
    const safeRoot = escapeHtml(workspace.root || 'current runtime workspace');
    const safeRequest = escapeHtml(String(userText || 'Review this repository safely.'));
    const fileCount = Number(workspace.fileCount || 0);
    const sampledFileCount = Number(workspace.sampledFileCount || 0);
    const totalBytes = formatBytes(workspace.totalBytes || 0);
    const extensionSummary = Array.isArray(workspace.topExtensions) && workspace.topExtensions.length
      ? workspace.topExtensions.map((entry) => `${escapeHtml(entry.extension)} ${Number(entry.count || 0)}`).join(', ')
      : 'runtime workspace';
    const sampleFiles = Array.isArray(workspace.sampleFiles) && workspace.sampleFiles.length
      ? workspace.sampleFiles.map((file) => `<li>${escapeHtml(file)}</li>`).join('')
      : '<li>Runtime workspace selected; live file list is owned by the runtime.</li>';
    return `
      <div class="developer-flow-grid" data-developer-flow="review-workspace" data-developer-receipt="${safeReceiptId}">
        <article class="developer-flow-card developer-flow-card--summary">
          <div class="developer-flow-card__header">
            <span>Repository review</span>
            <strong>preview</strong>
          </div>
          <dl class="developer-flow-facts">
            <div><dt>Workspace</dt><dd>${safeRoot}</dd></div>
            <div><dt>Files</dt><dd>${fileCount || 'runtime scoped'}</dd></div>
            <div><dt>Sampled</dt><dd>${sampledFileCount || 'runtime scoped'}</dd></div>
            <div><dt>Size</dt><dd>${totalBytes}</dd></div>
            <div><dt>Types</dt><dd>${extensionSummary}</dd></div>
          </dl>
        </article>
        <article class="developer-flow-card developer-flow-card--risks">
          <div class="developer-flow-card__header">
            <span>Risks found</span>
            <strong>medium</strong>
          </div>
          <ol class="developer-flow-list">
            <li><strong>Test gate</strong><span>Run a focused check before applying any patch.</span></li>
            <li><strong>Config drift</strong><span>Review package and environment files before dependency changes.</span></li>
            <li><strong>Secret exposure</strong><span>Keep tokens protected; never paste raw credentials into prompts or receipts.</span></li>
          </ol>
        </article>
        <article class="developer-flow-card developer-flow-card--wide">
          <div class="developer-flow-card__header">
            <span>Sample files</span>
            <strong>read-only</strong>
          </div>
          <ul class="developer-flow-samples">${sampleFiles}</ul>
        </article>
        <article class="developer-flow-card developer-flow-card--wide">
          <div class="developer-flow-card__header">
            <span>Patch preview</span>
            <strong>approval required</strong>
          </div>
          <pre class="developer-flow-diff"><code>diff --git a/README.md b/README.md
@@
+### Operational receipt
+Before applying code changes, Zavorth records the request, risk, approval scope and rollback evidence.</code></pre>
          <div class="developer-flow-actions" data-developer-approval="${safeReceiptId}" data-status="pending">
            <button type="button" class="interactive-btn" data-developer-flow-action="deny-patch" data-developer-receipt-id="${safeReceiptId}">Deny</button>
            <button type="button" class="interactive-btn interactive-btn--primary" data-developer-flow-action="approve-patch" data-developer-receipt-id="${safeReceiptId}">Approve preview</button>
          </div>
        </article>
        <article class="developer-flow-card developer-flow-receipt">
          <div class="developer-flow-card__header">
            <span>Developer receipt</span>
            <strong>ready</strong>
          </div>
          <dl class="developer-flow-facts">
            <div><dt>Request</dt><dd>${safeRequest}</dd></div>
            <div><dt>Changed</dt><dd>Nothing</dd></div>
            <div><dt>Approval</dt><dd>Required before editing files</dd></div>
            <div><dt>Rollback</dt><dd>Reverse patch or git diff before mutation</dd></div>
          </dl>
        </article>
      </div>
    `;
  }

  function shouldHandleBusinessAuditFlow(userText, guidedFlow) {
    if (guidedFlow === 'business-audit') return true;
    const lower = String(userText || '').toLowerCase();
    const asksBusiness = lower.includes('business mode')
      || /\b(run|start|prepare|show)\b.{0,34}\b(audit|policy|approvals?|compliance|governance)\b/.test(lower)
      || /\b(audit|policy|approvals?|compliance|governance)\b.{0,34}\b(business|company|team|enterprise)\b/.test(lower);
    const asksDeveloperOnly = /\b(repository|repo|workspace|patch|codebase)\b/.test(lower);
    return asksBusiness && !asksDeveloperOnly;
  }

  function renderBusinessAuditFlow(userText) {
    const receiptId = `business-audit-${Date.now().toString(36)}`;
    const ttlMinutes = 15;
    recordTraceEvent({
      type: 'receipt',
      title: 'Business audit receipt',
      detail: 'Governed audit projected with policy, approval channel, scope, TTL, blocked actions and evidence.',
      meta: receiptId,
      status: 'preview',
      receipt: {
        id: receiptId,
        status: 'preview',
        summary: 'Read-only business audit. No policy, channel or workspace mutation occurred.',
        artifact: 'business-audit-preview',
        rollback: 'not needed; no mutable action executed',
      },
    });
    const body = [
      'Business mode is active.',
      '',
      'I prepared a governed audit preview. This is safe to inspect: no policy was changed, no channel was modified, no message was sent and no workspace files were edited.',
      '',
      'The approval channel, policy scope, TTL, blocked actions and receipt evidence are below.',
    ].join('\n');
    appendEcho('core', body, buildBusinessAuditCards({ receiptId, ttlMinutes, userText }));
  }

  function buildBusinessAuditCards({ receiptId, ttlMinutes, userText }) {
    const safeReceiptId = escapeHtml(receiptId);
    const request = escapeHtml(String(userText || 'Run a governed business audit.'));
    return `
      <div class="business-flow-grid" data-business-flow="audit" data-business-receipt="${safeReceiptId}">
        <article class="business-flow-card business-flow-card--policy">
          <div class="business-flow-card__header">
            <span>Policy</span>
            <strong>clear</strong>
          </div>
          <ul class="business-flow-list">
            <li><strong>Can do</strong><span>Read status, summarize readiness, inspect receipts and list pending approvals.</span></li>
            <li><strong>Needs approval</strong><span>Change policy, send messages, connect live channels, edit files or run external actions.</span></li>
            <li><strong>Blocked</strong><span>Expose raw secrets, bypass the safety gate, replay expired approval or widen scope silently.</span></li>
          </ul>
        </article>
        <article class="business-flow-card business-flow-card--channel">
          <div class="business-flow-card__header">
            <span>Approval channel</span>
            <strong>dashboard</strong>
          </div>
          <p>Primary approval channel: Dashboard inbox. Optional channel delivery stays inactive until Telegram, email or another channel is configured and tested live.</p>
          <div class="business-flow-actions" data-business-approval="${safeReceiptId}" data-status="pending">
            <button type="button" class="interactive-btn" data-business-flow-action="deny-channel" data-business-receipt-id="${safeReceiptId}">Deny</button>
            <button type="button" class="interactive-btn interactive-btn--primary" data-business-flow-action="confirm-channel" data-business-receipt-id="${safeReceiptId}">Confirm channel</button>
          </div>
        </article>
        <article class="business-flow-card">
          <div class="business-flow-card__header">
            <span>Scope</span>
            <strong>bounded</strong>
          </div>
          <dl class="business-flow-facts">
            <div><dt>Request</dt><dd>${request}</dd></div>
            <div><dt>Scope</dt><dd>readiness, approvals, receipts, channels</dd></div>
            <div><dt>TTL</dt><dd>${ttlMinutes} minutes for approval decisions</dd></div>
            <div><dt>Actor</dt><dd>Operator through dashboard</dd></div>
          </dl>
        </article>
        <article class="business-flow-card business-flow-card--blocked">
          <div class="business-flow-card__header">
            <span>Blocked actions</span>
            <strong>enforced</strong>
          </div>
          <ul class="business-flow-blocks">
            <li>Sending an external message without scoped approval.</li>
            <li>Changing channel tokens or exposing raw credentials.</li>
            <li>Editing files or policy outside the approved scope.</li>
            <li>Using a stale approval after the TTL expires.</li>
          </ul>
        </article>
        <article class="business-flow-card business-flow-receipt">
          <div class="business-flow-card__header">
            <span>Business receipt</span>
            <strong>evidence</strong>
          </div>
          <dl class="business-flow-facts">
            <div><dt>Receipt</dt><dd>${safeReceiptId}</dd></div>
            <div><dt>Approver</dt><dd>Operator, via dashboard approval channel</dd></div>
            <div><dt>Evidence</dt><dd>policy summary, scope, TTL, blocked actions, decision trace</dd></div>
            <div><dt>Changed</dt><dd>Nothing in preview</dd></div>
            <div><dt>Rollback</dt><dd>Not needed until a mutable approval is executed</dd></div>
          </dl>
        </article>
      </div>
    `;
  }

  // â•â•â• Artifact Pane Logic â•â•â•
  const artifactPane = document.getElementById('artifact-pane');
  const artifactTitle = document.getElementById('artifact-title');
  const artifactBody = document.getElementById('artifact-body');
  const artifactClose = document.getElementById('artifact-close');

  if (artifactClose) {
    artifactClose.addEventListener('click', () => {
      artifactPane.classList.add('hidden');
    });
  }

  neuralFeed.addEventListener('click', (e) => {
    const echoActionButton = e.target.closest('.echo-action-row [data-prompt]');
    if (echoActionButton) {
      e.preventDefault();
      e.stopPropagation();
      if (composeInput) {
        composeInput.value = echoActionButton.getAttribute('data-prompt') || '';
        composeInput.dispatchEvent(new Event('input'));
        composeInput.focus();
      }
      return;
    }

    const developerFlowButton = e.target.closest('[data-developer-flow-action]');
    if (developerFlowButton) {
      e.preventDefault();
      e.stopPropagation();
      const action = developerFlowButton.getAttribute('data-developer-flow-action');
      if (action === 'select-folder') {
        chooseWorkspaceFolder();
        return;
      }
      if (action === 'use-current-workspace') {
        pendingWorkspaceSelection = {
          source: 'runtime',
          root: 'current runtime workspace',
          fileCount: 0,
          sampledFileCount: 0,
          totalBytes: 0,
          topExtensions: [],
          sampleFiles: [],
          selectedAt: new Date().toISOString(),
        };
        pendingGuidedFlow = 'developer-review-workspace';
        if (!selectedExperienceProfile) setSelectedExperienceProfile('developer');
        if (composeInput) {
          composeInput.value = 'Review this repository safely using the current runtime workspace. Read first, list risks, show patch preview, and do not edit without approval.';
          composeInput.dispatchEvent(new Event('input'));
        }
        transmitSignal();
        return;
      }
      if (action === 'deny-patch' || action === 'approve-patch') {
        const receiptId = developerFlowButton.getAttribute('data-developer-receipt-id') || 'developer-review';
        const group = developerFlowButton.closest('[data-developer-approval]');
        if (group) group.dataset.status = action === 'approve-patch' ? 'approved-preview' : 'denied';
        group?.querySelectorAll('button').forEach((button) => {
          button.disabled = true;
        });
        developerFlowButton.textContent = action === 'approve-patch' ? 'Preview approved' : 'Denied';
        recordTraceEvent({
          type: 'approval-decision',
          title: action === 'approve-patch' ? 'Patch preview approved' : 'Patch preview denied',
          detail: receiptId,
          meta: 'developer',
          status: action === 'approve-patch' ? 'approved-preview' : 'denied',
          approvalId: receiptId,
          receipt: {
            id: receiptId,
            status: action === 'approve-patch' ? 'approved-preview' : 'denied',
            summary: action === 'approve-patch'
              ? 'Operator approved the patch proposal. File mutation still requires runtime safety approval.'
              : 'Operator denied the patch proposal. No file mutation occurred.',
            rollback: 'not needed; no file was edited in dashboard preview',
          },
        });
        appendEcho('core', action === 'approve-patch'
          ? 'Patch proposal approved as a preview. I still will not edit files from this dashboard preview; live execution must go through runtime safety approval with scope and rollback evidence.'
          : 'Patch proposal denied. No files were changed.');
        return;
      }
    }

    const businessFlowButton = e.target.closest('[data-business-flow-action]');
    if (businessFlowButton) {
      e.preventDefault();
      e.stopPropagation();
      const action = businessFlowButton.getAttribute('data-business-flow-action');
      const receiptId = businessFlowButton.getAttribute('data-business-receipt-id') || 'business-audit';
      const group = businessFlowButton.closest('[data-business-approval]');
      if (group) group.dataset.status = action === 'confirm-channel' ? 'confirmed' : 'denied';
      group?.querySelectorAll('button').forEach((button) => {
        button.disabled = true;
      });
      businessFlowButton.textContent = action === 'confirm-channel' ? 'Channel confirmed' : 'Denied';
      recordTraceEvent({
        type: 'approval-decision',
        title: action === 'confirm-channel' ? 'Business approval channel confirmed' : 'Business approval channel denied',
        detail: receiptId,
        meta: 'business',
        status: action === 'confirm-channel' ? 'confirmed' : 'denied',
        approvalId: receiptId,
        receipt: {
          id: receiptId,
          status: action === 'confirm-channel' ? 'confirmed' : 'denied',
          summary: action === 'confirm-channel'
            ? 'Operator confirmed the dashboard as approval channel for this audit preview. No mutable action executed.'
            : 'Operator denied the approval channel for this audit preview. No mutable action executed.',
          rollback: 'not needed; no policy or channel was changed',
        },
      });
      appendEcho('core', action === 'confirm-channel'
        ? 'Dashboard approval channel confirmed for this audit preview. I still will not change policy, send messages or connect channels without a separate scoped approval.'
        : 'Approval channel denied for this audit preview. No business policy, channel or workspace state changed.');
      return;
    }

    const traceButton = e.target.closest('[data-zavorth-trace-action="open"]');
    if (traceButton) {
      e.preventDefault();
      e.stopPropagation();
      const runtimeBridge = window.ZavorthRuntimeBridge;
      const query = {
        runId: traceButton.dataset.runId || '',
        traceId: traceButton.dataset.traceId || '',
        sessionId: traceButton.dataset.sessionId || '',
      };
      if (runtimeBridge && typeof runtimeBridge.openPersistentTrace === 'function') {
        runtimeBridge.openPersistentTrace(query, window.ZavorthCommandCenterChat || {}).catch((error) => {
          window.emitSignal?.('error', 'Trace unavailable', error?.message || 'I could not open this run trace.');
        });
      } else {
        openTraceSheet(query);
      }
      return;
    }

    const artifactButton = e.target.closest('[data-zavorth-artifact-id]');
    if (artifactButton) {
      const runtimeBridge = window.ZavorthRuntimeBridge;
      const id = artifactButton.dataset.zavorthArtifactId;
      if (runtimeBridge && typeof runtimeBridge.openArtifact === 'function') {
        runtimeBridge.openArtifact(id, {
          openArtifactPane,
          emitSignal: window.emitSignal,
        }).catch((error) => {
          openArtifactPane('Artifact', `<div class="empty-state"><div class="empty-state__icon">Doc</div><div class="empty-state__title">Could not open</div><div class="empty-state__desc">${escapeHtml(error?.message || 'Try again.')}</div></div>`);
        });
      } else {
        openArtifactPane('Artifact', `<div class="empty-state"><div class="empty-state__icon">Doc</div><div class="empty-state__title">Runtime not connected</div><div class="empty-state__desc">Unlock the dashboard to read live artifacts.</div></div>`);
      }
      return;
    }

    const remoteMeshButton = e.target.closest('[data-zavorth-remote-mesh-action]');
    if (remoteMeshButton) {
      const card = remoteMeshButton.closest('.zavorth-remote-mesh-card');
      const id = remoteMeshButton.dataset.zavorthRemoteMeshApprovalId;
      const action = String(remoteMeshButton.dataset.zavorthRemoteMeshAction || '').trim();
      const currentStatus = String(card?.dataset?.status || 'pending');
      if (currentStatus !== 'pending' && currentStatus !== 'retryable') return;
      const capability = capabilityFromElement(card);
      if (action === 'deny') {
        recordTraceEvent({
          type: 'approval-decision',
          title: 'Remote Mesh negado',
          detail: id,
          meta: 'Notebook MCP',
          status: 'denied',
          approvalId: id,
          capability,
        });
        rememberDismissedRemoteMeshApproval(id);
        if (card) card.dataset.status = 'denied';
        card?.querySelectorAll('button').forEach((button) => {
          button.disabled = true;
        });
        remoteMeshButton.textContent = 'Denied';
        setTimeout(() => removeRemoteMeshApprovalCard(card), 220);
        return;
      }
      if (action !== 'apply') return;
      const runtimeBridge = window.ZavorthRuntimeBridge;
      if (!runtimeBridge || typeof runtimeBridge.applyRemoteMeshApproval !== 'function') return;
      recordTraceEvent({
        type: 'approval-decision',
        title: 'Remote Mesh autorizado',
        detail: id,
        meta: 'Notebook MCP',
        status: 'applying',
        approvalId: id,
        capability,
      });
      card?.querySelectorAll('button').forEach((button) => {
        button.disabled = true;
      });
      remoteMeshButton.textContent = 'Allowing...';
      runtimeBridge.applyRemoteMeshApproval({ id }, {
        appendEcho,
        emitSignal: window.emitSignal,
      }).then((payload) => {
        if (payload?.ok) {
          rememberDismissedRemoteMeshApproval(id);
          if (card) card.dataset.status = 'applied';
          remoteMeshButton.textContent = 'Allowed';
          recordTraceEvent({
            type: 'remote-apply',
            title: 'MCP aplicado',
            detail: payload?.receipt?.summary || payload?.message || id,
            meta: 'receipt',
            status: 'success',
            approvalId: id,
            capability,
            receipt: payload?.receipt || {
              id: payload?.receiptId || id,
              status: 'success',
              summary: payload?.message,
            },
            replay: {
              runId: payload?.runId || id,
              traceId: payload?.traceId,
              sessionId: payload?.sessionId,
              policy: 'receipts only',
            },
          });
          setTimeout(() => removeRemoteMeshApprovalCard(card), 520);
          return;
        }
        const failureMessage = String(payload?.error || payload?.jsonRpcError?.message || 'Check the notebook MCP server.');
        recordTraceEvent({
          type: 'error',
          title: 'MCP recusou a acao',
          detail: failureMessage,
          meta: id,
          status: 'failed',
        });
        const terminalApprovalFailure = /expired|not found|already used/i.test(failureMessage);
        if (terminalApprovalFailure) {
          rememberDismissedRemoteMeshApproval(id);
          if (card) card.dataset.status = 'expired';
          card?.querySelectorAll('button').forEach((button) => {
            button.disabled = true;
          });
          remoteMeshButton.textContent = 'Closed';
          appendEcho('core', `This Remote Mesh approval is no longer active.\n\n${escapeHtml(failureMessage)}`);
          setTimeout(() => removeRemoteMeshApprovalCard(card), 1600);
          return;
        }
        if (card) card.dataset.status = 'retryable';
        card?.querySelectorAll('button').forEach((button) => {
          button.disabled = false;
        });
        remoteMeshButton.textContent = 'Try again';
        appendEcho('core', `O MCP recusou esta acao remota.\n\n${escapeHtml(failureMessage)}`);
      }).catch((error) => {
        const failureMessage = String(error?.message || 'Tente novamente.');
        recordTraceEvent({
          type: 'error',
          title: 'MCP unavailable',
          detail: failureMessage,
          meta: id,
          status: 'failed',
        });
        const terminalApprovalFailure = /expired|not found|already used/i.test(failureMessage);
        if (terminalApprovalFailure) {
          rememberDismissedRemoteMeshApproval(id);
          if (card) card.dataset.status = 'expired';
          card?.querySelectorAll('button').forEach((button) => {
            button.disabled = true;
          });
          remoteMeshButton.textContent = 'Closed';
          appendEcho('core', `This Remote Mesh approval is no longer active.\n\n${escapeHtml(failureMessage)}`);
          setTimeout(() => removeRemoteMeshApprovalCard(card), 1600);
          return;
        }
        if (card) card.dataset.status = 'retryable';
        card?.querySelectorAll('button').forEach((button) => {
          button.disabled = false;
        });
        remoteMeshButton.textContent = 'Try again';
        appendEcho('core', `Nao consegui chamar o MCP do notebook.\n\n${escapeHtml(failureMessage)}`);
      });
      return;
    }

    const approvalButton = e.target.closest('[data-zavorth-approval-decision]');
    if (approvalButton) {
      const runtimeBridge = window.ZavorthRuntimeBridge;
      if (!runtimeBridge || typeof runtimeBridge.decideApproval !== 'function') return;
      const card = approvalButton.closest('.zavorth-approval-card');
      const decision = approvalButton.dataset.zavorthApprovalDecision;
      const id = approvalButton.dataset.zavorthApprovalId;
      const kind = approvalButton.dataset.zavorthApprovalKind;
      const capability = capabilityFromElement(card);
      recordTraceEvent({
        type: 'approval-decision',
        title: decision === 'approve' ? 'Approval autorizado' : 'Approval recusado',
        detail: id,
        meta: kind,
        status: decision,
        approvalId: id,
        capability,
        preview: capability?.preview || '',
      });
      if (decision === 'reject') {
        if (card) card.dataset.status = 'denied';
        approvalButton.textContent = 'Denied';
      } else {
        approvalButton.textContent = 'Allowing...';
      }
      card?.querySelectorAll('button').forEach((button) => {
        button.disabled = true;
      });
      runtimeBridge.decideApproval({ id, kind, decision }, {
        appendEcho,
        renderApprovals,
        renderTranscript,
        emitSignal: window.emitSignal,
      }).catch((error) => {
        card?.querySelectorAll('button').forEach((button) => {
          button.disabled = false;
        });
        recordTraceEvent({
          type: 'error',
          title: 'Falha ao resolver approval',
          detail: error?.message || 'Tente novamente.',
          meta: kind,
          status: 'failed',
        });
        appendEcho('core', `I could not resolve this approval.\n\n${error?.message || 'Try again.'}`);
      });
      return;
    }

    const cell = e.target.closest('.logic-cell');
    if (cell && artifactPane) {
      const name = cell.querySelector('.logic-cell__icon').nextSibling.textContent.trim();
      const output = cell.querySelector('.logic-cell__block-content');

      artifactTitle.textContent = name || 'Artifact';
      artifactBody.innerHTML = output
        ? sanitizeRenderedHtml(`<div class="artifact-render">${output.innerHTML}</div>`)
        : `<div class="empty-state"><div class="empty-state__icon">Doc</div><div class="empty-state__title">No artifact generated</div><div class="empty-state__desc">This operation did not produce a viewable output.</div></div>`;

      if (window.Prism && output) Prism.highlightAllUnder(artifactBody);
      artifactPane.classList.remove('hidden');
      updateDashboardGlass();
    }
  });

  // â•â•â• Signal System (Toasts) â•â•â•
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
    }, 4000);
  };

  // â•â•â• Command Palette â•â•â•
  const overlayShade = document.getElementById('overlay-shade');
  const cmdPalette = document.getElementById('cmd-palette');
  const cmdInput = document.getElementById('cmd-input');
  const searchBtn = document.getElementById('search-btn');
  const mobileMenuTrigger = document.getElementById('mobile-menu-trigger');
  const mobileDrawer = document.getElementById('mobile-drawer');
  const mobileDrawerClose = document.getElementById('mobile-drawer-close');
  const mobileDrawerSearch = document.getElementById('mobile-drawer-search');
  const drawerItems = document.querySelectorAll('.mobile-drawer__item[data-drawer-sector]');

  const coreModal = document.getElementById('core-modal');
  const coreModalClose = document.getElementById('core-modal-close');
  const coreModalCancel = document.getElementById('core-modal-cancel');

  function openPalette() {
    overlayShade.classList.add('active');
    markOverlayOpened();
    closeMobileDrawer(false);
    cmdPalette.classList.add('active');
    cmdInput.focus();
  }

  function openMobileDrawer() {
    if (!mobileDrawer || !overlayShade) return;
    overlayShade.classList.add('active');
    markOverlayOpened();
    mobileDrawer.classList.add('active');
    mobileDrawer.setAttribute('aria-hidden', 'false');
    coreFrame?.classList.add('drawer-open');
  }

  function closeMobileDrawer(clearShade = true) {
    if (!mobileDrawer) return;
    mobileDrawer.classList.remove('active');
    mobileDrawer.setAttribute('aria-hidden', 'true');
    coreFrame?.classList.remove('drawer-open');
    if (clearShade && overlayShade) overlayShade.classList.remove('active');
  }

  function activateSector(sectorId) {
    const dockNode = document.querySelector(`.dock-node[data-sector="${sectorId}"]`);
    if (dockNode) dockNode.click();
  }

  function syncDrawerActive(sectorId) {
    drawerItems.forEach(item => {
      item.classList.toggle('active', item.dataset.drawerSector === sectorId);
    });
  }

  function dismissOverlays() {
    overlayShade.classList.remove('active');
    cmdPalette.classList.remove('active');
    coreModal.classList.remove('active');
    closeToolSheet(false);
    closeTraceSheet(false);
    closeMobileDrawer(false);
  }

  if (searchBtn) searchBtn.addEventListener('click', openPalette);
  const searchTrigger = document.getElementById('search-trigger');
  if (searchTrigger) searchTrigger.addEventListener('click', openPalette);
  if (mobileMenuTrigger) mobileMenuTrigger.addEventListener('click', openMobileDrawer);
  if (mobileDrawerClose) mobileDrawerClose.addEventListener('click', () => closeMobileDrawer());
  if (mobileDrawerSearch) mobileDrawerSearch.addEventListener('click', openPalette);
  drawerItems.forEach(item => {
    item.addEventListener('click', () => {
      const sectorId = item.dataset.drawerSector;
      activateSector(sectorId);
      syncDrawerActive(sectorId);
      closeMobileDrawer();
    });
  });
  dockNodes.forEach(node => {
    node.addEventListener('click', () => syncDrawerActive(node.dataset.sector));
  });
  if (overlayShade) {
    overlayShade.addEventListener('click', () => {
      if (Date.now() - overlayOpenedAt < 320) return;
      dismissOverlays();
    });
  }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openPalette();
    }
    if (e.key === 'Escape') {
      dismissOverlays();
      if (artifactPane) artifactPane.classList.add('hidden');
    }
  });

  window.openCoreModal = function(title, content) {
    document.getElementById('core-modal-title').textContent = title;
    document.getElementById('core-modal-body').innerHTML = sanitizeRenderedHtml(content, { allowTrustedUi: true });
    overlayShade.classList.add('active');
    markOverlayOpened();
    coreModal.classList.add('active');
  };

  if (coreModalClose) coreModalClose.addEventListener('click', dismissOverlays);
  if (coreModalCancel) coreModalCancel.addEventListener('click', dismissOverlays);

  // â•â•â• Seed Initial Neural Feed â•â•â•
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

  // â•â•â• Boot Sequence â•â•â•
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
          window.emitSignal('success', 'Core Connected', 'Secure connection established with the runtime.');
        }, 600);
      }, 800);
    }, 600);
  } else {
    seedNeuralFeed();
  }

  // â•â•â• Theme Toggle â•â•â•
  const themeToggle = document.getElementById('theme-toggle');
  const iconSun = themeToggle ? themeToggle.querySelector('.icon-sun') : null;
  const iconMoon = themeToggle ? themeToggle.querySelector('.icon-moon') : null;

  function setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('zavorth_theme', themeName);
    if (iconSun && iconMoon) {
      if (themeName === 'light') {
        iconSun.style.display = 'block';
        iconMoon.style.display = 'none';
      } else {
        iconSun.style.display = 'none';
        iconMoon.style.display = 'block';
      }
    }
  }

  const savedTheme = localStorage.getItem('zavorth_theme');
  if (savedTheme) {
    setTheme(savedTheme);
  } else {
    setTheme('zavorth');
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      setTheme(current === 'light' ? 'zavorth' : 'light');
    });
  }

})();
