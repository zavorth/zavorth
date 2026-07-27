#!/usr/bin/env tsx
import { ModelProviderExperienceService } from '../src/services/providers/catalog/ModelProviderExperienceService.js';

const asJson = process.argv.includes('--json');
const service = new ModelProviderExperienceService();
const snapshot = service.buildExperience({ includeAdvanced: true });

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('Zavorth Model Provider Experience');
  console.log(`Status: ${snapshot.status}`);
  console.log(`Essentials: ${snapshot.essentialCoverage.present}/${snapshot.essentialCoverage.required} present, ${snapshot.essentialCoverage.ready} ready`);
  console.log(`Power users: ${snapshot.powerUserCoverage.present}/${snapshot.powerUserCoverage.tracked} present, ${snapshot.powerUserCoverage.ready} ready`);
  for (const category of snapshot.categories) {
    const primary = category.primary ? `${category.primary.label} (${category.primary.modelLabel})`
      : category.emptyHint;
    console.log(`- ${category.label}: ${primary}`);
  }
}
