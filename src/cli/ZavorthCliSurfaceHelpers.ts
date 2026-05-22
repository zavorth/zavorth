import * as path from 'path';
import { config } from '../config/index.js';
import type { ZavorthCliFlags } from './ZavorthCliContract.js';
import type { ZavorthGatewaySnapshot } from '../services/ZavorthGatewayService.js';
import { ZavorthMemoryPlaneService } from '../services/ZavorthMemoryPlaneService.js';
import {
  ZavorthLearningPlaneService,
  type LearningPlaneActionExecution,
  type LearningPlaneSnapshot,
} from '../services/ZavorthLearningPlaneService.js';
import type { ZavorthLayeredMemoryService } from '../services/ZavorthLayeredMemoryService.js';
import type {
  ZavorthPlatformRegistrySnapshot,
} from '../services/ZavorthPlatformRegistryService.js';
import { ZavorthPlatformCatalogSyncService } from '../services/ZavorthPlatformCatalogSyncService.js';
import { CLI_REPL_HISTORY_FILE } from './ZavorthCliReplConfig.js';
import { formatAdditionalCount, formatCliValue, formatCount, sanitizeHumanCliText } from './ZavorthCliText.js';
import { renderCliScreen, type CliVisualPanel } from './ZavorthCliVisualSystem.js';
import {
  ZAVORTH_CLI_BRAND_NAME,
  formatZavorthMascotBlock,
} from './ZavorthCliMascot.js';
import { padCliVisualText, paintCliTone, stripCliAnsi } from './ZavorthCliVisualTheme.js';

export type CliHelpSnapshot = {
  surface: 'zavorth-cli';
  topic:
    | 'root'
    | 'start'
    | 'demo'
    | 'connectors'
    | 'onboard'
    | 'go'
    | 'dashboard'
    | 'chat'
    | 'run'
    | 'continue'
    | 'status'
    | 'doctor'
    | 'templates'
    | 'missions'
    | 'receipts'
    | 'advanced'
    | 'ops'
    | 'sessions'
    | 'nodes'
    | 'reference';
  title: string;
  summary: string;
  sections: Array<{
    title: string;
    entries: Array<{
      command?: string;
      summary: string;
    }>;
  }>;
  notesTitle?: string;
  notes: string[];
};

type CliHelpTopic = CliHelpSnapshot['topic'];
type CliHelpPage = Omit<CliHelpSnapshot, 'surface'>;

export type CliContextSnapshot = {
  surface: 'zavorth-cli';
  userId: string;
  platform: ZavorthCliFlags['platform'];
  chatId: string;
  sessionId: string;
  workspace: string;
  workspaceHint: string | null;
  historyFile: string;
  notes: string[];
};

export type CliChatWelcomeSnapshot = {
  surface: 'zavorth-cli';
  title: string;
  summary: string;
  sections: Array<{
    title: string;
    entries: Array<{
      command?: string;
      summary: string;
    }>;
  }>;
  notesTitle?: string;
  notes: string[];
};

export type CliDomainsSnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    initialized: number;
    pending: number;
  };
  domains: Array<{
    id: string;
    label: string;
    initialized: boolean;
    initializedAt: string | null;
    summary?: string;
    metrics?: Record<string, unknown>;
  }>;
};

export type CliStatusSnapshot = {
  generatedAt: string;
  headline: string;
  nextAction: {
    label: string;
    command: string;
    reason: string;
  } | null;
  brief: {
    posture: string;
    headline: string;
  } | null;
  cockpit: {
    status: string;
    headline: string;
    topAlert: string | null;
  } | null;
  gateway: {
    channelsReady: number;
    channelsTotal: number;
    runtimeModesReady: number;
    securityPosture: string;
  } | null;
  domains: {
    total: number;
    initialized: number;
    pending: number;
  } | null;
  platform: {
    plugins: number;
    skills: number;
    mcps: number;
    collections: number;
    recipes: number;
    syncSummary: string | null;
  } | null;
  sessions: {
    total: number;
    historyItems: number;
    pendingPermissions: number;
    sendReady: boolean;
    spawnReady: boolean;
  } | null;
  nodes: {
    total: number;
    paired: number;
    online: number;
    queued: number;
    staleQueued: number;
  } | null;
  transports: {
    status: string;
    healthy: number;
    total: number;
    stale: boolean;
    summary: string | null;
    recommendedAction: string | null;
  } | null;
};

const CLI_HELP_TOPIC_ALIASES: Record<string, CliHelpTopic> = {
  onboard: 'onboard',
  setup: 'onboard',
  init: 'onboard',
  start: 'start',
  quickstart: 'start',
  comecar: 'start',
  demo: 'demo',
  demonstracao: 'demo',
  connectors: 'connectors',
  connector: 'connectors',
  conectores: 'connectors',
  channels: 'connectors',
  channel: 'connectors',
  canais: 'connectors',
  canal: 'connectors',
  go: 'go',
  dashboard: 'dashboard',
  control: 'dashboard',
  'command-center': 'dashboard',
  commandcenter: 'dashboard',
  chat: 'chat',
  run: 'run',
  task: 'run',
  continue: 'continue',
  status: 'status',
  doctor: 'doctor',
  templates: 'templates',
  template: 'templates',
  missions: 'missions',
  mission: 'missions',
  receipts: 'receipts',
  receipt: 'receipts',
  advanced: 'advanced',
  avancado: 'advanced',
  capabilities: 'advanced',
  capability: 'advanced',
  supervisor: 'advanced',
  graph: 'advanced',
  ops: 'ops',
  cockpit: 'ops',
  operations: 'ops',
  heal: 'ops',
  selfheal: 'ops',
  release: 'ops',
  releases: 'ops',
  presence: 'ops',
  sessions: 'sessions',
  tasks: 'sessions',
  artifacts: 'sessions',
  workflows: 'sessions',
  workflowqueue: 'sessions',
  history: 'sessions',
  nodes: 'nodes',
  node: 'nodes',
  devices: 'nodes',
  companions: 'nodes',
  reference: 'reference',
  referencia: 'reference',
  all: 'reference',
  full: 'reference',
  completo: 'reference',
  completa: 'reference',
};

