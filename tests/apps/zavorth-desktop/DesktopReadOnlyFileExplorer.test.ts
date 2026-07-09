import React from '../../../apps/zavorth-desktop/node_modules/react';
import { asErrorLike } from '../../../apps/zavorth-desktop/src/lib/errors';

// Setup custom lightweight mock DOM to run React DOM rendering in Node without ESM-only JSDOM package dependencies
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

  removeEventListener(type: string, handler: any) {
    delete this.listeners[type];
  }

  click() {
    let current: any = this;
    const event = {
      target: this,
      currentTarget: this,
      stopPropagation() {
        (this as any)._stopped = true;
      },
      preventDefault() {},
      _stopped: false,
      type: 'click',
      bubbles: true,
      cancelable: true,
    };
    while (current) {
      event.currentTarget = current;
      if (current.listeners && current.listeners.click) {
        try {
          current.listeners.click(event);
        } catch (error: unknown) {
          const err = asErrorLike(error);

          console.error('Error on click listener:', err);
        }
      }
      if (current.onclick) {
        try {
          current.onclick(event);
        } catch (error: unknown) {
          const err = asErrorLike(error);

          console.error('Error on onclick property:', err);
        }
      }
      const propsKey = Object.keys(current).find(key => key.startsWith('__reactProps'));
      if (propsKey) {
        const props = current[propsKey];
        if (props && props.onClick) {
          try {
            props.onClick(event);
          } catch (error: unknown) {
            const err = asErrorLike(error);

            console.error('Error on react onClick:', err);
          }
        }
      }
      if ((event as any)._stopped) break;
      current = current.parentNode;
    }
    if (!(event as any)._stopped) {
      event.currentTarget = mockDocument as any;
      if (mockDocument.listeners && mockDocument.listeners.click) {
        try {
          mockDocument.listeners.click(event);
        } catch (error: unknown) {
          const err = asErrorLike(error);

          console.error('Error on Document listener:', err.message, err.stack);
        }
      }
    }
    if (!(event as any)._stopped) {
      event.currentTarget = mockWindow as any;
      if (mockWindow.listeners && mockWindow.listeners.click) {
        try {
          mockWindow.listeners.click(event);
        } catch (error: unknown) {
          const err = asErrorLike(error);

          console.error('Error on Window listener:', err.message, err.stack);
        }
      }
    }
  }

  get textContent(): string {
    return this.childNodes.map(node => node.textContent || '').join('');
  }

  set textContent(value: string) {
    this.childNodes = [new MockTextNode(value)];
  }

  get innerHTML(): string {
    const attrs = Object.entries(this.attributes)
      .map(([k, v]) => ` ${k}="${v}"`)
      .join('');
    const childrenHtml = this.childNodes.map(c => c.innerHTML || '').join('');
    return `<${this.tagName.toLowerCase()}${attrs}>${childrenHtml}</${this.tagName.toLowerCase()}>`;
  }

  querySelector(selector: string): any {
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      if (this.className.split(' ').includes(cls)) return this;
    } else if (selector.startsWith('[')) {
      const attrMatch = selector.slice(1, -1).split('=');
      const name = attrMatch[0];
      const val = attrMatch[1] ? attrMatch[1].replace(/['"]/g, '') : null;
      if (name in this.attributes && (!val || this.attributes[name] === val)) return this;
    } else {
      if (this.tagName.toLowerCase() === selector.toLowerCase()) return this;
    }

    for (const child of this.childNodes) {
      if (child.querySelector) {
        const found = child.querySelector(selector);
        if (found) return found;
      }
    }
    return null;
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

  get textContent(): string {
    return this.nodeValue;
  }

  set textContent(value: string) {
    this.nodeValue = value;
  }

  get innerHTML(): string {
    return this.nodeValue;
  }
}

// Bind Globals
const mockDocument = {
  nodeType: 9,
  createElement: (tagName: string) => new MockElement(tagName),
  createTextNode: (text: string) => new MockTextNode(text),
  createComment: () => ({ nodeType: 8, ownerDocument: mockDocument }),
  createDocumentFragment: () => {
    const fragment = new MockElement('fragment');
    fragment.nodeType = 11;
    return fragment;
  },
  body: null as any,
  documentElement: null as any,
  activeElement: null as any,
  listeners: {} as Record<string, any>,
  addEventListener(type: string, handler: any) {
    this.listeners[type] = handler;
  },
  removeEventListener(type: string, handler: any) {
    delete this.listeners[type];
  },
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
  addEventListener(type: string, handler: any) {
    this.listeners[type] = handler;
  },
  removeEventListener(type: string, handler: any) {
    delete this.listeners[type];
  },
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

import fs from 'node:fs';
import path from 'node:path';
import { createRoot, Root } from '../../../apps/zavorth-desktop/node_modules/react-dom/client';
import { act } from '../../../apps/zavorth-desktop/node_modules/react';

const iconsPath = path.resolve('apps/zavorth-desktop/src/icons');
const mockFn = () => {
  const React = require('../../../apps/zavorth-desktop/node_modules/react');
  const DummyIcon = (props: any) => React.createElement('span', props);
  return {
    ChevronDown: DummyIcon,
    ChevronRight: DummyIcon,
    File: DummyIcon,
    Folder: DummyIcon,
    FolderOpen: DummyIcon,
    Plus: DummyIcon,
  };
};
jest.doMock(iconsPath, mockFn);
jest.doMock(iconsPath + '.ts', mockFn);
jest.doMock('../../../apps/zavorth-desktop/src/icons', mockFn);

import type { FileExplorerNode as FileExplorerNodeType } from '../../../apps/zavorth-desktop/src/components/FileExplorer';
const { FileExplorer, isSuspiciousPath, sanitizeTree } = require('../../../apps/zavorth-desktop/src/components/FileExplorer');
type FileExplorerNode = FileExplorerNodeType;


describe('Desktop Read-Only FileExplorer Component', () => {
  const fileExplorerPath = path.resolve('apps/zavorth-desktop/src/components/FileExplorer.tsx');
  const previewRailPath = path.resolve('apps/zavorth-desktop/src/shell/DesktopPreviewRail.tsx');
  const appPath = path.resolve('apps/zavorth-desktop/src/App.tsx');

  const fileExplorerSrc = fs.readFileSync(fileExplorerPath, 'utf8');
  const previewRailSrc = fs.readFileSync(previewRailPath, 'utf8');
  const appSrc = fs.readFileSync(appPath, 'utf8');

  // Testing container setup
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = mockDocument.createElement('div') as any;
    mockDocument.body.appendChild(container);
    root = createRoot(container as any);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
      root = null;
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
      container = null;
    }
  });

  // Helper validation
  describe('isSuspiciousPath validator', () => {
    it('returns true for absolute windows paths', () => {
      expect(isSuspiciousPath('C:\\workspace')).toBe(true);
      expect(isSuspiciousPath('d:/project/file.ts')).toBe(true);
    });

    it('returns true for unix absolute paths', () => {
      expect(isSuspiciousPath('/Users/user/project')).toBe(true);
      expect(isSuspiciousPath('/root')).toBe(true);
    });

    it('returns true for directory traversal paths', () => {
      expect(isSuspiciousPath('../file.ts')).toBe(true);
      expect(isSuspiciousPath('..\\folder')).toBe(true);
      expect(isSuspiciousPath('..')).toBe(true);
      expect(isSuspiciousPath('.')).toBe(true);
    });

    it('returns true for suspicious keywords', () => {
      expect(isSuspiciousPath('workspaceRoot')).toBe(true);
      expect(isSuspiciousPath('absolutePath')).toBe(true);
      expect(isSuspiciousPath('realpath')).toBe(true);
      expect(isSuspiciousPath('Realpath')).toBe(true);
    });

    it('returns true for generic users folder references', () => {
      expect(testIsSuspiciousPathWrapper('users/alex')).toBe(true);
      expect(testIsSuspiciousPathWrapper('users\\file.txt')).toBe(true);
      expect(testIsSuspiciousPathWrapper('users')).toBe(true);
    });

    it('returns false for safe relative paths', () => {
      expect(isSuspiciousPath('src/App.tsx')).toBe(false);
      expect(isSuspiciousPath('package.json')).toBe(false);
      expect(isSuspiciousPath('apps/zavorth-desktop/src/components/FileExplorer.tsx')).toBe(false);
    });
  });

  // Helper function wrapper for case-insensitive testing
  function testIsSuspiciousPathWrapper(p: string): boolean {
    return isSuspiciousPath(p);
  }

  describe('sanitizeTree recursive sanitizer', () => {
    it('removes nodes and their children containing suspicious paths', () => {
      const mockTree: FileExplorerNode[] = [
        {
          name: 'safe_folder',
          relativePath: 'safe_folder',
          type: 'directory',
          children: [
            {
              name: 'safe_file.txt',
              relativePath: 'safe_folder/safe_file.txt',
              type: 'file',
            },
            {
              name: 'unsafe_file.txt',
              relativePath: 'C:\\unsafe_file.txt',
              type: 'file',
            },
          ],
        },
        {
          name: 'unsafe_folder',
          relativePath: '../unsafe_folder',
          type: 'directory',
          children: [
            {
              name: 'some_file.txt',
              relativePath: 'some_file.txt',
              type: 'file',
            },
          ],
        },
      ];

      const sanitized = sanitizeTree(mockTree);
      expect(sanitized).toHaveLength(1);
      expect(sanitized[0].name).toBe('safe_folder');
      expect(sanitized[0].children).toHaveLength(1);
      expect(sanitized[0].children![0].name).toBe('safe_file.txt');
    });
  });

  // Real DOM Rendering and Assertion tests under JSDOM simulation
  describe('FileExplorer DOM Rendering', () => {
    it('renders safe folder structure and shows relative file names', () => {
      const mockTree: FileExplorerNode[] = [
        {
          name: 'src',
          relativePath: 'src',
          type: 'directory',
          children: [
            {
              name: 'App.tsx',
              relativePath: 'src/App.tsx',
              type: 'file',
            },
          ],
        },
      ];

      act(() => {
        root!.render(React.createElement(FileExplorer, { data: mockTree }));
      });

      const dirHeader = container!.querySelector('.zavorth-file-node-dir-header') as any;
      expect(dirHeader).not.toBeNull();
      act(() => {
        dirHeader.click();
      });

      expect(container!.textContent).toContain('src');
      expect(container!.textContent).toContain('App.tsx');
    });

    it('does not render suspicious nodes or paths in the DOM', () => {
      const mockTree: FileExplorerNode[] = [
        {
          name: 'src',
          relativePath: 'src',
          type: 'directory',
          children: [
            {
              name: 'App.tsx',
              relativePath: 'src/App.tsx',
              type: 'file',
            },
            {
              name: 'secret.txt',
              relativePath: 'C:\\Users\\someone\\secret.txt',
              type: 'file',
            },
            {
              name: 'secret2.txt',
              relativePath: '/Users/someone/secret2.txt',
              type: 'file',
            },
            {
              name: 'secret3.txt',
              relativePath: '../secret3.txt',
              type: 'file',
            },
            {
              name: 'secret4.txt',
              relativePath: '..\\secret4.txt',
              type: 'file',
            },
          ],
        },
      ];

      act(() => {
        root!.render(React.createElement(FileExplorer, { data: mockTree }));
      });

      const dirHeader = container!.querySelector('.zavorth-file-node-dir-header') as any;
      expect(dirHeader).not.toBeNull();
      act(() => {
        dirHeader.click();
      });

      const html = container!.innerHTML;
      expect(html).toContain('App.tsx');
      expect(html).not.toContain('secret.txt');
      expect(html).not.toContain('C:\\Users');
      expect(html).not.toContain('/Users/');
      expect(html).not.toContain('../');
      expect(html).not.toContain('..\\');
    });

    it('triggers callback only with relativePath when clicking a safe file node', () => {
      const mockTree: FileExplorerNode[] = [
        {
          name: 'src',
          relativePath: 'src',
          type: 'directory',
          children: [
            {
              name: 'App.tsx',
              relativePath: 'src/App.tsx',
              type: 'file',
            },
          ],
        },
      ];

      const onAttachFile = jest.fn();

      act(() => {
        root!.render(React.createElement(FileExplorer, { data: mockTree, onAttachFile }));
      });

      const dirHeader = container!.querySelector('.zavorth-file-node-dir-header') as any;
      expect(dirHeader).not.toBeNull();
      act(() => {
        dirHeader.click();
      });

      const fileNode = container!.querySelector('.zavorth-file-node-file') as any;
      expect(fileNode).not.toBeNull();

      act(() => {
        fileNode.click();
      });

      expect(onAttachFile).toHaveBeenCalledTimes(1);
      expect(onAttachFile).toHaveBeenCalledWith('src/App.tsx');
    });

    it('does not call callback for suspicious paths', () => {
      expect(isSuspiciousPath('C:\\workspace')).toBe(true);
      expect(isSuspiciousPath('/Users/test')).toBe(true);
      expect(isSuspiciousPath('../test')).toBe(true);
    });

    it('does not render destructive buttons, labels, editable inputs or drag-and-drop triggers', () => {
      const mockTree: FileExplorerNode[] = [
        {
          name: 'src',
          relativePath: 'src',
          type: 'directory',
          children: [
            {
              name: 'App.tsx',
              relativePath: 'src/App.tsx',
              type: 'file',
            },
          ],
        },
      ];

      act(() => {
        root!.render(React.createElement(FileExplorer, { data: mockTree }));
      });

      const html = container!.innerHTML.toLowerCase();

      // No destructive button/label triggers
      for (const keyword of ['delete', 'rename', 'create', 'new', 'upload', 'remove', 'move']) {
        expect(html).not.toContain(keyword);
      }

      // No editable inputs
      const input = container!.querySelector('input');
      expect(input).toBeNull();
      expect(html).not.toContain('contenteditable');

      // No draggable attribute
      const draggable = container!.querySelector('[draggable="true"]');
      expect(draggable).toBeNull();
      expect(html).not.toContain('draggable="true"');
      expect(html).not.toContain('draggable={true}');

      // No drag & drop handlers
      expect(html).not.toContain('ondragstart');
      expect(html).not.toContain('ondragover');
      expect(html).not.toContain('ondrop');
    });
  });

  // Code inspection tests to ensure restrictions are enforced
  describe('FileExplorer JSX Static Analysis', () => {
    it('does not contain any embedded <style> tags', () => {
      expect(fileExplorerSrc).not.toContain('<style>');
      expect(fileExplorerSrc).not.toContain('</style>');
    });
  });

  describe('DesktopPreviewRail and Layout Integration Static Analysis', () => {
    it('mounts the FileExplorer component only when mode is expanded', () => {
      expect(previewRailSrc).toContain("import { FileExplorer } from '../components/FileExplorer';");
      expect(previewRailSrc).toContain("props.mode === 'expanded'");
      expect(previewRailSrc).toContain('<FileExplorer');
    });

    it('ensures WorkspaceWriteApprovalModal remains intact as a top-level overlay in App.tsx', () => {
      expect(appSrc).toContain("import { WorkspaceWriteApprovalModal } from './components/WorkspaceWriteApprovalModal';");
      expect(appSrc).toContain('<WorkspaceWriteApprovalModal');
      expect(appSrc).toContain('</ZavorthPaneShell>');
      expect(appSrc).toContain('<WorkspaceWriteApprovalModal');
    });
  });
});
