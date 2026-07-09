/**
 * Shared protocol-pack surface for Tier B channels.
 * All packs share: pairing posture, allowlist, inbound parse, outbound queue,
 * doctor steps, readiness proof fields, and media stubs.
 */

export type ProtocolPackTransport = 'webhook' | 'bot-http' | 'local-bridge' | 'relay' | 'graph-api' | 'mail';

export type ProtocolPackDescriptor = {
  id: string;
  label: string;
  transport: ProtocolPackTransport;
  webhookPath: string;
  requiredEnvKeys: string[];
  optionalEnvKeys: string[];
  features: {
    inbound: boolean;
    outbound: boolean;
    pairing: boolean;
    allowlist: boolean;
    doctor: boolean;
    media: boolean;
  };
  doctorSteps: string[];
  setupHint: string;
};

export type ProtocolPackDoctorResult = {
  channelId: string;
  configured: boolean;
  missingEnvKeys: string[];
  presentEnvKeys: string[];
  proof: 'none' | 'catalog' | 'configuration' | 'doctor';
  liveReady: false; // Tier B never claims live without separate live proof
  steps: Array<{ id: string; ok: boolean; detail: string }>;
  nextSafeAction: string;
};

export function buildProtocolPackDoctor(
  pack: ProtocolPackDescriptor,
  env: Record<string, string | undefined> = process.env,
): ProtocolPackDoctorResult {
  const presentEnvKeys: string[] = [];
  const missingEnvKeys: string[] = [];
  for (const key of pack.requiredEnvKeys) {
    if (String(env[key] || '').trim()) presentEnvKeys.push(key);
    else missingEnvKeys.push(key);
  }
  const configured = missingEnvKeys.length === 0 && pack.requiredEnvKeys.length > 0
    ? true
    : missingEnvKeys.length === 0 && pack.requiredEnvKeys.length === 0
      ? false
      : missingEnvKeys.length === 0;

  const steps = pack.doctorSteps.map((step, index) => {
    if (index === 0) {
      return {
        id: `env-${index}`,
        ok: missingEnvKeys.length === 0 && presentEnvKeys.length > 0,
        detail: missingEnvKeys.length
          ? `Missing: ${missingEnvKeys.join(', ')}`
          : presentEnvKeys.length
            ? `Required env present (${presentEnvKeys.length})`
            : 'No required env keys declared',
      };
    }
    if (step.toLowerCase().includes('allowlist')) {
      return {
        id: `allowlist-${index}`,
        ok: true,
        detail: 'Allowlist policy is available; not auto-opened.',
      };
    }
    if (step.toLowerCase().includes('webhook') || step.toLowerCase().includes('bridge')) {
      return {
        id: `transport-${index}`,
        ok: configured,
        detail: configured
          ? `Transport ${pack.transport} configured for review`
          : `Configure transport ${pack.transport} before live proof`,
      };
    }
    return {
      id: `step-${index}`,
      ok: configured,
      detail: step,
    };
  });

  return {
    channelId: pack.id,
    configured: presentEnvKeys.length > 0 && missingEnvKeys.length === 0,
    missingEnvKeys,
    presentEnvKeys,
    proof: presentEnvKeys.length > 0 && missingEnvKeys.length === 0 ? 'configuration' : presentEnvKeys.length > 0 ? 'configuration' : 'catalog',
    liveReady: false,
    steps,
    nextSafeAction: missingEnvKeys.length
      ? `Set ${missingEnvKeys[0]} and re-run doctor.`
      : 'Run a live proof before using as default route.',
  };
}

export function defaultProtocolPackFeatures(transport: ProtocolPackTransport): ProtocolPackDescriptor['features'] {
  return {
    inbound: true,
    outbound: true,
    pairing: transport === 'local-bridge' || transport === 'bot-http',
    allowlist: true,
    doctor: true,
    media: transport === 'bot-http' || transport === 'local-bridge',
  };
}

export function createProtocolPack(input: {
  id: string;
  label: string;
  transport: ProtocolPackTransport;
  requiredEnvKeys?: string[];
  optionalEnvKeys?: string[];
  webhookPath?: string;
}): ProtocolPackDescriptor {
  const transport = input.transport;
  return {
    id: input.id,
    label: input.label,
    transport,
    webhookPath: input.webhookPath || `/api/webhooks/${input.id}`,
    requiredEnvKeys: input.requiredEnvKeys || [],
    optionalEnvKeys: input.optionalEnvKeys || [],
    features: defaultProtocolPackFeatures(transport),
    doctorSteps: [
      'Validate required environment keys',
      'Confirm allowlist is closed by default',
      transport === 'webhook' ? 'Verify webhook path is reachable only after policy allow' : `Verify ${transport} bridge health`,
      'Never mark live-ready from catalog alone',
      'Optional media stub path available after live proof',
    ],
    setupHint: `Configure ${input.label} as a Tier B protocol pack, then run doctor and live proof.`,
  };
}

/** Built-in Tier B protocol pack catalogue (structural, not product marketing). */
export const BUILTIN_PROTOCOL_PACKS: ProtocolPackDescriptor[] = [
  createProtocolPack({
    id: 'matrix',
    label: 'Matrix homeserver pack',
    transport: 'relay',
    requiredEnvKeys: ['MATRIX_BASE_URL', 'MATRIX_ACCESS_TOKEN'],
    optionalEnvKeys: ['MATRIX_DEFAULT_ROOM_ID'],
  }),
  createProtocolPack({
    id: 'googlechat',
    label: 'Chat webhook pack',
    transport: 'webhook',
    requiredEnvKeys: ['GOOGLECHAT_WEBHOOK_URL'],
  }),
  createProtocolPack({
    id: 'mattermost',
    label: 'Team chat webhook pack',
    transport: 'webhook',
    requiredEnvKeys: ['MATTERMOST_WEBHOOK_URL'],
    optionalEnvKeys: ['MATTERMOST_WEBHOOK_TOKEN'],
  }),
  createProtocolPack({
    id: 'feishu',
    label: 'Workplace webhook pack',
    transport: 'webhook',
    requiredEnvKeys: ['FEISHU_WEBHOOK_URL'],
    optionalEnvKeys: ['FEISHU_WEBHOOK_SECRET'],
  }),
  createProtocolPack({
    id: 'irc',
    label: 'IRC relay pack',
    transport: 'relay',
    requiredEnvKeys: ['IRC_BRIDGE_URL'],
    optionalEnvKeys: ['IRC_ALLOWED_CHANNELS'],
  }),
  createProtocolPack({
    id: 'line',
    label: 'Messaging bot-http pack',
    transport: 'bot-http',
    requiredEnvKeys: ['LINE_CHANNEL_ACCESS_TOKEN'],
    optionalEnvKeys: ['LINE_TARGET_IDS'],
  }),
  createProtocolPack({
    id: 'home-assistant',
    label: 'Home automation webhook pack',
    transport: 'webhook',
    requiredEnvKeys: ['HOME_ASSISTANT_WEBHOOK_URL'],
    optionalEnvKeys: ['HOME_ASSISTANT_TOKEN'],
  }),
  createProtocolPack({
    id: 'generic-webhook',
    label: 'Generic webhook pack',
    transport: 'webhook',
    requiredEnvKeys: ['WEBHOOKS_TARGET_URL'],
    optionalEnvKeys: ['WEBHOOKS_AUTH_TOKEN'],
    webhookPath: '/api/webhooks/generic',
  }),
];
