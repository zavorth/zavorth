import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { SkillLocalRegistry } from "../../../../../../skills/marketplace/SkillLocalRegistry.js";
import { SkillGitRegistry } from "../../../../../../skills/marketplace/SkillGitRegistry.js";
import { validateSkillPackage } from "../../../../../../skills/marketplace/SkillPackageValidator.js";
import { scanSkillForSecurity, getSkillPermissions, recordAuditLog, getAuditLog } from "../../../../../../skills/marketplace/SkillMarketplaceSecurity.js";
import { SkillDependencyResolver } from "../../../../../../skills/marketplace/SkillDependencyResolver.js";
import { SkillRollback } from "../../../../../../skills/marketplace/SkillRollback.js";
import { searchGitHubReposBroad } from "../../../../../../skills/marketplace/SkillGitHubSearch.js";
import { logger } from "@/shared/utils/logger";

export const runtime = "nodejs";

function buildMarketplaceResponse(registry: SkillLocalRegistry) {
  const all = registry.listAll();
  const installed = registry.listInstalled();
  const trust = registry.getTrustSummary();

  return {
    ok: true,
    contractVersion: "2026-07-05.zavorth.marketplace.v1",
    skills: all.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      author: s.author,
      version: s.version,
      category: s.category,
      tags: s.tags,
      source: s.source,
      sourceUrl: s.sourceUrl,
      installed: s.installedAt !== null,
      installedAt: s.installedAt,
      rating: s.rating,
      downloads: s.downloads,
      trustLevel: s.trustLevel,
      authorTrustScore: s.authorTrustScore,
      fileCount: s.fileCount,
    })),
    stats: {
      total: all.length,
      installed: installed.length,
      verified: trust.verified,
      trusted: trust.trusted,
      unknown: trust.unknown,
    },
  };
}

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "list";
    const query = url.searchParams.get("query") || "";
    const category = url.searchParams.get("category") || undefined;
    const skillId = url.searchParams.get("skillId") || "";

    const registry = new SkillLocalRegistry();

    if (action === "search") {
      const results = registry.search(query, category ? { category } : undefined);
      return NextResponse.json({
        ok: true,
        query,
        results: results.map((s) => ({
          id: s.id, name: s.name, description: s.description, author: s.author,
          version: s.version, category: s.category, tags: s.tags,
          installed: s.installedAt !== null, rating: s.rating, downloads: s.downloads,
          trustLevel: s.trustLevel,
        })),
      });
    }

    if (action === "info" && skillId) {
      const entry = registry.getEntry(skillId);
      if (!entry) {
        return NextResponse.json({ ok: false, error: `Skill "${skillId}" not found` }, { status: 404 });
      }
      const skillsDir = `${process.cwd()}/skills/${skillId}`;
      const depResolver = new SkillDependencyResolver();
      const depCheck = require("fs").existsSync(skillsDir) ? depResolver.checkDependencies(skillsDir) : null;
      return NextResponse.json({
        ok: true,
        skill: {
          ...entry,
          dependencies: depCheck ? { installed: depCheck.installed.length, missing: depCheck.missing.length } : null,
        },
      });
    }

    if (action === "audit") {
      const entries = getAuditLog(process.cwd(), 50);
      return NextResponse.json({ ok: true, entries });
    }

    if (action === "github" && query) {
      const repos = await searchGitHubReposBroad(query);
      return NextResponse.json({ ok: true, repos });
    }

    return NextResponse.json(buildMarketplaceResponse(registry));
  } catch (error: any) {
    logger.warn("[marketplace] error", error);
    return NextResponse.json({ ok: false, error: error?.message || "marketplace error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const action = String(body.action || "").trim().toLowerCase();
    const skillId = String(body.skillId || "").trim();
    const source = String(body.source || "").trim();

    const registry = new SkillLocalRegistry();
    const gitRegistry = new SkillGitRegistry();
    const rollback = new SkillRollback();
    const dataDir = `${process.cwd()}/data`;

    if (action === "install" && source) {
      if (source.startsWith("http") || source.startsWith("git@")) {
        const result = await gitRegistry.installFromUrl(source);
        return NextResponse.json({ ok: result.success, message: result.message, skillId: result.skillId });
      }
      const entry = registry.getEntry(source);
      if (entry?.sourceUrl && entry.source === "git") {
        const result = gitRegistry.installFromRepo(entry.sourceUrl, source);
        return NextResponse.json({ ok: result.success, message: result.message, skillId: result.skillId });
      }
      return NextResponse.json({ ok: false, error: `Skill "${source}" not found. Provide a Git URL.` }, { status: 404 });
    }

    if (action === "uninstall" && skillId) {
      const skillsDir = `${process.cwd()}/skills/${skillId}`;
      const fs = require("fs");
      if (!fs.existsSync(skillsDir)) {
        return NextResponse.json({ ok: false, error: `Skill "${skillId}" not installed` }, { status: 404 });
      }
      fs.rmSync(skillsDir, { recursive: true, force: true });
      registry.markUninstalled(skillId);
      recordAuditLog({ timestamp: new Date().toISOString(), action: "uninstall", skillId, version: "", source: "dashboard", riskLevel: "low", issues: 0, user: "web", approved: true }, dataDir);
      return NextResponse.json({ ok: true, message: `Removed "${skillId}"` });
    }

    if (action === "rollback" && skillId) {
      const result = rollback.rollback(skillId);
      return NextResponse.json({ ok: result.success, message: result.message });
    }

    if (action === "rate" && skillId) {
      const rating = Number(body.rating || 0);
      if (rating < 1 || rating > 5) {
        return NextResponse.json({ ok: false, error: "Rating must be 1-5" }, { status: 400 });
      }
      registry.updateStats(skillId, { rating });
      return NextResponse.json({ ok: true, message: `Rated "${skillId}" ${rating}/5` });
    }

    return NextResponse.json({ ok: false, error: "unsupported action" }, { status: 400 });
  } catch (error: any) {
    logger.warn("[marketplace] error", error);
    return NextResponse.json({ ok: false, error: error?.message || "marketplace error" }, { status: 500 });
  }
}
