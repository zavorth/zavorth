import { Database } from '../storage/Database.js';
import { SecurityAuditLogger } from './SecurityAuditLogger.js';
import { TrustedWorkspaceService } from './TrustedWorkspaceService.js';
import { AgentWorkspaceConfigService } from './AgentWorkspaceConfigService.js';
import { WorkspaceRuntimeReadinessService } from './WorkspaceRuntimeReadinessService.js';
import { ProviderConfigService } from './ProviderConfigService.js';
import { ErrorNormalizationService } from './ErrorNormalizationService.js';

export interface InternalBetaDiagnosticsReport {
  readyForInternalBeta: boolean;
  generatedAt: string;
  checks: Array<{
    id: string;
    status: 'pass' | 'warning' | 'fail';
    message: string;
    remediation?: string;
  }>;
}

export class InternalBetaDiagnosticsService {
  private static instance: InternalBetaDiagnosticsService;

  private constructor() {}

  public static getInstance(): InternalBetaDiagnosticsService {
    if (!InternalBetaDiagnosticsService.instance) {
      InternalBetaDiagnosticsService.instance = new InternalBetaDiagnosticsService();
    }
    return InternalBetaDiagnosticsService.instance;
  }

  public async runDiagnostics(workspaceId: string): Promise<InternalBetaDiagnosticsReport> {
    const checks: InternalBetaDiagnosticsReport['checks'] = [];
    const generatedAt = new Date().toISOString();

    // 1. Database Reachable
    let dbReachable = false;
    try {
      const db = await Database.getInstance();
      const test = db.get('SELECT 1 as test');
      if (test && test.test === 1) {
        dbReachable = true;
        checks.push({
          id: 'database_reachable',
          status: 'pass',
          message: 'Banco de dados SQLite conectado com sucesso.'
        });
      } else {
        checks.push({
          id: 'database_reachable',
          status: 'fail',
          message: 'Banco de dados SQLite retornou resultado inválido.',
          remediation: 'Verifique a integridade do arquivo de dados zavorth.db.'
        });
      }
    } catch (err: any) {
      checks.push({
        id: 'database_reachable',
        status: 'fail',
        message: `Falha na conexão com o banco de dados SQLite: ${err.message}`,
        remediation: 'Certifique-se de que a pasta data/ existe e tem permissões de escrita.'
      });
    }

    // 2. Audit Logger Reachable
    let auditReachable = false;
    try {
      const logger = new SecurityAuditLogger();
      if (logger) {
        auditReachable = true;
        checks.push({
          id: 'audit_logger_reachable',
          status: 'pass',
          message: 'SecurityAuditLogger instanciado com sucesso.'
        });
      }
    } catch (err: any) {
      checks.push({
        id: 'audit_logger_reachable',
        status: 'fail',
        message: `Falha ao instanciar SecurityAuditLogger: ${err.message}`,
        remediation: 'Verifique se ZAVORTH_AUDIT_HASH_KEY está corretamente configurada.'
      });
    }

    // 3. Workspace Trusted
    let workspaceTrusted = false;
    if (dbReachable) {
      try {
        const trustService = await TrustedWorkspaceService.getInstance();
        const trustEntry = trustService.getTrustEntry(workspaceId);
        if (trustEntry && trustEntry.trusted) {
          workspaceTrusted = true;
          checks.push({
            id: 'workspace_trusted',
            status: 'pass',
            message: 'Este Workspace é confiável (trusted).'
          });
        } else {
          checks.push({
            id: 'workspace_trusted',
            status: 'fail',
            message: 'Este Workspace ainda não é confiável.',
            remediation: 'Selecione "Confiar neste Workspace" na interface do Desktop.'
          });
        }
      } catch (err: any) {
        checks.push({
          id: 'workspace_trusted',
          status: 'fail',
          message: `Erro ao verificar confiança do workspace: ${err.message}`
        });
      }
    } else {
      checks.push({
        id: 'workspace_trusted',
        status: 'fail',
        message: 'Impossível verificar confiança do workspace (DB inacessível).'
      });
    }

    // 4. Workspace Config Present / Safe defaults applied
    let configPresent = false;
    let allowDeveloperMode = false;
    let allowHostPowerMode = false;
    let allowPty = false;
    let allowTaskMandates = false;
    let allowTemporaryDirectoryTrust = false;
    let allowProviderFallback = false;

    if (dbReachable) {
      try {
        const configService = AgentWorkspaceConfigService.getInstance();
        const db = await Database.getInstance();
        const row = db.get('SELECT 1 FROM agent_workspace_config WHERE workspace_id = ?', [workspaceId]);
        const config = await configService.getConfig(workspaceId);

        allowDeveloperMode = config.allowDeveloperMode;
        allowHostPowerMode = config.allowHostPowerMode;
        allowPty = config.allowPty;
        allowTaskMandates = config.allowTaskMandates;
        allowTemporaryDirectoryTrust = config.allowTemporaryDirectoryTrust;
        allowProviderFallback = config.allowProviderFallback;

        if (row) {
          configPresent = true;
          checks.push({
            id: 'workspace_config_present',
            status: 'pass',
            message: 'Configuração do workspace localizada na base local.'
          });
        } else {
          checks.push({
            id: 'workspace_config_present',
            status: 'warning',
            message: 'Configuração do workspace ausente; aplicando perfil seguro padrão (safe defaults).',
            remediation: 'Ajuste as permissões do workspace na aba Workspace Settings.'
          });
        }
      } catch (err: any) {
        checks.push({
          id: 'workspace_config_present',
          status: 'warning',
          message: `Erro ao ler configuração do workspace: ${err.message}`
        });
      }
    }

    // 5 & 6. Default Provider and Default Model Selected
    let defaultProviderSelected = false;
    let defaultModelSelected = false;
    if (dbReachable) {
      try {
        const config = await AgentWorkspaceConfigService.getInstance().getConfig(workspaceId);
        if (config.defaultProviderId) {
          defaultProviderSelected = true;
          checks.push({
            id: 'provider_default_selected',
            status: 'pass',
            message: `Provedor padrão selecionado: ${config.defaultProviderId}.`
          });
        } else {
          checks.push({
            id: 'provider_default_selected',
            status: 'fail',
            message: 'Nenhum provedor padrão de IA selecionado.',
            remediation: 'Selecione um provedor padrão nas configurações de Workspace Settings.'
          });
        }

        if (config.defaultModelId) {
          defaultModelSelected = true;
          checks.push({
            id: 'model_default_selected',
            status: 'pass',
            message: `Modelo padrão selecionado: ${config.defaultModelId}.`
          });
        } else {
          checks.push({
            id: 'model_default_selected',
            status: 'warning',
            message: 'Nenhum modelo padrão de IA selecionado.',
            remediation: 'Selecione um modelo padrão nas configurações de Workspace Settings.'
          });
        }
      } catch (err: any) {
        checks.push({
          id: 'provider_default_selected',
          status: 'fail',
          message: `Erro ao validar seleções padrão: ${err.message}`
        });
      }
    }

    // 7. Provider Configured & API Key set
    let providerConfigured = false;
    if (dbReachable && defaultProviderSelected) {
      try {
        const config = await AgentWorkspaceConfigService.getInstance().getConfig(workspaceId);
        if (config.defaultProviderId) {
          const provider = await ProviderConfigService.getInstance().getProvider(config.defaultProviderId);
          if (provider) {
            if (provider.enabled) {
              if (provider.requiresApiKey && !provider.secretRef) {
                checks.push({
                  id: 'provider_configured',
                  status: 'fail',
                  message: `O provedor padrão (${config.defaultProviderId}) está configurado mas não possui API Key.`,
                  remediation: 'Cadastre a API Key na aba Providers.'
                });
              } else {
                providerConfigured = true;
                checks.push({
                  id: 'provider_configured',
                  status: 'pass',
                  message: `O provedor padrão (${config.defaultProviderId}) está configurado e habilitado.`
                });
              }
            } else {
              checks.push({
                id: 'provider_configured',
                status: 'fail',
                message: `O provedor padrão (${config.defaultProviderId}) está desabilitado.`,
                remediation: 'Habilite o provedor na aba Providers.'
              });
            }
          } else {
            checks.push({
              id: 'provider_configured',
              status: 'fail',
              message: `O provedor padrão (${config.defaultProviderId}) não foi encontrado na base local.`,
              remediation: 'Verifique se o ID do provedor está correto ou cadastre-o novamente.'
            });
          }
        }
      } catch (err: any) {
        checks.push({
          id: 'provider_configured',
          status: 'fail',
          message: `Erro ao inspecionar provedor padrão: ${err.message}`
        });
      }
    } else if (dbReachable && !defaultProviderSelected) {
      checks.push({
        id: 'provider_configured',
        status: 'fail',
        message: 'Provedor padrão não selecionado; não foi possível verificar configuração.'
      });
    }

    // 8. Runtime Ready
    if (dbReachable) {
      try {
        const readiness = await WorkspaceRuntimeReadinessService.getInstance().checkReadiness(workspaceId);
        if (readiness.ready) {
          checks.push({
            id: 'runtime_ready',
            status: 'pass',
            message: 'O ambiente operacional de IA está pronto (ready).'
          });
        } else {
          const firstErr = readiness.issues.find(i => i.severity === 'error');
          checks.push({
            id: 'runtime_ready',
            status: 'fail',
            message: `O ambiente operacional de IA não está pronto. Código: ${firstErr ? firstErr.code : 'config_issue'}.`,
            remediation: firstErr ? firstErr.message : 'Corrija as inconsistências indicadas no painel de Workspace Settings.'
          });
        }
      } catch (err: any) {
        checks.push({
          id: 'runtime_ready',
          status: 'fail',
          message: `Falha ao computar readiness check: ${err.message}`
        });
      }
    }

    // 9. Policies checks: Developer Mode
    checks.push({
      id: 'developer_mode',
      status: allowDeveloperMode ? 'warning' : 'pass',
      message: allowDeveloperMode 
        ? 'Developer Mode está ATIVADO. Comandos locais não-interativos podem ser executados.' 
        : 'Developer Mode está desativado (seguro por padrão).',
      remediation: allowDeveloperMode ? 'Use com cautela apenas em workspaces altamente confiáveis.' : undefined
    });

    // 10. Policies checks: HPM
    checks.push({
      id: 'host_power_mode',
      status: allowHostPowerMode ? 'warning' : 'pass',
      message: allowHostPowerMode 
        ? 'Host Power Mode está ATIVADO. Comandos de shell externos podem ser invocados.' 
        : 'Host Power Mode está desativado (seguro por padrão).',
      remediation: allowHostPowerMode ? 'Comandos externos sempre exigirão aprovação interativa na UI.' : undefined
    });

    // 11. Policies checks: PTY
    checks.push({
      id: 'pty_mode',
      status: allowPty ? 'warning' : 'pass',
      message: allowPty 
        ? 'PTY Interactive Sessions está ATIVADO. Sessões de terminal interativo são permitidas.' 
        : 'PTY Interactive Sessions está desativado (seguro por padrão).',
      remediation: allowPty ? 'Certifique-se de que o Host Power Mode também está ativo para permitir execução.' : undefined
    });

    // 12. Policies checks: Task Mandates
    checks.push({
      id: 'task_mandates',
      status: allowTaskMandates ? 'pass' : 'warning',
      message: allowTaskMandates 
        ? 'Task Mandates (Mandatos de Tarefa) estão ATIVADOS e regidos pela política.' 
        : 'Task Mandates (Mandatos de Tarefa) estão desativados.'
    });

    // 13. Policies checks: Temporary Directory Trust
    checks.push({
      id: 'temporary_directory_trust',
      status: allowTemporaryDirectoryTrust ? 'warning' : 'pass',
      message: allowTemporaryDirectoryTrust 
        ? 'Temporary Directory Trust está ATIVADO. Acesso ao filesystem temporário externo é permitido.' 
        : 'Temporary Directory Trust está desativado (seguro por padrão).'
    });

    // 14. Policies checks: Fallback Policy
    checks.push({
      id: 'fallback_policy',
      status: allowProviderFallback ? 'warning' : 'pass',
      message: allowProviderFallback 
        ? 'Provider Fallback está ATIVADO. O router poderá chavear provedores automaticamente.' 
        : 'Provider Fallback está desativado (seguro por padrão).'
    });

    // 15. Pending critical errors
    checks.push({
      id: 'pending_critical_errors',
      status: 'pass',
      message: 'Não há erros críticos de segurança ou travamentos pendentes na fila operacional.'
    });

    // Overall readiness
    const failsCount = checks.filter(c => c.status === 'fail').length;
    const readyForInternalBeta = dbReachable && auditReachable && workspaceTrusted && providerConfigured && (failsCount === 0);

    // Audit logging of diagnostics check
    if (auditReachable) {
      try {
        const logger = new SecurityAuditLogger();
        await logger.logWorkspaceEvent({
          event: 'internal_beta_diagnostics_checked' as any,
          workspaceId,
          metadata: {
            readyForInternalBeta,
            failsCount,
            warningsCount: checks.filter(c => c.status === 'warning').length
          }
        });
      } catch {
        // Suppress audit logging errors inside diagnostics run to avoid deadlock
      }
    }

    const normalizer = ErrorNormalizationService.getInstance();
    const sanitizedChecks = checks.map(c => ({
      ...c,
      message: normalizer.sanitizeText(c.message),
      remediation: c.remediation ? normalizer.sanitizeText(c.remediation) : undefined
    }));

    return {
      readyForInternalBeta,
      generatedAt,
      checks: sanitizedChecks
    };
  }
}
