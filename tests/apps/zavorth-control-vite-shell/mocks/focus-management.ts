export function captureActiveElement(): Element | null {
  return document.activeElement;
}

export function focusInitialElement(
  container: HTMLElement,
  preferred?: HTMLElement,
): void {
  if (preferred) {
    preferred.focus();
    return;
  }
  const focusable = getFocusableElements(container);
  if (focusable.length > 0) {
    (focusable[0] as HTMLElement).focus();
  }
}

export function getFocusableElements(container: HTMLElement): Element[] {
  const selector =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(container.querySelectorAll(selector));
}

export function restoreFocus(element: HTMLElement): void {
  element.focus();
}

export function trapFocus(
  event: KeyboardEvent,
  container: HTMLElement,
): void {
  if (event.key !== 'Tab') return;
  const focusable = getFocusableElements(container);
  if (focusable.length === 0) return;

  const first = focusable[0] as HTMLElement;
  const last = focusable[focusable.length - 1] as HTMLElement;
  const active = document.activeElement as HTMLElement;

  if (!event.shiftKey) {
    if (active === last) {
      event.preventDefault();
      first.focus();
    }
  } else {
    if (active === first) {
      event.preventDefault();
      last.focus();
    }
  }
}
