const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zavorthDesktop', {
  getRuntimeStatus: () => ipcRenderer.invoke('zavorth:runtime:status'),
  startRuntime: () => ipcRenderer.invoke('zavorth:runtime:start'),
  openDashboard: () => ipcRenderer.invoke('zavorth:dashboard:open'),
  repairAccess: () => ipcRenderer.invoke('zavorth:access:repair'),
  startSetup: () => ipcRenderer.invoke('zavorth:setup:start'),
  openLogs: () => ipcRenderer.invoke('zavorth:logs:open'),
  onBootEvent: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('zavorth:boot:event', listener);
    return () => ipcRenderer.removeListener('zavorth:boot:event', listener);
  },
});
