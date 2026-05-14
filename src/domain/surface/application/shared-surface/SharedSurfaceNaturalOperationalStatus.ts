const PROVIDER_WORDS = /\b(provider|providers|provedor|provedores|model|models|modelo|modelos|llm|llms)\b/i;
const CHANNEL_WORDS = /\b(channel|channels|canal|canais|telegram|whatsapp|discord|signal|imessage|slack|teams|email)\b/i;
const RUNTIME_WORDS = /\b(runtime|status|health|saude|saúde|diagnostico|diagnóstico|diagnostics|gateway|sistema|system|broken|quebrado|quebrados|falha|falhas|erro|erros|resumo|summary)\b/i;
const QUESTION_OR_STATUS_WORDS = /\b(which|what|show|list|available|ready|status|health|quais|qual|mostre|mostrar|liste|listar|disponivel|disponiveis|disponível|disponíveis|pronto|prontos|quebrado|quebrados|falhando|funcionando|posso usar|pode usar)\b/i;
const MUTATING_OR_SELECTION_WORDS = /\b(use|usar|usa|configure|configurar|set|selecionar|seleciona|trocar|mudar|switch|apply|aplicar|ativar|activate|connect|conectar)\b/i;

export function resolveNaturalOperationalStatusCommand(rawText: string): string | null {
  const text = String(rawText || '').trim();
  if (!text || text.startsWith('/')) {
    return null;
  }

  if (!QUESTION_OR_STATUS_WORDS.test(text)) {
    return null;
  }

  const isMutatingRequest = MUTATING_OR_SELECTION_WORDS.test(text)
    && !/\b(posso usar|pode usar|available|ready|status|quais|qual|which|what|show|list|mostre|liste)\b/i.test(text);
  if (isMutatingRequest) {
    return null;
  }

  if (CHANNEL_WORDS.test(text)) {
    return '/channels';
  }

  if (PROVIDER_WORDS.test(text)) {
    return '/models';
  }

  if (RUNTIME_WORDS.test(text)) {
    return '/status';
  }

  return null;
}
