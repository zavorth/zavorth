import { shellWarn } from './shell-debug';

export type SupportedControlLocale =
  | 'en-US'
  | 'pt-BR'
  | 'es-AR'
  | 'zh-CN'
  | 'zh-TW'
  | 'de'
  | 'es'
  | 'ja-JP'
  | 'ko'
  | 'fr'
  | 'ar'
  | 'it'
  | 'tr'
  | 'uk'
  | 'id'
  | 'pl'
  | 'th'
  | 'vi'
  | 'nl'
  | 'fa';
export type ControlLocalePreference = SupportedControlLocale | 'system';
export type ControlLocale = SupportedControlLocale;

const LOCALE_KEY = 'zavorth.control.locale';

export const CONTROL_LOCALES: Array<{ code: ControlLocalePreference; label: string; hint: string }> = [
  { code: 'system', label: 'System language', hint: 'Follow this device automatically' },
  { code: 'en-US', label: 'English (US)', hint: 'Default product language' },
  { code: 'pt-BR', label: 'Português (Brasil)', hint: 'Interface brasileira' },
  { code: 'es-AR', label: 'Español (Argentina)', hint: 'Interfaz latinoamericana' },
  { code: 'zh-CN', label: '简体中文 (Simplified Chinese)', hint: '中文界面' },
  { code: 'zh-TW', label: '繁體中文 (Traditional Chinese)', hint: '繁體界面' },
  { code: 'de', label: 'Deutsch', hint: 'Deutsche Benutzeroberfläche' },
  { code: 'es', label: 'Español', hint: 'Interfaz española' },
  { code: 'ja-JP', label: '日本語', hint: '日本語インターフェース' },
  { code: 'ko', label: '한국어', hint: '한국어 인터페이스' },
  { code: 'fr', label: 'Français', hint: 'Interface française' },
  { code: 'ar', label: 'العربية', hint: 'واجهة عربية' },
  { code: 'it', label: 'Italiano', hint: 'Interfaccia italiana' },
  { code: 'tr', label: 'Türkçe', hint: 'Türkçe arayüz' },
  { code: 'uk', label: 'Українська', hint: 'Український інтерфейс' },
  { code: 'id', label: 'Bahasa Indonesia', hint: 'Antarmuka Indonesia' },
  { code: 'pl', label: 'Polski', hint: 'Polski interfejs' },
  { code: 'th', label: 'ไทย', hint: 'อินเตอร์เฟซภาษาไทย' },
  { code: 'vi', label: 'Tiếng Việt', hint: 'Giao diện tiếng Việt' },
  { code: 'nl', label: 'Nederlands', hint: 'Nederlandse interface' },
  { code: 'fa', label: 'فارسی', hint: 'رابط کاربری فارسی' },
];

const SUPPORTED_LOCALES: SupportedControlLocale[] = [
  'en-US',
  'pt-BR',
  'es-AR',
  'zh-CN',
  'zh-TW',
  'de',
  'es',
  'ja-JP',
  'ko',
  'fr',
  'ar',
  'it',
  'tr',
  'uk',
  'id',
  'pl',
  'th',
  'vi',
  'nl',
  'fa',
];

