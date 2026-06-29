import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { AccessControlService } from '../../src/security/AccessControlService.js';

describe('AccessControlService', () => {
  let tmpDir: string;
  let service: AccessControlService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acl-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('RBAC-only mode', () => {
    beforeEach(() => {
      service = new AccessControlService(tmpDir, { enforceMode: 'rbac_only' });
    });

    it('should allow access when RBAC grants permission', () => {
      service.createRole({ id: 'admin', name: 'Admin', description: '', permissions: [] });
      service.createPermission({
        id: 'read_file',
        name: 'Read File',
        description: '',
        resource: 'file',
        action: 'read',
      });
      service.getRbacEngine().assignPermissionToRole('admin', 'read_file');
      service.getRbacEngine().assignRoleToUser('u1', 'admin');

      const decision = service.checkAccess({
        userId: 'u1',
        resource: 'file',
        action: 'read',
      });
      expect(decision.allowed).toBe(true);
      expect(decision.enforceMode).toBe('rbac_only');
      expect(decision.rbacResult).toBeDefined();
    });

    it('should deny access when RBAC denies permission', () => {
      service.createRole({ id: 'viewer', name: 'Viewer', description: '', permissions: [] });
      service.createPermission({
        id: 'read_file',
        name: 'Read File',
        description: '',
        resource: 'file',
        action: 'read',
      });
      service.getRbacEngine().assignPermissionToRole('viewer', 'read_file');
      service.getRbacEngine().assignRoleToUser('u1', 'viewer');

      const decision = service.checkAccess({
        userId: 'u1',
        resource: 'file',
        action: 'write',
      });
      expect(decision.allowed).toBe(false);
      expect(decision.enforceMode).toBe('rbac_only');
    });

    it('should deny user with no roles in RBAC mode', () => {
      const decision = service.checkAccess({
        userId: 'nobody',
        resource: 'file',
        action: 'read',
      });
      expect(decision.allowed).toBe(false);
    });
  });

  describe('ABAC-only mode', () => {
    beforeEach(() => {
      service = new AccessControlService(tmpDir, { enforceMode: 'abac_only' });
    });

    it('should allow access when ABAC policy grants', () => {
      service.createAbacPolicy({
        id: 'allow_admin',
        name: 'Allow Admin',
        description: '',
        resource: 'file',
        action: 'read',
        condition: { attribute: 'role', operator: 'equals', value: 'admin' },
        effect: 'ALLOW',
        priority: 10,
        enabled: true,
      });

      const decision = service.checkAccess({
        userId: 'u1',
        resource: 'file',
        action: 'read',
        attributes: { role: 'admin' },
      });
      expect(decision.allowed).toBe(true);
      expect(decision.enforceMode).toBe('abac_only');
      expect(decision.abacResult).toBeDefined();
    });

    it('should deny access when ABAC policy denies', () => {
      service.createAbacPolicy({
        id: 'deny_guest',
        name: 'Deny Guest',
        description: '',
        resource: 'file',
        action: 'read',
        condition: { attribute: 'role', operator: 'equals', value: 'guest' },
        effect: 'DENY',
        priority: 100,
        enabled: true,
      });
      service.createAbacPolicy({
        id: 'allow_all',
        name: 'Allow All',
        description: '',
        resource: '*',
        action: '*',
        condition: { attribute: 'active', operator: 'equals', value: true },
        effect: 'ALLOW',
        priority: 1,
        enabled: true,
      });

      const decision = service.checkAccess({
        userId: 'u1',
        resource: 'file',
        action: 'read',
        attributes: { role: 'guest', active: true },
      });
      expect(decision.allowed).toBe(false);
      expect(decision.enforceMode).toBe('abac_only');
    });

    it('should deny when no ABAC policies match', () => {
      const decision = service.checkAccess({
        userId: 'u1',
        resource: 'file',
        action: 'read',
        attributes: {},
      });
      expect(decision.allowed).toBe(false);
    });
  });

  describe('Combined RBAC+ABAC mode', () => {
    beforeEach(() => {
      service = new AccessControlService(tmpDir, {
        enforceMode: 'both',
        denyOverrides: true,
      });
    });

    it('should allow when both engines allow', () => {
      service.createRole({ id: 'admin', name: 'Admin', description: '', permissions: [] });
      service.createPermission({
        id: 'read_file',
        name: 'Read File',
        description: '',
        resource: 'file',
        action: 'read',
      });
      service.getRbacEngine().assignPermissionToRole('admin', 'read_file');
      service.getRbacEngine().assignRoleToUser('u1', 'admin');

      service.createAbacPolicy({
        id: 'allow_admin',
        name: 'Allow Admin',
        description: '',
        resource: 'file',
        action: 'read',
        condition: { attribute: 'role', operator: 'equals', value: 'admin' },
        effect: 'ALLOW',
        priority: 10,
        enabled: true,
      });

      const decision = service.checkAccess({
        userId: 'u1',
        resource: 'file',
        action: 'read',
        attributes: { role: 'admin' },
      });
      expect(decision.allowed).toBe(true);
      expect(decision.enforceMode).toBe('both');
      expect(decision.rbacResult).toBeDefined();
      expect(decision.abacResult).toBeDefined();
    });

    it('should deny when RBAC denies even if ABAC allows', () => {
      service.createRole({ id: 'viewer', name: 'Viewer', description: '', permissions: [] });
      service.createPermission({
        id: 'read_file',
        name: 'Read File',
        description: '',
        resource: 'file',
        action: 'read',
      });
      service.getRbacEngine().assignPermissionToRole('viewer', 'read_file');
      service.getRbacEngine().assignRoleToUser('u1', 'viewer');

      service.createAbacPolicy({
        id: 'allow_all',
        name: 'Allow All',
        description: '',
        resource: '*',
        action: '*',
        condition: { attribute: 'x', operator: 'equals', value: 1 },
        effect: 'ALLOW',
        priority: 1,
        enabled: true,
      });

      const decision = service.checkAccess({
        userId: 'u1',
        resource: 'file',
        action: 'write',
        attributes: { x: 1 },
      });
      expect(decision.allowed).toBe(false);
    });

    it('should deny when ABAC denies even if RBAC allows', () => {
      service.createRole({ id: 'admin', name: 'Admin', description: '', permissions: [] });
      service.createPermission({
        id: 'read_file',
        name: 'Read File',
        description: '',
        resource: 'file',
        action: 'read',
      });
      service.getRbacEngine().assignPermissionToRole('admin', 'read_file');
      service.getRbacEngine().assignRoleToUser('u1', 'admin');

      service.createAbacPolicy({
        id: 'deny_guest',
        name: 'Deny Guest',
        description: '',
        resource: '*',
        action: '*',
        condition: { attribute: 'role', operator: 'equals', value: 'guest' },
        effect: 'DENY',
        priority: 100,
        enabled: true,
      });

      const decision = service.checkAccess({
        userId: 'u1',
        resource: 'file',
        action: 'read',
        attributes: { role: 'guest' },
      });
      expect(decision.allowed).toBe(false);
    });

    it('should include both results in decision', () => {
      service.createRole({ id: 'admin', name: 'Admin', description: '', permissions: [] });
      service.createPermission({
        id: 'read_file',
        name: 'Read File',
        description: '',
        resource: 'file',
        action: 'read',
      });
      service.getRbacEngine().assignPermissionToRole('admin', 'read_file');
      service.getRbacEngine().assignRoleToUser('u1', 'admin');

      service.createAbacPolicy({
        id: 'allow_read',
        name: 'Allow Read',
        description: '',
        resource: 'file',
        action: 'read',
        condition: { attribute: 'x', operator: 'equals', value: 1 },
        effect: 'ALLOW',
        priority: 10,
        enabled: true,
      });

      const decision = service.checkAccess({
        userId: 'u1',
        resource: 'file',
        action: 'read',
        attributes: { x: 1 },
      });
      expect(decision.rbacResult!.allowed).toBe(true);
      expect(decision.abacResult!.allowed).toBe(true);
      expect(decision.evaluatedPolicies).toContain('allow_read');
    });
  });

  describe('Policy override rules', () => {
    beforeEach(() => {
      service = new AccessControlService(tmpDir, { enforceMode: 'both' });
    });

    it('should apply ALLOW override rule', () => {
      service.addOverrideRule({
        id: 'override_allow',
        resource: 'secret',
        action: 'read',
        effect: 'ALLOW',
        priority: 100,
        description: 'Emergency read access',
      });

      const decision = service.checkAccess({
        userId: 'nobody',
        resource: 'secret',
        action: 'read',
      });
      expect(decision.allowed).toBe(true);
      expect(decision.overrideApplied).toBe('override_allow');
    });

    it('should apply DENY override rule', () => {
      service.createRole({ id: 'admin', name: 'Admin', description: '', permissions: [] });
      service.createPermission({
        id: 'full_access',
        name: 'Full Access',
        description: '',
        resource: '*',
        action: '*',
      });
      service.getRbacEngine().assignPermissionToRole('admin', 'full_access');
      service.getRbacEngine().assignRoleToUser('u1', 'admin');

      service.addOverrideRule({
        id: 'override_deny',
        resource: 'critical',
        action: 'delete',
        effect: 'DENY',
        priority: 100,
        description: 'Block destructive ops',
      });

      const decision = service.checkAccess({
        userId: 'u1',
        resource: 'critical',
        action: 'delete',
      });
      expect(decision.allowed).toBe(false);
      expect(decision.overrideApplied).toBe('override_deny');
    });

    it('should use highest priority override', () => {
      service.addOverrideRule({
        id: 'low_override',
        resource: 'file',
        action: 'read',
        effect: 'DENY',
        priority: 1,
        description: 'Low priority deny',
      });
      service.addOverrideRule({
        id: 'high_override',
        resource: 'file',
        action: 'read',
        effect: 'ALLOW',
        priority: 100,
        description: 'High priority allow',
      });

      const decision = service.checkAccess({
        userId: 'u1',
        resource: 'file',
        action: 'read',
      });
      expect(decision.allowed).toBe(true);
      expect(decision.overrideApplied).toBe('high_override');
    });

    it('should respect wildcard resource in override', () => {
      service.addOverrideRule({
        id: 'wildcard_override',
        resource: '*',
        action: 'delete',
        effect: 'DENY',
        priority: 100,
        description: 'Block all deletes',
      });

      const decision = service.checkAccess({
        userId: 'u1',
        resource: 'anything',
        action: 'delete',
      });
      expect(decision.allowed).toBe(false);
    });

    it('should respect wildcard action in override', () => {
      service.addOverrideRule({
        id: 'wildcard_action',
        resource: 'admin',
        action: '*',
        effect: 'DENY',
        priority: 100,
        description: 'Block all admin actions',
      });

      const decision = service.checkAccess({
        userId: 'u1',
        resource: 'admin',
        action: 'read',
      });
      expect(decision.allowed).toBe(false);
    });

    it('should remove override rule', () => {
      service.addOverrideRule({
        id: 'temp_override',
        resource: 'file',
        action: 'read',
        effect: 'ALLOW',
        priority: 10,
        description: 'Temp',
      });
      service.removeOverrideRule('temp_override');
      expect(service.getOverrideRules()).toHaveLength(0);
    });

    it('should throw when removing nonexistent override', () => {
      expect(() => service.removeOverrideRule('nope')).toThrow(
        "Override rule with id 'nope' not found"
      );
    });

    it('should throw when adding duplicate override', () => {
      service.addOverrideRule({
        id: 'dup',
        resource: 'x',
        action: 'x',
        effect: 'ALLOW',
        priority: 1,
        description: '',
      });
      expect(() =>
        service.addOverrideRule({
          id: 'dup',
          resource: 'x',
          action: 'x',
          effect: 'ALLOW',
          priority: 1,
          description: '',
        })
      ).toThrow("Override rule with id 'dup' already exists");
    });
  });

  describe('Unified access check', () => {
    it('should return config correctly', () => {
      service = new AccessControlService(tmpDir, { enforceMode: 'both', denyOverrides: true });
      const config = service.getConfig();
      expect(config.enforceMode).toBe('both');
      expect(config.denyOverrides).toBe(true);
    });

    it('should update config', () => {
      service = new AccessControlService(tmpDir, { enforceMode: 'rbac_only' });
      service.updateConfig({ enforceMode: 'abac_only' });
      expect(service.getConfig().enforceMode).toBe('abac_only');
    });

    it('should save and load state', () => {
      service = new AccessControlService(tmpDir, { enforceMode: 'both' });
      service.createRole({ id: 'admin', name: 'Admin', description: '', permissions: [] });
      service.createPermission({
        id: 'read',
        name: 'Read',
        description: '',
        resource: 'file',
        action: 'read',
      });
      service.getRbacEngine().assignPermissionToRole('admin', 'read');
      service.getRbacEngine().assignRoleToUser('u1', 'admin');

      service.createAbacPolicy({
        id: 'abac_p',
        name: 'ABAC P',
        description: '',
        resource: 'file',
        action: 'read',
        condition: { attribute: 'x', operator: 'equals', value: 1 },
        effect: 'ALLOW',
        priority: 10,
        enabled: true,
      });

      service.addOverrideRule({
        id: 'ov1',
        resource: 'backup',
        action: 'delete',
        effect: 'DENY',
        priority: 100,
        description: 'Block backup deletes',
      });

      service.save();

      const loaded = new AccessControlService(tmpDir);
      loaded.load();

      expect(loaded.getConfig().enforceMode).toBe('both');
      expect(loaded.getRbacEngine().getRole('admin')).toBeDefined();
      expect(loaded.getAbacEngine().getPolicy('abac_p')).toBeDefined();
      expect(loaded.getOverrideRules()).toHaveLength(1);

      const decision = loaded.checkAccess({
        userId: 'u1',
        resource: 'file',
        action: 'read',
        attributes: { x: 1 },
      });
      expect(decision.allowed).toBe(true);
    });

    it('should expose rbac and abac engines', () => {
      service = new AccessControlService(tmpDir);
      expect(service.getRbacEngine()).toBeDefined();
      expect(service.getAbacEngine()).toBeDefined();
    });

    it('should create roles and permissions via service', () => {
      service = new AccessControlService(tmpDir);
      service.createRole({ id: 'editor', name: 'Editor', description: '', permissions: [] });
      service.createPermission({
        id: 'write',
        name: 'Write',
        description: '',
        resource: 'file',
        action: 'write',
      });
      expect(service.getRbacEngine().getRole('editor')).toBeDefined();
      expect(service.getRbacEngine().getPermission('write')).toBeDefined();
    });

    it('should create abac policies and attributes via service', () => {
      service = new AccessControlService(tmpDir);
      service.createAbacPolicy({
        id: 'p1',
        name: 'Policy 1',
        description: '',
        resource: '*',
        action: '*',
        condition: { attribute: 'x', operator: 'equals', value: 1 },
        effect: 'ALLOW',
        priority: 1,
        enabled: true,
      });
      service.createAttributeDefinition({
        id: 'a1',
        name: 'Attr1',
        type: 'string',
        description: '',
      });
      expect(service.getAbacEngine().getPolicy('p1')).toBeDefined();
      expect(service.getAbacEngine().getAttributeDefinition('a1')).toBeDefined();
    });
  });
});
