import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { MnemosScopeConsentService } from '../services/MnemosScopeConsentService.js';

export class PlanMnemosScopeTool extends BaseTool {
  readonly name = 'plan_mnemos_scope';
  readonly description = [
    'Use this tool before configuring Mnemos when the user says in natural language where it may search.',
    'Ela transforma frases como "pode procurar no meu PC inteiro" ou "procure em Documentos" em um escopo explicito, com risco e aviso.',
    'Do not run enable_mnemos until the user confirms the presented scope.',
  ].join(' ');

  readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      user_text: {
        type: 'string',
        description: 'Natural user text describing where Mnemos may search.',
      },
      vault_dir: {
        type: 'string',
        description: 'Optional. Desired Mnemos vault path. If absent, uses data/mnemos_vault in the workspace.',
      },
    },
    required: ['user_text'],
  };

  constructor(private readonly service: MnemosScopeConsentService = new MnemosScopeConsentService()) {
    super();
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const proposal = this.service.createProposal({
      userText: String(args.user_text || ''),
      vaultDir: String(args.vault_dir || '').trim() || null,
    });

    return JSON.stringify({
      ...proposal,
      humanPrompt: this.service.formatProposal(proposal),
      approvalTextExamples: proposal.wholeComputerRequested
        ? ['Aprovo procurar no PC inteiro', 'Confirmo esse escopo mesmo com risco']
        : ['Aprovo', 'Continue', 'Pode configurar'],
    }, null, 2);
  }
}
