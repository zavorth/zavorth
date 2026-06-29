import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { RbacEngine } from '../../src/security/RbacEngine.js';

describe('RbacEngine', () => {
  let engine: RbacEngine;

  beforeEach(() => {
    engine = new RbacEngine();
  });

  describe('Role CRUD operations', () => {
    it('should create a role', () => {
      engine.createRole({
        id: 'admin',
        name: 'Administrator',
        description: 'Full system access',
        permissions: [],
      });
      const role = engine.getRole('admin');
      expect(role).toBeDefined();
      expect(role!.id).toBe('admin');
      expect(role!.name).toBe('Administrator');
    });

    it('should throw when creating a role with duplicate id', () => {
      engine.createRole({
        id: 'admin',
        name: 'Administrator',
        description: 'Full access',
        permissions: [],
      });
      expect(() =>
        engine.createRole({
          id: 'admin',
          name: 'Admin 2',
          description: 'Duplicate',
          permissions: [],
        })
      ).toThrow("Role with id 'admin' already exists");
    });

    it('should throw when creating a role with nonexistent parent', () => {
      expect(() =>
        engine.createRole({
          id: 'child',
          name: 'Child',
          description: 'With parent',
          parentRoleId: 'nonexistent',
          permissions: [],
        })
      ).toThrow("Parent role 'nonexistent' does not exist");
    });

    it('should get a role by id', () => {
      engine.createRole({
        id: 'viewer',
        name: 'Viewer',
        description: 'Read-only',
        permissions: [],
      });
      const role = engine.getRole('viewer');
      expect(role).toBeDefined();
      expect(role!.name).toBe('Viewer');
    });

    it('should return undefined for nonexistent role', () => {
      expect(engine.getRole('nonexistent')).toBeUndefined();
    });

    it('should update a role', () => {
      engine.createRole({
        id: 'editor',
        name: 'Editor',
        description: 'Basic editor',
        permissions: [],
      });
      engine.updateRole('editor', { name: 'Senior Editor', description: 'Senior editor' });
      const role = engine.getRole('editor');
      expect(role!.name).toBe('Senior Editor');
      expect(role!.description).toBe('Senior editor');
    });

    it('should throw when updating nonexistent role', () => {
      expect(() => engine.updateRole('nonexistent', { name: 'X' })).toThrow(
        "Role with id 'nonexistent' not found"
      );
    });

    it('should throw when setting role as its own parent', () => {
      engine.createRole({
        id: 'self',
        name: 'Self',
        description: 'Self-ref',
        permissions: [],
      });
      expect(() => engine.updateRole('self', { parentRoleId: 'self' })).toThrow(
        'Role cannot be its own parent'
      );
    });

    it('should delete a role', () => {
      engine.createRole({
        id: 'temp',
        name: 'Temporary',
        description: 'Temp role',
        permissions: [],
      });
      engine.deleteRole('temp');
      expect(engine.getRole('temp')).toBeUndefined();
    });

    it('should throw when deleting nonexistent role', () => {
      expect(() => engine.deleteRole('ghost')).toThrow("Role with id 'ghost' not found");
    });

    it('should list all roles', () => {
      engine.createRole({ id: 'a', name: 'A', description: '', permissions: [] });
      engine.createRole({ id: 'b', name: 'B', description: '', permissions: [] });
      const roles = engine.listRoles();
      expect(roles).toHaveLength(2);
      expect(roles.map((r) => r.id)).toContain('a');
      expect(roles.map((r) => r.id)).toContain('b');
    });
  });

  describe('Permission CRUD operations', () => {
    it('should create a permission', () => {
      engine.createPermission({
        id: 'read_files',
        name: 'Read Files',
        description: 'Read file resources',
        resource: 'file',
        action: 'read',
      });
      const perm = engine.getPermission('read_files');
      expect(perm).toBeDefined();
      expect(perm!.resource).toBe('file');
      expect(perm!.action).toBe('read');
    });

    it('should throw when creating duplicate permission', () => {
      engine.createPermission({
        id: 'read',
        name: 'Read',
        description: '',
        resource: '*',
        action: 'read',
      });
      expect(() =>
        engine.createPermission({
          id: 'read',
          name: 'Read 2',
          description: '',
          resource: '*',
          action: 'read',
        })
      ).toThrow("Permission with id 'read' already exists");
    });

    it('should update a permission', () => {
      engine.createPermission({
        id: 'write',
        name: 'Write',
        description: 'Write access',
        resource: 'file',
        action: 'write',
      });
      engine.updatePermission('write', { description: 'Write files' });
      const perm = engine.getPermission('write');
      expect(perm!.description).toBe('Write files');
    });

    it('should throw when updating nonexistent permission', () => {
      expect(() => engine.updatePermission('nonexistent', { name: 'X' })).toThrow(
        "Permission with id 'nonexistent' not found"
      );
    });

    it('should delete a permission', () => {
      engine.createPermission({
        id: 'temp_perm',
        name: 'Temp',
        description: '',
        resource: '*',
        action: '*',
      });
      engine.deletePermission('temp_perm');
      expect(engine.getPermission('temp_perm')).toBeUndefined();
    });

    it('should throw when deleting nonexistent permission', () => {
      expect(() => engine.deletePermission('ghost_perm')).toThrow(
        "Permission with id 'ghost_perm' not found"
      );
    });

    it('should list all permissions', () => {
      engine.createPermission({
        id: 'p1',
        name: 'P1',
        description: '',
        resource: '*',
        action: '*',
      });
      engine.createPermission({
        id: 'p2',
        name: 'P2',
        description: '',
        resource: '*',
        action: '*',
      });
      const perms = engine.listPermissions();
      expect(perms).toHaveLength(2);
    });
  });

  describe('Role-Permission assignment', () => {
    it('should assign permission to role', () => {
      engine.createRole({ id: 'admin', name: 'Admin', description: '', permissions: [] });
      engine.createPermission({
        id: 'manage',
        name: 'Manage',
        description: '',
        resource: '*',
        action: '*',
      });
      engine.assignPermissionToRole('admin', 'manage');
      const role = engine.getRole('admin');
      expect(role!.permissions).toContain('manage');
    });

    it('should throw when assigning to nonexistent role', () => {
      engine.createPermission({
        id: 'x',
        name: 'X',
        description: '',
        resource: '*',
        action: '*',
      });
      expect(() => engine.assignPermissionToRole('ghost', 'x')).toThrow(
        "Role with id 'ghost' not found"
      );
    });

    it('should throw when assigning nonexistent permission', () => {
      engine.createRole({ id: 'a', name: 'A', description: '', permissions: [] });
      expect(() => engine.assignPermissionToRole('a', 'ghost_perm')).toThrow(
        "Permission with id 'ghost_perm' not found"
      );
    });

    it('should not duplicate permission assignment', () => {
      engine.createRole({ id: 'a', name: 'A', description: '', permissions: [] });
      engine.createPermission({
        id: 'p',
        name: 'P',
        description: '',
        resource: '*',
        action: '*',
      });
      engine.assignPermissionToRole('a', 'p');
      engine.assignPermissionToRole('a', 'p');
      const role = engine.getRole('a');
      expect(role!.permissions.filter((p) => p === 'p')).toHaveLength(1);
    });

    it('should remove permission from role', () => {
      engine.createRole({ id: 'a', name: 'A', description: '', permissions: [] });
      engine.createPermission({
        id: 'p',
        name: 'P',
        description: '',
        resource: '*',
        action: '*',
      });
      engine.assignPermissionToRole('a', 'p');
      engine.removePermissionFromRole('a', 'p');
      const role = engine.getRole('a');
      expect(role!.permissions).not.toContain('p');
    });
  });

  describe('User-Role assignment', () => {
    it('should assign role to user', () => {
      engine.createRole({ id: 'admin', name: 'Admin', description: '', permissions: [] });
      engine.assignRoleToUser('user1', 'admin');
      const roles = engine.getUserRoles('user1');
      expect(roles).toHaveLength(1);
      expect(roles[0].id).toBe('admin');
    });

    it('should throw when assigning nonexistent role to user', () => {
      expect(() => engine.assignRoleToUser('user1', 'ghost')).toThrow(
        "Role with id 'ghost' not found"
      );
    });

    it('should throw when assigning same role twice', () => {
      engine.createRole({ id: 'a', name: 'A', description: '', permissions: [] });
      engine.assignRoleToUser('u1', 'a');
      expect(() => engine.assignRoleToUser('u1', 'a')).toThrow(
        "User 'u1' already has role 'a'"
      );
    });

    it('should remove role from user', () => {
      engine.createRole({ id: 'a', name: 'A', description: '', permissions: [] });
      engine.assignRoleToUser('u1', 'a');
      engine.removeRoleFromUser('u1', 'a');
      const roles = engine.getUserRoles('u1');
      expect(roles).toHaveLength(0);
    });

    it('should throw when removing role from user with no assignments', () => {
      expect(() => engine.removeRoleFromUser('nobody', 'ghost')).toThrow(
        "User 'nobody' has no role assignments"
      );
    });

    it('should return empty array for user with no roles', () => {
      expect(engine.getUserRoles('nobody')).toHaveLength(0);
    });
  });

  describe('Effective permissions computation', () => {
    it('should compute effective permissions from direct role', () => {
      engine.createRole({ id: 'r1', name: 'R1', description: '', permissions: [] });
      engine.createPermission({
        id: 'p1',
        name: 'P1',
        description: '',
        resource: '*',
        action: 'read',
      });
      engine.assignPermissionToRole('r1', 'p1');
      engine.assignRoleToUser('u1', 'r1');
      const perms = engine.getEffectivePermissions('u1');
      expect(perms).toContain('p1');
    });

    it('should compute effective permissions with parent role inheritance', () => {
      engine.createRole({ id: 'base', name: 'Base', description: '', permissions: [] });
      engine.createRole({
        id: 'child',
        name: 'Child',
        description: '',
        parentRoleId: 'base',
        permissions: [],
      });
      engine.createPermission({
        id: 'base_perm',
        name: 'BasePerm',
        description: '',
        resource: '*',
        action: 'read',
      });
      engine.createPermission({
        id: 'child_perm',
        name: 'ChildPerm',
        description: '',
        resource: '*',
        action: 'write',
      });
      engine.assignPermissionToRole('base', 'base_perm');
      engine.assignPermissionToRole('child', 'child_perm');
      engine.assignRoleToUser('u1', 'child');
      const perms = engine.getEffectivePermissions('u1');
      expect(perms).toContain('base_perm');
      expect(perms).toContain('child_perm');
    });

    it('should handle circular parent references gracefully', () => {
      engine.createRole({
        id: 'a',
        name: 'A',
        description: '',
        permissions: [],
      });
      engine.createRole({
        id: 'b',
        name: 'B',
        description: '',
        parentRoleId: 'a',
        permissions: [],
      });
      engine.updateRole('a', { parentRoleId: 'b' });
      engine.createPermission({
        id: 'p',
        name: 'P',
        description: '',
        resource: '*',
        action: '*',
      });
      engine.assignPermissionToRole('a', 'p');
      engine.assignRoleToUser('u1', 'a');
      const perms = engine.getEffectivePermissions('u1');
      expect(perms).toContain('p');
    });
  });

  describe('Hierarchical role inheritance', () => {
    it('should inherit permissions through multi-level hierarchy', () => {
      engine.createRole({ id: 'grandparent', name: 'GP', description: '', permissions: [] });
      engine.createRole({
        id: 'parent',
        name: 'P',
        description: '',
        parentRoleId: 'grandparent',
        permissions: [],
      });
      engine.createRole({
        id: 'child',
        name: 'C',
        description: '',
        parentRoleId: 'parent',
        permissions: [],
      });
      engine.createPermission({
        id: 'gp_perm',
        name: 'GPP',
        description: '',
        resource: '*',
        action: 'admin',
      });
      engine.createPermission({
        id: 'p_perm',
        name: 'PP',
        description: '',
        resource: '*',
        action: 'write',
      });
      engine.createPermission({
        id: 'c_perm',
        name: 'CP',
        description: '',
        resource: '*',
        action: 'read',
      });
      engine.assignPermissionToRole('grandparent', 'gp_perm');
      engine.assignPermissionToRole('parent', 'p_perm');
      engine.assignPermissionToRole('child', 'c_perm');
      engine.assignRoleToUser('u1', 'child');
      const perms = engine.getEffectivePermissions('u1');
      expect(perms).toContain('gp_perm');
      expect(perms).toContain('p_perm');
      expect(perms).toContain('c_perm');
    });
  });

  describe('Access check (allowed/denied)', () => {
    it('should allow access when user has matching permission', () => {
      engine.createRole({ id: 'admin', name: 'Admin', description: '', permissions: [] });
      engine.createPermission({
        id: 'read_file',
        name: 'Read File',
        description: '',
        resource: 'file',
        action: 'read',
      });
      engine.assignPermissionToRole('admin', 'read_file');
      engine.assignRoleToUser('u1', 'admin');
      const result = engine.checkAccess({
        userId: 'u1',
        resource: 'file',
        action: 'read',
      });
      expect(result.allowed).toBe(true);
    });

    it('should deny access when user has no matching permission', () => {
      engine.createRole({ id: 'viewer', name: 'Viewer', description: '', permissions: [] });
      engine.createPermission({
        id: 'read_file',
        name: 'Read File',
        description: '',
        resource: 'file',
        action: 'read',
      });
      engine.assignPermissionToRole('viewer', 'read_file');
      engine.assignRoleToUser('u1', 'viewer');
      const result = engine.checkAccess({
        userId: 'u1',
        resource: 'file',
        action: 'write',
      });
      expect(result.allowed).toBe(false);
    });

    it('should deny access when user has no roles', () => {
      const result = engine.checkAccess({
        userId: 'nobody',
        resource: 'file',
        action: 'read',
      });
      expect(result.allowed).toBe(false);
      expect(result.deniedBy).toBe('RBAC_NO_ROLES');
    });

    it('should deny access when no permission matches', () => {
      engine.createRole({ id: 'r', name: 'R', description: '', permissions: [] });
      engine.assignRoleToUser('u1', 'r');
      const result = engine.checkAccess({
        userId: 'u1',
        resource: 'file',
        action: 'delete',
      });
      expect(result.allowed).toBe(false);
      expect(result.deniedBy).toBe('RBAC_NO_MATCH');
    });
  });

  describe('Persistence (save/load)', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rbac-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should save and load state correctly', () => {
      engine.createRole({
        id: 'admin',
        name: 'Admin',
        description: 'Admin role',
        permissions: [],
      });
      engine.createPermission({
        id: 'read',
        name: 'Read',
        description: '',
        resource: 'file',
        action: 'read',
      });
      engine.assignPermissionToRole('admin', 'read');
      engine.assignRoleToUser('u1', 'admin');

      const filePath = path.join(tmpDir, 'rbac.json');
      engine.save(filePath);

      const newEngine = new RbacEngine();
      newEngine.load(filePath);

      expect(newEngine.getRole('admin')).toBeDefined();
      expect(newEngine.getPermission('read')).toBeDefined();
      expect(newEngine.getUserRoles('u1')).toHaveLength(1);
      const result = newEngine.checkAccess({
        userId: 'u1',
        resource: 'file',
        action: 'read',
      });
      expect(result.allowed).toBe(true);
    });

    it('should throw when loading nonexistent file', () => {
      expect(() => engine.load(path.join(tmpDir, 'nope.json'))).toThrow('not found');
    });
  });
});
