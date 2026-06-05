import {
  MCP_ECOSYSTEM_INTAKE_VERSION,
  type McpEcosystemIntakeSnapshot,
  type McpEcosystemItem,
} from '../contracts/McpEcosystemIntakeContract.js';
import { UniversalSkillIntakeService } from '../skills/UniversalSkillIntakeService.js';

type McpEcosystemIntakeDeps = {
  now?: () => Date;
  universalSkillIntake?: Pick<UniversalSkillIntakeService, 'previewSource'>;
};

export class McpEcosystemIntakeService {
  private readonly now: () => Date;
  private readonly universalSkillIntake: Pick<UniversalSkillIntakeService, 'previewSource'>;

  constructor(deps: McpEcosystemIntakeDeps = {}) {
    this.now = deps.now || (() => new Date());
    this.universalSkillIntake = deps.universalSkillIntake || new UniversalSkillIntakeService();
  }

  public async buildSnapshot(input: { sourcePath: string; sourceLabel?: string | null }): Promise<McpEcosystemIntakeSnapshot> {
    const preview = await this.universalSkillIntake.previewSource({
      sourcePath: input.sourcePath,
      sourceLabel: input.sourceLabel || 'MCP ecosystem source',
    });
    const items = preview.candidates
      .filter((candidate) => candidate.manifest.sourceProfileId === 'mcp-tool-pack' || candidate.manifest.capabilityTags.includes('mcp'))
      .map((candidate): McpEcosystemItem => {
        const risk = riskFor(candidate.manifest.permissionProfileId, candidate.status);
        return {
          id: candidate.id,
          name: candidate.manifest.name,
          status: candidate.status === 'blocked' ? 'blocked' : 'quarantined',
          risk,
          toolNames: candidate.manifest.declaredTools,
          sourceProfileId: candidate.manifest.sourceProfileId,
          permissionProfileId: candidate.manifest.permissionProfileId,
          installCommand: `zavorth mcp intake install ${candidate.id} --approval-id <id>`,
          reviewCommand: `zavorth mcp intake review ${candidate.id}`,
          reasons: [
            candidate.blockedReason || 'External MCP candidate stays quarantined until review.',
            ...candidate.issues.map((issue) => `${issue.code}:${issue.severity}`),
          ],
        };
      });
    return {
      generatedAt: this.now().toISOString(),
      version: MCP_ECOSYSTEM_INTAKE_VERSION,
      status: preview.status,
      sourcePath: preview.source.path,
      items,
      summary: {
        scannedCandidates: preview.summary.candidates,
        mcpCandidates: items.length,
        blocked: items.filter((item) => item.status === 'blocked').length,
        quarantined: items.filter((item) => item.status === 'quarantined').length,
        executableToolsExposed: 0,
      },
      policy: {
        previewOnly: true,
        noInstallPerformed: true,
        noExecutionPerformed: true,
        externalMcpNeverTrustedAutomatically: true,
        quarantineBeforeToolExposure: true,
        approvalRequiredForPromotion: true,
        rawSecretsSerialized: false,
      },
      commands: {
        preview: 'npm run zavorth:mcp-ecosystem-intake -- --source <path>',
        review: 'zavorth mcp intake review <candidate>',
        promote: 'zavorth mcp intake promote <candidate> --approval-id <id>',
        forget: 'zavorth mcp intake forget <candidate>',
      },
    };
  }

  public renderText(snapshot: McpEcosystemIntakeSnapshot): string {
    return [
      'Zavorth MCP Ecosystem Intake',
      '',
      `Status: ${snapshot.status}`,
      `MCP candidates: ${snapshot.summary.mcpCandidates}; quarantined=${snapshot.summary.quarantined}; blocked=${snapshot.summary.blocked}`,
      '',
      ...snapshot.items.map((item) =>
        `- ${item.name}: ${item.status} | risk=${item.risk} | tools=${item.toolNames.join(',') || 'none'} | ${item.reviewCommand}`),
    ].join('\n');
  }
}

function riskFor(permissionProfileId: string, status: string): McpEcosystemItem['risk'] {
  if (status === 'blocked' || permissionProfileId === 'blocked') return 'high';
  if (/tool|connector|network|write|secret/i.test(permissionProfileId)) return 'medium';
  return 'low';
}
