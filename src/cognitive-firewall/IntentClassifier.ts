/**
 * IntentClassifier - local, zero-token intent hints for the Cognitive Firewall.
 *
 * The classifier is intentionally conservative: it suggests routing/tool groups,
 * but it never authorizes execution and never replaces runtime policy or LLM
 * reasoning. A single ambiguous verb like "create", "open", "save", "remember"
 * or "run" is treated as weak evidence unless paired with a concrete technical object.
 *
 * English-only patterns. Non-English messages fall through to LLM classification.
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

// Trivial chat: greetings, acknowledgments, farewells (English + common loanwords)
const TRIVIAL_CHAT_PATTERNS = /^(hey|hi|hello|good\s+morning|good\s+afternoon|good\s+evening|thanks|thank\s+you|ok|okay|sure|right|got\s+it|understood|nice|great|perfect|awesome|cool|yes|no|y|n|\?\?|\!\!|bye|see\s+ya|cheers|lol|haha|hey|yo|sup|howdy|greetings|welcome|cheers|ta|ty|thx|tyvm|np|yw|roger|copy|affirmative|negative)[\?\!\.\,]?$/i;

// File operations
const FILE_PATTERNS = /\b(file|directory|folder|create|read|open|save|write|list|delete|rename|move|copy|mkdir|rmdir|touch|cat|ls|dir|find|grep)\b/i;
const FILE_OBJECT_PATTERNS = /\b(file|directory|folder|readme|package\.json|tsconfig|src\/|src\\|[\w.-]+\.(ts|tsx|js|json|md|py|rs|go|java|cpp|c|h))\b/i;
const FILE_ACTION_PATTERNS = /\b(create|read|open|save|write|list|delete|rename|move|copy|mkdir|rmdir|touch|cat|ls|dir|find|grep)\b/i;
const FILE_CONVERSATION_NEGATIVE_PATTERNS = /\b(create\s+a\s+summary|open\s+my\s+mind|save\s+me\s+from|saved\s+my\s+day)\b/i;

// Workspace references
const WORKSPACE_REFERENCE_PATTERNS = /\b(readme|package\.json|tsconfig|src\/|src\\|\.ts\b|\.tsx\b|\.js\b|\.json\b|\.md\b|repo|repository|workspace|project|path|codebase)\b/i;

// Execution
const EXECUTION_PATTERNS = /\b(run|execute|exec|shell|terminal|command|script|npm|node|python|pip|git|docker|build|install|compile|test|lint|format|deploy)\b/i;
const EXECUTION_CONCRETE_PATTERNS = /\b((run|execute|exec)\s+(the\s+)?(tests?|commands?|scripts?|npm|node|python|pip|git|docker|build)|shell|terminal|command|script|npm|node|python|pip|git|docker|build|install|compile|test|lint|format|deploy)\b/i;
const EXECUTION_CONVERSATION_NEGATIVE_PATTERNS = /\b(run\s+this\s+(reasoning|idea|thought)|execute\s+this\s+(reasoning|idea|thought))\b/i;

// Web search / information
const WEB_SEARCH_PATTERNS = /\b(search|look\s+up|find|research|news|weather|price|score|result|internet|online|site|url|links?|sources?|references?|google|browse|fetch|scrape|crawl)\b/i;
const TEMPORAL_PATTERNS = /\b(now|today|current|latest|recent|real.time|breaking|live|update)\b/i;

// Configuration
const CONFIG_PATTERNS = /\b(model|provider|config|configure|settings|switch|llm|gemini|openai|gpt|claude|profile|preference|option)\b/i;
const CONFIG_CONCRETE_PATTERNS = /\b((config|configure|settings|switch|change).*(model|provider|llm|gemini|openai|gpt|claude|profile|preference)|(model|provider|llm|gemini|openai|gpt|claude|profile|preference))\b/i;

// Memory
const MEMORY_PATTERNS = /\b(remember|forget|memory|note|save|recall|snippet|store|retain|memorize)\b/i;
const MEMORY_CONCRETE_PATTERNS = /\b((remember|note|save|store|retain|memorize)\s+(this|that|it|my|the|a|an|preference|memory|snippet)|(?:forget|remove)\s+(this|that|it|my|the|a|an|preference|memory|snippet)|\b(memory|recall|snippet)\b)\b/i;
const MEMORY_CONVERSATION_NEGATIVE_PATTERNS = /\b(remember\s+(that\s+time|when\s+I|what\s+I\s+told)|do\s+you\s+remember)\b/i;

// Desktop automation
const DESKTOP_PATTERNS = /\b(desktop|screen|mouse|click|window|automate|automation|browser|tab|scroll|type|keyboard|shortcut|hotkey)\b/i;

// Research
const RESEARCH_PATTERNS = /\b(deep\s+research|detailed\s+analysis|investigate|in-depth|studies|articles|papers?|doi|pubmed|arxiv|scientific|academic|literature|review|jurisprudence|case\s+law|clinical\s+trials?|report|analysis|thesis|survey|meta.analysis)\b/i;

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
        reason: 'Technical configuration hint detected.',
        isTrivialChat: false,
      }));
    }

    if (RESEARCH_PATTERNS.test(trimmed)) {
      return this.reviewSecondPass(trimmed, this.decision({
        category: 'research',
        confidence: 0.82,
        reason: 'Deep research hint detected.',
        isTrivialChat: false,
      }));
    }

    if (DESKTOP_PATTERNS.test(trimmed)) {
      return this.reviewSecondPass(trimmed, this.decision({
        category: 'desktop',
        confidence: 0.78,
        reason: 'Desktop automation hint detected.',
        isTrivialChat: false,
      }));
    }

    if (MEMORY_CONCRETE_PATTERNS.test(trimmed)) {
      return this.reviewSecondPass(trimmed, this.decision({
        category: 'memory',
        confidence: 0.78,
        reason: 'Concrete memory/recall hint detected.',
        isTrivialChat: false,
      }));
    }

    if (WEB_SEARCH_PATTERNS.test(trimmed) || (TEMPORAL_PATTERNS.test(trimmed) && trimmed.length > 15)) {
      return this.reviewSecondPass(trimmed, this.decision({
        category: 'information',
        confidence: 0.74,
        reason: 'Web search/current data hint detected.',
        isTrivialChat: false,
      }));
    }

    const weakToolSignals = this.collectWeakToolSignals(trimmed);
    if (weakToolSignals.length > 0) {
      return this.reviewSecondPass(trimmed, this.decision({
        category: 'full_toolset',
        confidence: 0.45,
        reason: 'Weak/ambiguous technical signals; let runtime/LLM decide without hard gate.',
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
      reason: 'Ambiguous intent; runtime/LLM should decide with final policy.',
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
        ? `${classification.reason} Second-pass contextual downgrade applied.`
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

    const isQuestion = /^(what|why|how|when|where|who|which|explain|tell|describe|can\s+you|could\s+you|would\s+you|do\s+you|is\s+there|are\s+there)/i.test(text);
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
      /\b(no|not|without|don't|skip|avoid|ignore)\b.*\b(open|read|run|execute|save|edit|tool|file|command)\b/i.test(text)
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
