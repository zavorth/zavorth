import {
  formatChannelApprovalString,
  resolveChannelApprovalLocale,
} from '../../src/channels/approval-strings/ChannelApprovalLocaleCatalog.js';
import {
  renderApprovalDecisionReceiptForSurface,
  renderApprovalPromptForSurface,
  resolveSurfaceCapabilityPresentation,
} from '../../src/channels/capabilities/SurfaceCapabilityGate.js';

describe('ChannelApprovalLocaleCatalog', () => {
  describe('locale resolution cascade', () => {
    it('resolves exact supported locales case-insensitively', () => {
      expect(resolveChannelApprovalLocale('pt-BR')).toBe('pt-BR');
      expect(resolveChannelApprovalLocale('PT-br')).toBe('pt-BR');
      expect(resolveChannelApprovalLocale('en-US')).toBe('en-US');
    });

    it('resolves primary-language prefixes before falling back', () => {
      expect(resolveChannelApprovalLocale('pt')).toBe('pt-BR');
      expect(resolveChannelApprovalLocale('pt_PT')).toBe('pt-BR');
      expect(resolveChannelApprovalLocale('en')).toBe('en-US');
    });

    it('falls back to en-US for unknown or missing locales', () => {
      expect(resolveChannelApprovalLocale('fr-FR')).toBe('en-US');
      expect(resolveChannelApprovalLocale('')).toBe('en-US');
      expect(resolveChannelApprovalLocale(null)).toBe('en-US');
      expect(resolveChannelApprovalLocale(undefined)).toBe('en-US');
    });
  });

  describe('string formatting', () => {
    it('keeps en-US approval wording stable', () => {
      expect(
        formatChannelApprovalString('en-US', 'prompt.entry', {
          ordinal: '2. ',
          risk: 'danger',
          label: 'Run shell command',
          ref: 'approval-9',
        }),
      ).toBe('2. [danger] Run shell command — ref approval-9');
      expect(formatChannelApprovalString('en-US', 'prompt.hint', {})).toBe(
        'Reply 1 (or the ref) to allow once, approve / approve session / approve always, reject (or deny) to refuse, or reply other to type your answer.',
      );
      expect(formatChannelApprovalString('en-US', 'receipt.approved', { ref: 'a1', choice: 'session' })).toBe(
        'Approved a1 (session).',
      );
      expect(formatChannelApprovalString('en-US', 'receipt.denied', { ref: 'a1' })).toBe('Denied approval a1.');
      expect(formatChannelApprovalString('en-US', 'receipt.notFound', { ref: 'a1' })).toBe(
        'No pending approval found for a1.',
      );
      expect(
        formatChannelApprovalString('en-US', 'bulk.approvedAll', { count: 3, choice: 'once' }),
      ).toBe('Approved all 3 approval(s) (once).');
      expect(formatChannelApprovalString('en-US', 'bulk.deniedPartial', { resolved: 1, total: 2 })).toBe(
        'Denied 1 of 2 approval(s).',
      );
      expect(formatChannelApprovalString('en-US', 'other.armed', { count: 1 })).toBe(
        'Describe your answer for 1 pending approval(s); your next message is captured as the decision context.',
      );
      expect(formatChannelApprovalString('en-US', 'other.deniedWithReason', { count: 2 })).toBe(
        'Denied 2 approval(s). Your answer was relayed to the agent.',
      );
    });

    it('renders pt-BR wording while keeping ordinals and refs universal', () => {
      expect(
        formatChannelApprovalString('pt-BR', 'prompt.entry', {
          ordinal: '',
          risk: 'danger',
          label: 'Comando de shell',
          ref: 'approval-9',
        }),
      ).toBe('[danger] Comando de shell — ref approval-9');
      expect(formatChannelApprovalString('pt-BR', 'receipt.approved', { ref: 'a1', choice: 'once' })).toBe(
        'Aprovado a1 (once).',
      );
      expect(formatChannelApprovalString('pt-BR', 'receipt.notFound', { ref: 'a1' })).toContain('Nenhuma');
      expect(formatChannelApprovalString('pt-BR', 'other.armed', { count: 2 })).toContain('Descreva sua resposta');
    });
  });

  describe('surface rendering through the catalog', () => {
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
          'pt',
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
