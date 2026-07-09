import { NextResponse } from "next/server";
import { readFile, readdir } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../../../utils/errorLike.js';

/**
 * GET /api/oauth/kiro/auto-import
 * Auto-detect and extract Kiro refresh token from AWS SSO cache.
 *
 * 🔒 Auth-guarded: requires JWT cookie or Bearer API key (finding #258-5).
 */
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const cachePath = join(homedir(), ".aws/sso/cache");

    // Try to read cache directory
    let files;
    try {
      files = await readdir(cachePath);
    } catch (error: unknown) {logger.warn('[route] filesystem operation failed', error);
    return NextResponse.json({
        found: false,
        error: "AWS SSO cache not found. Please login to Kiro IDE first.",
      });
  }

    // Look for kiro-auth-token.json or any .json file with refreshToken
    let refreshToken = null;
    let foundFile = null;

    // First try kiro-auth-token.json
    const kiroTokenFile = "kiro-auth-token.json";
    if (files.includes(kiroTokenFile)) {
      try {
        const content = await readFile(join(cachePath, kiroTokenFile), "utf-8");
        const data = JSON.parse(content);
        if (data.refreshToken && data.refreshToken.startsWith("aorAAAAAG")) {
          refreshToken = data.refreshToken;
          foundFile = kiroTokenFile;
        }
      } catch (error: unknown) {// Continue to search other files
      logger.warn('[route] JSON parse failed', error);
    }
    }

    // If not found, search all .json files
    if (!refreshToken) {
      for (const file of files) {
        if (!file.endsWith(".json")) continue;

        try {
          const content = await readFile(join(cachePath, file), "utf-8");
          const data = JSON.parse(content);

          // Look for Kiro refresh token (starts with aorAAAAAG)
          if (data.refreshToken && data.refreshToken.startsWith("aorAAAAAG")) {
            refreshToken = data.refreshToken;
            foundFile = file;
            break;
          }
        } catch (error: unknown) {// Skip invalid JSON files
          continue;
        }
      }
    }

    if (!refreshToken) {
      return NextResponse.json({
        found: false,
        error: "Kiro token not found in AWS SSO cache. Please login to Kiro IDE first.",
      });
    }

    return NextResponse.json({
      found: true,
      refreshToken,
      source: foundFile,
    });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    console.log("Kiro auto-import error:", error);
    return NextResponse.json({ found: false, error: err.message }, { status: 500 });
  }
}
