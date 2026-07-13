import {
  buildSuggestedPermissionReactions,
  createPassthroughSpeechToText,
  createZavorthSpeechToTextAdapter,
  isReactionDecisionReady,
  isVoiceReplyEnabled,
  matchReactionMapping,
  parseReactionConfirmation,
  parseReactionInteraction,
  parseSurfaceInteraction,
  processVoiceReply,
  projectResponseForChannel,
  registerSurface,
  resetSurfaceRegistrationForTests,
  setDefaultZavorthSpeechToTextAdapterForTests,
  toPermissionApprovalArgs,
} from '../../../src/domain/surface/application/surface-projection/index.js';
import {
  isAffordanceEnabled,
  resolveSurfaceProfileForChannel,
} from '../../../src/domain/surface/application/surface-affordance/index.js';
import { buildAgentPermissionApprovalResponse } from '../../../src/services/permission/AgentPermissionApprovalPresentation.js';

const TASK_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('Surface reactions F5e + voice_reply F5f', () => {
  afterEach(() => {
    resetSurfaceRegistrationForTests();
  });

  describe('F5e reactions', () => {
    it('maps ✅/❌/🔁/📌 to once/deny/session/always', () => {
      expect(matchReactionMapping('✅')?.choice).toBe('once');
      expect(matchReactionMapping('❌')?.choice).toBe('deny');
      expect(matchReactionMapping('🔁')?.choice).toBe('session');
      expect(matchReactionMapping('📌')?.choice).toBe('always');
      expect(matchReactionMapping('👍')?.choice).toBe('once');
      expect(matchReactionMapping(':white_check_mark:')?.choice).toBe('once');
    });

    it('parseReactionInteraction produces decision events', () => {
      const profile = resolveSurfaceProfileForChannel('telegram');
      expect(isAffordanceEnabled(profile, 'reactions')).toBe(true);

      const once = parseReactionInteraction({
        surface: 'telegram',
        reaction: '✅',
        approvalId: TASK_ID,
        profile,
      });
      expect(once?.kind).toBe('reaction');
      expect(once?.choice).toBe('once');
      expect(isReactionDecisionReady(once!)).toBe(true);
      expect(toPermissionApprovalArgs(once!)).toEqual({ taskId: TASK_ID, choice: 'once' });

      const deny = parseReactionInteraction({
        surface: 'telegram',
        reaction: '❌',
        approvalId: TASK_ID,
        profile,
      });
      expect(deny?.choice).toBe('deny');
      expect(deny?.action).toBe('reject');
    });

    it('high-risk allow reaction requires confirmation before apply', () => {
      const event = parseReactionInteraction({
        surface: 'telegram',
        reaction: '✅',
        approvalId: TASK_ID,
        highRisk: true,
        profile: resolveSurfaceProfileForChannel('telegram'),
      });
      expect(event?.metadata?.requiresConfirmation).toBe(true);
      expect(isReactionDecisionReady(event!)).toBe(false);
      expect(toPermissionApprovalArgs(event!)).toBeNull();
      expect(String(event?.metadata?.confirmationPrompt || '')).toMatch(/High-risk/i);

      // deny on high-risk does not need extra confirm
      const deny = parseReactionInteraction({
        surface: 'telegram',
        reaction: '❌',
        approvalId: TASK_ID,
        highRisk: true,
        profile: resolveSurfaceProfileForChannel('telegram'),
      });
      expect(deny?.metadata?.requiresConfirmation).toBe(false);
      expect(toPermissionApprovalArgs(deny!)).toEqual({ taskId: TASK_ID, choice: 'deny' });

      expect(
        parseReactionConfirmation(`yes ${TASK_ID} once`, {
          approvalId: TASK_ID,
          choice: 'once',
        }),
      ).toBe(true);
      expect(
        parseReactionConfirmation('nope', { approvalId: TASK_ID, choice: 'once' }),
      ).toBe(false);
    });

    it('blocks reactions when affordance disabled', () => {
      const profile = resolveSurfaceProfileForChannel('cli');
      expect(isAffordanceEnabled(profile, 'reactions')).toBe(false);
      const event = parseReactionInteraction({
        surface: 'cli',
        reaction: '✅',
        approvalId: TASK_ID,
        profile,
      });
      expect(event?.metadata?.blocked).toBe(true);
      expect(toPermissionApprovalArgs(event!)).toBeNull();
    });

    it('parseSurfaceInteraction auto-detects emoji reactions', () => {
      const event = parseSurfaceInteraction({
        surface: 'discord',
        raw: '✅',
        kindHint: 'auto',
        profile: resolveSurfaceProfileForChannel('discord'),
        metadata: { approvalId: TASK_ID },
      });
      expect(event?.kind).toBe('reaction');
      expect(event?.choice).toBe('once');
    });

    it('telegram projector attaches suggestedReactions when enabled', () => {
      const profile = resolveSurfaceProfileForChannel('telegram');
      const response = buildAgentPermissionApprovalResponse(
        { approvalId: TASK_ID },
        profile,
      );
      const out = projectResponseForChannel('telegram', response, {}, { profile });
      const suggested = (out.replyOptions as any)?.suggestedReactions;
      expect(Array.isArray(suggested)).toBe(true);
      expect(suggested.some((r: any) => r.emoji === '✅' && r.choice === 'once')).toBe(true);
      expect(buildSuggestedPermissionReactions().length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('F5f voice_reply', () => {
    it('enabled on interactive/rich presets; disabled on cli/signal', () => {
      expect(isVoiceReplyEnabled(resolveSurfaceProfileForChannel('telegram'))).toBe(true);
      expect(isVoiceReplyEnabled(resolveSurfaceProfileForChannel('web'))).toBe(true);
      expect(isVoiceReplyEnabled(resolveSurfaceProfileForChannel('cli'))).toBe(false);
      expect(isVoiceReplyEnabled(resolveSurfaceProfileForChannel('signal'))).toBe(false);
    });

    it('rejects when voice_reply disabled (cli)', async () => {
      const profile = resolveSurfaceProfileForChannel('cli');
      const result = await processVoiceReply({
        surface: 'cli',
        profile,
        transcript: `/approve ${TASK_ID} once`,
        approvalId: TASK_ID,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('voice_reply_disabled');
      }
    });

    it('transcribes via adapter and parses approval intent when enabled', async () => {
      const { profile } = registerSurface({
        id: 'voice-bot',
        preset: 'chat-interactive',
        overrides: { affordances: { voice_reply: true } },
      });
      expect(isVoiceReplyEnabled(profile)).toBe(true);

      const result = await processVoiceReply({
        surface: 'voice-bot',
        profile,
        audio: Buffer.from('dummy'),
        stt: createPassthroughSpeechToText(`/approve ${TASK_ID} session`),
        approvalId: TASK_ID,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.transcript).toMatch(/approve/);
        expect(result.event.choice).toBe('session');
        expect(result.event.metadata?.source).toBe('voice_reply');
        expect(toPermissionApprovalArgs(result.event)).toEqual({
          taskId: TASK_ID,
          choice: 'session',
        });
      }
    });

    it('accepts precomputed transcript without STT', async () => {
      const { profile } = registerSurface({
        id: 'voice-pre',
        preset: 'rich-app',
        overrides: { affordances: { voice_reply: true } },
      });
      const result = await processVoiceReply({
        surface: 'voice-pre',
        profile,
        transcript: `deny ${TASK_ID}`,
        approvalId: TASK_ID,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.event.choice).toBe('deny');
      }
    });

    it('uses explicit STT adapter when provided (preference sovereignty path)', async () => {
      const mock = createZavorthSpeechToTextAdapter({
        transcriptionService: {
          transcribe: async () => ({
            ok: true,
            text: `/approve ${TASK_ID} once`,
            provider: 'mock-gemini',
            model: 'mock-model',
            attempts: [],
            error: null,
          }),
        },
      });
      const profile = resolveSurfaceProfileForChannel('telegram');
      const result = await processVoiceReply({
        surface: 'telegram',
        profile,
        audio: Buffer.alloc(2048, 1),
        mimeType: 'audio/ogg',
        approvalId: TASK_ID,
        stt: mock,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.event.choice).toBe('once');
        expect(result.stt?.provider).toBe('mock-gemini');
      }
    });

    it('refuses audio STT when voice preference is unconfigured', async () => {
      const profile = resolveSurfaceProfileForChannel('telegram');
      const result = await processVoiceReply({
        surface: 'telegram',
        profile,
        audio: Buffer.alloc(2048, 1),
        mimeType: 'audio/ogg',
        approvalId: TASK_ID,
      });
      // Without preference/env and without explicit stt adapter → not configured
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code === 'stt_not_configured' || result.code === 'stt_failed').toBe(true);
      }
    });
  });
});
