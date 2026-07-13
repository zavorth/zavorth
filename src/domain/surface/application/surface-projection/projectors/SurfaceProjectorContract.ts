/**
 * F3 — Plugable surface projectors.
 * Core stays semantic; each channel owns native payload shaping.
 */

import type { SurfaceProfile } from '../../surface-affordance/index.js';
import type {
  SurfaceRenderOptions,
  SurfaceRenderedResponse,
  SurfaceResponse,
} from '../../surface-response/SurfaceResponseContract.js';
import type { ProjectedSurfaceMessage } from '../projectSemanticCard.js';

export const SURFACE_PROJECTOR_CONTRACT_VERSION = 'surface-projector/v1' as const;

export type SurfaceProjectorInput = {
  response: SurfaceResponse;
  options?: SurfaceRenderOptions;
  profile?: SurfaceProfile | null;
  /** Optional precomputed F2 projection (when available). */
  projected?: ProjectedSurfaceMessage | null;
};

export type SurfaceProjectorOutput = {
  contractVersion: typeof SURFACE_PROJECTOR_CONTRACT_VERSION;
  channel: string;
  text: string;
  /** Options passed to ctx.reply (reply_markup, components, …). Null = text only. */
  replyOptions: Record<string, unknown> | null;
  rendered: SurfaceRenderedResponse;
  usedNativeButtons: boolean;
  profileId?: string | null;
};

/**
 * Channel-specific renderer. Unknown channels fall back to PlainSurfaceProjector.
 * Projectors must not import grammy/discord.js — only pure payload shapes.
 */
export interface SurfaceProjector {
  readonly channel: string;
  project(input: SurfaceProjectorInput): SurfaceProjectorOutput;
}
