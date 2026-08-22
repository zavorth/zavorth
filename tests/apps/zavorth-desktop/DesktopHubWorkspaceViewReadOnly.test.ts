import React from 'react';

// Lightweight mock DOM (reuse pattern from previous desktop tests)
class MockElement {
  nodeType = 1;
  tagName: string;
  className = '';
  style = {};
  childNodes: unknown[] = [];
  parentNode: MockElement | MockTextNode | null = null;
  attributes: Record<string, string> = {};
  listeners: Record<string, (...args: unknown[]) => void> = {};
  ownerDocument: MockElement | null = null;

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = mockDocument;
  }

  get options() {
    return this.childNodes.filter(n => n.tagName === 'OPTION');
  }

  appendChild(child: MockElement | MockTextNode) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  removeChild(child: MockElement | MockTextNode) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  insertBefore(child: MockElement | MockTextNode, reference: MockElement | MockTextNode) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    const idx = this.childNodes.indexOf(reference);
    if (idx !== -1) {
      this.childNodes.splice(idx, 0, child);
    } else {
      this.childNodes.push(child);
    }
    return child;
  }

  setAttribute(name: string, value: string) {
    this.attributes[name] = String(value);
    if (name === 'class') this.className = String(value);
  }

  removeAttribute(name: string) {
    delete this.attributes[name];
    if (name === 'class') this.className = '';
  }

  addEventListener(type: string, handler: (...args: unknown[]) => void) {
    this.listeners[type] = handler;
  }

  removeEventListener(type: string) {
    delete this.listeners[type];
  }

  click() {
    let current: MockElement | MockTextNode | null = this;
    const event = {
      target: this,
      currentTarget: this,
      stopPropagation() { (event as unknown as { _stopped: boolean })._stopped = true; },
      preventDefault() {},
      _stopped: false,
      type: 'click',
      bubbles: true,
      cancelable: true,
    };
    while (current) {
      event.currentTarget = current;
      const propsKey = Object.keys(current).find(k => k.startsWith('__reactProps'));
      if (propsKey) {
        const rProps = current[propsKey];
        if (rProps?.onClick) {
          try { rProps.onClick(event); } catch (error: unknown) { /* ignore */ }
        }
      }
      if ((event as unknown as { _stopped: boolean })._stopped) break;
      current = current.parentNode as MockElement | MockTextNode | null;
    }
  }

  get textContent(): string {
    return this.childNodes.map((n: MockElement | MockTextNode) => n.textContent || '').join('');
  }

  set textContent(value: string) {
    this.childNodes = [new MockTextNode(value)];
  }

  get innerHTML(): string {
    const attrs = Object.entries(this.attributes)
      .map(([k, v]) => ` ${k}="${v}"`)
      .join('');
    const children = this.childNodes.map((c: MockElement | MockTextNode) => c.innerHTML || '').join('');
    return `<${this.tagName.toLowerCase()}${attrs}>${children}</${this.tagName.toLowerCase()}>`;
  }

  querySelector(selector: string): MockElement | null {
    if (!selector.startsWith('.') && !selector.startsWith('[')) {
      if (this.tagName.toLowerCase() === selector.toLowerCase()) return this;
    }
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      if (this.className.split(' ').includes(cls)) return this;
    }
    for (const child of this.childNodes) {
      if ((child as MockElement).querySelector) {
        const found = (child as MockElement).querySelector(selector);
        if (found) return found;
      }
    }
    return null;
  }

  querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    this._collectAll(selector, results);
    return results;
  }

  private _collectAll(selector: string, results: MockElement[]) {
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      if (this.className.split(' ').includes(cls)) results.push(this);
    } else if (!selector.startsWith('[')) {
      if (this.tagName.toLowerCase() === selector.toLowerCase()) results.push(this);
    }
    for (const child of this.childNodes) {
      if (child._collectAll) child._collectAll(selector, results);
    }
  }
}

class MockTextNode {
  nodeType = 3;
  nodeValue: string;
  parentNode: MockElement | MockTextNode | null = null;
  ownerDocument: MockElement | null = null;

  constructor(value: string) {
    this.nodeValue = value;
    this.ownerDocument = mockDocument;
  }

  get textContent() { return this.nodeValue; }
  set textContent(v: string) { this.nodeValue = v; }
  get innerHTML() { return this.nodeValue; }
}

