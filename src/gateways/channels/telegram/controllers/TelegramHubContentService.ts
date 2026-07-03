import * as path from 'path';
import { config } from '../../../../config/index.js';
import { ZavorthBridgePreferenceStore } from '../../../../agents/ZavorthBridgePreferenceStore.js';
import { PermissionService } from '../../../../services/PermissionService.js';
import { SkillLibraryPresentationService } from '../../../../services/SkillLibraryPresentationService.js';
import { HubRecipeKind, HubSection } from '../../../../gateways/channels/telegram/controllers/TelegramHubTypes.js';

export type TelegramHubContentServiceDeps = {
  zavorthBridgePreferenceStore: Pick<ZavorthBridgePreferenceStore, 'getPreferredModel'>;
  permissionService: Pick<PermissionService, 'listRequests'>;
  isDemoModeEnabled: () => boolean;
  isOperatorModeEnabled: () => boolean;
  isPresentationModeEnabled: () => boolean;
  skillLibraryPresentationService?: Pick<SkillLibraryPresentationService, 'buildSnapshot'>;
};

export class TelegramHubContentService {
  private readonly skillLibraryPresentationService: Pick<SkillLibraryPresentationService, 'buildSnapshot'>;

  constructor(private readonly deps: TelegramHubContentServiceDeps) {
    this.skillLibraryPresentationService =
      deps.skillLibraryPresentationService || new SkillLibraryPresentationService();
  }

