import { registerPlugin, registerBatch } from './PluginLoader.js';
import type { ProviderPlugin, ProviderPluginManifest, ProviderPluginFactory } from './ProviderPluginManifest.js';

export type { ProviderPlugin, ProviderPluginManifest, ProviderPluginFactory };
export { registerPlugin, registerBatch } from './PluginLoader.js';

import gemini from './gemini.plugin.js';
import deepseek from './deepseek.plugin.js';
import openai from './openai.plugin.js';
import groq from './groq.plugin.js';
import xai from './xai.plugin.js';
import mistral from './mistral.plugin.js';
import cerebras from './cerebras.plugin.js';
import together from './together.plugin.js';
import openrouter from './openrouter.plugin.js';
import minimax from './minimax.plugin.js';
import qwen from './qwen.plugin.js';
import opencode from './opencode.plugin.js';
import anthropicDirect from './anthropic-direct.plugin.js';
import anthropicVertex from './anthropic-vertex.plugin.js';
import bedrockClaude from './bedrock-claude.plugin.js';
import googleGenai from './google-genai.plugin.js';
import geminiInteractions from './gemini-interactions.plugin.js';
import aigateway from './aigateway.plugin.js';
import ollama from './ollama.plugin.js';
import lmstudio from './lmstudio.plugin.js';
import nous from './nous.plugin.js';
import novita from './novita.plugin.js';
import arcee from './arcee.plugin.js';
import gmi from './gmi.plugin.js';
import kilocode from './kilocode.plugin.js';
import xiaomi from './xiaomi.plugin.js';
import replicate from './replicate.plugin.js';
import watsonx from './watsonx.plugin.js';
import oracle from './oracle.plugin.js';
import samsung from './samsung.plugin.js';
import apple from './apple.plugin.js';

const builtinPlugins: ProviderPlugin[] = [
  gemini, deepseek, openai, groq, xai, mistral, cerebras, together,
  openrouter, minimax, qwen, opencode, anthropicDirect, anthropicVertex,
  bedrockClaude, googleGenai, geminiInteractions, aigateway, ollama,
  lmstudio, nous, novita, arcee, gmi, kilocode, xiaomi, replicate, watsonx,
  oracle, samsung, apple,
];

registerBatch(builtinPlugins);
