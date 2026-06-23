import fs from 'fs';
import os from 'os';
import path from 'path';
import { NotificationCenterService } from '../../src/services/plugins/NotificationCenterService';
import { VersionControlService } from '../../src/services/plugins/VersionControlService';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'notif-vc-'));

describe('NotificationCenterService', () => {
  let svc: NotificationCenterService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new NotificationCenterService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('sends notification', () => { expect(svc.send('Test', 'Message')).toContain('sent'); });
  it('gets unread', () => { svc.send('Test', 'Message'); expect(svc.getUnread()).toContain('Test'); });
  it('marks as read', () => {
    svc.send('Test', 'Message');
    const unread = svc.getUnread();
    const match = unread.match(/notif_\w+/);
    expect(match).toBeTruthy();
    expect(svc.markAsRead(match![0])).toContain('read');
  });
  it('gets by type', () => { svc.send('Test', 'Message', { type: 'error' }); expect(svc.getByType('error')).toContain('error'); });
  it('gets by priority', () => { svc.send('Test', 'Message', { priority: 'high' }); expect(svc.getByPriority('high')).toContain('high'); });
  it('lists channels', () => { expect(svc.listChannels()).toContain('Internal'); });
  it('adds channel', () => { expect(svc.addChannel('Test', 'email')).toContain('added'); });
  it('enables channel', () => { expect(svc.enableChannel('email')).toContain('enabled'); });
  it('disables channel', () => { expect(svc.disableChannel('internal')).toContain('disabled'); });
  it('gets stats', () => { svc.send('Test', 'Message'); expect(svc.getStats()).toContain('Total: 1'); });
  it('clears old', () => { svc.send('Test', 'Message'); expect(svc.clearOld(0)).toContain('Cleared'); });
});

describe('VersionControlService', () => {
  let svc: VersionControlService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new VersionControlService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('commits file', () => {
    const file = path.join(dir, 'test.txt');
    fs.writeFileSync(file, 'hello');
    expect(svc.commit(file, 'initial')).toContain('Committed');
  });

  it('gets history', () => {
    const file = path.join(dir, 'test.txt');
    fs.writeFileSync(file, 'hello');
    svc.commit(file, 'v1');
    expect(svc.getHistory(file)).toContain('v1');
  });

  it('gets version', () => {
    const file = path.join(dir, 'test.txt');
    fs.writeFileSync(file, 'hello');
    svc.commit(file, 'v1');
    const id = svc.getHistory(file).match(/ver_\w+/)?.[0] || '';
    expect(svc.getVersion(id)).toBe('hello');
  });

  it('reverts file', () => {
    const file = path.join(dir, 'test.txt');
    fs.writeFileSync(file, 'v1');
    svc.commit(file, 'v1');
    fs.writeFileSync(file, 'v2');
    svc.commit(file, 'v2');
    const id = svc.getHistory(file).match(/ver_\w+/)?.[0] || '';
    expect(svc.revert(file, id)).toContain('Reverted');
  });

  it('shows diff', () => {
    const file = path.join(dir, 'test.txt');
    fs.writeFileSync(file, 'v1');
    svc.commit(file, 'v1');
    fs.writeFileSync(file, 'v2');
    svc.commit(file, 'v2');
    const ids = svc.getHistory(file).match(/ver_\w+/g) || [];
    expect(svc.diff(ids[0], ids[1])).toContain('Additions');
  });

  it('tags version', () => {
    const file = path.join(dir, 'test.txt');
    fs.writeFileSync(file, 'hello');
    svc.commit(file, 'v1');
    const id = svc.getHistory(file).match(/ver_\w+/)?.[0] || '';
    expect(svc.tag(id, 'stable')).toContain('Tagged');
  });

  it('lists files', () => {
    const file = path.join(dir, 'test.txt');
    fs.writeFileSync(file, 'hello');
    svc.commit(file, 'v1');
    expect(svc.listFiles()).toContain('test.txt');
  });

  it('gets stats', () => {
    const file = path.join(dir, 'test.txt');
    fs.writeFileSync(file, 'hello');
    svc.commit(file, 'v1');
    expect(svc.getStats()).toContain('Tracked files: 1');
  });

  it('returns error for non-existent file', () => { expect(svc.commit('/nonexistent', 'test')).toContain('Error'); });
  it('returns error for non-existent history', () => { expect(svc.getHistory('/nonexistent')).toContain('No version'); });
});
