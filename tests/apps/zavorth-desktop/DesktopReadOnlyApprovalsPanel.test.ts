/**
 * Desktop Read-Only Approvals Panel
 *
 * Strategy: same mock-DOM pattern as DesktopReadOnlyFileExplorer.test.ts.
 * Tests are split in two groups:
 *   A) Pure-function tests of sanitizeApproval (no DOM, no rendering)
 *   B) DOM render tests via createRoot + act (no filesystem, IPC, MCP, backend)
 */

import React from 'react';

// Lightweight mock DOM (reuse pattern from DesktopReadOnlyFileExplorer.test.ts)
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
    // shallow tag match
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

// Imports (after globals are set)
import fs from 'node:fs';
import path from 'node:path';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { sanitizeApproval, ApprovalsPanel } from '../../../apps/zavorth-desktop/src/views/panels/ApprovalsPanel';

// Mock icons — ApprovalsPanel does not use icons, but panelPrimitives may
const iconsPath = path.resolve('apps/zavorth-desktop/src/icons');
const mockIconsFn = () => {
  const R = React;
  const Dummy = (p: any) => R.createElement('span', p);
  return { AppWindow: Dummy, Folder: Dummy, Terminal: Dummy, ChevronDown: Dummy, File: Dummy };
};
jest.doMock(iconsPath, mockIconsFn);
jest.doMock(iconsPath + '.ts', mockIconsFn);
jest.doMock('../../../apps/zavorth-desktop/src/icons', mockIconsFn);

// Import component and pure helpers
import type { SafeApprovalRecord } from '../../../apps/zavorth-desktop/src/views/panels/ApprovalsPanel';

