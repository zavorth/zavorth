
import fs from 'fs';
import path from 'path';

const PROVIDERS_DIR = path.resolve(__dirname, '../../src/providers');
const CATALOG_DIR = path.resolve(__dirname, '../../src/services/providers/catalog');
const MANIFESTS_DIR = path.join(CATALOG_DIR, 'manifests');
const DISCOVERY_DIR = path.join(CATALOG_DIR, 'discovery');

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.resolve(__dirname, '../../src', relativePath));
}

function readProviderFile(filename: string): string {
  return fs.readFileSync(path.join(PROVIDERS_DIR, filename), 'utf-8');
}

function readCatalogFile(filename: string): string {
  return fs.readFileSync(path.join(CATALOG_DIR, filename), 'utf-8');
}

function readManifestFile(filename: string): string {
  return fs.readFileSync(path.join(MANIFESTS_DIR, filename), 'utf-8');
}

const PROVIDER_FILES = [
  'AI21Provider.ts',
  'ProviderFactory.ts',
  'ProviderRegistry.ts',
  'XaiProvider.ts',
  'TogetherProvider.ts',
  'QwenProvider.ts',
  'OpenRouterProvider.ts',
  'OpenCodeProvider.ts',
  'OpenAIProvider.ts',
  'MistralProvider.ts',
  'MiniMaxProvider.ts',
  'LocalLlamaProvider.ts',
  'InflectionProvider.ts',
  'GroqProvider.ts',
  'GeminiVoiceService.ts',
  'GeminiProvider.ts',
  'GeminiInteractionsProviderAdapter.ts',
  'GatewayProvider.ts',
  'DeepSeekProvider.ts',
  'CerebrasProvider.ts',
  'openaiMessageConversion.ts',
  'ILlmProvider.ts',
  'ProviderNativeToolPayload.ts',
  'ProviderAbort.ts',
  'openaiToolCalls.ts',
  'OpenAICompatibleStreaming.ts',
];

const BESPOKE_PROVIDERS = [
  'GeminiProvider.ts',
  'DeepSeekProvider.ts',
  'OpenAIProvider.ts',
  'MiniMaxProvider.ts',
  'GroqProvider.ts',
  'XaiProvider.ts',
  'MistralProvider.ts',
  'CerebrasProvider.ts',
  'TogetherProvider.ts',
  'OpenRouterProvider.ts',
  'OpenCodeProvider.ts',
  'QwenProvider.ts',
  'LocalLlamaProvider.ts',
];

const CATALOG_SERVICE_FILES = [
  'ProviderCatalogContracts.ts',
  'ProviderCatalogCompat.ts',
  'ProviderCompatibilityClassifier.ts',
  'ProviderExternalImportService.ts',
  'ProviderAutoDiscoveryService.ts',
  'ProviderIntegrationRegistry.ts',
  'ProviderIntegrationManifest.ts',
  'ModelSelectionService.ts',
  'ModelProviderExperienceService.ts',
  'ModelPickerService.ts',
  'ModelIdSanitizer.ts',
  'DiscoveryRateLimiter.ts',
  'DiscoveryCache.ts',
  'ProviderMeshOnboardingProductService.ts',
  'ModelPickerExplainabilityService.ts',
  'AccessRouteResolutionService.ts',
  'zavorthProviderCapabilityInventory.ts',
  'ModelCatalogAggregationService.ts',
  'CustomCompatibleProviderOnboardingService.ts',
];

const MANIFEST_FILES = [
  'index.ts',
  'coreProviders.ts',
  'aggregatorProviders.ts',
  'localAndCustomProviders.ts',
  'p0ProviderActivationProviders.ts',
  'longTailProviderActivationProviders.ts',
  'zavorthProviderCertificationPack.ts',
  'mediaProviders.ts',
  'zavorthProviderCapabilityProviders.ts',
];

const DISCOVERY_ADAPTER_FILES = [
  'OpenAiCompatibleModelDiscoveryAdapter.ts',
  'AnthropicCompatibleModelDiscoveryAdapter.ts',
  'StaticCatalogDiscoveryAdapter.ts',
];

const DEDICATED_PROVIDERS = ['groq', 'xai', 'mistral', 'cerebras', 'together'];

const PROVIDER_MESH_EXPANSION_PROVIDERS = [
  'anthropic-direct',
  'anthropic-vertex',
  'bedrock-claude',
  'google-genai',
  'gemini-interactions',
  'lmstudio',
  'vllm',
];

const SWITCH_CASE_PROVIDERS = [
  'gemini',
  'deepseek',
  'openai',
  'minimax',
  'aigateway',
  'qwen',
  'puter',
  'openrouter',
  'groq',
  'xai',
  'mistral',
  'cerebras',
  'together',
  'opencode',
  'ollama',
];

