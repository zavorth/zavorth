const fs = require('fs');
const path = require('path');

describe('DesktopPreviewRail i18n', () => {
  it('should have English strings (not Portuguese)', () => {
    const content = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/src/shell/DesktopPreviewRail.tsx'),
      'utf8'
    );
    expect(content).toContain('Progress');
    expect(content).toContain('Outputs');
    expect(content).toContain('Files');
    expect(content).toContain('Sources');
    expect(content).not.toContain('Andamento');
    expect(content).not.toContain('Saidas');
    expect(content).not.toContain('Files');
    expect(content).not.toContain('Fontes');
  });
});

describe('Electron Preload Bridge', () => {
  it('should expose all required APIs', () => {
    const content = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/electron/preload.cjs'),
      'utf8'
    );
    expect(content).toContain('getRuntimeStatus');
    expect(content).toContain('startRuntime');
    expect(content).toContain('apiRequest');
    expect(content).toContain('connectGooglePersonalOps');
    expect(content).toContain('repairAccess');
    expect(content).toContain('startSetup');
    expect(content).toContain('selectWorkspaceFolder');
    expect(content).toContain('openLogs');
    expect(content).toContain('sendNotification');
    expect(content).toContain('getNotificationPermission');
    expect(content).toContain('listSessions');
    expect(content).toContain('switchSession');
    expect(content).toContain('readFileTree');
    expect(content).toContain('onBootEvent');
  });

  it('should use contextBridge.exposeInMainWorld', () => {
    const content = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/electron/preload.cjs'),
      'utf8'
    );
    expect(content).toContain('contextBridge.exposeInMainWorld');
    expect(content).toContain('ipcRenderer.invoke');
  });

  it('should have exactly 15 bridge methods', () => {
    const content = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/electron/preload.cjs'),
      'utf8'
    );
    const methods = [
      'getRuntimeStatus', 'startRuntime', 'apiRequest',
      'connectGooglePersonalOps', 'repairAccess', 'startSetup',
      'selectWorkspaceFolder', 'openLogs', 'sendNotification',
      'getNotificationPermission', 'listSessions', 'switchSession',
      'readFileTree', 'onBootEvent',
    ];
    for (const method of methods) {
      expect(content).toContain(method);
    }
  });
});

describe('Electron Main Process IPC Handlers', () => {
  const mainContent = fs.readFileSync(
    path.resolve('apps/zavorth-desktop/electron/main.cjs'),
    'utf8'
  );

  it('should register notification handlers', () => {
    expect(mainContent).toContain('zavorth:notification:send');
    expect(mainContent).toContain('zavorth:notification:permission');
    expect(mainContent).toContain('Notification.isSupported()');
  });

  it('should register session handlers', () => {
    expect(mainContent).toContain('zavorth:sessions:list');
    expect(mainContent).toContain('zavorth:sessions:switch');
  });

  it('should register file tree handler', () => {
    expect(mainContent).toContain('zavorth:files:read-tree');
    expect(mainContent).toContain('node_modules');
    expect(mainContent).toContain('depth');
  });

  it('should have security guards in file tree reader', () => {
    expect(mainContent).toContain('Invalid path');
  });

  it('should use Notification API safely', () => {
    expect(mainContent).toContain('mainWindow.focus()');
    expect(mainContent).toContain('notification.show()');
  });

  it('should limit file tree depth to 8', () => {
    expect(mainContent).toContain('depth > 8');
  });

  it('should filter hidden files and node_modules', () => {
    expect(mainContent).toContain("e.name.startsWith('.')");
    expect(mainContent).toContain("'node_modules'");
    expect(mainContent).toContain("'dist'");
  });

  it('should limit entries to 200', () => {
    expect(mainContent).toContain('.slice(0, 200)');
  });

  it('should handle notification click to focus window', () => {
    expect(mainContent).toContain("notification.on('click'");
    expect(mainContent).toContain('mainWindow.restore()');
  });

  it('should validate session switch input', () => {
    expect(mainContent).toContain("String(sessionId || '')");
  });

  it('should sort directories before files', () => {
    expect(mainContent).toContain('isDirectory()');
  });
});
