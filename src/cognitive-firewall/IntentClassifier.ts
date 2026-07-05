/**
 * IntentClassifier - local, zero-token intent hints for the Cognitive Firewall.
 *
 * The classifier is intentionally conservative: it suggests routing/tool groups,
 * but it never authorizes execution and never replaces runtime policy or LLM
 * reasoning. A single ambiguous verb such as "cria", "abre", "salva",
 * "lembra" or "roda" is treated as weak evidence unless paired with a concrete
 * technical object.
 */

export type IntentCategory =
  | 'conversation'
  | 'information'
  | 'file_operation'
  | 'execution'
  | 'configuration'
  | 'memory'
  | 'desktop'
  | 'research'
  | 'full_toolset';

export interface IntentClassification {
  category: IntentCategory;
  confidence: number;
  reason: string;
  isTrivialChat: boolean;
  isHardDecision: false;
  downgradedBy: string[];
  secondPass: IntentSecondPassReview;
}

export interface IntentSecondPassReview {
  source: 'ContextualIntentSecondPass';
  stage: 7;
  mode: 'local-contextual';
  verdict: 'confirmed' | 'downgraded' | 'left-ambiguous';
  originalCategory: IntentCategory;
  finalCategory: IntentCategory;
  confidenceDelta: number;
  signals: string[];
}

const TRIVIAL_CHAT_PATTERNS = /^(oi|ola|bom dia|boa tarde|boa noite|e ai|fala|salve|hey|hi|hello|good morning|good afternoon|good evening|obrigad[oa]|valeu|thanks|vlw|blz|beleza|ok|certo|entendi|show|massa|otimo|perfeito|ta bom|tudo bem|como vai|tudo certo|haha|kkk|rs|lol|sim|nao|s|n|\?\?|\!\!|tchau|bye|flw|falou|ate mais|merci|danke|gracias|arigatou|감사합니다|شكرا|ありがとう)[\?\!\.\,]?$/i;

const FILE_PATTERNS = /\b(arquivo|file|pasta|diretorio|directory|folder|criar|crie|create|ler|leia|read|abrir|abra|open|salvar|salva|salve|save|escrever|escreva|write|listar|liste|list|deletar|delete|renomear|rename|mover|move|copiar|copy)\b/i;
const FILE_OBJECT_PATTERNS = /\b(arquivo|file|pasta|diretorio|directory|folder|readme|package\.json|tsconfig|src\/|src\\|[\w.-]+\.(ts|tsx|js|json|md))\b/i;
const FILE_ACTION_PATTERNS = /\b(criar|crie|create|ler|leia|read|abrir|abra|open|salvar|salva|salve|save|escrever|escreva|write|listar|liste|list|deletar|delete|renomear|rename|mover|move|copiar|copy)\b/i;
const FILE_CONVERSATION_NEGATIVE_PATTERNS = /\b(cria\s+(um\s+)?resumo|crie\s+(um\s+)?resumo|abre\s+a\s+cabeca|abr[ae]\s+a\s+mente|me\s+salva\s+dessa|salva\s+essa|salvou\s+meu\s+dia)\b/i;

const WORKSPACE_REFERENCE_PATTERNS = /\b(readme|package\.json|tsconfig|src\/|src\\|\.ts\b|\.tsx\b|\.js\b|\.json\b|\.md\b|repo|repositorio|repository|workspace|projeto|caminho|path)\b/i;

const EXECUTION_PATTERNS = /\b(rodar?|rode|executar?|execute|run|exec|shell|terminal|comando|command|script|npm|node|python|pip|git|docker|compilar|build|instalar|install)\b/i;
const EXECUTION_CONCRETE_PATTERNS = /\b((rodar?|rode|executar?|execute|run|exec)\s+(os\s+)?(testes?|tests?|comandos?|commands?|scripts?|npm|node|python|pip|git|docker|build|compilacao)|shell|terminal|comando|command|script|npm|node|python|pip|git|docker|compilar|build|instalar|install)\b/i;
const EXECUTION_CONVERSATION_NEGATIVE_PATTERNS = /\b(roda\s+ess[ea]\s+(raciocinio|ideia|pensamento)|rodar\s+ess[ea]\s+(raciocinio|ideia|pensamento)|executa\s+ess[ea]\s+(raciocinio|ideia|pensamento))\b/i;

