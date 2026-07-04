const translations: Record<string, Record<string, string>> = {
  en: {
    chat: 'Chat',
    files: 'Files',
    review: 'Review',
    memory: 'Memory',
    plugins: 'Plugins',
    channels: 'Channels',
    settings: 'Settings',
    webPreview: 'Web Preview',
    'subagent.status.idle': 'idle',
    'subagent.status.queued': 'queued',
    'subagent.status.running': 'running',
    'subagent.status.completed': 'completed',
    'subagent.status.blocked': 'blocked',
    'subagent.status.failed': 'failed',
    'subagent.status.approval-required': 'approval required',
  },
  pt: {
    chat: 'Conversa',
    files: 'Arquivos',
    review: 'Revisão',
    memory: 'Memória',
    plugins: 'Plugins',
    channels: 'Canais',
    settings: 'Configurações',
    webPreview: 'Visualizador Web',
    'subagent.status.idle': 'ocioso',
    'subagent.status.queued': 'na fila',
    'subagent.status.running': 'em execucao',
    'subagent.status.completed': 'concluido',
    'subagent.status.blocked': 'bloqueado',
    'subagent.status.failed': 'falhou',
    'subagent.status.approval-required': 'aguardando aprovacao',
  }
};

export function t(key: string): string {
  const lang = navigator.language.startsWith('pt') ? 'pt' : 'en';
  return translations[lang][key] || key;
}
