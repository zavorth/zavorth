export type UniversalAgentToolInferenceInput = {
  text: string;
  capabilityIds?: string[] | null;
  fallbackTool?: string | null;
};

function addIfMatches(tools: Set<string>, text: string, pattern: RegExp, toolId: string): void {
  if (pattern.test(text)) {
    tools.add(toolId);
  }
}

function hasUrl(text: string): boolean {
  return /https?:\/\/|www\./i.test(text);
}

function asksForWebOperation(text: string): boolean {
  if (/\b(pesquise|pesquisar|buscar|busque|procure|internet|web)\b/i.test(text)) {
    return true;
  }
  if (/\b(fetch|baixe|download)\b/i.test(text)) {
    return true;
  }
  if (/\b(acesse|acessar|abra|abrir|navegue)\b/i.test(text)
    && (hasUrl(text) || /\b(link|url|site|pagina|page|website|artigo|noticia)\b/i.test(text))) {
    return true;
  }
  if (
    hasUrl(text)
    && /\b(leia|ler|resuma|resumir|analise|analisar|explique|explicar|extraia|extrair|verifique|verificar)\b/i.test(text)
  ) {
    return true;
  }
  if (/\b(link|url|site|pagina|page|website)\b/i.test(text)
    && /\b(leia|ler|resuma|resumir|analise|analisar|abra|abrir|acesse|acessar|verifique|verificar)\b/i.test(text)) {
    return true;
  }
  return false;
}

function asksForShellExecution(text: string): boolean {
  if (/\b(shell|powershell|pwsh|terminal|comando(?:\s+de\s+terminal)?|linha\s+de\s+comando)\b/i.test(text)) {
    return true;
  }

  if (/\b(npm|pnpm|yarn|npx|node|python|pytest|jest|git|docker|cargo|go|bash|sh|cmd)\s+[\w:./-]+/i.test(text)) {
    return true;
  }

  const activeExecutionVerb = /\b(rode|rodar|execute|executar|executa|run|runs?|dispare|inicie)\b/i.test(text);
  const concreteCommandTarget = /\b(npm|pnpm|yarn|npx|node|python|pytest|jest|git|docker|cargo|go|bash|sh|cmd|powershell|pwsh|build|testes?|scripts?)\b/i.test(text);
  return activeExecutionVerb && concreteCommandTarget;
}

function asksForPdfOrExternalReport(text: string): boolean {
  if (/\b(pdf|anexo)\b/i.test(text)) {
    return true;
  }
  return /\b(envie|enviar|mande|mandar)\b/i.test(text)
    && /\b(email|relatorio|report|anexo|arquivo)\b/i.test(text);
}

function asksForCurrentDateTime(text: string): boolean {
  const temporalTarget = /\b(horas?|hora\s+atual|que\s+dia|dia\s+de\s+hoje|data\s+atual|agora|today|now|current\s+(?:time|date)|what\s+time|date\s+today)\b/i.test(text);
  const temporalQuestion = /\b(que|qual|quais|me\s+diga|diga|informe|sabe|saber|what|tell\s+me)\b[\s\S]{0,80}\b(horas?|data|dia|time|date)\b/i.test(text)
    || /\b(horas?|data|dia|time|date)\b[\s\S]{0,80}\b(agora|atual|hoje|today|now|current)\b/i.test(text);
  const timezoneHint = /\b(brasilia|brasília|sao\s+paulo|são\s+paulo|brazil|utc|gmt|timezone|fuso)\b/i.test(text);
  return temporalQuestion || (temporalTarget && timezoneHint);
}

