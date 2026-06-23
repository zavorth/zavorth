import fs from 'fs';
import os from 'os';
import path from 'path';
import { MultiUserService } from '../../src/services/plugins/MultiUserService';
import { SharedWorkspaceService } from '../../src/services/plugins/SharedWorkspaceService';
import { RoleBasedAccessService } from '../../src/services/plugins/RoleBasedAccessService';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'collab-'));

describe('MultiUserService', () => {
  let svc: MultiUserService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new MultiUserService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('adds a user', () => { expect(svc.addUser('Alice', 'alice@test.com')).toContain('added'); });
  it('lists users', () => { svc.addUser('Alice', 'alice@test.com'); expect(svc.listUsers()).toContain('Alice'); });
  it('removes a user', () => { const id = svc.addUser('Bob', 'bob@test.com').match(/user_\w+/)?.[0] || ''; expect(svc.removeUser(id)).toContain('removed'); });
  it('updates a user', () => { const id = svc.addUser('Carol', 'carol@test.com').match(/user_\w+/)?.[0] || ''; expect(svc.updateUser(id, { name: 'Carol Updated' })).toContain('updated'); });
  it('checks permissions', () => { const id = svc.addUser('Dave', 'dave@test.com', 'admin').match(/user_\w+/)?.[0] || ''; expect(svc.hasPermission(id, 'read')).toBe(true); });
  it('gets stats', () => { svc.addUser('Eve', 'eve@test.com'); expect(svc.getStats()).toContain('Total users: 1'); });
});

describe('SharedWorkspaceService', () => {
  let svc: SharedWorkspaceService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new SharedWorkspaceService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates workspace', () => { expect(svc.createWorkspace('Test', 'desc', 'user1')).toContain('created'); });
  it('lists workspaces', () => { svc.createWorkspace('Test', 'desc', 'user1'); expect(svc.listWorkspaces()).toContain('Test'); });
  it('adds member', () => { const id = svc.createWorkspace('Test', 'desc', 'user1').match(/ws_\w+/)?.[0] || ''; expect(svc.addMember(id, 'user2')).toContain('added'); });
  it('removes member', () => { const id = svc.createWorkspace('Test', 'desc', 'user1').match(/ws_\w+/)?.[0] || ''; svc.addMember(id, 'user2'); expect(svc.removeMember(id, 'user2')).toContain('removed'); });
  it('checks membership', () => { const id = svc.createWorkspace('Test', 'desc', 'user1').match(/ws_\w+/)?.[0] || ''; expect(svc.isMember(id, 'user1')).toBe(true); });
  it('gets stats', () => { svc.createWorkspace('Test', 'desc', 'user1'); expect(svc.getStats()).toContain('Workspaces: 1'); });
});

describe('RoleBasedAccessService', () => {
  let svc: RoleBasedAccessService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new RoleBasedAccessService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('has default roles', () => { expect(svc.listRoles()).toContain('owner'); });
  it('creates custom role', () => { expect(svc.createRole('Editor', 'Can edit', ['read', 'write'])).toContain('created'); });
  it('adds policy', () => { expect(svc.addPolicy('files', 'read', ['viewer'])).toContain('Policy created'); });
  it('checks access for owner', () => { expect(svc.checkAccess('owner', 'anything', 'do_something')).toBe(true); });
  it('checks access for viewer', () => { expect(svc.checkAccess('viewer', 'files', 'write')).toBe(false); });
  it('checks access with policy', () => { svc.addPolicy('files', 'export', ['viewer']); expect(svc.checkAccess('viewer', 'files', 'export')).toBe(true); });
  it('gets stats', () => { expect(svc.getStats()).toContain('Roles: 4'); });
});
