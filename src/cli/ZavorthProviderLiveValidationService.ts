import fs from 'fs';
import path from 'path';
import { ProviderFactory } from '../providers/ProviderFactory.js';
import type { ILlmProvider } from '../providers/ILlmProvider.js';
import {
  resolveSetupStudioProvider,
  type ZavorthSetupStudioProviderId,
} from './ZavorthSetupStudioService.js';
import { ProviderIntegrationRegistry } from '../services/providers/catalog/ProviderIntegrationRegistry.js';

export type ZavorthProviderLiveValidationStatus =
  | 'not-requested'
  | 'passed'
  | 'failed'
  | 'unsupported';

export type ZavorthProviderLiveValidationInput = {
  projectRoot: string;
  providerId: string;
  modelId?: string | null;
  providerSecret?: string | null;
  explicitUserConsent: boolean;
  timeoutMs?: number;
};

export type ZavorthProviderLiveValidationResult = {
  contractVersion: 'zavorth-provider-live-validation/1';
  providerId: string;
  modelId: string | null;
  status: ZavorthProviderLiveValidationStatus;
  message: string;
  proofPath: string | null;
  proof: {
    checkedAt: string;
    providerId: string;
    modelId: string | null;
    status: ZavorthProviderLiveValidationStatus;
    promptLabel: 'ping';
    responsePreview?: string;
    errorKind?: string;
    secretStored: false;
    rawSecretInProof: false;
  };
  safety: {
    explicitUserConsent: boolean;
    networkCallPerformed: boolean;
    rawSecretInOutput: false;
    rawSecretInProof: false;
    runtimePersistentStartPerformed: false;
    environmentRestored: boolean;
  };
};

export type ZavorthProviderLiveValidationDeps = {
  createProvider?: typeof ProviderFactory.create;
  clearProviderCache?: typeof ProviderFactory.clearCache;
  now?: () => Date;
};

const CHAT_PROVIDER_IDS = new Set<ZavorthSetupStudioProviderId>([
  'gemini',
  'openai',
  'openrouter',
  'groq',
  'deepseek',
  'anthropic',
  'huggingface',
  'local',
]);

const PROVIDER_REGISTRY = new ProviderIntegrationRegistry();

export async function validateZavorthProviderLive(
  input: ZavorthProviderLiveValidationInput,
  deps: ZavorthProviderLiveValidationDeps = {},
): Promise<ZavorthProviderLiveValidationResult> {
  const provider = resolveSetupStudioProvider(input.providerId);
  const modelId = String(input.modelId || provider.defaultModel || '').trim() || null;
  const proofPath = resolveProviderLiveProofPath(input.projectRoot);
  const now = deps.now || (() => new Date());
  const checkedAt = now().toISOString();

  if (!input.explicitUserConsent) {
    return result({
      input,
      checkedAt,
      proofPath: null,
      status: 'not-requested',
      message: 'Live provider test was not requested.',
      networkCallPerformed: false,
      environmentRestored: true,
    });
  }

  if (!isChatCapableSetupProvider(provider.id)) {
    return result({
      input,
      checkedAt,
      proofPath,
      status: 'unsupported',
      message: `${provider.label} is cataloged, but this live ping only validates chat-capable providers. Media/search/speech providers remain configurable through setup and provider-specific tests.`,
      networkCallPerformed: false,
      environmentRestored: true,
    });
  }

  const secret = String(input.providerSecret || '').trim();
  const envSnapshot = snapshotEnv(provider.secretEnvKeys, provider.modelEnvKey, provider.id);
  const clearProviderCache = deps.clearProviderCache || ProviderFactory.clearCache.bind(ProviderFactory);
  const createProvider = deps.createProvider || ProviderFactory.create.bind(ProviderFactory);

  try {
    if (secret) {
      for (const envKey of provider.secretEnvKeys) {
        process.env[envKey] = secret;
      }
    }
    if (provider.modelEnvKey && modelId) {
      process.env[provider.modelEnvKey] = modelId;
    }
    process.env.ZAVORTH_DEFAULT_PROVIDER = provider.id;
    clearProviderCache();

    const live = await withTimeout(
      async () => {
        const llmProvider = createProvider(provider.id) as ILlmProvider;
        return llmProvider.chat([{ role: 'user', content: 'ping' }], [], { modelName: modelId || undefined });
      },
      input.timeoutMs || 20000,
    );
    const responsePreview = sanitizeMessage(String(live.content || '').slice(0, 120), [secret]);
    return result({
      input,
      checkedAt,
      proofPath,
      status: 'passed',
      message: 'Provider answered the live ping successfully.',
      networkCallPerformed: true,
      environmentRestored: true,
      responsePreview: responsePreview || 'ok',
    });
  } catch (error) {
    return result({
      input,
      checkedAt,
      proofPath,
      status: 'failed',
      message: sanitizeMessage(error instanceof Error ? error.message : String(error), [secret]),
      networkCallPerformed: true,
      environmentRestored: true,
      errorKind: error instanceof Error ? error.name : 'ProviderValidationError',
    });
  } finally {
    restoreEnv(envSnapshot);
    clearProviderCache();
  }
}

