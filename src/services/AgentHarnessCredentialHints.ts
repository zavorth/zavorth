/**
 * P1: clear, non-secret credential / readiness hints for agent surfaces.
 * Values are never returned — only presence and setup tips.
 */

export type CredentialHint = {
  id: string;
  ok: boolean;
  present: boolean;
  message: string;
  setup?: string[];
};

const PROVIDER_CHECKS: Array<{ id: string; keys: string[]; setup: string[] }> = [
  {
    id: 'openai',
    keys: ['OPENAI_API_KEY'],
    setup: ['export OPENAI_API_KEY=...', 'optional: OPENAI_BASE_URL'],
  },
  {
    id: 'anthropic',
    keys: ['ANTHROPIC_API_KEY'],
    setup: ['export ANTHROPIC_API_KEY=...'],
  },
  {
    id: 'xai',
    keys: ['XAI_API_KEY', 'GROK_API_KEY'],
    setup: ['export XAI_API_KEY=...'],
  },
  {
    id: 'gemini',
    keys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    setup: ['export GEMINI_API_KEY=...'],
  },
];

const CHANNEL_CHECKS: Array<{ id: string; keys: string[]; setup: string[] }> = [
  {
    id: 'telegram',
    keys: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_TOKEN'],
    setup: ['export TELEGRAM_BOT_TOKEN=...'],
  },
  {
    id: 'discord',
    keys: ['DISCORD_BOT_TOKEN'],
    setup: ['export DISCORD_BOT_TOKEN=...'],
  },
  {
    id: 'whatsapp',
    keys: ['WHATSAPP_TOKEN', 'WHATSAPP_CLOUD_TOKEN', 'META_WHATSAPP_TOKEN'],
    setup: ['export WHATSAPP_TOKEN=... and WHATSAPP_PHONE_NUMBER_ID=...'],
  },
];

function anyKeyPresent(keys: string[]): boolean {
  return keys.some((key) => Boolean(String(process.env[key] || '').trim()));
}

export function buildProviderCredentialHints(): CredentialHint[] {
  return PROVIDER_CHECKS.map((check) => {
    const present = anyKeyPresent(check.keys);
    return {
      id: check.id,
      ok: present,
      present,
      message: present
        ? `${check.id} credentials present (values not shown).`
        : `${check.id} credentials missing — LLM/provider plugins will soft-fail until configured.`,
      setup: present ? undefined : check.setup,
    };
  });
}

export function buildChannelCredentialHints(): CredentialHint[] {
  return CHANNEL_CHECKS.map((check) => {
    const present = anyKeyPresent(check.keys);
    return {
      id: check.id,
      ok: present,
      present,
      message: present
        ? `${check.id} token present (values not shown).`
        : `${check.id} not configured — channel send will soft-fail until a token is set.`,
      setup: present ? undefined : check.setup,
    };
  });
}

/**
 * Presence-only skill trust + tool exposure profile (product surface).
 * Never serializes secret values.
 */
export function buildSkillWorkerSurfaceHints(): CredentialHint[] {
  const trustProfile = String(process.env.ZAVORTH_SKILL_TRUST_PROFILE || 'daily').trim() || 'daily';
  const exposure =
    String(process.env.ZAVORTH_TOOL_EXPOSURE_PROFILE || 'daily-ops').trim() || 'daily-ops';
  return [
    {
      id: 'skill-trust-profile',
      ok: true,
      present: true,
      message: `Skill trust profile: ${trustProfile} (safe|daily|power). Owner-trusted domains are optional; no competitor brand allowlists.`,
      setup: [
        'export ZAVORTH_SKILL_TRUST_PROFILE=daily',
        'zavorth skill trust',
        'zavorth skill trust add domain github.com/my-org/',
      ],
    },
    {
      id: 'tool-exposure-profile',
      ok: true,
      present: true,
      message: `Tool exposure profile: ${exposure}. Prefer daily-ops so skill marketplace + agent_manager stay visible.`,
      setup: [
        'export ZAVORTH_TOOL_EXPOSURE_PROFILE=daily-ops',
        'Tools: zavorth_skill_marketplace, agent_manager, zavorth_action, plugin_suggest',
      ],
    },
  ];
}

/**
 * Short English block for agent/system prompts when keys are missing.
 */
export function formatCredentialReadinessBlock(): string {
  const providers = buildProviderCredentialHints();
  const channels = buildChannelCredentialHints();
  const surface = buildSkillWorkerSurfaceHints();
  const missingProviders = providers.filter((p) => !p.present);
  const missingChannels = channels.filter((c) => !c.present);
  const lines = ['Credential readiness (presence only — secrets never listed):'];
  if (missingProviders.length === 0 && missingChannels.length === 0) {
    lines.push('LLM provider key: at least one present; no mandatory channel gaps detected.');
  } else {
    if (missingProviders.length > 0) {
      lines.push(
        `Missing LLM provider keys: ${missingProviders.map((p) => p.id).join(', ')}. Chat quality depends on a configured provider.`,
      );
    } else {
      lines.push('LLM provider key: at least one present.');
    }
    if (missingChannels.length > 0) {
      lines.push(
        `Optional channels not configured: ${missingChannels.map((c) => c.id).join(', ')}.`,
      );
    }
  }
  for (const hint of surface) {
    lines.push(hint.message);
  }
  lines.push(
    'Skill/worker mesh: zavorth_skill_marketplace (preview/install/search) and agent_manager (workers/health/invoke/route).',
  );
  lines.push('Use workspace-doctor / doctor.env or provider-status plugins for structured setup tips.');
  return lines.join('\n');
}

export function hasAnyLlmProviderCredential(): boolean {
  return buildProviderCredentialHints().some((hint) => hint.present);
}
