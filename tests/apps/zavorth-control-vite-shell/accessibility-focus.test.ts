import fs from 'node:fs';
import path from 'node:path';

import {
  captureActiveElement,
  focusInitialElement,
  getFocusableElements,
  restoreFocus,
  trapFocus,
} from './mocks/focus-management';

type FakeDocument = { activeElement: FakeElement | null };

const fakeDocument: FakeDocument = { activeElement: null };

class FakeElement {
  readonly attributes = new Map<string, string>();
  readonly children: FakeElement[] = [];
  hidden = false;
  isConnected = true;
  parentElement: FakeElement | null = null;

  constructor(
    readonly id: string,
    readonly focusable = true,
  ) {}

  append(...elements: FakeElement[]) {
    elements.forEach((element) => {
      element.parentElement = this;
      this.children.push(element);
    });
  }

  contains(element: FakeElement) {
    let current: FakeElement | null = element;
    while (current) {
      if (current === this) return true;
      current = current.parentElement;
    }
    return false;
  }

  closest() {
    let current: FakeElement | null = this;
    while (current) {
      if (current.hidden || current.getAttribute('aria-hidden') === 'true') return current;
      current = current.parentElement;
    }
    return null;
  }

  focus() {
    fakeDocument.activeElement = this;
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  querySelectorAll<T>() {
    const matches: FakeElement[] = [];
    const visit = (element: FakeElement) => {
      element.children.forEach((child) => {
        if (child.focusable) matches.push(child);
        visit(child);
      });
    };
    visit(this);
    return matches as T[];
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
}

describe('dashboard accessibility focus', () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalHTMLElement = Object.getOwnPropertyDescriptor(globalThis, 'HTMLElement');

  beforeAll(() => {
    Object.defineProperty(globalThis, 'document', { configurable: true, value: fakeDocument });
    Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: FakeElement });
  });

  beforeEach(() => {
    fakeDocument.activeElement = null;
  });

  afterAll(() => {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete (globalThis as Record<string, unknown>).document;
    if (originalHTMLElement) Object.defineProperty(globalThis, 'HTMLElement', originalHTMLElement);
    else delete (globalThis as Record<string, unknown>).HTMLElement;
  });

  it('moves focus to the preferred element and restores the opener', () => {
    const opener = new FakeElement('opener');
    const dialog = new FakeElement('dialog', false);
    const first = new FakeElement('first');
    const preferred = new FakeElement('preferred');
    dialog.append(first, preferred);

    opener.focus();
    expect(captureActiveElement()).toBe(opener);
    expect(getFocusableElements(dialog)).toEqual([first, preferred]);

    focusInitialElement(dialog as unknown as HTMLElement, preferred as unknown as HTMLElement);
    expect(fakeDocument.activeElement).toBe(preferred);

    restoreFocus(opener as unknown as HTMLElement);
    expect(fakeDocument.activeElement).toBe(opener);
  });

  it('wraps focus in both directions', () => {
    const dialog = new FakeElement('dialog', false);
    const first = new FakeElement('first');
    const last = new FakeElement('last');
    dialog.append(first, last);

    last.focus();
    const forward = { key: 'Tab', shiftKey: false, preventDefault: jest.fn() } as unknown as KeyboardEvent;
    trapFocus(forward, dialog as unknown as HTMLElement);
    expect(forward.preventDefault).toHaveBeenCalledTimes(1);
    expect(fakeDocument.activeElement).toBe(first);

    const backward = { key: 'Tab', shiftKey: true, preventDefault: jest.fn() } as unknown as KeyboardEvent;
    trapFocus(backward, dialog as unknown as HTMLElement);
    expect(backward.preventDefault).toHaveBeenCalledTimes(1);
    expect(fakeDocument.activeElement).toBe(last);
  });

  it('keeps the dashboard accessibility contract in the rendered source', () => {
    const root = path.resolve(__dirname, '../../..');
    const index = fs.readFileSync(path.join(root, 'apps/zavorth-control-vite-shell/index.html'), 'utf8');
    const app = fs.readFileSync(path.join(root, 'apps/zavorth-control-vite-shell/src/app.ts'), 'utf8');

    expect(index).toContain('id="compose-input" placeholder="Ask Zavorth"');
    expect(index).toContain('id="neural-feed"');
    expect(index).toContain('id="cmd-palette" role="dialog"');
    expect(index).toContain('id="cmd-palette-results"');
    expect(index).toContain('role="option"');
    expect(app).toContain('onclick="document.getElementById(\'${cellId}\').classList');
    expect(app).toContain('logic-cell__header');
  });
});
