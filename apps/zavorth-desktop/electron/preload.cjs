const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zavorthDesktop', {
  getRuntimeStatus: () => ipcRenderer.invoke('zavorth:runtime:status'),
  startRuntime: () => ipcRenderer.invoke('zavorth:runtime:start'),
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
  readFileTree: rootPath => ipcRenderer.invoke('zavorth:files:read-tree', rootPath),
  onBootEvent: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('zavorth:boot:event', listener);
    return () => ipcRenderer.removeListener('zavorth:boot:event', listener);
  },
});
