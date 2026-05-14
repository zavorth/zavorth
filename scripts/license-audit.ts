import { SkillCatalogService } from '../src/skills/SkillCatalogService.js';
import { LicensePolicyService } from '../src/skills/LicensePolicyService.js';

async function main(): Promise<void> {
  const catalog = new SkillCatalogService();
  const policyService = new LicensePolicyService();
  const entries = catalog.listEntries();
  const summarized = entries.map((entry) => ({
    name: entry.name,
    imported: entry.imported,
    license: entry.license,
    policy: entry.licensePolicy || policyService.evaluateClassification({
      license: entry.license,
      confidence: 'low',
      evidence: [],
    }),
  }));

  const grouped = new Map<string, string[]>();
  for (const entry of summarized) {
    if (!grouped.has(entry.policy.label)) {
      grouped.set(entry.policy.label, []);
    }
    grouped.get(entry.policy.label)?.push(entry.name);
  }

  const lines = [
    'Zavorth License Audit',
    '',
    `Catalog entries: ${summarized.length}`,
    `Review required: ${summarized.filter((entry) => entry.policy.reviewRequired).length}`,
    '',
    'Labels:',
  ];

  for (const [label, names] of Array.from(grouped.entries()).sort((left, right) => left[0].localeCompare(right[0], 'en-US'))) {
    lines.push(`- ${label}: ${names.length}`);
  }

  lines.push('', 'Review queue:');
  for (const entry of summarized.filter((item) => item.policy.reviewRequired)) {
    lines.push(`- ${entry.name}: ${entry.license || 'n/a'} -> ${entry.policy.summary}`);
  }

  console.log(lines.join('\n'));
}

main().catch((error) => {
  console.error(`[license-audit] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
