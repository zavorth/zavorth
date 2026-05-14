import { readFileSync } from 'fs';
import { join } from 'path';

function readGatewayFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), 'src/ai-gateway', ...segments), 'utf8');
}

describe('client-side secret storage hardening', () => {
  it('does not persist selected CLI API keys in localStorage', () => {
    const defaultToolCard = readGatewayFile(
      'app/(dashboard)/dashboard/cli-tools/components/DefaultToolCard.tsx'
    );
    const copilotToolCard = readGatewayFile(
      'app/(dashboard)/dashboard/cli-tools/components/CopilotToolCard.tsx'
    );

    for (const source of [defaultToolCard, copilotToolCard]) {
      expect(source).toContain('readSessionBackedSecret');
      expect(source).toContain('writeSessionBackedSecret');
      expect(source).toContain('window.sessionStorage.setItem');
    }

    expect(defaultToolCard).not.toContain('localStorage.setItem(keyStorageKey');
    expect(copilotToolCard).not.toContain('localStorage.setItem(SELECTED_KEY_KEY');
  });

  it('does not broadcast OAuth callback codes to arbitrary opener origins', () => {
    const callbackPage = readGatewayFile('app/callback/page.tsx');
    const oauthModal = readGatewayFile('shared/components/oauth-modal/useOAuthModal.ts');

    expect(callbackPage).toContain('window.opener.postMessage');
    expect(callbackPage).toContain('targetOrigin');
    expect(callbackPage).not.toContain('postMessage({ type: "oauth_callback", data: callbackData }, "*")');
    expect(callbackPage).toContain('localStorage.removeItem("oauth_callback")');
    expect(oauthModal).toContain('isAcceptedCallbackOrigin');
  });
});
