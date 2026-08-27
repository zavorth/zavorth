import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { logger } from '../../../logger.js';
import {
  type CreatePersonaInput,
  type Persona,
  type UpdatePersonaInput,
  sanitizePersonaId,
  validatePersonaInput,
} from './PersonaContract.js';

export interface PersonaRegistryOptions {
  storageDir?: string;
  autoSeedDefaults?: boolean;
}

export class PersonaRegistryService {
  private readonly storageDir: string;
  private readonly personas: Map<string, Persona> = new Map();
  private initialized = false;

  constructor(options?: PersonaRegistryOptions) {
    this.storageDir = options?.storageDir
      ? path.resolve(options.storageDir)
      : path.join(os.homedir(), '.zavorth', 'bots');

    if (options?.autoSeedDefaults !== false) {
      this.seedDefaultPersonas();
    }
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      fs.mkdirSync(this.storageDir, { recursive: true });
      const entries = fs.readdirSync(this.storageDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const personaJsonPath = path.join(this.storageDir, entry.name, 'persona.json');
          if (fs.existsSync(personaJsonPath)) {
            try {
              const raw = fs.readFileSync(personaJsonPath, 'utf8');
              const parsed = JSON.parse(raw) as Persona;
              if (parsed.id && parsed.name && parsed.systemPrompt) {
                this.personas.set(parsed.id, parsed);
              }
            } catch (err) {
              logger.warn(`Failed to parse persona file at ${personaJsonPath}`, err);
            }
          }
        }
      }

      if (this.personas.size === 0) {
        await this.persistDefaultPersonas();
      }

