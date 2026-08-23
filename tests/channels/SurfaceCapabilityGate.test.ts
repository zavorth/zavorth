import {
  renderApprovalDecisionReceiptForSurface,
  renderApprovalPromptForSurface,
  resolveSurfaceCapabilityPresentation,
} from '../../src/channels/capabilities/SurfaceCapabilityGate.js';
import {
  registerSurfaceProfile,
  resetSurfaceProfileRegistryForTests,
} from '../../src/domain/surface/application/surface-affordance/index.js';

describe('SurfaceCapabilityGate', () => {
  afterEach(() => {
    resetSurfaceProfileRegistryForTests();
  });

  describe('presentation resolution', () => {
    it('resolves interactive-card surfaces from their declared button affordances', () => {
      for (const platform of ['telegram', 'discord', 'web', 'desktop']) {
        const presentation = resolveSurfaceCapabilityPresentation({ platform });
        expect(presentation.mode).toBe('interactive-cards');
        expect(presentation.supportsInlineButtons).toBe(true);
      }
    });

    it('resolves numbered-text fallbacks for chat-basic and cli profiles', () => {
      for (const platform of ['whatsapp', 'signal', 'imessage', 'email', 'teams', 'slack', 'plain', 'cli']) {
        const presentation = resolveSurfaceCapabilityPresentation({ platform });
        expect(presentation.mode).toBe('numbered-text');
        expect(presentation.supportsInlineButtons).toBe(false);
        expect(presentation.supportsSlashCommands).toBe(true);
      }
    });

    it('enforces approvals:false feature declarations into the none mode', () => {
      const presentation = resolveSurfaceCapabilityPresentation({
        platform: 'telegram',
        features: { approvals: false },
      });

      expect(presentation.mode).toBe('none');
      expect(presentation.supportsInlineButtons).toBe(false);
      expect(presentation.supportsFreeText).toBe(false);
    });

    it('keeps prompt capability when a channel declares no approval flag at all', () => {
      const presentation = resolveSurfaceCapabilityPresentation({
        platform: 'signal',
        features: { inbound: true, outbound: true },
      });

      expect(presentation.mode).toBe('numbered-text');
    });

    it('falls back to the plain numbered-text profile for unknown platforms', () => {
      const presentation = resolveSurfaceCapabilityPresentation({ platform: 'mystery-relay' });

      expect(presentation.platform).toBe('mystery-relay');
      expect(presentation.mode).toBe('numbered-text');
    });

    it('resolves the none mode when a registered profile disables every text affordance', () => {
      registerSurfaceProfile({
        id: 'silent-bridge',
        channel: 'plain',
        label: 'Silent bridge',
        preset: 'chat-basic',
        overrides: {
          affordances: { text: false, slash_commands: false },
        },
      });

      const presentation = resolveSurfaceCapabilityPresentation({ platform: 'silent-bridge' });

      expect(presentation.mode).toBe('none');
    });
  });

  describe('prompt rendering', () => {
    it('renders a single pending approval without an ordinal prefix', () => {
      const presentation = resolveSurfaceCapabilityPresentation({ platform: 'signal' });
      const prompt = renderApprovalPromptForSurface(
        presentation,
        [{ label: 'Run shell command', risk: 'danger', ref: 'approval-1' }],
      );

      expect(prompt).toBe(
        [
          '[danger] Run shell command — ref approval-1',
          'Reply 1 (or the ref) to allow once, approve / approve session / approve always, or reject (or deny) to refuse.',
        ].join('\n'),
      );
    });

    it('numbers multiple pending approvals so ordinals map back to refs', () => {
      const presentation = resolveSurfaceCapabilityPresentation({ platform: 'signal' });
      const prompt = renderApprovalPromptForSurface(presentation, [
        { label: 'First action', risk: 'medium', ref: 'approval-a' },
        { label: 'Second action', risk: 'danger', ref: 'approval-b' },
      ]);
      const lines = String(prompt).split('\n');

      expect(lines[0]).toBe('1. [medium] First action — ref approval-a');
      expect(lines[1]).toBe('2. [danger] Second action — ref approval-b');
    });

    it('suppresses prompts entirely for surfaces resolved into the none mode', () => {
      const presentation = resolveSurfaceCapabilityPresentation({
        platform: 'telegram',
        features: { approvals: false },
      });

      expect(
        renderApprovalPromptForSurface(presentation, [
          { label: 'Anything', risk: 'danger', ref: 'approval-1' },
        ]),
      ).toBeNull();
    });
  });

  describe('decision receipts', () => {
    it('renders approve, deny and not-found receipts for capable surfaces', () => {
      const presentation = resolveSurfaceCapabilityPresentation({ platform: 'slack' });

      expect(
        renderApprovalDecisionReceiptForSurface(presentation, {
          action: 'approve',
          ref: 'approval-a',
          choice: 'session',
          found: true,
        }),
      ).toBe('Approved approval-a (session).');
      expect(
        renderApprovalDecisionReceiptForSurface(presentation, {
          action: 'deny',
          ref: 'approval-a',
          found: true,
        }),
      ).toBe('Denied approval approval-a.');
      expect(
        renderApprovalDecisionReceiptForSurface(presentation, {
          action: 'approve',
          ref: 'approval-x',
          choice: 'once',
          found: false,
        }),
      ).toBe('No pending approval found for approval-x.');
    });

    it('suppresses decision receipts for surfaces that must not receive approval content', () => {
      registerSurfaceProfile({
        id: 'silent-bridge-2',
        channel: 'plain',
        label: 'Silent bridge two',
        preset: 'chat-basic',
        overrides: {
          affordances: { text: false, slash_commands: false },
        },
      });
      const enforced = resolveSurfaceCapabilityPresentation({ platform: 'silent-bridge-2' });

      expect(enforced.mode).toBe('none');
      expect(
        renderApprovalDecisionReceiptForSurface(enforced, {
          action: 'approve',
          ref: 'approval-a',
          choice: 'once',
          found: true,
        }),
      ).toBeNull();
    });
  });
});
