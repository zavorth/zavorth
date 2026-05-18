/**
 * MnemosCognitiveProtocol
 *
 * Define as instruções de cadência cognitiva que o agente LLM deve seguir
 * quando o Mnemos está disponível como tool. Estas instruções são injetadas
 * como uma layer de contexto adicional no system prompt do agente.
 *
 * A cadência segue três estágios:
 *  Estágio 1: Busca semântica no cofre → search_memory
 *  Estágio 2: Varredura de metadados   → scan_local_metadata
 *  Estágio 3: Human-in-the-Loop        → botões inline para o usuário
 */

export const MNEMOS_SEARCH_MEMORY_TOOL = 'search_memory';
export const MNEMOS_SCAN_LOCAL_METADATA_TOOL = 'scan_local_metadata';
export const MNEMOS_UNDERSTAND_FILE_TOOL = 'understand_file';
export const MNEMOS_INDEX_FILE_TOOL = 'index_file';

export const MNEMOS_CONTEXT_REQUIRED_TOOLS = [
  MNEMOS_SEARCH_MEMORY_TOOL,
  MNEMOS_SCAN_LOCAL_METADATA_TOOL,
  MNEMOS_UNDERSTAND_FILE_TOOL,
] as const;

export const MNEMOS_CANONICAL_CADENCE = [
  ...MNEMOS_CONTEXT_REQUIRED_TOOLS,
  MNEMOS_INDEX_FILE_TOOL,
] as const;

export const MNEMOS_INDEXING_APPROVAL_BOUNDARY = 'human-in-the-loop';

/**
 * Verifica se o Mnemos está disponível no catálogo de tools do agente.
 */
export function isMnemosAvailable(toolNames: readonly string[]): boolean {
  const toolNameSet = new Set(toolNames);
  return MNEMOS_CONTEXT_REQUIRED_TOOLS.every((toolName) => toolNameSet.has(toolName));
}

/**
 * Retorna a instrução de cadência cognitiva para injeção no system prompt.
 * Só deve ser incluída quando o Mnemos está conectado e com tools registradas.
 */
export function buildMnemosCognitiveInstruction(): string {
  return [
    'PROTOCOLO DE MEMÓRIA LOCAL (MNEMOS):',
    'Você possui acesso a um motor de memória vetorial local chamado Mnemos.',
    'Quando o usuário fizer uma pergunta que possa se referir a documentos, anotações, PDFs ou arquivos pessoais dele, siga esta cadência:',
    '',
    '1. ESTÁGIO 1 — ZONA QUENTE: Use search_memory(query="...") para buscar no cofre vetorial.',
    '   - Se encontrar resultados relevantes (hits > 0), use-os como contexto para responder.',
    '   - Se não encontrar (hits = 0), prossiga para o Estágio 2.',
    '',
    '2. ESTÁGIO 2 — RADAR LEVE: Use scan_local_metadata(keywords=["..."]) para varrer nomes de arquivo nas pastas autorizadas.',
    '   - Extraia palavras-chave significativas da pergunta do usuário.',
    '   - Se encontrar candidatos, apresente-os ao usuário e pergunte se deve indexar.',
    '   - Ao apresentar candidatos, SEMPRE use o prefixo "🔍 **Busca no Cofre Mnemos**" na mensagem.',
    '',
    '3. ESTÁGIO 3 — HUMAN-IN-THE-LOOP: Se o usuário confirmar a indexação:',
    '   - Antes de indexar arquivo novo, use understand_file(file_path="...") para obter tipo, texto, OCR, tabelas, limites e receipt.',
    '   - Se vision_required=true ou transcription_required=true, explique que leitura visual/audio precisa de aprovacao separada para provider multimodal/transcricao.',
    '   - Use index_file(file_path="...") para indexar com o mesmo Universal File Understanding.',
    '   - Após indexação bem-sucedida, execute search_memory novamente com a query original.',
    '   - Use os resultados para gerar a resposta final.',
    '',
    'REGRAS IMPORTANTES:',
    '- NUNCA envie conteúdo de arquivos locais para APIs externas sem antes confirmar com o usuário.',
    '- Apenas fragmentos curtos de texto extraídos do cofre devem ser usados como contexto.',
    '- Se o cofre estiver vazio (total_documents = 0), diga ao usuário que ele pode adicionar documentos.',
    '- Não force a cadência do Mnemos em perguntas genéricas que claramente não se referem a documentos pessoais.',
    '- Use vault_status quando o usuário perguntar sobre o estado da memória.',
  ].join('\n');
}

/**
 * Retorna a instrução compacta para superfícies com limite de tokens.
 */
export function buildMnemosCognitiveInstructionCompact(): string {
  return [
    'MNEMOS: Você tem acesso ao cofre de memória local.',
    'Para perguntas sobre documentos do usuário: search_memory → scan_local_metadata → understand_file → index_file.',
    'Fragmentos extraídos são usados como contexto. Nenhum arquivo sai da máquina sem consentimento.',
  ].join(' ');
}
