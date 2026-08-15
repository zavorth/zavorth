import { NextResponse } from 'next/server';
import { requireControlAuth } from '@/lib/api/requireManagementAuth';
import {
  ensureExperienceAgentReady,
  getExperienceCoreService,
} from '../../../experience/experienceRouteSupport';
import { ProviderConnectionTestService } from '@/services/ProviderConnectionTestService';
import { ZavorthChannelActionService } from '@/services/ZavorthChannelActionService';
import { readJsonBody } from '../../../experience/experienceRouteSupport';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const authError = await requireControlAuth(request);
  if (authError) return authError;

  await ensureExperienceAgentReady();

  const body = await readJsonBody(request);

  const action = typeof body.action === 'string' ? body.action : '';
  const providerId = typeof body.providerId === 'string' ? body.providerId : null;

  if (action === 'provider.test' && providerId) {
    const result = await ProviderConnectionTestService.getInstance().testConnection(providerId);
    return NextResponse.json({ ok: result.status === 'ok', providerTest: result });
  }

  if (action === 'channel.execute') {
    const result = await new ZavorthChannelActionService().execute(body);
    return NextResponse.json({ ok: true, channelResult: result });
  }

  const commandResult = await getExperienceCoreService().executeCommand({
    text: typeof body.text === 'string' ? body.text : action,
  });

  return NextResponse.json({
    ok: true,
    command: commandResult,
  });
}