function isChatCapableSetupProvider(providerId: string): boolean {
  if (CHAT_PROVIDER_IDS.has(providerId)) {
    return true;
  }
  const resolved = PROVIDER_REGISTRY.resolveProvider(providerId);
  return Boolean(resolved?.primaryRoute?.capabilities?.includes('chat'));
}

export function writeZavorthProviderLiveValidationProof(
  projectRoot: string,
  validation: ZavorthProviderLiveValidationResult | null | undefined,
): { written: boolean; path: string | null } {
  if (!validation || validation.status === 'not-requested') {
    return { written: false, path: null };
  }
  const proofPath = resolveProviderLiveProofPath(projectRoot);
  fs.mkdirSync(path.dirname(proofPath), { recursive: true });
  const current = readProofFile(proofPath);
  const nextResults = [
    validation.proof,
    ...current.results.filter((entry) => entry.providerId !== validation.providerId).slice(0, 19),
  ];
  const payload = {
    contractVersion: 'zavorth-provider-live-validation-proof/1',
    updatedAt: validation.proof.checkedAt,
    safety: {
      rawSecretInProof: false,
      rawSecretInOutput: false,
    },
    results: nextResults,
  };
  fs.writeFileSync(proofPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return { written: true, path: proofPath };
}

export function renderZavorthProviderLiveValidationResult(
  validation: ZavorthProviderLiveValidationResult | null | undefined,
): string {
  if (!validation) {
    return 'Provider live test: not requested.';
  }
  const label = `${validation.providerId}${validation.modelId ? `/${validation.modelId}` : ''}`;
  if (validation.status === 'passed') {
    return `Provider live test: passed (${label}).`;
  }
  if (validation.status === 'failed') {
    return `Provider live test: failed (${label}) - ${validation.message}`;
  }
  if (validation.status === 'unsupported') {
    return `Provider live test: unsupported (${label}) - ${validation.message}`;
  }
  return `Provider live test: not requested (${label}).`;
}

function result(input: {
  input: ZavorthProviderLiveValidationInput;
  checkedAt: string;
  proofPath: string | null;
  status: ZavorthProviderLiveValidationStatus;
  message: string;
  networkCallPerformed: boolean;
  environmentRestored: boolean;
  responsePreview?: string;
  errorKind?: string;
}): ZavorthProviderLiveValidationResult {
  const provider = resolveSetupStudioProvider(input.input.providerId);
  const modelId = String(input.input.modelId || provider.defaultModel || '').trim() || null;
  const secret = String(input.input.providerSecret || '').trim();
  const message = sanitizeMessage(input.message, [secret]);
  return {
    contractVersion: 'zavorth-provider-live-validation/1',
    providerId: provider.id,
    modelId,
    status: input.status,
    message,
    proofPath: input.proofPath,
    proof: {
      checkedAt: input.checkedAt,
      providerId: provider.id,
      modelId,
      status: input.status,
      promptLabel: 'ping',
      ...(input.responsePreview ? { responsePreview: sanitizeMessage(input.responsePreview, [secret]) } : {}),
      ...(input.errorKind ? { errorKind: sanitizeMessage(input.errorKind, [secret]) } : {}),
      secretStored: false,
      rawSecretInProof: false,
    },
    safety: {
      explicitUserConsent: input.input.explicitUserConsent,
      networkCallPerformed: input.networkCallPerformed,
      rawSecretInOutput: false,
      rawSecretInProof: false,
      runtimePersistentStartPerformed: false,
      environmentRestored: input.environmentRestored,
    },
  };
}

function resolveProviderLiveProofPath(projectRoot: string): string {
  return path.join(projectRoot, 'data', 'runtime', 'provider-live-validation-proof.json');
}

function readProofFile(proofPath: string): {
  results: ZavorthProviderLiveValidationResult['proof'][];
} {
  if (!fs.existsSync(proofPath)) {
    return { results: [] };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(proofPath, 'utf8'));
    return {
      results: Array.isArray(parsed.results) ? parsed.results : [],
    };
  } catch {
    return { results: [] };
  }
}

function snapshotEnv(secretEnvKeys: string[], modelEnvKey: string | null, providerId: string): Map<string, string | undefined> {
  const keys = new Set([
    ...secretEnvKeys,
    ...(modelEnvKey ? [modelEnvKey] : []),
    'ZAVORTH_DEFAULT_PROVIDER',
    'LLM_PROVIDER',
    `${providerId.toUpperCase()}_MODEL`,
  ]);
  return new Map(Array.from(keys).map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot: Map<string, string | undefined>): void {
  for (const [key, value] of snapshot.entries()) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

async function withTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Provider ping timed out after ${timeoutMs}ms.`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function sanitizeMessage(message: string, secrets: string[]): string {
  let output = String(message || '');
  for (const secret of secrets.filter(Boolean)) {
    output = output.split(secret).join('[redacted]');
  }
  return output
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[redacted]')
    .replace(/\bhf_[A-Za-z0-9]{12,}\b/g, '[redacted]')
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, '[redacted]')
    .replace(/\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{12,}\b/g, '[redacted]');
}
