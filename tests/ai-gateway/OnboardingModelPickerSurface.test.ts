import { readFileSync } from 'fs';
import { join } from 'path';

const onboardingDir = join(
  process.cwd(),
  'src/ai-gateway/app/(dashboard)/dashboard/onboarding',
);

describe('Onboarding model picker surface', () => {
  it('loads the canonical picker and renders family, route and model choices', () => {
    const page = readFileSync(join(onboardingDir, 'page.tsx'), 'utf8');

    expect(page).toContain('/api/onboarding/model-picker');
    expect(page).toContain('pickerFamilies');
    expect(page).toContain('selectedFamilyId');
    expect(page).toContain('selectedRouteId');
    expect(page).toContain('selectedModelId');
    expect(page).toContain('route.explanation?.[1]');
    expect(page).toContain('defaultModel: selectedModel?.modelId || null');
  });

  it('keeps the onboarding API backed by the C7 Provider Mesh product service', () => {
    const route = readFileSync(
      join(process.cwd(), 'src/ai-gateway/app/api/onboarding/model-picker/route.ts'),
      'utf8',
    );

    expect(route).toContain('ProviderMeshOnboardingProductService');
    expect(route).toContain('selectedFamilyId');
    expect(route).toContain('selectedRouteId');
    expect(route).toContain('selectedModelId');
    expect(route).toContain('providerMeshOnboarding');
  });
});
