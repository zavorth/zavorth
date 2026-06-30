import { GatewayProvider } from '../GatewayProvider.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const oraclePlugin: ProviderPlugin = {
  manifest: {
    name: 'oracle',
    aliases: ['oci-generative-ai', 'oci-generativeai', 'oracle-cloud-ai'],
    description: 'Oracle Cloud Infrastructure Generative AI',
    authType: 'api_key',
    envVars: ['ORACLE_AI_API_KEY', 'ORACLE_AI_COMPARTMENT_ID'],
    baseUrl: 'https://inference.generativeai.us-ashburn-1.oci.oraclecloud.com/20231130/actions/chatCompletions',
    defaultModel: 'meta-llama-3.1-405b-instruct',
  },
  create: (target) => new GatewayProvider({
    name: 'oracle',
    baseURL: target.baseUrl || 'https://inference.generativeai.us-ashburn-1.oci.oraclecloud.com/20231130/actions/chatCompletions',
    apiKey: target.apiKey || process.env.ORACLE_AI_API_KEY || 'oracle-api-key',
    modelName: target.modelName,
  }),
};

export default oraclePlugin;