const WEB_SEARCH_PATTERNS = /\b(busca|buscar|busque|pesquisa|pesquisar|pesquise|procura|procurar|procure|encontre|ache|levante|mapeie|verifique|confira|consulte|search|look\s+up|find|research|noticias?|news|clima|weather|preco|price|cotacao|placar|score|resultado|result|internet|online|site|url|links?|fontes?|referencias?|google)\b/i;
const TEMPORAL_PATTERNS = /\b(hoje|agora|atual|atuais|recente|recentes|ultima|ultimo|ultimas|ultimos|novas|novos|descobertas?|tempo.real|now|today|current|latest|recent)\b/i;

const CONFIG_PATTERNS = /\b(modelo|model|provider|configurar?|config|trocar|mudar|switch|llm|gemini|openai|gpt|claude|perfil|profile)\b/i;
const CONFIG_CONCRETE_PATTERNS = /\b((configurar?|config|trocar|mudar|switch).*(modelo|model|provider|llm|gemini|openai|gpt|claude|perfil|profile)|(modelo|model|provider|llm|gemini|openai|gpt|claude|perfil|profile))\b/i;

const MEMORY_PATTERNS = /\b(lembrar?|remember|esquecer?|forget|memoria|memory|anotar?|note|guardar?|save|recall|snippet)\b/i;
const MEMORY_CONCRETE_PATTERNS = /\b((lembre|lembrar|remember|anote|anotar|note|guarde|guardar|save)\s+(isso|que|aqui|minha|meu|esta|este|essa|esse|preferencia|memoria|memory|snippet)|(?:esqueca|esquecer|forget)\s+(isso|que|aqui|minha|meu|esta|este|essa|esse|preferencia|memoria|memory|snippet)|\b(memoria|memory|recall|snippet)\b)\b/i;
const MEMORY_CONVERSATION_NEGATIVE_PATTERNS = /\b(lembra\s+(daquele|daquela|daquilo|de\s+quando|que\s+eu\s+te\s+falei)|voce\s+lembra|vc\s+lembra)\b/i;

const DESKTOP_PATTERNS = /\b(desktop|tela|screen|mouse|click|janela|window|abrir.programa|automatizar?|automat)\b/i;
const RESEARCH_PATTERNS = /\b(pesquisa.profunda|deep.?research|analise.detalhada|investigar?|aprofundar?|estudos?|artigos?|papers?|paper|doi|pubmed|scielo|arxiv|cientific[oa]s?|academicos?|literatura|revisao|jurisprudencia|acordaos?|decisoes?|precedentes?|casos?|case\s+law|legal\s+cases?|medicina|saude|clinical\s+trials?|ensaios?\s+clinicos?|relatorio|report)\b/i;

type ClassificationDraft = Omit<IntentClassification, 'isHardDecision' | 'downgradedBy' | 'secondPass'> & {
  downgradedBy?: string[];
  secondPass?: IntentSecondPassReview;
};