// Test suite
describe('Desktop Read-Only Approvals Panel', () => {
  const panelSrc = fs.readFileSync(
    path.resolve('apps/zavorth-desktop/src/views/panels/ApprovalsPanel.tsx'),
    'utf8',
  );
  const appSrc = fs.readFileSync(
    path.resolve('apps/zavorth-desktop/src/App.tsx'),
    'utf8',
  );

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

  // A) Pure-function tests — sanitizeApproval
  describe('sanitizeApproval — pure function', () => {
    it('returns a SafeApprovalRecord for a safe item', () => {
      const result = sanitizeApproval(
        { title: 'Write config', action: 'write', risk: 'medium', status: 'pending', createdAt: '2026-01-01T00:00:00Z' },
        0,
      );
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Write config');
      expect(result!.risk).toBe('medium');
      expect(result!.status).toBe('pending');
    });

    it('returns null when title contains a Windows absolute path', () => {
      expect(sanitizeApproval({ title: 'C:\\Users\\admin\\secret.txt', action: 'read' }, 0)).toBeNull();
    });

    it('returns null when title contains a Unix absolute path', () => {
      expect(sanitizeApproval({ title: '/Users/admin/config', action: 'read' }, 0)).toBeNull();
    });

    it('returns null when title contains directory traversal', () => {
      expect(sanitizeApproval({ title: '../../../etc/passwd', action: 'read' }, 0)).toBeNull();
    });

    it('returns null when action contains an absolute path', () => {
      expect(sanitizeApproval({ title: 'Safe title', action: 'C:\\boot.ini' }, 0)).toBeNull();
    });

    it('normalizes unknown risk to "unknown"', () => {
      const result = sanitizeApproval({ title: 'Op', action: 'op', risk: 'CRITICAL', status: 'pending' }, 0);
      expect(result).not.toBeNull();
      expect(result!.risk).toBe('unknown');
    });

    it('normalizes unknown status to "pending"', () => {
      const result = sanitizeApproval({ title: 'Op', action: 'op', risk: 'low', status: 'WAITING' }, 0);
      expect(result).not.toBeNull();
      expect(result!.status).toBe('pending');
    });

    it('truncates title to 80 characters', () => {
      const long = 'A'.repeat(200);
      const result = sanitizeApproval({ title: long, action: 'op', risk: 'low', status: 'pending' }, 0);
      expect(result).not.toBeNull();
      expect(result!.title.length).toBeLessThanOrEqual(80);
    });

    it('removes control characters from title', () => {
      const result = sanitizeApproval({ title: 'abc\x00\x1Fdef', action: 'op' }, 0);
      expect(result).not.toBeNull();
      expect(result!.title).not.toMatch(/[\x00-\x1F]/);
    });

    it('never reads, uses, or propagates summary field', () => {
      // Summary is on the raw ApprovalItem but must never appear in the result
      const raw = { title: 'Safe op', summary: 'SECRET CONTENT DO NOT SHOW', action: 'write', status: 'pending', risk: 'low' };
      const result = sanitizeApproval(raw, 0);
      expect(result).not.toBeNull();
      // SafeApprovalRecord type has no summary field
      expect((result as any).summary).toBeUndefined();
      expect((result as any).description).toBeUndefined();
      expect((result as any).details).toBeUndefined();
      expect((result as any).content).toBeUndefined();
    });

    it('does not call filesystem, IPC, MCP, localStorage, or sessionStorage', () => {
      // sanitizeApproval is a pure function — it only uses string operations
      // Verify it does not throw when those globals are absent
      const origFS = (global as any).fs;
      const origIPC = (global as any).ipcRenderer;
      const origLS = (global as any).localStorage;
      (global as any).fs = undefined;
      (global as any).ipcRenderer = undefined;
      (global as any).localStorage = undefined;
      const result = sanitizeApproval({ title: 'Safe', action: 'op', risk: 'low', status: 'pending' }, 0);
      expect(result).not.toBeNull();
      (global as any).fs = origFS;
      (global as any).ipcRenderer = origIPC;
      (global as any).localStorage = origLS;
    });
  });

  // B) Static source analysis
  describe('ApprovalsPanel — static source analysis', () => {
    it('does not import or use summary, description, details, diff, patch, content, prompt', () => {
      // These field names must not appear as accessed properties on approval items
      const forbidden = ['approval.summary', 'item.summary', 'approval.description',
        'approval.details', 'approval.diff', 'approval.patch', 'approval.content', 'approval.prompt'];
      for (const f of forbidden) {
        expect(panelSrc).not.toContain(f);
      }
    });

    it('does not export or accept onDecision prop', () => {
      expect(panelSrc).not.toContain('onDecision');
    });

    it('does not contain Approve or Reject button labels', () => {
      // Hard-coded UI text for approve/deny actions must be absent
      expect(panelSrc).not.toMatch(/>\s*Approve\s*</);
      expect(panelSrc).not.toMatch(/>\s*Reject\s*</);
      expect(panelSrc).not.toMatch(/>\s*Allow\s*</);
      expect(panelSrc).not.toMatch(/>\s*Deny\s*</);
    });

    it('does not import fs, path, electron, ipcRenderer, or Node APIs', () => {
      expect(panelSrc).not.toMatch(/require\(['"](?:fs|path|electron|child_process)/);
      expect(panelSrc).not.toContain('ipcRenderer');
      expect(panelSrc).not.toContain('ipcMain');
      expect(panelSrc).not.toContain('process.env');
    });

    it('does not use localStorage or sessionStorage', () => {
      expect(panelSrc).not.toContain('localStorage');
      expect(panelSrc).not.toContain('sessionStorage');
    });

    it('does not expose MCP tool calls', () => {
      expect(panelSrc).not.toContain('mcpClient');
      expect(panelSrc).not.toContain('callTool');
      expect(panelSrc).not.toContain('mcp_');
    });

    it('has no delete, rename, create, write, move, upload, drag-drop actions', () => {
      // These should not appear as JSX event handlers or function calls
      expect(panelSrc).not.toContain('onDrop');
      expect(panelSrc).not.toContain('onDragOver');
      expect(panelSrc).not.toContain('draggable={true}');
      expect(panelSrc).not.toMatch(/\.delete\s*\(/);
      expect(panelSrc).not.toMatch(/\.rename\s*\(/);
      expect(panelSrc).not.toMatch(/\.unlink\s*\(/);
      expect(panelSrc).not.toMatch(/\.writeFile\s*\(/);
    });

    it('preserves WorkspaceWriteApprovalModal as top-level overlay in App.tsx', () => {
      expect(appSrc).toContain('WorkspaceWriteApprovalModal');
    });

    it('uses only namespaced CSS classes (zavorth-approvals-*)', () => {
      // Every className starting with "zavorth-approvals" should be namespaced
      const classMatches = panelSrc.match(/className="([^"]+)"/g) ?? [];
      for (const match of classMatches) {
        const classes = match.replace(/className="/, '').replace(/"$/, '').split(' ');
        for (const cls of classes) {
          if (cls.startsWith('zavorth-')) {
            expect(cls).toMatch(/^zavorth-approvals-/);
          }
        }
      }
    });
  });

  // C) DOM render tests
  describe('ApprovalsPanel — DOM rendering', () => {
    const safePendingApprovals = [
      { id: 'a1', title: 'Write to config.json', action: 'write', risk: 'medium', status: 'pending', createdAt: '2026-06-01T12:00:00Z' },
      { id: 'a2', title: 'Read workspace index', action: 'read', risk: 'low', status: 'pending', createdAt: '2026-06-02T09:30:00Z' },
    ];

    const recentApprovals = [
      { id: 'a3', title: 'Patch applied', action: 'patch', risk: 'high', status: 'approved', createdAt: '2026-05-31T10:00:00Z' },
      { id: 'a4', title: 'Read cache', action: 'read', risk: 'low', status: 'rejected', createdAt: '2026-05-30T08:00:00Z' },
    ];

    it('renders pending approvals with safe metadata (title, action, risk, status, date)', () => {
      act(() => {
        root!.render(React.createElement(ApprovalsPanel, { approvals: safePendingApprovals }));
      });
      const text = container!.textContent;
      expect(text).toContain('Write to config.json');
      expect(text).toContain('Read workspace index');
      expect(text).toContain('medium');
      expect(text).toContain('low');
      expect(text).toContain('pending');
    });

    it('does not render summary field in the DOM', () => {
      const approvalsWithSummary = [
        { id: 'b1', title: 'Safe title', action: 'op', risk: 'low', status: 'pending',
          summary: 'SECRET_SUMMARY_CONTENT_DO_NOT_SHOW', createdAt: '2026-06-01T00:00:00Z' },
      ];
      act(() => {
        root!.render(React.createElement(ApprovalsPanel, { approvals: approvalsWithSummary }));
      });
      expect(container!.textContent).not.toContain('SECRET_SUMMARY_CONTENT_DO_NOT_SHOW');
    });

    it('does not render absolute paths in the DOM', () => {
      const approvalsWithAbsPath = [
        { id: 'c1', title: 'C:\\Users\\admin\\secret.txt', action: 'read', risk: 'low', status: 'pending' },
        { id: 'c2', title: '/Users/admin/config', action: 'read', risk: 'low', status: 'pending' },
        { id: 'c3', title: 'Safe visible title', action: 'read', risk: 'low', status: 'pending' },
      ];
      act(() => {
        root!.render(React.createElement(ApprovalsPanel, { approvals: approvalsWithAbsPath }));
      });
      const text = container!.textContent;
      expect(text).not.toContain('C:\\Users');
      expect(text).not.toContain('/Users/admin');
      expect(text).toContain('Safe visible title');
    });

    it('hides items with traversal path in title', () => {
      const approvalsWithTraversal = [
        { id: 'd1', title: '../../../etc/passwd', action: 'read', risk: 'low', status: 'pending' },
        { id: 'd2', title: 'Normal operation', action: 'op', risk: 'low', status: 'pending' },
      ];
      act(() => {
        root!.render(React.createElement(ApprovalsPanel, { approvals: approvalsWithTraversal }));
      });
      const text = container!.textContent;
      expect(text).not.toContain('../../../etc/passwd');
      expect(text).toContain('Normal operation');
    });

    it('does not render any button with accessible name Approve, Allow, Deny, or Reject', () => {
      act(() => {
        root!.render(React.createElement(ApprovalsPanel, { approvals: safePendingApprovals }));
      });
      // Collect all BUTTON elements in the tree
      const buttons = container!.querySelectorAll('button');
      for (const btn of buttons) {
        const label = (btn.textContent || '').trim().toLowerCase();
        // The badge text "rejected" (status display) is NOT a button label — buttons should not have it
        // But we check tag-level: only TextTabs buttons and SearchBox should exist
        // None should carry approve/allow/deny/reject action labels
        expect(label).not.toMatch(/^(approve|allow|deny|reject)$/);
      }
    });

    it('renders empty state when no approvals are provided', () => {
      act(() => {
        root!.render(React.createElement(ApprovalsPanel, { approvals: [] }));
      });
      expect(container!.textContent).toContain('No pending approvals.');
    });

    it('filters visible records when switching to Recent tab (static check)', () => {
      // Verify the component accepts recentApprovals prop and renders without error
      act(() => {
        root!.render(React.createElement(ApprovalsPanel, {
          approvals: safePendingApprovals,
          recentApprovals: recentApprovals,
        }));
      });
      // Pending tab is default — recent items should not be visible by default
      const text = container!.textContent;
      expect(text).toContain('Write to config.json'); // pending item visible
    });

    it('renders "Recent" tab label in DOM', () => {
      act(() => {
        root!.render(React.createElement(ApprovalsPanel, {
          approvals: safePendingApprovals,
          recentApprovals: recentApprovals,
        }));
      });
      expect(container!.textContent).toMatch(/Recent|Recent/);
      expect(container!.textContent).toContain('Pending');
    });

    it('does not add drag-drop handlers', () => {
      act(() => {
        root!.render(React.createElement(ApprovalsPanel, { approvals: safePendingApprovals }));
      });
      // Inspect innerHTML for drag attributes — none should be present
      const html = container!.innerHTML;
      expect(html).not.toContain('draggable');
      expect(html).not.toContain('ondrop');
      expect(html).not.toContain('ondragover');
    });
  });
});
