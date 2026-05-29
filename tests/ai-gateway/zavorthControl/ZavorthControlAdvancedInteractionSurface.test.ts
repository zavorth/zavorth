import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

describe('ZavorthControl Zavorth-native advanced surface', () => {
  it('wires the zavorthControl projection, cards, queue and reconnect affordances', () => {
    const contract = read('src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/contracts/zavorthControlAdvancedInteractionContracts.ts');
    const panel = read('src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/components/ZavorthControlAdvancedInteractionPanel.tsx');
    const chat = read('src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/components/ZavorthControlChatSurface.tsx');
    const hook = read('src/ai-gateway/app/(zavorthControl)/zavorthControl/useControlPageClient.ts');
    const shell = read('src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/components/ZavorthControlControlShell.tsx');
    const css = read('src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/styles/zavorthControl.css');

    expect(contract).toContain('zavorth-control-advanced-interaction/v1');
    expect(contract).toContain('ZavorthControlAdvancedInteractionToolCallCard');
    expect(contract).toContain('ZavorthControlAdvancedInteractionSubagentCard');
    expect(contract).toContain('ZavorthControlAdvancedInteractionContextMeter');
    expect(contract).toContain('ZavorthControlAdvancedInteractionMermaidDiagram');
    expect(contract).toContain('ZavorthControlAdvancedInteractionMessageQueueItem');

    expect(panel).toContain('buildZavorthControlAdvancedInteractionProjection');
    expect(panel).toContain('ZavorthControlToolCallCards');
    expect(panel).toContain('ZavorthControlSubagentCards');
    expect(panel).toContain('ZavorthControlRichApprovalCards');
    expect(panel).toContain('ZavorthControlMermaidRenderer');
    expect(panel).toContain('ZavorthControlMessageQueue');

    expect(chat).toContain('<ZavorthControlAdvancedInteractionPanel');
    expect(chat).toContain('Retry draft');
    expect(chat).toContain('Message actions');
    expect(shell).toContain('wsReconnectAttempt={model.wsReconnectAttempt}');
    expect(hook).toContain('scheduleReconnect');
    expect(hook).toContain('reconnectTimeoutRef');
    expect(css).toContain('.bcc-advanced-interaction');
    expect(css).toContain('.bcc-context-meter');
    expect(css).toContain('.bcc-mermaid-render');
  });
});