/** Shared UI strings for action-first surfaces (English keys → locale). */
const CONTROL_SURFACE_I18N: Partial<Record<SupportedControlLocale, Record<string, string>>> = {
  'pt-BR': {
    Next: 'Próximo',
    Trust: 'Confiança',
    Pending: 'Pendentes',
    'Last receipt': 'Último recibo',
    Diff: 'Diff',
    'Trust score': 'Score de confiança',
    Open: 'Abrir',
    Proof: 'Prova',
    Doctor: 'Doctor',
    'New chat': 'Novo chat',
    'Open chat': 'Abrir chat',
    'Nothing needs you': 'Nada precisa de youê',
    'Needs you': 'Precisa de youê',
    'Ready for a request': 'Pronto para um pedido',
    'Start in Inbox.': 'Comece na Caixa de entrada.',
    '1 approval waiting': '1 aprovação aguardando',
    '{n} approvals waiting': '{n} aprovações aguardando',
    'Decide before risky work continues.': 'Decida antes que o trabalho arriscado continue.',
    '1 error in trail': '1 erro no trail',
    '{n} errors in trail': '{n} erros no trail',
    'Check proof / receipts.': 'Veja prova / recibos.',
    'Trust Loop': 'Trust Loop',
    'Receipts, budget, honesty': 'Recibos, orçamento, honestidade',
    'No proof events yet.': 'Nenhum evento de prova ainda.',
    'Recent proof': 'Prova recente',
    'Catalog is not live proof.': 'Catálogo não é prova ao vivo.',
    'Catalog only': 'Somente catálogo',
    'Needs setup': 'Precisa de setup',
    Blocked: 'Bloqueado',
    Live: 'Ao vivo',
    Readiness: 'Prontidão',
    'Risk budget · unavailable': 'Orçamento de risk · indisponível',
    'Task running': 'Tarefa em execucao',
    'Working…': 'Trabalhando…',
    'Active run': 'Execução ativa',
    'Unlock runtime': 'Desbloquear runtime',
    'Auth required before live work.': 'Autenticação necessária antes do trabalho ao vivo.',
    'Auth required': 'Autenticação necessária',
    'Runtime needs a check': 'Runtime precisa de verificação',
    'Provider not ready.': 'Provedor não está pronto.',
    'Not live yet.': 'Ainda não está ao vivo.',
    'Runtime offline': 'Runtime offline',
    'Run doctor': 'Executar diagn?stico',
    'No pending diff': 'Nenhum diff pendente',
    None: 'No',
    More: 'Mais',
    Attention: 'Atenção',
    'Pending decision': 'Decisão pendente',
    'In recent trail': 'No trail recente',
    'Review before risky work continues.': 'Revise antes que o trabalho arriscado continue.',
    'No risky actions waiting.': 'No ação arriscada aguardando.',
    'Ready.': 'Pronto.',
    'No task running': 'No tarefa em execução',
    Governed: 'Governado',
    Stable: 'Estável',
    'Needs review': 'Precisa de revisão',
    'At risk': 'Em risco',
    'Diff review': 'Revisão de diff',
    'Trust rail': 'Trilho de confiança',
    'Approve hunk': 'Aprovar trecho',
    'Reject hunk': 'Rejeitar trecho',
    'Approve all pending': 'Aprovar todos pendentes',
    Approved: 'Aprovado',
    Rejected: 'Rejeitado',
    'Hunk approved': 'Trecho approved',
    'Hunk rejected': 'Trecho rejected',
    'All pending hunks approved': 'Todos os trechos pendentes aprovados',
    'Open a patch or artifact with unified-diff text to review hunks here.':
      'Abra um patch or artifact com diff unificado para revisar trechos aqui.',
    'Ready check': 'Verificação de prontidão',
    'Running readiness…': 'Verificando prontidão…',
    'Ready check complete': 'Verificação concluída',
    'Ready check failed': 'Failure na verificação',
    'Diff decision recorded': 'Decisão de diff registrada',
    'Diff decision sent': 'Decisão de diff enviada',
    'Could not reach diff review API; decision kept locally.':
      'Não foi possível alcançar a API de revisão de diff; decisão mantida localmente.',
    '1 hunk': '1 trecho',
    '{n} hunks': '{n} trechos',
    '1 pending': '1 pendente',
    '{n} pending': '{n} pendentes',
    '1 approved': '1 approved',
    '{n} approved': '{n} approved',
    '1 rejected': '1 rejected',
    '{n} rejected': '{n} rejected',
    'Hunk lines': 'Linhas do trecho',
    'Diff trust rail': 'Trilho de confiança do diff',
    '(empty hunk)': '(trecho vazio)',
    'Open trust panel': 'Abrir painel de confiança',
    'Close trust panel': 'Fechar painel de confiança',
    'Used session status summary.': 'Usou o summary de status da sessão.',
    'Could not run readiness.': 'Não foi possível verificar prontidão.',
    'Scheduled task updated': 'Tarefa agendada atualizada',
    'Scheduled task created': 'Tarefa agendada criada',
    'Scheduled task failed': 'Failure na tarefa agendada',
    'Task action completed: {action}': 'Ação concluída: {action}',
    'The task is on the board.': 'A tarefa está no board.',
    'Could not update the scheduled task.': 'Não foi possível atualizar a tarefa agendada.',
    'Could not create the scheduled task.': 'Não foi possível criar a tarefa agendada.',
    'Model preference': 'Preferência de modelo',
    'Primary provider': 'Provedor principal',
    'Primary model': 'Modelo principal',
    'Secondary model': 'Modelo secundário',
    'Primary channel': 'Channel principal',
    'Route id (optional)': 'ID da rota (opcional)',
    'Not configured': 'Não configurado',
    'Save route': 'Salvar rota',
    Preview: 'Prévia',
    'e.g. gpt-4o-mini': 'ex.: gpt-4o-mini',
    'Used if primary model fails': 'Usado se o modelo principal falhar',
    'optional route id': 'id de rota opcional',
    'Route saved': 'Rota salva',
    'Route not saved': 'Rota não salva',
    'Route preview': 'Prévia da rota',
    'Preview unavailable': 'Prévia indisponível',
    Provider: 'Provedor',
    Model: 'Modelo',
    Decision: 'Decisão',
    Approval: 'Aprovação',
    Source: 'Origem',
    Clear: 'Limpar',
    'Preview ready.': 'Prévia pronta.',
    'Could not load the saved model preference.': 'Não foi possível carregar a preferência de modelo.',
    'Could not save the model preference.': 'Não foi possível salvar a preferência de modelo.',
    'Could not preview the model preference.': 'Não foi possível pré-visualizar a preferência de modelo.',
    Workboard: 'Workboard',
    Running: 'Em execução',
    Done: 'Concluído',
    'Open run': 'Abrir execução',
    'Opening run…': 'Abrindo execução…',
    'Jumped to run in transcript': 'Foi para a execução no transcript',
    'Run opened in proof trail': 'Execução aberta no trail de prova',
    'Workboard open': 'Abertura do workboard',
    'Last sync': 'Última sincronização',
    'Nothing pending.': 'Nada pendente.',
    'Open chat to decide': 'Abra o chat para decidir',
    'Approval needed': 'Aprovação necessária',
    'Decision required': 'Decisão necessária',
    recorded: 'registrado',
    'Running.': 'Em execução.',
    Working: 'Trabalhando',
    'Decision needed': 'Decisão necessária',
    Ready: 'Pronto',
    Idle: 'Ocioso',
    Gateway: 'Gateway',
    'Just now': 'Agora',
    'Task in progress': 'Tarefa em execucao',
    'Review pending decisions.': 'Revise as decisões pendentes.',
    'No pending approvals': 'Sem aprovações pendentes',
    'receipt ok': 'recibo ok',
    protected: 'protegido',
    waiting: 'aguardando',
    gated: 'com gate',
    scoped: 'com escopo',
    read: 'read',
    running: 'em execução',
    online: 'online',
    local: 'local',
    '{n} evt': '{n} evt',
    '0 evt': '0 evt',
    '1 error': '1 erro',
    '{n} errors': '{n} erros',
    ok: 'ok',
    approval: 'aprovação',
    active: 'active',
    pending: 'pendente',
  },
  es: {
    Next: 'Siguiente',
    Trust: 'Confianza',
    Pending: 'Pendientes',
    'Last receipt': 'Último recibo',
    Diff: 'Diff',
    'Trust score': 'Puntuación de confianza',
    Open: 'Abrir',
    Proof: 'Prueba',
    Doctor: 'Doctor',
    'New chat': 'Nuevo chat',
    'Open chat': 'Abrir chat',
    'Nothing needs you': 'Nada te necesita',
    'Needs you': 'Te necesita',
    'Ready for a request': 'Listo para un pedido',
    'Start in Inbox.': 'Empieza en la bandeja.',
    '1 approval waiting': '1 aprobación pendiente',
    '{n} approvals waiting': '{n} aprobaciones pendientes',
    'Decide before risky work continues.': 'Decide antes de que continúe el trabajo riesgoso.',
    '1 error in trail': '1 error en el trail',
    '{n} errors in trail': '{n} errores en el trail',
    'Check proof / receipts.': 'Revisa prueba / recibos.',
    'Trust Loop': 'Trust Loop',
    'Receipts, budget, honesty': 'Recibos, presupuesto, honestidad',
    'No proof events yet.': 'Aún no hay eventos de prueba.',
    'Recent proof': 'Prueba reciente',
    'Catalog is not live proof.': 'El catálogo no es prueba en vivo.',
    'Catalog only': 'Solo catálogo',
    'Needs setup': 'Necesita configuración',
    Blocked: 'Bloqueado',
    Live: 'En vivo',
    Readiness: 'Listo',
    'Risk budget · unavailable': 'Presupuesto de riesgo · no disponible',
    'Task running': 'Tarea en curso',
    'Working…': 'Trabajando…',
    'Active run': 'Ejecución activa',
    'Unlock runtime': 'Desbloquear runtime',
    'Auth required before live work.': 'Se requiere autenticación antes del trabajo en vivo.',
    'Auth required': 'Autenticación requerida',
    'Runtime needs a check': 'El runtime necesita una revisión',
    'Provider not ready.': 'Proveedor no listo.',
    'Not live yet.': 'Aún no está en vivo.',
    'Runtime offline': 'Runtime offline',
    'Run doctor': 'Ejecutar doctor',
    'No pending diff': 'Sin diff pendiente',
    None: 'Ninguno',
    More: 'Más',
    Attention: 'Atención',
    'Pending decision': 'Decisión pendiente',
    'In recent trail': 'En el trail reciente',
    'Review before risky work continues.': 'Revisa antes de que continúe el trabajo riesgoso.',
    'No risky actions waiting.': 'No hay acciones riesgosas pendientes.',
    'Ready.': 'Listo.',
    'No task running': 'Ninguna tarea en ejecución',
    Governed: 'Gobernado',
    Stable: 'Estable',
    'Needs review': 'Necesita revisión',
    'At risk': 'En riesgo',
    'Diff review': 'Revisión de diff',
    'Trust rail': 'Riel de confianza',
    'Approve hunk': 'Aprobar tramo',
    'Reject hunk': 'Rechazar tramo',
    'Approve all pending': 'Aprobar todos pendientes',
    Approved: 'Aprobado',
    Rejected: 'Rechazado',
    'Hunk approved': 'Tramo aprobado',
    'Hunk rejected': 'Tramo rechazado',
    'All pending hunks approved': 'Todos los tramos pendientes aprobados',
    'Open a patch or artifact with unified-diff text to review hunks here.':
      'Abre un patch o artefacto con diff unificado para revisar tramos aquí.',
    'Ready check': 'Comprobación de listo',
    'Running readiness…': 'Comprobando listo…',
    'Ready check complete': 'Comprobación completa',
    'Ready check failed': 'Falló la comprobación',
    'Diff decision recorded': 'Decisión de diff registrada',
    'Diff decision sent': 'Decisión de diff enviada',
    'Could not reach diff review API; decision kept locally.':
      'No se pudo alcanzar la API de revisión de diff; decisión mantenida localmente.',
    '1 hunk': '1 tramo',
    '{n} hunks': '{n} tramos',
    '1 pending': '1 pendiente',
    '{n} pending': '{n} pendientes',
    '1 approved': '1 aprobado',
    '{n} approved': '{n} aprobados',
    '1 rejected': '1 rechazado',
    '{n} rejected': '{n} rechazados',
    'Hunk lines': 'Líneas del tramo',
    'Diff trust rail': 'Riel de confianza del diff',
    '(empty hunk)': '(tramo vacío)',
    'Open trust panel': 'Abrir panel de confianza',
    'Close trust panel': 'Cerrar panel de confianza',
    'Used session status summary.': 'Usó el resumen de estado de la sesión.',
    'Could not run readiness.': 'No se pudo comprobar el listo.',
    'Scheduled task updated': 'Tarea programada actualizada',
    'Scheduled task created': 'Tarea programada creada',
    'Scheduled task failed': 'Falló la tarea programada',
    'Task action completed: {action}': 'Acción completada: {action}',
    'The task is on the board.': 'La tarea está en el tablero.',
    'Could not update the scheduled task.': 'No se pudo actualizar la tarea programada.',
    'Could not create the scheduled task.': 'No se pudo crear la tarea programada.',
    'Model preference': 'Preferencia de modelo',
    'Could not load the saved model preference.': 'No se pudo cargar la preference de modelo.',
    'Could not save the model preference.': 'No se pudo guardar la preference de modelo.',
    'Could not preview the model preference.': 'No se pudo previsualizar la preference de modelo.',
    Workboard: 'Tablero',
    Running: 'En ejecución',
    Done: 'Hecho',
    'Open run': 'Abrir ejecución',
    'Opening run…': 'Abriendo ejecución…',
    'Jumped to run in transcript': 'Saltó a la ejecución en el transcript',
    'Run opened in proof trail': 'Ejecución abierta en el trail de prueba',
    'Workboard open': 'Apertura del tablero',
    'Last sync': 'Última sincronización',
    'Nothing pending.': 'Nada pendiente.',
    'Open chat to decide': 'Abre el chat para decidir',
    'Approval needed': 'Aprobación necesaria',
    'Decision required': 'Decisión requerida',
    recorded: 'registrado',
    'Running.': 'En ejecución.',
    Working: 'Trabajando',
    'Decision needed': 'Decisión necesaria',
    Ready: 'Listo',
    Idle: 'Inactivo',
    Gateway: 'Gateway',
    'Just now': 'Ahora',
    'Task in progress': 'Tarea en curso',
    'Review pending decisions.': 'Revisa las decisiones pendientes.',
    'No pending approvals': 'Sin aprobaciones pendientes',
    'receipt ok': 'recibo ok',
    protected: 'protegido',
    waiting: 'esperando',
    gated: 'con gate',
    scoped: 'con alcance',
    read: 'lectura',
    running: 'en ejecución',
    online: 'en línea',
    local: 'local',
    '{n} evt': '{n} evt',
    '0 evt': '0 evt',
    '1 error': '1 error',
    '{n} errors': '{n} errores',
    ok: 'ok',
    approval: 'aprobación',
    active: 'activo',
    pending: 'pendiente',
  },
};