const CLI_COMMAND_HELP_PAGES: Record<Exclude<CliHelpTopic, 'root'>, CliHelpPage> = {
  start: {
    topic: 'start',
    title: 'zavorth start',
    summary: 'Liga ou retoma o runtime local e abre a superficie principal do Zavorth.',
    sections: [
      {
        title: 'Use quando',
        entries: [
          { summary: 'Voce quer ligar o Zavorth sem decorar scripts internos.' },
          { summary: 'Voce quer abrir o dashboard local e continuar o trabalho diario.' },
        ],
      },
      {
        title: 'Comandos',
        entries: [
          { command: 'zavorth start', summary: 'Liga ou retoma o runtime local e abre o dashboard.' },
          { command: 'zavorth open', summary: 'Abre o dashboard local sem reler documentacao.' },
          { command: 'zavorth ready', summary: 'Confere provider, canais, approvals e readiness.' },
          { command: 'zavorth setup', summary: 'Roda o Setup Studio quando ainda faltar configuracao.' },
        ],
      },
    ],
    notesTitle: 'Seguro',
    notes: [
      'O start nao remove approvals nem publica em canal externo.',
      'Acoes sensiveis continuam preview/approval/receipt.',
    ],
  },
  demo: {
    topic: 'demo',
    title: 'zavorth demo',
    summary: 'Mostra o caminho de produto, a demo visual local e o checklist honesto dos conectores.',
    sections: [
      {
        title: 'Use quando',
        entries: [
          { summary: 'Voce quer provar o Zavorth como produto antes de decorar comandos internos.' },
          { summary: 'Voce quer abrir o Home, ver o roteiro e entender se GitHub ou Telegram ainda precisam setup.' },
        ],
      },
      {
        title: 'Comandos',
        entries: [
          { command: 'zavorth demo', summary: 'Mostra o roteiro de produto, Home, checklists e smoke.' },
          { command: 'zavorth demo browser', summary: 'Abre a demo visual local no browser.' },
          { command: 'zavorth demo doctor', summary: 'Mostra somente o que falta para GitHub, Telegram e demo local.' },
          { command: 'zavorth demo --json', summary: 'Exporta a mesma verdade para automacao.' },
          { command: 'zavorth go', summary: 'Abre o Home visual em /dashboard.' },
        ],
      },
      {
        title: 'Seguro',
        entries: [
          { summary: 'A demo nao cola secrets, nao finge conectores live e nao posta em PR sem approval.' },
          { summary: 'O smoke usa fixtures deterministicas; uso real de GitHub/Telegram continua approval-aware.' },
        ],
      },
    ],
    notesTitle: 'Depois',
    notes: [
      'Rode: zavorth go',
      'Conectores: zavorth connectors doctor',
      'Depois: zavorth review github --pr=<number> --repo=<owner/repo>',
      'Para Telegram: zavorth connectors setup telegram --apply --allowed-user=<id>',
    ],
  },
  connectors: {
    topic: 'connectors',
    title: 'zavorth connectors',
    summary: 'Wizards e doctors para canais como Telegram, Discord, Slack, WhatsApp, Signal e Email sem aceitar secrets crus no prompt.',
    sections: [
      {
        title: 'Doctor',
        entries: [
          { command: 'zavorth connectors doctor', summary: 'Mostra todos os conectores publicos e exatamente o que falta.' },
          { command: 'zavorth connectors doctor telegram', summary: 'Foca Telegram e roda doctor de provider quando disponivel.' },
          { command: 'zavorth connectors doctor discord', summary: 'Foca Discord e mostra setup minimo para bot/guild/canais.' },
          { command: 'zavorth connectors doctor --json', summary: 'Exporta o mesmo diagnostico para automacao.' },
        ],
      },
      {
        title: 'Setup',
        entries: [
          { command: 'zavorth channels telegram', summary: 'Wizard bonito para token, allowlist e policy do Telegram.' },
          { command: 'zavorth channels discord', summary: 'Wizard bonito para token, guild/canal e owners do Discord.' },
          { command: 'zavorth channels slack|whatsapp|signal|email', summary: 'Prepara canais configuraveis sem declarar live antes da prova.' },
          { command: 'zavorth channels telegram --apply --allowed-users=<id>', summary: 'Escreve .env local com valores redigidos na tela.' },
        ],
      },
    ],
    notesTitle: 'Seguro',
    notes: [
      'GitHub usa gh auth login; Zavorth nao grava credenciais GitHub por voce.',
      'Wizards de canais preservam secrets existentes, nao postam mensagens reais e so gravam com --apply.',
    ],
  },
  onboard: {
    topic: 'onboard',
    title: 'zavorth setup',
    summary: 'Setup Studio: configura workspace, provider, modelo, canais, Mnemos e seguranca em um fluxo guiado.',
    sections: [
      {
        title: 'Primeiro uso',
        entries: [
          { summary: 'Pergunta como chamar voce, nome do agente, tom e workspace principal.' },
          { summary: 'Permite escolher provider/modelo e inserir chave em campo secreto.' },
          { summary: 'Configura Telegram, Mnemos/cofre e postura de approvals sem iniciar runtime persistente.' },
        ],
      },
      {
        title: 'Preview',
        entries: [
          { command: 'zavorth setup --dry-run', summary: 'Mostra o plano sem gravar arquivos.' },
          { command: 'zavorth onboard --dry-run', summary: 'Alias amigavel para o mesmo preview de setup.' },
          { command: 'zavorth setup --json --dry-run', summary: 'Mostra snapshot redigido para automacao segura.' },
        ],
      },
      {
        title: 'Depois',
        entries: [
          { command: 'zavorth ready', summary: 'Confere se o setup esta pronto para uso diario.' },
          { command: 'zavorth start', summary: 'Liga o runtime local.' },
          { command: 'zavorth open', summary: 'Abre o dashboard.' },
          { command: 'zavorth chat', summary: 'Conversa pelo terminal quando preferir nao abrir o painel.' },
        ],
      },
    ],
    notesTitle: 'Seguro',
    notes: [
      'Setup deve ser idempotente: repetir o comando revisa o ambiente em vez de executar algo perigoso.',
    ],
  },
  go: {
    topic: 'go',
    title: 'zavorth go',
    summary: 'Abre o Zavorth Home em /dashboard ou explica exatamente o bloqueio.',
    sections: [
      {
        title: 'Use quando',
        entries: [
          { summary: 'You want the simple Home: Inbox, Tasks, Approvals, Receipts and Connectors.' },
          { summary: 'Quiser retomar o Zavorth depois do setup sem decorar nomes internos.' },
        ],
      },
      {
        title: 'Modo seguro',
        entries: [
          { command: 'zavorth go --dry-run', summary: 'Mostra URL, bloqueio e proximo comando sem iniciar runtime persistente.' },
          { command: 'zavorth doctor', summary: 'Aprofunda o diagnostico quando o dry-run apontar bloqueio.' },
        ],
      },
      {
        title: 'Depois',
        entries: [
          { command: 'zavorth chat', summary: 'Conversa pelo terminal.' },
          { command: 'zavorth receipts', summary: 'Ve recibos do que aconteceu ou foi bloqueado.' },
          { command: 'zavorth status', summary: 'Confirma se o runtime ficou pronto.' },
        ],
      },
    ],
    notesTitle: 'Saida esperada',
    notes: [
      'Quando nao conseguir abrir, o comando deve mostrar causa provavel e proximo passo, nao stack trace.',
    ],
  },
  dashboard: {
    topic: 'dashboard',
    title: 'zavorth dashboard',
    summary: 'Abre o Zavorth Home de um jeito humano, ja com acesso local quando possivel.',
    sections: [
      {
        title: 'Use quando',
        entries: [
          { summary: 'You want to open the visual gateway without hunting for a token in .env.' },
          { summary: 'You want to copy a local unlocked link into the browser.' },
        ],
      },
      {
        title: 'Comandos',
        entries: [
          { command: 'zavorth dashboard', summary: 'Abre o Home ja com o token local aplicado.' },
          { command: 'zavorth dashboard url', summary: 'Mostra um link local com token para copiar e colar.' },
          { command: 'zavorth dashboard token', summary: 'Mostra o token local quando voce realmente precisar copiar manualmente.' },
          { command: 'zavorth dashboard status', summary: 'Mostra de onde vem o acesso local sem revelar o token.' },
          { command: 'zavorth dashboard doctor', summary: 'Diagnostica token ausente, antigo ou arquivo local quebrado.' },
          { command: 'zavorth dashboard repair', summary: 'Cria/corrige o token local quando ele vem do arquivo de runtime.' },
          { command: 'zavorth dashboard generate-token', summary: 'Gera um novo token local quando ZAVORTH_WEB_AUTH_TOKEN nao esta fixo.' },
        ],
      },
    ],
    notesTitle: 'Seguranca',
    notes: [
      'O link/token e local desta instalacao. Nao compartilhe em chat, print ou issue publica.',
      'O dashboard salva o token apenas na aba atual do navegador.',
      'Se uma aba antiga disser token invalido, abra uma nova com "zavorth dashboard".',
    ],
  },
  chat: {
    topic: 'chat',
    title: 'zavorth chat',
    summary: 'Abre a conversa principal do Zavorth no terminal.',
    sections: [
      {
        title: 'Use quando',
        entries: [
          { summary: 'Quiser conversar normalmente com o Zavorth, sem decorar comandos.' },
        ],
      },
      {
        title: 'Exemplos',
        entries: [
          { command: 'revisar este modulo', summary: 'Pede uma analise rapida do codigo atual.' },
          { command: 'retome o que estavamos fazendo', summary: 'Continua o trabalho atual dentro do chat.' },
          { command: 'compare o que mudou nesta pasta', summary: 'Resume mudancas desta pasta.' },
        ],
      },
      {
        title: 'Atalhos uteis',
        entries: [
          { command: 'status', summary: 'Mostra se o Zavorth esta pronto para uso.' },
          { command: 'doctor', summary: 'Diagnostica problemas e sugere o proximo passo.' },
          { command: 'history', summary: 'Mostra sessoes recentes ou o replay de uma sessao.' },
          { command: 'quit', summary: 'Encerra o chat atual.' },
        ],
      },
    ],
    notesTitle: 'Dica rapida',
    notes: [
      'No chat, qualquer texto livre vira um pedido automaticamente.',
    ],
  },
  run: {
    topic: 'run',
    title: 'zavorth run "<pedido>"',
    summary: 'Envia um pedido em linguagem natural sem abrir o chat interativo.',
    sections: [
      {
        title: 'Use quando',
        entries: [
          { summary: 'Quiser fazer um pedido direto e voltar para o terminal normal.' },
        ],
      },
      {
        title: 'Exemplos',
        entries: [
          { command: 'zavorth run "revisar este modulo"', summary: 'Envia um pedido unico para analise.' },
          { command: 'zavorth run "compare o que mudou nesta pasta"', summary: 'Pede uma leitura rapida do workspace.' },
        ],
      },
      {
        title: 'Se quiser continuar depois',
        entries: [
          { command: 'zavorth continue', summary: 'Retoma o mesmo trabalho sem precisar lembrar comandos especiais.' },
          { command: 'zavorth chat', summary: 'Abre uma conversa completa no terminal.' },
        ],
      },
    ],
    notesTitle: 'Dica rapida',
    notes: [
      'Se preferir conversar em varias mensagens, use zavorth chat.',
    ],
  },
  continue: {
    topic: 'continue',
    title: 'zavorth continue',
    summary: 'Retoma o trabalho atual em linguagem natural sem precisar lembrar comandos especiais.',
    sections: [
      {
        title: 'Use quando',
        entries: [
          { summary: 'Quiser pedir para o Zavorth continuar de onde parou.' },
        ],
      },
      {
        title: 'Exemplos',
        entries: [
          { command: 'zavorth continue', summary: 'Retoma o trabalho atual sem contexto extra.' },
          { command: 'zavorth continue "agora foque na documentacao"', summary: 'Retoma e muda o foco do trabalho.' },
        ],
      },
      {
        title: 'Se quiser mais contexto',
        entries: [
          { command: 'zavorth history', summary: 'Mostra sessoes recentes ou o replay de uma sessao.' },
          { command: 'zavorth status', summary: 'Resume se o Zavorth esta pronto para continuar.' },
        ],
      },
    ],
    notesTitle: 'Dica rapida',
    notes: [
      'Se ainda nao existe uma linha de trabalho aberta, use zavorth run ou zavorth chat primeiro.',
    ],
  },
  status: {
    topic: 'status',
    title: 'zavorth status',
    summary: 'Mostra um retrato curto do runtime local antes de voce agir.',
    sections: [
      {
        title: 'O que checa',
        entries: [
          { summary: 'Prontidao local, sessoes, gateway, memoria e sinais operacionais principais.' },
          { summary: 'Um proximo comando quando algo pede atencao.' },
        ],
      },
      {
        title: 'Use quando',
        entries: [
          { summary: 'Quiser uma leitura rapida antes de comecar.' },
          { summary: 'Quiser confirmar se o Zavorth ficou pronto depois do onboard ou do go.' },
        ],
      },
      {
        title: 'Comandos relacionados',
        entries: [
          { command: 'zavorth doctor', summary: 'Aprofunda o diagnostico quando algo nao parecer certo.' },
          { command: 'zavorth go', summary: 'Liga ou retoma a entrada principal do Zavorth.' },
        ],
      },
    ],
    notesTitle: 'Dica rapida',
    notes: [
      'Use --json quando outra ferramenta precisar ler a resposta.',
    ],
  },
  doctor: {
    topic: 'doctor',
    title: 'zavorth doctor',
    summary: 'Diagnostica o ambiente local e transforma bloqueios em proximos passos.',
    sections: [
      {
        title: 'Use quando',
        entries: [
          { summary: 'Algo nao estiver funcionando como esperado.' },
          { summary: 'Quiser o proximo passo recomendado sem procurar manualmente.' },
        ],
      },
      {
        title: 'O que checa',
        entries: [
          { summary: 'Node/npm/build/env, provider/modelo, SecretRefs, portas, Home e sessoes.' },
          { summary: 'Separa bloqueio atual de passos opcionais sempre que possivel.' },
        ],
      },
      {
        title: 'Comandos relacionados',
        entries: [
          { command: 'zavorth status', summary: 'Mostra um resumo rapido antes do diagnostico completo.' },
          { command: 'zavorth doctor security', summary: 'Checa perfil, approvals, overrides perigosos e drift dos controles de seguranca.' },
          { command: 'zavorth security presets', summary: 'Lista presets reais para uso pessoal, profissional ou corporativo.' },
          { command: 'zavorth security preset professional --apply', summary: 'Aplica o preset diario recomendado sem exigir variaveis de ambiente manuais.' },
          { command: 'zavorth security continuous', summary: 'Confere doctor, baseline, hooks, CI e comandos de seguranca continua.' },
          { command: 'zavorth go', summary: 'Liga a entrada principal depois de ajustar o ambiente.' },
          { command: 'zavorth setup', summary: 'Revisa a configuracao base quando o problema comeca no setup.' },
        ],
      },
    ],
    notesTitle: 'Dica rapida',
    notes: [
      'Use --json quando for integrar a resposta com automacoes ou scripts.',
    ],
  },
  templates: {
    topic: 'templates',
    title: 'zavorth templates',
    summary: 'Lists guided daily-use mission templates before any marketplace or advanced skill flow.',
    sections: [
      {
        title: 'Use when',
        entries: [
          { summary: 'You want a safe first mission without knowing internal architecture.' },
          { summary: 'You want dev repo review, PDF summary, file organization, daily assistant or safe audit presets.' },
        ],
      },
      {
        title: 'Commands',
        entries: [
          { command: 'zavorth templates', summary: 'Show the guided template list.' },
          { command: 'zavorth templates --json', summary: 'Return the same template projection as JSON.' },
          { command: 'zavorth missions --template=dev-repo-review', summary: 'Preview a tracked mission from a template.' },
        ],
      },
    ],
    notesTitle: 'Safety',
    notes: [
      'Templates are governed instructions. They do not bypass approvals, sandbox or Policy Broker.',
    ],
  },
  missions: {
    topic: 'missions',
    title: 'zavorth missions',
    summary: 'Shows the current mission projection: request, status, risk, approvals, artifacts and timeline.',
    sections: [
      {
        title: 'Use when',
        entries: [
          { summary: 'You want the CLI view of what Home will show for a task.' },
          { summary: 'You want to confirm whether a mission is read-only, dry-run, blocked or waiting for approval.' },
        ],
      },
      {
        title: 'Commands',
        entries: [
          { command: 'zavorth missions', summary: 'Show the default safe mission projection.' },
          { command: 'zavorth missions --template=file-organization', summary: 'Preview a mutating mission and sandbox fallback.' },
          { command: 'zavorth missions --json', summary: 'Return the mission contract as JSON.' },
        ],
      },
    ],
    notesTitle: 'Boundary',
    notes: [
      'Home and CLI consume this projection; neither surface becomes an execution authority.',
    ],
  },
  receipts: {
    topic: 'receipts',
    title: 'zavorth receipts',
    summary: 'Shows a human visual receipt plus advanced trust details for the current mission.',
    sections: [
      {
        title: 'Use when',
        entries: [
          { summary: 'You want to see files read/changed, approvals, blocked actions, network and rollback posture.' },
          { summary: 'You want a short proof of what happened without exposing raw secrets.' },
        ],
      },
      {
        title: 'Commands',
        entries: [
          { command: 'zavorth receipts', summary: 'Show the current receipt projection.' },
          { command: 'zavorth receipts --advanced', summary: 'Show advanced trust-plane receipt details.' },
          { command: 'zavorth receipts --json', summary: 'Return the visual receipt contract as JSON.' },
        ],
      },
    ],
    notesTitle: 'Redaction',
    notes: [
      'Receipts must keep raw secrets out and represent credentials through SecretRef-style metadata.',
    ],
  },
  advanced: {
    topic: 'advanced',
    title: 'Ajuda avancada do Zavorth',
    summary: 'Quando voce ja domina a trilha principal e quer operar sessoes, nodes, runtime e superficies tecnicas com mais controle.',
    sections: [
      {
        title: 'Operacao do runtime',
        entries: [
          { command: 'zavorth help ops', summary: 'Mostra o cockpit, as acoes seguras e o bootstrap operacional.' },
          { command: 'zavorth cockpit', summary: 'Abre o cockpit operacional unificado.' },
          { command: 'zavorth ops', summary: 'Alias do cockpit para operadores.' },
          { command: 'zavorth brief', summary: 'Resume o estado do operador em linguagem mais narrativa.' },
        ],
      },
      {
        title: 'Sessoes e retomadas',
        entries: [
          { command: 'zavorth help sessions', summary: 'Agrupa replay, envio entre sessoes e workflows.' },
          { command: 'zavorth history [sessionId]', summary: 'Mostra sessoes recentes ou o replay de uma sessao.' },
          { command: 'zavorth tasks [taskId] [--json]', summary: 'Mostra o Task OS com estados formais, resume, retry e permissoes.' },
          { command: 'zavorth artifacts task <taskId|latest>', summary: 'Lista artefatos estruturados de uma task.' },
          { command: 'zavorth supervisor plan "<pedido>" [--json]', summary: 'Monta a DAG supervisionada com planner, critic, sandbox, budget e ledger.' },
          { command: 'zavorth workflows status|process [limit] [--json]', summary: 'Inspeciona ou roda a fila duravel de approvals retomaveis.' },
            { command: 'zavorth memory review [--json]', summary: 'Mostra perfil do workspace, preferencias, retencao e acoes de apagar/corrigir.' },
            { command: 'zavorth heal --preview [--json]', summary: 'Mostra o plano de self-heal sem executar recuperacoes.' },
            { command: 'zavorth release status [--json]', summary: 'Mostra canal, versao, risco, rollback e presenca remota da Etapa 31.' },
            { command: 'zavorth sessions spawn [web]', summary: 'Abre uma sessao derivada rastreavel.' },
        ],
      },
      {
        title: 'Nodes e devices',
        entries: [
          { command: 'zavorth help nodes', summary: 'Mostra pairing, fila, capacidades e diagnostico da Node Mesh.' },
          { command: 'zavorth nodes list', summary: 'Lista companions e devices conectados.' },
          { command: 'zavorth nodes doctor', summary: 'Aprofunda o diagnostico de um node ou da malha.' },
        ],
      },
      {
        title: 'Planos e catalogos',
        entries: [
          { command: 'zavorth memory status', summary: 'Mostra a layered memory e seus budgets.' },
          { command: 'zavorth capabilities list', summary: 'Lista capabilities, riscos, permissoes, fallbacks e MCP allowlist.' },
          { command: 'zavorth discover "<pedido>" [--json]', summary: 'Descobre capabilities e tools sugeridas por linguagem natural sem executar nada.' },
          { command: 'zavorth preview "<pedido>" [--json]', summary: 'Mostra plano, riscos, approvals e impacto sem executar ferramentas.' },
          { command: 'zavorth safety "<pedido>" [--json]', summary: 'Explica bloqueios high-risk e alternativas seguras sem vazar segredo ou path sensivel.' },
          { command: 'zavorth plugins list', summary: 'Lista integracoes, skills, MCPs e colecoes.' },
          { command: 'zavorth gateway', summary: 'Mostra o snapshot hidratado do gateway de canais.' },
          { command: 'zavorth gateway status|providers|models|combos|combo test <id>|cache stats|rate-limits|doctor [--json]', summary: 'Le a Gateway Control API publica sem dashboard.' },
          { command: 'zavorth workspace init|doctor|status|up|stop|restart [--json]', summary: 'Opera o Developer Workspace por manifesto, processos e hooks governados.' },
          { command: 'zavorth learning status', summary: 'Mostra candidatos, gates e metricas do learning plane.' },
        ],
      },
    ],
    notesTitle: 'Dicas importantes',
    notes: [
      'Se voce so quer iniciar, conversar ou diagnosticar, volte para "zavorth help".',
      'Esta camada existe para operador, power user e manutencao do runtime.',
      'Se voce quiser um indice quase completo, use "zavorth help reference".',
    ],
  },
  ops: {
    topic: 'ops',
    title: 'Ajuda avancada: operacao do runtime',
    summary: 'Agrupa o cockpit operacional, as acoes oficiais, o bootstrap e o autorepair supervisionado.',
    sections: [
      {
        title: 'Leituras rapidas',
        entries: [
          { command: 'zavorth cockpit', summary: 'Abre o cockpit operacional unificado.' },
          { command: 'zavorth ops', summary: 'Alias curto para o mesmo cockpit.' },
          { command: 'zavorth brief', summary: 'Mostra um briefing narrativo do operador.' },
          { command: 'zavorth ops quality [--json] [--live]', summary: 'Resume score operacional, budgets e gates.' },
        ],
      },
      {
        title: 'Diagnostico e acesso',
        entries: [
          { command: 'zavorth ops doctor [--json]', summary: 'Roda o doctor agregado dentro da surface operacional.' },
          { command: 'zavorth ops access [--json]', summary: 'Mostra readiness local e remoto.' },
          { command: 'zavorth release status [--json]', summary: 'Mostra canal, versao, risco, rollback e presenca remota.' },
          { command: 'zavorth ops bootstrap [--json]', summary: 'Mostra o bootstrap operacional atual.' },
        ],
      },
      {
        title: 'Acoes supervisionadas',
        entries: [
          { command: 'zavorth ops actions', summary: 'Lista as acoes operacionais whitelistadas.' },
          { command: 'zavorth ops run <actionId>', summary: 'Dispara uma acao oficial em background.' },
          { command: 'zavorth ops reload [force] [--json]', summary: 'Solicita recycle supervisionado do runtime.' },
          { command: 'zavorth ops autorepair status|dryrun|improve|force [--json]', summary: 'Consulta ou executa o autorepair supervisionado.' },
        ],
      },
    ],
    notesTitle: 'Dica rapida',
    notes: [
      'Comece lendo o estado atual; execute run, reload ou autorepair so quando souber o efeito esperado.',
    ],
  },
  sessions: {
    topic: 'sessions',
    title: 'Ajuda avancada: sessoes e retomadas',
    summary: 'Controla historico, replay, envio entre sessoes e workflows rastreaveis.',
    sections: [
      {
        title: 'Ver e retomar',
        entries: [
          { command: 'zavorth history [sessionId]', summary: 'Mostra sessoes recentes ou o replay de uma sessao.' },
          { command: 'zavorth sessions list [--json]', summary: 'Lista sessoes e conversas recentes.' },
          { command: 'zavorth sessions history <id>', summary: 'Replay consolidado de uma sessao especifica.' },
        ],
      },
      {
        title: 'Enviar e derivar',
        entries: [
          { command: 'zavorth sessions send <id> -- <mensagem>', summary: 'Envia uma mensagem para outra sessao.' },
          { command: 'zavorth sessions spawn [web]', summary: 'Abre uma sessao derivada rastreavel.' },
        ],
      },
      {
        title: 'Workflows e aprovacoes',
        entries: [
          { command: 'zavorth approve <taskId> [pin=...]', summary: 'Aprova uma tarefa pendente.' },
          { command: 'zavorth reject <taskId>', summary: 'Rejeita uma tarefa pendente.' },
          { command: 'zavorth workflows status [--json]', summary: 'Mostra a fila duravel do runtime universal.' },
          { command: 'zavorth workflows process [limit] [--json]', summary: 'Processa jobs aprovados que ficaram na fila apos restart.' },
          { command: 'zavorth resume <runId> [stage]', summary: 'Retoma um workflow existente.' },
          { command: 'zavorth restart-stage <runId> <stage>', summary: 'Reexecuta uma etapa especifica.' },
          { command: 'zavorth close-workflow <runId>', summary: 'Encerra um workflow bloqueado.' },
        ],
      },
    ],
    notesTitle: 'Dica rapida',
    notes: [
      'Para um fluxo simples, use "zavorth continue" e so desca para sessions quando precisar de controle fino.',
    ],
  },
  nodes: {
    topic: 'nodes',
    title: 'Ajuda avancada: nodes e devices',
    summary: 'Mostra companions, pairing, fila, historico e invocacao oficial da Node Mesh.',
    sections: [
      {
        title: 'Visao geral',
        entries: [
          { command: 'zavorth nodes list [--json]', summary: 'Lista companions e devices conectados.' },
          { command: 'zavorth nodes profiles [--json]', summary: 'Mostra perfis de devices suportados.' },
          { command: 'zavorth nodes capabilities [--json]', summary: 'Mostra capacidades disponiveis por node.' },
        ],
      },
      {
        title: 'Diagnostico',
        entries: [
          { command: 'zavorth nodes doctor [--json]', summary: 'Resume estado, fila e sinais de problema.' },
          { command: 'zavorth nodes queue [id] [--json]', summary: 'Mostra fila local ou de um node especifico.' },
          { command: 'zavorth nodes history [id] [--json]', summary: 'Mostra o historico recente de atividade.' },
        ],
      },
      {
        title: 'Operacao',
        entries: [
          { command: 'zavorth nodes pair [headless|desktop|mobile|browser] [label] [--json]', summary: 'Cria um pairing draft para bootstrap do companion.' },
          { command: 'zavorth nodes invoke <nodeId> <capabilityId> [action] [payload-json] [--json]', summary: 'Enfileira uma invocacao oficial do Node Mesh.' },
        ],
      },
    ],
    notesTitle: 'Dica rapida',
    notes: [
      'Se voce so quer conversar no terminal, nao precisa usar nodes.',
    ],
  },
  reference: {
    topic: 'reference',
    title: 'Referencia completa da CLI do Zavorth',
    summary: 'Indice mais abrangente da CLI para quem precisa localizar comandos, aliases e superficies tecnicas de forma direta.',
    sections: [
      {
        title: 'Trilha principal',
        entries: [
          { command: 'zavorth setup', summary: 'Setup oficial do Zavorth.' },
          { command: 'zavorth go', summary: 'Sobe o runtime supervisionado e abre a superficie principal.' },
          { command: 'zavorth dashboard', summary: 'Abre o Home ja com acesso local aplicado.' },
          { command: 'zavorth chat', summary: 'Abre o shell conversacional no terminal.' },
          { command: 'zavorth run "<pedido>"', summary: 'Envia um pedido em linguagem natural.' },
          { command: 'zavorth continue [contexto]', summary: 'Retoma o trabalho atual sem slash commands.' },
          { command: 'zavorth history [sessionId]', summary: 'Mostra sessoes recentes ou replay de uma sessao.' },
          { command: 'zavorth context', summary: 'Mostra o contexto atual da CLI.' },
          { command: 'zavorth status [--json] [--live]', summary: 'Resumo de saude, acesso, sessoes e capacidades principais.' },
          { command: 'zavorth productization [--json]', summary: 'Shows the productization contract shared by dashboard, CLI, onboarding, docs and website.' },
          { command: 'zavorth observatory [run|trace|session|status] [--json]', summary: 'Mostra runs, receipts, timeline e replay do Run Observatory.' },
          { command: 'zavorth cockpit [--json] [--live]', summary: 'Cockpit unificado de status, doctor, brief, operacao e entregas.' },
          { command: 'zavorth capabilities [list|route "<pedido>"] [--json]', summary: 'Mostra o Capability OS e explica decisoes de roteamento.' },
          { command: 'zavorth supervisor plan "<pedido>" [--json]', summary: 'Mostra quando usar grafo supervisor, reflexion, sandbox e budget.' },
          { command: 'zavorth release status [--json]', summary: 'Mostra release, rollback e presenca remota sem executar mudancas.' },
          { command: 'zavorth doctor [--json]', summary: 'Diagnostico agregado do runtime, canais e acesso remoto.' },
        ],
      },
      {
        title: 'Operacao do runtime',
        entries: [
          { command: 'zavorth brief [--json] [--live]', summary: 'Briefing narrativo do operador.' },
          { command: 'zavorth ops [--json] [--live]', summary: 'Alias do cockpit operacional unificado.' },
          { command: 'zavorth ops doctor [--json]', summary: 'Doctor agregado dentro da surface operacional.' },
          { command: 'zavorth ops actions', summary: 'Lista acoes operacionais oficiais.' },
          { command: 'zavorth ops quality [--json] [--live]', summary: 'Resume score operacional, budgets e gates.' },
            { command: 'zavorth ops access [--json]', summary: 'Readiness de acesso local e remoto.' },
            { command: 'zavorth heal --preview|--apply|report [--json]', summary: 'Self-Heal da Etapa 30 com probes, outbox, budgets e relatorio diario.' },
            { command: 'zavorth release status|diff|rollback|presence [--json]', summary: 'Etapa 31: release channels, changelog, diff, rollback preview e remote presence.' },
            { command: 'zavorth ops bootstrap [--json]', summary: 'Mostra o bootstrap operacional do runtime.' },
          { command: 'zavorth ops bootstrap repair [dryrun] [--json]', summary: 'Executa ou simula correcoes seguras do bootstrap.' },
          { command: 'zavorth ops changes [--json]', summary: 'Resume mudancas locais e estado supervisionado.' },
          { command: 'zavorth ops reload [force] [--json]', summary: 'Solicita recycle supervisionado do runtime.' },
          { command: 'zavorth ops autorepair status|dryrun|improve|force [--json]', summary: 'Consulta ou executa o autorepair supervisionado.' },
        ],
      },
      {
        title: 'Sessoes e workflows',
        entries: [
          { command: 'zavorth sessions list [--json]', summary: 'Lista sessoes e conversas recentes.' },
          { command: 'zavorth sessions history <id>', summary: 'Replay ou handoff consolidado de uma sessao.' },
          { command: 'zavorth tasks [list|resume|retry] [taskId] [--json]', summary: 'Opera o Task OS com estados formais e continuacao previsivel.' },
          { command: 'zavorth artifacts task <taskId|latest> [--json]', summary: 'Lista artefatos persistidos por task.' },
          { command: 'zavorth supervisor plan "<pedido>" [--simulate-test-failure] [--max-cost N] [--json]', summary: 'Planeja workflows compostos com DAG, reflexion limitado, pausa por budget e ledger redigido.' },
          { command: 'zavorth memory review|resolve|forget|correct [--json]', summary: 'Revisa memorias aprendidas e resolve follow-ups como continua, me manda de novo e mesma pasta.' },
          { command: 'zavorth heal --preview [--json]', summary: 'Prepara recuperacao supervisionada sem executar.' },
          { command: 'zavorth heal report [--json]', summary: 'Mostra top falhas, pendencias e acoes propostas do relatorio diario.' },
          { command: 'zavorth release diff previous latest [--json]', summary: 'Compara snapshots/publishes registrados no ledger de release.' },
          { command: 'zavorth release rollback --preview [--json]', summary: 'Monta preflight e evidencia de rollback sem executar troca de release.' },
          { command: 'zavorth release presence [--json]', summary: 'Mostra presenca remota degradavel sem exigir transporte sempre online.' },
          { command: 'zavorth sessions send <id> -- <mensagem>', summary: 'Envia uma mensagem para outra sessao.' },
          { command: 'zavorth sessions spawn [web]', summary: 'Abre uma sessao derivada rastreavel.' },
          { command: 'zavorth approve <taskId> [pin=...]', summary: 'Aprova uma tarefa pendente.' },
          { command: 'zavorth reject <taskId>', summary: 'Rejeita uma tarefa pendente.' },
          { command: 'zavorth workflows status|process [limit] [--json]', summary: 'Verifica ou roda a fila duravel do runtime universal.' },
          { command: 'zavorth resume <runId> [stage]', summary: 'Retoma um workflow existente.' },
          { command: 'zavorth restart-stage <runId> <stage>', summary: 'Reexecuta uma etapa especifica de workflow.' },
          { command: 'zavorth close-workflow <runId>', summary: 'Encerra um workflow bloqueado.' },
        ],
      },
      {
        title: 'Nodes e devices',
        entries: [
          { command: 'zavorth nodes list|profiles|capabilities|queue [id]|history [id]|doctor [--json]', summary: 'Visao, fila, historico e diagnostico da Node Mesh.' },
          { command: 'zavorth nodes pair [headless|desktop|mobile|browser] [label] [--json]', summary: 'Cria um pairing draft de node.' },
          { command: 'zavorth nodes invoke <nodeId> <capabilityId> [action] [payload-json] [--json]', summary: 'Enfileira uma invocacao oficial do Node Mesh.' },
        ],
      },
      {
        title: 'Memoria, learning e catalogos',
        entries: [
          { command: 'zavorth memory status|metrics [--json]', summary: 'Mostra a layered memory e seus budgets.' },
          { command: 'zavorth memory search <consulta> [--json]', summary: 'Busca fatos, episodios e procedimentos.' },
          { command: 'zavorth memory procedures [--json]', summary: 'Lista procedimentos validados.' },
          { command: 'zavorth memory review [--json]', summary: 'Mostra o Workspace Memory OS da Etapa 29 com retencao e redacao.' },
          { command: 'zavorth memory resolve "continua" [--json]', summary: 'Resolve follow-ups para task, artefato ou workspace correto.' },
          { command: 'zavorth memoryplane [--json]', summary: 'Retomada, historico recente e artefatos.' },
          { command: 'zavorth learning status|candidates|metrics [--json]', summary: 'Mostra estado, candidatos e metricas do learning plane.' },
          { command: 'zavorth learning approve|reject|promote <candidateId> [--json]', summary: 'Revisa ou promove um candidato aprendido.' },
          { command: 'zavorth gateway', summary: 'Snapshot hidratado do gateway de canais.' },
          { command: 'zavorth productization [--json]', summary: 'Audits productization in text/JSON with the same public runtime contract.' },
          { command: 'zavorth observatory status failed [--json]', summary: 'Filtra runs observaveis por status, trace, sessao ou run sem executar tools.' },
          { command: 'zavorth gateway status|providers|models|combos|combo test <id>|cache stats|rate-limits|doctor [--json]', summary: 'Status, providers, modelos, combos, cache, limites e doctor pela Gateway Control API publica.' },
          { command: 'zavorth workspace init|doctor|status|up|stop|restart [--json]', summary: 'Cria manifesto, valida recipes e opera processos do Developer Workspace com approvals.' },
          { command: 'zavorth domains [full] [--json]', summary: 'Mostra o domain plane consolidado.' },
          { command: 'zavorth tools [--json]', summary: 'Lista familias de ferramentas e atalhos.' },
          { command: 'zavorth skills [filtro|recipe <id>|recommend <objetivo>|mcp] [--json]', summary: 'Mostra o catalogo curado de skills e recipes.' },
          { command: 'zavorth hooks [--json]', summary: 'Mostra hooks e automacoes internas.' },
          { command: 'zavorth capabilities route "<pedido>" [--json]', summary: 'Explica executor escolhido, risco, aprovacao, ledger e fallback.' },
          { command: 'zavorth plugins list [id] [--json]', summary: 'Lista integracoes, skills, MCPs, colecoes e recipes ativos.' },
          { command: 'zavorth plugins sync', summary: 'Sincroniza o catalogo remoto do plugin plane.' },
          { command: 'zavorth plugins <acao> <id>', summary: 'Executa inspect/open/doctor/install/trust/review/remove no plugin plane.' },
          { command: 'zavorth AIGateway [status|route|start|doctor|sync|promote|rollback] [--json]', summary: 'Opera a rota propria do AIGateway.' },
        ],
      },
      {
        title: 'Compatibilidade e legado',
        entries: [
          { command: 'zavorth help advanced|ops|sessions|nodes', summary: 'Ajuda em camadas para operador e power user.' },
          { command: 'zavorth help reference', summary: 'Abre esta referencia completa.' },
          { command: 'zavorth help all', summary: 'Alias curto para a mesma referencia completa.' },
          { command: 'transports|channels|runtime|agmobile', summary: 'Comandos avancados ainda acessiveis pela CLI oficial.' },
          { command: '/comando', summary: 'Mantem compatibilidade com a surface completa de comandos do runtime.' },
          { command: 'sessionhistory|sessionsend|sessionspawn|nodepair|nodeinvoke|platform', summary: 'Aliases legados continuam aceitos.' },
        ],
      },
    ],
    notesTitle: 'Dicas de uso',
    notes: [
      'Use "zavorth help" para a entrada humana curta e "zavorth help advanced" para a camada intermediaria.',
      'Use "--json" quando quiser ler a resposta com outra ferramenta.',
    ],
  },
};

