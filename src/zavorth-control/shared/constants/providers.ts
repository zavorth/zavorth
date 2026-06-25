import { validateProviders } from "../validation/providerSchema";
import { APIKEY_PROVIDERS } from "./providers/apiKeyProviders";
import { FREE_PROVIDERS } from "./providers/freeProviders";
import { OAUTH_PROVIDERS } from "./providers/oauthProviders";

export {
  FREE_APIKEY_PROVIDER_IDS,
  FREE_PROVIDERS,
  supportsApiKeyOnFreeProvider,
} from "./providers/freeProviders";
export { OAUTH_PROVIDERS } from "./providers/oauthProviders";
export { APIKEY_PROVIDERS } from "./providers/apiKeyProviders";
export {
  AI_PROVIDERS,
  ALIAS_TO_ID,
  ANTHROPIC_COMPATIBLE_PREFIX,
  AUTH_METHODS,
  CLAUDE_CODE_COMPATIBLE_PREFIX,
  getProviderAlias,
  getProviderByAlias,
  ID_TO_ALIAS,
  isAnthropicCompatibleProvider,
  isClaudeCodeCompatibleProvider,
  isOpenAICompatibleProvider,
  OPENAI_COMPATIBLE_PREFIX,
  resolveProviderId,
  UPSTREAM_PROXY_PROVIDERS,
  USAGE_SUPPORTED_PROVIDERS,
} from "./providers/providerRegistry";

validateProviders(FREE_PROVIDERS, "FREE_PROVIDERS");
validateProviders(OAUTH_PROVIDERS, "OAUTH_PROVIDERS");
validateProviders(APIKEY_PROVIDERS, "APIKEY_PROVIDERS");