function mergeSurfaceI18n(locale: SupportedControlLocale, base: Record<string, string>): Record<string, string> {
  const surface =
    CONTROL_SURFACE_I18N[locale] ||
    CONTROL_SURFACE_I18N[resolveSupportedControlLocale(locale)] ||
    {};
  return { ...surface, ...base };
}

const STRINGS: Partial<Record<SupportedControlLocale, Record<string, string>>> = {
  'pt-BR': mergeSurfaceI18n('pt-BR', {
    Inbox: 'Caixa de entrada',
    Work: 'Trabalho',
    Memory: 'Memória',
    Canvas: 'Canvas',
    Tools: 'Tools',
    Models: 'Modelos',
    Settings: 'Configurações',
    'Learned knowledge': 'Conhecimento aprendido',
    'Loading learned knowledge…': 'Carregando conhecimento aprendido…',
    'Workflows, conversations, about you, and project knowledge.':
      'Fluxos, conversas, sobre youê e conhecimento do projeto.',
    'Hub unavailable. Run zavorth knowledge status on this machine.':
      'Hub indisponível. Run zavorth knowledge status nesta máquina.',
    Ready: 'Pronto',
    Setup: 'Configurar',
    On: 'Ligado',
    Off: 'Desligado',
    'Learning loop': 'Loop de aprendizado',
    'Skill learning loop': 'Loop de skill drafts',
    Drafts: 'Drafts',
    Improved: 'Melhorados',
    Promoted: 'Promovidos',
    'Top ferramentas': 'Tools principais',
    'Last trigger': 'Último gatilho',
    Week: 'Semana',
    created: 'criados',
    promotes: 'promoções',
    reuses: 'reusos',
    'Zavorth saves multi-tool workflows as local skill drafts; you promote when ready.':
      'O Zavorth guarda fluxos multi-tool como rascunhos locais; youê promove quando quiser.',
    '/learn = skill drafts · /learning = candidates': '/learn = skill drafts · /learning = candidatos',
    Promote: 'Promote',
    Draft: 'Draft',
    Copied: 'Copiado',
    'List drafts': 'Listar rascunhos',
    'Preview promote 1': 'Prévia promote 1',
    'skill draft ready to promote': 'skill draft pronto para promover',
    'skill drafts ready to promote': 'skill drafts ready para promover',
    Workflows: 'Fluxos',
    Conversation: 'Conversa',
    'Conversation recall': 'Lembrar conversas',
    'About you': 'Sobre youê',
    Knowledge: 'Conhecimento',
    'This week': 'Esta semana',
    events: 'eventos',
    'Nenhum events in this window yet.': 'Ainda sem eventos nesta janela.',
    'File index': 'Índice de arquivos',
    'Dream cycle': 'Ciclo de sonho',
    Advanced: 'Avançado',
    'Vault missing': 'Vault ausente',
    arquivos: 'arquivos',
    dirs: 'dirs',
    Changed: 'Alterado',
    'scan capped': 'scan limitado',
    'Preview only': 'Somente prévia',
    'Last run': 'Última execução',
    'Nenhum workflows learned yet': 'Nenhum workflow aprendido ainda',
    'Run zavorth learn for draft counts on this machine.':
      'Run zavorth learn para contagens de rascunhos nesta máquina.',
    'Zavorth remembers workflows, conversations, who you are, and project knowledge — each in the right store.':
      'O Zavorth lembra fluxos, conversas, quem youê é e conhecimento do projeto — cada um no lugar certo.',
    Approvals: 'Aprovações',
    History: 'Histórico',
    Channels: 'Canais',
    Sessions: 'Sessões',
    Agents: 'Agentes',
    Rest: 'Descanso',
    Docs: 'Docs',
    Schedule: 'Agenda',
    'Zavorth ready': 'Zavorth pronto',
    'Ask Zavorth or start with a suggestion.': 'Peça algo ao Zavorth or comece por uma sugestão.',
    Runtime: 'Runtime',
    'Checking access': 'Verificando acesso',
    Gateway: 'Gateway',
    'Local route': 'Rota local',
    'Last sync': 'Última sincronização',
    'Starting now': 'Iniciando agora',
    'Needs your approval': 'Precisa da sua aprovação',
    'No pending approvals': 'No aprovação pendente',
    'Zavorth will surface risky actions here before changing files, tools, or external state.':
      'O Zavorth mostra ações arriscadas aqui antes de alterar arquivos, ferramentas or estado externo.',
    Review: 'Revisar',
    'Organize my day': 'Organizar meu dia',
    'Review workspace': 'Revisar workspace',
    'Check memory': 'Verificar memória',
    'Summarize document': 'Resumir documento',
    'Run checks': 'Rodar verificações',
    'Run audit': 'Executar auditoria',
    'Safety rules': 'Regras de segurança',
    Voice: 'Voz',
    Default: 'Padrão',
    'English US': 'Inglês EUA',
    'English UK': 'Inglês Reino Unido',
    Model: 'Modelo',
    Auto: 'Automático',
    Local: 'Local',
    Safe: 'Seguro',
    Sensitivity: 'Sensibilidade',
    Low: 'Baixa',
    High: 'Alta',
    Advanced: 'Avançado',
    Reasoning: 'Raciocínio',
    Focus: 'Foco',
    'Attach file': 'Anexar file',
    'Start voice': 'Iniciar voz',
    'New session': 'Nova sessão',
    Export: 'Exportar',
    'Listening... Speak now.': 'Ouvindo... Fale agora.',
    'Recording audio... Speak now.': 'Gravando áudio... Fale agora.',
    'Recording audio... Click to stop.': 'Gravando áudio... Clique para parar.',
    'Voice note recorded and attached successfully!': 'Nota de voz gravada e anexada com sucesso!',
    'Speech recognition failed. Switching to direct audio recording...':
      'Reconhecimento de voz failed. Alternando para gravação direta de áudio...',
    'Microphone access is bloqueadas. Allow microphone permission for this site and try again.':
      'Acesso ao microfone bloqueadas. Permita o uso do microfone para este site e tente novamente.',
    'Voice is not available in this browser yet. Type or paste the transcribed text.':
      'Função de voz não disponível neste navegador. Digite or cole o texto.',
    Send: 'Enviar',
    Artifact: 'artifact',
    Search: 'Pesquisar',
    Ready: 'Pronto',
    Protected: 'Protegido',
    Connecting: 'Conectando',
    'Connected to local runtime.': 'Conectado ao runtime local.',
    'Search...': 'Pesquisar...',
    'Search commands, agents, arquivos...': 'Pesquisar comandos, agentes, arquivos...',
    'Suggested Actions': 'Ações sugeridas',
    'Add New Agent': 'Adicionar novo agente',
    'Start Health Check': 'Iniciar verificação',
    'Open Settings': 'Abrir configurações',
    Title: 'Título',
    'Modal content.': 'Conteúdo do modal.',
    Cancel: 'Cancelar',
    Confirm: 'Confirmar',
    'Core Protected': 'Protegido',
    'Core Unlocked': 'Pronto',
    'Core Connecting': 'Conectando',
    'Core checking': 'Core verificando',
    'Core Local': 'Core local',
    'Zavorth connected': 'Pronto',
    'Token required': 'Token necessário',
    'Unlock to send live messages': 'Desbloqueie para enviar mensagens ao vivo',
    'Gateway protected': 'Gateway protegido',
    'Local token required': 'Token local necessário',
    'Saved token needs validation': 'Token salvo precisa de validação',
    'Runtime ready': 'Runtime pronto',
    'Runtime live': 'Runtime ao vivo',
    'Runtime unlocked': 'Runtime desbloqueadas',
    'Runtime local': 'Runtime local',
    'Runtime connected': 'Runtime conectado',
    'Opening event stream': 'Abrindo stream de eventos',
    'Preparing live updates': 'Preparando atualizações ao vivo',
    'Live requests are available': 'Pedidos ao vivo estão disponíveis',
    'Gateway ready': 'Gateway pronto',
    'Stream reconnecting': 'Stream reconectando',
    'Live route': 'Rota ao vivo',
    'Local server responding': 'Servidor local respondendo',
    'Dashboard route': 'Rota do dashboard',
    'Waiting for live state': 'Aguardando estado ao vivo',
    'Gateway local': 'Gateway local',
    'Just now': 'Agora',
    'System Ready': 'Sistema pronto',
    'Reply emitted': 'Resposta emitida',
    'Current model not set': 'Modelo atual não definido',
    'Provider not set': 'Modelo não configurado',
    'Risky actions appear here antes de Zavorth acts.': 'Ações arriscadas aparecem aqui antes do Zavorth agir.',
    'Dashboard Ready': 'Dashboard pronto',
    'Checking local runtime access': 'Verificando acesso ao runtime local',
    'Dashboard is ready.': 'Dashboard pronto.',
    'If this browser needs access, paste the local token. I will mark the runtime connected only after the local bridge confirms it.':
      'Se este navegador precisar de acesso, cole o token local. Vou marcar o runtime como conectado only depois que a ponte local confirmar.',
    'Local access': 'Acesso local',
    'Connect to Zavorth runtime': 'Conectar ao runtime Zavorth',
    'Connect to Zavorth': 'Conectar ao Zavorth',
    'Revalidate token': 'Revalidar token',
    'Paste the local token to unlock live conversations, runs, approvals, and artifacts in this tab.':
      'Cole o token local para desbloquear conversas ao vivo, execuções, aprovações e artefatos nesta aba.',
    'Connection requirements': 'Requisitos de conexão',
    Auth: 'Autenticação',
    'Local server reachable': 'Servidor local acessível',
    'Checking local server': 'Verificando servidor local',
    'Token saved in this tab': 'Token salvo nesta aba',
    Session: 'Sessão',
    'Existing session found': 'Sessão existente encontrada',
    'New session ready': 'Nova sessão pronta',
    'Dashboard token': 'Token do dashboard',
    'Paste the Zavorth token': 'Cole o token do Zavorth',
    'Show token': 'Mostrar token',
    Show: 'Mostrar',
    Hide: 'Ocultar',
    'Hide token': 'Ocultar token',
    'Quick fix': 'Correção rápida',
    'Current route': 'Rota atual',
    'Copy token command': 'Copiar comando do token',
    'Refresh status': 'Atualizar status',
    Reconnect: 'Reconectar',
    'The token is stored only in this tab sessionStorage. After validation, the top status changes to Core Unlocked.':
      'O token fica armazenado apenas no sessionStorage desta aba. Depois da validação, o status superior muda para Core desbloqueadas.',
    'Language updated': 'Idioma atualizado',
    'The dashboard language was applied.': 'O idioma do dashboard foi aplicado.',
    'Current work': 'Trabalho atual',
    'See what Zavorth is doing now, what needs a decision, and the safest next step.':
      'Veja o que o Zavorth está fazendo agora, o que precisa de decisão e o próximo passo mais seguro.',
    'Open chat': 'Abrir chat',
    'Current task': 'Tarefa atual',
    'No task running': 'No tarefa em execução',
    'Ask Zavorth': 'Pedir ao Zavorth',
    'Ask Zavorth safely': 'Pedir ao Zavorth com segurança',
    'Ask Zavorth locally': 'Pedir ao Zavorth localmente',
    'Needs attention': 'Precisa de atenção',
    State: 'Estado',
    Dashboard: 'Dashboard',
    'Risky actions': 'Actions arriscadas',
    online: 'online',
    'Sensitive actions': 'Ações sensíveis',
    'approval gated': 'exigem aprovação',
    'Zavorth ferramentas': 'Tools do Zavorth',
    'Use ready capabilities when they help the current task. Risky work still asks for approval.':
      'Use capacidades ready quando ajudarem a tarefa atual. Trabalho arriscado ainda pede aprovação.',
    'Suggest tool': 'Sugerir tool',
    'Search ferramentas': 'Pesquisar ferramentas',
    All: 'Todas',
    'Needs setup': 'Precisa setup',
    'Approval gated': 'Com aprovação',
    Library: 'Biblioteca',
    'Not sure what to use...': 'Não sabe o que usar...',
    'Choose for me': 'Escolha por mim',
    Safety: 'Segurança',
    'Zavorth memory': 'Memória do Zavorth',
    'Control what Zavorth may remember, which arquivos it can read, and which agents can work alongside it.':
      'Controle o que o Zavorth pode lembrar, quais arquivos pode ler e quais agentes podem trabalhar junto dele.',
    'View memory': 'Ver memória',
    Controls: 'Controles',
    'No memory scope required yet.': 'No escopo de memória necessário ainda.',
    'Add memory scope': 'Adicionar escopo de memória',
    'File memory': 'Memória de arquivos',
    'Parallel work': 'Trabalho paralelo',
    'Connect adapter': 'Conectar agente',
    'Execution environments': 'Ambientes de execução',
    'Configuration, redacted.': 'Configuração, com segredos ocultos.',
    Preferences: 'Preferências',
    'Keep everyday choices here. Advanced runtime details stay folded until needed.':
      'Mantenha aqui as escolhas do dia a dia. Detalhes avançados do runtime ficam recolhidos até serem necessários.',
    Common: 'Comum',
    'What usually matters': 'O que costuma importar',
    'Use device language or choose one manually.': 'Use o idioma do dispositivo or escolha manualmente.',
    'Active engine': 'Engine active',
    'Zavorth can promote to safer engines when a request needs it.':
      'O Zavorth pode promover para engines mais seguros quando o pedido precisar.',
    'Lite, Velocity or Shield.': 'Chat, Rápido or Seguro.',
    'Folders where accepted low-risk diffs may apply faster.':
      'Pastas onde diffs aceitos de baixo risco podem ser aplicados mais rápido.',
    'Model route and provider proof.': 'Rota de modelo e prova de provider.',
    'Developer diagnostics': 'Diagnóstico de desenvolvedor',
    'Settings, simplified.': 'Configurações, simplificadas.',
    'Only the essentials stay visible. Advanced routing, provider proof and diagnostics stay tucked away until needed.':
      'Só o essencial fica visível. Roteamento avançado, prova de provider e diagnósticos ficam guardados até serem necessários.',
    Essentials: 'Essenciais',
    'Only what usually matters': 'Somente o que costuma importar',
    'Approvals limited': 'Aprovações limitadas',
    'Secrets hidden': 'Segredos ocultos',
    'Receipts on': 'Recibos ligados',
    'Dashboard language': 'Idioma do dashboard',
    'Changes the interface only. Runtime IDs and logs stay stable.':
      'Altera apenas a interface. IDs do runtime e logs continuam estáveis.',
    'Active execution mode': 'Modo de execução active',
    'Lite mode': 'Modo chat',
    'Fast mode': 'Modo rápido',
    'Safe mode': 'Modo seguro',
    'Velocity mode': 'Modo rápido',
    'Shield mode': 'Modo seguro',
    'Lite is safest for chat. Velocity and Shield stay policy-gated.':
      'O modo chat é o mais simples. Modos rápido e seguro continuam controlados por política.',
    'Execution mode': 'Modo de execução',
    'Choose Lite, Velocity, or Shield without exposing every policy field.':
      'Escolha chat, rápido or seguro sem expor cada campo de política.',
    'Trusted folders': 'Pastas confiáveis',
    'Only needed when Velocity should apply accepted low-risk diffs.':
      'Necessário apenas quando o modo rápido deve aplicar diffs aceitos de baixo risco.',
    'Provider and diagnostics': 'Provider e diagnósticos',
    'Advanced model route, proof, adapter and connector details.':
      'Rota avançada de modelo, prova, adapter e detalhes de conector.',
    Apply: 'Aplicar',
    'Language, execution mode, trusted folders and diagnostics when needed.':
      'Idioma, modo de execucao, pastas confiaveis e diagnosticos quando necessario.',
    'Interface only. Runtime IDs stay stable.': 'Somente interface. IDs do runtime continuam estaveis.',
    'Lite for chat. Velocity for trusted work. Shield for risco.':
      'Chat para conversa. Rápido para pastas confiáveis. Seguro para risco.',
    'Pick how Zavorth should handle this session.': 'Escolha como o Zavorth deve tratar esta session.',
    'Where Velocity may apply accepted low-risk diffs.':
      'Onde o modo rápido pode aplicar diffs aceitos de baixo risco.',
    'Model route, proof and connector details.': 'Rota de modelo, prova e detalhes de conector.',
    'Fast chat and documents. No system changes.': 'Chat e documentos rapidos. Sem alterar o sistema.',
    'Fast diffs in trusted folders.': 'Diffs rapidos em pastas confiaveis.',
    'Sandbox and approval for risky work.': 'Sandbox e aprovacao para trabalho arriscado',
    'Dashboard reviews; runtime policy decides execution.':
      'Dashboard revisa; a politica do runtime decide a execucao.',
    Instant: 'Instantâneo',
    Fast: 'Rápido',
    Governed: 'Governado',
    Active: 'Ativo',
    Use: 'Usar',
    'Use engine': 'Usar engine',
    Locked: 'Bloqueado',
    Express: 'Express',
    required: 'necessario',
    Trusted: 'Confiavel',
    Sandbox: 'Sandbox',
    Approval: 'Approval',
    'Engine locked': 'Engine bloqueadas',
    'Engine switch': 'Troca de engine',
    'Engine promotion': 'Promocao de engine',
    Switch: 'Trocar',
    'Switch to': 'Trocar para',
    'Runtime policy still decides what can execute.': 'A politica do runtime ainda decide o que pode executar.',
    'Unlock runtime': 'Desbloquear runtime',
    'Keep current': 'Manter atual',
    'Cannot switch yet.': 'Ainda nao da para trocar',
    'Cannot continue yet.': 'Ainda nao da para continuar',
    'Authentication required': 'Autenticacao necessaria',
    'Invalid management token': 'Token de gerenciamento invalido',
    'Unlock the local runtime before switching execution engines.':
      'Desbloqueie o runtime local antes de trocar engines de execucao.',
    'is locked by policy.': 'esta bloqueado por politica.',
    'is required, but locked.': 'e necessario, mas esta bloqueado.',
    'Use another engine.': 'Use outro mecanismo.',
    'Unlock runtime to continue safely.': 'Desbloqueie o runtime para continuar com seguranca.',
    'This needs': 'Isso precisa de',
    'Continue safely...': 'Continuar com seguranca...',
    'Continue with Shield': 'Continuar com Shield',
    'Continue with Velocity': 'Continuar no modo rápido',
    'Continue with Lite': 'Continuar com Lite',
    'Review in Shield before changing files, tools, or external state.':
      'Revise no Shield antes de alterar arquivos, ferramentas or estado externo.',
    'Local decision selected Shield for risky or mutating work.':
      'A decisao local escolheu Shield para trabalho arriscado or mutavel.',
    'Channels stay conversational.': 'Canais continuam conversacionais.',
    'Use web, CLI or remote chat naturally. Zavorth steps in only when a message would expose data or trigger an external action.':
      'Use web, CLI or chat remoto naturalmente. O Zavorth interrompe apenas quando uma mensagem exporia dados or acionaria uma Action externa.',
    'Fast chat and documents. No operating system changes.':
      'Chat e documentos rapidos. Sem mudancas no sistema operacional',
    'Fast diffs in trusted folders. Policy still decides execution.':
      'Diffs rapidos em pastas confiaveis. A politica ainda decide a execucao.',
    'Sandbox, approvals and receipts for sensitive work.': 'Sandbox, aprovacoes e recibos para trabalho sensivel',
    'Fast ask, edit and apply commands with engine routing.':
      'Comandos rapidos de ask, edit e apply com roteamento por engine.',
    'Models, approvals, memory scopes, and channel setup stay readable without exposing raw secrets.':
      'Modelos, aprovações, escopos de memória e canais ficam legíveis sem expor segredos.',
    'Settings health': 'Saúde das configurações',
    'Interface language': 'Idioma da interface',
    'Choose how Zavorth speaks in the dashboard. Internal logs and IDs stay stable.':
      'Escolha como o Zavorth fala no dashboard. Logs internos e IDs continuam estáveis.',
    Language: 'Idioma',
    'System language': 'Idioma do sistema',
    'Follow this device automatically': 'Seguir este dispositivo automaticamente',
    'Auto-detect from browser': 'Detectar pelo navegador',
    'Apply language': 'Aplicar idioma',
    'Provider catalog': 'Catálogo de providers',
    'Active route': 'Rota ativa',
    Fallbacks: 'Fallbacks',
    Proof: 'Prova',
    'Only proven routes become defaults.': 'Somente rotas comprovadas viram padrão.',
    'Keys never appear in output.': 'Chaves nunca aparecem na saída.',
    Routes: 'Rotas',
    Live: 'Ao vivo',
    Media: 'Mídia',
    Execution: 'Execução',
    Adapters: 'Adaptadores',
    Connectors: 'Conectores',
    waiting: 'aguardando',
    loading: 'carregando',
    limited: 'limitado',
    locked: 'bloqueadas',
    on: 'ligado',
    'Catalog waiting': 'Catálogo aguardando',
    'Activation waiting': 'Ativação aguardando',
    Waiting: 'Aguardando',
    Empty: 'Vazio',
    Activation: 'Ativação',
    'Trust plane': 'Plano de confiança',
    Secrets: 'Segredos',
    redacted: 'ocultos',
    'Close dialog': 'Fechar diálogo',
    'Close artifact': 'Fechar artifact',
    'Open menu': 'Abrir menu',
    'Toggle theme': 'Alternar tema',
    'Message settings': 'Configurações da mensagem',
    'Attach arquivos for this message': 'Anexar arquivos a esta mensagem',
    'Dictate the request': 'Ditar o pedido',
    'Choose tool input': 'Escolher entrada de tool',
    'Open trace and receipts': 'Abrir histórico e recibos',
    'Start a clean session': 'Iniciar uma sessão limpa',
    'Export this conversation': 'Exportar esta conversa',
    'Send to Zavorth': 'Enviar ao Zavorth',
    'Canvas recommended': 'Canvas recomendado',
    'Open Canvas': 'Abrir Canvas',
    'Sandbox preview first.': 'Preview em sandbox primeiro.',
    'Review attempts, diffs and bloqueadas network calls antes de anything is applied to your workspace.':
      'Revise tentativas, diffs e chamadas de rede bloqueadas antes de aplicar qualquer coisa ao workspace.',
    'Use Canvas': 'Usar Canvas',
    'Visual or interface work is easier to review in Z-Canvas before applying changes.':
      'Trabalho visual or de interface fica mais fácil de revisar no Z-Canvas antes de aplicar mudanças.',
    'Diff or preview work can be reviewed safely in Z-Canvas.':
      'Diffs or previews podem ser revisados com segurança no Z-Canvas.',
    'Visual, preview, or diff work is safer in the sandbox canvas.':
      'Trabalho visual, preview or diff fica mais seguro no canvas em sandbox.',
    'Keep in chat': 'Manter no chat',
    'Z-Canvas': 'Z-Canvas',
    'New sandbox attempt': 'Nova tentativa em sandbox',
    'Accept diff': 'Aceitar diff',
    'Reject hunk': 'Rejeitar trecho',
    Attempt: 'Tentativa',
    Logs: 'Logs',
    Diffs: 'Diffs',
    'No logs yet': 'Ainda sem logs',
    'Preview is isolated; no host arquivos changed.': 'Preview isolado; nenhum file do host foi alterado.',
    'Review the diff antes de applying.': 'Revise o diff antes de aplicar.',
    'Inspect the failed attempt before continuing.': 'Inspecione a tentativa com falha antes de continuar.',
    'New attempt': 'Nova tentativa',
    attempts: 'tentativas',
    diffs: 'diffs',
    logs: 'logs',
    'bloqueadas requests': 'requisições bloqueadas',
    'No diff yet.': 'Ainda sem diff.',
    'Blocked network': 'Rede bloqueadas',
    None: 'No',
    'Preview this safely antes de applying.': 'Visualize com seguranca antes de aplicar.',
    'Open a sandbox preview before applying visual or file changes.':
      'Abra uma previa em sandbox antes de aplicar mudancas visuais or em arquivos',
    'Preview is starting.': 'A previa esta iniciando.',
  }),
  'es-AR': mergeSurfaceI18n('es-AR', {
    Inbox: 'Bandeja',
    Work: 'Trabajo',
    Memory: 'Memory',
    Canvas: 'Canvas',
    Tools: 'Herramientas',
    Models: 'Modelos',
    Settings: 'Configuración',
    Approvals: 'Aprobaciones',
    History: 'Historyl',
    Channels: 'Channeles',
    Sessions: 'Sesiones',
    Agents: 'Agentes',
    Rest: 'Reposo',
    Docs: 'Docs',
    Schedule: 'Agenda',
    'Zavorth ready': 'Zavorth listo',
    'Ask Zavorth or start with a suggestion.': 'Pedile algo a Zavorth o empezá con una sugerencia.',
    Runtime: 'Runtime',
    'Checking access': 'Verificando acceso',
    Gateway: 'Gateway',
    'Local route': 'Ruta local',
    'Last sync': 'Última sincronización',
    'Starting now': 'Iniciando ahora',
    'Needs your approval': 'Necesita tu aprobación',
    'No pending approvals': 'No hay aprobaciones pendientes',
    'Zavorth will surface risky actions here before changing files, tools, or external state.':
      'Zavorth muestra acciones riesgosas acá antes de cambiar archivos, herramientas o estado externo.',
    Review: 'Revisar',
    'Organize my day': 'Organizar mi día',
    'Review workspace': 'Revisar workspace',
    'Check memory': 'Ver memory',
    'Summarize document': 'Resumir documento',
    'Run checks': 'Ejecutar checks',
    'Run audit': 'Ejecutar auditoría',
    'Safety rules': 'Reglas de seguridad',
    Voice: 'Voz',
    Default: 'Predeterminado',
    'English US': 'Inglés EE. UU.',
    'English UK': 'Inglés Reino Unido',
    Model: 'Modelo',
    Auto: 'Auto',
    Local: 'Local',
    Safe: 'Seguro',
    Sensitivity: 'Sensibilidad',
    Low: 'Baja',
    High: 'Alta',
    Advanced: 'Avanzado',
    Reasoning: 'Razonamiento',
    Focus: 'Foco',
    'Attach file': 'Adjuntar archivo',
    'Start voice': 'Iniciar voz',
    'New session': 'Nueva sesión',
    Export: 'Exportar',
    Send: 'Enviar',
    Artifact: 'Artefacto',
    Search: 'Buscar',
    Ready: 'Listo',
    Protected: 'Protegido',
    Connecting: 'Conectando',
    'Connected to local runtime.': 'Conectado al runtime local.',
    'Search...': 'Buscar...',
    'Search commands, agents, arquivos...': 'Buscar comandos, agentes, archivos...',
    'Suggested Actions': 'Acciones sugeridas',
    'Add New Agent': 'Agregar nuevo agente',
    'Start Health Check': 'Iniciar verificación',
    'Open Settings': 'Abrir configuración',
    Title: 'Título',
    'Modal content.': 'Contenido del modal.',
    Cancel: 'Cancelar',
    Confirm: 'Confirmar',
    'Core Protected': 'Protegido',
    'Core Unlocked': 'Listo',
    'Core Connecting': 'Conectando',
    'Core checking': 'Core verificando',
    'Core Local': 'Core local',
    'Zavorth connected': 'Listo',
    'Token required': 'Token requerido',
    'Unlock to send live messages': 'Desbloqueá para enviar mensajes en vivo',
    'Gateway protected': 'Gateway protegido',
    'Local token required': 'Token local requerido',
    'Saved token needs validation': 'El token guardado necesita validación',
    'Runtime ready': 'Runtime listo',
    'Runtime live': 'Runtime en vivo',
    'Runtime unlocked': 'Runtime desbloqueadas',
    'Runtime connected': 'Runtime conectado',
    'Runtime local': 'Runtime local',
    'Opening event stream': 'Abriendo stream de eventos',
    'Preparing live updates': 'Preparando actualizaciones en vivo',
    'Live requests are available': 'Los pedidos en vivo están disponibles',
    'Gateway ready': 'Gateway listo',
    'Stream reconnecting': 'Stream reconectando',
    'Live route': 'Ruta en vivo',
    'Local server responding': 'Servidor local respondiendo',
    'Dashboard route': 'Ruta del dashboard',
    'Waiting for live state': 'Esperando estado en vivo',
    'Gateway local': 'Gateway local',
    'Just now': 'Ahora',
    'System Ready': 'Sistema listo',
    'Reply emitted': 'Respuesta emitida',
    'Current model not set': 'Modelo actual no definido',
    'Provider not set': 'Modelo no configurado',
    'Risky actions appear here antes de Zavorth acts.':
      'Las acciones riesgosas aparecen aquí antes de que Zavorth actúe.',
    'Dashboard Ready': 'Dashboard listo',
    'Checking local runtime access': 'Verificando acceso al runtime local',
    'Dashboard is ready.': 'Dashboard listo.',
    'If this browser needs access, paste the local token. I will mark the runtime connected only after the local bridge confirms it.':
      'Si este navegador necesita acceso, pega el token local. Marcaré el runtime como conectado solo después de que el puente local lo confirme.',
    'Local access': 'Acceso local',
    'Connect to Zavorth runtime': 'Conectar al runtime de Zavorth',
    'Connect to Zavorth': 'Conectar a Zavorth',
    'Revalidate token': 'Revalidar token',
    'Paste the local token to unlock live conversations, runs, approvals, and artifacts in this tab.':
      'Pegá el token local para desbloquear conversaciones en vivo, ejecuciones, aprobaciones y artefactos en esta pestaña.',
    'Connection requirements': 'Requisitos de conexión',
    Auth: 'Autenticación',
    'Local server reachable': 'Servidor local accesible',
    'Checking local server': 'Verificando servidor local',
    'Token saved in this tab': 'Token guardado en esta pestaña',
    Session: 'Sesión',
    'Existing session found': 'Sesión existente encontrada',
    'New session ready': 'Nueva sesión lista',
    'Dashboard token': 'Token del dashboard',
    'Paste the Zavorth token': 'Pegá el token de Zavorth',
    'Show token': 'Mostrar token',
    Show: 'Mostrar',
    Hide: 'Ocultar',
    'Hide token': 'Ocultar token',
    'Quick fix': 'Arreglo rápido',
    'Current route': 'Ruta actual',
    'Copy token command': 'Copiar comando del token',
    'Refresh status': 'Actualizar estado',
    Reconnect: 'Reconectar',
    'The token is stored only in this tab sessionStorage. After validation, the top status changes to Core Unlocked.':
      'El token se guarda solo en el sessionStorage de esta pestaña. Después de validar, el estado superior cambia a Core desbloqueadas.',
    'Language updated': 'Idioma actualizado',
    'The dashboard language was applied.': 'Se aplicó el idioma del dashboard.',
    'Current work': 'Trabajo actual',
    'See what Zavorth is doing now, what needs a decision, and the safest next step.':
      'Mirá qué está haciendo Zavorth, qué necesita decisión y cuál es el próximo paso seguro.',
    'Open chat': 'Abrir chat',
    'Current task': 'Tarea actual',
    'No task running': 'No hay tarea en ejecución',
    'Ask Zavorth': 'Pedirle a Zavorth',
    'Ask Zavorth safely': 'Pedirle a Zavorth con seguridad',
    'Ask Zavorth locally': 'Pedirle a Zavorth localmente',
    'Needs attention': 'Necesita atención',
    State: 'Estado',
    Dashboard: 'Dashboard',
    online: 'online',
    'Risky actions': 'Acciones riesgosas',
    'Sensitive actions': 'Acciones sensibles',
    'approval gated': 'requieren aprobación',
    'Zavorth ferramentas': 'Herramientas de Zavorth',
    'Use ready capabilities when they help the current task. Risky work still asks for approval.':
      'Usá capacidades listas cuando ayuden a la tarea actual. El trabajo riesgoso sigue pidiendo aprobación.',
    'Suggest tool': 'Sugerir herramienta',
    'Search ferramentas': 'Buscar herramientas',
    All: 'Todas',
    'Needs setup': 'Necesita setup',
    'Approval gated': 'Con aprobación',
    Library: 'Biblioteca',
    'Not sure what to use...': '¿No sabés qué usar...',
    'Choose for me': 'Elegí por mí',
    Safety: 'Seguridad',
    'Zavorth memory': 'Memory de Zavorth',
    'Control what Zavorth may remember, which arquivos it can read, and which agents can work alongside it.':
      'Controlá qué puede recordar Zavorth, qué archivos puede leer y qué agentes pueden trabajar con él.',
    'View memory': 'Ver memory',
    Controls: 'Controles',
    'No memory scope required yet.': 'Todavía no hace falta un alcance de memory.',
    'Add memory scope': 'Agregar alcance de memory',
    'File memory': 'Memory de archivos',
    'Parallel work': 'Trabajo paralelo',
    'Connect adapter': 'Conectar agente',
    'Execution environments': 'Entornos de ejecución',
    'Configuration, redacted.': 'Configuración, con secretos ocultos.',
    Preferences: 'Preferencias',
    'Keep everyday choices here. Advanced runtime details stay folded until needed.':
      'Mantené acá las opciones de uso diario. Los detalles avanzados del runtime quedan cerrados hasta que hagan falta.',
    Common: 'Común',
    'What usually matters': 'Lo que suele importar',
    'Use device language or choose one manually.': 'Usá el idioma del dispositivo o elegí uno manualmente.',
    'Active engine': 'Engine activo',
    'Zavorth can promote to safer engines when a request needs it.':
      'Zavorth puede promover a engines más seguros cuando el pedido lo necesita.',
    'Lite, Velocity or Shield.': 'Chat, rápido o seguro.',
    'Folders where accepted low-risk diffs may apply faster.':
      'Carpetas donde los diffs aceptados de bajo riesgo pueden aplicarse más rápido.',
    'Model route and provider proof.': 'Ruta de modelo y prueba de provider.',
    'Developer diagnostics': 'Diagnóstico de desarrollador',
    'Settings, simplified.': 'Configuración, simplificada.',
    'Only the essentials stay visible. Advanced routing, provider proof and diagnostics stay tucked away until needed.':
      'Solo lo esencial queda visible. Rutas avanzadas, pruebas de proveedor y diagnósticos quedan guardados hasta que hagan falta.',
    Essentials: 'Esenciales',
    'Only what usually matters': 'Solo lo que suele importar',
    'Approvals limited': 'Aprobaciones limitadas',
    'Secrets hidden': 'Secretos ocultos',
    'Receipts on': 'Recibos activos',
    'Dashboard language': 'Idioma del dashboard',
    'Changes the interface only. Runtime IDs and logs stay stable.':
      'Cambia solo la interfaz. IDs del runtime y logs se mantienen estables.',
    'Active execution mode': 'Modo de ejecución activo',
    'Lite mode': 'Modo chat',
    'Fast mode': 'Modo rápido',
    'Safe mode': 'Modo seguro',
    'Velocity mode': 'Modo rápido',
    'Shield mode': 'Modo seguro',
    'Lite is safest for chat. Velocity and Shield stay policy-gated.':
      'El modo chat es el más simple. Los modos rápido y seguro siguen controlados por política.',
    'Execution mode': 'Modo de ejecución',
    'Choose Lite, Velocity, or Shield without exposing every policy field.':
      'Elegí chat, rápido o seguro sin exponer cada campo de política.',
    'Trusted folders': 'Carpetas confiables',
    'Only needed when Velocity should apply accepted low-risk diffs.':
      'Solo hace falta cuando el modo rápido debe aplicar diffs aceptados de bajo riesgo.',
    'Provider and diagnostics': 'Proveedor y diagnósticos',
    'Advanced model route, proof, adapter and connector details.':
      'Ruta avanzada de modelo, prueba, adaptador y detalles de conector.',
    Apply: 'Aplicar',
    'Language, execution mode, trusted folders and diagnostics when needed.':
      'Idioma, modo de ejecucion, carpetas confiables y diagnosticos cuando hagan falta.',
    'Interface only. Runtime IDs stay stable.': 'Solo interfaz. Los IDs del runtime quedan estables.',
    'Lite for chat. Velocity for trusted work. Shield for risco.':
      'Chat para conversar. Rápido para carpetas confiables. Seguro para riesgo.',
    'Pick how Zavorth should handle this session.': 'Elegi como Zavorth debe manejar esta sesion.',
    'Where Velocity may apply accepted low-risk diffs.':
      'Donde el modo rápido puede aplicar diffs aceptados de bajo riesgo.',
    'Model route, proof and connector details.': 'Ruta de modelo, prueba y detalles de conectores.',
    'Fast chat and documents. No system changes.': 'Chat y documentos rapidos. Sin cambiar el sistema.',
    'Fast diffs in trusted folders.': 'Diffs rapidos en carpetas confiables.',
    'Sandbox and approval for risky work.': 'Sandbox e aprovacao para trabalho arriscado',
    'Dashboard reviews; runtime policy decides execution.':
      'El dashboard revisa; la politica del runtime decide la ejecucion.',
    Instant: 'Instantáneo',
    Fast: 'Rápido',
    Governed: 'Gobernado',
    Active: 'Activo',
    Use: 'Usar',
    'Use engine': 'Usar engine',
    Locked: 'Bloqueado',
    Express: 'Express',
    required: 'requerido',
    Trusted: 'Confiable',
    Sandbox: 'Sandbox',
    Approval: 'Aprobacion',
    'Engine locked': 'Engine bloqueadas',
    'Engine switch': 'Cambio de engine',
    'Engine promotion': 'Promocion de engine',
    Switch: 'Cambiar',
    'Switch to': 'Cambiar a',
    'Runtime policy still decides what can execute.': 'La politica del runtime todavia decide que puede ejecutarse.',
    'Unlock runtime': 'Desbloquear runtime',
    'Keep current': 'Mantener actual',
    'Cannot switch yet.': 'Ainda nao da para trocar',
    'Cannot continue yet.': 'Ainda nao da para continuar',
    'Authentication required': 'Autenticacion requerida',
    'Invalid management token': 'Token de administracion invalid',
    'Unlock the local runtime before switching execution engines.':
      'Desbloquea el runtime local antes de cambiar engines de ejecucion.',
    'is locked by policy.': 'esta bloqueado por politica.',
    'is required, but locked.': 'es requerido, pero esta bloqueadas.',
    'Use another engine.': 'Usa otro engine.',
    'Unlock runtime to continue safely.': 'Desbloquea el runtime para continue con seguridad.',
    'This needs': 'Esto necesita',
    'Continue safely...': 'Continuar con seguridad...',
    'Continue with Shield': 'Continuar con Shield',
    'Continue with Velocity': 'Continuar en modo rápido',
    'Continue with Lite': 'Continuar con Lite',
    'Review in Shield before changing files, tools, or external state.':
      'Revisa en Shield antes de cambiar archivos, herramientas o estado externo.',
    'Local decision selected Shield for risky or mutating work.':
      'La decisao local eligio Shield para trabajo riesgoso o mutavel.',
    'Channels stay conversational.': 'Los canales siguen siendo conversacionales.',
    'Use web, CLI or remote chat naturally. Zavorth steps in only when a message would expose data or trigger an external action.':
      'Usa web, CLI o chat remoto con naturalidad. Zavorth interviene solo cuando un mensaje expondria datos o activaria una accion externa.',
    'Fast chat and documents. No operating system changes.':
      'Chat e documentos rapidos. Sem mudancas no sistema operacional',
    'Fast diffs in trusted folders. Policy still decides execution.':
      'Diffs rapidos en carpetas confiables. La politica todavia decide la ejecucion.',
    'Sandbox, approvals and receipts for sensitive work.': 'Sandbox, aprovacoes e recibos para trabalho sensivel',
    'Fast ask, edit and apply commands with engine routing.':
      'Comandos rapidos de ask, edit y apply con ruteo por engine.',
    'Models, approvals, memory scopes, and channel setup stay readable without exposing raw secrets.':
      'Modelos, aprobaciones, alcances de memory y canales se mantienen claros sin exponer secretos.',
    'Settings health': 'Estado de configuración',
    'Interface language': 'Idioma de la interfaz',
    'Choose how Zavorth speaks in the dashboard. Internal logs and IDs stay stable.':
      'Elegí cómo habla Zavorth en el dashboard. Logs internos e IDs quedan estables.',
    Language: 'Idioma',
    'System language': 'Idioma del sistema',
    'Follow this device automatically': 'Seguir este dispositivo automaticamente',
    'Auto-detect from browser': 'Detectar desde el navegador',
    'Apply language': 'Aplicar idioma',
    'Provider catalog': 'Catálogo de providers',
    'Active route': 'Ruta activa',
    Fallbacks: 'Fallbacks',
    Proof: 'Prueba',
    'Only proven routes become defaults.': 'Solo las rutas comprobadas pasan a ser predeterminadas.',
    'Keys never appear in output.': 'Las claves nunca aparecen en la salida.',
    Routes: 'Rutas',
    Live: 'En vivo',
    Media: 'Media',
    Execution: 'Ejecución',
    Adapters: 'Adaptadores',
    Connectors: 'Conectores',
    waiting: 'esperando',
    loading: 'cargando',
    limited: 'limitado',
    locked: 'bloqueadas',
    on: 'activo',
    'Catalog waiting': 'Catálogo esperando',
    'Activation waiting': 'Activación esperando',
    Waiting: 'Esperando',
    Empty: 'Vacío',
    Activation: 'Activación',
    'Trust plane': 'Plano de confianza',
    Secrets: 'Secretos',
    redacted: 'ocultos',
    'Close dialog': 'Cerrar diálogo',
    'Close artifact': 'Cerrar artefacto',
    'Open menu': 'Abrir menú',
    'Toggle theme': 'Cambiar tema',
    'Message settings': 'Configuración del mensaje',
    'Attach arquivos for this message': 'Adjuntar archivos a este mensaje',
    'Dictate the request': 'Dictar el pedido',
    'Choose tool input': 'Elegir entrada de herramienta',
    'Open trace and receipts': 'Abrir historial y recibos',
    'Start a clean session': 'Iniciar una sesión limpia',
    'Export this conversation': 'Exportar esta conversación',
    'Send to Zavorth': 'Enviar a Zavorth',
    'Canvas recommended': 'Canvas recomendado',
    'Open Canvas': 'Abrir Canvas',
    'Sandbox preview first.': 'Vista previa en sandbox primero.',
    'Review attempts, diffs and bloqueadas network calls antes de anything is applied to your workspace.':
      'Revisa intentos, diffs y llamadas de red bloqueadas antes de aplicar cualquier cambio al workspace.',
    'Use Canvas': 'Usar Canvas',
    'Visual or interface work is easier to review in Z-Canvas before applying changes.':
      'El trabajo visual o de interfaz es más fácil de revisar en Z-Canvas antes de aplicar cambios.',
    'Diff or preview work can be reviewed safely in Z-Canvas.':
      'Los diffs o previews pueden revisarse de forma segura en Z-Canvas.',
    'Visual, preview, or diff work is safer in the sandbox canvas.':
      'El trabajo visual, preview o diff es más seguro en el canvas con sandbox.',
    'Keep in chat': 'Mantener en el chat',
    'Z-Canvas': 'Z-Canvas',
    'New sandbox attempt': 'Nuevo intento en sandbox',
    'Accept diff': 'Aceptar diff',
    'Reject hunk': 'Rechazar bloque',
    Attempt: 'Intento',
    Logs: 'Logs',
    Diffs: 'Diffs',
    'Blocked network': 'Red bloqueadas',
    None: 'Ninguno',
    'Preview this safely antes de applying.': 'Previsualiza esto con seguridad antes de aplicar.',
    'Open a sandbox preview before applying visual or file changes.':
      'Abra uma previa em sandbox antes de aplicar mudancas visuais or em arquivos',
    'No logs yet': 'Todavia no hay logs',
    'Preview is isolated; no host arquivos changed.': 'La preview esta aislada; no se cambio ningun archivo del host.',
    'Review the diff antes de applying.': 'Revisa el diff antes de aplicar.',
    'Inspect the failed attempt before continuing.': 'Revisa el intento fallido antes de continuar.',
    'New attempt': 'Nuevo intento',
    attempts: 'intentos',
    diffs: 'diffs',
    logs: 'logs',
    'bloqueadas requests': 'solicitudes bloqueadas',
    'No diff yet.': 'Todavia no hay diff.',
    'Preview is starting.': 'La vista previa esta iniciando.',
  }),
};
const DASHBOARD_ACCESS_STRINGS = {
  'Dashboard Ready': 'Dashboard Ready',
  'Checking local runtime access': 'Checking local runtime access',
  'Dashboard is ready.': 'Dashboard is ready.',
  'If this browser needs access, paste the local token. I will mark the runtime connected only after the local bridge confirms it.':
    'If this browser needs access, paste the local token. I will mark the runtime connected only after the local bridge confirms it.',
};

