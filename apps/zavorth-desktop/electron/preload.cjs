const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zavorthDesktop', {
  getRuntimeStatus: () => ipcRenderer.invoke('zavorth:runtime:status'),
  startRuntime: () => ipcRenderer.invoke('zavorth:runtime:start'),
  getCodeBridgeSummary: () => ipcRenderer.invoke('zavorth:code-bridge:summary'),
  apiRequest: request => ipcRenderer.invoke('zavorth:api:request', request),
  connectGooglePersonalOps: () => ipcRenderer.invoke('zavorth:personal-ops:google-connect'),
  repairAccess: () => ipcRenderer.invoke('zavorth:access:repair'),
  startSetup: () => ipcRenderer.invoke('zavorth:setup:start'),
  selectWorkspaceFolder: () => ipcRenderer.invoke('zavorth:workspace:select-folder'),
  openLogs: () => ipcRenderer.invoke('zavorth:logs:open'),
  sendNotification: options => ipcRenderer.invoke('zavorth:notification:send', options),
  getNotificationPermission: () => ipcRenderer.invoke('zavorth:notification:permission'),
  listSessions: () => ipcRenderer.invoke('zavorth:sessions:list'),
  switchSession: sessionId => ipcRenderer.invoke('zavorth:sessions:switch', sessionId),
  createSession: input => ipcRenderer.invoke('zavorth:sessions:create', input),
  readFileTree: rootPath => ipcRenderer.invoke('zavorth:files:read-tree', rootPath),
  checkUpdates: () => ipcRenderer.invoke('zavorth:check-updates'),
  downloadUpdate: () => ipcRenderer.invoke('zavorth:updates:download'),
  deferUpdate: (input) => ipcRenderer.invoke('zavorth:updates:defer', input),
  installUpdate: () => ipcRenderer.invoke('zavorth:updates:install'),
  rollbackUpdate: () => ipcRenderer.invoke('zavorth:updates:rollback'),
  openGithubReleases: () => ipcRenderer.invoke('zavorth:updates:open-github'),
  getVoiceAgentStatus: () => ipcRenderer.invoke('zavorth:voice-agent:status'),
  startVoiceAgent: () => ipcRenderer.invoke('zavorth:voice-agent:start'),
  onVoiceHotkey: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('zavorth:voice:hotkey', listener);
    return () => ipcRenderer.removeListener('zavorth:voice:hotkey', listener);
  },
  openWindow: () => ipcRenderer.invoke('zavorth:open-window'),
  onDeepLink: (callback) => {
    const listener = (_event, url) => callback(url);
    ipcRenderer.on('zavorth:deeplink', listener);
    return () => ipcRenderer.removeListener('zavorth:deeplink', listener);
  },
  onBootEvent: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('zavorth:boot:event', listener);
    return () => ipcRenderer.removeListener('zavorth:boot:event', listener);
  },
  automations: {
    list: () => ipcRenderer.invoke('zavorth:automations:list'),
    create: input => ipcRenderer.invoke('zavorth:automations:create', input),
    delete: id => ipcRenderer.invoke('zavorth:automations:delete', id),
    toggle: (id, enabled) => ipcRenderer.invoke('zavorth:automations:toggle', id, enabled),
    run: id => ipcRenderer.invoke('zavorth:automations:run', id),
    logs: sessionId => ipcRenderer.invoke('zavorth:automations:logs', sessionId),
    onUpdated: callback => {
      const listener = (_event, tasks) => callback(tasks);
      ipcRenderer.on('zavorth:automations:updated', listener);
      return () => ipcRenderer.removeListener('zavorth:automations:updated', listener);
    },
  },
  kaelOverlay: {
    open: (bounds) => ipcRenderer.invoke('zavorth:kael-overlay:open', bounds),
    close: () => ipcRenderer.invoke('zavorth:kael-overlay:close'),
    setBounds: (bounds) => ipcRenderer.send('zavorth:kael-overlay:set-bounds', bounds),
    setIgnoreMouse: (ignore) => ipcRenderer.send('zavorth:kael-overlay:ignore-mouse', ignore),
    setFocusable: (focusable) => ipcRenderer.send('zavorth:kael-overlay:set-focusable', focusable),
    state: payload => ipcRenderer.send('zavorth:kael-overlay:state', payload),
    onState: (callback) => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on('zavorth:kael-overlay:state', listener);
      return () => ipcRenderer.removeListener('zavorth:kael-overlay:state', listener);
    },
    control: (payload) => ipcRenderer.send('zavorth:kael-overlay:control', payload),
    onControl: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('zavorth:kael-overlay:control', listener);
      return () => ipcRenderer.removeListener('zavorth:kael-overlay:control', listener);
    }
  },
  getPathForFile: (file) => {
    try {
      const { webUtils } = require('electron');
      return webUtils.getPathForFile(file) || '';
    } catch {
      return file.path || '';
    }
  }
});


