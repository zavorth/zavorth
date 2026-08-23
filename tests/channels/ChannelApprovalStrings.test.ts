import {
  formatChannelApprovalString,
  resolveChannelApprovalLocale,
} from '../../src/services/localization/channelApprovalStrings.js';
import {
  renderApprovalDecisionReceiptForSurface,
  renderApprovalPromptForSurface,
  resolveSurfaceCapabilityPresentation,
} from '../../src/channels/capabilities/SurfaceCapabilityGate.js';

describe('ChannelApprovalStrings (facade-backed rendering)', () => {
  describe('locale resolution cascade', () => {
    it('resolves exact and prefixed language tags onto canonical catalog locales', () => {
      expect(resolveChannelApprovalLocale('pt-BR')).toBe('pt');
      expect(resolveChannelApprovalLocale('PT-br')).toBe('pt');
      expect(resolveChannelApprovalLocale('pt_PT')).toBe('pt');
      expect(resolveChannelApprovalLocale('en-US')).toBe('en');
      expect(resolveChannelApprovalLocale('en')).toBe('en');
    });

    it('falls back to English for unknown or missing locales', () => {
      expect(resolveChannelApprovalLocale('qq-XX')).toBe('en');
      expect(resolveChannelApprovalLocale('')).toBe('en');
      expect(resolveChannelApprovalLocale(null)).toBe('en');
      expect(resolveChannelApprovalLocale(undefined)).toBe('en');
    });
  });

  describe('string formatting through the unified catalog', () => {
    it('keeps English approval wording stable', () => {
      expect(
        formatChannelApprovalString(
          'prompt.entry',
          {
            ordinal: '2. ',
            risk: 'danger',
            label: 'Run shell command',
            ref: 'approval-9',
          },
          'en-US',
        ),
      ).toBe('2. [danger] Run shell command — ref approval-9');
      expect(formatChannelApprovalString('prompt.hint', {}, 'en-US')).toBe(
        'Reply 1 (or the ref) to allow once, approve / approve session / approve always, reject (or deny) to refuse, or reply other to type your answer.',
      );
      expect(formatChannelApprovalString('receipt.approved', { ref: 'a1', choice: 'session' }, 'en-US')).toBe(
        'Approved a1 (session).',
      );
      expect(formatChannelApprovalString('receipt.denied', { ref: 'a1' }, 'en-US')).toBe('Denied approval a1.');
      expect(formatChannelApprovalString('receipt.notFound', { ref: 'a1' }, 'en-US')).toBe(
        'No pending approval found for a1.',
      );
      expect(formatChannelApprovalString('bulk.approvedAll', { count: 3, choice: 'once' }, 'en-US')).toBe(
        'Approved all 3 approval(s) (once).',
      );
      expect(formatChannelApprovalString('bulk.deniedPartial', { resolved: 1, total: 2 }, 'en-US')).toBe(
        'Denied 1 of 2 approval(s).',
      );
      expect(formatChannelApprovalString('other.armed', { count: 1 }, 'en-US')).toBe(
        'Describe your answer for 1 pending approval(s); your next message is captured as the decision context.',
      );
      expect(formatChannelApprovalString('other.deniedWithReason', { count: 2 }, 'en-US')).toBe(
        'Denied 2 approval(s). Your answer was relayed to the agent.',
      );
    });

    it('renders Portuguese wording while keeping ordinals and refs universal', () => {
      expect(
        formatChannelApprovalString(
          'prompt.entry',
          {
            ordinal: '',
            risk: 'danger',
            label: 'Comando de shell',
            ref: 'approval-9',
          },
          'pt-BR',
        ),
      ).toBe('[danger] Comando de shell — ref approval-9');
      expect(formatChannelApprovalString('receipt.approved', { ref: 'a1', choice: 'once' }, 'pt-BR')).toBe(
        'Aprovado a1 (once).',
      );
      expect(formatChannelApprovalString('receipt.notFound', { ref: 'a1' }, 'pt')).toContain('Nenhuma');
      expect(formatChannelApprovalString('other.armed', { count: 2 }, 'pt-BR')).toContain('Descreva sua resposta');
    });

    it('serves English copy for catalogs without approval coverage', () => {
      expect(formatChannelApprovalString('receipt.approved', { ref: 'a1', choice: 'once' }, 'fr-FR')).toBe(
        'Approved a1 (once).',
      );
    });
  });

  describe('surface rendering through the facade', () => {
    it('renders localized prompts and receipts per chat language', () => {
      const presentation = resolveSurfaceCapabilityPresentation({ platform: 'signal' });
      const entries = [{ label: 'Run shell command', risk: 'danger', ref: 'approval-1' }];

      const enPrompt = renderApprovalPromptForSurface(presentation, entries, undefined);
      expect(String(enPrompt)).toContain('Reply 1 (or the ref)');

      const ptPrompt = renderApprovalPromptForSurface(presentation, entries, 'pt-BR');
      expect(String(ptPrompt)).toContain('/approve <referência>');
      expect(String(ptPrompt)).toContain('[danger] Run shell command — ref approval-1');

      expect(
        renderApprovalDecisionReceiptForSurface(
          presentation,
          { action: 'approve', ref: 'approval-1', choice: 'once', found: true },
          'pt-BR',
        ),
      ).toBe('Aprovado approval-1 (once).');
      expect(
        renderApprovalDecisionReceiptForSurface(
          presentation,
          { action: 'approve', ref: 'approval-x', choice: 'once', found: false },
          'pt-BR',
        ),
      ).toBe('Nenhuma aprovação pendente encontrada para approval-x.');
    });
  });
});