SUPPORTED_LOCALES.forEach((locale) => {
  STRINGS[locale] = {
    ...DASHBOARD_ACCESS_STRINGS,
    ...(STRINGS[locale] || {}),
  };
});
(STRINGS as any)['es'] = STRINGS['es-AR'];

declare global {
  interface Window {
    ZavorthLocale?: {
      get: () => string;
      getPreference: () => ControlLocalePreference;
      set: (locale: ControlLocalePreference | 'auto') => string;
      apply: (root?: ParentNode) => void;
      t: (value: string) => string;
    };
  }
}

function normalizeLocale(value: string | undefined | null): string {
  const clean = String(value || '').trim();
  if (!clean) return 'en-US';
  try {
    return Intl.getCanonicalLocales(clean.replace(/_/g, '-'))[0] || clean;
  } catch {
    return clean;
  }
}

function baseLanguageOf(locale: string): string {
  try {
    return new Intl.Locale(locale).language.toLowerCase();
  } catch {
    return normalizeLocale(locale).split('-')[0]?.toLowerCase() || 'en';
  }
}

export function detectDeviceLocale(): string {
  const languages =
    Array.isArray(navigator.languages) && navigator.languages.length > 0 ? navigator.languages : [navigator.language];
  return normalizeLocale(languages.find(Boolean) || 'en-US');
}

