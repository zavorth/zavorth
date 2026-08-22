import React from 'react';

// Lightweight mock DOM (reuse pattern from DesktopReadOnlyFileExplorer.test.ts)
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

// Imports (after globals are set)
import fs from 'node:fs';
import path from 'node:path';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { SettingsPanel } from '../../../apps/zavorth-desktop/src/views/panels/SettingsPanel';
import { MemoryPanel } from '../../../apps/zavorth-desktop/src/views/panels/MemoryPanel';

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

describe('SettingsPanel and MemoryPanel Read-Only Rewrite', () => {
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

  it('renders SettingsPanel and MemoryPanel and verifies they contain namespaced classes', () => {
    const mockCapabilities = {
      contractVersion: '1.2.3',
      capabilities: { summary: { available: 5, configurable: 2, blocked: 0 } },
      providers: { connected: [{ id: 'openai', label: 'OpenAI', status: 'configured', targetHost: 'api.openai.com' }] },
      permissions: { domains: { workspace: { label: 'Workspace', actions: { write: { requiresApproval: true } } } } },
      workspace: { path: 'C:\\workspace', label: 'My Workspace', isolation: 'sandbox' },
      mcpTrust: { servers: [{ id: 'mcp-1', label: 'Server 1', toolNames: ['tool1'], trustState: 'trusted' }] },
      skillHistory: { entries: [] },
      personalOps: { connectors: [] },
    };

    act(() => {
      root!.render(
        React.createElement(SettingsPanel, {
          events: [],
          nexusStatus: 'available',
          runtimeCapabilities: mockCapabilities,
          status: { running: true, baseUrl: 'http://localhost:3000', message: 'OK' },
        })
      );
    });

    const settingsContainer = container!.querySelector('.zavorth-settings-panel');
    expect(settingsContainer).not.toBeNull();
    const htmlOutput = container!.innerHTML;
    expect(htmlOutput).toContain('Configurations');
    expect(htmlOutput).toContain('Runtime reachable');
    expect(htmlOutput).not.toContain('C:\\workspace'); // Should be sanitized/truncated/replaced

    act(() => {
      root!.render(
        React.createElement(MemoryPanel, {
          encryptionReceipt: null,
          encryptionStatus: { fullFileEncrypted: true, safeForDailyUse: true, atRestEncryptionMode: 'AES-GCM' },
          items: [{ receiptId: 'rec-1', title: 'User preferences', kind: 'preferences' }],
          learning: [],
        })
      );
    });

    const memoryContainer = container!.querySelector('.zavorth-memory-panel');
    expect(memoryContainer).not.toBeNull();
    const memoryHtml = container!.innerHTML;
    expect(memoryHtml).toContain('User preferences');
    expect(memoryHtml).toContain('Learned context, candidates, and local memory protection.');
  });

  it('does not render forbidden mutation buttons', () => {
    const mockCapabilities = {
      contractVersion: '1.2.3',
      capabilities: { summary: { available: 5, configurable: 2, blocked: 0 } },
      providers: { connected: [{ id: 'openai', label: 'OpenAI', status: 'configured', targetHost: 'api.openai.com' }] },
      permissions: { domains: { workspace: { label: 'Workspace', actions: { write: { requiresApproval: true } } } } },
      workspace: { path: 'C:\\workspace', label: 'My Workspace', isolation: 'sandbox' },
      mcpTrust: { servers: [{ id: 'mcp-1', label: 'Server 1', toolNames: ['tool1'], trustState: 'trusted' }] },
      skillHistory: { entries: [] },
      personalOps: { connectors: [{ id: 'gmail', label: 'Gmail', status: 'configured', enabled: true }] },
    };

    act(() => {
      root!.render(
        React.createElement(SettingsPanel, {
          events: [],
          nexusStatus: 'available',
          runtimeCapabilities: mockCapabilities,
          status: { running: true, baseUrl: 'http://localhost:3000', message: 'OK' },
        })
      );
    });

    // Forbidden words list
    const forbidden = [
      'approve', 'reject', 'allow', 'deny', 'forget', 'delete',
      'save', 'write', 'encrypt', 'rollback', 'preview',
      'connect', 'disconnect', 'enable', 'disable', 'trust',
      'untrust', 'start', 'repair', 'setup', 'execute', 'index',
      'select', 'receipt'
    ];

    // Verify no button elements contain forbidden mutation terms.
    const buttons = container!.querySelectorAll('button');
    for (const btn of buttons) {
      const text = btn.textContent.toLowerCase();
      for (const word of forbidden) {
        if (text === 'overview' || text === 'permissions' || text === 'providers' || text === 'mcp' || text === 'skills' || text === 'personal ops') {
          continue;
        }
        expect(text).not.toContain(word);
      }
    }
  });

  it('performs static analysis on panels to verify safety', () => {
    const settingsCode = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/src/views/panels/SettingsPanel.tsx'),
      'utf8'
    );
    const memoryCode = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/src/views/panels/MemoryPanel.tsx'),
      'utf8'
    );

    // Verify no forbidden imports/calls
    const forbiddenPatterns = [
      'connectGooglePersonalOps',
      'ipcRenderer',
      'child_process',
      'localStorage',
      'sessionStorage',
      'fetch(',
      'axios'
    ];

    for (const pattern of forbiddenPatterns) {
      expect(settingsCode).not.toContain(pattern);
      expect(memoryCode).not.toContain(pattern);
    }

    // Verify it doesn't import App.tsx or shells
    expect(settingsCode).not.toContain('App.tsx');
    expect(settingsCode).not.toContain('DesktopPreviewRail');
    expect(settingsCode).not.toContain('HubNativeShell');
    expect(settingsCode).not.toContain('HubWorkspaceView');
  });
});
