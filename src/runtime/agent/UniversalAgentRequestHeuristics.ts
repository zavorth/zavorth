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
    /\b(rode|rodar|execute|executar|comando|shell|powershell|terminal|npm|pnpm|yarn|git|build|teste|testes|jest)\b/i,
    'shell.exec',
  );
  addIfMatches(
    tools,
    normalizedText,
    /\b(pesquise|pesquisar|buscar|busque|artigos?|recentes?|internet|web|site|url)\b/i,
    'network_fetch',
  );
  addIfMatches(
    tools,
    normalizedText,
    /\b(pdf|envie|enviar|email|anexo)\b/i,
    'pdf.generate',
  );
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
