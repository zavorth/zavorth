import type { ModelCapabilityKind, ModelModality, ProviderCredentialKind, ProviderRouteKind } from '../ProviderCatalogContracts.js';
import type { ProviderIntegrationManifest } from '../ProviderIntegrationManifest.js';
import { createMinimalProviderIntegrationManifest } from '../ProviderIntegrationManifest.js';
import {
  ZAVORTH_MEDIA_PROVIDER_ROWS,
  ZAVORTH_STATIC_PROVIDER_CATALOGS,
  modalityToCapabilities,
  modalityToModelModality,
  type ZavorthProviderCapabilityModality,
} from '../zavorthProviderCapabilityInventory.js';

type CapabilityProviderRoute = {
  id: string;
  label: string;
  website: string;
  routeKind?: ProviderRouteKind;
  authKind?: ProviderCredentialKind;
  mode?: 'cloud' | 'local' | 'hybrid';
  credentialRefs?: string[];
  aliases?: string[];
};

const REQUIRED_CAPABILITY_ROUTES: CapabilityProviderRoute[] = [
  cloud('byteplus', 'BytePlus', 'https://www.volcengine.com/product/ark'),
  cloud('byteplus-plan', 'BytePlus Plan', 'https://www.volcengine.com/product/ark'),
  cloud('volcengine', 'Volcengine', 'https://www.volcengine.com/product/ark'),
  cloud('volcengine-plan', 'Volcengine Plan', 'https://www.volcengine.com/product/ark'),
  cloud('openai-codex', 'OpenAI Codex', 'https://chatgpt.com/codex'),
  cloud('stepfun-plan', 'StepFun Plan', 'https://platform.stepfun.com'),
  cloud('tencent-tokenhub', 'Tencent TokenHub', 'https://cloud.tencent.com/product/hunyuan'),
  cloud('fal', 'fal', 'https://fal.ai'),
  cloud('runway', 'Runway', 'https://runwayml.com'),
  cloud('azure-speech', 'Azure Speech', 'https://azure.microsoft.com/products/ai-services/ai-speech', {
    credentialRefs: ['AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION', 'AZURE_SPEECH_API_KEY', 'SPEECH_KEY', 'SPEECH_REGION'],
  }),
  cloud('elevenlabs', 'ElevenLabs', 'https://elevenlabs.io', {
    credentialRefs: ['ELEVENLABS_API_KEY', 'XI_API_KEY', 'ELEVENLABS_BASE_URL'],
  }),
  cloud('senseaudio', 'SenseAudio', 'https://github.com/FunAudioLLM/SenseVoice'),
  cloud('vydra', 'Vydra', 'https://vydra.ai'),
  cloud('inworld', 'Inworld', 'https://inworld.ai'),
  local('tts-local-cli', 'local CLI TTS', 'https://github.com'),
  local('comfy', 'ComfyUI', 'https://www.comfy.org', {
    authKind: 'local_endpoint',
    credentialRefs: ['COMFY_BASE_URL', 'COMFY_API_KEY', 'COMFY_CLOUD_API_KEY'],
  }),
  cloud('google', 'Google Media', 'https://ai.google.dev', {
    aliases: ['google-media', 'google-generative-media'],
    credentialRefs: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
  }),
  cloud('assemblyai', 'AssemblyAI', 'https://assemblyai.com', {
    credentialRefs: ['ASSEMBLYAI_API_KEY'],
  }),
  cloud('cartesia', 'Cartesia', 'https://cartesia.ai', {
    credentialRefs: ['CARTESIA_API_KEY'],
  }),
  cloud('playht', 'PlayHT', 'https://play.ht', {
    credentialRefs: ['PLAYHT_API_KEY', 'PLAYHT_USER_ID'],
  }),
  cloud('sdwebui', 'Stable Diffusion WebUI', 'https://github.com/AUTOMATIC1111/stable-diffusion-webui', {
    mode: 'local',
    routeKind: 'local_runtime',
    authKind: 'local_endpoint',
    credentialRefs: ['SDWEBUI_BASE_URL'],
  }),
  cloud('huggingface', 'HuggingFace Inference', 'https://huggingface.co', {
    credentialRefs: ['HUGGINGFACE_API_KEY', 'HF_TOKEN'],
  }),
  cloud('deepinfra', 'DeepInfra', 'https://deepinfra.com', {
    credentialRefs: ['DEEPINFRA_API_KEY'],
  }),
  cloud('runway', 'Runway', 'https://runwayml.com', {
    credentialRefs: ['RUNWAYML_API_SECRET'],
  }),
  cloud('fal', 'fal', 'https://fal.ai', {
    credentialRefs: ['FAL_KEY'],
  }),
];

export const ZAVORTH_PROVIDER_CAPABILITY_MANIFESTS: ProviderIntegrationManifest[] =
  REQUIRED_CAPABILITY_ROUTES.map(toManifest);

