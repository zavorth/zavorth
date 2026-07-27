import { ProviderConfigService, ProviderConfig } from './ProviderConfigService.js';
import { LocalEncryptedProviderSecretStore } from './ProviderSecretStore.js';
import { ErrorNormalizationService } from './ErrorNormalizationService.js';
import { safeFetch } from '../security/SafeFetchService.js';
import { asErrorLike } from '../utils/errorLike';


export interface ProviderConnectionTestResult {
  ok: boolean;
  providerId: string;
  status: 'reachable' | 'invalid_key' | 'missing_key' | 'timeout' | 'network_error' | 'unsupported' | 'blocked_url';
  message: string;
}

export class ProviderConnectionTestService {
  private static instance: ProviderConnectionTestService;

  private constructor() {}

  public static getInstance(): ProviderConnectionTestService {
    if (!ProviderConnectionTestService.instance) {
      ProviderConnectionTestService.instance = new ProviderConnectionTestService();
    }
    return ProviderConnectionTestService.instance;
  }

  public async testConnection(providerId: string): Promise<ProviderConnectionTestResult> {
    const configService = ProviderConfigService.getInstance();
    const store = LocalEncryptedProviderSecretStore.getInstance();


    const config = await configService.getProvider(providerId);
    if (!config) {
      return this.finishTest(providerId, false, 'unsupported', 'Provider not found');
    }

    let apiKey = '';
    if (config.requiresApiKey) {
      if (!config.secretRef) {
        return this.finishTest(providerId, false, 'missing_key', 'Provider requires an API key but none is configured.');
      }
      const rawKey = await store.getSecret(config.secretRef);
      if (!rawKey) {
        return this.finishTest(providerId, false, 'missing_key', 'Configured API key could not be decrypted or is missing.');
      }
      apiKey = rawKey;
    }

    try {
      if (config.type === 'openai' || config.type === 'openai-compatible' || config.type === 'openrouter') {
        return await this.testOpenAICompatible(providerId, config, apiKey);
      } else if (config.type === 'anthropic') {
        return await this.testAnthropic(providerId, config, apiKey);
      } else if (config.type === 'google') {
        return await this.testGoogle(providerId, config, apiKey);
      } else if (config.type === 'ollama') {
        return await this.testOllama(providerId, config);
      } else {
        return this.finishTest(providerId, false, 'unsupported', `Provider type ${config.type} is not supported for connection tests yet.`);
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const normalized = ErrorNormalizationService.getInstance().normalize(err);
      let status: ProviderConnectionTestResult['status'] = 'network_error';
      let message = 'Network error occurred while connecting.';

      if (err?.name === 'AbortError' || normalized.code === 'timeout') {
        status = 'timeout';
        message = 'Connection timed out.';
      } else if (normalized.code === 'invalid_key') {
        status = 'invalid_key';
        message = 'API key is invalid or lacks permissions.';
      }

      return this.finishTest(providerId, false, status, message);
    }
  }

  private finishTest(providerId: string, ok: boolean, status: ProviderConnectionTestResult['status'], message: string): ProviderConnectionTestResult {
    return { ok, providerId, status, message };
  }

  private async testOpenAICompatible(providerId: string, config: ProviderConfig, apiKey: string): Promise<ProviderConnectionTestResult> {
    let baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    // Remove trailing slash
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    const endpoint = `${baseUrl}/models`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await safeFetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        signal: controller.signal
      }, {
        serviceName: 'Provider connection test',
      });
      clearTimeout(timeout);

      if (res.status === 200) {
        return this.finishTest(providerId, true, 'reachable', 'Successfully connected and verified API key.');
      } else if (res.status === 401 || res.status === 403) {
        return this.finishTest(providerId, false, 'invalid_key', 'API key is invalid or lacks permissions.');
      } else {
        return this.finishTest(providerId, false, 'network_error', `Received unexpected status code ${res.status}.`);
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      clearTimeout(timeout);
      throw err;
    }
  }

  private async testAnthropic(providerId: string, config: ProviderConfig, apiKey: string): Promise<ProviderConnectionTestResult> {
    const baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
    const endpoint = `${baseUrl}/messages`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      // Send an empty GET. Anthropic responds with 401 for bad keys, and 405 Method Not Allowed or 400 Bad Request for valid keys but bad request format
      const res = await safeFetch(endpoint, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        signal: controller.signal
      }, {
        serviceName: 'Provider connection test',
      });
      clearTimeout(timeout);

      if (res.status === 401 || res.status === 403) {
        return this.finishTest(providerId, false, 'invalid_key', 'API key is invalid or lacks permissions.');
      } else {
        // Anything else means we reached Anthropic and the key didn't get outright rejected at auth layer
        return this.finishTest(providerId, true, 'reachable', 'Successfully connected and verified API key.');
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      clearTimeout(timeout);
      throw err;
    }
  }

  private async testGoogle(providerId: string, config: ProviderConfig, apiKey: string): Promise<ProviderConnectionTestResult> {
    const baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    const endpoint = `${baseUrl}/models...key=${apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await safeFetch(endpoint, {
        method: 'GET',
        signal: controller.signal
      }, {
        serviceName: 'Provider connection test',
      });
      clearTimeout(timeout);

      if (res.status === 200) {
        return this.finishTest(providerId, true, 'reachable', 'Successfully connected and verified API key.');
      } else if (res.status === 400 || res.status === 401 || res.status === 403) {
        return this.finishTest(providerId, false, 'invalid_key', 'API key is invalid or lacks permissions.');
      } else {
        return this.finishTest(providerId, false, 'network_error', `Received unexpected status code ${res.status}.`);
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      clearTimeout(timeout);
      throw err;
    }
  }

  private async testOllama(providerId: string, config: ProviderConfig): Promise<ProviderConnectionTestResult> {
    const baseUrl = config.baseUrl || 'http://localhost:11434';
    const endpoint = `${baseUrl}/api/tags`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await safeFetch(endpoint, {
        method: 'GET',
        signal: controller.signal
      }, {
        serviceName: 'Ollama connection test',
        allowLoopback: true,
      });
      clearTimeout(timeout);

      if (res.status === 200) {
        return this.finishTest(providerId, true, 'reachable', 'Successfully connected to local Ollama instance.');
      } else {
        return this.finishTest(providerId, false, 'network_error', `Received unexpected status code ${res.status} from Ollama.`);
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      clearTimeout(timeout);
      throw err;
    }
  }
}