  public async buildHubPageText(section: HubSection): Promise<string> {
    const preferredZavorthBridgeModel = await this.deps.zavorthBridgePreferenceStore.getPreferredModel();
    const pendingPermissions = await this.deps.permissionService.listRequests('pending', 5);
    const workspaceLabel = path.basename(config.defaultWorkspace) || config.defaultWorkspace;

    switch (section) {
      case 'onboarding1':
        return [
          '*Conhecendo o Zavorth (1/3)*',
          '',
          'O Zavorth e seu assistente para pesquisa, codigo, arquivos, automacao e operacao do ambiente.',
          'Ele escolhe a melhor rota para cada pedido e tenta manter a experiencia simples para quem esta usando.',
        ].join('\n');
      case 'onboarding2':
        return [
          '*Como a seguranca funciona (2/3)*',
          '',
          'Quando um pedido passa por risco, permissao ou acesso extra, o Zavorth para e te mostra exatamente o que precisa ser liberado.',
          'Isso ajuda a manter o sistema poderoso por dentro e previsivel por fora.',
        ].join('\n');
      case 'onboarding3':
        return [
          '*Como comecar bem (3/3)*',
          '',
          'Comece escrevendo o pedido em linguagem natural. O Zavorth escolhe rota, ferramenta e proximo passo.',
          'Use `Guia rapido` e `Receitas` apenas quando quiser exemplos ou navegacao manual.',
          'Se quiser uma experiencia mais polida para mostrar, ligue `/presentation on` ou `/demo on`.',
        ].join('\n');
      case 'quickstart':
        return [
          '*Guia rapido*',
          '',
          '1. Fale naturalmente quando quiser rapidez.',
          '2. Use comandos apenas quando quiser controle de operador, como `/codex`, `/external`, `/ag`, `/research` ou `/stitch`.',
          '3. Acompanhe diagnostico e permissoes em `/status` e `/perm list`.',
        ].join('\n');
      case 'integrations':
        return [
          '*Motores e integracoes*',
          '',
          'O Zavorth trabalha com rotas diferentes dependendo do pedido.',
          '',
          '- **Codex** para codigo local e automacao no host.',
          '- **ExternalExecutor** para execucao e revisao no WSL.',
          '- **ZavorthBridge** para fluxos guiados por interface.',
          '- **AI Studio**, **Gemini**, **Jules** e **Stitch** para pesquisa, analise e geracao.',
        ].join('\n');
      case 'skills': {
        const snapshot = this.skillLibraryPresentationService.buildSnapshot();
        const topBundle = snapshot.bundles[0] || null;
        const topVendor = snapshot.vendors[0] || null;
        const trustSummary = snapshot.trust
          .map((entry) => `${entry.trust} ${entry.count}`)
          .join(' | ');
        return [
          '*Biblioteca de skills*',
          '',
          snapshot.narrative.operatorSummary,
          `Recipes prontas: ${snapshot.catalog.summary.readyRecipes}/${snapshot.catalog.summary.recipes}.`,
          `Trust atual: ${trustSummary || 'sem dados'}.`,
          topBundle
            ? `Bundle mais forte agora: *${topBundle.tag}* com ${topBundle.skillCount} skill(s).`
            : 'Nenhum bundle em destaque agora.',
          topVendor
            ? `Vendor observado: *${topVendor.displayName}* -> ${topVendor.summary}`
            : 'Nenhum vendor de apoio registrado agora.',
          '',
          'Atalhos uteis:',
          '- `/skills library` para abrir a biblioteca completa',
          '- `/skills bridge` para ver skills prontas para bridge governado',
          '- `/skills run <skill>` para preparar dry-run seguro',
          '- `/skills plan recipe spec-driven-delivery` para um plano base',
          '- `/skills mcp` para ver tools e resources do sidecar',
        ].join('\n');
      }
      case 'recipes':
        return [
          '*Receitas prontas*',
          '',
          'Use estes exemplos para mostrar o Zavorth de forma clara:',
          '',
          '- `/research pesquise as principais noticias de IA de hoje`',
          '- `/arquivo me envie o index.html da pasta ...`',
          '- `/workflow ship implemente a tela e revise o resultado`',
          '- `/stitch crie uma landing page moderna para um app de tarefas`',
          '',
          'Se quiser um roteiro guiado, use `/demo`.',
        ].join('\n');
      case 'security':
        return [
          '*Seguranca e controle*',
          '',
          'O Zavorth nao executa acoes sensiveis no escuro.',
          'Pedidos de risco, acesso extra a pastas e certos fluxos guiados passam por politica e aprovacao antes de continuar.',
          '',
          'Se quiser endurecer o comportamento, use `/lock`, `/operator on` ou trabalhe em modo apresentacao/demo.',
        ].join('\n');
      case 'permissions':
        return [
          '*Permissoes e aprovacoes*',
          '',
          `Pendencias agora: *${pendingPermissions.length}*.`,
          '',
          'Quando uma aprovacao aparece, a ideia e simples: te mostrar o que vai acontecer antes de continuar.',
          'Abra a fila de pendencias para aprovar, rejeitar ou revisar o contexto de cada pedido.',
        ].join('\n');
      case 'settings':
        return [
          '*Ajustes do Zavorth*',
          '',
          `Workspace principal: \`${workspaceLabel}\``,
          `Provider atual: \`${config.llmProvider}\``,
          `Modelo preferido do ZavorthBridge: \`${preferredZavorthBridgeModel || 'ainda nao definido'}\``,
          `Permissoes pendentes: \`${pendingPermissions.length}\``,
          '',
          'Modos agora:',
          `- Apresentacao: ${this.deps.isPresentationModeEnabled() ? 'ativo' : 'inativo'}`,
          `- Demo: ${this.deps.isDemoModeEnabled() ? 'ativo' : 'inativo'}`,
          `- Operador: ${this.deps.isOperatorModeEnabled() ? 'ativo' : 'inativo'}`,
          '',
          'Atalhos uteis:',
          '- `/models` para ver os modelos ativos',
          '- `/presentation on|off` para ajustar o tom',
          '- `/operator on|off` para exigir confirmacao antes de agir',
          '- `/demo on|off` para preparar uma demonstracao',
          '- `/zavorthControl` para abrir o painel web',
        ].join('\n');
      case 'actions':
        return [
          '*Acoes rapidas*',
          '',
          'Estes atalhos sao apoio manual para diagnostico, permissoes e operacao. Para tarefas comuns, escreva o pedido em linguagem natural.',
        ].join('\n');
      case 'overview':
      default:
        return [
          '*Zavorth*',
          '',
          'Seu assistente para pesquisa, arquivos, codigo, automacao e operacao do ambiente.',
          '',
          `Provider atual: \`${config.llmProvider}\``,
          `Workspace principal: \`${workspaceLabel}\``,
          `Pendencias abertas: \`${pendingPermissions.length}\``,
          '',
          'Este hub e apoio manual para diagnostico, ajustes, permissoes e demo. A entrada principal continua sendo linguagem natural.',
        ].join('\n');
    }
  }

  public formatRecipeMessage(kind: HubRecipeKind): string {
    switch (kind) {
      case 'codex':
        return [
          '*Receita: Codex*',
          '',
          'Use o Codex quando quiser mexer em codigo local ou automatizar uma alteracao no host.',
          '`/codex crie um painel Next.js para um app interno`',
          '`/dryrun npm run build` para simular antes de agir',
        ].join('\n');
      case 'external_executor':
        return [
          '*Receita: ExternalExecutor*',
          '',
          'Use o ExternalExecutor para revisao, exploracao e execucao isolada no WSL.',
          '`/external revise este modulo e me devolva os principais riscos`',
        ].join('\n');
      case 'zavorthBridge':
        return [
          '*Receita: ZavorthBridge*',
          '',
          'Use o ZavorthBridge quando a tarefa depender da interface ou de um fluxo visual guiado.',
          '`/ag leia esta tela e me diga o que esta acontecendo`',
        ].join('\n');
      case 'permissions':
      default:
        return [
          '*Receita: Permissoes*',
          '',
          'Quando eu precisar passar de um limite seguro, eu paro e peco confirmacao.',
          '`/perm list pending`',
        ].join('\n');
    }
  }
}
