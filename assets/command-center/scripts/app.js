/**
Zavorth Nexus --- Core Runtime Logic
Manages dock navigation, neural feed (chat), signals, and interactive behaviors.


nction () {
use strict';

/ --------- Markdown & Syntax Highlighting ---------
f (window.marked) {
 marked.setOptions({ breaks: true, gfm: true });


/ --------- Dock Navigation ---------
onst coreFrame = document.getElementById('core-frame');
onst dockNodes = document.querySelectorAll('.dock-node[data-sector]');
onst sectors = document.querySelectorAll('.sector');
onst bridgeCurrent = document.getElementById('bridge-current');

onst sectorLabels = {
 terminal: 'Inbox',
 overview: 'Work',
 nodes: 'Memory',
 skills: 'Tools',
 usage: 'Models',
 config: 'Settings',
 channels: 'Channels',
 'sales-os': 'Approvals',
 instances: 'History',
 sessions: 'Sessions',
 agents: 'Agents',
 dreams: 'Rest',
 docs: 'Docs',
 cron: 'Schedule'
;

ockNodes.forEach(node => {
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
);

/ --------- Neural Feed (Chat) Input ---------
onst composeInput = document.getElementById('compose-input');
onst composeDock = document.querySelector('.compose-dock');
onst composeFrame = document.querySelector('.compose-dock__input-frame');
onst tokenCount = document.getElementById('token-count');
onst COMPOSER_SETTINGS_KEY = 'zavorth.control.composerSettings';
onst DEFAULT_COMPOSER_SETTINGS = {
 voice: 'default',
 model: 'auto',
 sensitivity: 'default',
 thinking: false,
 tools: true,
 focus: false,
;
et composerSettingsState = readComposerSettings();
et pendingAttachments = [];
et pendingSelectedSkills = [];
et lastVoiceInput = null;
et activeRecognition = null;
et isListening = false;
et traceSheetQuery = { runId: '', traceId: '', sessionId: '', source: '' };
et selectedExperienceProfile = '';
et pendingGuidedFlow = '';
et pendingWorkspaceSelection = null;

onst attachmentTray = document.createElement('div');
ttachmentTray.className = 'compose-attachments';
ttachmentTray.setAttribute('aria-live', 'polite');

onst composerContextBar = document.createElement('div');
omposerContextBar.className = 'compose-context-bar';
omposerContextBar.hidden = true;
omposerContextBar.setAttribute('aria-live', 'polite');

onst skillPopover = document.createElement('div');
killPopover.className = 'compose-skill-popover hidden';
killPopover.setAttribute('role', 'dialog');
killPopover.setAttribute('aria-label', 'Choose skill');

f (composeFrame && composeInput) {
 composeFrame.insertBefore(attachmentTray, composeInput.nextSibling);
 composeFrame.insertBefore(composerContextBar, attachmentTray.nextSibling);
 (composeDock || composeFrame).appendChild(skillPopover);


unction readComposerSettings() {
 try {
   const parsed = JSON.parse(localStorage.getItem(COMPOSER_SETTINGS_KEY) || '{}');
   return {
     ...DEFAULT_COMPOSER_SETTINGS,
     ...(parsed && typeof parsed === 'object' ? parsed : {}),
   };
 } catch {
   return { ...DEFAULT_COMPOSER_SETTINGS };
 }


unction writeComposerSettings(nextSettings) {
 composerSettingsState = {
   ...DEFAULT_COMPOSER_SETTINGS,
   ...(nextSettings && typeof nextSettings === 'object' ? nextSettings : {}),
 };
 try {
   localStorage.setItem(COMPOSER_SETTINGS_KEY, JSON.stringify(composerSettingsState));
 } catch {
   // local composer preferences are best-effort.
 }
 applyComposerSettingsToUi();


unction getComposePlaceholder() {
 if (composerSettingsState.model === 'safe') return 'Ask Zavorth safely';
 if (composerSettingsState.model === 'local') return 'Ask Zavorth locally';
 return 'Ask Zavorth';


unction applyComposerSettingsToUi() {
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
   const active = key === 'safe-review'
     ? composerSettingsState.model === 'safe' && composerSettingsState.sensitivity === 'high'
     : key === 'fast-local'
       ? composerSettingsState.model === 'local' && composerSettingsState.focus
       : composerSettingsState.model === 'auto' && composerSettingsState.sensitivity === 'default';
   preset.classList.toggle('is-active', Boolean(active));
 });
 document.body.classList.toggle('zavorth-chat-focus-mode', Boolean(composerSettingsState.focus));
 if (composeInput && pendingAttachments.length === 0) {
   composeInput.placeholder = getComposePlaceholder();
 }
 updateComposerContextBar();


unction emitLocalNotice(message) {
 if (window.emitSignal) {
   window.emitSignal('info', 'Dashboard', message);
   return;
 }
 appendEcho('core', message);


unction messageFromErrorPayload(payload, fallback = 'Try again in a moment.') {
 const candidates = [
   payload?.error,
   payload?.message,
   payload?.reason,
   payload?.detail,
 ];
 for (const candidate of candidates) {
   if (!candidate) continue;
   if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
   if (typeof candidate === 'object') {
     const nested = candidate.message || candidate.detail || candidate.reason || candidate.code;
     if (typeof nested === 'string' && nested.trim()) return nested.trim();
   }
 }
 return fallback;


unction messageFromCaughtError(error, fallback = 'Try again in a moment.') {
 const message = String(error?.message || '').trim();
 if (message && message !== '[object Object]') return message;
 return messageFromErrorPayload(error?.payload, fallback);


unction formatBytes(size) {
 const value = Number(size || 0);
 if (value < 1024) return `${value} B`;
 if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
 return `${(value / 1024 / 1024).toFixed(1)} MB`;


unction updateSendAffordance() {
 const send = document.getElementById('send-btn');
 if (!send || !composeInput) return;
 const hasText = composeInput.value.trim().length > 0;
 const hasFiles = pendingAttachments.length > 0;
 send.classList.toggle('active', hasText || hasFiles);
 send.setAttribute('aria-label', hasFiles && !hasText ? 'Send files to Zavorth' : 'Send message');


unction setBadge(node, value, visible) {
 if (!node) return;
 node.textContent = String(value);
 node.hidden = !visible;


unction composerSettingLabel(key, value) {
 const normalized = String(value || '').trim();
 if (!normalized || normalized === 'default') return '';
 if (key === 'voice') return normalized.replace('-', ' ');
 if (key === 'model') return normalized === 'safe' ? 'Safe model' : normalized === 'local' ? 'local model' : '';
 if (key === 'sensitivity') return `${normalized} sensitivity`;
 return normalized;


unction updateComposerContextBar() {
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
 ['model', 'sensitivity', 'voice'].forEach((key) => {
   const label = composerSettingLabel(key, composerSettingsState[key]);
   if (label) chips.push(`<span class="compose-context-chip"><strong>${key}</strong>${escapeHtml(label)}</span>`);
 });
 composerContextBar.innerHTML = chips.join('');
 composerContextBar.hidden = chips.length === 0;


unction updateComposerBadges() {
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


unction refreshAttachmentHint() {
 const count = pendingAttachments.length;
 const fileLabel = count === 1 ? '1 file ready' : `${count} files ready`;
 if (composeInput) {
   composeInput.placeholder = count > 0
     ? `${fileLabel}. Tell Zavorth what to do.`
     : getComposePlaceholder();
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
     <span class="compose-attachment-chip" title="${escapeHtml(file.name)}">
       <span class="compose-attachment-chip__icon">${file.text ? 'doc' : 'file'}</span>
       <span class="compose-attachment-chip__name">${escapeHtml(file.name)}</span>
       <span class="compose-attachment-chip__size">${formatBytes(file.size)}</span>
       <button type="button" class="compose-attachment-chip__remove" data-attachment-index="${index}" aria-label="Remove ${escapeHtml(file.name)}">&times;</button>
     </span>
   `).join('');
   attachmentTray.classList.toggle('is-visible', count > 0);
 }
 updateComposerBadges();
 updateSendAffordance();


sync function addAttachmentFiles(fileList) {
 const incoming = Array.from(fileList || []).slice(0, Math.max(0, 5 ? pendingAttachments.length));
 if (incoming.length === 0) return;
 const parsed = await Promise.all(incoming.map(readAttachmentFile));
 pendingAttachments = [...pendingAttachments, ...parsed].slice(0, 5);
 refreshAttachmentHint();
 emitLocalNotice(incoming.length === 1
   ? `File ready: ${incoming[0].name}. Now tell Zavorth what to do with it.`
   : `${incoming.length} files ready. Now tell Zavorth what to do with them.`);


sync function readAttachmentFile(file) {
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


unction attachmentKindLabel(file) {
 const name = String(file?.name || '');
 const extension = name.includes('.') ? name.split('.').pop().slice(0, 5).toUpperCase() : '';
 if (extension) return extension;
 const type = String(file?.type || '');
 if (type.startsWith('text/')) return 'TXT';
 if (type.startsWith('image/')) return 'IMG';
 if (type.includes('pdf')) return 'PDF';
 return 'FILE';


unction buildSentAttachmentCards(files) {
 const items = Array.isArray(files) ? files : [];
 if (items.length === 0) return '';
 return `
   <div class="chat-attachment-grid" aria-label="Uploaded files">
     ${items.map((file) => `
       <div class="chat-attachment-card" title="${escapeHtml(file.name)}">
         <div class="chat-attachment-card__icon">${escapeHtml(attachmentKindLabel(file))}</div>
         <div class="chat-attachment-card__body">
           <div class="chat-attachment-card__name">${escapeHtml(String(file.name || 'file').replace(/\.[^.]+$/, ''))}</div>
           <div class="chat-attachment-card__meta">${escapeHtml(attachmentKindLabel(file))} ? ${formatBytes(file.size)}</div>
         </div>
       </div>
     `).join('')}
   </div>
 `;


f (composeInput) {
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


onst sendBtn = document.getElementById('send-btn');
f (sendBtn) sendBtn.addEventListener('click', transmitSignal);

onst toolSheet = document.getElementById('tool-sheet');
onst toolSheetTrigger = document.getElementById('tool-sheet-trigger');
onst toolSheetClose = document.getElementById('tool-sheet-close');
onst toolSheetActions = document.querySelectorAll('[data-tool-sheet-action]');
onst traceSheet = document.getElementById('trace-sheet');
onst traceSheetTrigger = document.getElementById('trace-sheet-trigger');
onst traceSheetClose = document.getElementById('trace-sheet-close');
onst traceSheetTimeline = document.getElementById('trace-sheet-timeline');
onst traceStepCount = document.getElementById('trace-step-count');
onst traceApprovalCount = document.getElementById('trace-approval-count');
onst traceReceiptCount = document.getElementById('trace-receipt-count');
onst attachFileTrigger = document.getElementById('attach-file-trigger');
onst composerSettingsTrigger = document.getElementById('compose-settings-trigger');
onst composerSettingsPanel = document.getElementById('compose-settings-panel');
onst exportChatTrigger = document.getElementById('export-chat-trigger');
onst newSessionTrigger = document.getElementById('new-session-trigger');
onst attachmentCountBadge = document.getElementById('attachment-count-badge');
onst voiceStateBadge = document.getElementById('voice-state-badge');
onst toolCountBadge = document.getElementById('tool-count-badge');
onst historyCountBadge = document.getElementById('history-count-badge');
onst attachBtn = toolSheetTrigger || document.querySelector('.compose-dock__btn[title="Tools"]');
et overlayOpenedAt = 0;
onst skillsBtn = document.querySelector('.compose-dock__btn[title="Tools"]');
onst voiceBtn = document.getElementById('voice-trigger') || document.querySelector('.compose-dock__btn[title="Voice"]');
onst fileInput = document.createElement('input');
ileInput.type = 'file';
ileInput.multiple = true;
ileInput.style.display = 'none';
ocument.body.appendChild(fileInput);
onst directoryInput = document.createElement('input');
irectoryInput.type = 'file';
irectoryInput.multiple = true;
irectoryInput.setAttribute('webkitdirectory', '');
irectoryInput.setAttribute('directory', '');
irectoryInput.style.display = 'none';
ocument.body.appendChild(directoryInput);
onst traceEvents = [];
onst traceEventIds = new Set();
onst TRACE_EVENT_LIMIT = 90;
et suppressTraceCapture = false;

unction getOverlayShade() {
 return document.getElementById('overlay-shade');


unction markOverlayOpened() {
 overlayOpenedAt = Date.now();


unction compactTraceText(value, max = 180) {
 return String(value ?? '')
   .replace(/<[^>]+>/g, ' ')
   .replace(/\s+/g, ' ')
   .trim()
   .slice(0, max);


unction traceEventClass(type) {
 const normalized = String(type || 'event').trim().toLowerCase();
 if (['approval', 'remote-approval', 'approval-decision'].includes(normalized)) return 'approval';
 if (['artifact', 'receipt', 'remote-apply'].includes(normalized)) return 'receipt';
 if (['error', 'failure'].includes(normalized)) return 'error';
 if (['request', 'reply'].includes(normalized)) return 'message';
 if (['thinking', 'step', 'signal', 'session'].includes(normalized)) return 'step';
 return 'event';


unction traceEventLabel(type) {
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


unction traceEventTimeLabel(event = {}) {
 const raw = event.time || event.createdAt || event.created_at || '';
 const date = new Date(String(raw || ''));
 if (Number.isFinite(date.getTime())) {
   return date.toLocaleTimeString('en-US', {
     hour: '2-digit',
     minute: '2-digit',
   });
 }
 return currentTimestamp();


unction traceString(value, max = 80) {
 const cleaned = compactTraceText(value, max);
 return cleaned || '';


unction normalizeTraceCapability(value = {}) {
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


unction normalizeTraceReceipt(value = {}) {
 if (!value || typeof value !== 'object') return null;
 const id = traceString(value.id || value.receiptId || value.receipt_id || '', 76);
 const status = traceString(value.status || '', 36);
 const summary = traceString(value.summary || value.message || value.detail || '', 180);
 const artifact = traceString(value.artifactId || value.artifact_id || value.artifact || value.path || '', 96);
 const rollback = traceString(value.rollback || value.rollbackInstruction || value.rollback_instruction || '', 140);
 if (!id && !status && !summary && !artifact && !rollback) return null;
 return { id, status, summary, artifact, rollback };


unction normalizeTraceReplay(value = {}) {
 if (!value || typeof value !== 'object') return null;
 const runId = traceString(value.runId || value.run_id || value.id || '', 76);
 const traceId = traceString(value.traceId || value.trace_id || '', 76);
 const sessionId = traceString(value.sessionId || value.session_id || '', 76);
 const policy = traceString(value.policy || value.mode || '', 76);
 if (!runId && !traceId && !sessionId && !policy) return null;
 return { runId, traceId, sessionId, policy };


unction recordTraceEvent(event = {}) {
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
 if (traceEvents.length > TRACE_EVENT_LIMIT) traceEvents.splice(0, traceEvents.length ? TRACE_EVENT_LIMIT);
 renderTraceSheet();
 updateComposerBadges();
 updateDashboardGlass();


unction ingestRuntimeEvents(events = [], options = {}) {
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
   if (traceEvents.length > TRACE_EVENT_LIMIT) traceEvents.splice(0, traceEvents.length ? TRACE_EVENT_LIMIT);
 }
 renderTraceSheet();
 updateComposerBadges();
 updateDashboardGlass();
 return changed;


unction renderTraceChips(event = {}) {
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


unction renderTraceReceipt(event = {}) {
 const receipt = event.receipt || null;
 if (!receipt) return '';
 return `
   <div class="trace-sheet__receipt" aria-label="Safe receipt">
     <span>Receipt</span>
     ${receipt.id ? `<code>${escapeHtml(receipt.id)}</code>` : ''}
     ${receipt.status ? `<small>${escapeHtml(receipt.status)}</small>` : ''}
     ${receipt.summary ? `<p>${escapeHtml(receipt.summary)}</p>` : ''}
     ${receipt.artifact ? `<small>artifact: ${escapeHtml(receipt.artifact)}</small>` : ''}
     ${receipt.rollback ? `<small>rollback: ${escapeHtml(receipt.rollback)}</small>` : ''}
   </div>
 `;


unction renderTraceReplay(event = {}) {
 const replay = event.replay || null;
 if (!replay) return '';
 return `
   <div class="trace-sheet__replay" aria-label="Safe replay context">
     <span>Replay context</span>
     ${replay.runId ? `<code>run ${escapeHtml(replay.runId)}</code>` : ''}
     ${replay.traceId ? `<code>trace ${escapeHtml(replay.traceId)}</code>` : ''}
     ${replay.sessionId ? `<code>session ${escapeHtml(replay.sessionId)}</code>` : ''}
     <small>${escapeHtml(replay.policy || 'receipts only')}</small>
   </div>
 `;


unction capabilityFromElement(node) {
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


unction normalizeTraceSheetQuery(query = {}) {
 return {
   runId: traceString(query.runId || '', 76),
   traceId: traceString(query.traceId || '', 76),
   sessionId: traceString(query.sessionId || '', 76),
   source: traceString(query.source || '', 80),
 };


unction hasTraceSheetQuery(query = traceSheetQuery) {
 return Boolean(query?.runId || query?.traceId || query?.sessionId);


unction traceEventMatchesQuery(event = {}, query = traceSheetQuery) {
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


unction renderTraceSheet() {
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
       <strong>${focused ? 'No events for this run' : 'Waiting for activity'}</strong>
       <small>${focused ? 'The observatory returned no persistent events for this filter.' : 'Send a task to inspect the runtime from inside.'}</small>
     </div>
   `;
   return;
 }

 const latestReceipt = visibleEvents.slice().reverse().find((event) => traceEventClass(event.type) === 'receipt');
 const latestApproval = visibleEvents.slice().reverse().find((event) => traceEventClass(event.type) === 'approval');
 const latestRequest = visibleEvents.slice().reverse().find((event) => traceEventClass(event.type) === 'message' && String(event.type).toLowerCase() === 'request');
 const latestError = visibleEvents.slice().reverse().find((event) => traceEventClass(event.type) === 'error');
 const latestTool = visibleEvents.slice().reverse().find((event) => event.capability?.label || /tool|terminal|artifact|gateway/i.test(`${event.title} ${event.detail}`));
 const flowState = {
   request: Boolean(latestRequest),
   tool: Boolean(latestTool),
   approval: Boolean(latestApproval),
   receipt: Boolean(latestReceipt),
 };
 const queryLine = hasTraceSheetQuery()
   ? [
     traceSheetQuery.runId ? `run ${traceSheetQuery.runId}` : '',
     traceSheetQuery.traceId ? `trace ${traceSheetQuery.traceId}` : '',
     traceSheetQuery.sessionId ? `session ${traceSheetQuery.sessionId}` : '',
   ].filter(Boolean).join(' - ')
   : 'current session';
 const summary = `
   <div class="trace-sheet__summary">
     <strong>${latestRequest ? 'Current session history' : 'Readable run summary'}</strong>
     <span>${latestError ? `Needs attention: ${escapeHtml(latestError.title || latestError.detail)}` : 'Shows requests, tools, approvals, receipts and replay evidence. Raw model reasoning stays private.'}</span>
     <div class="trace-sheet__summary-grid">
       <small>${escapeHtml(queryLine)}</small>
       <small>${latestRequest ? `latest request: ${escapeHtml(latestRequest.detail || latestRequest.title)}` : 'no request yet'}</small>
       <small>${latestTool ? `latest tool: ${escapeHtml(latestTool.capability?.label || latestTool.title)}` : 'no tool used yet'}</small>
       <small>${latestApproval ? `latest approval: ${escapeHtml(latestApproval.status || latestApproval.title)}` : 'no active approval'}</small>
       <small>${latestReceipt ? `latest receipt: ${escapeHtml(latestReceipt.status || latestReceipt.title)}` : 'no receipt yet'}</small>
     </div>
     <div class="trace-sheet__flow" aria-label="Run lifecycle">
       ${[
         ['request', 'Request'],
         ['tool', 'Tool'],
         ['approval', 'Approval'],
         ['receipt', 'Receipt'],
       ].map(([key, label]) => `<span class="${flowState[key] ? 'is-active' : ''}">${label}</span>`).join('')}
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
         ${event.capability?.reason ? `<div class="trace-sheet__policy"><span>Reason</span>${escapeHtml(event.capability.reason)}</div>` : ''}
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


unction countTraceByClass(kind) {
 return traceEvents.filter((event) => traceEventClass(event.type) === kind).length;


unction setDashboardText(selector, value) {
 document.querySelectorAll(selector).forEach((node) => {
   node.textContent = String(value);
 });


unction setLiveStrip(runtimeState, runtimeDetail, gatewayState, gatewayDetail, syncDetail) {
 setDashboardText('[data-live-runtime-state]', runtimeState);
 setDashboardText('[data-live-runtime-detail]', runtimeDetail);
 setDashboardText('[data-live-gateway-state]', gatewayState);
 setDashboardText('[data-live-gateway-detail]', gatewayDetail);
 setDashboardText('[data-live-sync-state]', 'Last sync');
 setDashboardText('[data-live-sync-detail]', syncDetail);
 document.querySelectorAll('[data-live-runtime-state]').forEach((node) => {
   node.dataset.liveValue = String(runtimeState || '').toLowerCase();
 });
 document.querySelectorAll('[data-live-gateway-state]').forEach((node) => {
   node.dataset.liveValue = String(gatewayState || '').toLowerCase();
 });


unction latestTraceEvents(limit = 3) {
 return traceEvents.slice(Math.max(0, traceEvents.length - limit)).reverse();


unction dashboardStatusText(value, fallback = 'ready') {
 const cleaned = compactTraceText(value || '', 26);
 return cleaned || fallback;


unction getLiveRuntimeSnapshot() {
 const bridgeState = window.ZavorthRuntimeBridge?.state || {};
 const snapshot = bridgeState.zavorthControl?.snapshot || {};
 const runs = Array.isArray(snapshot.runs) ? snapshot.runs : [];
 const activeRun = snapshot.activeRun || runs[0] || null;
 const activeStatus = String(activeRun?.status || '').toLowerCase();
 const active = Boolean(activeRun && !['done', 'completed', 'complete', 'success', 'succeeded', 'failed', 'error', 'cancelled', 'canceled'].includes(activeStatus));
 const pendingApprovals = runs.reduce((count, run) => {
   const approvals = Array.isArray(run?.approvals) ? run.approvals : [];
   return count + approvals.filter((approval) => String(approval?.status || 'pending') === 'pending').length;
 }, 0);
 return {
   live: Boolean(bridgeState.zavorthControl?.live),
   authRequired: Boolean(bridgeState.zavorthControl?.authRequired),
   runs,
   activeRun,
   active,
   pendingApprovals,
   modelLabel: window.ZavorthRuntimeBridge?.getCurrentModelLabel?.() || '',
   routeLabel: window.ZavorthRuntimeBridge?.getCurrentModelRouteLabel?.() || '',
 };


unction getDashboardSnapshot() {
 const liveSnapshot = getLiveRuntimeSnapshot();
 const requestCount = traceEvents.filter((event) => String(event.type).toLowerCase() === 'request').length;
 const pendingApprovals = Math.max(document.querySelectorAll('.zavorth-approval-card').length, liveSnapshot.pendingApprovals);
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
   liveSnapshot,
 };


unction updateDashboardTimeline(events) {
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


unction updateDashboardGlass() {
 const root = document.querySelector('.dashboard-glass');
 if (!root) return;
 const snapshot = getDashboardSnapshot();
 const activeRun = snapshot.liveSnapshot.activeRun;
 const hasActiveRun = snapshot.liveSnapshot.active;
 setLiveStrip(
   snapshot.thinking ? 'Working' : hasActiveRun ? 'Task running' : snapshot.activeApprovals > 0 ? 'Decision needed' : 'Runtime ready',
   hasActiveRun ? dashboardStatusText(activeRun?.status || activeRun?.title, 'active task') : snapshot.lastEvent ? dashboardStatusText(snapshot.lastEvent.title, 'runtime updated') : 'Waiting for your request',
   snapshot.liveSnapshot.modelLabel || snapshot.modelLabel || 'Gateway',
   snapshot.liveSnapshot.routeLabel || getCurrentModelRouteLabel(),
   snapshot.lastEvent ? snapshot.lastEvent.time : 'Just now',
 );
 const runtimeTitle = snapshot.thinking ? 'Task in progress'
   : hasActiveRun
     ? compactTraceText(activeRun?.title || activeRun?.summary || activeRun?.id, 80)
     : 'No task running';
 const runtimeText = hasActiveRun
   ? compactTraceText(`${activeRun?.status || 'running'} ? ${activeRun?.summary || activeRun?.nextAction || 'Zavorth is working on the current request.'}`, 180)
   : 'Ask Zavorth in the Inbox. When a request could change files, call tools, or touch external state, Zavorth will preview the risk and ask for approval.';
 setDashboardText('[data-dashboard-runtime-title]', runtimeTitle);
 setDashboardText('[data-dashboard-runtime-text]', runtimeText);

 setDashboardText('[data-dashboard-approval-title]', snapshot.activeApprovals > 0
   ? `${snapshot.activeApprovals} pending approval${snapshot.activeApprovals === 1 ? '' : 's'}`
   : 'No pending approvals');
 setDashboardText('[data-dashboard-approval-text]', snapshot.activeApprovals > 0
   ? 'Review before allowing changes or tool access.'
   : 'When Zavorth needs a decision, it appears here with approve, deny, or adjust scope.');

 const approvalBanner = document.getElementById('approval-context-banner');
 if (approvalBanner) approvalBanner.hidden = snapshot.activeApprovals <= 0;
 setDashboardText('[data-inbox-approval-title]', snapshot.activeApprovals > 0
   ? `${snapshot.activeApprovals} pending approval${snapshot.activeApprovals === 1 ? '' : 's'}`
   : 'No pending approvals');
 setDashboardText('[data-inbox-approval-text]', snapshot.activeApprovals > 0
   ? 'Review before Zavorth changes files, tools, or external state.'
   : 'Risky actions appear here before Zavorth acts.');

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
 setDashboardText('[data-inbox-metric="approvals"]', String(snapshot.activeApprovals || 0));
 setDashboardText('[data-inbox-metric="receipts"]', String(snapshot.receiptEvents || 0));
 setDashboardText('[data-sales-os-metric="approvals"]', String(snapshot.activeApprovals || 0));
 setDashboardText('[data-sales-os-meta="approvals"]', snapshot.activeApprovals > 0 ? 'waiting for your decision' : 'no pending approval');
 setDashboardText('[data-provider-picker="active"]', getCurrentModelRouteLabel());
 setDashboardText('[data-provider-picker="fallbacks"]', snapshot.modelLabel || 'configured');
 setDashboardText('[data-provider-picker="proof"]', snapshot.errorEvents > 0 ? 'needs review' : 'redacted proof');

 updateDashboardTimeline(latestTraceEvents(4));


unction openToolSheet() {
 if (!toolSheet || !toolSheetTrigger) return;
 closeTraceSheet(false);
 closeSkillPopover();
 updateToolSheetState();
 const shade = getOverlayShade();
 if (shade) shade.classList.add('active');
 markOverlayOpened();
 toolSheet.classList.remove('hidden');
 void toolSheet.offsetWidth;
 toolSheet.classList.add('active');
 toolSheet.setAttribute('aria-hidden', 'false');
 toolSheetTrigger.classList.add('is-active');
 toolSheetTrigger.setAttribute('aria-expanded', 'true');


unction closeToolSheet(clearShade = true) {
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


unction updateToolSheetState() {
 if (!toolSheet) return;
 const activeMap = {
   attach: pendingAttachments.length > 0,
   media: pendingAttachments.some((file) => /^(image|video|audio)\//i.test(file.type || '')),
   skills: pendingSelectedSkills.length > 0,
   voice: Boolean(lastVoiceInput) || isListening,
   terminal: pendingSelectedSkills.some((skill) => /terminal|shell|command/i.test(`${skill.id} ${skill.title}`)),
   docs: pendingSelectedSkills.some((skill) => /doc|file|read/i.test(`${skill.id} ${skill.title}`)),
   mcp: pendingSelectedSkills.some((skill) => /mcp|remote/i.test(`${skill.id} ${skill.title}`)),
 };
 toolSheet.querySelectorAll('[data-tool-sheet-action]').forEach((item) => {
   const action = item.getAttribute('data-tool-sheet-action') || '';
   const active = Boolean(activeMap[action]);
   item.classList.toggle('is-active', active);
   item.setAttribute('aria-pressed', active ? 'true' : 'false');
 });
 let stateNode = toolSheet.querySelector('.tool-sheet__state');
 if (!stateNode) {
   stateNode = document.createElement('div');
   stateNode.className = 'tool-sheet__state';
   toolSheet.querySelector('.tool-sheet__header')?.after(stateNode);
 }
 const facts = [
   pendingAttachments.length ? `${pendingAttachments.length} file${pendingAttachments.length === 1 ? '' : 's'} attached` : 'No files attached',
   pendingSelectedSkills.length ? `${pendingSelectedSkills.length} tool${pendingSelectedSkills.length === 1 ? '' : 's'} selected` : 'No tool selected',
   lastVoiceInput ? 'Voice transcript ready' : isListening ? 'Voice listening' : 'Voice idle',
 ];
 stateNode.innerHTML = facts.map((fact) => `<span>${escapeHtml(fact)}</span>`).join('');


unction openTraceSheet(query = null) {
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


unction closeTraceSheet(clearShade = true) {
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


unction focusComposeWithPrompt(prompt) {
 if (!composeInput) return;
 const current = composeInput.value.trim();
 composeInput.value = current ? `${prompt}\n\n${current}` : prompt;
 composeInput.dispatchEvent(new Event('input'));
 composeInput.focus();


unction setSelectedExperienceProfile(profile) {
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


unction chooseAttachmentFiles(accept) {
 if (accept) fileInput.setAttribute('accept', accept);
 else fileInput.removeAttribute('accept');
 fileInput.click();


unction chooseWorkspaceFolder() {
 directoryInput.value = '';
 directoryInput.click();


unction closeComposerSettings() {
 if (!composerSettingsPanel) return;
 composerSettingsPanel.classList.add('hidden');
 composerSettingsTrigger?.classList.remove('is-active');
 composerSettingsTrigger?.setAttribute('aria-expanded', 'false');


unction toggleComposerSettings() {
 if (!composerSettingsPanel) return;
 const willOpen = composerSettingsPanel.classList.contains('hidden');
 if (willOpen) ensureComposerPresets();
 composerSettingsPanel.classList.toggle('hidden', !willOpen);
 composerSettingsTrigger?.classList.toggle('is-active', willOpen);
 composerSettingsTrigger?.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
 if (willOpen) closeSkillPopover();


unction ensureComposerPresets() {
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
   const next = preset === 'safe-review'
     ? { model: 'safe', sensitivity: 'high', tools: true, thinking: true, focus: false }
     : preset === 'fast-local'
       ? { model: 'local', sensitivity: 'low', tools: false, thinking: false, focus: true }
       : { model: 'auto', sensitivity: 'default', tools: true, thinking: false, focus: false };
   writeComposerSettings({ ...composerSettingsState, ...next });
   emitLocalNotice(`Composer preset applied: ${button.textContent.trim()}.`);
 });


unction collectTranscriptMarkdown() {
 const groups = Array.from(document.querySelectorAll('#neural-feed .echo-group'));
 if (groups.length === 0) {
   return [
     '# Zavorth conversation',
     '',
     '_No messages in this session._',
   ].join('\n');
 }
 const lines = ['# Zavorth conversation', '', `Exported at ${new Date().toLocaleString()}`, ''];
 groups.forEach((group) => {
   const sender = group.querySelector('.echo-sender')?.textContent?.trim() || 'Message';
   const bubble = group.querySelector('.echo-bubble')?.innerText?.trim() || '';
   if (!bubble) return;
   lines.push(`## ${sender}`, '', bubble, '');
 });
 return lines.join('\n').replace(/\n{3,}/g, '\n\n');


unction collectTranscriptRecords() {
 return Array.from(document.querySelectorAll('#neural-feed .echo-group')).map((group) => ({
   sender: group.querySelector('.echo-sender')?.textContent?.trim() || 'Message',
   time: group.querySelector('.echo-timestamp')?.textContent?.trim() || '',
   model: group.querySelector('.echo-meta__model')?.textContent?.trim() || '',
   route: group.querySelector('.echo-meta__cost')?.textContent?.trim() || '',
   text: group.querySelector('.echo-bubble')?.innerText?.trim() || '',
 })).filter((record) => record.text);


unction collectTranscriptText() {
 const records = collectTranscriptRecords();
 if (records.length === 0) return 'No messages in this session.';
 return records.map((record) => `[${record.time || 'now'}] ${record.sender}: ${record.text}`).join('\n\n');


unction collectTranscriptJson() {
 return JSON.stringify({
   exportedAt: new Date().toISOString(),
   sessionId: sessionStorage.getItem('zavorth.zavorthControl.sessionId') || '',
   messages: collectTranscriptRecords(),
   trace: traceEvents.slice(-90),
   composer: {
     settings: composerSettingsState,
     selectedTools: pendingSelectedSkills,
     attachments: pendingAttachments.map((file) => ({
       name: file.name,
       type: file.type,
       size: file.size,
       truncated: Boolean(file.truncated),
     })),
   },
 }, null, 2);


unction downloadTextFile(filename, text, type = 'text/plain;charset=utf-8') {
 const blob = new Blob([text], { type });
 const url = URL.createObjectURL(blob);
 const anchor = document.createElement('a');
 anchor.href = url;
 anchor.download = filename;
 document.body.appendChild(anchor);
 anchor.click();
 anchor.remove();
 window.setTimeout(() => URL.revokeObjectURL(url), 800);


unction exportCurrentConversation(format = 'md') {
 const date = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
 if (format === 'json') {
   downloadTextFile(`zavorth-conversation-${date}.json`, collectTranscriptJson(), 'application/json;charset=utf-8');
   emitLocalNotice('Conversation exported as JSON.');
   return;
 }
 if (format === 'txt') {
   downloadTextFile(`zavorth-conversation-${date}.txt`, collectTranscriptText(), 'text/plain;charset=utf-8');
   emitLocalNotice('Conversation exported as text.');
   return;
 }
 downloadTextFile(`zavorth-conversation-${date}.md`, collectTranscriptMarkdown(), 'text/markdown;charset=utf-8');
 emitLocalNotice('Conversation exported as Markdown.');


unction openExportMenu() {
 if (typeof window.openCoreModal !== 'function') {
   exportCurrentConversation('md');
   return;
 }
 window.openCoreModal('Export conversation', `
   <div class="zavorth-export-menu" role="group" aria-label="Export formats">
     <button type="button" data-export-format="md"><strong>Markdown</strong><span>Readable transcript with headings.</span></button>
     <button type="button" data-export-format="json"><strong>JSON</strong><span>Messages, trace, composer context and receipts.</span></button>
     <button type="button" data-export-format="txt"><strong>Text</strong><span>Plain log for quick sharing.</span></button>
   </div>
 `);
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


unction startNewLocalSession() {
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


unction summarizeWorkspaceSelection(fileList) {
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
   .sort((a, b) => b[1] ? a[1])
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


f (attachBtn) {
 attachBtn.addEventListener('click', openToolSheet);

f (attachFileTrigger) {
 attachFileTrigger.addEventListener('click', () => chooseAttachmentFiles(''));

f (composerSettingsTrigger) {
 composerSettingsTrigger.addEventListener('click', (event) => {
   event.preventDefault();
   event.stopPropagation();
   toggleComposerSettings();
 });

f (exportChatTrigger) {
 exportChatTrigger.addEventListener('click', openExportMenu);

f (newSessionTrigger) {
 newSessionTrigger.addEventListener('click', startNewLocalSession);

ocument.querySelectorAll('[data-composer-setting]').forEach((field) => {
 field.addEventListener('change', () => {
   const key = field.getAttribute('data-composer-setting');
   if (!key) return;
   writeComposerSettings({ ...composerSettingsState, [key]: field.value });
 });
);
ocument.querySelectorAll('[data-composer-toggle]').forEach((toggle) => {
 toggle.addEventListener('click', (event) => {
   event.preventDefault();
   event.stopPropagation();
   const key = toggle.getAttribute('data-composer-toggle');
   if (!key) return;
   writeComposerSettings({ ...composerSettingsState, [key]: !composerSettingsState[key] });
   if (key === 'tools' && composerSettingsState.tools) openSkillPopover();
   if (key === 'focus') emitLocalNotice(composerSettingsState.focus ? 'Focus mode on.' : 'Focus mode off.');
 });
);
ocument.addEventListener('click', (event) => {
 if (!composerSettingsPanel || composerSettingsPanel.classList.contains('hidden')) return;
 if (composerSettingsPanel.contains(event.target) || composerSettingsTrigger?.contains(event.target)) return;
 closeComposerSettings();
);
pplyComposerSettingsToUi();

f (toolSheetClose) toolSheetClose.addEventListener('click', () => closeToolSheet());
f (traceSheetTrigger) traceSheetTrigger.addEventListener('click', openTraceSheet);
f (traceSheetClose) traceSheetClose.addEventListener('click', () => closeTraceSheet());

oolSheetActions.forEach((actionButton) => {
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
     focusComposeWithPrompt('Use the docs and Zavorth project context to answer this request:');
     return;
   }
   if (action === 'terminal') {
     closeToolSheet();
     focusComposeWithPrompt('Prepare a governed terminal execution. First show preview, impact, risk, rollback and whether approval is required:');
   }
 });
);

f (attachmentTray) {
 attachmentTray.addEventListener('click', (event) => {
   const remove = event.target.closest('[data-attachment-index]');
   if (!remove) return;
   const index = Number(remove.getAttribute('data-attachment-index'));
   if (!Number.isFinite(index)) return;
   pendingAttachments.splice(index, 1);
   refreshAttachmentHint();
 });


f (composerContextBar) {
 composerContextBar.addEventListener('click', (event) => {
   const remove = event.target.closest('[data-compose-remove-skill]');
   if (!remove) return;
   const skillId = remove.getAttribute('data-compose-remove-skill') || '';
   pendingSelectedSkills = pendingSelectedSkills.filter((skill) => skill.id !== skillId);
   updateComposerBadges();
   updateSendAffordance();
 });


ileInput.addEventListener('change', async () => {
 await addAttachmentFiles(fileInput.files || []);
 fileInput.value = '';
 fileInput.removeAttribute('accept');
);

irectoryInput.addEventListener('change', () => {
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
);

f (composeFrame) {
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


f (composeInput) {
 composeInput.addEventListener('paste', async (event) => {
   const files = Array.from(event.clipboardData?.files || []);
   if (files.length === 0) return;
   event.preventDefault();
   await addAttachmentFiles(files);
 });


unction buildSkillOptions() {
 const bridge = window.ZavorthRuntimeBridge;
 const runtimeSkills = bridge && typeof bridge.getAvailableSkills === 'function'
   ? bridge.getAvailableSkills()
   : [];
 const defaults = [
   { id: 'read_file', title: 'Review files', prompt: 'Review the files or folder I provide and give me a clear summary.', status: 'local' },
   { id: 'network_fetch', title: 'Search the web', prompt: 'Search recent sources about this topic and bring me a summary with links.', status: 'web' },
   { id: 'pdf.generate', title: 'Generate report', prompt: 'Generate an organized report with the main points.', status: 'report' },
 ];
 const byId = new Map();
 [...runtimeSkills, ...defaults].forEach((skill) => {
   const id = String(skill?.id || skill?.title || '').trim();
   if (!id || byId.has(id)) return;
   byId.set(id, {
     id,
     title: String(skill.title || skill.name || id).trim(),
     prompt: String(skill.prompt || skill.summary || skill.description || `Use ${id} for this request.`).trim(),
     status: String(skill.status || 'available').trim(),
   });
 });
 return Array.from(byId.values()).slice(0, 8);


unction closeSkillPopover() {
 if (!skillPopover) return;
 skillPopover.classList.add('hidden');
 if (skillsBtn) skillsBtn.classList.remove('is-active');
 updateComposerBadges();


unction openSkillPopover() {
 if (!skillPopover) return;
 const options = buildSkillOptions();
 skillPopover.innerHTML = `
   <div class="compose-skill-popover__header">
     <span>Tools</span>
     <button type="button" class="compose-skill-popover__close" aria-label="Close tools">&times;</button>
   </div>
   <div class="compose-skill-popover__list">
     ${options.map((skill) => `
       <button type="button" class="compose-skill-option${pendingSelectedSkills.some((selected) => selected.id === skill.id) ? ' is-selected' : ''}" data-skill-id="${escapeHtml(skill.id)}" data-skill-title="${escapeHtml(skill.title)}" data-skill-status="${escapeHtml(skill.status)}" data-skill-prompt="${escapeHtml(skill.prompt)}">
         <span class="compose-skill-option__title">${escapeHtml(skill.title)}</span>
         <span class="compose-skill-option__meta">${escapeHtml(skill.status)}</span>
       </button>
     `).join('')}
   </div>
   <div class="compose-skill-popover__footer">Choose a skill to prepare the request. Nothing runs by itself.</div>
 `;
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


unction applySelectedSkill(option) {
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
 const skillPrompt = prompt ? `Use ${skillTitle}: ${prompt}`
   : `Use ${skillTitle} for this request.`;
 const current = composeInput.value.trim();
 composeInput.value = current ? `${skillPrompt}

urrent}` : skillPrompt;
 composeInput.dispatchEvent(new Event('input'));
 composeInput.focus();
 closeSkillPopover();
 updateComposerBadges();


f (skillsBtn) {
 skillsBtn.addEventListener('click', () => {
   if (!skillPopover) return;
   if (skillPopover.classList.contains('hidden')) openSkillPopover();
   else closeSkillPopover();
 });


f (skillPopover) {
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


ocument.addEventListener('click', (event) => {
 if (!skillPopover || skillPopover.classList.contains('hidden')) return;
 if (skillPopover.contains(event.target) || skillsBtn?.contains(event.target)) return;
 closeSkillPopover();
);

unction setVoiceState(nextState) {
 isListening = nextState === 'listening';
 if (!voiceBtn) return;
 voiceBtn.classList.toggle('is-listening', isListening);
 voiceBtn.setAttribute('aria-label', isListening ? 'Stop dictation' : 'Voice dictation');
 voiceBtn.setAttribute('title', isListening ? 'Stop voice' : 'Voice');
 updateComposerBadges();


f (voiceBtn) {
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
       <div class="voice-overlay__text">Listening... Speak now.</div>
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
   recognition.lang = composerSettingsState.voice && composerSettingsState.voice !== 'default'
     ? composerSettingsState.voice
     : 'en-US';
   recognition.interimResults = true;
   recognition.maxAlternatives = 1;
   let finalTranscript = '';
   recognition.onstart = () => {
     setVoiceState('listening');
     voiceOverlay.classList.remove('hidden');
     voiceOverlay.querySelector('.voice-overlay__text').textContent = 'Listening... Speak now.';
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


unction transmitSignal() {
 const text = composeInput.value.trim();
 if (!text && pendingAttachments.length === 0) return;
 const outboundAttachments = pendingAttachments.map((file, index) => ({
   id: file.id || `attachment:${index + 1}:${file.name}`,
   name: file.name,
   type: file.type,
   size: file.size,
   text: file.text || null,
   truncated: Boolean(file.truncated),
   source: 'zavorth-control-browser',
 }));
 const outboundText = text || 'Review the attached files.';
 const outboundSkills = pendingSelectedSkills.slice(0, 8);
 const outboundVoice = lastVoiceInput ? { ...lastVoiceInput } : null;
 const outboundComposerSettings = { ...composerSettingsState };

 // Transition out of empty state on first message
 const terminalView = document.getElementById('terminal-view');
 if (terminalView && terminalView.classList.contains('is-empty')) {
   terminalView.classList.remove('is-empty');
 }

 recordTraceEvent({
   type: 'request',
   title: 'Request received',
   detail: outboundText,
   meta: [
     outboundAttachments.length ? `${outboundAttachments.length} file(s)` : '',
     outboundSkills.length ? `${outboundSkills.length} tool(s)` : '',
     outboundVoice ? 'voice' : '',
     outboundComposerSettings.model && outboundComposerSettings.model !== 'auto' ? `model:${outboundComposerSettings.model}` : '',
     outboundComposerSettings.sensitivity && outboundComposerSettings.sensitivity !== 'default' ? `sens:${outboundComposerSettings.sensitivity}` : '',
   ].filter(Boolean).join(' - ') || 'chat',
   status: 'queued',
 });
 if (outboundAttachments.length > 0) {
   recordTraceEvent({
     type: 'artifact',
     title: 'Attached context',
     detail: outboundAttachments.map((file) => file.name).join(', '),
     meta: 'compose attachment',
   });
 }
 if (outboundSkills.length > 0) {
   recordTraceEvent({
     type: 'step',
     title: 'Selected tools',
     detail: outboundSkills.map((skill) => skill.title || skill.id).join(', '),
     meta: 'tool exposure',
   });
 }

 appendEcho('operator', text || 'Review attached files', buildSentAttachmentCards(outboundAttachments));
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
     detail: pendingWorkspaceSelection ? `Read-only repository review for ${pendingWorkspaceSelection.root}.`
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
     title: 'Live gateway',
     detail: 'Request sent to the live Zavorth runtime.',
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
       composerSettings: outboundComposerSettings,
     },
   ).catch((error) => {
     removeThinkingState();
     const detail = messageFromCaughtError(error);
     recordTraceEvent({
       type: 'error',
       title: 'Runtime failed',
       detail,
       status: 'failed',
     });
     if (!error?.uiHandled) {
       appendEcho('core', `I could not send this to the live runtime.\n\n${detail}`);
     }
   });
   return;
 }

 recordTraceEvent({
   type: 'step',
   title: 'local preview runtime',
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


/ --------- Suggestion Chips Logic ---------
onst suggestionChips = document.querySelectorAll('.suggestion-chip');
uggestionChips.forEach(chip => {
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
);

/ --------- Neural Echo Rendering ---------
onst neuralFeed = document.getElementById('neural-feed');
onst neuralStream = document.getElementById('neural-stream');

unction scrollFeedToEnd() {
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


unction currentTimestamp() {
 return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });


unction getCurrentModelLabel() {
 const runtimeBridge = window.ZavorthRuntimeBridge;
 if (runtimeBridge && typeof runtimeBridge.getCurrentModelLabel === 'function') {
   return runtimeBridge.getCurrentModelLabel();
 }
 return 'Zavorth Runtime';


unction getCurrentModelRouteLabel() {
 const runtimeBridge = window.ZavorthRuntimeBridge;
 if (runtimeBridge && typeof runtimeBridge.getCurrentModelRouteLabel === 'function') {
   return runtimeBridge.getCurrentModelRouteLabel();
 }
 return 'runtime';


unction buildEchoQuickActions(role) {
 if (role !== 'core') return '';
 return `
   <div class="echo-action-row" aria-label="Response actions">
     <button type="button" data-prompt="Show the trace for the latest response in simple language.">Trace</button>
     <button type="button" data-prompt="Show pending approvals with approve and reject actions.">Approvals</button>
     <button type="button" data-prompt="Show the latest receipt or explain why none exists yet.">Receipt</button>
   </div>
 `;


unction buildConversationStateCard(kind, title, summary, items = [], options = {}) {
 const normalizedKind = String(kind || 'info').replace(/[^\w-]/g, '') || 'info';
 const safeTitle = escapeHtml(title || 'Zavorth update');
 const safeSummary = escapeHtml(summary || '');
 const safeBadge = escapeHtml(options.badge || normalizedKind);
 const safeMeta = escapeHtml(options.meta || '');
 const safeItems = Array.isArray(items) ? items.filter(Boolean).slice(0, 5) : [];
 return `
   <article class="conversation-state-card conversation-state-card--${normalizedKind}" aria-label="${safeTitle}">
     <div class="conversation-state-card__rail">
       <span class="conversation-state-card__pulse"></span>
     </div>
     <div class="conversation-state-card__body">
       <div class="conversation-state-card__topline">
         <span>${safeBadge}</span>
         ${safeMeta ? `<small>${safeMeta}</small>` : ''}
       </div>
       <strong>${safeTitle}</strong>
       ${safeSummary ? `<p>${safeSummary}</p>` : ''}
       ${safeItems.length ? `
         <ol class="conversation-state-card__steps">
           ${safeItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
         </ol>
       ` : ''}
     </div>
   </article>
 `;


unction appendEcho(role, text, logicCells) {
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


unction appendEchoDivider(label) {
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


unction renderTranscript(messages, options = {}) {
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


onst ALLOWED_MARKDOWN_TAGS = new Set([
 'a', 'b', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'hr', 'i', 'iframe',
 'img', 'li', 'ol', 'p', 'pre', 's', 'span', 'strong', 'table', 'tbody', 'td',
 'th', 'thead', 'tr', 'u', 'ul',
);
onst DROP_MARKDOWN_TAGS = new Set([
 'base', 'embed', 'form', 'input', 'link', 'meta', 'object', 'script', 'style', 'template',
);
onst SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
onst SAFE_EMBED_PROTOCOLS = new Set(['blob:']);
onst TRUSTED_UI_TAGS = new Set(['button', 'form', 'input', 'label', 'option', 'select', 'textarea']);

unction isSafeUrl(value, allowedProtocols) {
 try {
   const parsed = new URL(String(value || ''), window.location.origin);
   return allowedProtocols.has(parsed.protocol);
 } catch {
   return false;
 }


unction sanitizeClassName(value) {
 return String(value || '')
   .split(/\s+/)
   .map((entry) => entry.replace(/[^\w:-]/g, ''))
   .filter(Boolean)
   .join(' ');


unction sanitizeRenderedHtml(html, options = {}) {
 const template = document.createElement('template');
 template.innerHTML = String(html || '');
 const nodes = Array.from(template.content.querySelectorAll('*'));
 const allowedTags = options.allowTrustedUi
   ? new Set([...ALLOWED_MARKDOWN_TAGS, ...TRUSTED_UI_TAGS])
   : ALLOWED_MARKDOWN_TAGS;
 for (const node of nodes) {
   const tag = node.tagName.toLowerCase();
   if (DROP_MARKDOWN_TAGS.has(tag) && !(options.allowTrustedUi && TRUSTED_UI_TAGS.has(tag))) {
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
       || name === 'aria-pressed'
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
     if (options.allowTrustedUi && name === 'id') continue;
     if (options.allowTrustedUi && ['form', 'input', 'label', 'textarea', 'button', 'select', 'option'].includes(tag)) {
       if (['id', 'name', 'type', 'placeholder', 'autocomplete', 'for', 'value', 'disabled', 'selected'].includes(name)) continue;
     }
     if (keepGlobal) continue;

     node.removeAttribute(attr.name);
   }
 }
 return template.innerHTML;


unction renderMarkdown(text) {
 if (window.marked) return sanitizeRenderedHtml(marked.parse(String(text ?? '')));
 return sanitizeRenderedHtml(String(text ?? '')
   .replace(/</g, '&lt;')
   .replace(/>/g, '&gt;')
   .replace(/`([^`]+)`/g, '<code>$1</code>')
   .replace(/\n/g, '<br>'));


unction escapeHtml(value) {
 return String(value ?? '')
   .replace(/&/g, '&amp;')
   .replace(/</g, '&lt;')
   .replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;')
   .replace(/'/g, '&#39;');


unction appendThinkingState() {
 recordTraceEvent({
   type: 'thinking',
   title: 'Thinking started',
   detail: 'Zavorth is planning the next response.',
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
     ${buildConversationStateCard('thinking', 'Working on your request', 'Zavorth is using the natural route first, then escalating only if tools or approvals are needed.', [
       'Understand the request in plain language',
       'Choose the lightest safe route',
       'Keep approvals and receipts inside this conversation',
     ], { badge: 'live', meta: 'safe route' })}
   </div>
 `;
 neuralFeed.appendChild(indicator);
 scrollFeedToEnd();
 updateDashboardGlass();


unction removeThinkingState() {
 const el = document.getElementById('thinking-state');
 if (el) el.remove();
 recordTraceEvent({
   type: 'thinking',
   title: 'Thinking finished',
   detail: 'The processing indicator was closed.',
   status: 'done',
 });


/ Global counter for unique IDs
et cellIdCounter = 0;

unction buildLogicCell(name, icon, detail, content) {
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


unction buildInteractiveButtons() {
 return `
   <div class="interactive-actions b-fade-in" style="animation-delay: 300ms">
     <button class="interactive-btn interactive-btn--primary"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Authorize Action</button>
     <button class="interactive-btn interactive-btn--danger"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Deny</button>
   </div>
 `;


unction buildSystemTrace(message) {
 const safeMessage = escapeHtml(message);
 recordTraceEvent({
   type: 'step',
   title: 'System trace',
   detail: message,
   status: 'observed',
 });
 return `<div class="system-trace b-fade-in">${safeMessage}</div>`;


unction deriveApprovalCapability(approval = {}) {
 const capability = approval.capability || approval.tool || approval.permission || {};
 const rawTitle = String(approval.title || '');
 const rawReason = String(approval.summary || approval.reason || '');
 const inferredLabel = /shell\.exec|terminal|npm|powershell/i.test(`${rawTitle} ${rawReason}`) ? 'shell.exec'
   : /apply_patch|patch|editar|write/i.test(`${rawTitle} ${rawReason}`) ? 'apply_patch'
     : capability.label || capability.id || approval.toolName || approval.kind || 'capability';
 const kind = /shell|terminal|npm|powershell/i.test(inferredLabel) ? 'shell'
   : /apply_patch|write|edit/i.test(inferredLabel) ? 'workspace'
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


unction approvalRiskCopy(risk, sideEffect) {
 const normalized = String(risk || '').toLowerCase();
 if (/high|critical|danger/.test(normalized)) return 'High impact. Review target, scope and rollback before allowing it.';
 if (/medium|write|process|external/.test(`${normalized} ${sideEffect}`)) return 'May change files, run tools, or touch external state. Keep the scope tight.';
 if (/low|read/.test(`${normalized} ${sideEffect}`)) return 'Read-first action. It should not mutate anything unless a later approval says so.';
 return 'Review what Zavorth will do, then allow once or narrow the scope.';


unction approvalTtlLabel(approval = {}) {
 const expiresAt = approval.expiresAt || approval.expires_at || approval.ttlExpiresAt || approval.ttl_expires_at;
 const ttlMs = Number(approval.ttlMs || approval.ttl_ms || approval.ttl);
 if (expiresAt) {
   const date = new Date(String(expiresAt));
   if (Number.isFinite(date.getTime())) return `until ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
 }
 if (Number.isFinite(ttlMs) && ttlMs > 0) {
   const minutes = Math.max(1, Math.round(ttlMs / 60000));
   return `${minutes} min`;
 }
 return 'one decision';


unction approvalRollbackLabel(approval = {}) {
 return compactTraceText(
   approval.rollback
   || approval.rollbackInstruction
   || approval.rollback_instruction
   || approval.receipt?.rollback
   || 'receipt required after decision',
   80,
 );


unction buildApprovalCard(approval) {
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
 const ttl = escapeHtml(approvalTtlLabel(approval));
 const rollback = escapeHtml(approvalRollbackLabel(approval));
 const allowLabel = 'Allow once';
 const capabilityAttrs = [
   `data-capability-label="${capabilityLabel}"`,
   `data-capability-kind="${capabilityKind}"`,
   `data-capability-side-effect="${sideEffect}"`,
   `data-capability-scope="${scope}"`,
   `data-capability-risk="${risk}"`,
   `data-capability-preview="${escapeHtml(previewLabel)}"`,
   `data-capability-reason="${escapeHtml(approval.reason || approval.summary || '')}"`,
 ].join(' ');
 const traceButton = runId || traceId ? `<button class="zavorth-permission-card__btn zavorth-permission-card__btn--trace" type="button" data-zavorth-trace-action="open" data-run-id="${runId}" data-trace-id="${traceId}" data-session-id="${sessionId}">View trace</button>`
   : '';
 return `
   <div class="zavorth-permission-card b-fade-in zavorth-approval-card" data-zavorth-approval-id="${approvalId}" data-zavorth-approval-kind="${approvalKind}" data-status="pending" data-approval-scope="once" data-run-id="${runId}" data-trace-id="${traceId}" data-session-id="${sessionId}" ${capabilityAttrs}>
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
       <div class="zavorth-approval-explain" aria-label="Approval explanation">
         <div><span>Will do</span><strong>${previewLabel}</strong><small>${approvalRiskCopy(risk, sideEffect)}</small></div>
         <div><span>Will not do</span><strong>Anything outside scope</strong><small>Changing the scope here updates the approval payload before Zavorth continues.</small></div>
       </div>
       <div class="zavorth-approval-scope-grid" aria-label="Approval scope">
         <span><strong>Current scope</strong><small>${scope}</small></span>
         <span><strong>Expires</strong><small>${ttl}</small></span>
         <span><strong>After decision</strong><small>${rollback}</small></span>
       </div>
       <div class="zavorth-permission-card__meta">${capabilityKind} ? ${sideEffect} - ${previewLabel} - target: ${scope}</div>
       <div class="zavorth-permission-card__meta" data-zavorth-approval-scope-label>Decision scope: allow once</div>
     </div>
     <div class="zavorth-permission-card__actions b-fade-in" style="animation-delay: 120ms">
       <button class="zavorth-permission-card__btn" data-zavorth-approval-decision="reject" data-zavorth-approval-id="${approvalId}" data-zavorth-approval-kind="${approvalKind}">
         Deny
       </button>
       <button class="zavorth-permission-card__btn zavorth-permission-card__btn--primary" data-zavorth-approval-decision="approve" data-zavorth-approval-id="${approvalId}" data-zavorth-approval-kind="${approvalKind}">
         ${allowLabel}
       </button>
       <button class="zavorth-permission-card__btn" type="button" data-zavorth-approval-edit-scope data-zavorth-approval-id="${approvalId}">
         Edit scope
       </button>
       ${traceButton}
     </div>
   </div>
 `;


unction normalizeApprovalScopeLabel(scope, customScope = '') {
 const normalized = String(scope || 'once').trim().toLowerCase();
 const custom = String(customScope || '').trim();
 if (custom) return custom;
 if (normalized === 'session') return 'this session only';
 if (normalized === 'read-only') return 'read-only only';
 if (normalized === 'target') return 'selected target only';
 return 'allow once';


unction applyApprovalScope(card, scope, customScope = '') {
 if (!card) return;
 const label = normalizeApprovalScopeLabel(scope, customScope);
 card.dataset.approvalScope = String(scope || 'once').trim() || 'once';
 card.dataset.approvalScopeNote = String(customScope || '').trim();
 const labelNode = card.querySelector('[data-zavorth-approval-scope-label]');
 if (labelNode) labelNode.textContent = `Decision scope: ${label}`;
 const approve = card.querySelector('[data-zavorth-approval-decision="approve"]');
 if (approve) approve.textContent = label === 'allow once' ? 'Allow once' : 'Allow scoped';


unction openApprovalScopeEditor(trigger) {
 const card = trigger?.closest?.('.zavorth-approval-card');
 if (!card || typeof window.openCoreModal !== 'function') return;
 const currentScope = card.dataset.approvalScope || 'once';
 const currentNote = card.dataset.approvalScopeNote || '';
 window.openCoreModal('Edit approval scope', `
   <form id="zavorth-approval-scope-form" class="config-form" autocomplete="off">
     <div class="config-form-section">
       <span class="config-form-section__title">Decision scope</span>
       <label class="zavorth-secret-field">
         <span>Scope</span>
         <div class="zavorth-secret-field__row">
           <select id="zavorth-approval-scope" class="zavorth-scope-select">
             <option value="once"${currentScope === 'once' ? ' selected' : ''}>Allow once</option>
             <option value="session"${currentScope === 'session' ? ' selected' : ''}>This session only</option>
             <option value="target"${currentScope === 'target' ? ' selected' : ''}>Selected target only</option>
             <option value="read-only"${currentScope === 'read-only' ? ' selected' : ''}>Read-only only</option>
           </select>
         </div>
       </label>
       <label class="zavorth-secret-field">
         <span>Limit</span>
         <div class="zavorth-secret-field__row">
           <input id="zavorth-approval-scope-note" type="text" value="${escapeHtml(currentNote)}" placeholder="Example: only this folder, only this command, or read-only." />
         </div>
       </label>
       <p style="margin:0;color:var(--b-signal-muted);line-height:1.6">
         Editing the scope changes what Zavorth sends with this approval. It does not run anything until you confirm.
       </p>
     </div>
   </form>
 `);
 const cancel = document.getElementById('core-modal-cancel');
 const confirm = document.getElementById('core-modal-confirm');
 if (cancel) {
   cancel.textContent = 'Cancel';
   cancel.onclick = dismissOverlays;
 }
 if (confirm) {
   confirm.textContent = 'Save scope';
   confirm.disabled = false;
   confirm.onclick = () => {
     const scope = document.getElementById('zavorth-approval-scope')?.value || 'once';
     const note = document.getElementById('zavorth-approval-scope-note')?.value || '';
     applyApprovalScope(card, scope, note);
     recordTraceEvent({
       type: 'approval',
       title: 'Approval scope edited',
       detail: normalizeApprovalScopeLabel(scope, note),
       meta: card.dataset.zavorthApprovalId || 'approval',
       status: 'scoped',
     });
     dismissOverlays();
   };
 }
 const form = document.getElementById('zavorth-approval-scope-form');
 form?.addEventListener('submit', (event) => {
   event.preventDefault();
   confirm?.click();
 });


unction renderApprovals(approvals) {
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
     ${buildConversationStateCard('approval', 'Decision needed', pending.length === 1
       ? 'One action is ready, but Zavorth needs your approval before it can continue.'
       : `${pending.length} actions are ready, but Zavorth needs your approval before it can continue.`, [
       'Review what will happen',
       'Approve only this scoped action or deny it',
       'A receipt will be recorded after the decision',
     ], { badge: 'approval', meta: `${pending.length} pending` })}
     <div class="artifacts-grid" style="display: grid; gap: 0.75rem; margin-top: 0.75rem;">
       ${cards}
     </div>
   </div>
 `;
 neuralFeed.appendChild(group);
 scrollFeedToEnd();
 updateDashboardGlass();
 return true;


unction buildRemoteMeshApprovalCard(card) {
 const approvalId = escapeHtml(card.id);
 const runId = escapeHtml(card.runId || card.agentRunId || card.correlation?.runId || '');
 const traceId = escapeHtml(card.traceId || card.correlation?.traceId || '');
 const sessionId = escapeHtml(card.sessionId || card.correlation?.sessionId || '');
 const title = escapeHtml(card.title || 'Remote Mesh approval');
 const summary = escapeHtml(card.summary || 'Review the remote action before applying it through the notebook MCP.');
 const risk = escapeHtml(card.risk || 'medium');
 const targetKind = escapeHtml(card.targetKind || 'notebook');
 const targetLabel = escapeHtml(card.targetLabel || 'Notebook MCP');
 const scope = escapeHtml(card.scope || card.targetLabel || 'Notebook MCP');
 const sideEffect = escapeHtml(card.sideEffect || (card.targetKind === 'project-file' ? 'read' : 'remote'));
 const ttl = escapeHtml(approvalTtlLabel(card));
 const rollback = escapeHtml(approvalRollbackLabel(card));
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
 const traceButton = runId || traceId ? `<button class="zavorth-permission-card__btn zavorth-permission-card__btn--trace" type="button" data-zavorth-trace-action="open" data-run-id="${runId}" data-trace-id="${traceId}" data-session-id="${sessionId}">View trace</button>`
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
       <div class="zavorth-approval-explain" aria-label="Approval explanation">
         <div><span>Will do</span><strong>Use remote proxy</strong><small>${approvalRiskCopy(risk, sideEffect)}</small></div>
         <div><span>Will not do</span><strong>Bypass dashboard approval</strong><small>Token-protected actions stay behind this decision card.</small></div>
       </div>
       <div class="zavorth-approval-scope-grid" aria-label="Approval scope">
         <span><strong>Current scope</strong><small>${scope}</small></span>
         <span><strong>Expires</strong><small>${ttl}</small></span>
         <span><strong>After decision</strong><small>${rollback}</small></span>
       </div>
       <div class="zavorth-permission-card__meta">${targetKind} ? ${sideEffect} - server-side proxy - token protected</div>
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


onst REMOTE_MESH_DISMISSED_APPROVALS_KEY = 'zavorth.remoteMesh.dismissedApprovals.v1';

unction readDismissedRemoteMeshApprovals() {
 try {
   const raw = window.localStorage?.getItem(REMOTE_MESH_DISMISSED_APPROVALS_KEY);
   const parsed = raw ? JSON.parse(raw) : [];
   return new Set(Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : []);
 } catch {
   return new Set();
 }


unction rememberDismissedRemoteMeshApproval(id) {
 if (!id) return;
 try {
   const dismissed = readDismissedRemoteMeshApprovals();
   dismissed.add(String(id));
   window.localStorage?.setItem(REMOTE_MESH_DISMISSED_APPROVALS_KEY, JSON.stringify(Array.from(dismissed).slice(-100)));
 } catch {
   // Ignore storage failures; the current UI state is still updated.
 }


unction removeRemoteMeshApprovalCard(card) {
 if (!card) return;
 const group = card.closest('#zavorth-remote-mesh-approvals-group');
 card.remove();
 if (group && !group.querySelector('.zavorth-remote-mesh-card')) {
   group.remove();
 }
 updateDashboardGlass();


unction renderRemoteMeshApprovals(cards) {
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
     ${buildConversationStateCard('approval', 'Remote action ready', pending.length === 1
       ? 'One remote action is prepared and waiting for your explicit approval.'
       : `${pending.length} remote actions are prepared and waiting for your explicit approval.`, [
       'Zavorth keeps the remote target scoped',
       'Secrets stay protected by the gateway',
       'Execution only happens after your decision',
     ], { badge: 'remote approval', meta: `${pending.length} pending` })}
     <div class="artifacts-grid" style="display: grid; gap: 0.75rem; margin-top: 0.75rem;">
       ${cardsHtml}
     </div>
   </div>
 `;
 neuralFeed.appendChild(group);
 scrollFeedToEnd();
 updateDashboardGlass();
 return true;


unction buildArtifactCard(artifact) {
 const artifactId = escapeHtml(artifact.id);
 const runId = escapeHtml(artifact.runId || artifact.toolRunId || artifact.agentRunId || '');
 const traceId = escapeHtml(artifact.traceId || '');
 const sessionId = escapeHtml(artifact.sessionId || '');
 const title = escapeHtml(artifact.title || artifact.name || artifact.path || 'Artifact');
 const kind = escapeHtml(artifact.kind || 'file');
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
         Open artifact
       </button>
       ${(runId || traceId) ? `<button class="interactive-btn interactive-btn--trace" type="button" data-zavorth-trace-action="open" data-run-id="${runId}" data-trace-id="${traceId}" data-session-id="${sessionId}">View trace</button>` : ''}
     </div>
   </div>
 `;


unction isRelevantChatArtifact(artifact) {
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


unction renderArtifacts(artifacts, context = {}) {
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
     meta: `${visibleArtifacts.length} item(s)`,
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
   <div class="echo-avatar core">Z</div>
   <div class="echo-group__messages">
     <div class="echo-group__header">
       <span class="echo-sender">Zavorth</span>
       <span class="echo-timestamp">${currentTimestamp()}</span>
       <span class="echo-meta"><span class="echo-meta__model">Workspace</span></span>
     </div>
     ${buildConversationStateCard('receipt', 'Result recorded', visibleArtifacts.length === 1
       ? 'One output is ready for inspection.'
       : `${visibleArtifacts.length} outputs are ready for inspection.`, [
       'Open the artifact when you want details',
       'Use trace to inspect how the result was produced',
       'Receipts stay available for review and replay',
     ], { badge: 'receipt', meta: `${visibleArtifacts.length} item(s)` })}
     <div class="artifacts-grid" style="display: grid; gap: 0.75rem; margin-top: 0.75rem;">
       ${cards}
     </div>
   </div>
 `;

 neuralFeed.appendChild(group);
 scrollFeedToEnd();
 updateDashboardGlass();
 return true;


unction openArtifactPane(title, bodyHtml) {
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


indow.ZavorthControlChat = {
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
;

unction generateCoreResponse(userText) {
 const lower = userText.toLowerCase();
 const command = lower.trim().split(/\s+/)[0] || '';

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
 else if (command === '/status' || command === '/health') {
   const traces = buildSystemTrace("Scanning the gateway...") + buildSystemTrace("Checking PID 4821...");
   const cells = buildLogicCell(
     'system_health_check',
     'M22 12h-4l-3 9L9 3l-3 9H2',
     '0.4s',
     `Gateway:   Connected\nAgent:     Running\nModel:     ${getCurrentModelLabel()}\nRoute:     ${getCurrentModelRouteLabel()}`
   );
   appendEcho('core', 'Systems are operational. Full report below:', traces + cells);
 }
 else if (command === '/agent' || command === 'agent.create') {
   const traces = buildSystemTrace("Compiling the new agent manifest...") + buildSystemTrace("Waiting for operator approval.");
   const cells = buildLogicCell(
     'generate_manifest',
     'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z',
     '1.2s',
     `{\n  "name": "Data Analyst",\n  "model": ${JSON.stringify(getCurrentModelLabel())},\n  "tools": ["python_exec", "db_read"]\n}`
   );
   const buttons = buildInteractiveButtons();
   appendEcho('core', 'Manifest created successfully. Do you want me to deploy it to the mesh...', traces + cells + buttons);
 }
 else if (command === 'shell.exec' || command === 'terminal.run') {
   const traces = buildSystemTrace("Connecting to shell TTY1...");
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


unction shouldHandlePersonalDayFlow(userText, guidedFlow) {
 void userText;
 if (guidedFlow === 'personal-organize-day') return true;
 return false;


unction renderPersonalDayFlow(userText) {
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


unction buildPersonalDayFlowCards({ planId, profile, userText }) {
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


unction shouldHandleDeveloperReviewFlow(userText, guidedFlow) {
 void userText;
 if (guidedFlow === 'developer-review-workspace') return true;
 return false;


unction renderDeveloperWorkspacePicker(userText) {
 const body = [
   'Developer mode is active.',
   '',
   'To review a repository safely, choose a folder or use the current runtime workspace. I will start read-only, list risks, show a patch preview, and require approval before any edit.',
 ].join('\n');
 appendEcho('core', body, buildDeveloperWorkspacePickerCard(userText));


unction buildDeveloperWorkspacePickerCard(userText) {
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


unction renderDeveloperReviewFlow(userText, workspace) {
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


unction buildDeveloperReviewCards({ receiptId, workspace, userText }) {
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
# Operational receipt
fore applying code changes, Zavorth records the request, risk, approval scope and rollback evidence.</code></pre>
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


unction shouldHandleBusinessAuditFlow(userText, guidedFlow) {
 void userText;
 if (guidedFlow === 'business-audit') return true;
 return false;


unction renderBusinessAuditFlow(userText) {
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
   'Nothing outside this ZavorthControl was changed.',
   '',
   'The approval channel, policy scope, TTL, blocked actions and receipt evidence are below.',
 ].join('\n');
 appendEcho('core', body, buildBusinessAuditCards({ receiptId, ttlMinutes, userText }));


unction buildBusinessAuditCards({ receiptId, ttlMinutes, userText }) {
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
       <p>Primary approval channel: ZavorthControl inbox. Optional channel delivery stays inactive until a separate channel is configured and tested live.</p>
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


/ --------- Artifact Pane Logic ---------
onst artifactPane = document.getElementById('artifact-pane');
onst artifactTitle = document.getElementById('artifact-title');
onst artifactBody = document.getElementById('artifact-body');
onst artifactClose = document.getElementById('artifact-close');

f (artifactClose) {
 artifactClose.addEventListener('click', () => {
   artifactPane.classList.add('hidden');
 });


euralFeed.addEventListener('click', (e) => {
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
     runtimeBridge.openPersistentTrace(query, window.ZavorthControlChat || {}).catch((error) => {
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
       title: 'Remote Mesh denied',
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
     title: 'Remote Mesh authorized',
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
         title: 'MCP applied',
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
       title: 'MCP rejected the action',
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
     appendEcho('core', `The MCP rejected this remote action.\n\n${escapeHtml(failureMessage)}`);
   }).catch((error) => {
     const failureMessage = String(error?.message || 'Try again.');
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
     appendEcho('core', `I could not call the notebook MCP.\n\n${escapeHtml(failureMessage)}`);
   });
   return;
 }

 const editScopeButton = e.target.closest('[data-zavorth-approval-edit-scope]');
 if (editScopeButton) {
   e.preventDefault();
   e.stopPropagation();
   openApprovalScopeEditor(editScopeButton);
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
   const scope = card?.dataset?.approvalScope || 'once';
   const scopeNote = card?.dataset?.approvalScopeNote || '';
   const capability = capabilityFromElement(card);
   recordTraceEvent({
     type: 'approval-decision',
     title: decision === 'approve' ? 'Approval authorized' : 'Approval rejected',
     detail: id,
     meta: kind,
     status: decision,
     approvalId: id,
     capability,
     preview: capability?.preview || '',
     receipt: {
       id,
       status: decision,
       summary: `Decision scope: ${normalizeApprovalScopeLabel(scope, scopeNote)}`,
     },
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
   runtimeBridge.decideApproval({ id, kind, decision, scope, scopeNote }, {
     appendEcho,
     renderApprovals,
     renderTranscript,
     emitSignal: window.emitSignal,
   }).catch((error) => {
     card?.querySelectorAll('button').forEach((button) => {
       button.disabled = false;
     });
     const detail = messageFromCaughtError(error, 'Try again.');
     recordTraceEvent({
       type: 'error',
       title: 'Approval failed',
       detail,
       meta: kind,
       status: 'failed',
     });
     appendEcho('core', `I could not resolve this approval.\n\n${detail}`);
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
);

/ --------- Signal System (Toasts) ---------
onst signalFeed = document.getElementById('signal-feed');
indow.emitSignal = function(type, title, msg) {
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
;

/ --------- Command Palette ---------
onst overlayShade = document.getElementById('overlay-shade');
onst cmdPalette = document.getElementById('cmd-palette');
onst cmdInput = document.getElementById('cmd-input');
onst searchBtn = document.getElementById('search-btn');
onst mobileMenuTrigger = document.getElementById('mobile-menu-trigger');
onst mobileDrawer = document.getElementById('mobile-drawer');
onst mobileDrawerClose = document.getElementById('mobile-drawer-close');
onst mobileDrawerSearch = document.getElementById('mobile-drawer-search');
onst drawerItems = document.querySelectorAll('.mobile-drawer__item[data-drawer-sector]');

onst coreModal = document.getElementById('core-modal');
onst coreModalClose = document.getElementById('core-modal-close');
onst coreModalCancel = document.getElementById('core-modal-cancel');

unction openPalette() {
 overlayShade.classList.add('active');
 markOverlayOpened();
 closeMobileDrawer(false);
 cmdPalette.classList.add('active');
 cmdInput.focus();


unction openMobileDrawer() {
 if (!mobileDrawer || !overlayShade) return;
 overlayShade.classList.add('active');
 markOverlayOpened();
 mobileDrawer.classList.add('active');
 mobileDrawer.setAttribute('aria-hidden', 'false');
 coreFrame?.classList.add('drawer-open');


unction closeMobileDrawer(clearShade = true) {
 if (!mobileDrawer) return;
 mobileDrawer.classList.remove('active');
 mobileDrawer.setAttribute('aria-hidden', 'true');
 coreFrame?.classList.remove('drawer-open');
 if (clearShade && overlayShade) overlayShade.classList.remove('active');


unction activateSector(sectorId) {
 const dockNode = document.querySelector(`.dock-node[data-sector="${sectorId}"]`);
 if (dockNode) dockNode.click();


unction syncDrawerActive(sectorId) {
 drawerItems.forEach(item => {
   item.classList.toggle('active', item.dataset.drawerSector === sectorId);
 });


unction dismissOverlays() {
 overlayShade.classList.remove('active');
 cmdPalette.classList.remove('active');
 coreModal.classList.remove('active');
 closeToolSheet(false);
 closeTraceSheet(false);
 closeMobileDrawer(false);


f (searchBtn) searchBtn.addEventListener('click', openPalette);
onst searchTrigger = document.getElementById('search-trigger');
f (searchTrigger) searchTrigger.addEventListener('click', openPalette);
f (mobileMenuTrigger) mobileMenuTrigger.addEventListener('click', openMobileDrawer);
f (mobileDrawerClose) mobileDrawerClose.addEventListener('click', () => closeMobileDrawer());
f (mobileDrawerSearch) mobileDrawerSearch.addEventListener('click', openPalette);
rawerItems.forEach(item => {
 item.addEventListener('click', () => {
   const sectorId = item.dataset.drawerSector;
   activateSector(sectorId);
   syncDrawerActive(sectorId);
   closeMobileDrawer();
 });
);
ockNodes.forEach(node => {
 node.addEventListener('click', () => syncDrawerActive(node.dataset.sector));
);
f (overlayShade) {
 overlayShade.addEventListener('click', () => {
   if (Date.now() - overlayOpenedAt < 320) return;
   dismissOverlays();
 });


ocument.addEventListener('keydown', (e) => {
 if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
   e.preventDefault();
   openPalette();
 }
 if (e.key === 'Escape') {
   dismissOverlays();
   if (artifactPane) artifactPane.classList.add('hidden');
 }
);

indow.openCoreModal = function(title, content) {
 document.getElementById('core-modal-title').textContent = title;
 document.getElementById('core-modal-body').innerHTML = sanitizeRenderedHtml(content, { allowTrustedUi: true });
 overlayShade.classList.add('active');
 markOverlayOpened();
 coreModal.classList.add('active');
;

f (coreModalClose) coreModalClose.addEventListener('click', dismissOverlays);
f (coreModalCancel) coreModalCancel.addEventListener('click', dismissOverlays);

/ --------- Seed Initial Neural Feed ---------
unction seedNeuralFeed() {
 recordTraceEvent({
   type: 'session',
   title: 'Dashboard opened',
   detail: 'local runtime access is being checked.',
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
   const liveSnapshot = getLiveRuntimeSnapshot();
   const liveUnlocked = liveSnapshot.live && !liveSnapshot.authRequired;
   const cells = buildLogicCell(
     'local_access_check',
     'M22 12h-4l-3 9L9 3l-3 9H2',
     'Checking local runtime access',
     `Protocol: WebSocket/SSE\nEndpoint: ${location.origin}/api\nModel:    ${getCurrentModelLabel()}\nRoute:    ${getCurrentModelRouteLabel()}`
   );
   appendEcho('core',
     `${liveUnlocked ? 'Dashboard is ready.' : 'Checking local runtime access'}\n\nIf this browser needs access, paste the local token. I will mark the runtime connected only after the local bridge confirms it.`,
     cells
   );
 }, 400);


eedNeuralFeed();

/ --------- Theme Toggle ---------
onst themeToggle = document.getElementById('theme-toggle');
onst iconSun = themeToggle ? themeToggle.querySelector('.icon-sun') : null;
onst iconMoon = themeToggle ? themeToggle.querySelector('.icon-moon') : null;

unction setTheme(themeName) {
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


onst savedTheme = localStorage.getItem('zavorth_theme');
f (savedTheme) {
 setTheme(savedTheme);
 else {
 setTheme('zavorth');


f (themeToggle) {
 themeToggle.addEventListener('click', () => {
   const current = document.documentElement.getAttribute('data-theme');
   setTheme(current === 'light' ? 'zavorth' : 'light');
 });


);