export function resolveCliHelpTopic(target?: string | null): CliHelpTopic {
  const normalized = String(target || '').trim().toLowerCase();
  if (!normalized) {
    return 'root';
  }

  const firstToken = normalized.split(/\s+/u)[0] || '';
  return CLI_HELP_TOPIC_ALIASES[firstToken] || 'root';
}

function applyZavorthPublicBranding(output: string): string {
  if (process.env.ZAVORTH_PUBLIC_CLI !== '1') {
    return output;
  }

  return output
    .replace(/\bZavorth\b/gu, 'Zavorth')
    .replace(/\bzavorth\b/gu, 'zavorth');
}

export function buildCliHelpSnapshot(target?: string | null): CliHelpSnapshot {
  const topic = resolveCliHelpTopic(target);
  if (topic !== 'root') {
    return {
      surface: 'zavorth-cli',
      ...CLI_COMMAND_HELP_PAGES[topic],
    };
  }

  return {
    surface: 'zavorth-cli',
    topic: 'root',
    title: ZAVORTH_CLI_BRAND_NAME,
    summary: 'Zavorth natural-first: fale em linguagem normal, acompanhe timeline, aprove o que importa e revise aprendizados.',
    sections: [
      {
        title: 'Comandos essenciais',
        entries: [
          { command: 'zavorth', summary: 'Abre a home conversacional premium no terminal.' },
          { command: 'zavorth ask "pergunta"', summary: 'Roteia linguagem natural pelo Experience Core.' },
          { command: 'zavorth run "tarefa"', summary: 'Cria plano, executa com governanca e emite receipts.' },
          { command: 'zavorth hud', summary: 'Mostra timeline, action cards, diff, auto-healing e health em uma tela.' },
          { command: 'zavorth approve', summary: 'Mostra ou resolve approvals pendentes.' },
          { command: 'zavorth diff', summary: 'Revisa diffs de sandbox sem aplicar direto no host.' },
          { command: 'zavorth learn', summary: 'Revisa aprendizados antes de promover comportamento futuro.' },
          { command: 'zavorth setup', summary: 'Abre o Setup Studio guiado.' },
          { command: 'zavorth open', summary: 'Abre o dashboard.' },
          { command: 'zavorth doctor', summary: 'Diagnostica e sugere correcao.' },
        ],
      },
      {
        title: 'Atalhos de operador',
        entries: [
          { command: 'zavorth start', summary: 'Liga ou retoma o runtime local.' },
          { command: 'zavorth ready', summary: 'Diz se esta pronto para uso remoto/local.' },
          { command: 'zavorth status', summary: 'Mostra saude atual em uma tela curta.' },
          { command: 'zavorth providers', summary: 'Mostra providers/modelos e readiness.' },
          { command: 'zavorth trust', summary: 'Mostra approvals, permissoes e modo extremo.' },
          { command: 'zavorth channels', summary: 'Configura canais como Telegram/Discord.' },
        ],
      },
      {
        title: 'Avancado sem poluir o inicio',
        entries: [
          { command: 'zavorth help <comando>', summary: 'Ajuda focada.' },
          { command: 'zavorth help advanced', summary: 'Mostra comandos de operador.' },
          { command: 'zavorth help reference', summary: 'Referencia completa para engenharia.' },
        ],
      },
      {
        title: 'Safety',
        entries: [
          { command: 'zavorth start --dry-run', summary: 'Preview sem iniciar nada persistente.' },
          { command: 'zavorth doctor --json', summary: 'Diagnostico para automacoes.' },
          { summary: 'Acoes sensiveis continuam atras de policy, preview, approval e receipt.' },
        ],
      },
    ],
    notesTitle: 'Next',
    notes: [
      'Primeira vez? Rode: zavorth setup',
      'Uso diario? Rode: zavorth e fale normalmente.',
    ],
  };
}

