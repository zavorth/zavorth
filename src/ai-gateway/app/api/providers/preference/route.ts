import { NextRequest, NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../../utils/errorLike.js';

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
    } = body;

    if (!providerId) {
      return NextResponse.json({ error: "providerId is required" }, { status: 400 });
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
      if (typeof channelId === 'string' && channelId.trim()) {
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
    const input = { providerId, modelId, secondaryModelId, routeId, confirm, dryRun } as any;
    if (dryRun === true || !confirm) {
      result = await service.preview(input);
    } else {
      result = await service.apply(input);
    }

    if (confirm === true && dryRun !== true && typeof channelId === 'string' && channelId.trim()) {
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
