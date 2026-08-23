import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactElement } from 'react';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type MountedRoot = { root: Root; container: HTMLElement };

const mountedRoots: MountedRoot[] = [];

export function renderUI(ui: ReactElement): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoots.push({ root, container });
  act(() => {
    root.render(ui);
  });
  return container;
}

export function cleanupUI(): void {
  while (mountedRoots.length > 0) {
    const mounted = mountedRoots.pop();
    if (!mounted) break;
    act(() => {
      mounted.root.unmount();
    });
    mounted.container.remove();
  }
}

function dispatchEvent(target: EventTarget, event: Event): void {
  act(() => {
    target.dispatchEvent(event);
  });
}

export function click(element: Element): void {
  dispatchEvent(element, new MouseEvent('click', { bubbles: true, cancelable: true }));
}

export function pressKey(target: EventTarget, key: string): void {
  dispatchEvent(target, new KeyboardEvent('keydown', { key, bubbles: true }));
}

export function typeText(input: HTMLInputElement, value: string): void {
  act(() => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setValue) setValue.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

export function chooseOption(select: HTMLSelectElement, value: string): void {
  act(() => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    if (setValue) setValue.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function ownText(element: Element): string {
  let text = '';
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? '';
  }
  return normalizeWhitespace(text);
}

function textMatches(pattern: string | RegExp, text: string): boolean {
  return typeof pattern === 'string' ? text === pattern : pattern.test(text);
}

export function queryAllByText(root: ParentNode, pattern: string | RegExp): HTMLElement[] {
  const elements: HTMLElement[] = [];
  for (const element of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
    if (textMatches(pattern, ownText(element))) elements.push(element);
  }
  return elements;
}

export function queryByText(root: ParentNode, pattern: string | RegExp): HTMLElement | null {
  return queryAllByText(root, pattern)[0] ?? null;
}

export function getByText(root: ParentNode, pattern: string | RegExp): HTMLElement {
  const element = queryByText(root, pattern);
  if (!element) throw new Error(`No element with text ${pattern.toString()} found`);
  return element;
}

export function getByPlaceholderText(root: ParentNode, placeholder: string): HTMLInputElement {
  const element = root.querySelector<HTMLInputElement>(`[placeholder="${placeholder}"]`);
  if (!element) throw new Error(`No element with placeholder "${placeholder}" found`);
  return element;
}

export function queryAllByTitle(root: ParentNode, title: string): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`[title="${title}"]`));
}

export function queryByTitle(root: ParentNode, title: string): HTMLElement | null {
  return queryAllByTitle(root, title)[0] ?? null;
}

export function getByTitle(root: ParentNode, title: string): HTMLElement {
  const element = queryByTitle(root, title);
  if (!element) throw new Error(`No element with title "${title}" found`);
  return element;
}

export function queryTab(root: ParentNode, namePattern: RegExp): HTMLElement | null {
  const tabs = Array.from(root.querySelectorAll<HTMLElement>('[role="tab"]'));
  return tabs.find(tab => namePattern.test(normalizeWhitespace(tab.textContent ?? ''))) ?? null;
}

export function getTab(root: ParentNode, namePattern: RegExp): HTMLElement {
  const tab = queryTab(root, namePattern);
  if (!tab) throw new Error(`No tab matching ${namePattern.toString()} found`);
  return tab;
}
