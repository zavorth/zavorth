import {
  AnthropicCompatibleProviderLiveClient,
  GeminiRestProviderLiveClient,
  OpenAICompatibleProviderLiveClient,
} from '../src/adapters/providers/ProviderP0LiveClients.js';
import type { ProviderRuntimeActivationEntry } from '../src/contracts/ProviderRuntimeActivationContract.js';
import { ProviderRuntimeActivationService } from '../src/services/ProviderRuntimeActivationService.js';

type Profile = 'configured' | 'staging-live';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const provider = readArg('--provider');
const profile = (readArg('--profile') || 'configured') as Profile;
const confirmLiveIo = args.includes('--confirm-live-io');
const snapshot = new ProviderRuntimeActivationService().buildSnapshot();
const selected = provider
  ? snapshot.entries.filter((entry) => entry.providerId === provider)
  : snapshot.entries;

if (selected.length === 0) {
  console.error(`[provider-runtime-activation] unknown provider: ${provider}`);
  process.exit(1);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main(): Promise<void> {
  const liveReceiptByProvider = new Map<string, unknown>();
  if (profile === 'staging-live' && confirmLiveIo) {
    for (const entry of selected) {
      liveReceiptByProvider.set(entry.providerId, await runLiveSmoke(entry));
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    profile,
    liveIoPerformed: liveReceiptByProvider.size > 0,
    confirmLiveIo,
    status: profile === 'staging-live' && !confirmLiveIo ? 'blocked-until-confirmed' : 'ready-for-operator',
    reason: profile === 'staging-live' && !confirmLiveIo
      ? 'staging-live smoke requires --confirm-live-io and real operator credentials.'
      : 'Connector registry exposes provider runtime routes, adapter families and redacted activation receipts.',
    entries: selected.map((entry) => ({
      providerId: entry.providerId,
      status: entry.status,
      readinessStatus: entry.readinessStatus,
      adapterFamily: entry.adapterFamily,
      providerFactoryTarget: entry.providerFactoryTarget,
      doctorCommand: entry.doctorCommand,
      stagingLiveSmokeCommand: entry.stagingLiveSmokeCommand,
      requiredEnv: entry.configSchema.requiredEnv,
      optionalEnv: entry.configSchema.optionalEnv,
      gaps: entry.gaps,
      receipt: entry.receipt,
      liveReceipt: liveReceiptByProvider.get(entry.providerId) || null,
    })),
  };

  if (asJson) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`[provider-runtime-activation] profile=${profile} liveIoPerformed=${output.liveIoPerformed}`);
    console.log(`[provider-runtime-activation] ${output.status}: ${output.reason}`);
    for (const entry of output.entries) {
      console.log(`[provider-runtime-activation] ${entry.providerId} ${entry.status} family=${entry.adapterFamily}`);
      console.log(`  factory: ${entry.providerFactoryTarget}`);
      console.log(`  doctor: ${entry.doctorCommand}`);
      console.log(`  staging: ${entry.stagingLiveSmokeCommand}`);
      console.log(`  required env: ${entry.requiredEnv.join(', ')}`);
    }
  }
}

function readArg(name: string): string | null {
  const direct = args.find((arg) => arg.startsWith(`${name}=`));
  if (direct) {
    return direct.slice(name.length + 1);
  }
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1];
  }
  return null;
}

async function runLiveSmoke(entry: ProviderRuntimeActivationEntry): Promise<unknown> {
  const modelName = readEnv(`${envPrefix(entry.providerId)}_MODEL`) || entry.defaultModelName;
  const messages = [
    { role: 'system' as const, content: 'Return a short Zavorth provider smoke acknowledgement.' },
    { role: 'user' as const, content: 'zavorth-provider-smoke' },
  ];

  if (entry.adapterFamily === 'gemini-rest') {
    return new GeminiRestProviderLiveClient({
      providerId: entry.providerId,
      apiKey: requireEnv(entry.providerId, 'GEMINI_API_KEY'),
      baseUrl: readEnv('GEMINI_BASE_URL'),
      modelName,
    }).chatSmoke({ messages });
  }

  if (entry.adapterFamily === 'anthropic-compatible') {
    return new AnthropicCompatibleProviderLiveClient({
      providerId: entry.providerId,
      baseUrl: readEnv('ANTHROPIC_BASE_URL') || 'https://api.anthropic.com/v1',
      apiKey: requireEnv(entry.providerId, 'ANTHROPIC_API_KEY'),
      modelName,
    }).chatSmoke({ messages });
  }

  if (entry.adapterFamily === 'local-openai-compatible') {
    return new OpenAICompatibleProviderLiveClient({
      providerId: entry.providerId,
      baseUrl: readEnv(`${envPrefix(entry.providerId)}_BASE_URL`) || defaultProviderBaseUrl(entry.providerId),
      apiKey: null,
      modelName,
    }, {}, 'local-openai-compatible').chatSmoke({ messages });
  }

  return new OpenAICompatibleProviderLiveClient({
    providerId: entry.providerId,
    baseUrl: readEnv(`${envPrefix(entry.providerId)}_BASE_URL`) || defaultProviderBaseUrl(entry.providerId),
    apiKey: requireEnv(entry.providerId, ...secretEnvCandidates(entry)),
    modelName,
  }).chatSmoke({ messages });
}

function secretEnvCandidates(entry: ProviderRuntimeActivationEntry): string[] {
  const secretEnv = entry.configSchema.secretEnv.length > 0
    ? entry.configSchema.secretEnv
    : entry.configSchema.requiredEnv.filter((item) => /API_KEY|TOKEN|SECRET|KEY/i.test(item));
  return secretEnv.length > 0 ? secretEnv : [`${envPrefix(entry.providerId)}_API_KEY`];
}

function requireEnv(providerId: string, ...names: string[]): string {
  const value = readEnv(...names);
  if (value) {
    return value;
  }
  throw new Error(`[provider-runtime-activation] ${providerId} requires one of: ${names.join(', ')}`);
}

function readEnv(...names: Array<string | null | undefined>): string | null {
  for (const name of names) {
    const normalized = String(name || '').trim();
    if (!normalized) continue;
    const value = String(process.env[normalized] || '').trim();
    if (value) return value;
  }
  return null;
}

function defaultProviderBaseUrl(providerId: string): string {
  const defaults: Record<string, string> = {
    deepinfra: 'https://api.deepinfra.com/v1/openai',
    deepseek: 'https://api.deepseek.com/v1',
    fireworks: 'https://api.fireworks.ai/inference/v1',
    groq: 'https://api.groq.com/openai/v1',
    huggingface: 'https://router.huggingface.co/v1',
    lmstudio: 'http://localhost:1234/v1',
    mistral: 'https://api.mistral.ai/v1',
    ollama: 'http://localhost:11434/v1',
    openai: 'https://api.openai.com/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    perplexity: 'https://api.perplexity.ai',
    qwen: 'https://api.puter.com/puterai/openai/v1',
    together: 'https://api.together.xyz/v1',
    'vercel-ai-gateway': 'https://ai-gateway.vercel.sh/v1',
    vllm: 'http://localhost:8000/v1',
    xai: 'https://api.x.ai/v1',
  };
  return defaults[providerId] || `https://${providerId}.example.invalid/v1`;
}

function envPrefix(providerId: string): string {
  return providerId.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
