import type { ILlmProvider } from '../ILlmProvider.js';
import type { ProviderFactoryRuntimeTarget } from '../ProviderFactory.js';

export interface ProviderPluginManifest {
  name: string;
  aliases?: string[];
  description?: string;
  envVars?: string[];
  baseUrl?: string;
  authType?: 'api_key' | 'oauth' | 'aws_credentials' | 'none';
  defaultModel?: string;
}

export type ProviderPluginFactory = (target: ProviderFactoryRuntimeTarget) => ILlmProvider;

export interface ProviderPlugin {
  manifest: ProviderPluginManifest;
  create: ProviderPluginFactory;
}
