(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const messages = $('#messages');
  const chatForm = $('#chat-form');
  const chatInput = $('#chat-input');
  const btnSend = $('#btn-send');
  const btnSettings = $('#btn-settings');
  const btnConnect = $('#btn-connect');
  const btnDisconnect = $('#btn-disconnect');
  const btnCloseSettings = $('#btn-close-settings');
  const settingsDialog = $('#settings-dialog');
  const wsUrlInput = $('#ws-url');
  const authTokenInput = $('#auth-token');
  const nodeIdInput = $('#node-id');
  const sharedSecretInput = $('#shared-secret');
  const settingsStatus = $('#settings-status');
  const connectionBadge = $('#connection-status');

  let ws = null;
  let state = 'disconnected';
  let heartbeatTimer = null;
  let reconnectAttempts = 0;
  const maxReconnect = 10;
  const heartbeatMs = 30000;
  const offlineQueueStorageKey = 'zavorth_satellite_offline_queue';
  const completedInvocationsStorageKey = 'zavorth_satellite_completed_invocations';
  let offlineQueue = loadStoredList(offlineQueueStorageKey);
  let completedInvocations = loadStoredList(completedInvocationsStorageKey);
  const actionCards = new Map();

  function defaultWsUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/api/web/satellite/ws`;
  }

  function loadConfig() {
    try {
      return JSON.parse(localStorage.getItem('zavorth_satellite_config') || '{}');
    } catch {
      return {};
    }
  }

  function loadStoredList(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function saveStoredList(key, value) {
    localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value.slice(-50) : []));
  }

  function saveConfig() {
    localStorage.setItem('zavorth_satellite_config', JSON.stringify({
      wsUrl: wsUrlInput.value.trim(),
      authToken: authTokenInput.value.trim(),
      nodeId: nodeIdInput.value.trim(),
      sharedSecret: sharedSecretInput.value.trim(),
    }));
  }

  function enqueueOfflineEnvelope(envelope) {
    offlineQueue.push(envelope);
    saveStoredList(offlineQueueStorageKey, offlineQueue);
  }

  function flushOfflineQueue() {
    if (!ws || ws.readyState !== WebSocket.OPEN || !navigator.onLine || offlineQueue.length === 0) {
      return;
    }
    const pending = [...offlineQueue];
    offlineQueue = [];
    saveStoredList(offlineQueueStorageKey, offlineQueue);
    for (const envelope of pending) {
      ws.send(JSON.stringify({
        ...envelope,
        timestamp: new Date().toISOString(),
      }));
    }
  }

  function pushCompletedInvocation(completion) {
    completedInvocations.push(completion);
    saveStoredList(completedInvocationsStorageKey, completedInvocations);
  }

  function drainCompletedInvocations() {
    const pending = [...completedInvocations];
    completedInvocations = [];
    saveStoredList(completedInvocationsStorageKey, completedInvocations);
    return pending;
  }

  function uuid() {
    return window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function setState(nextState) {
    state = nextState;
    connectionBadge.className = `status-badge ${nextState}`;
    const labels = {
      disconnected: 'Desconectado',
      connecting: 'Conectando...',
      authenticating: 'Autenticando...',
      connected: 'Conectado',
    };
    connectionBadge.textContent = labels[nextState] || nextState;
    btnSend.disabled = nextState !== 'connected';
    btnConnect.disabled = nextState === 'connecting' || nextState === 'authenticating';
    btnDisconnect.disabled = nextState === 'disconnected';
  }

  function addMessage(text, type = 'agent', meta = '') {
    const welcome = messages.querySelector('.welcome-message');
    if (welcome) {
      welcome.remove();
    }
    const div = document.createElement('div');
    div.className = `msg ${type}`;
    div.textContent = text;
    if (meta) {
      const span = document.createElement('div');
      span.className = 'msg-meta';
      span.textContent = meta;
      div.appendChild(span);
    }
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  function addSystemMessage(text) {
    addMessage(text, 'system');
  }

  function asText(value, fallback = '') {
    if (value === null || value === undefined) {
      return fallback;
    }
    return String(value);
  }

  function normalizeActionPayload(payload = {}, envelope = {}) {
    const actionId = asText(
      payload.actionId || payload.id || payload.requestId || envelope.messageId || uuid(),
      uuid(),
    ).trim();
    const badge = asText(payload.badge || payload.type || payload.kind || payload.category || 'ACTION', 'ACTION')
      .trim()
      .replace(/[^a-z0-9_.:-]+/gi, '_')
      .slice(0, 32)
      .toUpperCase();
    const title = asText(payload.title || payload.name || payload.summary || 'Action required', 'Action required').trim();
    const body = asText(
      payload.description || payload.body || payload.message || payload.reason || 'Zavorth needs your decision to continue.',
      'Zavorth needs your decision to continue.',
    ).trim();
    const details = payload.details || payload.diff || payload.preview || payload.metadata || null;
    return {
      actionId,
      badge,
      title,
      body,
      details,
      risk: asText(payload.risk || payload.riskLevel || payload.severity || '', '').trim(),
      createdAt: asText(payload.createdAt || envelope.timestamp || new Date().toISOString()),
      sourceMessageId: envelope.messageId || null,
    };
  }

  function renderActionCard(payload, envelope = {}) {
    const action = normalizeActionPayload(payload, envelope);
    const welcome = messages.querySelector('.welcome-message');
    if (welcome) {
      welcome.remove();
    }

    const card = document.createElement('article');
    card.className = 'msg action-card pending';
    card.dataset.actionId = action.actionId;
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', `${action.title}. ${action.badge}`);

    const header = document.createElement('div');
    header.className = 'action-header';

    const icon = document.createElement('span');
    icon.className = 'action-icon';
    icon.textContent = action.badge.slice(0, 2) || 'ZA';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'action-title-group';

    const title = document.createElement('strong');
    title.className = 'action-title';
    title.textContent = action.title;

    const badge = document.createElement('span');
    badge.className = 'action-badge';
    badge.textContent = action.badge;

    titleGroup.append(title, badge);
    header.append(icon, titleGroup);

    const body = document.createElement('div');
    body.className = 'action-body';
    body.textContent = action.body;

    if (action.risk) {
      const risk = document.createElement('div');
      risk.className = 'action-risk';
      risk.textContent = `Risk: ${action.risk}`;
      body.appendChild(risk);
    }

    const details = document.createElement('pre');
    details.className = 'action-details';
    details.hidden = true;
    details.textContent = formatActionDetails(action.details);

    const status = document.createElement('div');
    status.className = 'action-status';
    status.textContent = 'Pending decision';

    const buttons = document.createElement('div');
    buttons.className = 'action-buttons';

    const approve = buildActionButton('approve', 'Allow');
    const reject = buildActionButton('reject', 'Deny');
    const detailsButton = buildActionButton('details', 'Details');
    detailsButton.disabled = !action.details;

    buttons.append(approve, reject, detailsButton);
    card.append(header, body, details, status, buttons);
    messages.appendChild(card);
    messages.scrollTop = messages.scrollHeight;

    actionCards.set(action.actionId, {
      action,
      card,
      details,
      status,
      buttons: [approve, reject, detailsButton],
    });

    return card;
  }

  function buildActionButton(decision, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `action-btn ${decision}`;
    button.dataset.decision = decision;
    button.textContent = label;
    return button;
  }

  function formatActionDetails(details) {
    if (!details) {
      return '';
    }
    if (typeof details === 'string') {
      return details;
    }
    try {
      return JSON.stringify(details, null, 2);
    } catch {
      return String(details);
    }
  }

  function setActionCardState(actionId, nextState, label) {
    const entry = actionCards.get(actionId);
    if (!entry) {
      return;
    }
    entry.card.classList.remove('pending', 'approved', 'rejected', 'loading', 'failed');
    entry.card.classList.add(nextState);
    entry.status.textContent = label;
    const done = nextState === 'approved' || nextState === 'rejected';
    for (const button of entry.buttons) {
      if (button.dataset.decision !== 'details') {
        button.disabled = done || nextState === 'loading';
        if (nextState !== 'loading') {
          button.textContent = button.dataset.label || button.textContent;
        }
      }
    }
  }

  function handleAction(decision, id) {
    const entry = actionCards.get(id);
    if (!entry) {
      return false;
    }
    if (decision === 'details') {
      entry.details.hidden = !entry.details.hidden;
      return true;
    }

    const selectedButton = entry.buttons.find((button) => button.dataset.decision === decision);
    if (selectedButton) {
      selectedButton.dataset.label = selectedButton.dataset.label || selectedButton.textContent;
      selectedButton.textContent = 'Sending...';
    }
    setActionCardState(id, 'loading', decision === 'approve' ? 'Sending approval...' : 'Sending denial...');
    const delivered = send('capability.result', {
      actionId: id,
      decision,
      ok: true,
      result: {
        decision,
        actionId: id,
        decidedAt: new Date().toISOString(),
      },
      error: null,
    }, entry.action.sourceMessageId);

    if (!delivered) {
      setActionCardState(id, 'failed', 'Could not send decision. Reconnect and try again.');
      return false;
    }

    setActionCardState(
      id,
      decision === 'approve' ? 'approved' : 'rejected',
      decision === 'approve' ? 'Approved' : 'Rejected',
    );
    return true;
  }

  window.renderActionCard = renderActionCard;
  window.handleAction = handleAction;

  function showTyping() {
    const div = document.createElement('div');
    div.className = 'msg agent typing-indicator';
    div.id = 'typing';
    div.innerHTML = '<span></span><span></span><span></span>';
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function hideTyping() {
    $('#typing')?.remove();
  }

  function connect() {
    const url = wsUrlInput.value.trim() || defaultWsUrl();
    wsUrlInput.value = url;
    saveConfig();
    disconnect(false);
    setState('connecting');
    settingsStatus.textContent = 'Conectando...';

    try {
      ws = new WebSocket(url);
    } catch (error) {
      setState('disconnected');
      settingsStatus.textContent = `URL invalida: ${error.message}`;
      return;
    }

    ws.onopen = () => {
      reconnectAttempts = 0;
      setState('authenticating');
      settingsStatus.textContent = 'Aguardando autenticacao...';
      startHeartbeat();
    };

    ws.onmessage = (event) => {
      try {
        handleEnvelope(JSON.parse(event.data)).catch(() => {
          addSystemMessage('Falha ao processar mensagem do runtime.');
        });
      } catch {
        addSystemMessage('Mensagem invalida recebida do runtime.');
      }
    };

    ws.onclose = () => {
      stopHeartbeat();
      if (state === 'connected') {
        addSystemMessage('Conexao perdida. Tentando reconectar...');
      }
      setState('disconnected');
      settingsStatus.textContent = 'Desconectado.';
      tryReconnect();
    };

    ws.onerror = () => {
      settingsStatus.textContent = 'Erro de conexao.';
    };
  }

  function disconnect(disableReconnect = true) {
    if (disableReconnect) {
      reconnectAttempts = maxReconnect;
    }
    stopHeartbeat();
    if (ws) {
      ws.close();
      ws = null;
    }
    setState('disconnected');
  }

  function tryReconnect() {
    if (reconnectAttempts >= maxReconnect) {
      return;
    }
    reconnectAttempts += 1;
    const delay = Math.min(2000 * reconnectAttempts, 15000);
    window.setTimeout(() => {
      if (state === 'disconnected') {
        connect();
      }
    }, delay);
  }

  function send(type, payload, replyTo) {
    const envelope = {
      type,
      messageId: uuid(),
      replyTo: replyTo || null,
      payload,
      timestamp: new Date().toISOString(),
    };
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      if (type === 'chat.send') {
        enqueueOfflineEnvelope(envelope);
      }
      return false;
    }
    ws.send(JSON.stringify(envelope));
    return true;
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = window.setInterval(() => {
      send('heartbeat.ping', {
        nodeId: nodeIdInput.value.trim() || null,
        sharedSecret: sharedSecretInput.value.trim() || null,
        capabilities: listLocalCapabilities(),
        completedInvocations: drainCompletedInvocations(),
      });
    }, heartbeatMs);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  let streamBuffer = '';
  let streamMsgEl = null;

  function listLocalCapabilities() {
    const capabilities = ['device.info', 'device.doctor', 'offline.queue'];
    if (navigator.mediaDevices?.getUserMedia) {
      capabilities.push('camera.capture');
    }
    if (navigator.geolocation?.getCurrentPosition) {
      capabilities.push('location.read');
    }
    if ('Notification' in window) {
      capabilities.push('notifications.send');
    }
    if (navigator.credentials?.get && window.PublicKeyCredential) {
      capabilities.push('biometric.approve');
    }
    if (navigator.vibrate) {
      capabilities.push('haptic.vibrate');
    }
    return capabilities.sort();
  }

  async function executeLocalCapability(capabilityId, args = {}) {
    switch (String(capabilityId || '').trim()) {
      case 'device.info':
      case 'device.doctor':
        return buildDeviceDoctor();
      case 'camera.capture':
        return captureCamera(args);
      case 'location.read':
        return readLocation(args);
      case 'notifications.send':
        return sendNotification(args);
      case 'biometric.approve':
        return approveWithBiometrics(args);
      case 'haptic.vibrate':
        return vibrateDevice(args);
      case 'offline.queue':
        return {
          online: navigator.onLine,
          pendingEnvelopes: offlineQueue.length,
          pendingCompletedInvocations: completedInvocations.length,
        };
      default:
        throw new Error(`Capability local nao suportada: ${capabilityId}`);
    }
  }

  function buildDeviceDoctor() {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      online: navigator.onLine,
      serviceWorker: 'serviceWorker' in navigator,
      mediaDevices: Boolean(navigator.mediaDevices?.getUserMedia),
      geolocation: Boolean(navigator.geolocation?.getCurrentPosition),
      notifications: 'Notification' in window ? Notification.permission : 'unsupported',
      webauthn: Boolean(navigator.credentials?.get && window.PublicKeyCredential),
      haptic: Boolean(navigator.vibrate),
      localStorage: typeof localStorage !== 'undefined',
      offlineQueue: offlineQueue.length,
      completedInvocations: completedInvocations.length,
      heartbeatMs,
      checkedAt: new Date().toISOString(),
    };
  }

  async function captureCamera(args) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera indisponivel neste navegador.');
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: args.facingMode || 'environment',
        width: args.width ? { ideal: Number(args.width) } : undefined,
        height: args.height ? { ideal: Number(args.height) } : undefined,
      },
      audio: false,
    });
    try {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      if (!video.videoWidth || !video.videoHeight) {
        await new Promise((resolve) => {
          video.onloadedmetadata = resolve;
          window.setTimeout(resolve, 1200);
        });
      }
      const width = video.videoWidth || Number(args.width) || 1280;
      const height = video.videoHeight || Number(args.height) || 720;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(video, 0, 0, width, height);
      const contentType = String(args.contentType || 'image/jpeg');
      const quality = typeof args.quality === 'number' ? args.quality : 0.86;
      return {
        contentType,
        dataUrl: canvas.toDataURL(contentType, quality),
        width,
        height,
        capturedAt: new Date().toISOString(),
      };
    } finally {
      stream.getTracks().forEach((track) => track.stop());
    }
  }

  function readLocation(args) {
    if (!navigator.geolocation?.getCurrentPosition) {
      return Promise.reject(new Error('Geolocalizacao indisponivel neste navegador.'));
    }
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          capturedAt: new Date(position.timestamp).toISOString(),
        }),
        (error) => reject(new Error(error.message || 'Falha ao ler localizacao.')),
        {
          enableHighAccuracy: args.highAccuracy !== false,
          timeout: Number(args.timeoutMs || 15000),
          maximumAge: Number(args.maximumAgeMs || 10000),
        },
      );
    });
  }

  async function sendNotification(args) {
    if (!('Notification' in window)) {
      throw new Error('Notificacoes indisponiveis neste navegador.');
    }
    let permission = Notification.permission;
    if (permission === 'default' && args.requestPermission !== false) {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
      throw new Error(`Notificacao nao autorizada: ${permission}`);
    }
    const notification = new Notification(String(args.title || 'Zavorth'), {
      body: String(args.body || ''),
      tag: args.tag ? String(args.tag) : undefined,
      silent: Boolean(args.silent),
      data: args.data || null,
    });
    window.setTimeout(() => notification.close(), Number(args.closeAfterMs || 8000));
    return {
      permission,
      shownAt: new Date().toISOString(),
      title: String(args.title || 'Zavorth'),
    };
  }

  async function approveWithBiometrics(args) {
    if (!navigator.credentials?.get || !window.PublicKeyCredential) {
      throw new Error('WebAuthn indisponivel neste navegador.');
    }
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.();
    if (!args.challengeBase64 && !args.challenge) {
      return {
        approved: false,
        challengeRequired: true,
        platformAuthenticatorAvailable: available !== false,
      };
    }
    const challenge = decodeBase64Url(String(args.challengeBase64 || args.challenge));
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: Number(args.timeoutMs || 60000),
        userVerification: 'required',
        rpId: args.rpId ? String(args.rpId) : undefined,
      },
    });
    return {
      approved: Boolean(credential),
      credentialId: credential?.id || null,
      credentialType: credential?.type || null,
      approvedAt: new Date().toISOString(),
    };
  }

  function vibrateDevice(args) {
    if (!navigator.vibrate) {
      throw new Error('Vibracao indisponivel neste navegador.');
    }
    const pattern = Array.isArray(args.pattern)
      ? args.pattern.map((value) => Number(value)).filter((value) => Number.isFinite(value))
      : [40, 60, 40];
    return {
      supported: true,
      accepted: navigator.vibrate(pattern),
      pattern,
      triggeredAt: new Date().toISOString(),
    };
  }

  function decodeBase64Url(value) {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
    const binary = window.atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes.buffer;
  }

  async function handleCapabilityInvoke(env) {
    const payload = env.payload || {};
    if (payload.actionId || payload.requiresDecision || payload.interactive === true) {
      renderActionCard(payload, env);
      return;
    }
    const capabilityId = payload.capabilityId || payload.capability || payload.id;
    try {
      const result = await executeLocalCapability(capabilityId, payload.args || payload.payload || {});
      send('capability.result', {
        ok: true,
        result,
        error: null,
      }, env.messageId);
    } catch (error) {
      send('capability.result', {
        ok: false,
        result: null,
        error: error?.message || String(error),
      }, env.messageId);
    }
  }

  async function handleNodeAssignments(assignments) {
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return;
    }
    for (const assignment of assignments) {
      const invocationId = String(assignment.id || assignment.invocationId || '').trim();
      if (!invocationId) {
        continue;
      }
      try {
        const data = await executeLocalCapability(assignment.capabilityId, assignment.payload || {});
        pushCompletedInvocation({
          invocationId,
          ok: true,
          resultSummary: `${assignment.capabilityId} executada no Satellite.`,
          stdout: JSON.stringify(data, null, 2),
          stderr: null,
          exitCode: 0,
          data,
        });
      } catch (error) {
        pushCompletedInvocation({
          invocationId,
          ok: false,
          resultSummary: `Falha ao executar ${assignment.capabilityId} no Satellite.`,
          stdout: null,
          stderr: error?.message || String(error),
          exitCode: null,
          data: {
            capabilityId: assignment.capabilityId,
          },
        });
      }
    }
    send('heartbeat.ping', {
      nodeId: nodeIdInput.value.trim() || null,
      sharedSecret: sharedSecretInput.value.trim() || null,
      capabilities: listLocalCapabilities(),
      completedInvocations: drainCompletedInvocations(),
    });
  }

  async function handleEnvelope(env) {
    switch (env.type) {
      case 'auth.challenge':
        send('auth.response', {
          token: authTokenInput.value.trim() || loadConfig().authToken || '',
          nonce: env.payload?.nonce || '',
        }, env.messageId);
        break;
      case 'auth.ok':
        setState('connected');
        settingsStatus.textContent = 'Conectado.';
        addSystemMessage('Conectado ao Zavorth Runtime.');
        flushOfflineQueue();
        send('status.request', {});
        break;
      case 'auth.error':
        setState('disconnected');
        settingsStatus.textContent = `Auth falhou: ${env.payload?.message || 'token invalido.'}`;
        addSystemMessage('Autenticacao falhou. Verifique o token.');
        break;
      case 'chat.response':
        hideTyping();
        addMessage(env.payload?.text || '', 'agent');
        break;
      case 'chat.stream_chunk':
        if (!streamMsgEl) {
          hideTyping();
          streamBuffer = '';
          streamMsgEl = addMessage('', 'agent');
        }
        streamBuffer += env.payload?.delta || '';
        streamMsgEl.textContent = streamBuffer;
        messages.scrollTop = messages.scrollHeight;
        break;
      case 'chat.stream_end':
        hideTyping();
        if (streamMsgEl) {
          streamMsgEl.textContent = env.payload?.fullText || streamBuffer;
          streamMsgEl = null;
          streamBuffer = '';
        }
        break;
      case 'status.response':
        addSystemMessage(`Runtime: ${env.payload?.agentName || 'Zavorth'} | Capabilities: ${(env.payload?.capabilities || []).join(', ')}`);
        break;
      case 'capability.result':
        hideTyping();
        addMessage(env.payload?.ok ? JSON.stringify(env.payload.result, null, 2) : `Erro: ${env.payload?.error || 'desconhecido'}`, 'agent');
        break;
      case 'action.request':
      case 'approval.request':
        hideTyping();
        renderActionCard(env.payload || {}, env);
        break;
      case 'capability.invoke':
        await handleCapabilityInvoke(env);
        break;
      case 'error':
        hideTyping();
        addSystemMessage(env.payload?.message || 'Erro desconhecido.');
        break;
      case 'heartbeat.pong':
        await handleNodeAssignments(env.payload?.nodeMesh?.assignments || env.payload?.assignments || []);
        break;
      default:
        break;
    }
  }

  chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = chatInput.value.trim();
    if (!text) {
      return;
    }
    addMessage(text, 'user', new Date().toLocaleTimeString());
    const delivered = send('chat.send', { text });
    chatInput.value = '';
    chatInput.style.height = 'auto';
    if (delivered) {
      showTyping();
    } else {
      addSystemMessage('Mensagem guardada para envio quando a conexao voltar.');
    }
  });

  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = `${Math.min(chatInput.scrollHeight, 120)}px`;
  });

  chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      chatForm.requestSubmit();
    }
  });

  messages.addEventListener('click', (event) => {
    const button = event.target.closest('.action-btn');
    if (!button) {
      return;
    }
    const card = button.closest('.action-card');
    const actionId = card?.dataset?.actionId;
    const decision = button.dataset.decision;
    if (!actionId || !decision) {
      return;
    }
    handleAction(decision, actionId);
  });

  btnSettings.addEventListener('click', () => settingsDialog.showModal());
  btnCloseSettings.addEventListener('click', () => settingsDialog.close());
  btnConnect.addEventListener('click', () => connect());
  btnDisconnect.addEventListener('click', () => disconnect());
  settingsDialog.addEventListener('click', (event) => {
    if (event.target === settingsDialog) {
      settingsDialog.close();
    }
  });

  const config = loadConfig();
  wsUrlInput.value = config.wsUrl || defaultWsUrl();
  authTokenInput.value = new URLSearchParams(window.location.search).get('token') || config.authToken || '';
  nodeIdInput.value = config.nodeId || '';
  sharedSecretInput.value = config.sharedSecret || '';
  setState('disconnected');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/satellite/sw.js', { scope: '/satellite/' }).catch(() => {});
  }
  window.addEventListener('online', flushOfflineQueue);
})();