function formatCliHelpEntry(entry: { command?: string; summary: string }): string {
  if (entry.command && entry.summary) {
    return `- ${entry.command}: ${entry.summary}`;
  }
  if (entry.command) {
    return `- ${entry.command}`;
  }
  return `- ${entry.summary}`;
}

export function formatCliHelp(target?: string | null): string {
  const snapshot = buildCliHelpSnapshot(target);
  const panels: CliVisualPanel[] = snapshot.sections.map((section) => ({
    title: section.title,
    lines: section.entries.map((entry) => formatCliHelpEntry(entry)),
    tone: snapshot.topic === 'root' ? 'neutral' : 'info',
  }));

  if (snapshot.notes.length > 0) {
    panels.push({
      title: snapshot.notesTitle || 'Dicas rapidas',
      lines: snapshot.notes.map((note) => `- ${note}`),
      tone: 'muted',
    });
  }

  return applyZavorthPublicBranding(renderCliScreen({
    eyebrow: snapshot.topic === 'root' ? 'Zavorth CLI' : `Ajuda ${snapshot.topic}`,
    eyebrowTone: snapshot.topic === 'root' ? 'brand' : 'info',
    title: snapshot.title,
    summary: snapshot.summary,
    panels,
    mode: snapshot.topic === 'root' ? 'hero' : 'compact',
    showWordmark: snapshot.topic === 'root',
  }));
}