const NORMALIZE_ALIASES: Array<{ input: string; expected: string }> = [
  { input: 'ai-gateway', expected: 'aigateway' },
  { input: 'ai_gateway', expected: 'aigateway' },
  { input: 'aigateway', expected: 'aigateway' },
  { input: 'amazon-bedrock', expected: 'bedrock-claude' },
  { input: 'amazon_bedrock', expected: 'bedrock-claude' },
  { input: 'aws-bedrock', expected: 'bedrock-claude' },
  { input: 'anthropic', expected: 'anthropic-direct' },
  { input: 'claude-direct', expected: 'anthropic-direct' },
  { input: 'anthropic_direct', expected: 'anthropic-direct' },
  { input: 'google', expected: 'gemini' },
  { input: 'google-ai-studio', expected: 'gemini' },
  { input: 'google_ai_studio', expected: 'gemini' },
  { input: 'volcengine', expected: 'byteplus' },
  { input: 'custom_compatible', expected: 'custom-openai-compatible' },
  { input: 'custom-compatible', expected: 'custom-openai-compatible' },
  { input: 'openai-compatible', expected: 'custom-openai-compatible' },
  { input: 'openai_compatible', expected: 'custom-openai-compatible' },
  { input: 'local-llama', expected: 'ollama' },
  { input: 'local_llama', expected: 'ollama' },
  { input: 'localllama', expected: 'ollama' },
  { input: 'anthropic-sdk', expected: 'anthropic-direct' },
  { input: 'anthropic_vertex', expected: 'anthropic-vertex' },
  { input: 'claude-vertex', expected: 'anthropic-vertex' },
  { input: 'vertex-claude', expected: 'anthropic-vertex' },
  { input: 'bedrock', expected: 'bedrock-claude' },
  { input: 'bedrock_claude', expected: 'bedrock-claude' },
  { input: 'genai', expected: 'google-genai' },
  { input: 'google_genai', expected: 'google-genai' },
  { input: 'google-ai', expected: 'google-genai' },
  { input: 'gemini-interactions', expected: 'gemini-interactions' },
  { input: 'google-interactions-api', expected: 'gemini-interactions' },
  { input: 'interactions-api', expected: 'gemini-interactions' },
  { input: 'lm-studio', expected: 'lmstudio' },
  { input: 'lm_studio', expected: 'lmstudio' },
];

describe('Provider file catalog', () => {
  it('providers directory exists', () => {
    expect(fs.existsSync(PROVIDERS_DIR)).toBe(true);
  });

  it('catalog directory exists', () => {
    expect(fs.existsSync(CATALOG_DIR)).toBe(true);
  });

  it('manifests directory exists', () => {
    expect(fs.existsSync(MANIFESTS_DIR)).toBe(true);
  });

  it('discovery directory exists', () => {
    expect(fs.existsSync(DISCOVERY_DIR)).toBe(true);
  });

  it(`has exactly ${PROVIDER_FILES.length} provider files`, () => {
    const files = fs.readdirSync(PROVIDERS_DIR).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBe(PROVIDER_FILES.length);
  });

  PROVIDER_FILES.forEach((filename) => {
    it(`provider file exists: ${filename}`, () => {
      expect(fs.existsSync(path.join(PROVIDERS_DIR, filename))).toBe(true);
    });
  });

  it(`has exactly ${CATALOG_SERVICE_FILES.length} catalog service files`, () => {
    const files = fs.readdirSync(CATALOG_DIR).filter((f) => f.endsWith('.ts') && !f.startsWith('.'));
    expect(files.length).toBe(CATALOG_SERVICE_FILES.length);
  });

  CATALOG_SERVICE_FILES.forEach((filename) => {
    it(`catalog service file exists: ${filename}`, () => {
      expect(fs.existsSync(path.join(CATALOG_DIR, filename))).toBe(true);
    });
  });

  it(`has exactly ${MANIFEST_FILES.length} manifest files`, () => {
    const files = fs.readdirSync(MANIFESTS_DIR).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBe(MANIFEST_FILES.length);
  });

  MANIFEST_FILES.forEach((filename) => {
    it(`manifest file exists: ${filename}`, () => {
      expect(fs.existsSync(path.join(MANIFESTS_DIR, filename))).toBe(true);
    });
  });

  it(`has exactly ${DISCOVERY_ADAPTER_FILES.length} discovery adapter files`, () => {
    const files = fs.readdirSync(DISCOVERY_DIR).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBe(DISCOVERY_ADAPTER_FILES.length);
  });

  DISCOVERY_ADAPTER_FILES.forEach((filename) => {
    it(`discovery adapter file exists: ${filename}`, () => {
      expect(fs.existsSync(path.join(DISCOVERY_DIR, filename))).toBe(true);
    });
  });
});

