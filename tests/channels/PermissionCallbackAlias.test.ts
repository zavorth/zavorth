import type { Context } from 'grammy';
import type { ParsedPermissionCallback } from '../../src/services/approvals/PermissionCallbackAlias.js';
import {
  parsePermissionCallbackData,
  toTaskApprovalChoice,
} from '../../src/services/approvals/PermissionCallbackAlias.js';
import { TelegramPermissionCallbackService } from '../../src/gateways/channels/telegram/controllers/TelegramPermissionCallbackService.js';
import type { TelegramPermissionDecisionService } from '../../src/gateways/channels/telegram/controllers/TelegramPermissionDecisionService.js';
import { TelegramPermissionPolicyService } from '../../src/gateways/channels/telegram/controllers/TelegramPermissionPolicyService.js';

type PermissionLike = {
  permission_id: string;
  executor?: string;
  resolved_value?: string | null;
  metadata?: Record<string, unknown>;
};

function createContext(): Context & {
  answerCallbackQuery: jest.Mock;
  reply: jest.Mock;
} {
  return {
    from: { id: 42 },
    answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
  } as unknown as Context & { answerCallbackQuery: jest.Mock; reply: jest.Mock };
}

describe('permission callback alias layer', () => {
  describe('parsePermissionCallbackData', () => {
    it('parses approve callbacks with every legacy scope', () => {
      expect(parsePermissionCallbackData('perm:approve:abcd1234:once')).toEqual({
        action: 'approve',
        reference: 'abcd1234',
        scope: 'once',
      });
      expect(parsePermissionCallbackData('perm:approve:abcd1234:session')).toMatchObject({ scope: 'session' });
      expect(parsePermissionCallbackData('perm:approve:abcd1234:workspace')).toMatchObject({
        scope: 'workspace',
      });
      expect(parsePermissionCallbackData('perm:approve:abcd1234:persistent')).toMatchObject({
        scope: 'persistent',
      });
    });

    it('keeps approve callbacks without an explicit scope unscoped', () => {
      expect(parsePermissionCallbackData('perm:approve:abcd1234')).toEqual({
        action: 'approve',
        reference: 'abcd1234',
        scope: null,
      });
    });

    it('normalizes reject callbacks onto the unified deny action', () => {
      expect(parsePermissionCallbackData('perm:reject:abcd1234')).toEqual({
        action: 'deny',
        reference: 'abcd1234',
      });
    });

    it('rejects data outside the permission-callback grammar', () => {
      expect(parsePermissionCallbackData('perm:approve')).toBeNull();
      expect(parsePermissionCallbackData('perm:approve::once')).toBeNull();
      expect(parsePermissionCallbackData('perm:revoke:abcd1234')).toBeNull();
      expect(parsePermissionCallbackData('task:once:abcd1234')).toBeNull();
      expect(parsePermissionCallbackData('')).toBeNull();
    });

    it('maps legacy scopes onto the unified task-approval choice vocabulary', () => {
      expect(toTaskApprovalChoice('once')).toBe('once');
      expect(toTaskApprovalChoice('session')).toBe('session');
      expect(toTaskApprovalChoice('workspace')).toBe('always');
      expect(toTaskApprovalChoice('persistent')).toBe('always');
      expect(toTaskApprovalChoice(null)).toBe('once');
    });
  });

  describe('router-boundary dispatch', () => {
    function createService(options: {
      registry: Map<string, PermissionLike>;
      unifiedFallback: jest.Mock<Promise<boolean>, [Context, ParsedPermissionCallback]>;
    }): TelegramPermissionCallbackService {
      return new TelegramPermissionCallbackService({
        permissionDecision: {
          applyPermissionApproval: jest.fn().mockResolvedValue(undefined),
          applyPermissionRejection: jest.fn().mockResolvedValue(undefined),
        } as unknown as TelegramPermissionDecisionService,
        permissionPolicy: new TelegramPermissionPolicyService(),
        resolvePermissionReference: async (ref) => {
          const permission = options.registry.get(ref);
          if (!permission) {
            throw new Error(`No pending permission found for ${ref}.`);
          }
          return permission as never;
        },
        assertHostWritable: () => undefined,
        resolveUnifiedApprovalFallback: options.unifiedFallback,
      });
    }

    it('resolves legacy registry references through the legacy decision path', async () => {
      const registry = new Map<string, PermissionLike>([
        ['abcd1234', { permission_id: 'abcd1234', executor: 'codex' }],
      ]);
      const unifiedFallback = jest.fn().mockResolvedValue(true);
      const service = createService({ registry, unifiedFallback });
      const ctx = createContext();

      await service.handlePermissionCallback(ctx, 'perm:approve:abcd1234:workspace');

      const decision = service['deps'].permissionDecision as unknown as {
        applyPermissionApproval: jest.Mock;
      };
      expect(decision.applyPermissionApproval).toHaveBeenCalledWith(
        ctx,
        expect.objectContaining({ permission_id: 'abcd1234' }),
        expect.objectContaining({ scope: 'workspace' }),
        '42',
      );
      expect(unifiedFallback).not.toHaveBeenCalled();
    });

    it('resolves unknown references through the same decision path as task:* callbacks', async () => {
      const unifiedFallback = jest.fn().mockResolvedValue(true);
      const service = createService({ registry: new Map(), unifiedFallback });
      const ctx = createContext();

      await service.handlePermissionCallback(ctx, 'perm:approve:task-ref-1:session');

      expect(unifiedFallback).toHaveBeenCalledWith(ctx, {
        action: 'approve',
        reference: 'task-ref-1',
        scope: 'session',
      });
    });

    it('resolves unknown deny references through the unified path as well', async () => {
      const unifiedFallback = jest.fn().mockResolvedValue(true);
      const service = createService({ registry: new Map(), unifiedFallback });
      const ctx = createContext();

      await service.handlePermissionCallback(ctx, 'perm:reject:task-ref-2');

      expect(unifiedFallback).toHaveBeenCalledWith(ctx, { action: 'deny', reference: 'task-ref-2' });
    });

    it('preserves the legacy not-found error when no unified fallback is wired', async () => {
      const service = new TelegramPermissionCallbackService({
        permissionDecision: {} as unknown as TelegramPermissionDecisionService,
        permissionPolicy: new TelegramPermissionPolicyService(),
        resolvePermissionReference: async () => {
          throw new Error('No pending permission found for ghost.');
        },
        assertHostWritable: () => undefined,
      });
      const ctx = createContext();

      await service.handlePermissionCallback(ctx, 'perm:approve:ghost:once');

      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({
        text: 'No pending permission found for ghost.',
      });
    });

    it('answers unknown inline actions without touching any decision path', async () => {
      const unifiedFallback = jest.fn();
      const service = createService({
        registry: new Map<string, PermissionLike>([
          ['abcd1234', { permission_id: 'abcd1234', executor: 'codex' }],
        ]),
        unifiedFallback,
      });
      const ctx = createContext();

      await service.handlePermissionCallback(ctx, 'perm:frobnicate:abcd1234');

      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({ text: 'Unknown inline action.' });
      expect(unifiedFallback).not.toHaveBeenCalled();
    });

    it('reports the not-found failure when malformed data references an unknown permission', async () => {
      const unifiedFallback = jest.fn();
      const service = createService({ registry: new Map(), unifiedFallback });
      const ctx = createContext();

      await service.handlePermissionCallback(ctx, 'perm:frobnicate:ghost');

      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({
        text: 'No pending permission found for ghost.',
      });
      expect(unifiedFallback).not.toHaveBeenCalled();
    });
  });
});