export function buildCliChatWelcomeSnapshot(): CliChatWelcomeSnapshot {
  return {
    surface: 'zavorth-cli',
    title: 'Zavorth',
    summary: 'Oi. Eu estou pronto para ajudar. Escreva um pedido simples, do seu jeito.',
    sections: [
      {
        title: 'Sugestoes para comecar',
        entries: [
          { command: 'revisar este modulo', summary: 'Analiso o codigo atual e digo o que merece atencao.' },
          { command: 'retome o que estavamos fazendo', summary: 'Continuo a linha de trabalho aberta.' },
          { command: 'compare o que mudou nesta pasta', summary: 'Resumo as mudancas recentes sem voce procurar arquivo por arquivo.' },
        ],
      },
      {
        title: 'Atalhos',
        entries: [
          { command: 'status', summary: 'Ver se esta tudo certo.' },
          { command: 'doctor', summary: 'Encontrar e corrigir algo que travou.' },
          { command: 'history', summary: 'Ver conversas recentes.' },
          { command: 'new', summary: 'Comecar uma conversa nova.' },
          { command: 'quit', summary: 'Sair do chat.' },
        ],
      },
    ],
    notesTitle: 'Dica',
    notes: [
      'Nao precisa decorar comando. Texto livre vira pedido automaticamente.',
    ],
  };
}

