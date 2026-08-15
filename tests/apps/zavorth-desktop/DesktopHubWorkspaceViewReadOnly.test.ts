import React from 'react';

// Lightweight mock DOM (reuse pattern from previous desktop tests)
class MockElement {
  nodeType = 1;
  tagName: string;
  className = '';
  style = {};
  childNodes: any[] = [];
  parentNode: any = null;
  attributes: Record<string, string> = {};
  listeners: Record<string, any> = {};
  ownerDocument: any = null;

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = mockDocument;
  }

  get options() {
    return this.childNodes.filter(n => n.tagName === 'OPTION');
  }

  appendChild(child: any) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  removeChild(child: any) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  insertBefore(child: any, reference: any) {
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

  addEventListener(type: string, handler: any) {
    this.listeners[type] = handler;
  }

  removeEventListener(type: string) {
    delete this.listeners[type];
  }

  click() {
    let current: any = this;
    const event = {
      target: this,
      currentTarget: this,
      stopPropagation() { (this as any)._stopped = true; },
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
      if ((event as any)._stopped) break;
      current = current.parentNode;
    }
  }

  get textContent(): string {
    return this.childNodes.map((n: any) => n.textContent || '').join('');
  }

  set textContent(value: string) {
    this.childNodes = [new MockTextNode(value)];
  }

  get innerHTML(): string {
    const attrs = Object.entries(this.attributes)
      .map(([k, v]) => ` ${k}="${v}"`)
      .join('');
    const children = this.childNodes.map((c: any) => c.innerHTML || '').join('');
    return `<${this.tagName.toLowerCase()}${attrs}>${children}</${this.tagName.toLowerCase()}>`;
  }

  querySelector(selector: string): any {
    if (!selector.startsWith('.') && !selector.startsWith('[')) {
      if (this.tagName.toLowerCase() === selector.toLowerCase()) return this;
    }
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      if (this.className.split(' ').includes(cls)) return this;
    }
    for (const child of this.childNodes) {
      if (child.querySelector) {
        const found = child.querySelector(selector);
        if (found) return found;
      }
    }
    return null;
  }

  querySelectorAll(selector: string): any[] {
    const results: any[] = [];
    this._collectAll(selector, results);
    return results;
  }

  private _collectAll(selector: string, results: any[]) {
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
  parentNode: any = null;
  ownerDocument: any = null;

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
  body: null as any,
  documentElement: null as any,
  activeElement: null as any,
  listeners: {} as Record<string, any>,
  addEventListener(type: string, handler: any) { this.listeners[type] = handler; },
  removeEventListener(type: string) { delete this.listeners[type]; },
};

mockDocument.body = new MockElement('body');
mockDocument.documentElement = new MockElement('html');
mockDocument.body.parentNode = mockDocument.documentElement;
mockDocument.documentElement.parentNode = mockDocument as any;

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
  listeners: {} as Record<string, any>,
  addEventListener(type: string, handler: any) { this.listeners[type] = handler; },
  removeEventListener(type: string) { delete this.listeners[type]; },
};

(global as any).window = mockWindow;
(global as any).document = mockDocument;
(global as any).navigator = mockWindow.navigator;
(global as any).HTMLElement = MockElement;
(global as any).HTMLDivElement = MockElement;
(global as any).HTMLButtonElement = MockElement;
(global as any).HTMLIFrameElement = MockElement;
(global as any).HTMLInputElement = MockElement;
(global as any).HTMLTextAreaElement = MockElement;
(global as any).HTMLSelectElement = MockElement;
(global as any).MouseEvent = mockWindow.MouseEvent;
(global as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 0);
(global as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
(global as any).IS_REACT_ACT_ENVIRONMENT = true;

// Imports
import fs from 'node:fs';
import path from 'node:path';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

// Mock icons
const iconsPath = path.resolve('apps/zavorth-desktop/src/icons');
const mockIconsFn = () => {
  const R = require('react');
  const Dummy = (p: any) => R.createElement('span', p);
  return { AppWindow: Dummy, Folder: Dummy, Terminal: Dummy, ChevronDown: Dummy, File: Dummy };
};
jest.doMock(iconsPath, mockIconsFn);
jest.doMock(iconsPath + '.ts', mockIconsFn);
jest.doMock('../../../apps/zavorth-desktop/src/icons', mockIconsFn);

// Import components
const { HubWorkspaceView } = require('../../../apps/zavorth-desktop/src/hub-skin/HubWorkspaceView');

describe('HubWorkspaceView Safe Integration', () => {
  let container: MockElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = mockDocument.createElement('div') as any;
    mockDocument.body.appendChild(container);
    root = createRoot(container as any);
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
    const gitStatus = require('child_process').execSync('git status --short').toString();
    expect(gitStatus).not.toContain('App.tsx');
  });
});

