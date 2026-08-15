import { NextResponse } from 'next/server';
import { requireControlAuth } from '@/lib/api/requireManagementAuth';
import {
  buildExperienceCommand,
  ensureExperienceAgentReady,
  getExperienceCoreService,
  readExperienceQuery,
} from '../../experience/experienceRouteSupport';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const authError = await requireControlAuth(request);
  if (authError) return authError;

  await ensureExperienceAgentReady();

  const body = await readExperienceQuery(request);
  const command = buildExperienceCommand(body as Record<string, unknown>);

  const result = await getExperienceCoreService().executeCommand(command);

  return NextResponse.json({
    ok: true,
    chat: {
      ...result,
      receivedAt: new Date().toISOString(),
    },
  });
}