export class IntentClassifier {
  public classify(rawMessage: string): IntentClassification {
    const text = this.normalize(rawMessage);
    const trimmed = text.trim();

    if (this.isTrivialChat(trimmed)) {
      return this.reviewSecondPass(trimmed, this.decision({
        category: 'conversation',
        confidence: 0.95,
        reason: 'Simple conversational message detected. No tool required.',
        isTrivialChat: true,
      }));
    }

    const negativeSignals = this.collectNegativeSignals(trimmed);
    if (negativeSignals.length > 0 && this.isLikelyConversation(trimmed, true)) {
      return this.reviewSecondPass(trimmed, this.decision({
        category: 'conversation',
        confidence: 0.62,
        reason: 'Technical keyword downgraded by conversational context.',
        isTrivialChat: false,
        downgradedBy: negativeSignals,
      }));
    }

    const hasWorkspaceReference = WORKSPACE_REFERENCE_PATTERNS.test(trimmed);
    const hasConcreteFileIntent = FILE_ACTION_PATTERNS.test(trimmed) && FILE_OBJECT_PATTERNS.test(trimmed);
    if (hasConcreteFileIntent || hasWorkspaceReference) {
      return this.reviewSecondPass(trimmed, this.decision({
        category: 'file_operation',
        confidence: hasConcreteFileIntent ? 0.82 : 0.7,
        reason: hasConcreteFileIntent
          ? 'File hint with concrete verb and technical object.'
          : 'Concrete workspace/file reference detected as tool hint.',
        isTrivialChat: false,
      }));
    }

    if (EXECUTION_CONCRETE_PATTERNS.test(trimmed)) {
      return this.reviewSecondPass(trimmed, this.decision({
        category: 'execution',
        confidence: 0.82,
        reason: 'Execution hint with concrete command/script/test.',
        isTrivialChat: false,
      }));
    }

    if (CONFIG_CONCRETE_PATTERNS.test(trimmed)) {
      return this.reviewSecondPass(trimmed, this.decision({
        category: 'configuration',
        confidence: 0.78,
        reason: 'Hint de configuracao tecnica detectado.',
        isTrivialChat: false,
      }));
    }

    if (RESEARCH_PATTERNS.test(trimmed)) {
      return this.reviewSecondPass(trimmed, this.decision({
        category: 'research',
        confidence: 0.82,
        reason: 'Hint de pesquisa aprofundada detectado.',
        isTrivialChat: false,
      }));
    }

    if (DESKTOP_PATTERNS.test(trimmed)) {
      return this.reviewSecondPass(trimmed, this.decision({
        category: 'desktop',
        confidence: 0.78,
        reason: 'Hint de automacao de desktop detectado.',
        isTrivialChat: false,
      }));
    }

    if (MEMORY_CONCRETE_PATTERNS.test(trimmed)) {
      return this.reviewSecondPass(trimmed, this.decision({
        category: 'memory',
        confidence: 0.78,
        reason: 'Hint concreto de memoria/recall detectado.',
        isTrivialChat: false,
      }));
    }

    if (WEB_SEARCH_PATTERNS.test(trimmed) || (TEMPORAL_PATTERNS.test(trimmed) && trimmed.length > 15)) {
      return this.reviewSecondPass(trimmed, this.decision({
        category: 'information',
        confidence: 0.74,
        reason: 'Hint de busca de informacao/dados atuais detectado.',
        isTrivialChat: false,
      }));
    }

    const weakToolSignals = this.collectWeakToolSignals(trimmed);
    if (weakToolSignals.length > 0) {
      return this.reviewSecondPass(trimmed, this.decision({
        category: 'full_toolset',
        confidence: 0.45,
        reason: 'Sinais tecnicos fracos/ambiguos; deixar runtime/LLM decidir sem hard gate.',
        isTrivialChat: false,
        downgradedBy: weakToolSignals,
      }));
    }

    if (this.isLikelyConversation(trimmed, false)) {
      return this.reviewSecondPass(trimmed, this.decision({
        category: 'conversation',
        confidence: 0.65,
        reason: 'Message appears conversational. No tool is likely needed.',
        isTrivialChat: false,
      }));
    }

    return this.reviewSecondPass(trimmed, this.decision({
      category: 'full_toolset',
      confidence: 0.3,
      reason: 'Intencao ambigua; runtime/LLM deve decidir com policy final.',
      isTrivialChat: false,
    }));
  }

  private decision(draft: ClassificationDraft): IntentClassification {
    return {
      ...draft,
      isHardDecision: false,
      downgradedBy: draft.downgradedBy || [],
      secondPass: draft.secondPass || {
        source: 'ContextualIntentSecondPass',
        stage: 7,
        mode: 'local-contextual',
        verdict: 'confirmed',
        originalCategory: draft.category,
        finalCategory: draft.category,
        confidenceDelta: 0,
        signals: [],
      },
    };
  }

