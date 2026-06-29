export type ModelOption = {
  id: string;
  family: string;
  label: string;
  tone: string;
  connected?: boolean;
};

export const modelFamilies: Array<{
  name: string;
  models: ModelOption[];
}> = [
  {
    name: 'OpenAI',
    models: [
      {
        id: 'openai:gpt-5',
        family: 'OpenAI',
        label: 'GPT-5',
        tone: 'deep',
        connected: true,
      },
      {
        id: 'openai:gpt-4.1',
        family: 'OpenAI',
        label: 'GPT-4.1',
        tone: 'general',
        connected: false,
      },
      {
        id: 'openai:o3',
        family: 'OpenAI',
        label: 'o3',
        tone: 'reasoning',
        connected: false,
      },
    ],
  },
  {
    name: 'Anthropic',
    models: [
      {
        id: 'anthropic:claude-sonnet',
        family: 'Anthropic',
        label: 'Claude Sonnet',
        tone: 'balanced',
        connected: true,
      },
      {
        id: 'anthropic:claude-opus',
        family: 'Anthropic',
        label: 'Claude Opus',
        tone: 'deep',
        connected: false,
      },
    ],
  },
  {
    name: 'Google',
    models: [
      {
        id: 'google:gemini-pro',
        family: 'Google',
        label: 'Gemini Pro',
        tone: 'multimodal',
        connected: false,
      },
      {
        id: 'google:gemini-flash',
        family: 'Google',
        label: 'Gemini Flash',
        tone: 'fast',
        connected: false,
      },
    ],
  },
  {
    name: 'Local',
    models: [
      {
        id: 'local:ollama',
        family: 'Local',
        label: 'Ollama Local',
        tone: 'private',
        connected: false,
      },
    ],
  },
];

export const modelOptions = modelFamilies.flatMap(family => family.models);
