import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { isUnsafeCrossSiteMutation, readJsonBody } from "../../runtime-engine-state";

// Robust relative imports to reference the skills module outside the Next.js folder
import { SkillCurationService } from "../../../../../../skills/SkillCurationService.js";
import { SkillCuratorPlaneService } from "../../../../../../skills/SkillCuratorPlaneService.js";
import { SkillCatalogService } from "../../../../../../skills/SkillCatalogService.js";
import { Database } from "../../../../../../storage/Database.js";
import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../../../utils/errorLike.js';

export const runtime = "nodejs";

/**
 * Returns the unified list of all skills (active and archived in the Vault).
 */
async function buildUnifiedSkillsResponse() {
  const catalogService = new SkillCatalogService();
  const curationService = new SkillCurationService(catalogService);
  const curatorPlane = new SkillCuratorPlaneService({ catalogService, curationService });

  const activeEntries = catalogService.listEntries();
  const db = await Database.getInstance();
  const telemetryRows = db.all<{
    skill_id: string;
    use_count: number;
    last_executed_at: string | null;
    status: 'active' | 'archived';
    pinned: number;
  }>(`SELECT * FROM zavorth_skills_telemetry`);

  const telemetryMap = new Map(telemetryRows.map((r) => [r.skill_id, r]));

  // Map active skills and cross-reference with their telemetry data
  const activeSkills = activeEntries.map((entry) => {
    const telemetry = telemetryMap.get(entry.name) || {
      use_count: 0,
      last_executed_at: null,
      status: 'active',
      pinned: 0,
    };
    return {
      id: entry.name,
      name: entry.name,
      description: entry.description,
      sourceId: entry.sourceId,
      sourceLabel: entry.sourceLabel,
      trust: entry.sourceTrust,
      license: entry.license,
      imported: entry.imported,
      riskLevel: entry.risk?.level || 'low',
      riskScore: entry.risk?.score || 0,
      pinned: telemetry.pinned === 1,
      useCount: telemetry.use_count || 0,
      lastExecutedAt: telemetry.last_executed_at,
      status: 'active',
    };
  });

  // Map archived skills from the Vault
  const archivedZips = await curationService.listArchivedSkills();
  const archivedSkills = archivedZips.map((zip) => {
    const telemetry = telemetryMap.get(zip.skillId) || {
      use_count: 0,
      last_executed_at: null,
      status: 'archived',
      pinned: 0,
    };
    return {
      id: zip.skillId,
      name: zip.skillId,
      description: "Skill arquivada no Vault de Habilidades.",
      sourceId: null,
      sourceLabel: null,
      trust: 'review',
      license: null,
      imported: true,
      riskLevel: 'low',
      riskScore: 0,
      pinned: telemetry.pinned === 1,
      useCount: telemetry.use_count || 0,
      lastExecutedAt: telemetry.last_executed_at || zip.archivedAt,
      status: 'archived',
      archivedAt: zip.archivedAt,
      sizeBytes: zip.sizeBytes,
    };
  });

  // Juntar ambas as listas removendo qualquer duplicidade acidental
  const seenNames = new Set(activeSkills.map((s) => s.name));
  const uniqueArchived = archivedSkills.filter((s) => !seenNames.has(s.name));

  const allSkills = [...activeSkills, ...uniqueArchived];

  const curator = await curatorPlane.status();

  return {
    ok: true,
    contractVersion: "2026-05-31.zavorthControl.skills.v1",
    skills: allSkills,
    curator,
    stats: {
      total: allSkills.length,
      active: activeSkills.length,
      archived: uniqueArchived.length,
      pinned: allSkills.filter((s) => s.pinned).length,
    }
  };
}

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    return NextResponse.json(await buildUnifiedSkillsResponse());
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[route] creation failed', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? err.message : "failed to fetch skills list",
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  if (isUnsafeCrossSiteMutation(request)) {
    return NextResponse.json({
      ok: false,
      error: "cross-site mutation requests are blocked",
    }, { status: 403 });
  }

  try {
    const body = await readJsonBody(request);
    const action = String(body.action || "").trim().toLowerCase();
    const skillId = String(body.skillId || "").trim();

    const catalogService = new SkillCatalogService();
    const curationService = new SkillCurationService(catalogService);
    const curatorPlane = new SkillCuratorPlaneService({ catalogService, curationService });

    if (action === "curate" || action === "curator.run") {
      const result = await curatorPlane.runCuratorReview({
        dryRun: body.dryRun === true,
        llmReview: body.llmReview === true || body.aiReview === true,
        reason: body.dryRun === true ? "zavorthControl-dry-run" : "zavorthControl-run",
        triggeredBy: "zavorthControl:skills",
      });
      return NextResponse.json({
        ok: true,
        action,
        report: result,
        data: await buildUnifiedSkillsResponse(),
      });
    }

    if (action === "curator.status") {
      return NextResponse.json({
        ok: true,
        action,
        curator: await curatorPlane.status(),
      });
    }

    if (action === "curator.pause" || action === "pause") {
      return NextResponse.json({
        ok: true,
        action,
        curator: await curatorPlane.pause(),
        data: await buildUnifiedSkillsResponse(),
      });
    }

    if (action === "curator.resume" || action === "resume") {
      return NextResponse.json({
        ok: true,
        action,
        curator: await curatorPlane.resume(),
        data: await buildUnifiedSkillsResponse(),
      });
    }

    if (!skillId) {
      return NextResponse.json({
        ok: false,
        error: "skillId is required for this action",
      }, { status: 400 });
    }

    switch (action) {
      case "pin": {
        const pinned = !!body.pinned;
        await curatorPlane.togglePin(skillId, pinned);
        break;
      }
      case "archive": {
        await curatorPlane.archiveSkill(skillId);
        break;
      }
      case "restore": {
        await curatorPlane.restoreSkill(skillId);
        break;
      }
      default: {
        return NextResponse.json({
          ok: false,
          error: "unsupported action",
          allowedActions: ["pin", "archive", "restore", "curate", "curator.run", "curator.status", "curator.pause", "curator.resume"],
        }, { status: 400 });
      }
    }

    return NextResponse.json({
      ok: true,
      action,
      skillId,
      data: await buildUnifiedSkillsResponse(),
    });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[route] creation failed', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? err.message : "action failed",
    }, { status: 500 });
  }
}