export function resolveSupportedControlLocale(locale: string): SupportedControlLocale {
  const normalized = normalizeLocale(locale);
  const exact = SUPPORTED_LOCALES.find((item) => item.toLowerCase() === normalized.toLowerCase());
  if (exact) return exact;
  const language = normalized.split('-')[0]?.toLowerCase();
  if (language === 'pt') return 'pt-BR';
  if (language === 'es') return 'es';
  if (language === 'zh') return 'zh-CN';
  if (language === 'ja') return 'ja-JP';
  return 'en-US';
}

export function detectControlLocale(): ControlLocale {
  return resolveSupportedControlLocale(detectDeviceLocale());
}

export function readControlLocalePreference(): ControlLocalePreference {
  try {
    const saved = localStorage.getItem(LOCALE_KEY);
    if (saved === 'auto') return 'system';
    if (saved === 'system' || SUPPORTED_LOCALES.includes(saved as SupportedControlLocale)) {
      return saved as ControlLocalePreference;
    }
  } catch {
    // Locale is a convenience preference.
  }
  // Follow the device language when the user has not set an override.
  return 'system';
}

export function readControlLocale(): ControlLocale {
  const preference = readControlLocalePreference();
  return preference === 'system' ? detectControlLocale() : preference;
}

export function readEffectiveDocumentLocale(): string {
  const preference = readControlLocalePreference();
  return preference === 'system' ? detectDeviceLocale() : preference;
}

