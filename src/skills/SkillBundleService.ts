import type { SkillProvenanceMetadata } from './SkillCatalogContract.js';

type ResolveSkillBundleTagsInput = {
  name: string;
  description: string;
  supportFileCount: number;
  provenance?: SkillProvenanceMetadata | null;
};

type BundleRule = {
  tag: string;
  matchers: string[];
};

const BUNDLE_RULES: BundleRule[] = [
  { tag: 'security', matchers: ['security', 'threat', 'audit', 'secure'] },
  { tag: 'research', matchers: ['research', 'evidence', 'literature', 'discover'] },
  { tag: 'architecture', matchers: ['system-design', 'architecture', 'arquitetura', 'design'] },
  { tag: 'requirements', matchers: ['requirements', 'spec', 'requisitos', 'analysis'] },
  { tag: 'debugging', matchers: ['debug', 'failure', 'incident'] },
  { tag: 'browser', matchers: ['browser', 'chrome', 'devtools', 'web-quality'] },
  { tag: 'documentation', matchers: ['doc', 'document', 'technical-design'] },
  { tag: 'coding', matchers: ['code', 'codenavi', 'implementation'] },
  { tag: 'telegram', matchers: ['telegram'] },
  { tag: 'zavorthBridge', matchers: ['zavorthBridge'] },
  { tag: 'planning', matchers: ['orchestrator', 'planner', 'workflow'] },
];

export class SkillBundleService {
  public resolveBundleTags(input: ResolveSkillBundleTagsInput): string[] {
    const haystack = [
      input.name,
      input.description,
      input.provenance?.upstreamSourceId || '',
      input.provenance?.upstreamSourceLabel || '',
    ]
      .join(' ')
      .toLowerCase();
    const tags = new Set<string>(['skill']);

    if (input.supportFileCount > 0) {
      tags.add('with-support-files');
    }

    tags.add(input.provenance?.imported ? 'imported' : 'local');

    for (const rule of BUNDLE_RULES) {
      if (rule.matchers.some((matcher) => haystack.includes(matcher))) {
        tags.add(rule.tag);
      }
    }

    return Array.from(tags).sort((left, right) => left.localeCompare(right, 'en-US'));
  }
}
