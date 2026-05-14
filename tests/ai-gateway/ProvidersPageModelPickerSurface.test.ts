import { readFileSync } from 'fs';
import { join } from 'path';

const providersDir = join(
  process.cwd(),
  'src/ai-gateway/app/(dashboard)/dashboard/providers',
);

describe('Providers page model picker surface', () => {
  it('loads the canonical picker and passes route metadata to provider cards', () => {
    const page = readFileSync(join(providersDir, 'page.tsx'), 'utf8');

    expect(page).toContain('/api/onboarding/model-picker?includeAdvanced=true');
    expect(page).toContain('ProvidersModelPickerSummary');
    expect(page).toContain('findPickerRouteForProvider(modelPicker, providerId)');
    expect(page).toContain('catalogSource');
    expect(page).toContain('fallbackRoutes');
  });

  it('renders picker route badges without making provider cards own catalog rules', () => {
    const cards = readFileSync(join(providersDir, 'provider-page-cards.tsx'), 'utf8');

    expect(cards).toContain('PickerRouteBadge');
    expect(cards).toContain('pickerRoute: pickerRouteShape');
    expect(cards).toContain('route.routeClass || route.routeKind');
    expect(cards).not.toContain('ModelPickerService');
  });
});
