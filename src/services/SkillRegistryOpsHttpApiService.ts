/**
 * HTTP surface for skill registry ops (operator UI + desktop).
 *
 *   GET  /api/skill-registry
 *   GET  /api/skill-registry/snapshot
 *   POST /api/skill-registry/actions
 *
 * Live git push is never performed here — publish_plan is dry-run only.
 * Sign requires operatorConfirm + signing key (body or ZAVORTH_SKILL_SIGNING_KEY).
 */

import fs from 'node:fs';
import path from 'node:path';
import * as http from 'http';
import {
  SkillRegistryOpsService,
  ZAVORTH_SKILL_REGISTRY_INDEX_SCHEMA,
  ZAVORTH_SKILL_PUBLISH_PLAN_SCHEMA,
  type SkillRegistryIndex,
  type SkillPublishPlan,
} from './SkillRegistryOpsService.js';
import { getTrustedSkillGitDomains } from '../skills/marketplace/SkillGitRegistry.js';

export type SkillRegistryHttpAction =
  | 'refresh'
  | 'verify'
  | 'sign'
  | 'export'
  | 'registry_export'
  | 'publish_plan'
  | 'publish-plan'
  | 'trusted_hosts';

export type SkillRegistryHttpActionBody = {
  action?: string;
  skillId?: string;
  skillDir?: string;
  skill_dir?: string;
  repoUrl?: string;
  repo_url?: string;
  outPath?: string;
  out_path?: string;
  signingKey?: string;
  signing_key?: string;
  operatorConfirm?: boolean;
  operator_confirm?: boolean;
  baseUrl?: string;
  base_url?: string;
};

export type SkillRegistryHttpSkillRow = {
  id: string;
  name: string;
  version: string | null;
  description: string | null;
  relativePath: string;
  signed: boolean;
  signatureMode: string;
  riskLevel: string;
  packageValid: boolean;
  packageErrors: string[];
  path: string;
};

export type SkillRegistryHttpSnapshot = {
  contractVersion: 'zavorth.skill-registry-http/v1';
  generatedAt: string;
  skillsDir: string;
  skills: SkillRegistryHttpSkillRow[];
  trustedGitDomains: string[];
  registryBaseUrl: string | null;
  index: SkillRegistryIndex;
  stats: {
    total: number;
    signed: number;
    packageValid: number;
    highRisk: number;
  };
  docs: string[];
  env: {
    hasSigningKey: boolean;
    trustedDomainsExtra: boolean;
    registryUrlSet: boolean;
  };
};

export type SkillRegistryHttpActionResult = {
  ok: boolean;
  action: string;
  message?: string;
  skillId?: string | null;
  plan?: SkillPublishPlan;
  planPath?: string;
  indexPath?: string;
  count?: number;
  verify?: ReturnType<SkillRegistryOpsService['verify']>;
  sign?: { ok: boolean; message: string; sigPath?: string };
  trustedGitDomains?: string[];
  error?: string;
};

type WriteJson = (res: http.ServerResponse, body: unknown, statusCode?: number) => void;
type ReadJsonBody = (req: http.IncomingMessage) => Promise<Record<string, unknown>>;

export type SkillRegistryHttpRouteDeps = {
  writeJson: WriteJson;
  readJsonBody: ReadJsonBody;
  workspaceRoot?: string;
};

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
}

function isOperatorConfirmed(body: SkillRegistryHttpActionBody, env: NodeJS.ProcessEnv): boolean {
  if (body.operatorConfirm === true || body.operator_confirm === true) return true;
  const mode = String(env.ZAVORTH_SKILL_OPERATOR_MODE || '').trim();
  return mode === '1' || mode.toLowerCase() === 'true';
}

export class SkillRegistryOpsHttpApiService {
  private readonly projectRoot: string;

  constructor(runtime: { projectRoot?: string } = {}) {
    this.projectRoot = runtime.projectRoot || process.cwd();
  }

