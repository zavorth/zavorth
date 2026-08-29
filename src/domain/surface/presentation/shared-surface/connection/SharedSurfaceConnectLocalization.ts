/**
 * Shared Surface Connect Localization.
 * Internationalization dictionaries (EN and PT) for connection slash commands and messages.
 *
 * Strict Clean Code: English-first codebase, zero `any`, fully typed.
 */

export interface ConnectLocaleStrings {
  usageConnect: string;
  usageDisconnect: string;
  rateLimitExceeded: string;
  targetNotRecognized: string;
  alreadyConnected: string;
  provideLocalPath: string;
  pathVerificationFailed: string;
  connectedLocalPath: string;
  provideApiKey: string;
  apiKeyVerificationFailed: string;
  connectedApiKey: string;
  deviceCodeInstructions: string;
  oauthClickLink: string;
  oauthEnded: string;
  connectedGeneric: string;
  disconnectedSuccess: string;
  notConnected: string;
  noActiveConnections: string;
  activeConnectionsHeader: string;
  catalogHeader: string;
  catalogEmpty: string;
  handshakeInProgress: string;
  handshakeLimitReached: string;
  statusHeader: string;
  statusEmpty: string;
}

export const CONNECT_EN_STRINGS: ConnectLocaleStrings = {
  usageConnect: [
    '`/connect <target> [credential]`',
    '',
    '**Examples:**',
    '• `/connect github`',
    '• `/connect stripe sk_live_...`',
    '• `/connect obsidian /path/to/vault`',
    '',
    'Use `/connections catalog` to view all available targets.',
  ].join('\n'),
  usageDisconnect: 'Usage: `/disconnect <target>`\nExample: `/disconnect stripe`',
  rateLimitExceeded: '⚠️ Rate limit exceeded. Please wait a moment before sending more connection commands.',
  targetNotRecognized: "Target '{target}' is not recognized.",
  alreadyConnected: 'Target **{name}** is already connected (status: `connected`).\n\n• To reconnect or upgrade credentials: `/connect {target} <new_credentials>`\n• To disconnect: `/disconnect {target}`',
  provideLocalPath: 'To connect **{name}**, specify the local directory path:\n`/connect {target} /path/to/{kind}`',
  pathVerificationFailed: '❌ Path verification failed for **{name}**: {details} ({error})',
  connectedLocalPath: '✅ Connected to **{name}** successfully! Local directory verified at: `{path}`',
  provideApiKey: 'To connect **{name}**, provide your {label}:\n`/connect {target} <your_key>`\n{helpUrl}',
  apiKeyVerificationFailed: '❌ Verification ping failed for **{name}**: {details} ({error})',
  connectedApiKey: '✅ Connected to **{name}** successfully! Credentials encrypted in vault.',
  deviceCodeInstructions: 'To complete device authorization for **{name}**:\n1. Open: {url}\n2. Enter pairing code: `{code}`',
  oauthClickLink: '🔗 **Connect {name}:**\nClick the link below to authorize Zavorth:\n[Authorize {name}]({url})',
  oauthEnded: '⚠️ OAuth authorization ended for **{name}**: {details}',
  connectedGeneric: '✅ Connection to **{name}** established.',
  disconnectedSuccess: '🔌 Disconnected from **{name}**. Local secrets purged.',
  notConnected: "Not connected to '{target}'.",
  noActiveConnections: 'No active connections found.\n\n• Connect an integration: `/connect <target>`\n• View available catalog: `/connections catalog`',
  activeConnectionsHeader: '**Your Active Connections ({count}):**',
  catalogHeader: '**Available Connection Catalog:**',
  catalogEmpty: 'No targets are currently available in the connection catalog.',
  handshakeInProgress: '⚠️ A connection handshake is already in progress for this target.',
  handshakeLimitReached: '⚠️ Global connection handshake limit reached. Please wait a few seconds.',
  statusHeader: '**Connection Health Status:**',
  statusEmpty: 'No active connections to report status.',
};

export const CONNECT_PT_STRINGS: ConnectLocaleStrings = {
  usageConnect: [
    '`/connect <alvo> [credencial]`',
    '',
    '**Exemplos:**',
    '• `/connect github`',
    '• `/connect stripe sk_live_...`',
    '• `/connect obsidian /caminho/do/vault`',
    '',
    'Use `/connections catalog` para ver todos os alvos disponíveis.',
  ].join('\n'),
  usageDisconnect: 'Uso: `/disconnect <alvo>`\nExemplo: `/disconnect stripe`',
  rateLimitExceeded: '⚠️ Limite de requisições atingido. Por favor, aguarde um momento antes de enviar novos comandos.',
  targetNotRecognized: "O alvo '{target}' não foi reconhecido.",
  alreadyConnected: 'O alvo **{name}** já está conectado (status: `connected`).\n\n• Para reconectar ou atualizar credenciais: `/connect {target} <novas_credenciais>`\n• Para desconectar: `/disconnect {target}`',
  provideLocalPath: 'Para conectar o **{name}**, informe o caminho local do diretório:\n`/connect {target} /caminho/do/{kind}`',
  pathVerificationFailed: '❌ Falha ao verificar o caminho para **{name}**: {details} ({error})',
  connectedLocalPath: '✅ Conectado ao **{name}** com sucesso! Diretório local verificado em: `{path}`',
  provideApiKey: 'Para conectar o **{name}**, forneça sua {label}:\n`/connect {target} <sua_chave>`\n{helpUrl}',
  apiKeyVerificationFailed: '❌ Falha na verificação da chave para **{name}**: {details} ({error})',
  connectedApiKey: '✅ Conectado ao **{name}** com sucesso! Credenciais salvas no cofre criptografado.',
  deviceCodeInstructions: 'Para concluir a autorização do dispositivo para **{name}**:\n1. Acesse: {url}\n2. Digite o código de emparelhamento: `{code}`',
  oauthClickLink: '🔗 **Conectar {name}:**\nClique no link abaixo para autorizar o Zavorth:\n[Autorizar {name}]({url})',
  oauthEnded: '⚠️ Autorização OAuth encerrada para **{name}**: {details}',
  connectedGeneric: '✅ Conexão com **{name}** estabelecida.',
  disconnectedSuccess: '🔌 Desconectado de **{name}**. Credenciais locais expurgadas do cofre.',
  notConnected: "Não há conexão ativa com '{target}'.",
  noActiveConnections: 'Nenhuma conexão ativa encontrada.\n\n• Conectar uma integração: `/connect <alvo>`\n• Ver catálogo disponível: `/connections catalog`',
  activeConnectionsHeader: '**Suas Conexões Ativas ({count}):**',
  catalogHeader: '**Catálogo de Conexões Disponíveis:**',
  catalogEmpty: 'Nenhum alvo disponível no catálogo no momento.',
  handshakeInProgress: '⚠️ Já existe uma tentativa de conexão em andamento para este alvo.',
  handshakeLimitReached: '⚠️ Limite global de tentativas de conexão simultâneas atingido. Aguarde alguns segundos.',
  statusHeader: '**Status de Integridade das Conexões:**',
  statusEmpty: 'Nenhuma conexão ativa para exibir status.',
};

export function getConnectStrings(locale?: string): ConnectLocaleStrings {
  const norm = String(locale || '').toLowerCase().trim();
  if (norm.startsWith('pt')) {
    return CONNECT_PT_STRINGS;
  }
  return CONNECT_EN_STRINGS;
}

export function formatTemplate(template: string, params: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replaceAll(`{${key}}`, String(value));
  }
  return result;
}