const mockDocument = {
  nodeType: 9,
  createElement: (tag: string) => new MockElement(tag),
  createElementNS: (_ns: string, tag: string) => new MockElement(tag),
  createTextNode: (text: string) => new MockTextNode(text),
  createComment: () => ({ nodeType: 8, ownerDocument: mockDocument }),
  createDocumentFragment: () => {
    const f = new MockElement('fragment');
    f.nodeType = 11;
    return f;
  },
  body: null as MockElement | null,
  documentElement: null as MockElement | null,
  activeElement: null as MockElement | null,
  listeners: {} as Record<string, (...args: unknown[]) => void>,
  addEventListener(type: string, handler: (...args: unknown[]) => void) { this.listeners[type] = handler; },
  removeEventListener(type: string) { delete this.listeners[type]; },
};

mockDocument.body = new MockElement('body');
mockDocument.documentElement = new MockElement('html');
mockDocument.body.parentNode = mockDocument.documentElement;
mockDocument.documentElement.parentNode = mockDocument as unknown as MockElement;

const mockWindow = {
  document: mockDocument,
  navigator: { userAgent: 'node' },
  HTMLElement: MockElement,
  HTMLDivElement: MockElement,
  HTMLButtonElement: MockElement,
  HTMLIFrameElement: MockElement,
  HTMLInputElement: MockElement,
  HTMLTextAreaElement: MockElement,
  HTMLSelectElement: MockElement,
  MouseEvent: class {},
  listeners: {} as Record<string, (...args: unknown[]) => void>,
  addEventListener(type: string, handler: (...args: unknown[]) => void) { this.listeners[type] = handler; },
  removeEventListener(type: string) { delete this.listeners[type]; },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as Record<string, unknown>).window = mockWindow;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as Record<string, unknown>).document = mockDocument;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as Record<string, unknown>).navigator = mockWindow.navigator;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as Record<string, unknown>).HTMLElement = MockElement;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as Record<string, unknown>).HTMLDivElement = MockElement;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as Record<string, unknown>).HTMLButtonElement = MockElement;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as Record<string, unknown>).HTMLIFrameElement = MockElement;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as Record<string, unknown>).HTMLInputElement = MockElement;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as Record<string, unknown>).HTMLTextAreaElement = MockElement;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as Record<string, unknown>).HTMLSelectElement = MockElement;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as Record<string, unknown>).MouseEvent = mockWindow.MouseEvent;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as Record<string, unknown>).requestAnimationFrame = (cb: (...args: unknown[]) => void) => setTimeout(cb, 0);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as Record<string, unknown>).cancelAnimationFrame = (id: ReturnType<typeof setTimeout>) => clearTimeout(id);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// Imports
import fs from 'node:fs';
import path from 'node:path';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { execSync } from 'child_process';
import { HubWorkspaceView } from '../../../apps/zavorth-desktop/src/hub-skin/HubWorkspaceView';

// Mock icons
const iconsPath = path.resolve('apps/zavorth-desktop/src/icons');
const mockIconsFn = () => {
  const R = React;
  const Dummy = (p: Record<string, unknown>) => R.createElement('span', p);
  return { AppWindow: Dummy, Folder: Dummy, Terminal: Dummy, ChevronDown: Dummy, File: Dummy };
};
jest.doMock(iconsPath, mockIconsFn);
jest.doMock(iconsPath + '.ts', mockIconsFn);
jest.doMock('../../../apps/zavorth-desktop/src/icons', mockIconsFn);