  private resolveSkillsDir(workspaceRoot: string): string {
    return path.join(workspaceRoot, 'skills');
  }

  private resolveSkillPath(skillsDir: string, body: SkillRegistryHttpActionBody): string | null {
    const raw = String(body.skillDir || body.skill_dir || body.skillId || '').trim();
    if (!raw) return null;
    if (path.isAbsolute(raw) || raw.includes('/') || raw.includes('\\') || raw.startsWith('.')) {
      return path.resolve(raw);
    }
    const under = path.join(skillsDir, raw);
    if (fs.existsSync(under)) return under;
    return path.resolve(raw);
  }

  public buildSnapshot(
    workspaceRoot: string = this.projectRoot,
    env: NodeJS.ProcessEnv = process.env,
  ): SkillRegistryHttpSnapshot {
    const skillsDir = this.resolveSkillsDir(workspaceRoot);
    const ops = new SkillRegistryOpsService({ projectRoot: workspaceRoot, skillsDir });
    const baseUrl = String(env.ZAVORTH_SKILL_REGISTRY_URL || '').trim() || null;
    const index = ops.exportIndex({ registryBaseUrl: baseUrl, env });
    const skills: SkillRegistryHttpSkillRow[] = [];

    if (fs.existsSync(skillsDir)) {
      for (const ent of fs.readdirSync(skillsDir, { withFileTypes: true })) {
        if (!ent.isDirectory() || ent.name.startsWith('.')) continue;
        const skillPath = path.join(skillsDir, ent.name);
        if (!fs.existsSync(path.join(skillPath, 'SKILL.md'))) continue;
        const report = ops.verify(skillPath);
        const fromIndex = index.skills.find((s) => s.id === ent.name);
        skills.push({
          id: ent.name,
          name: fromIndex?.name || ent.name,
          version: fromIndex?.version || null,
          description: fromIndex?.description || null,
          relativePath: ent.name,
          signed: report.signature.ok,
          signatureMode: report.signature.mode,
          riskLevel: report.security.riskLevel,
          packageValid: report.packageValid,
          packageErrors: report.packageErrors,
          path: skillPath,
        });
      }
    }

    skills.sort((a, b) => a.id.localeCompare(b.id));

    return {
      contractVersion: 'zavorth.skill-registry-http/v1',
      generatedAt: new Date().toISOString(),
      skillsDir,
      skills,
      trustedGitDomains: getTrustedSkillGitDomains(env),
      registryBaseUrl: baseUrl,
      index,
      stats: {
        total: skills.length,
        signed: skills.filter((s) => s.signed).length,
        packageValid: skills.filter((s) => s.packageValid).length,
        highRisk: skills.filter((s) => s.riskLevel === 'high' || s.riskLevel === 'blocked').length,
      },
      docs: [
        'docs/product/skill-registry-ops.md',
        'docs/product/skills-universal-install.md',
      ],
      env: {
        hasSigningKey: Boolean(String(env.ZAVORTH_SKILL_SIGNING_KEY || '').trim()),
        trustedDomainsExtra: Boolean(String(env.ZAVORTH_SKILL_TRUSTED_DOMAINS || '').trim()),
        registryUrlSet: Boolean(baseUrl),
      },
    };
  }