export function persistControlLocale(locale: ControlLocalePreference | 'auto'): string {
  const preference = locale === 'auto' ? 'system' : locale;
  const resolved = preference === 'system' ? detectControlLocale() : resolveSupportedControlLocale(preference);
  const documentLocale = preference === 'system' ? detectDeviceLocale() : resolved;
  try {
    localStorage.setItem(LOCALE_KEY, preference);
  } catch {
    // Locale is a convenience preference.
  }
  document.documentElement.lang = documentLocale;
  document.documentElement.dataset.zavorthLocalePreference = preference;
  document.documentElement.dataset.zavorthLocale = resolved;
  window.dispatchEvent(
    new CustomEvent('zavorth-control-locale-change', { detail: { locale: resolved, documentLocale, preference } }),
  );
  return documentLocale;
}

export function translate(value: string, locale = readControlLocale()): string {
  const clean = String(value || '').trim();
  if (!clean) return value;
  if (locale === 'en-US') return value;
  const table =
    STRINGS[locale] ||
    STRINGS[resolveSupportedControlLocale(locale)] ||
    {};
  if (table[clean]) return table[clean];
  // Template keys like "{n} approvals waiting"
  for (const [key, translated] of Object.entries(table)) {
    if (!key.includes('{n}')) continue;
    const pattern = new RegExp(`^${key.replace(/[.*+...^${}()|[\]\\]/g, '\\$&').replace('\\{n\\}', '(\\d+)')}$`);
    const match = clean.match(pattern);
    if (match) return translated.replace('{n}', match[1] || '');
  }
  return value;
}

