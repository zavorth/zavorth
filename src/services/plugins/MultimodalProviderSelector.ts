import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export interface MultimodalProvider {
  id: string;
  name: string;
  capabilities: ('vision' | 'audio' | 'video' | 'text')[];
  apiKeyEnv: string;
  baseUrl: string;
  priority: number;
  maxFileSizeMB: number;
}

const PROVIDERS: MultimodalProvider[] = [
  { id: 'gemini', name: 'Google Gemini', capabilities: ['vision', 'audio', 'video', 'text'], apiKeyEnv: 'GEMINI_API_KEY', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', priority: 1, maxFileSizeMB: 20 },
  { id: 'openai', name: 'OpenAI', capabilities: ['vision', 'audio', 'text'], apiKeyEnv: 'OPENAI_API_KEY', baseUrl: 'https://api.openai.com/v1', priority: 2, maxFileSizeMB: 25 },
  { id: 'anthropic', name: 'Anthropic Claude', capabilities: ['vision', 'text'], apiKeyEnv: 'ANTHROPIC_API_KEY', baseUrl: 'https://api.anthropic.com/v1', priority: 3, maxFileSizeMB: 5 },
  { id: 'deepgram', name: 'Deepgram', capabilities: ['audio'], apiKeyEnv: 'DEEPGRAM_API_KEY', baseUrl: 'https://api.deepgram.com/v1', priority: 4, maxFileSizeMB: 100 },
];

export function getAvailableProviders(capability: 'vision' | 'audio' | 'video' | 'text'): MultimodalProvider[] {
  return PROVIDERS
    .filter((p) => p.capabilities.includes(capability) && process.env[p.apiKeyEnv])
    .sort((a, b) => a.priority - b.priority);
}

export function getBestProvider(capability: 'vision' | 'audio' | 'video' | 'text'): MultimodalProvider | null {
  const available = getAvailableProviders(capability);
  return available[0] || null;
}

export function getProviderById(id: string): MultimodalProvider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function listProviders(): string {
  const lines: string[] = ['Multimodal Providers:'];
  for (const p of PROVIDERS) {
    const hasKey = !!process.env[p.apiKeyEnv];
    const icon = hasKey ? '✅' : '❌';
    lines.push(`  ${icon} ${p.id}: ${p.name} [${p.capabilities.join(', ')}] (priority: ${p.priority})`);
  }
  return lines.join('\n');
}

export function getSetupInstructions(): string {
  const lines: string[] = [
    '=== Multimodal Provider Setup ===',
    '',
    'To enable multimodal capabilities, set these environment variables:',
    '',
  ];

  for (const p of PROVIDERS) {
    const hasKey = !!process.env[p.apiKeyEnv];
    const status = hasKey ? '✅ Configured' : '❌ Not configured';
    lines.push(`${p.name} (${p.id}):`);
    lines.push(`  Env var: ${p.apiKeyEnv}`);
    lines.push(`  Status: ${status}`);
    lines.push(`  Capabilities: ${p.capabilities.join(', ')}`);
    lines.push(`  Get key: ${getApiKeyUrl(p.id)}`);
    lines.push('');
  }

  lines.push('Priority order (best first):');
  lines.push('  Vision: Gemini → OpenAI → Anthropic');
  lines.push('  Audio: Gemini → OpenAI → Deepgram');
  lines.push('  Video: Gemini');
  lines.push('');
  lines.push('The agent automatically uses the best available provider.');

  return lines.join('\n');
}

function getApiKeyUrl(providerId: string): string {
  const urls: Record<string, string> = {
    gemini: 'https://aistudio.google.com/app/apikey',
    openai: 'https://platform.openai.com/api-keys',
    anthropic: 'https://console.anthropic.com/settings/keys',
    deepgram: 'https://console.deepgram.com/api-keys',
  };
  return urls[providerId] || 'Check provider docs';
}

export function getQuickSetup(): string {
  const lines: string[] = [
    '=== Quick Setup (Recommended) ===',
    '',
    'For full multimodal support, configure these 2 providers:',
    '',
    '1. Gemini (free tier available):',
    '   export GEMINI_API_KEY=your_key_here',
    '   Get key: https://aistudio.google.com/app/apikey',
    '',
    '2. OpenAI (for Whisper audio):',
    '   export OPENAI_API_KEY=your_key_here',
    '   Get key: https://platform.openai.com/api-keys',
    '',
    'That\'s it! The agent will automatically use the best available provider.',
  ];
  return lines.join('\n');
}

export async function callVisionProvider(
  provider: MultimodalProvider,
  imageBase64: string,
  mimeType: string,
  prompt: string,
  apiKey: string,
): Promise<string> {
  const { execFileSync } = await import('child_process');

  switch (provider.id) {
    case 'gemini': {
      const payload = JSON.stringify({
        contents: [{ parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: imageBase64.slice(0, 4 * 1024 * 1024) } },
        ] }],
      });
      const tmpFile = path.join(require('os').tmpdir(), `vision_gemini_${Date.now()}.json`);
      fs.writeFileSync(tmpFile, payload);
      try {
        const result = execFileSync('curl', [
          '-s', '-X', 'POST', '-H', 'Content-Type: application/json',
          '-H', `x-goog-api-key: ${apiKey}`,
          '-d', `@${tmpFile}`,
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
        ], { timeout: 60000 }).toString();
        const parsed = JSON.parse(result);
        return parsed.candidates?.[0]?.content?.parts?.[0]?.text || 'No analysis available.';
      } finally { try { fs.unlinkSync(tmpFile); } catch (error) { /* ignore */ logger.warn('[Multimodal  Selector] JSON parse failed', error); } }
    }
    case 'openai': {
      const payload = JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64.slice(0, 4 * 1024 * 1024)}` } },
        ] }],
        max_tokens: 2048,
      });
      const tmpFile = path.join(require('os').tmpdir(), `vision_openai_${Date.now()}.json`);
      fs.writeFileSync(tmpFile, payload);
      try {
        const result = execFileSync('curl', [
          '-s', '-X', 'POST', '-H', `Authorization: Bearer ${apiKey}`, '-H', 'Content-Type: application/json',
          '-d', `@${tmpFile}`, 'https://api.openai.com/v1/chat/completions',
        ], { timeout: 60000 }).toString();
        const parsed = JSON.parse(result);
        return parsed.choices?.[0]?.message?.content || 'No analysis available.';
      } finally { try { fs.unlinkSync(tmpFile); } catch (error) { /* ignore */ logger.warn('[Multimodal  Selector] JSON parse failed', error); } }
    }
    case 'anthropic': {
      const payload = JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64.slice(0, 4 * 1024 * 1024) } },
          { type: 'text', text: prompt },
        ] }],
      });
      const tmpFile = path.join(require('os').tmpdir(), `vision_anthropic_${Date.now()}.json`);
      fs.writeFileSync(tmpFile, payload);
      try {
        const result = execFileSync('curl', [
          '-s', '-X', 'POST', '-H', `x-api-key: ${apiKey}`, '-H', 'anthropic-version: 2023-06-01',
          '-H', 'Content-Type: application/json', '-d', `@${tmpFile}`, 'https://api.anthropic.com/v1/messages',
        ], { timeout: 60000 }).toString();
        const parsed = JSON.parse(result);
        return parsed.content?.[0]?.text || 'No analysis available.';
      } finally { try { fs.unlinkSync(tmpFile); } catch (error) { /* ignore */ logger.warn('[Multimodal  Selector] JSON parse failed', error); } }
    }
    default:
      throw new Error(`Provider "${provider.id}" not supported for vision.`);
  }
}

export async function callAudioProvider(
  provider: MultimodalProvider,
  audioPath: string,
  language: string,
  apiKey: string,
): Promise<string> {
  const { execFileSync } = await import('child_process');

  switch (provider.id) {
    case 'openai': {
      const langParam = language !== 'auto' ? `-F language=${language}` : '';
      const result = execFileSync('curl', [
        '-s', '-X', 'POST', '-H', `Authorization: Bearer ${apiKey}`,
        '-F', `file=@${audioPath}`, '-F', 'model=whisper-1',
        langParam, '-F', 'response_format=text',
      ].filter(Boolean), { timeout: 60000 }).toString();
      return result;
    }
    case 'deepgram': {
      const lang = language !== 'auto' ? language : 'en';
      const result = execFileSync('curl', [
        '-s', '-X', 'POST', '-H', `Authorization: Token ${apiKey}`,
        '-F', `file=@${audioPath}`, '-F', 'model=nova-2', `-F language=${lang}`,
      ], { timeout: 60000 }).toString();
      const parsed = JSON.parse(result);
      return parsed.results?.channels?.[0]?.alternatives?.[0]?.transcript || result;
    }
    case 'gemini': {
      const audioBase64 = fs.readFileSync(audioPath).toString('base64');
      const payload = JSON.stringify({
        contents: [{ parts: [
          { text: `Transcribe this audio. Language: ${language || 'auto-detect'}` },
          { inline_data: { mime_type: 'audio/mpeg', data: audioBase64.slice(0, 4 * 1024 * 1024) } },
        ] }],
      });
      const tmpFile = path.join(require('os').tmpdir(), `stt_gemini_${Date.now()}.json`);
      fs.writeFileSync(tmpFile, payload);
      try {
        const result = execFileSync('curl', [
          '-s', '-X', 'POST', '-H', 'Content-Type: application/json',
          '-d', `@${tmpFile}`,
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        ], { timeout: 60000 }).toString();
        const parsed = JSON.parse(result);
        return parsed.candidates?.[0]?.content?.parts?.[0]?.text || 'No transcription available.';
      } finally { try { fs.unlinkSync(tmpFile); } catch (error) { /* ignore */ logger.warn('[Multimodal  Selector] JSON parse failed', error); } }
    }
    default:
      throw new Error(`Provider "${provider.id}" not supported for audio.`);
  }
}
