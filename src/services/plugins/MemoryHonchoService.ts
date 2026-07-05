import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export interface UserProfile {
  id: string;
  name: string | null;
  preferences: Record<string, unknown>;
  traits: string[];
  interaction_style: string;
  communication_preferences: {
    formality: 'casual' | 'formal' | 'adaptive';
    verbosity: 'concise' | 'detailed' | 'adaptive';
    language: string;
    tone: string;
  };
  knowledge_areas: string[];
  learned_facts: Array<{
    fact: string;
    confidence: number;
    source: string;
    learned_at: string;
  }>;
  interaction_history: {
    total_interactions: number;
    first_interaction: string;
    last_interaction: string;
    avg_session_duration_ms: number;
    most_used_tools: string[];
    most_active_channels: string[];
  };
  dialectic_insights: Array<{
    insight: string;
    category: string;
    confidence: number;
    derived_at: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface DialecticTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  channel: string;
  metadata?: Record<string, unknown>;
}

export class MemoryHonchoService {
  private static readonly MAX_CONVERSATION_LENGTH = 500;
  private readonly storageDir: string;
  private profiles: Map<string, UserProfile> = new Map();
  private conversations: Map<string, DialecticTurn[]> = new Map();

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'honcho');
    this.ensureStorageDir();
    this.loadData();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private sanitizeParsedData(data: unknown): unknown {
    if (Array.isArray(data)) return data.map((item) => this.sanitizeParsedData(item));
    if (data !== null && typeof data === 'object') {
      const clean: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
        clean[key] = this.sanitizeParsedData(value);
      }
      return clean;
    }
    return data;
  }

  private loadData(): void {
    const profilesPath = path.join(this.storageDir, 'profiles.json');
    const conversationsPath = path.join(this.storageDir, 'conversations.json');

    if (fs.existsSync(profilesPath)) {
      try {
        const data = this.sanitizeParsedData(JSON.parse(fs.readFileSync(profilesPath, 'utf-8'))) as Record<string, UserProfile>;
        this.profiles = new Map(Object.entries(data));
      } catch (error) { /* ignore */ logger.warn('[Memory Honcho] JSON parse failed', error); }
    }

    if (fs.existsSync(conversationsPath)) {
      try {
        const data = this.sanitizeParsedData(JSON.parse(fs.readFileSync(conversationsPath, 'utf-8'))) as Record<string, DialecticTurn[]>;
        this.conversations = new Map(Object.entries(data));
      } catch (error) { /* ignore */ logger.warn('[Memory Honcho] JSON parse failed', error); }
    }
  }

  private saveData(): void {
    fs.writeFileSync(
      path.join(this.storageDir, 'profiles.json'),
      JSON.stringify(Object.fromEntries(this.profiles), null, 2),
      'utf-8',
    );
    fs.writeFileSync(
      path.join(this.storageDir, 'conversations.json'),
      JSON.stringify(Object.fromEntries(this.conversations), null, 2),
      'utf-8',
    );
  }

  public getOrCreateProfile(userId: string): UserProfile {
    if (!this.profiles.has(userId)) {
      const profile: UserProfile = {
        id: userId,
        name: null,
        preferences: {},
        traits: [],
        interaction_style: 'adaptive',
        communication_preferences: {
          formality: 'adaptive',
          verbosity: 'adaptive',
          language: 'pt-BR',
          tone: 'friendly',
        },
        knowledge_areas: [],
        learned_facts: [],
        interaction_history: {
          total_interactions: 0,
          first_interaction: new Date().toISOString(),
          last_interaction: new Date().toISOString(),
          avg_session_duration_ms: 0,
          most_used_tools: [],
          most_active_channels: [],
        },
        dialectic_insights: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.profiles.set(userId, profile);
      this.saveData();
    }
    return this.profiles.get(userId)!;
  }

  public createProfile(userId: string, options: { name?: string; preferences?: Record<string, unknown> } = {}): string {
    if (this.profiles.has(userId)) {
      return `Profile "${userId}" already exists.`;
    }
    const profile = this.getOrCreateProfile(userId);
    if (options.name) profile.name = options.name;
    if (options.preferences) profile.preferences = { ...options.preferences };
    profile.updated_at = new Date().toISOString();
    this.saveData();
    return `Profile "${userId}" created.`;
  }

  public recordInteraction(userId: string, turn: DialecticTurn): string {
    const profile = this.getOrCreateProfile(userId);

    profile.interaction_history.total_interactions++;
    profile.interaction_history.last_interaction = new Date().toISOString();
    profile.updated_at = new Date().toISOString();

    if (!this.conversations.has(userId)) {
      this.conversations.set(userId, []);
    }
    this.conversations.get(userId)!.push(turn);
    const conv = this.conversations.get(userId)!;
    if (conv.length > MemoryHonchoService.MAX_CONVERSATION_LENGTH) {
      conv.splice(0, conv.length - MemoryHonchoService.MAX_CONVERSATION_LENGTH);
    }

    const insights = this.extractInsights(turn, profile);
    for (const insight of insights) {
      profile.dialectic_insights.push({
        insight,
        category: 'interaction',
        confidence: 0.6,
        derived_at: new Date().toISOString(),
      });
    }

    this.saveData();
    return `Interacao registrada para usuario "${userId}". Total: ${profile.interaction_history.total_interactions}`;
  }

  public learnFact(userId: string, fact: string, sourceOrConfidence: string | number = 'manual', confidence: number = 0.8): string {
    const profile = this.getOrCreateProfile(userId);
    const source = typeof sourceOrConfidence === 'number' ? 'manual' : sourceOrConfidence;
    const resolvedConfidence = typeof sourceOrConfidence === 'number' ? sourceOrConfidence : confidence;

    profile.learned_facts.push({
      fact,
      confidence: resolvedConfidence,
      source,
      learned_at: new Date().toISOString(),
    });
    profile.updated_at = new Date().toISOString();

    this.saveData();
    return `Fact learned for user "${userId}": "${fact}" (confidence: ${resolvedConfidence})`;
  }

  public addTrait(userId: string, trait: string): string {
    const profile = this.getOrCreateProfile(userId);
    if (!profile.traits.includes(trait)) {
      profile.traits.push(trait);
      profile.updated_at = new Date().toISOString();
      this.saveData();
    }
    return `Trait "${trait}" added ao perfil de "${userId}".`;
  }

  public setPreference(userId: string, key: string, value: unknown): string {
    const profile = this.getOrCreateProfile(userId);
    profile.preferences[key] = value;
    profile.updated_at = new Date().toISOString();
    this.saveData();
    return `Preferencia "${key}" updated para usuario "${userId}".`;
  }

  public setCommunicationPreference(userId: string, key: string, value: string): string {
    const profile = this.getOrCreateProfile(userId);
    if (key in profile.communication_preferences) {
      (profile.communication_preferences as Record<string, unknown>)[key] = value;
      profile.updated_at = new Date().toISOString();
      this.saveData();
      return `Communication preference "${key}" updated para "${value}".`;
    }
    return `Chave de comunicaction "${key}" is invalid.`;
  }

  public addKnowledgeArea(userId: string, area: string): string {
    const profile = this.getOrCreateProfile(userId);
    if (!profile.knowledge_areas.includes(area)) {
      profile.knowledge_areas.push(area);
      profile.updated_at = new Date().toISOString();
      this.saveData();
    }
    return `Knowledge area "${area}" added ao perfil de "${userId}".`;
  }

  public getProfile(userId: string): string {
    const profile = this.profiles.get(userId);
    if (!profile) return `Profile "${userId}" not found.`;
    const lines: string[] = [
      `Profile: ${profile.id}`,
      `  - Nome: ${profile.name || 'nao definido'}`,
      `  - Estilo: ${profile.interaction_style}`,
      `  - Idioma: ${profile.communication_preferences.language}`,
      `  - Formalidade: ${profile.communication_preferences.formality}`,
      `  - Verbosidade: ${profile.communication_preferences.verbosity}`,
      `  - Tracos: ${profile.traits.join(', ') || 'none'}`,
      `  - Knowledge areas: ${profile.knowledge_areas.join(', ') || 'none'}`,
      `  - Learned facts: ${profile.learned_facts.length}`,
      `  - Dialectic insights: ${profile.dialectic_insights.length}`,
      `  - Total de interactions: ${profile.interaction_history.total_interactions}`,
      `  - Primeira interacao: ${profile.interaction_history.first_interaction}`,
      `  - Ultima interacao: ${profile.interaction_history.last_interaction}`,
    ];

    if (Object.keys(profile.preferences).length > 0) {
      lines.push(`  - Preferencias:`);
      for (const [key, value] of Object.entries(profile.preferences)) {
        lines.push(`    ${key}: ${JSON.stringify(value)}`);
      }
    }

    return lines.join('\n');
  }

  public addTurn(userId: string, turn: Omit<DialecticTurn, 'timestamp'> & { timestamp?: string }): string {
    this.recordInteraction(userId, {
      ...turn,
      timestamp: turn.timestamp || new Date().toISOString(),
    });
    return `Turn recorded for user "${userId}".`;
  }

  public getConversation(userId: string, limit: number = 10): string {
    return this.getConversationHistory(userId, limit);
  }

  public updatePreferences(userId: string, preferences: Record<string, unknown>): string {
    const profile = this.getOrCreateProfile(userId);
    profile.preferences = {
      ...profile.preferences,
      ...preferences,
    };
    profile.updated_at = new Date().toISOString();
    this.saveData();
    return `Preferences updated for user "${userId}".`;
  }

  public addDialecticInsight(userId: string, insight: string, category: string = 'manual', confidence: number = 0.8): string {
    const profile = this.getOrCreateProfile(userId);
    profile.dialectic_insights.push({
      insight,
      category,
      confidence,
      derived_at: new Date().toISOString(),
    });
    profile.updated_at = new Date().toISOString();
    this.saveData();
    return `Dialectic insight added for user "${userId}".`;
  }

  public getStats(): string {
    const interactions = Array.from(this.profiles.values())
      .reduce((sum, profile) => sum + profile.interaction_history.total_interactions, 0);
    const facts = Array.from(this.profiles.values())
      .reduce((sum, profile) => sum + profile.learned_facts.length, 0);
    return [
      'Honcho memory statistics:',
      `  Profiles: ${this.profiles.size}`,
      `  Conversations: ${this.conversations.size}`,
      `  Interactions: ${interactions}`,
      `  Learned facts: ${facts}`,
    ].join('\n');
  }

  public getInsights(userId: string, category?: string): string {
    const profile = this.getOrCreateProfile(userId);
    let insights = profile.dialectic_insights;

    if (category) {
      insights = insights.filter((i) => i.category === category);
    }

    if (insights.length === 0) return `No insight found for "${userId}".`;

    const lines: string[] = [`Dialectic insights for "${userId}" (${insights.length}):`];
    for (const insight of insights.slice(0, 20)) {
      lines.push(`  [${insight.category}] ${insight.insight} (confidence: ${insight.confidence})`);
    }
    return lines.join('\n');
  }

  public getConversationHistory(userId: string, limit: number = 10): string {
    const history = this.conversations.get(userId) || [];
    if (history.length === 0) return `No conversa encontrada para "${userId}".`;

    const recent = history.slice(-limit);
    const lines: string[] = [`Historico de conversas para "${userId}" (ultimas ${recent.length}):`];
    for (const turn of recent) {
      const preview = turn.content.slice(0, 80);
      lines.push(`  [${turn.role}] (${turn.channel}) ${preview}${turn.content.length > 80 ? '...' : ''}`);
    }
    return lines.join('\n');
  }

  public listProfiles(): string {
    if (this.profiles.size === 0) return 'No profiles de usuario.';

    const lines: string[] = [`Perfis de usuario (${this.profiles.size}):`];
    for (const [id, profile] of this.profiles) {
      lines.push(`  ${id}: ${profile.name || 'unnamed'} | ${profile.interaction_history.total_interactions} interactions | traits: ${profile.traits.length}`);
    }
    return lines.join('\n');
  }

  private extractInsights(turn: DialecticTurn, profile: UserProfile): string[] {
    const insights: string[] = [];
    const content = turn.content.toLowerCase();

    if (content.includes('prefiro') || content.includes('gosto de') || content.includes('eu gosto')) {
      insights.push(`User expressed preference: ${turn.content.slice(0, 100)}`);
    }

    if (content.includes('nao gosto') || content.includes('odeio') || content.includes('nao prefiro')) {
      insights.push(`User expressed aversion: ${turn.content.slice(0, 100)}`);
    }

    if (content.includes('me chamo') || content.includes('meu nome') || content.includes('sou o')) {
      const nameMatch = turn.content.match(/(?:me chamo|meu nome é|sou o)\s+(\w+)/i);
      if (nameMatch) {
        profile.name = nameMatch[1];
        insights.push(`User name discovered: ${nameMatch[1]}`);
      }
    }

    return insights;
  }
}
