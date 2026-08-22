/**
 * AdaptivePersonaEngine - Dynamic persona resolution based on intent classification.
 *
 * Replaces the hardcoded persona prompt with a deterministic mapping from
 * IntentCategory to persona profiles. Runs in <0.1ms with zero external calls.
 *
 * The engine leverages the existing IntentClassifier classification (deterministic,
 * zero-cost) to drive persona selection, eliminating the need for the LLM to
 * re-classify intent internally.
 */

import type { IntentCategory, IntentClassification } from '../cognitive-firewall/IntentClassifier.js';

export type PersonaType = 'executor' | 'creative' | 'analytical' | 'conversational' | 'researcher';

export interface PersonaProfile {
  type: PersonaType;
  name: string;
  systemPrompt: string;
  responseStyle: {
    maxExplanationLength: 'short' | 'medium' | 'long';
    codeBlockPreference: boolean;
    empathyLevel: 'low' | 'medium' | 'high';
    formalTone: boolean;
  };
}

export interface PersonaResolution {
  persona: PersonaProfile;
  confidence: number;
  intentCategory: IntentCategory;
  isAmbiguous: boolean;
  fallbackUsed: boolean;
}

/**
 * Registry of all available personas.
 */
const PERSONA_REGISTRY: Record<PersonaType, PersonaProfile> = {
  executor: {
    type: 'executor',
    name: 'EXECUTOR',
    systemPrompt: `You are the EXECUTOR persona. Be highly practical, write flawless code, and avoid lengthy explanations.
Focus on action, implementation, and technical precision. Deliver working solutions, not theory.`,
    responseStyle: {
      maxExplanationLength: 'short',
      codeBlockPreference: true,
      empathyLevel: 'low',
      formalTone: false,
    },
  },
  creative: {
    type: 'creative',
    name: 'CREATIVE',
    systemPrompt: `You are the CREATIVE persona. Be engaging, fluid, and empathetic.
Focus on communication, writing, and user experience. Craft compelling content with warmth and clarity.`,
    responseStyle: {
      maxExplanationLength: 'medium',
      codeBlockPreference: false,
      empathyLevel: 'high',
      formalTone: false,
    },
  },
  analytical: {
    type: 'analytical',
    name: 'ANALYTICAL',
    systemPrompt: `You are the ANALYTICAL persona. Be extremely logical, strict, and base answers on explicit data.
Focus on analysis, validation, and architectural reasoning. Provide structured, evidence-based responses.`,
    responseStyle: {
      maxExplanationLength: 'long',
      codeBlockPreference: false,
      empathyLevel: 'low',
      formalTone: true,
    },
  },
  conversational: {
    type: 'conversational',
    name: 'CONVERSATIONAL',
    systemPrompt: `You are the CONVERSATIONAL persona. Be helpful, balanced, and natural.
Adapt your response style to the user's needs without over-committing to any specific mode.`,
    responseStyle: {
      maxExplanationLength: 'medium',
      codeBlockPreference: false,
      empathyLevel: 'medium',
      formalTone: false,
    },
  },
  researcher: {
    type: 'researcher',
    name: 'RESEARCHER',
    systemPrompt: `You are the RESEARCHER persona. Be thorough, investigative, and data-driven.
Focus on deep analysis, information gathering, and structured findings. Provide comprehensive insights.`,
    responseStyle: {
      maxExplanationLength: 'long',
      codeBlockPreference: false,
      empathyLevel: 'low',
      formalTone: true,
    },
  },
};

/**
 * Maps IntentCategory to PersonaType.
 */
const INTENT_PERSONA_MAP: Record<IntentCategory, PersonaType> = {
  execution: 'executor',
  file_operation: 'executor',
  desktop: 'executor',
  configuration: 'analytical',
  research: 'researcher',
  information: 'researcher',
  memory: 'conversational',
  conversation: 'conversational',
  full_toolset: 'conversational',
};

/**
 * Confidence thresholds for direct mapping (above this = no ambiguity).
 * Per-category thresholds allow finer control over persona activation.
 */
const CONFIDENCE_THRESHOLDS: Record<IntentCategory, number> = {
  execution: 0.7,
  file_operation: 0.7,
  desktop: 0.7,
  configuration: 0.7,
  research: 0.7,
  information: 0.6,
  memory: 0.7,
  conversation: 0.0, // Always map to conversational
  full_toolset: 0.5,
};

export class AdaptivePersonaEngine {
  private readonly logger: (msg: string) => void;

  constructor(options?: { logger?: (msg: string) => void }) {
    this.logger = options?.logger ?? console.log;
  }

  /**
   * Resolves the best persona for a given intent classification.
   * Runs in <0.1ms, zero external calls.
   */
  public resolve(classification: IntentClassification): PersonaResolution {
    const { category, confidence } = classification;

    // Get the threshold for this category
    const threshold = CONFIDENCE_THRESHOLDS[category];

    // Ambiguous intent → safe fallback
    if (confidence < threshold || category === 'full_toolset') {
      const fallback = this.getFallbackForAmbiguous(category, confidence);
      this.logger(`[AdaptivePersona] Ambiguous intent (${category}/${confidence}) → fallback: ${fallback.type}`);
      return this.buildResolution(fallback, category, confidence, true, true);
    }

    // Direct mapping
    const personaType = INTENT_PERSONA_MAP[category];
    const persona = PERSONA_REGISTRY[personaType];
    this.logger(`[AdaptivePersona] Intent ${category}/${confidence} → ${persona.type}`);
    return this.buildResolution(persona, category, confidence, false, false);
  }

  /**
   * Generates the system prompt injection for the resolved persona.
   */
  public buildPrompt(resolution: PersonaResolution): string {
    const { persona, isAmbiguous } = resolution;

    if (isAmbiguous) {
      return this.buildAmbiguousPrompt(persona);
    }

    return `
==================================================
[COGNITIVE NEXUS — ADAPTIVE PERSONA: ${persona.name}]
${persona.systemPrompt}
Style: ${persona.responseStyle.formalTone ? 'Formal' : 'Natural'}.
${persona.responseStyle.codeBlockPreference ? 'Use code blocks when relevant.' : ''}
${persona.responseStyle.empathyLevel === 'high' ? 'Be empathetic and warm.' : ''}
Do not announce which persona is active; simply embody it.
==================================================`;
  }

  /**
   * Returns the persona profile for a given type.
   */
  public getPersonaProfile(type: PersonaType): PersonaProfile {
    return PERSONA_REGISTRY[type];
  }

  /**
   * Returns all available persona types.
   */
  public getAvailablePersonas(): PersonaType[] {
    return Object.keys(PERSONA_REGISTRY) as PersonaType[];
  }

  private getFallbackForAmbiguous(_category: IntentCategory, _confidence: number): PersonaProfile {
    // For ambiguous intents, always use conversational as safe default
    return PERSONA_REGISTRY.conversational;
  }

  private buildResolution(
    persona: PersonaProfile,
    category: IntentCategory,
    confidence: number,
    isAmbiguous: boolean,
    fallbackUsed: boolean,
  ): PersonaResolution {
    return {
      persona,
      confidence,
      intentCategory: category,
      isAmbiguous,
      fallbackUsed,
    };
  }

  private buildAmbiguousPrompt(persona: PersonaProfile): string {
    return `
==================================================
[COGNITIVE NEXUS — ADAPTIVE PERSONA: ${persona.name} (FALLBACK)]
${persona.systemPrompt}
Note: Intent was ambiguous. Adopting a balanced, helpful stance.
Do not announce persona status; simply respond helpfully.
==================================================`;
  }
}