/** Translate with a count placeholder. */
export function translateCount(
  singular: string,
  pluralTemplate: string,
  count: number,
  locale = readControlLocale(),
): string {
  if (count === 1) return translate(singular, locale);
  return translate(pluralTemplate, locale).replace(/\{n\}/g, String(count));
}

export function applyControlLocale(root: ParentNode = document) {
  const locale = readControlLocale();
  document.documentElement.lang = readEffectiveDocumentLocale();
  document.documentElement.dataset.zavorthLocalePreference = readControlLocalePreference();
  document.documentElement.dataset.zavorthLocale = locale;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.textContent || '';
      if (!text.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest('script, style, code, pre, .mono, .artifact-render, .data-table'))
        return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach((node) => {
    const record = node as Text & { __zavorthI18nOriginal?: string };
    if (!record.__zavorthI18nOriginal) record.__zavorthI18nOriginal = node.textContent || '';
    const original = record.__zavorthI18nOriginal;
    const leading = original.match(/^\s*/)?.[0] || '';
    const trailing = original.match(/\s*$/)?.[0] || '';
    const translated = translate(original, locale);
    if (translated !== original) node.textContent = `${leading}${translated.trim()}${trailing}`;
    if (locale === 'en-US') node.textContent = original;
  });

  root.querySelectorAll?.('[placeholder], [title], [aria-label], [data-tooltip], [data-prompt]').forEach((el) => {
    ['placeholder', 'title', 'aria-label', 'data-tooltip', 'data-prompt'].forEach((attr) => {
      const key = `zavorthI18n${attr.replace(/[^a-z0-9]/gi, '')}`;
      const value = el.getAttribute(attr);
      if (!value) return;
      if (!el.getAttribute(`data-${key}`)) el.setAttribute(`data-${key}`, value);
      const original = el.getAttribute(`data-${key}`) || value;
      const translated = translate(original, locale);
      if (translated !== value) el.setAttribute(attr, translated);
      if (locale === 'en-US') el.setAttribute(attr, original);
    });
  });
}

