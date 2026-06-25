import path from 'path';
import fs from 'fs';

import type { ProviderDoctorService } from './ProviderDoctorService.js';
import { config } from '../config/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FirstBootStatus = 'ready' | 'env_detected' | 'needs_provider' | 'fresh';

export type DetectedEnvProvider = {
  id: string;
  name: string;
  envVar: string;
  maskedValue: string;
  type: 'openai' | 'anthropic' | 'google' | 'openrouter' | 'ollama' | 'openai-compatible';
};

export type WorkspaceHint = {
  type: 'nodejs' | 'python' | 'git_repo' | 'docs_only' | 'unknown';
  suggestedMission: string;
  readOnly: true;
};

export type FirstBootSnapshot = {
  status: FirstBootStatus;
  generatedAt: string;
  detectedProviders: DetectedEnvProvider[];
  activeProvider: string | null;
  activeModel: string | null;
  workspace: WorkspaceHint;
  dbExists: boolean;
};

// ---------------------------------------------------------------------------
// Env-var → provider mapping
// ---------------------------------------------------------------------------

type EnvProviderMapping = {
  envVar: string;
  id: string;
  name: string;
  type: DetectedEnvProvider['type'];
};

const ENV_PROVIDER_MAP: EnvProviderMapping[] = [
  { envVar: 'OPENAI_API_KEY', id: 'openai', name: 'OpenAI', type: 'openai' },
  { envVar: 'ANTHROPIC_API_KEY', id: 'anthropic', name: 'Anthropic', type: 'anthropic' },
  { envVar: 'GOOGLE_API_KEY', id: 'google', name: 'Google AI', type: 'google' },
  { envVar: 'GOOGLE_GENERATIVE_AI_API_KEY', id: 'google-genai', name: 'Google Generative AI', type: 'google' },
  { envVar: 'GROQ_API_KEY', id: 'groq', name: 'Groq', type: 'openai-compatible' },
  { envVar: 'MISTRAL_API_KEY', id: 'mistral', name: 'Mistral', type: 'openai-compatible' },
  { envVar: 'OPENROUTER_API_KEY', id: 'openrouter', name: 'OpenRouter', type: 'openrouter' },
];

// ---------------------------------------------------------------------------
// Runtime type (constructor DI)
// ---------------------------------------------------------------------------

type FirstBootRuntime = {
  env?: Record<string, string | undefined>;
  cwd?: string;
  providerDoctor?: Pick<ProviderDoctorService, 'inspect'>;
  existsSync?: (p: string) => boolean;
  now?: () => Date;
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ZavorthFirstBootDetectionService {
  private readonly env: Record<string, string | undefined>;
  private readonly cwd: string;
  private readonly providerDoctor: Pick<ProviderDoctorService, 'inspect'> | undefined;
  private readonly existsSync: (p: string) => boolean;
  private readonly now: () => Date;

  constructor(runtime: FirstBootRuntime = {}) {
    this.env = runtime.env ?? process.env;
    this.cwd = runtime.cwd ?? process.cwd();
    this.providerDoctor = runtime.providerDoctor;
    this.existsSync = runtime.existsSync ?? fs.existsSync;
    this.now = runtime.now ?? (() => new Date());
  }

  // -------------------------------------------------------------------------
  // detect()
  // -------------------------------------------------------------------------

  public detect(): FirstBootSnapshot {
    const workspace = this.detectWorkspace();
    const detectedProviders = this.scanEnvProviders();
    const dbPath = this.resolveDbPath();
    const dbExists = this.existsSync(dbPath);

    // 1. Try the provider doctor first — if any provider is fully ready we are
    //    in "ready" state regardless of env vars or DB.
    if (this.providerDoctor) {
      try {
        const report = this.providerDoctor.inspect();
        if (report.readyProviders.length > 0) {
          return this.buildSnapshot({
            status: 'ready',
            detectedProviders,
            activeProvider: report.activeProviderName ?? null,
            activeModel: report.activeModelName ?? null,
            workspace,
            dbExists,
          });
        }
      } catch {
        // Provider doctor unavailable — continue detection heuristics.
      }
    }

    // 2. Env-var detection
    if (detectedProviders.length > 0) {
      return this.buildSnapshot({
        status: 'env_detected',
        detectedProviders,
        activeProvider: null,
        activeModel: null,
        workspace,
        dbExists,
      });
    }

    // 3. DB exists but nothing is ready and no env vars → needs provider setup
    if (dbExists) {
      return this.buildSnapshot({
        status: 'needs_provider',
        detectedProviders,
        activeProvider: null,
        activeModel: null,
        workspace,
        dbExists,
      });
    }

    // 4. Completely fresh install
    return this.buildSnapshot({
      status: 'fresh',
      detectedProviders,
      activeProvider: null,
      activeModel: null,
      workspace,
      dbExists,
    });
  }

  // -------------------------------------------------------------------------
  // detectWorkspace()
  // -------------------------------------------------------------------------

  public detectWorkspace(): WorkspaceHint {
    if (this.existsSync(path.join(this.cwd, 'package.json'))) {
      return {
        type: 'nodejs',
        suggestedMission: 'Analise este projeto Node.js e resuma sua estrutura',
        readOnly: true,
      };
    }

    if (
      this.existsSync(path.join(this.cwd, 'pyproject.toml')) ||
      this.existsSync(path.join(this.cwd, 'requirements.txt'))
    ) {
      return {
        type: 'python',
        suggestedMission: 'Analise este projeto Python e identifique dependências desatualizadas',
        readOnly: true,
      };
    }

    if (this.existsSync(path.join(this.cwd, '.git'))) {
      return {
        type: 'git_repo',
        suggestedMission: 'Resuma os últimos 5 commits deste repositório',
        readOnly: true,
      };
    }

    if (this.existsSync(path.join(this.cwd, 'README.md'))) {
      return {
        type: 'docs_only',
        suggestedMission: 'Analise esta documentação e sugira melhorias',
        readOnly: true,
      };
    }

    return {
      type: 'unknown',
      suggestedMission: 'Explore este diretório e me diga o que encontrou',
      readOnly: true,
    };
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private scanEnvProviders(): DetectedEnvProvider[] {
    const detected: DetectedEnvProvider[] = [];

    for (const mapping of ENV_PROVIDER_MAP) {
      const value = this.env[mapping.envVar];
      if (value && value.trim().length > 0) {
        detected.push({
          id: mapping.id,
          name: mapping.name,
          envVar: mapping.envVar,
          maskedValue: this.maskValue(value.trim()),
          type: mapping.type,
        });
      }
    }

    return detected;
  }

  private maskValue(value: string): string {
    if (value.length <= 4) {
      return '...****';
    }
    return `...${value.slice(-4)}`;
  }

  private resolveDbPath(): string {
    try {
      if (config && typeof (config as any).dataDir === 'string') {
        return path.join((config as any).dataDir, 'zavorth.db');
      }
    } catch {
      // config unavailable — use fallback
    }
    return path.join(this.cwd, 'data', 'zavorth.db');
  }

  private buildSnapshot(input: {
    status: FirstBootStatus;
    detectedProviders: DetectedEnvProvider[];
    activeProvider: string | null;
    activeModel: string | null;
    workspace: WorkspaceHint;
    dbExists: boolean;
  }): FirstBootSnapshot {
    return {
      status: input.status,
      generatedAt: this.now().toISOString(),
      detectedProviders: input.detectedProviders,
      activeProvider: input.activeProvider,
      activeModel: input.activeModel,
      workspace: input.workspace,
      dbExists: input.dbExists,
    };
  }
}
