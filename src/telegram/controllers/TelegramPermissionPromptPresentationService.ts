import type { PermissionRequest } from '../../contracts/PermissionRequest.js';
import { FinalResponseFormattingService } from '../../services/FinalResponseFormattingService.js';
import type { TelegramPermissionPresentationPolicy } from './TelegramPermissionPresentationTypes.js';

export class TelegramPermissionPromptPresentationService {
  private readonly formatter = new FinalResponseFormattingService();

  constructor(private readonly policy: TelegramPermissionPresentationPolicy) {}

  public formatPermissionCreatedMessage(permission: PermissionRequest): string {
    const shortId = this.policy.shortPermissionId(permission);
    const summaryLines: string[] = [];
    const actionLines: string[] = [];
    const manualLines: string[] = [];
    const technicalLines: string[] = [];
    let intro = 'O Zavorth precisa da sua decisao antes de continuar esta tarefa.';

    if (permission.executor === 'external_executor' && permission.kind === 'agent_binding') {
      intro = 'Preciso da sua decisao para destravar este fluxo do ExternalExecutor.';
      summaryLines.push('O ExternalExecutor travou porque o agent atual nao esta liberado para este projeto.');
      summaryLines.push(`Projeto atual: ${permission.workspace || 'nao informado'}`);
      summaryLines.push(`Agent sugerido: ${permission.resolved_value || permission.requested_value || 'nao informado'}`);
      summaryLines.push(`Papel: ${this.policy.getExternalExecutorAgentRole(permission)}`);
      summaryLines.push(`Motivo: ${permission.reason}`);
      actionLines.push('"Usar neste projeto": libera esse agent somente para a workspace atual.');
      actionLines.push('"Salvar para futuros pedidos": reaproveita esse agent em pedidos futuros da mesma classe.');
      actionLines.push('"Rejeitar": cancela esse desbloqueio e a tarefa para aqui.');
    } else if (permission.executor === 'external_executor' && permission.kind === 'workspace_access') {
      intro = 'Preciso da sua liberacao para abrir esta pasta no ExternalExecutor e continuar a tarefa.';
      const requestedPath = permission.resolved_value || permission.requested_value || 'nao informado';
      summaryLines.push('O ExternalExecutor parou porque precisa ler um caminho fora do workspace ja aprovado.');
      summaryLines.push(`Projeto atual: ${permission.workspace || 'nao informado'}`);
      summaryLines.push(`Pasta pedida: ${requestedPath}`);
      summaryLines.push(`Nivel que sera liberado: ${this.policy.describePermissionAccessLevel(permission)}`);
      summaryLines.push(`Motivo: ${permission.reason}`);
      actionLines.push('"Liberar leitura so nesta tarefa": libera somente leitura/listagem dessa pasta nesta execucao.');
      actionLines.push('"Liberar leitura neste projeto": reaproveita essa mesma pasta para leitura/listagem em tarefas futuras desta workspace.');
      actionLines.push('"Rejeitar": bloqueia esse acesso e encerra a tentativa atual.');
    } else if (permission.executor === 'file_delivery' && permission.kind === 'workspace_access') {
      intro = 'Encontrei o caminho que voce pediu, mas antes preciso da sua liberacao para continuar.';
      const requestedPath = permission.resolved_value || permission.requested_value || 'nao informado';
      if (permission.metadata?.permission_source === 'file_inspection') {
        summaryLines.push('O Zavorth encontrou o caminho pedido, mas ele ainda nao esta liberado para comparacao ou inspecao local.');
      } else {
        summaryLines.push('O Zavorth encontrou o caminho pedido, mas ele ainda nao esta liberado para leitura e envio local.');
      }
      summaryLines.push(`Pasta pedida: ${requestedPath}`);
      summaryLines.push(`Nivel que sera liberado: ${this.policy.describePermissionAccessLevel(permission)}`);
      summaryLines.push(`Motivo: ${permission.reason}`);
      if (permission.metadata?.permission_source === 'file_inspection') {
        actionLines.push('"Liberar leitura so nesta tarefa": libera somente leitura/listagem desta pasta para esta comparacao ou inspecao.');
        actionLines.push('"Liberar leitura neste projeto": reaproveita essa mesma pasta para comparacoes e inspecoes futuras deste Zavorth.');
      } else {
        actionLines.push('"Liberar leitura so nesta tarefa": libera somente leitura/listagem desta pasta para este pedido atual.');
        actionLines.push('"Liberar leitura neste projeto": reaproveita essa mesma pasta para leitura/listagem em pedidos futuros deste Zavorth.');
      }
      actionLines.push('"Rejeitar": bloqueia esse acesso e encerra a tentativa atual.');
    } else if (permission.executor === 'aistudio' && permission.kind === 'builtin_tool_access') {
      intro = 'O Google AI Studio precisa dessas tools antes de continuar esta tarefa.';
      summaryLines.push('O Google AI Studio quer usar tools oficiais do Gemini API antes de continuar.');
      summaryLines.push(`Projeto atual: ${permission.workspace || 'nao informado'}`);
      summaryLines.push(`Tools pedidas: ${this.policy.describeAiStudioPermissionValues(permission)}`);
      summaryLines.push(`Motivo: ${permission.reason}`);
      if (permission.metadata?.suggested_model) {
        summaryLines.push(`Modelo sugerido: ${permission.metadata.suggested_model}`);
      }
      actionLines.push('"Liberar so esta tarefa": libera essas tools apenas nesta execucao.');
      actionLines.push('"Liberar neste projeto": reaproveita essas tools em tarefas futuras desta workspace.');
      actionLines.push('"Rejeitar": bloqueia esse uso e encerra a tentativa atual.');
    } else if (permission.executor === 'aistudio' && permission.kind === 'service_access') {
      intro = 'O Google AI Studio pediu um acesso extra antes de continuar esta tarefa.';
      summaryLines.push('O Google AI Studio pediu acesso a um servico externo durante a geracao.');
      summaryLines.push(`Projeto atual: ${permission.workspace || 'nao informado'}`);
      summaryLines.push(`Servico(s) pedidos: ${this.policy.describeAiStudioPermissionValues(permission)}`);
      summaryLines.push(`Motivo: ${permission.reason}`);
      if (permission.metadata?.service_request_reason) {
        summaryLines.push(`Pedido do modelo: ${permission.metadata.service_request_reason}`);
      }
      if (permission.metadata?.suggested_model) {
        summaryLines.push(`Modelo sugerido: ${permission.metadata.suggested_model}`);
      }
      actionLines.push('"Permitir so esta tarefa": libera esse servico apenas nesta execucao.');
      actionLines.push('"Permitir neste projeto": reaproveita esse servico em tarefas futuras desta workspace.');
      actionLines.push('"Rejeitar": bloqueia esse acesso e encerra a tentativa atual.');
    } else {
      summaryLines.push(`Categoria: ${this.policy.describePermissionSubject(permission)}`);
      summaryLines.push(`Escopo: ${this.policy.describePermissionScope(permission.scope)}`);
      summaryLines.push(`Motivo: ${permission.reason}`);
    }

    if (permission.workspace) {
      summaryLines.push(`Workspace: ${permission.workspace}`);
    }
    if (permission.executor === 'zavorthBridge' && permission.kind === 'ui_permission') {
      intro = 'O ZavorthBridge parou aguardando sua decisao nesta conversa.';
      summaryLines.push('Aprovacao recomendada: use "Aprovar conversa" para evitar repetir esse prompt no mesmo chat do ZavorthBridge.');
    }
    if (
      permission.executor === 'zavorthBridge' &&
      permission.kind === 'ui_permission' &&
      permission.metadata?.permission_prompt_summary
    ) {
      summaryLines.push(`Prompt detectado: ${permission.metadata.permission_prompt_summary}`);
    }
    if (
      permission.requested_value &&
      !(
        (permission.executor === 'external_executor' && ['agent_binding', 'workspace_access'].includes(permission.kind)) ||
        (permission.executor === 'file_delivery' && permission.kind === 'workspace_access')
      )
    ) {
      summaryLines.push(`Pedido: ${permission.requested_value}`);
    }
    if (
      permission.resolved_value &&
      !(
        (permission.executor === 'external_executor' && ['agent_binding', 'workspace_access'].includes(permission.kind)) ||
        (permission.executor === 'file_delivery' && permission.kind === 'workspace_access')
      )
    ) {
      summaryLines.push(`Sugestao atual: ${permission.resolved_value}`);
    }
    if (permission.metadata?.suggested_command) {
      technicalLines.push(`Sugestao tecnica: ${permission.metadata.suggested_command}`);
    }
    if (permission.kind === 'command_access') {
      summaryLines.push(`Regra de comando: ${this.policy.describePermissionCommandMatchType(permission)}`);
    }

    if (permission.executor === 'external_executor' && permission.kind === 'workspace_access') {
      manualLines.push(`Para aprovar so esta tarefa: /perm approve ${shortId} scope=once access=${this.policy.getPermissionAccessLevel(permission)}`);
      manualLines.push(`Para ampliar ao workspace atual: /perm approve ${shortId} scope=workspace access=${this.policy.getPermissionAccessLevel(permission)}`);
    } else if (permission.executor === 'file_delivery' && permission.kind === 'workspace_access') {
      manualLines.push(`Para aprovar so esta tarefa: /perm approve ${shortId} scope=once access=${this.policy.getPermissionAccessLevel(permission)}`);
      manualLines.push(`Para ampliar ao Zavorth atual: /perm approve ${shortId} scope=workspace access=${this.policy.getPermissionAccessLevel(permission)}`);
    } else if (permission.executor === 'aistudio' && permission.kind === 'builtin_tool_access') {
      manualLines.push(`Para liberar so esta tarefa: /perm approve ${shortId} scope=once`);
      manualLines.push(`Para liberar neste projeto: /perm approve ${shortId} scope=workspace`);
    } else if (permission.executor === 'aistudio' && permission.kind === 'service_access') {
      manualLines.push(`Para permitir so esta tarefa: /perm approve ${shortId} scope=once`);
      manualLines.push(`Para permitir neste projeto: /perm approve ${shortId} scope=workspace`);
    } else if (permission.executor === 'zavorthBridge' && permission.kind === 'ui_permission') {
      manualLines.push(`Para aprovar esta conversa: /perm approve ${shortId} scope=session`);
      manualLines.push(`Para aprovar so esta vez: /perm approve ${shortId} scope=once`);
    } else if (permission.executor === 'external_executor' && permission.kind === 'agent_binding') {
      manualLines.push(`Para usar neste projeto: /perm approve ${shortId} scope=workspace`);
      manualLines.push(`Para salvar para futuros pedidos: /perm approve ${shortId} scope=persistent`);
    } else if (permission.kind === 'command_access') {
      manualLines.push(`Para aprovar: /perm approve ${shortId} match=${this.policy.getPermissionCommandMatchType(permission)}`);
    } else {
      manualLines.push(`Para aprovar: /perm approve ${shortId}`);
    }
    manualLines.push(`Para ajustar antes: /perm edit ${shortId} resolved=novo_valor scope=workspace`);
    manualLines.push(`Para rejeitar: /perm reject ${shortId}`);

    return this.formatter.formatPermissionPrompt({
      title: `Aprovacao necessaria - ${this.policy.describePermissionSubject(permission)}`,
      shortId,
      intro,
      summaryLines,
      actionLines,
      manualLines: ['Se preferir, voce tambem pode usar comandos manuais.', ...manualLines],
      technicalLines,
    });
  }
}
