import { ProviderConfigService } from '../../../../../services/ProviderConfigService.js';
import { ProviderConnectionTestService } from '../../../../../services/ProviderConnectionTestService.js';
import { LocalEncryptedProviderSecretStore } from '../../../../../services/ProviderSecretStore.js';

export type ProviderConfirmRequest = {
  providerId: string;
  type: 'openai' | 'anthropic' | 'google' | 'openrouter' | 'ollama' | 'openai-compatible';
  displayName: string;
  apiKey?: string;
  baseUrl?: string;
  modelId?: string;
};

export type ProviderConfirmResponse = {
  ok: boolean;
  providerId: string;
  probe: {
    status: string;
    message: string;
  };
};

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as ProviderConfirmRequest;

    if (!body.providerId || typeof body.providerId !== 'string' || !body.providerId.trim()) {
      return Response.json(
        {
          error: {
            message: 'providerId is required and must be a non-empty string',
            type: 'provider_confirm_validation_failed',
          },
        },
        { status: 400 }
      );
    }

    const configService = ProviderConfigService.getInstance();
    const secretStore = LocalEncryptedProviderSecretStore.getInstance();

    // Step 1: If apiKey is provided, save it via the encrypted secret store
    let secretRef: string | undefined;
    if (body.apiKey) {
      const saveResult = await secretStore.saveSecret(body.providerId, body.apiKey);
      secretRef = saveResult.secretRef;
    }

    // Step 2: Create or update the provider config
    const existing = await configService.getProvider(body.providerId);
    if (existing) {
      await configService.updateProvider(body.providerId, {
        displayName: body.displayName,
        baseUrl: body.baseUrl,
        defaultModel: body.modelId,
        enabled: true,
      });
    } else {
      await configService.createProvider({
        providerId: body.providerId,
        type: body.type,
        displayName: body.displayName,
        baseUrl: body.baseUrl,
        defaultModel: body.modelId,
        enabled: true,
      });
    }

    // Step 3: If a secret was saved, link it to the provider config
    if (secretRef) {
      await configService.setSecretRef(body.providerId, secretRef);
    }

    // Step 4: Run connection test
    const testResult = await ProviderConnectionTestService.getInstance().testConnection(body.providerId);

    const response: ProviderConfirmResponse = {
      ok: testResult.ok,
      providerId: body.providerId,
      probe: {
        status: testResult.status,
        message: testResult.message,
      },
    };

    return Response.json(response);
  } catch (error) {
    return Response.json(
      {
        error: {
          message: error instanceof Error ? error.message : 'Provider confirm failed',
          type: 'provider_confirm_failed',
        },
      },
      { status: 500 }
    );
  }
}
