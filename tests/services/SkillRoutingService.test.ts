import { SkillRoutingService } from '../../src/services/SkillRoutingService';

describe('SkillRoutingService', () => {
  it('prioritizes codenavi for code review and keeps security-threat-model as support when security is in scope', () => {
    const service = new SkillRoutingService({
      skillCatalogService: {
        listEntries: () => [
          {
            id: 'skill:codenavi',
            name: 'codenavi',
            description: 'Navigate and review large codebases safely.',
            sourceId: 'workspace-imported-library',
            sourceLabel: 'Imported',
            sourceTrust: 'review',
            license: 'mixed',
            imported: true,
            bundleTags: ['coding', 'planning', 'with-support-files'],
            supportFileCount: 2,
            dirPath: 'C:/skills/codenavi',
            skillFilePath: 'C:/skills/codenavi/SKILL.md',
            searchText: 'codenavi code review debugging implementation coding planning',
            provenance: null,
            metadata: {} as any,
          },
          {
            id: 'skill:security-threat-model',
            name: 'security-threat-model',
            description: 'Threat model a codebase with repo evidence.',
            sourceId: 'workspace-imported-library',
            sourceLabel: 'Imported',
            sourceTrust: 'review',
            license: 'mixed',
            imported: true,
            bundleTags: ['security', 'coding', 'planning'],
            supportFileCount: 3,
            dirPath: 'C:/skills/security-threat-model',
            skillFilePath: 'C:/skills/security-threat-model/SKILL.md',
            searchText: 'security threat model codebase auth permission risk review',
            provenance: null,
            metadata: {} as any,
          },
        ],
      },
    });

    const decision = service.recommend({
      taskGoal: 'review the auth flow and identify permission risks',
      taskKind: 'code',
      taskSubtype: 'review',
      modeHint: 'planner',
    });

    expect(decision.primarySkill?.name).toBe('codenavi');
    expect(decision.supportingSkills.map((entry) => entry.name)).toContain('security-threat-model');
    expect(decision.matchedBundleTags).toEqual(expect.arrayContaining(['coding', 'security']));
  });

  it('prioritizes chrome-devtools for browser-facing audits', () => {
    const service = new SkillRoutingService({
      skillCatalogService: {
        listEntries: () => [
          {
            id: 'skill:chrome-devtools',
            name: 'chrome-devtools',
            description: 'Browser debugging workflow.',
            sourceId: 'workspace-imported-library',
            sourceLabel: 'Imported',
            sourceTrust: 'review',
            license: 'mixed',
            imported: true,
            bundleTags: ['browser', 'debugging', 'planning'],
            supportFileCount: 2,
            dirPath: 'C:/skills/chrome-devtools',
            skillFilePath: 'C:/skills/chrome-devtools/SKILL.md',
            searchText: 'browser chrome devtools screenshot network console lighthouse web audit',
            provenance: null,
            metadata: {} as any,
          },
        ],
      },
    });

    const decision = service.recommend({
      taskGoal: 'audit meu site, confira performance, console e network no browser',
      taskKind: 'automation',
      taskSubtype: 'navigation',
      modeHint: 'graph',
    });

    expect(decision.primarySkill?.name).toBe('chrome-devtools');
    expect(decision.matchedBundleTags).toEqual(expect.arrayContaining(['browser']));
  });
});