function toManifest(route: CapabilityProviderRoute): ProviderIntegrationManifest {
  const models = modelIdsFor(route.id);
  const sourceModalities = modalitiesFor(route.id);
  const capabilities = sourceModalities.length > 0
    ? modalityToCapabilities(sourceModalities)
    : defaultCapabilitiesFor(route.id);
  const modalities = sourceModalities.length > 0
    ? unique(sourceModalities.map(modalityToModelModality))
    : defaultModalitiesFor(route.id);
  const defaultModelName = models[0] || defaultModelFor(route.id);
  const manifest = createMinimalProviderIntegrationManifest({
    id: route.id,
    label: route.label,
    vendorId: route.id,
    providerId: route.id,
    providerName: route.id,
    aliases: unique([route.id, ...(route.aliases || [])]),
    website: route.website,
    routeKind: route.routeKind || (route.mode === 'local' ? 'local_runtime' : 'custom_compatible'),
    mode: route.mode || 'cloud',
    authKind: route.authKind || (route.mode === 'local' ? 'local_endpoint' : 'api_key'),
    credentialRefs: route.credentialRefs || defaultCredentialRefs(route.id),
    capabilities,
    modalities,
    defaultModelName,
    source: 'curated',
  });

  return {
    ...manifest,
    notes: [
      'Zavorth provider capability catalog route. This manifest makes the route visible, selectable, auditable and live-proof gated.',
      'A cataloged route is not live execution proof; credentials and an adapter/protocol-compatible endpoint are still required.',
    ],
    families: manifest.families.map((family) => ({
      ...family,
      summary: `${route.label} capability route in the governed Zavorth provider catalog.`,
      secondaryModelNames: models.slice(1),
      capabilities,
      modalities,
    })),
    routes: manifest.routes.map((entry) => ({
      ...entry,
      capabilities,
      modalities,
      models: unique(models).map((modelId, index) => ({
        modelId,
        label: modelId,
        primary: index === 0,
        capabilities,
        modalities,
      })),
      limitations: [
        'Requires explicit provider credentials and live proof before default routing.',
        'Media generation routes are cataloged here; execution remains gated by the matching Zavorth adapter or compatible endpoint.',
      ],
    })),
  };
}

function cloud(
  id: string,
  label: string,
  website: string,
  options: Partial<CapabilityProviderRoute> = {},
): CapabilityProviderRoute {
  return {
    id,
    label,
    website,
    mode: 'cloud',
    routeKind: 'custom_compatible',
    authKind: 'api_key',
    ...options,
  };
}

function local(
  id: string,
  label: string,
  website: string,
  options: Partial<CapabilityProviderRoute> = {},
): CapabilityProviderRoute {
  return {
    id,
    label,
    website,
    mode: 'local',
    routeKind: 'local_runtime',
    authKind: 'local_endpoint',
    ...options,
  };
}

function modelIdsFor(providerId: string): string[] {
  const fromStatic = ZAVORTH_STATIC_PROVIDER_CATALOGS
    .filter((entry) => entry.providerId === providerId)
    .flatMap((entry) => entry.models);
  const fromMedia = ZAVORTH_MEDIA_PROVIDER_ROWS
    .filter((entry) => entry.providerId === providerId)
    .flatMap((entry) => entry.models);
  return unique([...fromStatic, ...fromMedia]);
}

function modalitiesFor(providerId: string): ZavorthProviderCapabilityModality[] {
  const fromStatic = ZAVORTH_STATIC_PROVIDER_CATALOGS
    .filter((entry) => entry.providerId === providerId)
    .flatMap((entry) => entry.modalities);
  const fromMedia = ZAVORTH_MEDIA_PROVIDER_ROWS
    .filter((entry) => entry.providerId === providerId)
    .map((entry) => entry.modality);
  return unique([...fromStatic, ...fromMedia]);
}

function defaultCapabilitiesFor(providerId: string): ModelCapabilityKind[] {
  if (providerId.includes('tts') || providerId.includes('speech')) {
    return ['audio', 'streaming'];
  }
  return ['chat', 'coding', 'reasoning', 'streaming', 'tool_use'];
}

function defaultModalitiesFor(providerId: string): ModelModality[] {
  if (providerId.includes('tts') || providerId.includes('speech')) {
    return ['audio'];
  }
  return ['text', 'tool'];
}

function defaultCredentialRefs(providerId: string): string[] {
  if (providerId === 'tts-local-cli') {
    return [];
  }
  return [`${envPrefix(providerId)}_API_KEY`, `${envPrefix(providerId)}_BASE_URL`];
}

function defaultModelFor(providerId: string): string {
  if (providerId === 'tts-local-cli') {
    return 'local-tts-command';
  }
  return 'auto';
}

function envPrefix(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean)));
}
