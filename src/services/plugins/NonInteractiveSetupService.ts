import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export interface NonInteractiveConfig {
  provider: string;
  model?: string;
  apiKey?: string;
  workspace?: string;
  channels?: string[];
  skipConversational?: boolean;
  outputDir?: string;
}

export interface NonInteractiveResult {
  success: boolean;
  steps: Array<{ name: string; status: 'done' | 'skipped' | 'error'; message: string }>;
  configPath: string | null;
  error: string | null;
}

export class NonInteractiveSetupService {
  private readonly storageDir: string;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'non-interactive');
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
  }

  public async execute(config: NonInteractiveConfig): Promise<NonInteractiveResult> {
    const steps: NonInteractiveResult['steps'] = [];
    let configPath: string | null = null;

    // Step 1: Validate provider
    steps.push(this.validateProvider(config.provider));

    // Step 2: Save API key if provided
    if (config.apiKey) {
      steps.push(this.saveApiKey(config.provider, config.apiKey));
    }

    // Step 3: Create workspace if specified
    if (config.workspace) {
      steps.push(this.createWorkspace(config.workspace));
    }

    // Step 4: Configure channels if specified
    if (config.channels && config.channels.length > 0) {
      steps.push(this.configureChannels(config.channels));
    }

    // Step 5: Generate config file
    configPath = this.generateConfig(config);
    steps.push({
      name: 'config',
      status: 'done',
      message: `Config saved to ${configPath}`,
    });

    // Step 6: Skip conversational setup if requested
    if (config.skipConversational) {
      steps.push({
        name: 'conversational',
        status: 'skipped',
        message: 'Conversational setup skipped',
      });
    }

    const hasError = steps.some((s) => s.status === 'error');

    return {
      success: !hasError,
      steps,
      configPath,
      error: hasError ? 'Some steps failed' : null,
    };
  }

  public parseArgs(args: string[]): NonInteractiveConfig | null {
    if (!args.includes('--non-interactive')) return null;

    const config: NonInteractiveConfig = {
      provider: 'openai',
      skipConversational: false,
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const next = args[i + 1];

      if (arg === '--provider' && next) {
        config.provider = next;
      } else if (arg === '--model' && next) {
        config.model = next;
      } else if (arg === '--key' && next) {
        config.apiKey = next;
      } else if (arg === '--workspace' && next) {
        config.workspace = next;
      } else if (arg === '--channels' && next) {
        config.channels = next.split(',').map((c) => c.trim());
      } else if (arg === '--skip-conversational') {
        config.skipConversational = true;
      }
    }

    return config;
  }

  private validateProvider(provider: string): NonInteractiveResult['steps'][0] {
    const validProviders = ['openai', 'anthropic', 'google', 'groq', 'deepseek', 'mistral', 'ollama'];
    if (validProviders.includes(provider.toLowerCase())) {
      return { name: 'provider', status: 'done', message: `Provider: ${provider}` };
    }
    return { name: 'provider', status: 'error', message: `Unknown provider: ${provider}` };
  }

  private saveApiKey(provider: string, apiKey: string): NonInteractiveResult['steps'][0] {
    try {
      const envPath = path.join(process.cwd(), '.env');
      const envVar = this.getEnvVarName(provider);
      let content = '';

      if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, 'utf-8');
        // Replace existing key if present
        const regex = new RegExp(`^${envVar}=.*$`, 'm');
        if (regex.test(content)) {
          content = content.replace(regex, `${envVar}=${apiKey}`);
        } else {
          content += `\n${envVar}=${apiKey}`;
        }
      } else {
        content = `${envVar}=${apiKey}`;
      }

      fs.writeFileSync(envPath, content.trim() + '\n', 'utf-8');
      return { name: 'api-key', status: 'done', message: `API key saved to .env` };
    } catch (error) {
    logger.warn('[Non Interactive Setup] filesystem operation failed', error);
    return { name: 'api-key', status: 'error', message: `Failed to save API key: ${error instanceof Error ? error.message : String(error)}` };
  }
  }

  private createWorkspace(workspace: string): NonInteractiveResult['steps'][0] {
    try {
      const workspacePath = path.resolve(workspace);
      if (!fs.existsSync(workspacePath)) {
        fs.mkdirSync(workspacePath, { recursive: true });
      }
      return { name: 'workspace', status: 'done', message: `Workspace: ${workspacePath}` };
    } catch (error) {
    logger.warn('[Non Interactive Setup] filesystem operation failed', error);
    return { name: 'workspace', status: 'error', message: `Failed to create workspace: ${error instanceof Error ? error.message : String(error)}` };
  }
  }

  private configureChannels(channels: string[]): NonInteractiveResult['steps'][0] {
    try {
      const configPath = path.join(this.storageDir, 'channels.json');
      fs.writeFileSync(configPath, JSON.stringify({ channels }, null, 2), 'utf-8');
      return { name: 'channels', status: 'done', message: `Channels: ${channels.join(', ')}` };
    } catch (error) {
    logger.warn('[Non Interactive Setup] filesystem operation failed', error);
    return { name: 'channels', status: 'error', message: `Failed to configure channels: ${error instanceof Error ? error.message : String(error)}` };
  }
  }

  private generateConfig(config: NonInteractiveConfig): string {
    const configPath = path.join(this.storageDir, 'setup.json');
    const setupData = {
      provider: config.provider,
      model: config.model,
      workspace: config.workspace,
      channels: config.channels,
      skipConversational: config.skipConversational,
      configuredAt: new Date().toISOString(),
      method: 'non-interactive',
    };
    fs.writeFileSync(configPath, JSON.stringify(setupData, null, 2), 'utf-8');
    return configPath;
  }

  private getEnvVarName(provider: string): string {
    const map: Record<string, string> = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      google: 'GEMINI_API_KEY',
      groq: 'GROQ_API_KEY',
      deepseek: 'DEEPSEEK_API_KEY',
      mistral: 'MISTRAL_API_KEY',
      ollama: 'OLLAMA_HOST',
    };
    return map[provider.toLowerCase()] || `${provider.toUpperCase()}_API_KEY`;
  }
}
