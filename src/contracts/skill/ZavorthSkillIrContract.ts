/**
 * SkillIR — brand-agnostic intermediate representation for any ingested skill pack.
 * Parsers are shape-based (file layout), never product-name branches.
 */

export const ZAVORTH_SKILL_IR_CONTRACT_VERSION = '2026-07-14.skill-ir-w0' as const;

/** Shape-based parser ids (not brand names). */
export type ZavorthSkillIrParserId = 'skill-md-v1' | 'readme-tools-v1' | 'package-json-skill-v1' | 'opaque-guidance-v1';

export type ZavorthSkillIrProvenance = {
  uri: string;
  kind: string;
  digest: string;
  fetchedAt: string;
};

export type ZavorthSkillIrDeclaredTool = {
  name: string;
  description?: string;
  /** Optional synonyms declared by the pack (frontmatter aliases). */
  aliases?: string[];
};

export type ZavorthSkillIrPermission = {
  kind: string;
  reason?: string;
  required?: boolean;
};

export type ZavorthSkillIrEntrypoint = {
  kind: string;
  path?: string;
  command?: string;
};

export type ZavorthSkillIr = {
  contractVersion: typeof ZAVORTH_SKILL_IR_CONTRACT_VERSION;
  parserId: ZavorthSkillIrParserId;
  id: string;
  title: string;
  description: string;
  version: string | null;
  procedureMarkdown: string;
  declaredTools: ZavorthSkillIrDeclaredTool[];
  /** Flat alias map declaredName → preferred synonym list (from pack). */
  declaredAliases: Record<string, string[]>;
  permissions: ZavorthSkillIrPermission[];
  entrypoints: ZavorthSkillIrEntrypoint[];
  files: string[];
  provenance: ZavorthSkillIrProvenance;
  /** True when pack is guidance-only (no executable tool binds expected). */
  guidanceOnly: boolean;
  warnings: string[];
};

export type ZavorthSkillIrNormalizeResult = {
  ok: boolean;
  skillIr: ZavorthSkillIr;
  /** sha256 hex of canonical JSON of skillIr (stable fields). */
  skillIrDigest: string;
};
