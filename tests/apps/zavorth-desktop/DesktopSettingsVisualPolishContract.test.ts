import fs from 'node:fs';
import path from 'node:path';

describe('Desktop settings visual polish contract', () => {
  it('keeps settings status metadata quiet instead of green or orange pills', () => {
    const overlay = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/src/components/SettingsOverlay.tsx'),
      'utf8',
    );

    expect(overlay).toContain('.zvd-settings-status--ready');
    expect(overlay).toContain('.zvd-settings-status--attention');
    expect(overlay).toContain('color: #8b8b92');
    expect(overlay).not.toContain('rgba(34, 197, 94');
    expect(overlay).not.toContain('rgba(241, 106, 33');
    expect(overlay).not.toContain('color: #4ade80');
    expect(overlay).not.toContain('color: #fb923c');
  });

  it('uses a dedicated premium provider settings surface instead of raw utility styling', () => {
    const providers = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/src/panels/ProviderSettingsPanel.tsx'),
      'utf8',
    );

    expect(providers).toContain('zvd-provider-settings');
    expect(providers).toContain('zvd-provider-empty');
    expect(providers).toContain('Conectar provider');
    expect(providers).not.toContain('text-blue-500');
    expect(providers).not.toContain('bg-blue-600');
    expect(providers).not.toContain('bg-gray-800');
    expect(providers).not.toContain('border-dashed border-gray-700');
  });
});
