import { Database } from '../storage/Database.js';
import { TrustedWorkspaceService } from './TrustedWorkspaceService.js';
import { AgentWorkspaceConfigService } from './AgentWorkspaceConfigService.js';
import { ProviderConfigService } from './ProviderConfigService.js';
import { SecurityAuditLogger } from './SecurityAuditLogger.js';

export interface BetaChecklistItem {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'completed';
  manual: boolean;
}

export class InternalBetaChecklistService {
  private static instance: InternalBetaChecklistService;

  private constructor() {}

  public static getInstance(): InternalBetaChecklistService {
    if (!InternalBetaChecklistService.instance) {
      InternalBetaChecklistService.instance = new InternalBetaChecklistService();
    }
    return InternalBetaChecklistService.instance;
  }

  public async getChecklist(workspaceId: string): Promise<BetaChecklistItem[]> {
    const checklist: BetaChecklistItem[] = [];

    // Check 1: Workspace Trust
    let workspaceTrusted = false;
    try {
      const trustService = await TrustedWorkspaceService.getInstance();
      const entry = trustService.getTrustEntry(workspaceId);
      if (entry && entry.trusted) {
        workspaceTrusted = true;
      }
    } catch {
      // ignore
    }
    checklist.push({
      id: 'step_trust_workspace',
      title: 'Trust Workspace',
      description: 'Mark the current workspace as trusted to authorize actions.',
      status: workspaceTrusted ? 'completed' : 'pending',
      manual: false
    });

    // Check 2: Provider Setup
    let providerConfigured = false;
    try {
      const providerService = ProviderConfigService.getInstance();
      const providers = await providerService.getProviders();
      if (providers.length > 0) {
        // Check if at least one enabled provider has api key configured (if remote)
        const hasValid = providers.some((p: any) => p.enabled && (!p.requiresApiKey || p.secretRef));
        if (hasValid) {
          providerConfigured = true;
        }
      }
    } catch {
      // ignore
    }
    checklist.push({
      id: 'step_setup_provider',
      title: 'Configure AI Provider',
      description: 'Register at least one provider (OpenAI, Anthropic, Google) with a valid API key.',
      status: providerConfigured ? 'completed' : 'pending',
      manual: false
    });

    // Check 3: Default Provider/Model Selected
    let defaultSelected = false;
    try {
      const config = await AgentWorkspaceConfigService.getInstance().getConfig(workspaceId);
      if (config.defaultProviderId && config.defaultModelId) {
        defaultSelected = true;
      }
    } catch {
      // ignore
    }
    checklist.push({
      id: 'step_select_defaults',
      title: 'Selecionar Provider e Modelo Padrão',
      description: 'Escolher qual IA e modelo serão a rota primária para as tarefas do workspace.',
      status: defaultSelected ? 'completed' : 'pending',
      manual: false
    });

    // Check 4: Workspace configuration customized
    let configCustomized = false;
    try {
      const db = await Database.getInstance();
      const row = db.get('SELECT 1 FROM agent_workspace_config WHERE workspace_id = ?', [workspaceId]);
      if (row) {
        configCustomized = true;
      }
    } catch {
      // ignore
    }
    checklist.push({
      id: 'step_customize_config',
      title: 'Customizar Configurações de Agente',
      description: 'Salvar as preferências de execução (PTY, HPM, Autonomia) na aba Workspace Settings.',
      status: configCustomized ? 'completed' : 'pending',
      manual: false
    });

    // Check 5 (Manual): Test Connection (existing safe flow)
    checklist.push({
      id: 'step_test_connection',
      title: 'Testar Conexão do Provedor',
      description: 'Clicar no botão "Test Connection" no painel de provedores para validar conectividade e headers sem revelar segredos.',
      status: 'pending', // Always manual check
      manual: true
    });

    // Check 6 (Manual): Execute simple diagnostic reading task
    checklist.push({
      id: 'step_execute_diagnostic_task',
      title: 'Executar Tarefa Simples de Leitura/Diagnóstico Seguro',
      description: 'Instanciar o agente autônomo para ler um arquivo local e verificar se o plano de execução não vaza credenciais.',
      status: 'pending',
      manual: true
    });

    // Check 7 (Manual): Validate locked defaults
    checklist.push({
      id: 'step_validate_locked_defaults',
      title: 'Validar Host Power Mode e PTY Bloqueados por Default',
      description: 'Verificar se, com HPM e PTY desativados nas políticas do workspace, comandos externos de shell e sessões interativas são impedidos pelo runner.',
      status: 'pending',
      manual: true
    });

    // Check 8 (Manual): Validate logs and audit trails
    checklist.push({
      id: 'step_validate_logs_redaction',
      title: 'Validar Ocultação de Secrets em Logs',
      description: 'Inspecionar a tabela de logs locais e saída do terminal para certificar que chaves, tokens ou referências confidenciais não estão expostos.',
      status: 'pending',
      manual: true
    });

    // Check 9 (Manual): Test Workspace trust revocation
    checklist.push({
      id: 'step_test_revocation',
      title: 'Testar Revogação e Reset de Confiança',
      description: 'Revogar a confiança do workspace e validar que todas as sessões de concessão de comando associadas são invalidadas.',
      status: 'pending',
      manual: true
    });

    // Audit logging
    try {
      const logger = new SecurityAuditLogger();
      await logger.logWorkspaceEvent({
        event: 'internal_beta_checklist_viewed' as any,
        workspaceId,
        metadata: {
          stepsCompleted: checklist.filter(s => s.status === 'completed').length,
          totalSteps: checklist.length
        }
      });
    } catch {
      // ignore
    }

    return checklist;
  }
}
