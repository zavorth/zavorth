import type { SurfaceProfile } from '../../surface-affordance/index.js';
import {
  resolveSurfaceProfileForChannel,
  normalizeChannelId,
} from '../../surface-affordance/index.js';
import type { SurfaceRenderOptions, SurfaceResponse } from '../../surface-response/SurfaceResponseContract.js';
import type { ProjectedSurfaceMessage } from '../projectSemanticCard.js';
import {
  explainSurfaceProjection,
  recordSurfaceProjectionTelemetry,
} from '../SurfaceProjectionObservability.js';
import { CliSurfaceProjector } from './CliSurfaceProjector.js';
import { DesktopSurfaceProjector } from './DesktopSurfaceProjector.js';
import { DiscordSurfaceProjector } from './DiscordSurfaceProjector.js';
import { FallbackMessagingSurfaceProjector } from './FallbackMessagingSurfaceProjector.js';
import { PlainSurfaceProjector } from './PlainSurfaceProjector.js';
import type {
  SurfaceProjector,
  SurfaceProjectorInput,
  SurfaceProjectorOutput,
} from './SurfaceProjectorContract.js';
import { TelegramSurfaceProjector } from './TelegramSurfaceProjector.js';
import { WebSurfaceProjector } from './WebSurfaceProjector.js';

const builtinProjectors = new Map<string, SurfaceProjector>();
const customProjectors = new Map<string, SurfaceProjector>();
const plainFallback = new PlainSurfaceProjector();

function seedBuiltinProjectors(): void {
  builtinProjectors.clear();
  const list: SurfaceProjector[] = [
    new TelegramSurfaceProjector(),
    new DiscordSurfaceProjector(),
    new CliSurfaceProjector(),
    new PlainSurfaceProjector(),
    new WebSurfaceProjector(),
    new DesktopSurfaceProjector(),
    new FallbackMessagingSurfaceProjector('whatsapp', 'whatsapp'),
    new FallbackMessagingSurfaceProjector('signal', 'signal'),
    new FallbackMessagingSurfaceProjector('imessage', 'imessage'),
    new FallbackMessagingSurfaceProjector('slack', 'slack'),
    new FallbackMessagingSurfaceProjector('teams', 'teams'),
    new FallbackMessagingSurfaceProjector('email', 'email'),
    new FallbackMessagingSurfaceProjector('instagram', 'instagram'),
  ];
  for (const projector of list) {
    builtinProjectors.set(projector.channel, projector);
  }
}

seedBuiltinProjectors();

export function registerSurfaceProjector(projector: SurfaceProjector): void {
  if (!projector?.channel) {
    throw new Error('registerSurfaceProjector requires projector.channel');
  }
  customProjectors.set(String(projector.channel).trim().toLowerCase(), projector);
}

export function getSurfaceProjector(channel: string): SurfaceProjector {
  const key = String(channel || '')
    .trim()
    .toLowerCase();
  const normalized = normalizeChannelId(key) || key || 'plain';
  return (
    customProjectors.get(key) ||
    customProjectors.get(normalized) ||
    builtinProjectors.get(normalized) ||
    builtinProjectors.get(key) ||
    plainFallback
  );
}

export function listSurfaceProjectors(): SurfaceProjector[] {
  const byChannel = new Map<string, SurfaceProjector>();
  for (const p of builtinProjectors.values()) {
    byChannel.set(p.channel, p);
  }
  for (const p of customProjectors.values()) {
    byChannel.set(p.channel, p);
  }
  return [...byChannel.values()].sort((a, b) => a.channel.localeCompare(b.channel));
}

export function resetSurfaceProjectorRegistryForTests(): void {
  customProjectors.clear();
  seedBuiltinProjectors();
}

/**
 * Resolve profile + projector and produce channel-native output for a SurfaceResponse.
 */
export function projectResponseForChannel(
  channel: string,
  response: SurfaceResponse,
  options: SurfaceRenderOptions = {},
  extras: {
    profile?: SurfaceProfile | null;
    projected?: ProjectedSurfaceMessage | null;
  } = {},
): SurfaceProjectorOutput {
  const profile = extras.profile ?? resolveSurfaceProfileForChannel(channel);
  const projector = getSurfaceProjector(channel);
  const input: SurfaceProjectorInput = {
    response,
    options,
    profile,
    projected: extras.projected ?? null,
  };
  const output = projector.project(input);
  try {
    const explain = explainSurfaceProjection({
      channel,
      profile,
      projectorOutput: output,
      projected: extras.projected ?? null,
    });
    recordSurfaceProjectionTelemetry({
      channel,
      profileId: profile.id,
      usedNativeButtons: output.usedNativeButtons,
      intent: response.intent,
      responseId: response.id,
      reasons: explain.reasons.slice(0, 4),
    });
  } catch {
    // Observability must never break projection.
  }
  return output;
}
