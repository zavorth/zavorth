import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { MnemosScopeConsentService } from '../services/MnemosScopeConsentService.js';

export class PlanMnemosScopeTool extends BaseTool {
  readonly name = 'plan_mnemos_scope';
  readonly description = [
    'Use esta ferramenta antes de configurar o Mnemos quando o usuario disser em linguagem natural onde ele permite procurar.',
    'Ela transforma frases como "pode procurar no meu PC inteiro" ou "procure em Documentos" em um escopo explicito, com risco e aviso.',
    'Nao execute enable_mnemos ate o usuario confirmar o escopo apresentado.',
  ].join(' ');

  readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      user_text: {
        type: 'string',
        description: 'Texto natural do usuario descrevendo onde o Mnemos pode procurar.',
      },
      vault_dir: {
        type: 'string',
        description: 'Opcional. Caminho do cofre Mnemos desejado pelo usuario. Se ausente, usa data/mnemos_vault no workspace.',
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
