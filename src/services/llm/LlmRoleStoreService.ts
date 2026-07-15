import fs from 'fs';
import path from 'path';
import { config } from '../../config/index.js';
import {
  createEmptyLlmRoleRoutingConfig,
  createEmptyLlmRoleTelemetry,
  type LlmRoleRoutingConfig,
} from '../../contracts/runtime/LlmRoleRoutingContract.js';

export class LlmRoleStoreService {
  constructor(
    private readonly baseDir = path.resolve(
      config.operationalMemoryDir || path.join(process.cwd(), 'data', 'operational-memory'),
      'llm-roles',
    ),
  ) {}

  public load(scopeId: string): LlmRoleRoutingConfig {
    const file = this.filePath(scopeId);
    try {
      if (!fs.existsSync(file)) {
        return createEmptyLlmRoleRoutingConfig();
      }
      const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<LlmRoleRoutingConfig>;
      return this.normalize(raw);
    } catch {
      return createEmptyLlmRoleRoutingConfig();
    }
  }

  public save(scopeId: string, next: LlmRoleRoutingConfig): LlmRoleRoutingConfig {
    const normalized = this.normalize({
      ...next,
      updatedAt: new Date().toISOString(),
    });
    fs.mkdirSync(this.baseDir, { recursive: true });
    fs.writeFileSync(this.filePath(scopeId), JSON.stringify(normalized, null, 2), 'utf8');
    return normalized;
  }

  private filePath(scopeId: string): string {
    const safe =
      String(scopeId || 'global')
        .replace(/[^a-zA-Z0-9._:@-]+/g, '_')
        .slice(0, 140) || 'global';
    return path.join(this.baseDir, `${safe}.json`);
  }

  private normalize(raw: Partial<LlmRoleRoutingConfig> | null | undefined): LlmRoleRoutingConfig {
    const base = createEmptyLlmRoleRoutingConfig(raw?.updatedAt);
    return {
      ...base,
      ...raw,
      version: 1,
      default: raw?.default || null,
      strong: raw?.strong || null,
      background: raw?.background || null,
      taskStrong: raw?.taskStrong || {},
      strongOnDefaultFailure: raw?.strongOnDefaultFailure === true,
      rolesConfigured: raw?.rolesConfigured === true,
      promptDismissedAt: raw?.promptDismissedAt || null,
      lastPromptedAt: raw?.lastPromptedAt || null,
      lastPromptSurface: raw?.lastPromptSurface || null,
      awaitingSetup: raw?.awaitingSetup === true,
      forceStrongUntil: raw?.forceStrongUntil || null,
      pendingConfirmation: raw?.pendingConfirmation || null,
      modelSwitchEvents: Array.isArray(raw?.modelSwitchEvents) ? raw!.modelSwitchEvents!.slice(-40) : [],
      lastUsableProviders: Array.isArray(raw?.lastUsableProviders) ? raw!.lastUsableProviders! : [],
      telemetry: {
        ...createEmptyLlmRoleTelemetry(),
        ...(raw?.telemetry || {}),
      },
      source: raw?.source || null,
    };
  }
}
