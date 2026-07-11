import { NextRequest, NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../../utils/errorLike.js';

/**
 * Block cross-site cookie-authenticated preference mutations (CSRF).
 * Bearer/automation without Origin still allowed after management auth.
 */
function assertSameOriginMutation(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) {
    return null;
  }
  try {
    const originHost = new URL(origin).host;
    if (originHost !== host) {
      return NextResponse.json(
        { error: 'Cross-origin preference mutation denied' },
        { status: 403 },
      );
    }
  } catch {
    return NextResponse.json({ error: 'Invalid Origin header' }, { status: 403 });
  }
  return null;
}

function validateSelectionIds(input: {
  providerId: unknown;
  modelId?: unknown;
  secondaryModelId?: unknown;
  routeId?: unknown;
  channelId?: unknown;
}): string | null {
  const providerId = String(input.providerId ?? '').trim();
  if (!providerId || providerId.length > 128) {
    return 'providerId is required and must be at most 128 characters';
  }
  if (/[\u0000-\u001f]/.test(providerId)) {
    return 'providerId contains invalid control characters';
  }
  for (const [key, value] of Object.entries({
    modelId: input.modelId,
    secondaryModelId: input.secondaryModelId,
    routeId: input.routeId,
    channelId: input.channelId,
  })) {
    if (value == null || value === '') continue;
    const text = String(value);
    if (text.length > 256) return `${key} is too long`;
    if (/[\u0000-\u001f]/.test(text)) return `${key} contains invalid control characters`;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { ZavorthProviderPreferencePersistenceService } = await import(
      "../../../../../services/ZavorthProviderPreferencePersistenceService.js"
    );
    const { resolveUserSelectionBundle } = await import(
      '../../../../../services/UserSelectionResolver.js'
    );
    const { listUserSelectionProviders, listUserSelectionChannels } = await import(
      '../../../../../services/selection/UserSelectionCatalog.js'
    );
    const service = new ZavorthProviderPreferencePersistenceService();
    const preference = await service.readPreference();
    const bundle = resolveUserSelectionBundle();

    return NextResponse.json({
      preference: preference || {
        providerId: bundle.provider.providerId,
        modelId: bundle.provider.modelId,
        secondaryModelId: bundle.provider.secondaryModelId,
        routeId: bundle.provider.routeId,
        familyId: bundle.provider.familyId,
      },
      channel: bundle.channel,
      catalog: {
        providers: listUserSelectionProviders(),
        channels: listUserSelectionChannels(),
      },
    });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[route] operation failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? err.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const csrfError = assertSameOriginMutation(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json().catch(() => ({}));
    const {
      providerId,
      modelId,
      secondaryModelId,
      routeId,
      channelId,
      confirm,
      dryRun,
      directWrite,
      setChannel,
    } = body;

    const validationError = validateSelectionIds({
      providerId,
      modelId,
      secondaryModelId,
      routeId,
      channelId,
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Direct write path: product UI saves preferences without the full selection UX gate.
    // Still requires explicit confirm and never invents a default provider.
    if (directWrite === true && confirm === true && dryRun !== true) {
      const {
        writeProviderPreference,
        writeChannelPreference,
        resolveUserSelectionBundle,
      } = await import('../../../../../services/UserSelectionResolver.js');
      const provider = writeProviderPreference({
        providerId,
        modelId: modelId ?? null,
        secondaryModelId: secondaryModelId ?? null,
        routeId: routeId ?? null,
      });
      // Only persist channel when the client explicitly opts in (setChannel) with a value,
      // or when setChannel is true and channelId is empty-string meaning clear is not supported —
      // empty channelId is ignored so we never invent "desktop".
      if (setChannel === true && typeof channelId === 'string' && channelId.trim()) {
        writeChannelPreference(channelId);
      }
      const bundle = resolveUserSelectionBundle();
      return NextResponse.json({
        status: 'applied',
        preference: {
          providerId: provider.providerId,
          modelId: provider.modelId,
          secondaryModelId: provider.secondaryModelId,
          routeId: provider.routeId,
          familyId: provider.familyId,
        },
        channel: bundle.channel,
        source: 'user-selection-direct',
      });
    }

    const { ZavorthProviderPreferencePersistenceService } = await import(
      "../../../../../services/ZavorthProviderPreferencePersistenceService.js"
    );
    const service = new ZavorthProviderPreferencePersistenceService();

    let result;
    const input = {
      providerId,
      modelId,
      secondaryModelId,
      routeId,
      confirm,
      dryRun,
    } as any;
    if (dryRun === true || !confirm) {
      result = await service.preview(input);
    } else {
      result = await service.apply(input);
    }

    if (
      confirm === true
      && dryRun !== true
      && setChannel === true
      && typeof channelId === 'string'
      && channelId.trim()
    ) {
      const { writeChannelPreference } = await import('../../../../../services/UserSelectionResolver.js');
      writeChannelPreference(channelId);
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[route] operation failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? err.message : String(error) },
      { status: 500 }
    );
  }
}