      this.initialized = true;
    } catch (err) {
      logger.warn(`Failed to initialize PersonaRegistryService at ${this.storageDir}`, err);
    }
  }

  public async registerPersona(input: CreatePersonaInput): Promise<Persona> {
    const validation = validatePersonaInput(input);
    if (!validation.valid) {
      throw new Error(`Invalid persona configuration: ${validation.error}`);
    }

    const id = sanitizePersonaId(input.id);
    const now = new Date().toISOString();

    const persona: Persona = {
      id,
      name: input.name.trim(),
      role: input.role.trim(),
      avatar: input.avatar?.trim() || 'robot',
      systemPrompt: input.systemPrompt.trim(),
      modelPreference: input.modelPreference || null,
      allowedTools: input.allowedTools || null,
      allowedDomains: input.allowedDomains || null,
      isolationMode: input.isolationMode || 'direct',
      passiveInspectionEnabled: input.passiveInspectionEnabled ?? false,
      scheduleRoutines: input.scheduleRoutines || [],
      metadata: input.metadata || {},
      createdAt: now,
      updatedAt: now,
    };

    await this.persistPersonaToDisk(persona);
    this.personas.set(id, persona);
    return persona;
  }

  public async updatePersona(rawId: string, updates: UpdatePersonaInput): Promise<Persona> {
    const id = sanitizePersonaId(rawId);
    const existing = this.personas.get(id);
    if (!existing) {
      throw new Error(`Persona not found: @${id}`);
    }

    const updated: Persona = {
      ...existing,
      name: updates.name ? updates.name.trim() : existing.name,
      role: updates.role ? updates.role.trim() : existing.role,
      avatar: updates.avatar ? updates.avatar.trim() : existing.avatar,
      systemPrompt: updates.systemPrompt ? updates.systemPrompt.trim() : existing.systemPrompt,
      modelPreference: updates.modelPreference !== undefined ? updates.modelPreference : existing.modelPreference,
      allowedTools: updates.allowedTools !== undefined ? updates.allowedTools : existing.allowedTools,
      allowedDomains: updates.allowedDomains !== undefined ? updates.allowedDomains : existing.allowedDomains,
      isolationMode: updates.isolationMode || existing.isolationMode,
      passiveInspectionEnabled: updates.passiveInspectionEnabled !== undefined
        ? updates.passiveInspectionEnabled
        : existing.passiveInspectionEnabled,
      scheduleRoutines: updates.scheduleRoutines !== undefined ? updates.scheduleRoutines : existing.scheduleRoutines,
      metadata: updates.metadata ? { ...existing.metadata, ...updates.metadata } : existing.metadata,
      updatedAt: new Date().toISOString(),
    };

    await this.persistPersonaToDisk(updated);
    this.personas.set(id, updated);
    return updated;
  }

  public async deletePersona(rawId: string): Promise<boolean> {
    const id = sanitizePersonaId(rawId);
    if (!this.personas.has(id)) {
      return false;
    }

    const targetDir = path.join(this.storageDir, id);
    try {
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
      this.personas.delete(id);
      return true;
    } catch (err) {
      logger.warn(`Failed to delete persona directory for @${id}`, err);
      return false;
    }
  }

  public getPersona(rawId: string): Persona | null {
    const id = sanitizePersonaId(rawId);
    return this.personas.get(id) || null;
  }

  public hasPersona(rawId: string): boolean {
    const id = sanitizePersonaId(rawId);
    return this.personas.has(id);
  }

  public listPersonas(filter?: { passiveOnly?: boolean; activeOnly?: boolean }): Persona[] {
    const all = Array.from(this.personas.values());
    if (filter?.passiveOnly) {
      return all.filter((p) => p.passiveInspectionEnabled);
    }
    if (filter?.activeOnly) {
      return all.filter((p) => !p.passiveInspectionEnabled);
    }
    return all.sort((a, b) => a.name.localeCompare(b.name));
  }

  public resolveMention(rawText: string): { persona: Persona; strippedPrompt: string } | null {
    if (!rawText || typeof rawText !== 'string') {
      return null;
    }

    const trimmed = rawText.trim();
    if (!trimmed.startsWith('@')) {
      return null;
    }

    const match = trimmed.match(/^@([a-zA-Z0-9_-]+)(?::|\s+|$)([\s\S]*)$/);
    if (!match) {
      return null;
    }

    const potentialId = sanitizePersonaId(match[1]);
    const persona = this.personas.get(potentialId);
    if (!persona) {
      return null;
    }

    const strippedPrompt = (match[2] || '').trim();
    return {
      persona,
      strippedPrompt,
    };
  }

  private async persistPersonaToDisk(persona: Persona): Promise<void> {
    const botDir = path.join(this.storageDir, persona.id);
    fs.mkdirSync(botDir, { recursive: true });

    const identityContent = [
      `# Identity: ${persona.name} (@${persona.id})`,
      '',
      `- **Role**: ${persona.role}`,
      `- **Avatar**: ${persona.avatar}`,
      `- **Isolation Mode**: ${persona.isolationMode}`,
      `- **Passive Inspection**: ${persona.passiveInspectionEnabled ? 'Enabled' : 'Disabled'}`,
      `- **Allowed Domains**: ${persona.allowedDomains && persona.allowedDomains.length > 0 ? persona.allowedDomains.join(', ') : 'None (Strict Host-Only)'}`,
      `- **Allowed Tools**: ${persona.allowedTools && persona.allowedTools.length > 0 ? persona.allowedTools.join(', ') : 'Default Workspace Tools'}`,
      '',
      `_Created: ${persona.createdAt} | Updated: ${persona.updatedAt}_`,
    ].join('\n');

    fs.writeFileSync(path.join(botDir, 'IDENTITY.md'), identityContent, 'utf8');
    fs.writeFileSync(path.join(botDir, 'SOUL.md'), persona.systemPrompt, 'utf8');
    fs.writeFileSync(path.join(botDir, 'persona.json'), JSON.stringify(persona, null, 2), 'utf8');
  }

  private seedDefaultPersonas(): void {
    const defaults: Persona[] = [
      {
        id: 'executor',
        name: 'Executor',
        role: 'Practical Code Implementation Specialist',
        avatar: 'hammer',
        systemPrompt: 'You are the EXECUTOR. Write clean, working, strictly-typed code. Avoid unnecessary chatter.',
        modelPreference: null,
        allowedTools: null,
        allowedDomains: null,
        isolationMode: 'direct',
        passiveInspectionEnabled: false,
        scheduleRoutines: [],
        createdAt: '2026-05-17T00:00:00.000Z',
        updatedAt: '2026-05-17T00:00:00.000Z',
      },
      {
        id: 'researcher',
        name: 'Researcher',
        role: 'Deep Codebase & Web Investigation Specialist',
        avatar: 'magnifier',
        systemPrompt: 'You are the RESEARCHER. Investigate APIs, architectures, and document findings thoroughly.',
        modelPreference: null,
        allowedTools: ['read_file', 'grep_search', 'read_url_content'],
        allowedDomains: null,
        isolationMode: 'direct',
        passiveInspectionEnabled: false,
        scheduleRoutines: [],
        createdAt: '2026-05-17T00:00:00.000Z',
        updatedAt: '2026-05-17T00:00:00.000Z',
      },
      {
        id: 'architect',
        name: 'Clean Code Architect',
        role: 'System Design and Refactoring Specialist',
        avatar: 'blueprint',
        systemPrompt: 'You are the ARCHITECT. Enforce SOLID, zero dead code, strict typing, and clean abstractions.',
        modelPreference: null,
        allowedTools: ['read_file', 'write_patch'],
        allowedDomains: null,
        isolationMode: 'direct',
        passiveInspectionEnabled: true,
        scheduleRoutines: [],
        createdAt: '2026-05-17T00:00:00.000Z',
        updatedAt: '2026-05-17T00:00:00.000Z',
      },
      {
        id: 'security-evaluator',
        name: 'Security Evaluator',
        role: 'Security, Boundary and Vulnerability Inspector',
        avatar: 'shield',
        systemPrompt: 'You are the SECURITY EVALUATOR. Inspect scripts, sensitive file paths, and network accesses for risks.',
        modelPreference: null,
        allowedTools: ['read_file'],
        allowedDomains: null,
        isolationMode: 'direct',
        passiveInspectionEnabled: true,
        scheduleRoutines: [],
        createdAt: '2026-05-17T00:00:00.000Z',
        updatedAt: '2026-05-17T00:00:00.000Z',
      },
    ];

    for (const d of defaults) {
      if (!this.personas.has(d.id)) {
        this.personas.set(d.id, d);
      }
    }
  }

  private async persistDefaultPersonas(): Promise<void> {
    for (const persona of this.personas.values()) {
      await this.persistPersonaToDisk(persona);
    }
  }
}
