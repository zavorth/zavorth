import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { AbacEngine } from '../../src/security/AbacEngine.js';

describe('AbacEngine', () => {
  let engine: AbacEngine;

  beforeEach(() => {
    engine = new AbacEngine();
  });

  describe('Policy CRUD operations', () => {
    it('should create a policy', () => {
      engine.createPolicy({
        id: 'p1',
        name: 'Read Policy',
        description: 'Allow read access',
        resource: 'file',
        action: 'read',
        condition: { attribute: 'role', operator: 'equals', value: 'admin' },
        effect: 'ALLOW',
        priority: 1,
        enabled: true,
      });
      const policy = engine.getPolicy('p1');
      expect(policy).toBeDefined();
      expect(policy!.name).toBe('Read Policy');
    });

    it('should throw when creating duplicate policy', () => {
      engine.createPolicy({
        id: 'dup',
        name: 'Dup',
        description: '',
        resource: '*',
        action: '*',
        condition: { attribute: 'x', operator: 'equals', value: 1 },
        effect: 'ALLOW',
        priority: 1,
        enabled: true,
      });
      expect(() =>
        engine.createPolicy({
          id: 'dup',
          name: 'Dup 2',
          description: '',
          resource: '*',
          action: '*',
          condition: { attribute: 'x', operator: 'equals', value: 1 },
          effect: 'ALLOW',
          priority: 1,
          enabled: true,
        })
      ).toThrow("Policy with id 'dup' already exists");
    });

    it('should update a policy', () => {
      engine.createPolicy({
        id: 'p1',
        name: 'Original',
        description: '',
        resource: '*',
        action: '*',
        condition: { attribute: 'x', operator: 'equals', value: 1 },
        effect: 'ALLOW',
        priority: 1,
        enabled: true,
      });
      engine.updatePolicy('p1', { name: 'Updated', priority: 10 });
      const policy = engine.getPolicy('p1');
      expect(policy!.name).toBe('Updated');
      expect(policy!.priority).toBe(10);
    });

    it('should throw when updating nonexistent policy', () => {
      expect(() => engine.updatePolicy('nope', { name: 'X' })).toThrow(
        "Policy with id 'nope' not found"
      );
    });

    it('should delete a policy', () => {
      engine.createPolicy({
        id: 'del',
        name: 'Delete me',
        description: '',
        resource: '*',
        action: '*',
        condition: { attribute: 'x', operator: 'equals', value: 1 },
        effect: 'ALLOW',
        priority: 1,
        enabled: true,
      });
      engine.deletePolicy('del');
      expect(engine.getPolicy('del')).toBeUndefined();
    });

    it('should throw when deleting nonexistent policy', () => {
      expect(() => engine.deletePolicy('ghost')).toThrow("Policy with id 'ghost' not found");
    });

    it('should list all policies', () => {
      engine.createPolicy({
        id: 'a',
        name: 'A',
        description: '',
        resource: '*',
        action: '*',
        condition: { attribute: 'x', operator: 'equals', value: 1 },
        effect: 'ALLOW',
        priority: 1,
        enabled: true,
      });
      engine.createPolicy({
        id: 'b',
        name: 'B',
        description: '',
        resource: '*',
        action: '*',
        condition: { attribute: 'x', operator: 'equals', value: 2 },
        effect: 'DENY',
        priority: 2,
        enabled: true,
      });
      expect(engine.listPolicies()).toHaveLength(2);
    });
  });

  describe('Simple condition evaluation', () => {
    it('should evaluate equals operator', () => {
      const condition = { attribute: 'role', operator: 'equals' as const, value: 'admin' };
      expect(engine.evaluateCondition(condition, { role: 'admin' })).toBe(true);
      expect(engine.evaluateCondition(condition, { role: 'user' })).toBe(false);
    });

    it('should evaluate not_equals operator', () => {
      const condition = { attribute: 'role', operator: 'not_equals' as const, value: 'guest' };
      expect(engine.evaluateCondition(condition, { role: 'admin' })).toBe(true);
      expect(engine.evaluateCondition(condition, { role: 'guest' })).toBe(false);
    });

    it('should evaluate contains operator', () => {
      const condition = {
        attribute: 'department',
        operator: 'contains' as const,
        value: 'eng',
      };
      expect(engine.evaluateCondition(condition, { department: 'engineering' })).toBe(true);
      expect(engine.evaluateCondition(condition, { department: 'marketing' })).toBe(false);
    });

    it('should evaluate not_contains operator', () => {
      const condition = {
        attribute: 'name',
        operator: 'not_contains' as const,
        value: 'test',
      };
      expect(engine.evaluateCondition(condition, { name: 'production' })).toBe(true);
      expect(engine.evaluateCondition(condition, { name: 'test-user' })).toBe(false);
    });

    it('should evaluate starts_with operator', () => {
      const condition = {
        attribute: 'path',
        operator: 'starts_with' as const,
        value: '/api',
      };
      expect(engine.evaluateCondition(condition, { path: '/api/users' })).toBe(true);
      expect(engine.evaluateCondition(condition, { path: '/web/home' })).toBe(false);
    });

    it('should evaluate ends_with operator', () => {
      const condition = {
        attribute: 'file',
        operator: 'ends_with' as const,
        value: '.ts',
      };
      expect(engine.evaluateCondition(condition, { file: 'index.ts' })).toBe(true);
      expect(engine.evaluateCondition(condition, { file: 'index.js' })).toBe(false);
    });

    it('should evaluate greater_than operator', () => {
      const condition = {
        attribute: 'level',
        operator: 'greater_than' as const,
        value: 5,
      };
      expect(engine.evaluateCondition(condition, { level: 10 })).toBe(true);
      expect(engine.evaluateCondition(condition, { level: 3 })).toBe(false);
    });

    it('should evaluate less_than operator', () => {
      const condition = {
        attribute: 'score',
        operator: 'less_than' as const,
        value: 100,
      };
      expect(engine.evaluateCondition(condition, { score: 50 })).toBe(true);
      expect(engine.evaluateCondition(condition, { score: 150 })).toBe(false);
    });

    it('should evaluate greater_or_equal operator', () => {
      const condition = {
        attribute: 'val',
        operator: 'greater_or_equal' as const,
        value: 5,
      };
      expect(engine.evaluateCondition(condition, { val: 5 })).toBe(true);
      expect(engine.evaluateCondition(condition, { val: 4 })).toBe(false);
    });

    it('should evaluate less_or_equal operator', () => {
      const condition = {
        attribute: 'val',
        operator: 'less_or_equal' as const,
        value: 10,
      };
      expect(engine.evaluateCondition(condition, { val: 10 })).toBe(true);
      expect(engine.evaluateCondition(condition, { val: 11 })).toBe(false);
    });

    it('should evaluate in operator', () => {
      const condition = {
        attribute: 'color',
        operator: 'in' as const,
        value: ['red', 'blue', 'green'],
      };
      expect(engine.evaluateCondition(condition, { color: 'red' })).toBe(true);
      expect(engine.evaluateCondition(condition, { color: 'yellow' })).toBe(false);
    });

    it('should evaluate not_in operator', () => {
      const condition = {
        attribute: 'color',
        operator: 'not_in' as const,
        value: ['red', 'blue'],
      };
      expect(engine.evaluateCondition(condition, { color: 'green' })).toBe(true);
      expect(engine.evaluateCondition(condition, { color: 'red' })).toBe(false);
    });

    it('should evaluate matches operator', () => {
      const condition = {
        attribute: 'email',
        operator: 'matches' as const,
        value: '.*@example\\.com$',
      };
      expect(engine.evaluateCondition(condition, { email: 'user@example.com' })).toBe(true);
      expect(engine.evaluateCondition(condition, { email: 'user@other.com' })).toBe(false);
    });
  });

  describe('Complex logic (AND, OR, NOT)', () => {
    it('should evaluate AND logic group', () => {
      const group = {
        logic: 'AND' as const,
        conditions: [
          { attribute: 'role', operator: 'equals' as const, value: 'admin' },
          { attribute: 'active', operator: 'equals' as const, value: true },
        ],
      };
      expect(engine.evaluateCondition(group, { role: 'admin', active: true })).toBe(true);
      expect(engine.evaluateCondition(group, { role: 'admin', active: false })).toBe(false);
      expect(engine.evaluateCondition(group, { role: 'user', active: true })).toBe(false);
    });

    it('should evaluate OR logic group', () => {
      const group = {
        logic: 'OR' as const,
        conditions: [
          { attribute: 'role', operator: 'equals' as const, value: 'admin' },
          { attribute: 'role', operator: 'equals' as const, value: 'superadmin' },
        ],
      };
      expect(engine.evaluateCondition(group, { role: 'admin' })).toBe(true);
      expect(engine.evaluateCondition(group, { role: 'superadmin' })).toBe(true);
      expect(engine.evaluateCondition(group, { role: 'user' })).toBe(false);
    });

    it('should evaluate NOT logic group', () => {
      const group = {
        logic: 'NOT' as const,
        conditions: [{ attribute: 'banned', operator: 'equals' as const, value: true }],
      };
      expect(engine.evaluateCondition(group, { banned: true })).toBe(false);
      expect(engine.evaluateCondition(group, { banned: false })).toBe(true);
    });

    it('should evaluate nested logic groups', () => {
      const group = {
        logic: 'AND' as const,
        conditions: [
          { attribute: 'role', operator: 'equals' as const, value: 'admin' },
          {
            logic: 'OR' as const,
            conditions: [
              { attribute: 'dept', operator: 'equals' as const, value: 'eng' },
              { attribute: 'dept', operator: 'equals' as const, value: 'sec' },
            ],
          },
        ],
      };
      expect(engine.evaluateCondition(group, { role: 'admin', dept: 'eng' })).toBe(true);
      expect(engine.evaluateCondition(group, { role: 'admin', dept: 'sec' })).toBe(true);
      expect(engine.evaluateCondition(group, { role: 'admin', dept: 'hr' })).toBe(false);
      expect(engine.evaluateCondition(group, { role: 'user', dept: 'eng' })).toBe(false);
    });

    it('should evaluate NOT with nested AND', () => {
      const group = {
        logic: 'NOT' as const,
        conditions: [
          {
            logic: 'AND' as const,
            conditions: [
              { attribute: 'role', operator: 'equals' as const, value: 'admin' },
              { attribute: 'active', operator: 'equals' as const, value: true },
            ],
          },
        ],
      };
      expect(engine.evaluateCondition(group, { role: 'admin', active: true })).toBe(false);
      expect(engine.evaluateCondition(group, { role: 'admin', active: false })).toBe(true);
    });
  });

  describe('Priority-based conflict resolution', () => {
    it('should use highest priority allow policy when multiple match', () => {
      engine.createPolicy({
        id: 'low',
        name: 'Low Priority Allow',
        description: '',
        resource: 'file',
        action: 'read',
        condition: { attribute: 'x', operator: 'equals' as const, value: 1 },
        effect: 'ALLOW',
        priority: 1,
        enabled: true,
      });
      engine.createPolicy({
        id: 'high',
        name: 'High Priority Allow',
        description: '',
        resource: 'file',
        action: 'read',
        condition: { attribute: 'x', operator: 'equals' as const, value: 1 },
        effect: 'ALLOW',
        priority: 100,
        enabled: true,
      });

      const result = engine.evaluate({
        userId: 'u1',
        resource: 'file',
        action: 'read',
        attributes: { x: 1 },
      });
      expect(result.allowed).toBe(true);
      expect(result.matchedPolicy).toBe('high');
    });

    it('should deny when highest priority policy is DENY', () => {
      engine.createPolicy({
        id: 'allow_low',
        name: 'Allow Low',
        description: '',
        resource: 'file',
        action: 'read',
        condition: { attribute: 'x', operator: 'equals' as const, value: 1 },
        effect: 'ALLOW',
        priority: 1,
        enabled: true,
      });
      engine.createPolicy({
        id: 'deny_high',
        name: 'Deny High',
        description: '',
        resource: 'file',
        action: 'read',
        condition: { attribute: 'x', operator: 'equals' as const, value: 1 },
        effect: 'DENY',
        priority: 100,
        enabled: true,
      });

      const result = engine.evaluate({
        userId: 'u1',
        resource: 'file',
        action: 'read',
        attributes: { x: 1 },
      });
      expect(result.allowed).toBe(false);
      expect(result.deniedBy).toBe('deny_high');
    });
  });

  describe('Time-based conditions', () => {
    it('should deny policy outside time window', () => {
      engine.createPolicy({
        id: 'time_policy',
        name: 'Business Hours',
        description: '',
        resource: 'file',
        action: 'read',
        condition: { attribute: 'x', operator: 'equals' as const, value: 1 },
        effect: 'ALLOW',
        priority: 1,
        enabled: true,
        timeConstraints: {
          notBefore: '2025-01-01T09:00:00Z',
          notAfter: '2025-01-01T17:00:00Z',
        },
      });

      const outsideTime = engine.evaluate({
        userId: 'u1',
        resource: 'file',
        action: 'read',
        attributes: { x: 1 },
        timestamp: new Date('2025-01-01T20:00:00Z'),
      });
      expect(outsideTime.allowed).toBe(false);
      expect(outsideTime.deniedBy).toBe('ABAC_NO_MATCH');

      const insideTime = engine.evaluate({
        userId: 'u1',
        resource: 'file',
        action: 'read',
        attributes: { x: 1 },
        timestamp: new Date('2025-01-01T12:00:00Z'),
      });
      expect(insideTime.allowed).toBe(true);
    });

    it('should deny policy on wrong day of week', () => {
      engine.createPolicy({
        id: 'weekday_policy',
        name: 'Weekdays Only',
        description: '',
        resource: 'file',
        action: 'read',
        condition: { attribute: 'x', operator: 'equals' as const, value: 1 },
        effect: 'ALLOW',
        priority: 1,
        enabled: true,
        timeConstraints: {
          daysOfWeek: [1, 2, 3, 4, 5],
        },
      });

      const weekend = engine.evaluate({
        userId: 'u1',
        resource: 'file',
        action: 'read',
        attributes: { x: 1 },
        timestamp: new Date('2025-01-04T12:00:00Z'),
      });
      expect(weekend.allowed).toBe(false);
    });

    it('should deny policy outside allowed hours', () => {
      engine.createPolicy({
        id: 'hours_policy',
        name: 'Business Hours Only',
        description: '',
        resource: 'file',
        action: 'read',
        condition: { attribute: 'x', operator: 'equals' as const, value: 1 },
        effect: 'ALLOW',
        priority: 1,
        enabled: true,
        timeConstraints: {
          hoursOfDay: [9, 10, 11, 12, 13, 14, 15, 16, 17],
        },
      });

      const night = engine.evaluate({
        userId: 'u1',
        resource: 'file',
        action: 'read',
        attributes: { x: 1 },
        timestamp: new Date('2025-01-01T02:00:00Z'),
      });
      expect(night.allowed).toBe(false);
    });
  });

  describe('Attribute definition management', () => {
    it('should add attribute definition', () => {
      engine.addAttributeDefinition({
        id: 'user_role',
        name: 'User Role',
        type: 'string',
        description: 'The role of the user',
      });
      const attr = engine.getAttributeDefinition('user_role');
      expect(attr).toBeDefined();
      expect(attr!.type).toBe('string');
    });

    it('should throw when adding duplicate attribute definition', () => {
      engine.addAttributeDefinition({
        id: 'dup',
        name: 'Dup',
        type: 'string',
        description: '',
      });
      expect(() =>
        engine.addAttributeDefinition({
          id: 'dup',
          name: 'Dup 2',
          type: 'string',
          description: '',
        })
      ).toThrow("Attribute definition with id 'dup' already exists");
    });

    it('should update attribute definition', () => {
      engine.addAttributeDefinition({
        id: 'attr1',
        name: 'Attr1',
        type: 'string',
        description: 'Original',
      });
      engine.updateAttributeDefinition('attr1', { description: 'Updated' });
      const attr = engine.getAttributeDefinition('attr1');
      expect(attr!.description).toBe('Updated');
    });

    it('should throw when updating nonexistent attribute definition', () => {
      expect(() => engine.updateAttributeDefinition('nope', { name: 'X' })).toThrow(
        "Attribute definition with id 'nope' not found"
      );
    });

    it('should delete attribute definition', () => {
      engine.addAttributeDefinition({
        id: 'del',
        name: 'Del',
        type: 'number',
        description: '',
      });
      engine.deleteAttributeDefinition('del');
      expect(engine.getAttributeDefinition('del')).toBeUndefined();
    });

    it('should throw when deleting nonexistent attribute definition', () => {
      expect(() => engine.deleteAttributeDefinition('ghost')).toThrow(
        "Attribute definition with id 'ghost' not found"
      );
    });

    it('should list all attribute definitions', () => {
      engine.addAttributeDefinition({
        id: 'a',
        name: 'A',
        type: 'string',
        description: '',
      });
      engine.addAttributeDefinition({
        id: 'b',
        name: 'B',
        type: 'number',
        description: '',
      });
      expect(engine.listAttributeDefinitions()).toHaveLength(2);
    });
  });

  describe('Persistence (save/load)', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abac-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should save and load state correctly', () => {
      engine.createPolicy({
        id: 'p1',
        name: 'Test Policy',
        description: '',
        resource: 'file',
        action: 'read',
        condition: { attribute: 'role', operator: 'equals' as const, value: 'admin' },
        effect: 'ALLOW',
        priority: 10,
        enabled: true,
      });
      engine.addAttributeDefinition({
        id: 'attr1',
        name: 'Attr1',
        type: 'string',
        description: 'Test attr',
      });

      const filePath = path.join(tmpDir, 'abac.json');
      engine.save(filePath);

      const newEngine = new AbacEngine();
      newEngine.load(filePath);

      expect(newEngine.getPolicy('p1')).toBeDefined();
      expect(newEngine.getAttributeDefinition('attr1')).toBeDefined();

      const result = newEngine.evaluate({
        userId: 'u1',
        resource: 'file',
        action: 'read',
        attributes: { role: 'admin' },
      });
      expect(result.allowed).toBe(true);
    });

    it('should throw when loading nonexistent file', () => {
      expect(() => engine.load(path.join(tmpDir, 'nope.json'))).toThrow('not found');
    });
  });
});
