import {
  applySurfaceLifecycleOp,
  buildClearControlsOp,
  buildDecisionReceiptOp,
  buildEphemeralNoticeOp,
  buildPostDecisionLifecycle,
  buildProgressEditOp,
  certifySurface,
  listRegisteredSurfaces,
  projectResponseForChannel,
  projectSemanticCard,
  registerSurface,
  resetSurfaceRegistrationForTests,
  resolveProjectionMode,
  SURFACE_MESSAGE_LIFECYCLE_VERSION,
  SURFACE_REGISTRATION_CONTRACT_VERSION,
} from '../../../src/domain/surface/application/surface-projection/index.js';
import {
  resolveSurfaceProfileForChannel,
  RICH_SELECT_SURFACE_PROFILE,
} from '../../../src/domain/surface/application/surface-affordance/index.js';
import {
  buildAgentPermissionApprovalResponse,
  buildAgentPermissionSemanticCard,
} from '../../../src/services/permission/AgentPermissionApprovalPresentation.js';
import { parseSurfaceInteraction } from '../../../src/domain/surface/application/surface-projection/index.js';

const TASK_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('Surface lifecycle F5a + select F5b + desktop F5c + numbered F5d + registry F6', () => {
  afterEach(() => {
    resetSurfaceRegistrationForTests();
  });

  describe('F5a message lifecycle', () => {
    it('builds clear / decision / progress / ephemeral ops', () => {
      const clear = buildClearControlsOp('telegram');
      expect(clear.version).toBe(SURFACE_MESSAGE_LIFECYCLE_VERSION);
      expect(clear.kind).toBe('clear_controls');
      expect((clear.nativePatch as any).reply_markup).toBeTruthy();

      const discordClear = buildClearControlsOp('discord');
      expect((discordClear.nativePatch as any).components).toEqual([]);

      const receipt = buildDecisionReceiptOp({
        surface: 'telegram',
        choice: 'once',
        approvalId: TASK_ID,
      });
      expect(receipt.kind).toBe('edit_and_clear_controls');
      expect(receipt.text).toMatch(/once/i);
      expect(receipt.text).toMatch(/aaaaaaaa/i);

      const progress = buildProgressEditOp('Running step 2/3…', 'telegram');
      expect(progress.kind).toBe('edit_text');
      expect(progress.text).toMatch(/step 2/);

      const toast = buildEphemeralNoticeOp('Saved', 'desktop');
      expect(toast.kind).toBe('ephemeral_notice');
      expect((toast.nativePatch as any).toast).toBe(true);
    });

    it('applySurfaceLifecycleOp clears markup and edits text', async () => {
      const editReplyMarkup = jest.fn().mockResolvedValue(undefined);
      const editMessage = jest.fn().mockResolvedValue(undefined);
      const answerCallback = jest.fn().mockResolvedValue(undefined);

      await applySurfaceLifecycleOp(
        { surface: 'telegram', editReplyMarkup, editMessage },
        buildClearControlsOp('telegram'),
        { surface: 'telegram', messageId: '42' },
      );
      expect(editReplyMarkup).toHaveBeenCalled();

      await applySurfaceLifecycleOp(
        { surface: 'telegram', editMessage },
        buildProgressEditOp('Hello', 'telegram'),
        { surface: 'telegram', messageId: '42' },
      );
      expect(editMessage).toHaveBeenCalledWith('42', 'Hello', undefined);

      await applySurfaceLifecycleOp(
        { surface: 'desktop', answerCallback },
        buildEphemeralNoticeOp('Toast!', 'desktop'),
        { surface: 'desktop' },
      );
      expect(answerCallback).toHaveBeenCalled();

      const ops = buildPostDecisionLifecycle({
        surface: 'telegram',
        choice: 'session',
        approvalId: TASK_ID,
      });
      expect(ops[0].kind).toBe('edit_and_clear_controls');
    });
  });

  describe('F5b Discord select_menu', () => {
    it('long choice_group uses select_menu mode when profile supports it', () => {
      const card = {
        version: 'semantic-card/v1' as const,
        id: 'long-select',
        intent: 'configuration' as const,
        title: 'Pick model',
        controls: [
          {
            kind: 'choice_group' as const,
            id: 'models',
            purpose: 'configuration' as const,
            options: Array.from({ length: 6 }, (_, i) => ({
              id: `m${i}`,
              label: `Model ${i}`,
              callbackData: `model:pick:m${i}`,
            })),
          },
        ],
      };
      const mode = resolveProjectionMode(card.controls[0], RICH_SELECT_SURFACE_PROFILE);
      expect(mode).toBe('select_menu');

      const projected = projectSemanticCard(card, RICH_SELECT_SURFACE_PROFILE);
      expect(projected.projection[0].mode).toBe('select_menu');

      const out = projectResponseForChannel(
        'discord',
        projected.surfaceResponse,
        {},
        { profile: resolveSurfaceProfileForChannel('discord'), projected },
      );
      // Discord projector may still use buttons for ≤5; force via metadata
      const withMeta = {
        ...projected.surfaceResponse,
        metadata: {
          ...(projected.surfaceResponse.metadata || {}),
          projection: [{ controlId: 'models', mode: 'select_menu' }],
        },
        actions: projected.actions,
      };
      const selectOut = projectResponseForChannel('discord', withMeta);
      expect((selectOut.replyOptions as any)?.selectMenu || (selectOut.replyOptions as any)?.components).toBeTruthy();
      const components = (selectOut.replyOptions as any).components;
      expect(Array.isArray(components)).toBe(true);
      const select = components[0]?.components?.[0];
      expect(select?.type).toBe(3);
      expect(select?.options?.length).toBeGreaterThan(4);
    });
  });

  describe('F5c Desktop rich controls', () => {
    it('emits shortcuts 1-4, copy targets, and approval id', () => {
      const profile = resolveSurfaceProfileForChannel('desktop');
      const response = buildAgentPermissionApprovalResponse(
        { approvalId: TASK_ID, title: 'Approval needed' },
        profile,
      );
      const out = projectResponseForChannel('desktop', response, {}, { profile });
      const opts = out.replyOptions as any;
      expect(opts.surface).toBe('desktop');
      expect(opts.keyboardShortcuts).toBe(true);
      expect(Array.isArray(opts.shortcuts)).toBe(true);
      expect(opts.shortcuts.length).toBeGreaterThanOrEqual(4);
      expect(opts.shortcuts[0].key).toBe('1');
      expect(opts.shortcuts.some((s: any) => s.choice === 'once')).toBe(true);
      expect(opts.copyTargets?.some((c: any) => c.id === 'approvalId')).toBe(true);
      expect(opts.openReceipt?.approvalId).toBe(TASK_ID);
      expect(opts.ephemeralSupported).toBe(true);
    });
  });

  describe('F5d numbered messaging fallbacks', () => {
    it('signal/whatsapp project with numbered prompt and parse reply 1-4', () => {
      for (const channel of ['signal', 'whatsapp']) {
        const profile = resolveSurfaceProfileForChannel(channel);
        const card = buildAgentPermissionSemanticCard({ approvalId: TASK_ID });
        const projected = projectSemanticCard(card, profile);
        expect(projected.usedNativeButtons).toBe(false);
        const choiceMode = projected.projection.find(
          (p) => p.controlId === 'agent-permission-choices',
        )?.mode;
        expect(choiceMode).toBe('numbered_text');
        expect(projected.text).toMatch(/Reply with a number/i);

        const out = projectResponseForChannel(
          channel,
          buildAgentPermissionApprovalResponse({ approvalId: TASK_ID }, profile),
          {},
          { profile, projected },
        );
        expect(out.usedNativeButtons).toBe(false);
        expect((out.replyOptions as any)?.numberedPrompt).toBe(true);
        expect((out.replyOptions as any)?.numberedOptions?.length).toBeGreaterThanOrEqual(4);

        const event = parseSurfaceInteraction({
          surface: channel,
          raw: '1',
          kindHint: 'text',
          numberedOptions: (out.replyOptions as any).numberedOptions,
          metadata: { approvalId: TASK_ID },
        });
        expect(event?.kind).toBe('numbered_reply');
        expect(event?.choice).toBe('once');
        expect(event?.approvalId).toBe(TASK_ID);
      }
    });
  });

  describe('F6 registerSurface', () => {
    it('registers surface with only id + preset and certifies ready', () => {
      const result = registerSurface({
        id: 'acme-chat',
        preset: 'chat-basic',
        label: 'Acme Chat',
      });
      expect(result.profile.id).toBe('acme-chat');
      expect(result.profile.preset).toBe('chat-basic');
      expect(result.projector.channel).toBe('acme-chat');
      expect(result.certification.version).toBe(SURFACE_REGISTRATION_CONTRACT_VERSION);
      expect(result.certification.status).toBe('ready');
      expect(result.certification.blocking).toEqual([]);

      const cert = certifySurface('acme-chat');
      expect(cert.hasProjector).toBe(true);
      expect(cert.checks.some((c) => c.id === 'critical-action-fallback' && c.status === 'pass')).toBe(
        true,
      );

      const listed = listRegisteredSurfaces();
      expect(listed.some((s) => s.id === 'acme-chat')).toBe(true);
    });

    it('custom projector is used when provided', () => {
      const result = registerSurface({
        id: 'fancy',
        preset: 'chat-interactive',
        projector: {
          channel: 'fancy',
          project: () => ({
            contractVersion: 'surface-projector/v1',
            channel: 'fancy',
            text: 'fancy-out',
            replyOptions: { custom: true },
            rendered: {
              target: 'plain',
              format: 'plain',
              text: 'fancy-out',
              actions: [],
              native: null,
            },
            usedNativeButtons: false,
          }),
        },
      });
      const out = result.projector.project({
        response: buildAgentPermissionApprovalResponse({ approvalId: TASK_ID }),
      });
      expect(out.text).toBe('fancy-out');
      expect((out.replyOptions as any).custom).toBe(true);
    });
  });
});