  private reviewSecondPass(text: string, classification: IntentClassification): IntentClassification {
    const signals = this.collectSecondPassSignals(text, classification);
    const originalCategory = classification.category;
    let finalCategory = classification.category;
    let confidence = classification.confidence;
    let verdict: IntentSecondPassReview['verdict'] = 'confirmed';
    const downgradedBy = classification.downgradedBy.slice();

    if (signals.includes('explicit-no-tool-request')) {
      finalCategory = 'conversation';
      confidence = Math.min(confidence, 0.6);
      verdict = 'downgraded';
      downgradedBy.push('second-pass-explicit-no-tool-request');
    } else if (
      signals.includes('concrete-code-or-file-target')
      || signals.includes('concrete-command-target')
      || signals.includes('concrete-memory-target')
    ) {
      confidence = Math.max(confidence, 0.78);
      verdict = 'confirmed';
    } else if (classification.category === 'full_toolset' && classification.confidence < 0.5) {
      verdict = 'left-ambiguous';
    }

    return {
      ...classification,
      category: finalCategory,
      confidence,
      reason: verdict === 'downgraded'
        ? `${classification.reason} Segundo pass contextual rebaixou o hint.`
        : classification.reason,
      downgradedBy: Array.from(new Set(downgradedBy)),
      secondPass: {
        source: 'ContextualIntentSecondPass',
        stage: 7,
        mode: 'local-contextual',
        verdict,
        originalCategory,
        finalCategory,
        confidenceDelta: Number((confidence - classification.confidence).toFixed(2)),
        signals,
      },
    };
  }

  private isTrivialChat(text: string): boolean {
    if (text.length > 60) return false;
    return TRIVIAL_CHAT_PATTERNS.test(text);
  }

  private isLikelyConversation(text: string, ignoreToolReferences: boolean): boolean {
    const hasToolReference =
      FILE_PATTERNS.test(text) ||
      WORKSPACE_REFERENCE_PATTERNS.test(text) ||
      EXECUTION_PATTERNS.test(text) ||
      WEB_SEARCH_PATTERNS.test(text) ||
      CONFIG_PATTERNS.test(text) ||
      MEMORY_PATTERNS.test(text) ||
      DESKTOP_PATTERNS.test(text);

    if (hasToolReference && !ignoreToolReferences) return false;

    const isQuestion = /^(o que|por que|como|quando|onde|quem|qual|quantos?|explain|what|why|how|when|where|who|which)/i.test(text);
    if (isQuestion && text.length < 200) return true;
    if (text.length < 100) return true;

    return false;
  }

  private collectNegativeSignals(text: string): string[] {
    return [
      FILE_CONVERSATION_NEGATIVE_PATTERNS.test(text) ? 'file-conversation-context' : '',
      EXECUTION_CONVERSATION_NEGATIVE_PATTERNS.test(text) ? 'execution-conversation-context' : '',
      MEMORY_CONVERSATION_NEGATIVE_PATTERNS.test(text) ? 'memory-conversation-context' : '',
    ].filter(Boolean);
  }

  private collectWeakToolSignals(text: string): string[] {
    return [
      FILE_PATTERNS.test(text) ? 'weak-file-keyword' : '',
      EXECUTION_PATTERNS.test(text) ? 'weak-execution-keyword' : '',
      CONFIG_PATTERNS.test(text) ? 'weak-config-keyword' : '',
      MEMORY_PATTERNS.test(text) ? 'weak-memory-keyword' : '',
    ].filter(Boolean);
  }

  private collectSecondPassSignals(text: string, classification: IntentClassification): string[] {
    return [
      /\b(nao|não|sem|so|só|apenas)\b.*\b(abra|abrir|leia|ler|rode|rodar|execute|executar|salve|salvar|edite|editar|tool|ferramenta|arquivo|comando)\b/i.test(text)
        ? 'explicit-no-tool-request'
        : '',
      FILE_OBJECT_PATTERNS.test(text) ? 'concrete-code-or-file-target' : '',
      EXECUTION_CONCRETE_PATTERNS.test(text) ? 'concrete-command-target' : '',
      MEMORY_CONCRETE_PATTERNS.test(text) ? 'concrete-memory-target' : '',
      classification.category === 'full_toolset' && classification.confidence < 0.5 ? 'ambiguous-low-confidence' : '',
    ].filter(Boolean);
  }

  private normalize(value: string): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }
}