describe('HubWorkspaceView Safe Integration', () => {
  let container: MockElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = mockDocument.createElement('div') as unknown as MockElement;
    mockDocument.body.appendChild(container);
    root = createRoot(container as unknown as Element);
  });

  afterEach(() => {
    if (root) {
      act(() => { root!.unmount(); });
      root = null;
    }
    if (container?.parentNode) {
      container.parentNode.removeChild(container);
      container = null;
    }
  });

  const baseProps = {
    accent: 'orange' as const,
    approvals: [],
    busy: false,
    channels: [],
    encryptionReceipt: null,
    encryptionStatus: null,
    events: [],
    effort: 'medium',
    learning: [],
    memoryItems: [],
    nexusStatus: 'available',
    profile: 'daily',
    runtimeCapabilities: {
      contractVersion: '1.2.3',
      capabilities: { summary: { available: 5, configurable: 2, blocked: 0 } },
      providers: { connected: [] },
      permissions: { domains: {} },
      workspace: { path: '', label: 'Chat', isolation: 'chat' },
      mcpTrust: { servers: [] },
      skillHistory: { entries: [] },
      personalOps: { connectors: [] },
    },
    status: { running: true, baseUrl: 'http://localhost:3000', message: 'OK' },
    theme: 'dark' as const,
    tools: [],
    onAccessRepair: () => {},
    onAccent: () => {},
    onEffort: () => {},
    onEncryptionAction: () => Promise.resolve(),
    onLearningDecision: () => Promise.resolve(),
    onProfile: () => {},
    onReviewDecision: () => Promise.resolve(),
    onRuntimeStart: () => Promise.resolve(),
    onRuntimeStateAction: () => Promise.resolve(),
    onTheme: () => {},
  };

  it('renders section corresponding to approvals', () => {
    act(() => {
      root!.render(
        React.createElement(HubWorkspaceView, {
          ...baseProps,
          activePanel: 'approvals',
          approvals: [{ id: 'app-1', title: 'Test write', action: 'write', risk: 'medium', status: 'pending', createdAt: '2026-01-01T00:00:00Z' }],
        })
      );
    });

    const html = container!.innerHTML;
    expect(html).toContain('Pending');
    expect(html).toContain('Test write');
  });

  it('renders section corresponding to memory', () => {
    act(() => {
      root!.render(
        React.createElement(HubWorkspaceView, {
          ...baseProps,
          activePanel: 'memory',
          memoryItems: [{ receiptId: 'rec-1', title: 'Local settings', kind: 'preferences' }],
        })
      );
    });

    const html = container!.innerHTML;
    expect(html).toContain('Local settings');
    expect(html).toContain('Learned context, candidates, and local memory protection.');
  });

  it('renders default grid sections (settings, personalization, automations)', () => {
    act(() => {
      root!.render(
        React.createElement(HubWorkspaceView, {
          ...baseProps,
          activePanel: 'settings',
        })
      );
    });

    const html = container!.innerHTML;
    // English hub shell labels after product rewrite.
    expect(html).toMatch(/Settings|Configuracoes/i);
    expect(html).toMatch(/Personalization|Personalizacao|Workspace|Trust|Daily/i);
    expect(html).toMatch(/Automations|Automacoes|Slash Commands|Power/i);
  });

  it('renders section corresponding to skills', () => {
    act(() => {
      root!.render(
        React.createElement(HubWorkspaceView, {
          ...baseProps,
          activePanel: 'skills',
          tools: [{ name: 'read_file', description: 'Read a file' }],
        })
      );
    });

    const html = container!.innerHTML;
    expect(html).toContain('read_file');
    expect(html).toContain('Skills');
  });

  it('renders section corresponding to channels', () => {
    act(() => {
      root!.render(
        React.createElement(HubWorkspaceView, {
          ...baseProps,
          activePanel: 'channels',
          channels: [{ id: 'ch-1', name: 'general', provider: 'slack' }],
        })
      );
    });

    const html = container!.innerHTML;
    expect(html).toContain('general');
    expect(html).toContain('Channels');
  });

  it('performs static analysis checks to guarantee compliance', () => {
    const code = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/src/hub-skin/HubWorkspaceView.tsx'),
      'utf8'
    );

    // 1. Forbidden imports / references
    const forbiddenImports = [
      'HubNativeShell',
      'InteractiveTerminal',
      'window.zavorthDesktop',
      'fs',
      'child_process',
      'spawn',
      'exec',
      'pty',
      'axios',
      'fetch',
      'localStorage',
      'sessionStorage'
    ];

    for (const term of forbiddenImports) {
      expect(code).not.toContain(term);
    }

    // 2. Forbidden mutant callbacks (should not accept or destructure/use them from props)
    const forbiddenCallbacks = [
      'onDecision',
      'onApprove',
      'onReject',
      'onLearningDecision',
      'onReviewDecision',
      'onEncryptionAction',
      'onAccessRepair',
      'onStart',
      'onRepair',
      'onTrustChange',
      'onProviderSetup',
      'onDelete',
      'onWrite',
      'onSave'
    ];

    for (const cb of forbiddenCallbacks) {
      // It should not access them on props (e.g. `props.onApprove`)
      expect(code).not.toContain(`props.${cb}`);
    }

    // 3. Forbidden mutant buttons/links
    const forbiddenButtons = [
      'Approve',
      'Reject',
      'Allow',
      'Deny',
      'Forget',
      'Delete',
      'Save',
      'Write',
      'Encrypt',
      'Rollback',
      'Preview',
      'Connect',
      'Disconnect',
      'Enable',
      'Disable',
      'Trust',
      'Untrust',
      'Start',
      'Repair',
      'Setup',
      'Execute',
      'Index',
      'Select',
      'Receipt'
    ];

    for (const btn of forbiddenButtons) {
      // Check that code does not contain hardcoded mutant buttons or labels
      expect(code).not.toContain(`>${btn}<`);
      expect(code).not.toContain(`"${btn}"`);
      expect(code).not.toContain(`'${btn}'`);
    }
  });

  it('ensures App.tsx was not modified/added to git changes', () => {
    const gitStatus = execSync('git status --short').toString();
    expect(gitStatus).not.toContain('App.tsx');
  });
});