  public runAction(
    body: SkillRegistryHttpActionBody,
    workspaceRoot: string = this.projectRoot,
    env: NodeJS.ProcessEnv = process.env,
  ): { ok: boolean; snapshot: SkillRegistryHttpSnapshot; result: SkillRegistryHttpActionResult } {
    const action = String(body.action || 'refresh').trim().toLowerCase().replace(/-/g, '_');
    const skillsDir = this.resolveSkillsDir(workspaceRoot);
    const ops = new SkillRegistryOpsService({ projectRoot: workspaceRoot, skillsDir });

    try {
      if (action === 'refresh' || action === 'snapshot') {
        return {
          ok: true,
          snapshot: this.buildSnapshot(workspaceRoot, env),
          result: { ok: true, action: 'refresh', message: 'Snapshot refreshed' },
        };
      }

      if (action === 'trusted_hosts' || action === 'trusted_domains') {
        const domains = getTrustedSkillGitDomains(env);
        return {
          ok: true,
          snapshot: this.buildSnapshot(workspaceRoot, env),
          result: {
            ok: true,
            action: 'trusted_hosts',
            trustedGitDomains: domains,
            message: `${domains.length} trusted host(s)`,
          },
        };
      }

      if (action === 'export' || action === 'registry_export') {
        const outPath =
          String(body.outPath || body.out_path || '').trim() ||
          path.join(workspaceRoot, 'data', 'runtime', 'skill-registry', 'index.json');
        const baseUrl =
          String(body.baseUrl || body.base_url || env.ZAVORTH_SKILL_REGISTRY_URL || '').trim() ||
          null;
        const written = ops.writeIndex(outPath, { registryBaseUrl: baseUrl, env });
        if (!written.ok) {
          return {
            ok: false,
            snapshot: this.buildSnapshot(workspaceRoot, env),
            result: { ok: false, action: 'export', error: written.message },
          };
        }
        return {
          ok: true,
          snapshot: this.buildSnapshot(workspaceRoot, env),
          result: {
            ok: true,
            action: 'export',
            indexPath: written.path,
            count: written.count,
            message: `Registry index exported (${written.count} skill(s))`,
          },
        };
      }

      if (action === 'verify') {
        const skillPath = this.resolveSkillPath(skillsDir, body);
        if (!skillPath || !fs.existsSync(skillPath)) {
          return {
            ok: false,
            snapshot: this.buildSnapshot(workspaceRoot, env),
            result: { ok: false, action: 'verify', error: 'skillDir / skillId required and must exist' },
          };
        }
        const report = ops.verify(skillPath);
        return {
          ok: report.ok,
          snapshot: this.buildSnapshot(workspaceRoot, env),
          result: {
            ok: report.ok,
            action: 'verify',
            skillId: path.basename(skillPath),
            verify: report,
            message: report.ok ? 'PASS' : 'FAIL',
          },
        };
      }

      if (action === 'sign') {
        if (!isOperatorConfirmed(body, env)) {
          return {
            ok: false,
            snapshot: this.buildSnapshot(workspaceRoot, env),
            result: {
              ok: false,
              action: 'sign',
              error:
                'Signing requires operatorConfirm=true (or ZAVORTH_SKILL_OPERATOR_MODE=1). Local package integrity only — not CDN publish.',
            },
          };
        }
        const skillPath = this.resolveSkillPath(skillsDir, body);
        if (!skillPath || !fs.existsSync(skillPath)) {
          return {
            ok: false,
            snapshot: this.buildSnapshot(workspaceRoot, env),
            result: { ok: false, action: 'sign', error: 'skillDir / skillId required and must exist' },
          };
        }
        const key = String(
          body.signingKey || body.signing_key || env.ZAVORTH_SKILL_SIGNING_KEY || '',
        ).trim();
        if (!key) {
          return {
            ok: false,
            snapshot: this.buildSnapshot(workspaceRoot, env),
            result: {
              ok: false,
              action: 'sign',
              error: 'Provide signingKey or set ZAVORTH_SKILL_SIGNING_KEY',
            },
          };
        }
        const signed = ops.sign(skillPath, key);
        return {
          ok: signed.ok,
          snapshot: this.buildSnapshot(workspaceRoot, env),
          result: {
            ok: signed.ok,
            action: 'sign',
            skillId: path.basename(skillPath),
            sign: signed,
            message: signed.message,
            error: signed.ok ? undefined : signed.message,
          },
        };
      }

      if (action === 'publish_plan' || action === 'plan_publish') {
        const skillPath = this.resolveSkillPath(skillsDir, body);
        if (!skillPath || !fs.existsSync(skillPath)) {
          return {
            ok: false,
            snapshot: this.buildSnapshot(workspaceRoot, env),
            result: {
              ok: false,
              action: 'publish_plan',
              error: 'skillDir / skillId required and must exist',
            },
          };
        }
        const repoUrl =
          String(body.repoUrl || body.repo_url || env.ZAVORTH_SKILL_PUBLISH_REPO || '').trim() ||
          null;
        const outPath =
          String(body.outPath || body.out_path || '').trim() ||
          path.join(workspaceRoot, 'data', 'runtime', 'skill-registry', 'publish-plan.json');
        const written = ops.writePublishPlan(outPath, { skillDir: skillPath, repoUrl, env });
        if (written.ok === false) {
          return {
            ok: false,
            snapshot: this.buildSnapshot(workspaceRoot, env),
            result: {
              ok: false,
              action: 'publish_plan',
              error: written.message || 'publish_plan failed',
            },
          };
        }
        return {
          ok: written.plan.ok,
          snapshot: this.buildSnapshot(workspaceRoot, env),
          result: {
            ok: written.plan.ok,
            action: 'publish_plan',
            skillId: written.plan.skillId,
            plan: written.plan,
            planPath: written.path,
            message: written.plan.ok ? `Publish plan ready (dry-run, wouldPush=${written.plan.wouldPush})`
              : 'Publish plan not ready — see plan.messages / nextSteps',
          },
        };
      }

      return {
        ok: false,
        snapshot: this.buildSnapshot(workspaceRoot, env),
        result: {
          ok: false,
          action,
          error: `Unknown action "${action}". Available: refresh, verify, sign, export, publish_plan, trusted_hosts`,
        },
      };
    } catch (error: unknown) {
      return {
        ok: false,
        snapshot: this.buildSnapshot(workspaceRoot, env),
        result: {
          ok: false,
          action,
          error: errorMessage(error, 'Skill registry action failed'),
        },
      };
    }
  }

