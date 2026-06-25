import { APIKEY_CORE_PROVIDERS } from "./apiKeyCoreProviders";
import { APIKEY_ECOSYSTEM_PROVIDERS } from "./apiKeyEcosystemProviders";
import { APIKEY_MEDIA_PROVIDERS } from "./apiKeyMediaProviders";

export const APIKEY_PROVIDERS = {
  ...APIKEY_CORE_PROVIDERS,
  ...APIKEY_MEDIA_PROVIDERS,
  ...APIKEY_ECOSYSTEM_PROVIDERS,
};
