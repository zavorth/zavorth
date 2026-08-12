import { NextResponse } from "next/server";
import { clearAllLKGP } from "@/lib/db/settings";
import { isAuthenticated } from "@/shared/utils/apiAuth";
import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../../utils/errorLike';

export async function DELETE(request: Request) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    clearAllLKGP();
    return NextResponse.json({ cleared: true });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[route] delete operation failed', error);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