  public async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    _url: URL,
    pathname: string,
    deps: SkillRegistryHttpRouteDeps,
  ): Promise<boolean> {
    if (
      pathname !== '/api/skill-registry'
      && pathname !== '/api/skill-registry/snapshot'
      && pathname !== '/api/skill-registry/ops'
      && pathname !== '/api/skill-registry/actions'
    ) {
      return false;
    }

    const workspaceRoot = path.resolve(deps.workspaceRoot || this.projectRoot);

    if (
      (pathname === '/api/skill-registry'
        || pathname === '/api/skill-registry/snapshot'
        || pathname === '/api/skill-registry/ops')
      && (req.method === 'GET' || req.method === 'HEAD')
    ) {
      try {
        const snapshot = this.buildSnapshot(workspaceRoot);
        deps.writeJson(res, {
          ok: true,
          snapshot,
          schema: {
            index: ZAVORTH_SKILL_REGISTRY_INDEX_SCHEMA,
            publishPlan: ZAVORTH_SKILL_PUBLISH_PLAN_SCHEMA,
          },
        }, 200);
      } catch (error: unknown) {
        deps.writeJson(
          res,
          { ok: false, error: errorMessage(error, 'Failed to build skill registry snapshot') },
          500,
        );
      }
      return true;
    }

    if (pathname === '/api/skill-registry/actions' && req.method === 'POST') {
      try {
        const raw = await deps.readJsonBody(req);
        const body = raw as SkillRegistryHttpActionBody;
        const outcome = this.runAction(body, workspaceRoot);
        deps.writeJson(
          res,
          {
            ok: outcome.ok,
            snapshot: outcome.snapshot,
            result: outcome.result,
          },
          outcome.ok ? 200 : 400,
        );
      } catch (error: unknown) {
        deps.writeJson(
          res,
          { ok: false, error: errorMessage(error, 'Skill registry action failed') },
          500,
        );
      }
      return true;
    }

    deps.writeJson(res, { ok: false, error: 'Method not allowed' }, 405);
    return true;
  }
}