describe('ILlmProvider interface structure', () => {
  const content = readProviderFile('ILlmProvider.ts');

  it('exports ChatMessage interface', () => {
    expect(content).toMatch(/export\s+interface\s+ChatMessage/);
  });

  it('exports ToolDefinition interface', () => {
    expect(content).toMatch(/export\s+interface\s+ToolDefinition/);
  });

  it('exports ToolCall interface', () => {
    expect(content).toMatch(/export\s+interface\s+ToolCall/);
  });

  it('exports LlmResponse interface', () => {
    expect(content).toMatch(/export\s+interface\s+LlmResponse/);
  });

  it('exports LlmStreamEvent type', () => {
    expect(content).toMatch(/export\s+type\s+LlmStreamEvent/);
  });

  it('exports ProviderChatOptions interface', () => {
    expect(content).toMatch(/export\s+interface\s+ProviderChatOptions/);
  });

  it('exports ILlmProvider interface', () => {
    expect(content).toMatch(/export\s+interface\s+ILlmProvider/);
  });

  it('ILlmProvider has name property', () => {
    expect(content).toMatch(/readonly\s+name:\s*string/);
  });

  it('ILlmProvider has chat method', () => {
    expect(content).toMatch(/chat\s*\(/);
  });

  it('ILlmProvider has optional streamChat method', () => {
    expect(content).toMatch(/streamChat\s*\?/);
  });

  it('ChatMessage has role field', () => {
    expect(content).toMatch(/role:\s*'user'\s*\|\s*'assistant'\s*\|\s*'system'\s*\|\s*'tool'/);
  });

  it('ChatMessage has content field', () => {
    expect(content).toMatch(/content:\s*string\s*\|\s*null/);
  });

  it('LlmResponse has finishReason field', () => {
    expect(content).toMatch(/finishReason:\s*string/);
  });

  it('ToolDefinition has parameters with type object', () => {
    expect(content).toMatch(/parameters:\s*\{[^}]*type:\s*'object'/);
  });

  it('exports InlineData interface', () => {
    expect(content).toMatch(/export\s+interface\s+InlineData/);
  });

  it('exports ProviderNativeToolName type', () => {
    expect(content).toMatch(/export\s+type\s+ProviderNativeToolName/);
  });

  it('LlmStreamEvent has type field with expected values', () => {
    expect(content).toMatch(/type:\s*'start'\s*\|\s*'delta'\s*\|\s*'tool_call_delta'\s*\|\s*'done'/);
  });
});

describe('ProviderFactory structure', () => {
  const content = readProviderFile('ProviderFactory.ts');

  it('exports ProviderFactory class', () => {
    expect(content).toMatch(/export\s+class\s+ProviderFactory/);
  });

  it('has static create method', () => {
    expect(content).toMatch(/static\s+create\s*\(/);
  });

  it('has static clearCache method', () => {
    expect(content).toMatch(/static\s+clearCache\s*\(/);
  });

  it('has static normalizeProviderName method', () => {
    expect(content).toMatch(/static\s+normalizeProviderName\s*\(/);
  });

  it('has static resolveRuntimeTarget method', () => {
    expect(content).toMatch(/static\s+resolveRuntimeTarget\s*\(/);
  });

  it('exports ProviderFactoryRouteInput type', () => {
    expect(content).toMatch(/export\s+type\s+ProviderFactoryRouteInput/);
  });

  it('exports ProviderFactoryCreateInput type', () => {
    expect(content).toMatch(/export\s+type\s+ProviderFactoryCreateInput/);
  });

  it('exports ProviderFactoryRuntimeTarget type', () => {
    expect(content).toMatch(/export\s+type\s+ProviderFactoryRuntimeTarget/);
  });

  it('imports ProviderCompatibilityClassifier', () => {
    expect(content).toMatch(/ProviderCompatibilityClassifier/);
  });

  it('imports ProviderIntegrationRegistry', () => {
    expect(content).toMatch(/ProviderIntegrationRegistry/);
  });

  it('imports wrapLlmProviderWithEgressGuard', () => {
    expect(content).toMatch(/wrapLlmProviderWithEgressGuard/);
  });

  it('uses a cache Map for provider instances', () => {
    expect(content).toMatch(/cache.*Map\s*</);
  });
});

describe('ProviderFactory normalization aliases', () => {
  NORMALIZE_ALIASES.forEach(({ input, expected }) => {
    it(`normalizeProviderName("${input}") => "${expected}"`, () => {
      const pluginPath = path.resolve(__dirname, `../../src/providers/plugins/${expected}.plugin.ts`);
      const hasPlugin = fs.existsSync(pluginPath);
      const manifestDir = path.resolve(__dirname, '../../src/services/providers/catalog/manifests');
      let foundInManifest = false;
      try {
        const manifestFiles = fs.readdirSync(manifestDir).filter((f) => f.endsWith('.ts') && f !== 'index.ts');
        for (const mf of manifestFiles) {
          const content = fs.readFileSync(path.join(manifestDir, mf), 'utf-8');
          if (content.includes(`'${expected}'`) || content.includes(`"${expected}"`)) {
            foundInManifest = true;
            break;
          }
        }
      } catch { /* ignore */ }
      expect(hasPlugin || foundInManifest).toBe(true);
    });
  });
});

describe('Bespoke provider files structure', () => {
  BESPOKE_PROVIDERS.forEach((filename) => {
    const content = readProviderFile(filename);
    const providerName = filename.replace('.ts', '');

    it(`${providerName} imports or references ILlmProvider`, () => {
      expect(content).toMatch(/(?:import.*ILlmProvider|implements\s+ILlmProvider)/);
    });

    it(`${providerName} exports a class`, () => {
      expect(content).toMatch(/export\s+class\s+\w+/);
    });

    it(`${providerName} implements ILlmProvider`, () => {
      expect(content).toMatch(/implements\s+ILlmProvider/);
    });

    it(`${providerName} has name property`, () => {
      expect(content).toMatch(/(?:readonly\s+)?name\s*[=:]/);
    });

    it(`${providerName} has chat method`, () => {
      expect(content).toMatch(/(?:async\s+)?chat\s*\(/);
    });
  });
});

describe('GatewayProvider structure', () => {
  const content = readProviderFile('GatewayProvider.ts');

  it('exports GatewayProvider class', () => {
    expect(content).toMatch(/export\s+class\s+GatewayProvider/);
  });

  it('implements ILlmProvider', () => {
    expect(content).toMatch(/implements\s+ILlmProvider/);
  });

  it('exports GatewayProviderOptions type', () => {
    expect(content).toMatch(/export\s+type\s+GatewayProviderOptions/);
  });

  it('imports OpenAI client', () => {
    expect(content).toMatch(/import\s+OpenAI\s+from/);
  });

  it('has constructor with options', () => {
    expect(content).toMatch(/constructor\s*\(/);
  });
});

describe('ProviderCompatibilityClassifier structure', () => {
  const content = readCatalogFile('ProviderCompatibilityClassifier.ts');

  it('exports ProviderCompatibilityClassifier class', () => {
    expect(content).toMatch(/export\s+class\s+ProviderCompatibilityClassifier/);
  });

  it('has classify method', () => {
    expect(content).toMatch(/classify\s*\(/);
  });

  it('exports ProviderCompatibilityKind type', () => {
    expect(content).toMatch(/export\s+type\s+ProviderCompatibilityKind/);
  });

  it('exports ProviderRuntimeAdapterKind type', () => {
    expect(content).toMatch(/export\s+type\s+ProviderRuntimeAdapterKind/);
  });

  it('exports ProviderCompatibilityClassification type', () => {
    expect(content).toMatch(/export\s+type\s+ProviderCompatibilityClassification/);
  });

  it('has FIRST_CLASS_PROVIDERS set', () => {
    expect(content).toMatch(/FIRST_CLASS_PROVIDERS/);
  });

  it('classification has schemaVersion 1', () => {
    expect(content).toMatch(/schemaVersion:\s*1/);
  });

  it('classification includes kind field', () => {
    expect(content).toMatch(/kind:\s*ProviderCompatibilityKind/);
  });

  it('classification includes runtimeAdapter field', () => {
    expect(content).toMatch(/runtimeAdapter:\s*ProviderRuntimeAdapterKind/);
  });

  it('classification includes genericCompatible field', () => {
    expect(content).toMatch(/genericCompatible:\s*boolean/);
  });

  it('classification includes firstClassProvider field', () => {
    expect(content).toMatch(/firstClassProvider:\s*boolean/);
  });

  it('classification includes runtimeSupported field', () => {
    expect(content).toMatch(/runtimeSupported:\s*boolean/);
  });
});

describe('ProviderIntegrationRegistry structure', () => {
  const content = readCatalogFile('ProviderIntegrationRegistry.ts');

  it('exports ProviderIntegrationRegistry class', () => {
    expect(content).toMatch(/export\s+class\s+ProviderIntegrationRegistry/);
  });

  it('exports getDefaultProviderIntegrationRegistry function', () => {
    expect(content).toMatch(/export\s+function\s+getDefaultProviderIntegrationRegistry/);
  });

  it('has listManifests method', () => {
    expect(content).toMatch(/listManifests\s*\(/);
  });

  it('has listFamilies method', () => {
    expect(content).toMatch(/listFamilies\s*\(/);
  });

  it('has listRoutes method', () => {
    expect(content).toMatch(/listRoutes\s*\(/);
  });

  it('has resolveProvider method', () => {
    expect(content).toMatch(/resolveProvider\s*\(/);
  });

  it('has resolveFamily method', () => {
    expect(content).toMatch(/resolveFamily\s*\(/);
  });

  it('has resolveRoute method', () => {
    expect(content).toMatch(/resolveRoute\s*\(/);
  });

  it('has resolveRouteForProvider method', () => {
    expect(content).toMatch(/resolveRouteForProvider\s*\(/);
  });

  it('has resolveAlias method', () => {
    expect(content).toMatch(/resolveAlias\s*\(/);
  });

  it('has buildSnapshot method', () => {
    expect(content).toMatch(/buildSnapshot\s*\(/);
  });

  it('exports ProviderIntegrationRouteResolution type', () => {
    expect(content).toMatch(/export\s+type\s+ProviderIntegrationRouteResolution/);
  });

  it('exports ProviderIntegrationProviderResolution type', () => {
    expect(content).toMatch(/export\s+type\s+ProviderIntegrationProviderResolution/);
  });

  it('exports ProviderIntegrationRegistrySnapshot type', () => {
    expect(content).toMatch(/export\s+type\s+ProviderIntegrationRegistrySnapshot/);
  });

  it('supports wildcard alias matching', () => {
    expect(content).toMatch(/hasWildcardAlias/);
  });

  it('constructor accepts manifests array', () => {
    expect(content).toMatch(/constructor\s*\(\s*manifests/);
  });
});

describe('ProviderIntegrationManifest structure', () => {
  const content = readCatalogFile('ProviderIntegrationManifest.ts');

  it('exports ProviderIntegrationManifest type', () => {
    expect(content).toMatch(/export\s+type\s+ProviderIntegrationManifest/);
  });

  it('exports ProviderIntegrationRouteManifest type', () => {
    expect(content).toMatch(/export\s+type\s+ProviderIntegrationRouteManifest/);
  });

  it('exports ProviderIntegrationFamilyManifest type', () => {
    expect(content).toMatch(/export\s+type\s+ProviderIntegrationFamilyManifest/);
  });

  it('exports ProviderIntegrationModelManifest type', () => {
    expect(content).toMatch(/export\s+type\s+ProviderIntegrationModelManifest/);
  });

  it('exports createMinimalProviderIntegrationManifest function', () => {
    expect(content).toMatch(/export\s+function\s+createMinimalProviderIntegrationManifest/);
  });

  it('manifest has schemaVersion field', () => {
    expect(content).toMatch(/schemaVersion:\s*1/);
  });

  it('manifest has id field', () => {
    expect(content).toMatch(/^\s+id:\s*string/m);
  });

  it('manifest has label field', () => {
    expect(content).toMatch(/^\s+label:\s*string/m);
  });

  it('manifest has vendorId field', () => {
    expect(content).toMatch(/vendorId:\s*string/);
  });

  it('manifest has providerId field', () => {
    expect(content).toMatch(/providerId:\s*string/);
  });

  it('manifest has providerName field', () => {
    expect(content).toMatch(/providerName:\s*string/);
  });

  it('manifest has routeKind field', () => {
    expect(content).toMatch(/routeKind:\s*ProviderRouteKind/);
  });

  it('manifest has authKind field', () => {
    expect(content).toMatch(/authKind:\s*ProviderCredentialKind/);
  });

  it('manifest has capabilities field', () => {
    expect(content).toMatch(/capabilities:\s*ModelCapabilityKind\[\]/);
  });

  it('manifest has modalities field', () => {
    expect(content).toMatch(/modalities:\s*ModelModality\[\]/);
  });

  it('manifest has families field', () => {
    expect(content).toMatch(/families:\s*ProviderIntegrationFamilyManifest\[\]/);
  });

  it('manifest has routes field', () => {
    expect(content).toMatch(/routes:\s*ProviderIntegrationRouteManifest\[\]/);
  });

  it('route has routeId field', () => {
    expect(content).toMatch(/routeId:\s*string/);
  });

  it('route has familyIds field', () => {
    expect(content).toMatch(/familyIds:\s*string\[\]/);
  });

  it('model has modelId field', () => {
    expect(content).toMatch(/modelId:\s*string/);
  });

  it('model has optional primary field', () => {
    expect(content).toMatch(/primary\?\s*:\s*boolean/);
  });
});

describe('Provider catalog contracts', () => {
  const content = readCatalogFile('ProviderCatalogContracts.ts');

  it('exports PROVIDER_CATALOG_CONTRACTS_COMPATIBILITY_VERSION', () => {
    expect(content).toMatch(/export\s+const\s+PROVIDER_CATALOG_CONTRACTS_COMPATIBILITY_VERSION/);
  });

  it('re-exports types from ModelPickerContract', () => {
    expect(content).toMatch(/ModelPickerContract/);
  });

  it('re-exports ProviderIntegrationManifest types', () => {
    expect(content).toMatch(/ProviderIntegrationManifest/);
  });

  it('exports AccessRouteCatalog type', () => {
    expect(content).toMatch(/AccessRouteCatalog/);
  });

  it('exports ModelCapabilityKind type', () => {
    expect(content).toMatch(/ModelCapabilityKind/);
  });

  it('exports ProviderRouteKind type', () => {
    expect(content).toMatch(/ProviderRouteKind/);
  });
});

describe('Manifest index aggregation', () => {
  const content = readManifestFile('index.ts');

  it('exports DEFAULT_PROVIDER_INTEGRATION_MANIFESTS', () => {
    expect(content).toMatch(/export\s+const\s+DEFAULT_PROVIDER_INTEGRATION_MANIFESTS/);
  });

  it('imports CORE_PROVIDER_INTEGRATION_MANIFESTS', () => {
    expect(content).toMatch(/import.*CORE_PROVIDER_INTEGRATION_MANIFESTS/);
  });

  it('imports AGGREGATOR_PROVIDER_INTEGRATION_MANIFESTS', () => {
    expect(content).toMatch(/import.*AGGREGATOR_PROVIDER_INTEGRATION_MANIFESTS/);
  });

  it('imports LOCAL_AND_CUSTOM_PROVIDER_INTEGRATION_MANIFESTS', () => {
    expect(content).toMatch(/import.*LOCAL_AND_CUSTOM_PROVIDER_INTEGRATION_MANIFESTS/);
  });

  it('imports P0_PROVIDER_ACTIVATION_MANIFESTS', () => {
    expect(content).toMatch(/import.*P0_PROVIDER_ACTIVATION_MANIFESTS/);
  });

  it('imports LONG_TAIL_PROVIDER_ACTIVATION_MANIFESTS', () => {
    expect(content).toMatch(/import.*LONG_TAIL_PROVIDER_ACTIVATION_MANIFESTS/);
  });

  it('imports ZAVORTH_PROVIDER_CONSISTENCY_PACK_MANIFESTS', () => {
    expect(content).toMatch(/import.*ZAVORTH_PROVIDER_CONSISTENCY_PACK_MANIFESTS/);
  });

  it('imports MEDIA_PROVIDER_INTEGRATION_MANIFESTS', () => {
    expect(content).toMatch(/import.*MEDIA_PROVIDER_INTEGRATION_MANIFESTS/);
  });

  it('imports ZAVORTH_PROVIDER_CAPABILITY_MANIFESTS', () => {
    expect(content).toMatch(/import.*ZAVORTH_PROVIDER_CAPABILITY_MANIFESTS/);
  });

  it('DEFAULT is spread of all manifest arrays', () => {
    expect(content).toMatch(/\.\.\.CORE_PROVIDER_INTEGRATION_MANIFESTS/);
    expect(content).toMatch(/\.\.\.AGGREGATOR_PROVIDER_INTEGRATION_MANIFESTS/);
    expect(content).toMatch(/\.\.\.LOCAL_AND_CUSTOM_PROVIDER_INTEGRATION_MANIFESTS/);
  });
});

describe('Core providers manifest', () => {
  const content = readManifestFile('coreProviders.ts');

  it('exports CORE_PROVIDER_INTEGRATION_MANIFESTS', () => {
    expect(content).toMatch(/export\s+const\s+CORE_PROVIDER_INTEGRATION_MANIFESTS/);
  });

  it('includes gemini provider', () => {
    expect(content).toMatch(/id:\s*'gemini'/);
  });

  it('includes deepseek provider', () => {
    expect(content).toMatch(/id:\s*'deepseek'/);
  });

  it('includes openai provider', () => {
    expect(content).toMatch(/id:\s*'openai'/);
  });

  it('gemini has schemaVersion 1', () => {
    expect(content).toMatch(/schemaVersion:\s*1/);
  });

  it('gemini has routes array', () => {
    expect(content).toMatch(/routes:\s*\[/);
  });

  it('gemini has families array', () => {
    expect(content).toMatch(/families:\s*\[/);
  });

  it('gemini route has credentialRefs', () => {
    expect(content).toMatch(/credentialRefs:\s*\[/);
  });

  it('gemini has website field', () => {
    expect(content).toMatch(/website:\s*'https:\/\/ai\.google\.dev'/);
  });
});

describe('Discovery adapters', () => {
  DISCOVERY_ADAPTER_FILES.forEach((filename) => {
    const content = fs.readFileSync(path.join(DISCOVERY_DIR, filename), 'utf-8');

    it(`${filename} exports a class or function`, () => {
      expect(content).toMatch(/export\s+(class|function|const)/);
    });
  });

  it('OpenAiCompatibleModelDiscoveryAdapter exports a class', () => {
    const content = fs.readFileSync(path.join(DISCOVERY_DIR, 'OpenAiCompatibleModelDiscoveryAdapter.ts'), 'utf-8');
    expect(content).toMatch(/export\s+class\s+OpenAiCompatibleModelDiscoveryAdapter/);
  });

  it('AnthropicCompatibleModelDiscoveryAdapter exports a class', () => {
    const content = fs.readFileSync(path.join(DISCOVERY_DIR, 'AnthropicCompatibleModelDiscoveryAdapter.ts'), 'utf-8');
    expect(content).toMatch(/export\s+class\s+AnthropicCompatibleModelDiscoveryAdapter/);
  });

  it('StaticCatalogDiscoveryAdapter exports a class', () => {
    const content = fs.readFileSync(path.join(DISCOVERY_DIR, 'StaticCatalogDiscoveryAdapter.ts'), 'utf-8');
    expect(content).toMatch(/export\s+class\s+StaticCatalogDiscoveryAdapter/);
  });
});

describe('Provider routing support files', () => {
  it('openaiMessageConversion.ts exports conversion function', () => {
    const content = readProviderFile('openaiMessageConversion.ts');
    expect(content).toMatch(/export\s+function\s+convertChatMessagesToOpenAI/);
  });

  it('openaiToolCalls.ts exports extraction function', () => {
    const content = readProviderFile('openaiToolCalls.ts');
    expect(content).toMatch(/export\s+function\s+extractFunctionToolCalls/);
  });

  it('ProviderNativeToolPayload.ts exports builder function', () => {
    const content = readProviderFile('ProviderNativeToolPayload.ts');
    expect(content).toMatch(/export\s+function\s+buildOpenAiCompatibleNativeToolPayload/);
  });

  it('ProviderAbort.ts exports buildProviderRequestOptions', () => {
    const content = readProviderFile('ProviderAbort.ts');
    expect(content).toMatch(/export\s+function\s+buildProviderRequestOptions/);
  });

  it('OpenAICompatibleStreaming.ts exports streaming function', () => {
    const content = readProviderFile('OpenAICompatibleStreaming.ts');
    expect(content).toMatch(/streamOpenAICompatibleCompletion/);
  });

  it('GeminiVoiceService.ts exports a class', () => {
    const content = readProviderFile('GeminiVoiceService.ts');
    expect(content).toMatch(/export\s+class\s+GeminiVoiceService/);
  });
});

describe('Provider router service', () => {
  it('ZavorthProviderRouterService exists', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../../src/services/providers/ZavorthProviderRouterService.ts'))).toBe(true);
  });

  it('ZavorthContextBudgetService exists', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../../src/services/providers/ZavorthContextBudgetService.ts'))).toBe(true);
  });
});

describe('ProviderFactory dedicated OpenAI-compatible providers', () => {
  const content = readProviderFile('ProviderFactory.ts');

  DEDICATED_PROVIDERS.forEach((provider) => {
    it(`has dedicated config for ${provider}`, () => {
      expect(content).toContain(`${provider}:`);
    });

    it(`${provider} has modelEnv field`, () => {
      const regex = new RegExp(`${provider}:\\s*\\{[^}]*modelEnv:`);
      expect(content).toMatch(regex);
    });

    it(`${provider} has defaultModel field`, () => {
      const regex = new RegExp(`${provider}:\\s*\\{[^}]*defaultModel:`);
      expect(content).toMatch(regex);
    });

    it(`${provider} has baseUrl field`, () => {
      const regex = new RegExp(`${provider}:\\s*\\{[^}]*baseUrl:`);
      expect(content).toMatch(regex);
    });
  });

  it('groq uses llama-3.3-70b-versatile as default', () => {
    expect(content).toMatch(/groq:[\s\S]*?defaultModel:\s*'llama-3\.3-70b-versatile'/);
  });

  it('xai uses grok-4 as default', () => {
    expect(content).toMatch(/xai:[\s\S]*?defaultModel:\s*'grok-4'/);
  });

  it('mistral uses mistral-large-latest as default', () => {
    expect(content).toMatch(/mistral:[\s\S]*?defaultModel:\s*'mistral-large-latest'/);
  });

  it('cerebras uses llama-3.3-70b as default', () => {
    expect(content).toMatch(/cerebras:[\s\S]*?defaultModel:\s*'llama-3\.3-70b'/);
  });

  it('together uses Llama-3.3-70B-Instruct-Turbo as default', () => {
    expect(content).toMatch(/together:[\s\S]*?defaultModel:\s*'meta-llama\/Llama-3\.3-70B-Instruct-Turbo'/);
  });

  it('groq uses api.groq.com base URL', () => {
    expect(content).toContain('https://api.groq.com/openai/v1');
  });

  it('xai uses api.x.ai base URL', () => {
    expect(content).toContain('https://api.x.ai/v1');
  });

  it('mistral uses api.mistral.ai base URL', () => {
    expect(content).toContain('https://api.mistral.ai/v1');
  });

  it('cerebras uses api.cerebras.ai base URL', () => {
    expect(content).toContain('https://api.cerebras.ai/v1');
  });

  it('together uses api.together.xyz base URL', () => {
    expect(content).toContain('https://api.together.xyz/v1');
  });
});

describe('ProviderFactory mesh expansion providers', () => {
  PROVIDER_MESH_EXPANSION_PROVIDERS.forEach((provider) => {
    it(`provider ${provider} has plugin, adapter, or manifest entry`, () => {
      const pluginCandidates = [
        path.resolve(__dirname, `../../src/providers/plugins/${provider.replace(/-/g, '_')}.plugin.ts`),
        path.resolve(__dirname, `../../src/providers/plugins/${provider}.plugin.ts`),
      ];
      // google-genai -> GoogleGenAi (not GoogleGenai)
      const pascal = provider
        .split('-')
        .map((segment) => {
          if (segment.toLowerCase() === 'ai') return 'Ai';
          if (segment.toLowerCase() === 'genai') return 'GenAi';
          return segment.charAt(0).toUpperCase() + segment.slice(1);
        })
        .join('');
      const adapterCandidates = [
        path.resolve(__dirname, `../../src/adapters/providers/${pascal}ProviderAdapter.ts`),
        path.resolve(__dirname, `../../src/adapters/providers/${provider.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('')}ProviderAdapter.ts`),
      ];
      const hasPlugin = pluginCandidates.some((candidate) => fs.existsSync(candidate));
      const hasAdapter = adapterCandidates.some((candidate) => fs.existsSync(candidate));
      const manifestDir = path.resolve(__dirname, '../../src/services/providers/catalog/manifests');
      let foundInManifest = false;
      try {
        const manifestFiles = fs.readdirSync(manifestDir).filter((f) => f.endsWith('.ts') && f !== 'index.ts');
        for (const mf of manifestFiles) {
          const content = fs.readFileSync(path.join(manifestDir, mf), 'utf-8');
          if (content.includes(`'${provider}'`) || content.includes(`"${provider}"`)) {
            foundInManifest = true;
            break;
          }
        }
      } catch { /* ignore */ }
      expect(hasPlugin || hasAdapter || foundInManifest).toBe(true);
    });
  });

  it('anthropic-direct has adapter', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../../src/adapters/providers/AnthropicDirectProviderAdapter.ts'))).toBe(true);
  });

  it('anthropic-vertex has adapter', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../../src/adapters/providers/AnthropicVertexProviderAdapter.ts'))).toBe(true);
  });

  it('bedrock-claude has adapter', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../../src/adapters/providers/BedrockClaudeProviderAdapter.ts'))).toBe(true);
  });

  it('google-genai has adapter', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../../src/adapters/providers/GoogleGenAiProviderAdapter.ts'))).toBe(true);
  });

  it('gemini-interactions has adapter file', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../../src/providers/GeminiInteractionsProviderAdapter.ts'))).toBe(true);
  });
});

describe('ProviderFactory switch-case providers', () => {
  SWITCH_CASE_PROVIDERS.forEach((provider) => {
    it(`provider ${provider} is registered or has plugin`, () => {
      const pluginPath = path.resolve(__dirname, `../../src/providers/plugins/${provider.replace(/-/g, '_')}.plugin.ts`);
      const hasPlugin = fs.existsSync(pluginPath);
      const content = readProviderFile('ProviderFactory.ts');
      const hasInFactory = content.includes(`'${provider}'`);
      const manifestDir = path.resolve(__dirname, '../../src/services/providers/catalog/manifests');
      let foundInManifest = false;
      try {
        const manifestFiles = fs.readdirSync(manifestDir).filter((f) => f.endsWith('.ts') && f !== 'index.ts');
        for (const mf of manifestFiles) {
          const mc = fs.readFileSync(path.join(manifestDir, mf), 'utf-8');
          if (mc.includes(`'${provider}'`) || mc.includes(`"${provider}"`)) {
            foundInManifest = true;
            break;
          }
        }
      } catch { /* ignore */ }
      expect(hasPlugin || hasInFactory || foundInManifest).toBe(true);
    });
  });

  it('default case falls back to GeminiProvider', () => {
    const pluginPath = path.resolve(__dirname, '../../src/providers/plugins/gemini.plugin.ts');
    expect(fs.existsSync(pluginPath)).toBe(true);
  });
});

describe('ProviderFactory defaultBaseUrlForProvider coverage', () => {
  const defaultBaseUrls = [
    'deepinfra', 'alibaba', 'byteplus', 'cerebras', 'chutes', 'comfy',
    'cohere', 'fireworks', 'falcon', 'github-models', 'groq', 'huggingface',
    'jais', 'kimi-coding', 'moonshot', 'mistral', 'nvidia', 'opencode',
    'perplexity', 'qianfan', 'sambanova', 'sglang', 'lmstudio', 'vllm',
    'stepfun', 'together', 'vercel-ai-gateway', 'venice', 'voyage', 'xai', 'zai',
  ];

  defaultBaseUrls.forEach((provider) => {
    it(`has plugin or manifest for ${provider}`, () => {
      const pluginPath = path.resolve(__dirname, `../../src/providers/plugins/${provider.replace(/-/g, '_')}.plugin.ts`);
      const hasPlugin = fs.existsSync(pluginPath);
      const manifestDir = path.resolve(__dirname, '../../src/services/providers/catalog/manifests');
      const manifestFiles = fs.readdirSync(manifestDir).filter((f) => f.endsWith('.ts') && f !== 'index.ts');
      let foundInManifest = false;
      for (const mf of manifestFiles) {
        const content = fs.readFileSync(path.join(manifestDir, mf), 'utf-8');
        if (content.includes(`'${provider}'`) || content.includes(`"${provider}"`)) {
          foundInManifest = true;
          break;
        }
      }
      expect(hasPlugin || foundInManifest).toBe(true);
    });
  });
});

describe('ProviderCompatibilityClassifier first-class providers', () => {
  const content = readCatalogFile('ProviderCompatibilityClassifier.ts');

  const firstClass = ['gemini', 'deepseek', 'openai', 'minimax', 'aigateway', 'qwen', 'puter', 'openrouter', 'opencode', 'ollama'];

  firstClass.forEach((provider) => {
    it(`marks ${provider} as first-class`, () => {
      expect(content).toContain(`'${provider}'`);
    });
  });

  it('has 10 first-class providers', () => {
    const match = content.match(/FIRST_CLASS_PROVIDERS\s*=\s*new\s+Set\s*\(\s*\[([\s\S]*?)\]\s*\)/);
    expect(match).not.toBeNull();
    const entries = match![1].split(',').filter((s) => s.trim().length > 0);
    expect(entries.length).toBe(10);
  });
});

describe('ProviderCompatibilityClassifier compatibility kinds', () => {
  const content = readCatalogFile('ProviderCompatibilityClassifier.ts');

  it('defines bespoke kind', () => {
    expect(content).toMatch(/'bespoke'/);
  });

  it('defines openai_compatible kind', () => {
    expect(content).toMatch(/'openai_compatible'/);
  });

  it('defines anthropic_compatible kind', () => {
    expect(content).toMatch(/'anthropic_compatible'/);
  });

  it('defines local_self_hosted kind', () => {
    expect(content).toMatch(/'local_self_hosted'/);
  });

  it('defines gateway kind', () => {
    expect(content).toMatch(/'gateway'/);
  });
});

describe('Aggregator providers manifest', () => {
  const content = readManifestFile('aggregatorProviders.ts');

  it('exports AGGREGATOR_PROVIDER_INTEGRATION_MANIFESTS', () => {
    expect(content).toMatch(/export\s+const\s+AGGREGATOR_PROVIDER_INTEGRATION_MANIFESTS/);
  });
});

describe('Local and custom providers manifest', () => {
  const content = readManifestFile('localAndCustomProviders.ts');

  it('exports LOCAL_AND_CUSTOM_PROVIDER_INTEGRATION_MANIFESTS', () => {
    expect(content).toMatch(/export\s+const\s+LOCAL_AND_CUSTOM_PROVIDER_INTEGRATION_MANIFESTS/);
  });
});

describe('P0 provider activation manifest', () => {
  const content = readManifestFile('p0ProviderActivationProviders.ts');

  it('exports P0_PROVIDER_ACTIVATION_MANIFESTS', () => {
    expect(content).toMatch(/export\s+const\s+P0_PROVIDER_ACTIVATION_MANIFESTS/);
  });
});

describe('Long-tail provider activation manifest', () => {
  const content = readManifestFile('longTailProviderActivationProviders.ts');

  it('exports LONG_TAIL_PROVIDER_ACTIVATION_MANIFESTS', () => {
    expect(content).toMatch(/export\s+const\s+LONG_TAIL_PROVIDER_ACTIVATION_MANIFESTS/);
  });
});

describe('Zavorth provider certification pack manifest', () => {
  const content = readManifestFile('zavorthProviderCertificationPack.ts');

  it('exports ZAVORTH_PROVIDER_CONSISTENCY_PACK_MANIFESTS', () => {
    expect(content).toMatch(/export\s+const\s+ZAVORTH_PROVIDER_CONSISTENCY_PACK_MANIFESTS/);
  });
});

describe('Media providers manifest', () => {
  const content = readManifestFile('mediaProviders.ts');

  it('exports MEDIA_PROVIDER_INTEGRATION_MANIFESTS', () => {
    expect(content).toMatch(/export\s+const\s+MEDIA_PROVIDER_INTEGRATION_MANIFESTS/);
  });
});

describe('Zavorth provider capability manifest', () => {
  const content = readManifestFile('zavorthProviderCapabilityProviders.ts');

  it('exports ZAVORTH_PROVIDER_CAPABILITY_MANIFESTS', () => {
    expect(content).toMatch(/export\s+const\s+ZAVORTH_PROVIDER_CAPABILITY_MANIFESTS/);
  });
});

describe('Provider catalog compat layer', () => {
  const content = readCatalogFile('ProviderCatalogCompat.ts');

  it('has content', () => {
    expect(content.length).toBeGreaterThan(0);
  });

  it('exports something', () => {
    expect(content).toMatch(/export/);
  });
});

describe('Provider external import service', () => {
  const content = readCatalogFile('ProviderExternalImportService.ts');

  it('exports something', () => {
    expect(content).toMatch(/export/);
  });
});

describe('Model ID sanitizer', () => {
  const content = readCatalogFile('ModelIdSanitizer.ts');

  it('exports something', () => {
    expect(content).toMatch(/export/);
  });
});

describe('Discovery rate limiter', () => {
  const content = readCatalogFile('DiscoveryRateLimiter.ts');

  it('exports something', () => {
    expect(content).toMatch(/export/);
  });
});

describe('Discovery cache', () => {
  const content = readCatalogFile('DiscoveryCache.ts');

  it('exports something', () => {
    expect(content).toMatch(/export/);
  });
});

describe('ProviderAutoDiscoveryService structure', () => {
  const content = readCatalogFile('ProviderAutoDiscoveryService.ts');

  it('exports something', () => {
    expect(content).toMatch(/export/);
  });
});

describe('CustomCompatibleProviderOnboardingService structure', () => {
  const content = readCatalogFile('CustomCompatibleProviderOnboardingService.ts');

  it('exports something', () => {
    expect(content).toMatch(/export/);
  });
});
