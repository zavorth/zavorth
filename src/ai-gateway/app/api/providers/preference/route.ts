import { NextRequest, NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';
import {
  validatePreferenceMutationOrigin,
  validateSelectionIds,
} from '../../../../../services/selection/ProviderPreferenceRequestSecurity.js';

/**
 * Block cross-site cookie-authenticated preference mutations (CSRF).
 * Bearer/automation without Origin still allowed after management auth.
 */
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
    logger.warn('[route] operation failed', error);
    return NextResponse.json(
      { error: 'Unable to read provider preference' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const originError = validatePreferenceMutationOrigin(request.headers);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  try {
    const parsedBody: unknown = await request.json().catch(() => ({}));
    if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
    }
    const body = parsedBody as Record<string, unknown>;
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

    // Accept the full provider/channel mesh, not only the compact product
    // suggestion catalog. Syntax validation above keeps persisted ids safe.
    const normalizedProviderId = (providerId as string).trim().toLowerCase();

    // Direct write path: product UI saves preferences without the full selection UX gate.
    // Still requires explicit confirm and never invents a default provider.
    if (directWrite === true && confirm === true && dryRun !== true) {
      const {
        writeProviderPreference,
        writeChannelPreference,
        resolveUserSelectionBundle,
      } = await import('../../../../../services/UserSelectionResolver.js');
      const savedProvider = writeProviderPreference({
        providerId: normalizedProviderId,
        modelId: typeof modelId === "string" ? modelId : null,
        secondaryModelId: typeof secondaryModelId === "string" ? secondaryModelId : null,
        routeId: typeof routeId === "string" ? routeId : null,
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
          providerId: savedProvider.providerId,
          modelId: savedProvider.modelId,
          secondaryModelId: savedProvider.secondaryModelId,
          routeId: savedProvider.routeId,
          familyId: savedProvider.familyId,
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
      providerId: normalizedProviderId,
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
    logger.warn('[route] operation failed', error);
    return NextResponse.json(
      { error: 'Unable to update provider preference' },
      { status: 500 }
    );
  }
}