const CLI_CHAT_FRAME_WIDTH = 66;

function clipCliChatText(value: string, maxWidth: number): string {
  const normalized = stripCliAnsi(sanitizeHumanCliText(value)).replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxWidth) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxWidth - 3)).trimEnd()}...`;
}

function clipCliChatVisualLine(value: string, maxWidth: number): string {
  const visible = stripCliAnsi(value);
  if (visible.length <= maxWidth) {
    return value;
  }
  return clipCliChatText(value, maxWidth);
}

function formatCliChatWorkspaceLabel(): string {
  const workspace = String(config.defaultWorkspace || process.cwd()).trim() || process.cwd();
  const legacyProductName = ['Bas', 'ilisk'].join('');
  const legacyProductPattern = new RegExp(legacyProductName, 'gi');
  const workspaceName = (path.basename(workspace) || workspace).replace(legacyProductPattern, 'workspace');
  const normalizedPath = workspace.replace(/\\/g, '/').replace(legacyProductPattern, 'workspace');
  return `${workspaceName} - ${normalizedPath}`;
}

function resolveCliChatCurrentModel(): string {
  const provider = String(config.llmProvider || 'runtime').trim();
  const normalizedProvider = provider.toLowerCase().replace(/[\s_-]+/g, '');
  const modelCandidatesByProvider: Record<string, Array<string | null | undefined>> = {
    gemini: [config.geminiModel, config.geminiDefaultModel],
    google: [config.geminiModel, config.geminiDefaultModel],
    aistudio: [config.aiStudioModel, config.geminiModel, config.geminiDefaultModel],
    gemma: [config.gemmaModel],
    openai: [config.openaiModel],
    deepseek: [config.deepseekModel],
    minimax: [config.minimaxModel],
    aigateway: [config.AIGatewayModel, config.openaiModel],
    openrouter: [config.openRouterModel],
    opencode: [config.openCodeModel],
    qwen: [config.qwenModel],
  };
  const candidates = modelCandidatesByProvider[normalizedProvider] || [];
  const model = candidates
    .map((candidate) => sanitizeHumanCliText(candidate || '').trim())
    .find(Boolean);
  return model || provider || 'modelo atual';
}

function formatCliChatRuntimeLabel(): string {
  return `${resolveCliChatCurrentModel()} - conversa natural`;
}

function renderCliChatFrame(lines: string[]): string {
  const border = '-'.repeat(CLI_CHAT_FRAME_WIDTH + 2);
  return [
    paintCliTone(`+${border}+`, 'muted'),
    ...lines.map((line) => {
      const clipped = clipCliChatVisualLine(line, CLI_CHAT_FRAME_WIDTH);
      return `${paintCliTone('|', 'muted')} ${padCliVisualText(clipped, CLI_CHAT_FRAME_WIDTH)} ${paintCliTone('|', 'muted')}`;
    }),
    paintCliTone(`+${border}+`, 'muted'),
  ].join('\n');
}

function formatCliChatCommand(entry: { command?: string; summary: string }): string {
  const command = sanitizeHumanCliText(entry.command || '').trim();
  const summary = sanitizeHumanCliText(entry.summary).trim();
  if (!command) {
    return `${paintCliTone('*', 'brand')} ${summary}`;
  }
  return [
    `${paintCliTone('>', 'brand')} ${paintCliTone(command, 'brand')}`,
    `  ${paintCliTone('->', 'muted')} ${summary}`,
  ].join('\n');
}

function formatCliChatFooter(shortcuts: Array<{ command?: string; summary: string }>): string {
  const shortcutLabels = shortcuts
    .map((entry) => sanitizeHumanCliText(entry.command || '').trim())
    .filter(Boolean);
  const shortcutLine = shortcutLabels.length > 0
    ? shortcutLabels.join(' | ')
    : 'status | doctor | history | quit';
  return [
    paintCliTone('--------------------------------------------------------', 'muted'),
    `${paintCliTone('?', 'muted')} atalhos: ${shortcutLine}`,
    `${paintCliTone('seguro', 'success')}: acoes sensiveis pedem aprovacao antes de agir`,
  ].join('\n');
}

export function formatCliChatWelcome(): string {
  const snapshot = buildCliChatWelcomeSnapshot();
  const examples = snapshot.sections[0]?.entries || [];
  const shortcuts = snapshot.sections[1]?.entries || [];
  const note = snapshot.notes[0] || 'Escreva seu pedido quando quiser.';
  const workspaceLabel = formatCliChatWorkspaceLabel();
  const runtimeLabel = formatCliChatRuntimeLabel();
  const header = renderCliChatFrame(formatZavorthMascotBlock([
    paintCliTone(snapshot.title, 'brand'),
    paintCliTone(runtimeLabel, 'muted'),
    `${paintCliTone('Pasta', 'muted')} - ${clipCliChatText(workspaceLabel, 47)}`,
  ]));

  return [
    header,
    `${paintCliTone('*', 'brand')} ${sanitizeHumanCliText(snapshot.summary)}`,
    `${paintCliTone('Sugestoes', 'muted')}`,
    examples.map((entry) => formatCliChatCommand(entry)).join('\n\n'),
    `${paintCliTone('Dica', 'muted')}  ${sanitizeHumanCliText(note)}`,
    formatCliChatFooter(shortcuts),
  ].filter(Boolean).join('\n\n');
}

export function buildCliContextSnapshot(
  flags: Pick<ZavorthCliFlags, 'userId' | 'platform' | 'chatId' | 'sessionId' | 'workspaceHint'>,
  historyFile: string = CLI_REPL_HISTORY_FILE,
): CliContextSnapshot {
  return {
    surface: 'zavorth-cli',
    userId: flags.userId,
    platform: flags.platform,
    chatId: flags.chatId,
    sessionId: flags.sessionId,
    workspace: flags.workspaceHint || config.defaultWorkspace,
    workspaceHint: flags.workspaceHint,
    historyFile,
    notes: [
      'Leituras nativas rodam direto no terminal oficial.',
      'Pedidos livres e aliases curtos usam o mesmo runtime do Zavorth.',
    ],
  };
}

export function formatCliContextSnapshot(snapshot: CliContextSnapshot): string {
  return [
    'Contexto do terminal Zavorth',
    '',
    'Agora',
    `- usuario: ${snapshot.userId}`,
    `- plataforma: ${snapshot.platform}`,
    `- chat: ${snapshot.chatId}`,
    `- sessao: ${snapshot.sessionId}`,
    '',
    'Arquivos uteis',
    `- workspace: ${snapshot.workspace}`,
    `- workspace hint: ${snapshot.workspaceHint || 'nenhum; usando workspace padrao'}`,
    `- history: ${snapshot.historyFile}`,
    '',
    'Notas',
    ...snapshot.notes.map((note) => `- ${note}`),
  ].join('\n');
}

export function formatGatewaySnapshot(snapshot: ZavorthGatewaySnapshot): string {
  return [
    'Gateway do Zavorth',
    sanitizeHumanCliText(snapshot.narrative.headline),
    '',
    'Agora',
    `- canais prontos: ${snapshot.summary.channelsReady}/${snapshot.summary.channelsTotal}`,
    `- modos de runtime: ${snapshot.summary.runtimeModesReady}`,
    `- seguranca: ${snapshot.summary.securityPosture}`,
    '',
    'Capacidade',
    `- memoria e artefatos: ${snapshot.summary.memoryArtifacts}`,
    `- times: ${snapshot.summary.teams} | sessoes: ${snapshot.summary.sessionTargets}`,
    `- ferramentas: ${snapshot.summary.toolFamilies} familias | plugins: ${snapshot.summary.plugins}`,
    '',
    'Malha',
    `- companions pareados: ${snapshot.summary.nodesPaired}`,
    `- resumo: ${sanitizeHumanCliText(snapshot.narrative.operatorSummary)}`,
  ].join('\n');
}

function formatSurfaceSection(title: string, lines: Array<string | null | undefined>): string[] {
  const items = lines
    .map((line) => String(line || '').trim())
    .filter(Boolean);
  return items.length > 0 ? ['', title, ...items] : [];
}

function formatUsagePercent(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'nao informado';
  }
  return `${Math.round(value * 100)}%`;
}

function normalizePlatformActionHint(actionHint: string | null | undefined): string | null {
  const normalized = String(actionHint || '').trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith('/platform ')) {
    return `zavorth platform ${normalized.slice('/platform '.length)}`.trim();
  }
  if (normalized.startsWith('/integrations ')) {
    return `zavorth plugins ${normalized.slice('/integrations '.length)}`.trim();
  }

  return normalized;
}

type PlatformSnapshotRenderOptions = {
  focusExplicit?: boolean;
};

function formatPlatformOverflow(total: number, shown: number, singular: string, plural: string): string | null {
  const remaining = total - shown;
  return remaining > 0 ? `- ${formatAdditionalCount(remaining, singular, plural)}` : null;
}

function formatPlatformOverviewCollection(
  collection: ZavorthPlatformRegistrySnapshot['collections'][number],
): string {
  return `- ${collection.label}: ${formatCount(collection.itemCount, 'item', 'itens')} | ${formatCount(collection.readyCount, 'pronto', 'prontos')} | ${formatCount(collection.adoptedCount, 'adotado', 'adotados')}`;
}

function formatPlatformOverviewRecipe(
  recipe: ZavorthPlatformRegistrySnapshot['recipes'][number],
): string {
  return `- ${recipe.label}: ${formatCount(recipe.itemCount, 'alvo', 'alvos')} | ${formatCount(recipe.readyCount, 'pronto', 'prontos')} | ${formatCount(recipe.adoptedCount, 'adotado', 'adotados')}`;
}

function formatPlatformOverviewEntry(
  entry: ZavorthPlatformRegistrySnapshot['entries'][number],
): string {
  return `- ${entry.label} [${entry.kind}] ${entry.readiness}/${entry.installState} | trust ${formatCliValue(entry.trust)}`;
}

export function formatMemoryPlaneSnapshot(
  snapshot: Awaited<ReturnType<ZavorthMemoryPlaneService['buildSnapshot']>>,
): string {
  const recentArtifact = snapshot.artifacts.recent[0];
  const suggested = snapshot.suggestedActions[0];

  return [
    'Retomada e entregas do Zavorth',
    `- ${sanitizeHumanCliText(snapshot.narrative.headline)}`,
    `- ${sanitizeHumanCliText(snapshot.narrative.operatorSummary)}`,
    `- memorias persistidas: ${snapshot.summary.persistedMemories}`,
    `- memorias relevantes: ${snapshot.summary.relevantMemories}`,
    `- tarefas no replay: ${snapshot.summary.replayTasks}`,
    `- artefatos: ${snapshot.summary.artifacts}`,
    recentArtifact ? `- artefato recente: ${recentArtifact.label}` : '- artefato recente: nenhum',
    suggested ? `- proximo passo: ${suggested.label} (${suggested.command})` : '- proximo passo: nenhum',
  ].join('\n');
}

export function formatLearningSnapshot(
  snapshot: LearningPlaneSnapshot,
  mode: 'status' | 'candidates' = 'status',
): string {
  const featuredCandidate = snapshot.candidates[0] || null;
  const lines = [
    'Learning do Zavorth',
    sanitizeHumanCliText(snapshot.narrative.headline),
    ...formatSurfaceSection('Agora', [
      `- candidatos: ${formatCount(snapshot.summary.total, 'total', 'total')} | ${formatCount(snapshot.summary.pending, 'pendente', 'pendentes')} | ${formatCount(snapshot.summary.highConfidence, 'alta confianca', 'alta confianca')}`,
      `- revisao: ${formatCount(snapshot.summary.approved, 'aprovado', 'aprovados')} | ${formatCount(snapshot.summary.rejected, 'rejeitado', 'rejeitados')} | ${snapshot.summary.quarantined} em quarentena`,
      `- rollout: ${formatCount(snapshot.summary.promoted, 'promovido', 'promovidos')} | ${formatCount(snapshot.summary.published, 'publicado', 'publicados')}`,
      `- resumo: ${sanitizeHumanCliText(snapshot.narrative.operatorSummary)}`,
    ]),
  ];

  if (mode === 'candidates' && snapshot.candidates.length > 0) {
    lines.push('', 'Candidatos em foco');
    for (const candidate of snapshot.candidates.slice(0, 5)) {
      lines.push(
        `- ${candidate.title} [${candidate.kind}]`,
        `  score ${candidate.score.toFixed(2)} | revisao ${candidate.reviewState} | estado ${candidate.lifecycle}`,
      );
      lines.push(`  ${candidate.summary}`);
    }
  }

  lines.push(...formatSurfaceSection('Faca agora', [
    mode === 'candidates' && featuredCandidate
      ? `- zavorth learning approve ${featuredCandidate.id}`
      : '- zavorth learning candidates',
    featuredCandidate ? `- zavorth learning promote ${featuredCandidate.id}` : '- zavorth learning metrics',
  ]));

  return lines.join('\n');
}

export function formatLearningMetricsSnapshot(
  metrics: ReturnType<ZavorthLearningPlaneService['readMetrics']>,
): string {
  return [
    'Metricas do learning',
    'Panorama de qualidade e throughput do plano de aprendizado.',
    ...formatSurfaceSection('Agora', [
      `- candidatos: ${formatCount(metrics.summary.totalCandidates, 'candidato', 'candidatos')}`,
      `- score medio: ${metrics.summary.averageScore}`,
      `- fila: ${formatCount(metrics.counts.pending, 'pendente', 'pendentes')} | ${metrics.counts.quarantined} em quarentena | ${formatCount(metrics.counts.highConfidence, 'alta confianca', 'alta confianca')}`,
    ]),
    ...formatSurfaceSection('Qualidade', [
      `- aceitos: ${metrics.summary.acceptedRate}`,
      `- rejeitados: ${metrics.summary.rejectedRate}`,
      `- promovidos: ${metrics.summary.promotedRate}`,
    ]),
    ...formatSurfaceSection('Faca agora', [
      '- zavorth learning candidates',
    ]),
  ].join('\n');
}

export function formatLearningActionExecution(result: LearningPlaneActionExecution): string {
  return [
    'Learning atualizado',
    result.summary,
    ...formatSurfaceSection('Agora', [
      `- candidato: ${result.candidateId}`,
      `- acao: ${result.actionId}`,
      `- status: ${result.status}`,
    ]),
    ...formatSurfaceSection('Detalhes', result.details.slice(0, 4).map((detail) => `- ${detail}`)),
    ...formatSurfaceSection('Faca agora', [
      '- zavorth learning candidates',
      '- zavorth learning metrics',
    ]),
  ].join('\n');
}

export function formatLayeredMemoryStatus(
  snapshot: Awaited<ReturnType<ZavorthLayeredMemoryService['buildStatus']>>,
): string {
  return [
    'Memoria do Zavorth',
    sanitizeHumanCliText(snapshot.narrative.headline),
    ...formatSurfaceSection('Agora', [
      `- entradas: ${formatCount(snapshot.summary.total, 'entrada', 'entradas')}`,
      `- camadas: episodica ${snapshot.summary.episodic} | semantica ${snapshot.summary.semantic} | procedural ${snapshot.summary.procedural}`,
      `- resumo: ${sanitizeHumanCliText(snapshot.narrative.operatorSummary)}`,
    ]),
    ...formatSurfaceSection('Uso', [
      `- budget por camada: ${snapshot.budgets.perLayer}`,
      `- episodica: ${formatUsagePercent(snapshot.budgets.episodicUsage)}`,
      `- semantica: ${formatUsagePercent(snapshot.budgets.semanticUsage)}`,
      `- procedural: ${formatUsagePercent(snapshot.budgets.proceduralUsage)}`,
    ]),
    ...formatSurfaceSection('Faca agora', [
      '- zavorth memory search <tema>',
      '- zavorth memory procedures',
    ]),
  ].join('\n');
}

export function formatLayeredMemorySearch(
  snapshot: Awaited<ReturnType<ZavorthLayeredMemoryService['search']>>,
): string {
  const lines = [
    'Busca na memoria do Zavorth',
    `Consulta: ${snapshot.query}`,
    ...formatSurfaceSection('Agora', [
      `- resultados: ${formatCount(snapshot.total, 'resultado', 'resultados')}`,
    ]),
  ];

  if (snapshot.data.length === 0) {
    lines.push(...formatSurfaceSection('Resultados', [
      '- nenhum resultado relevante encontrado',
    ]));
    lines.push(...formatSurfaceSection('Faca agora', [
      '- zavorth memory procedures',
    ]));
    return lines.join('\n');
  }

  lines.push('', 'Resultados em foco');
  for (const entry of snapshot.data.slice(0, 6)) {
    lines.push(
      `- ${entry.label} [${entry.memoryLayer}]`,
      `  confianca ${entry.confidence.toFixed(2)} | origem ${entry.source}`,
    );
    lines.push(`  ${entry.summary}`);
  }

  lines.push(...formatSurfaceSection('Faca agora', [
    '- zavorth memory procedures',
  ]));

  return lines.join('\n');
}

export function formatLayeredMemoryProcedures(
  snapshot: Awaited<ReturnType<ZavorthLayeredMemoryService['readProcedures']>>,
): string {
  const lines = [
    'Procedimentos do Zavorth',
    snapshot.total > 0
      ? `Ha ${formatCount(snapshot.total, 'procedimento validado', 'procedimentos validados')} para reaproveitar.`
      : 'Ainda nao existe procedimento validado para reaproveitar.',
  ];

  if (snapshot.data.length === 0) {
    lines.push(...formatSurfaceSection('Agora', [
      '- nenhum procedimento validado disponivel',
    ]));
    return lines.join('\n');
  }

  lines.push(...formatSurfaceSection('Agora', [
    `- procedimentos validados: ${formatCount(snapshot.total, 'procedimento', 'procedimentos')}`,
  ]));
  lines.push('', 'Procedimentos em foco');
  for (const procedure of snapshot.data.slice(0, 5)) {
    lines.push(`- ${procedure.label}`);
    lines.push(`  confianca ${procedure.confidence.toFixed(2)} | origem ${procedure.source}`);
    lines.push(`  ${procedure.summary}`);
    for (const step of procedure.steps.slice(0, 3)) {
      lines.push(`  -> ${step}`);
    }
  }

  lines.push(...formatSurfaceSection('Faca agora', [
    '- zavorth memory search <tema>',
  ]));

  return lines.join('\n');
}

export function formatPlatformSnapshot(
  snapshot: ZavorthPlatformRegistrySnapshot,
  options: PlatformSnapshotRenderOptions = {},
): string {
  const focusExplicit = options.focusExplicit === true;
  const selected = focusExplicit ? snapshot.selected : null;
  const selectedCollection = focusExplicit ? (snapshot.selectedCollection || null) : null;
  const selectedRecipe = focusExplicit ? (snapshot.selectedRecipe || null) : null;
  const highlighted = snapshot.entries.slice(0, 3);
  const collections = Array.isArray(snapshot.collections) ? snapshot.collections.slice(0, 2) : [];
  const recipes = Array.isArray(snapshot.recipes) ? snapshot.recipes.slice(0, 2) : [];

  const lines = [
    'Platform do Zavorth',
    sanitizeHumanCliText(snapshot.narrative.headline),
    ...formatSurfaceSection('Agora', [
      `- plugins: ${snapshot.summary.plugins} | skills: ${snapshot.summary.skills} | MCPs: ${snapshot.summary.mcps}`,
      `- colecoes: ${String(snapshot.summary.collections || 0)} | recipes: ${String(snapshot.summary.recipes || 0)}`,
      `- sync: ${formatCliValue(snapshot.catalogSync?.summary)}`,
      `- resumo: ${sanitizeHumanCliText(snapshot.narrative.operatorSummary)}`,
    ]),
  ];

  if (selectedCollection) {
    lines.push(...formatSurfaceSection('Colecao em foco', [
      `- ${selectedCollection.label}`,
      `- itens: ${formatCount(selectedCollection.itemCount, 'item', 'itens')} | ${formatCount(selectedCollection.readyCount, 'pronto', 'prontos')} | ${formatCount(selectedCollection.adoptedCount, 'adotado', 'adotados')}`,
      `- proximo passo: ${normalizePlatformActionHint(selectedCollection.actionHint) || formatCliValue(selectedCollection.actionHint)}`,
    ]));
    if (selectedCollection.items.length > 0) {
      lines.push('', 'Itens em foco');
      lines.push(...selectedCollection.items.slice(0, 4).map((item) =>
        `- ${item.label} [${item.kind}] ${item.readiness}/${item.installState}`));
    }
    return lines.join('\n');
  }

  if (selectedRecipe) {
    lines.push(...formatSurfaceSection('Recipe em foco', [
      `- ${selectedRecipe.label}`,
      `- alvos: ${formatCount(selectedRecipe.itemCount, 'alvo', 'alvos')} | ${formatCount(selectedRecipe.readyCount, 'pronto', 'prontos')} | ${formatCount(selectedRecipe.adoptedCount, 'adotado', 'adotados')}`,
      `- proximo passo: ${normalizePlatformActionHint(selectedRecipe.actionHint) || formatCliValue(selectedRecipe.actionHint)}`,
    ]));
    if (selectedRecipe.steps.length > 0) {
      lines.push('', 'Passos em foco');
      lines.push(...selectedRecipe.steps.slice(0, 3).map((step) => `- ${step}`));
    }
    return lines.join('\n');
  }

  if (selected) {
    lines.push(...formatSurfaceSection('Item em foco', [
      `- ${selected.label}`,
      `- tipo: ${selected.kind}`,
      `- estado: ${selected.readiness} | trust: ${formatCliValue(selected.trust)} | install: ${selected.installState}`,
      `- proximo passo: ${normalizePlatformActionHint(selected.actionHint) || formatCliValue(selected.actionHint)}`,
      `- resumo: ${sanitizeHumanCliText(selected.summary)}`,
    ]));
    if (selected.details.length > 0) {
      lines.push('', 'Detalhes');
      lines.push(...selected.details.slice(0, 3).map((detail) => `- ${detail}`));
    }
    return lines.join('\n');
  }

  if (collections.length > 0) {
    lines.push('', 'Colecoes em foco');
    for (const collection of collections) {
      lines.push(formatPlatformOverviewCollection(collection));
    }
    const overflow = formatPlatformOverflow(snapshot.collections.length, collections.length, 'outra colecao no catalogo', 'outras colecoes no catalogo');
    if (overflow) {
      lines.push(overflow);
    }
  }

  if (recipes.length > 0) {
    lines.push('', 'Recipes em foco');
    for (const recipe of recipes) {
      lines.push(formatPlatformOverviewRecipe(recipe));
    }
    const overflow = formatPlatformOverflow(snapshot.recipes.length, recipes.length, 'outra recipe no catalogo', 'outras recipes no catalogo');
    if (overflow) {
      lines.push(overflow);
    }
  }

  if (highlighted.length > 0) {
    lines.push('', 'Itens em foco');
    for (const entry of highlighted) {
      lines.push(formatPlatformOverviewEntry(entry));
    }
    const overflow = formatPlatformOverflow(snapshot.entries.length, highlighted.length, 'outro item no catalogo', 'outros itens no catalogo');
    if (overflow) {
      lines.push(overflow);
    }
  }

  lines.push(...formatSurfaceSection('Faca agora', [
    collections[0] ? `- zavorth platform ${collections[0].id}` : '- zavorth plugins list',
  ]));

  return lines.join('\n');
}

export function formatPlatformSyncResult(result: Awaited<ReturnType<ZavorthPlatformCatalogSyncService['sync']>>): string {
  return [
    'Catalogo de plugins sincronizado',
    sanitizeHumanCliText(result.summary),
    ...formatSurfaceSection('Agora', [
      `- status: ${result.status}`,
      `- itens: ${formatCount(result.entryCount, 'item', 'itens')} | colecoes: ${formatCount(result.collectionCount, 'colecao', 'colecoes')} | recipes: ${formatCount(result.recipeCount, 'recipe', 'recipes')}`,
      `- cache: ${formatCliValue(result.cacheFile)}`,
      result.error ? `- erro: ${result.error}` : null,
    ]),
    ...formatSurfaceSection('Faca agora', [
      '- zavorth plugins list',
    ]),
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatLayeredMemoryMetrics(
  metrics: Awaited<ReturnType<ZavorthLayeredMemoryService['readMetrics']>>,
): string {
  return [
    'Metricas da memoria',
    'Panorama de pressao e distribuicao da layered memory.',
    ...formatSurfaceSection('Agora', [
      `- entradas: ${formatCount(metrics.summary.totalEntries, 'entrada', 'entradas')} | episodica ${metrics.summary.episodic} | semantica ${metrics.summary.semantic} | procedural ${metrics.summary.procedural}`,
      `- uso medio do budget: ${metrics.summary.averageBudgetUsage} | pressao: ${metrics.summary.pressure}`,
      `- procedimentos: ${formatCount(metrics.procedures.total, 'total', 'total')} | ${metrics.procedures.trustedLocal} trusted local | ${metrics.procedures.learnedDraft} draft`,
    ]),
    ...formatSurfaceSection('Faca agora', [
      '- zavorth memory status',
      '- zavorth memory procedures',
    ]),
  ].join('\n');
}
