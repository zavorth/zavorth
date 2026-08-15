import { resolve } from 'node:path';
const fs = require('fs');
const path = require('path');

const notifServicePath = resolve('apps/zavorth-desktop/src/components/DesktopNotificationService.ts');
const notifServiceCode = fs.readFileSync(notifServicePath, 'utf8');

describe('DesktopNotificationService — Static Analysis', () => {
  it('should export sendDesktopNotification function', () => {
    expect(notifServiceCode).toContain('export async function sendDesktopNotification');
  });

  it('should export requestNotificationPermission function', () => {
    expect(notifServiceCode).toContain('export async function requestNotificationPermission');
  });

  it('should check window.zavorthDesktop bridge', () => {
    expect(notifServiceCode).toContain('window.zavorthDesktop?.sendNotification');
    expect(notifServiceCode).toContain('window.zavorthDesktop?.getNotificationPermission');
  });

  it('should fallback to Web Notification API', () => {
    expect(notifServiceCode).toContain('Notification');
    expect(notifServiceCode).toContain('new Notification');
  });

  it('should handle errors gracefully', () => {
    expect(notifServiceCode).toContain('catch');
  });

  it('should return boolean from sendDesktopNotification', () => {
    expect(notifServiceCode).toContain('return false');
    expect(notifServiceCode).toContain('return true');
  });

  it('should return string from requestNotificationPermission', () => {
    expect(notifServiceCode).toContain("'unsupported'");
  });

  it('should accept title and body options', () => {
    expect(notifServiceCode).toContain('title');
    expect(notifServiceCode).toContain('body');
  });

  it('should support silent option', () => {
    expect(notifServiceCode).toContain('silent');
  });
});

describe('SessionPicker — Static Analysis', () => {
  const sessionPickerPath = resolve('apps/zavorth-desktop/src/components/SessionPicker.tsx');
  const sessionPickerCode = fs.readFileSync(sessionPickerPath, 'utf8');

  it('should export SessionPicker component', () => {
    expect(sessionPickerCode).toContain('export function SessionPicker');
  });

  it('should accept onSwitch callback', () => {
    expect(sessionPickerCode).toContain('onSwitch');
  });

  it('should accept onNewSession callback', () => {
    expect(sessionPickerCode).toContain('onNewSession');
  });

  it('should accept currentSessionId prop', () => {
    expect(sessionPickerCode).toContain('currentSessionId');
  });

  it('should have search functionality', () => {
    expect(sessionPickerCode).toContain('search');
    expect(sessionPickerCode).toContain('filter');
  });

  it('should load sessions from bridge', () => {
    expect(sessionPickerCode).toContain('listSessions');
  });

  it('should display session metadata', () => {
    expect(sessionPickerCode).toContain('messageCount');
    expect(sessionPickerCode).toContain('surface');
    expect(sessionPickerCode).toContain('lastMessage');
  });

  it('should format timestamps', () => {
    expect(sessionPickerCode).toContain('toLocaleDateString');
  });

  it('should handle loading state', () => {
    expect(sessionPickerCode).toContain('loading');
  });

  it('should handle error state', () => {
    expect(sessionPickerCode).toContain('error');
  });

  it('should have refresh button', () => {
    expect(sessionPickerCode).toContain('RefreshCw');
  });
});

describe('Global Types — Bridge API', () => {
  const globalTypesPath = resolve('apps/zavorth-desktop/src/global.d.ts');
  const globalTypesCode = fs.readFileSync(globalTypesPath, 'utf8');

  it('should define sendNotification method', () => {
    expect(globalTypesCode).toContain('sendNotification');
  });

  it('should define getNotificationPermission method', () => {
    expect(globalTypesCode).toContain('getNotificationPermission');
  });

  it('should define listSessions method', () => {
    expect(globalTypesCode).toContain('listSessions');
  });

  it('should define switchSession method', () => {
    expect(globalTypesCode).toContain('switchSession');
  });

  it('should define readFileTree method', () => {
    expect(globalTypesCode).toContain('readFileTree');
  });

  it('should define SessionEntry type', () => {
    expect(globalTypesCode).toContain('SessionEntry');
  });

  it('should define FileExplorerNode type', () => {
    expect(globalTypesCode).toContain('FileExplorerNode');
  });
});

describe('Session Picker CSS', () => {
  const stylesPath = resolve('apps/zavorth-desktop/src/styles.css');
  const stylesCode = fs.readFileSync(stylesPath, 'utf8');

  it('should have session-picker base class', () => {
    expect(stylesCode).toContain('.session-picker');
  });

  it('should have session-picker-header', () => {
    expect(stylesCode).toContain('.session-picker-header');
  });

  it('should have session-picker-search', () => {
    expect(stylesCode).toContain('.session-picker-search');
  });

  it('should have session-picker-list', () => {
    expect(stylesCode).toContain('.session-picker-list');
  });

  it('should have session-picker-item', () => {
    expect(stylesCode).toContain('.session-picker-item');
  });

  it('should have active state', () => {
    expect(stylesCode).toContain('.session-picker-item.active');
  });

  it('should have dark theme support', () => {
    expect(stylesCode).toContain('.theme-dark .session-picker');
  });

  it('should have hover states', () => {
    expect(stylesCode).toContain('.session-picker-item:hover');
    expect(stylesCode).toContain('.session-picker-btn:hover');
  });
});