export function inferUniversalAgentRequestedTools(input: UniversalAgentToolInferenceInput): string[] {
  const rawText = String(input.text || '');
  const normalizedText = rawText
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const tools = new Set<string>();
  const suppressToolCreation = /\bsem\s+(criar|gerar|usar|chamar|acionar)\s+(ferramenta|tool|mensagem|message)\b/i.test(normalizedText);

  addIfMatches(
    tools,
    normalizedText,
    /\b(zavorth|configuracao|configuração|governanca|governança|governance|provider|modelo|home|wake|echo|task|cron|memoria|memória|approval|aprovacao|aprovação|channel|canal|sandbox|setup)\b[\s\S]{0,120}\b(mude|mudar|alterar|altere|trocar|troque|configurar|configure|ativar|ative|desativar|desative|status|readiness|doctor)\b|\b(mude|mudar|alterar|altere|trocar|troque|configurar|configure|ativar|ative|desativar|desative)\b[\s\S]{0,120}\b(zavorth|configuracao|configuração|governanca|governança|governance|provider|modelo|home|wake|echo|task|cron|memoria|memória|approval|aprovacao|aprovação|channel|canal|sandbox|setup)\b/i,
    'zavorth_action',
  );
  addIfMatches(
    tools,
    normalizedText,
    /\b(compare|comparar|mudou|mudanca|mudancas|diff)\b|\b(analise|analysis|analisar|review|revisar|liste|listar|mostre|mostrar|inspecione|inspecionar)\b[\s\S]{0,80}\b(downloads?|desktop|documentos?|pasta|folder|repository|repositorio|repo|module|modulo|code|codigo|file|arquivo|logs?)\b|\b(downloads?|desktop|documentos?|pasta|folder|repository|repositorio|repo|module|modulo|code|codigo|file|arquivo|logs?)\b[\s\S]{0,80}\b(analise|analysis|analisar|review|revisar|liste|listar|mostre|mostrar|inspecione|inspecionar)\b/i,
    'read_file',
  );
  if (!suppressToolCreation) {
    addIfMatches(
      tools,
      normalizedText,
      /\b(crie|criar|edite|editar|altere|alterar|corrija|corrigir|salve|aplique|patch|arquivo|organize|organizar|mova|mover|renomeie|renomear)\b/i,
      'write_file',
    );
  }
  addIfMatches(
    tools,
    normalizedText,
    /\b(shell|powershell|pwsh|terminal|comando(?:\s+de\s+terminal)?|linha\s+de\s+comando)\b/i,
    'shell.exec',
  );
  if (asksForShellExecution(normalizedText)) {
    tools.add('shell.exec');
  }
  if (asksForWebOperation(normalizedText)) {
    tools.add('network_fetch');
  }
  if (asksForPdfOrExternalReport(normalizedText)) {
    tools.add('pdf.generate');
  }
  if (asksForCurrentDateTime(normalizedText)) {
    tools.add('get_datetime');
  }
  addIfMatches(
    tools,
    normalizedText,
    /\b(swarm|multiagente|multi-agente|subagentes?|equipe de agentes?|time de agentes?|agentes em paralelo|decomponha com agentes)\b/i,
    'swarm.run',
  );
  addIfMatches(
    tools,
    normalizedText,
    /\b(echo|resposta por voz|responder por voz|falar em voz|modo voz|audio de resposta|hands[-\s]?free)\b/i,
    'echo_hands',
  );
  addIfMatches(
    tools,
    normalizedText,
    /\b(watch mode|watchmode|modo watch|modo de observacao|observe a tela|observar a tela|monitorar a tela|supervisione a tela|computer use)\b/i,
    'watchmode.control',
  );
  addIfMatches(
    tools,
    normalizedText,
    /\b(selfmod|self[-\s]?modification|auto[-\s]?melhoria|auto[-\s]?evolucao|melhore o zavorth|evolua o zavorth|modifique o zavorth|aperfeicoe o zavorth)\b/i,
    'selfmod.preview',
  );

  (input.capabilityIds || []).forEach((capabilityId) => {
    const normalized = String(capabilityId || '').trim();
    if (normalized) {
      tools.add(normalized);
    }
  });

  if (tools.size === 0 && input.fallbackTool !== null) {
    tools.add(String(input.fallbackTool || 'memory.read').trim() || 'memory.read');
  }

  return Array.from(tools);
}