async function syncLocaleToBackend(locale: string) {
  try {
    const token = sessionStorage.getItem('zavorth.zavorthControl.webToken');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['X-Zavorth-Token'] = token;
    }
    const response = await fetch('/api/v2/agent/locale', {
      method: 'POST',
      headers,
      body: JSON.stringify({ lang: locale }),
    });
    if (!response.ok) {
      shellWarn(`LocaleSync failed to sync language to backend: ${response.status}`);
    }
  } catch (error: unknown) {
    shellWarn(`LocaleSync error syncing language to backend: ${(error as Error).message}`);
  }
}

async function loadLocaleFromBackend() {
  try {
    const token = sessionStorage.getItem('zavorth.zavorthControl.webToken');
    const headers: Record<string, string> = {};
    if (token) {
      headers['X-Zavorth-Token'] = token;
    }
    const response = await fetch('/api/v2/agent/locale', { headers });
    if (response.ok) {
      const payload = await response.json();
      if (payload.ok && payload.data && typeof payload.data.lang === 'string') {
        const backendLang = payload.data.lang;
        const currentPref = readControlLocalePreference();
        if (currentPref !== backendLang) {
          persistControlLocale(backendLang as any);
          applyControlLocale();
        }
      }
    }
  } catch (error: unknown) {
    shellWarn(`LocaleSync error loading language from backend: ${(error as Error).message}`);
  }
}

export function installControlLocale() {
  window.ZavorthLocale = {
    get: readEffectiveDocumentLocale,
    getPreference: readControlLocalePreference,
    set: (locale) => {
      const resolved = persistControlLocale(locale);
      applyControlLocale();
      void syncLocaleToBackend(locale);
      return resolved;
    },
    apply: applyControlLocale,
    t: (value) => translate(value),
  };
  applyControlLocale();
  void loadLocaleFromBackend();

  window.addEventListener('languagechange', () => {
    if (readControlLocalePreference() !== 'system') return;
    applyControlLocale();
    window.dispatchEvent(
      new CustomEvent('zavorth-control-locale-change', {
        detail: {
          locale: readControlLocale(),
          documentLocale: readEffectiveDocumentLocale(),
          preference: 'system',
        },
      }),
    );
  });

  window.addEventListener('zavorth-control-locale-change', (event: any) => {
    const pref = event.detail?.preference;
    if (pref) {
      const select = document.querySelector('[data-zavorth-locale-select]');
      if (select instanceof HTMLSelectElement) {
        select.value = pref;
      }
    }
  });
}
