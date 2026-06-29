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
  }
};

export function t(key: string): string {
  const lang = navigator.language.startsWith('pt') ? 'pt' : 'en';
  return translations[lang][key] || key;
}
