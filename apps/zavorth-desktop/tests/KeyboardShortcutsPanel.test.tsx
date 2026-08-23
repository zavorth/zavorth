import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  renderUI,
  cleanupUI,
  click,
  pressKey,
  typeText,
  queryAllByText,
  queryByText,
  getByText,
  getByPlaceholderText,
} from './helpers/uiHarness';
import KeyboardShortcutsPanel from '../src/components/KeyboardShortcutsPanel';

vi.mock('@tabler/icons-react', () => ({
  IconSearch: (props: Record<string, unknown>) => <span data-testid="icon-search" {...props} />,
  IconX: (props: Record<string, unknown>) => <span data-testid="icon-x" {...props} />,
  IconKeyboard: (props: Record<string, unknown>) => <span data-testid="icon-keyboard" {...props} />,
}));

const GROUPS = [
  'Navigation',
  'Chat',
  'Terminal',
  'General',
];

function renderPanel() {
  const onClose = vi.fn();
  const container = renderUI(<KeyboardShortcutsPanel isOpen={true} onClose={onClose} />);
  return { onClose, container };
}

beforeEach(() => {
  cleanupUI();
});

afterEach(() => {
  cleanupUI();
});

describe('KeyboardShortcutsPanel', () => {
  describe('Rendering shortcut groups', () => {
    it('renders all four shortcut groups', () => {
      const { container } = renderPanel();
      GROUPS.forEach(title => {
        expect(queryByText(container, title)).not.toBeNull();
      });
    });

    it('renders group title elements with the correct class', () => {
      const { container } = renderPanel();
      const titles = queryAllByText(container, 'Navigation');
      expect(titles[0].classList.contains('zvd-shortcuts-group-title')).toBe(true);
    });

    it('renders the correct number of shortcut rows for Navigation group', () => {
      const { container } = renderPanel();
      const navGroup = queryAllByText(container, 'Navigation')[0].closest('.zvd-shortcuts-group');
      if (!navGroup) throw new Error('Navigation group not rendered');
      expect(navGroup.querySelectorAll('.zvd-shortcuts-row').length).toBeGreaterThanOrEqual(4);
    });

    it('renders description text for each shortcut', () => {
      const { container } = renderPanel();
      for (const description of [
        'Command Palette',
        'Toggle Sidebar',
        'Toggle Terminal',
        'Open Settings',
        'Send Message',
        'Show Shortcuts',
        'Quit Application',
      ]) {
        expect(getByText(container, description)).toBeTruthy();
      }
    });

    it('groups shortcuts correctly under their parent titles', () => {
      const { container } = renderPanel();
      const chatGroup = queryAllByText(container, 'Chat')[0].closest('.zvd-shortcuts-group');
      if (!chatGroup) throw new Error('Chat group not rendered');
      const chatDescs = queryAllByText(chatGroup, /Send Message|New Line|Execute Command|Navigate History/);
      expect(chatDescs.length).toBe(4);

      const termGroup = queryAllByText(container, 'Terminal')[0].closest('.zvd-shortcuts-group');
      if (!termGroup) throw new Error('Terminal group not rendered');
      const termDescs = queryAllByText(termGroup, /Toggle Terminal|Interrupt Process|Clear Terminal/);
      expect(termDescs.length).toBe(3);
    });
  });

  describe('Kbd chips', () => {
    it('renders kbd elements for key combinations', () => {
      const { container } = renderPanel();
      expect(container.querySelectorAll('.zvd-kbd-chip').length).toBeGreaterThan(0);
    });

    it('renders "Ctrl" and "K" kbd chips for Command Palette shortcut', () => {
      const { container } = renderPanel();
      const allKbd = Array.from(container.querySelectorAll('.zvd-kbd-chip'));
      expect(allKbd.some(kbd => kbd.textContent === 'Ctrl')).toBe(true);
      expect(allKbd.some(kbd => kbd.textContent === 'K')).toBe(true);
    });

    it('renders single-key shortcuts like "..." and "Esc"', () => {
      const { container } = renderPanel();
      const allKbd = Array.from(container.querySelectorAll('.zvd-kbd-chip'));
      expect(allKbd.some(kbd => kbd.textContent === '...')).toBe(true);
      expect(allKbd.some(kbd => kbd.textContent === 'Esc')).toBe(true);
    });

    it('renders "+" separator between combined keys', () => {
      const { container } = renderPanel();
      const separators = container.querySelectorAll('.zvd-shortcuts-keys span[style*="contents"]');
      expect(separators.length).toBeGreaterThan(0);
    });

    it('renders arrow key shortcuts', () => {
      const { container } = renderPanel();
      const allKbd = Array.from(container.querySelectorAll('.zvd-kbd-chip'));
      expect(allKbd.some(kbd => kbd.textContent === '↑')).toBe(true);
      expect(allKbd.some(kbd => kbd.textContent === '↓')).toBe(true);
    });
  });

  describe('Search filtering', () => {
    it('shows all groups when search is empty', () => {
      const { container } = renderPanel();
      GROUPS.forEach(title => {
        expect(queryByText(container, title)).not.toBeNull();
      });
    });

    it('filters shortcuts by description text', () => {
      const { container } = renderPanel();
      const input = getByPlaceholderText(container, 'Search shortcuts...');
      typeText(input, 'sidebar');

      expect(queryByText(container, 'Toggle Sidebar')).not.toBeNull();
      expect(queryByText(container, 'Command Palette')).toBeNull();
      expect(queryByText(container, 'Send Message')).toBeNull();
    });

    it('filters shortcuts by key name', () => {
      const { container } = renderPanel();
      const input = getByPlaceholderText(container, 'Search shortcuts...');
      typeText(input, 'ctrl');

      expect(queryByText(container, 'Command Palette')).not.toBeNull();
      expect(queryByText(container, 'Quit Application')).not.toBeNull();
      expect(queryByText(container, 'Send Message')).toBeNull();
    });

    it('filters case-insensitively on shortcut text', () => {
      // The search filter matches shortcut descriptions/keys only, never group
      // titles, so case-insensitivity is asserted against a real description.
      const { container } = renderPanel();
      const input = getByPlaceholderText(container, 'Search shortcuts...');
      typeText(input, 'NAVIGATE');

      expect(queryByText(container, 'Navigate History')).not.toBeNull();
    });

    it('hides groups with no matching shortcuts', () => {
      const { container } = renderPanel();
      const input = getByPlaceholderText(container, 'Search shortcuts...');
      typeText(input, 'sidebar');

      expect(queryByText(container, 'General')).toBeNull();
      expect(queryByText(container, 'Chat')).toBeNull();
    });

    it('clears filter when search input is cleared', () => {
      const { container } = renderPanel();
      const input = getByPlaceholderText(container, 'Search shortcuts...');

      typeText(input, 'sidebar');
      expect(queryByText(container, 'Command Palette')).toBeNull();

      typeText(input, '');
      GROUPS.forEach(title => {
        expect(queryByText(container, title)).not.toBeNull();
      });
    });
  });

  describe('Empty search results', () => {
    it('shows empty state message when no shortcuts match', () => {
      const { container } = renderPanel();
      const input = getByPlaceholderText(container, 'Search shortcuts...');
      typeText(input, 'zzzznonexistent');

      expect(getByText(container, 'No shortcuts match your search.')).toBeTruthy();
    });

    it('does not render any group titles when no shortcuts match', () => {
      const { container } = renderPanel();
      const input = getByPlaceholderText(container, 'Search shortcuts...');
      typeText(input, 'zzzznonexistent');

      GROUPS.forEach(title => {
        expect(queryByText(container, title)).toBeNull();
      });
    });

    it('renders empty state with the correct class', () => {
      const { container } = renderPanel();
      const input = getByPlaceholderText(container, 'Search shortcuts...');
      typeText(input, 'zzzznonexistent');

      const emptyEl = getByText(container, 'No shortcuts match your search.');
      expect(emptyEl.classList.contains('zvd-shortcuts-empty')).toBe(true);
    });
  });

  describe('Close behavior', () => {
    it('returns null when isOpen is false', () => {
      const container = renderUI(<KeyboardShortcutsPanel isOpen={false} onClose={vi.fn()} />);
      expect(container.innerHTML).toBe('');
    });

    it('calls onClose when Escape key is pressed', () => {
      const { onClose } = renderPanel();
      pressKey(document, 'Escape');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when the close button is clicked', () => {
      const { onClose, container } = renderPanel();
      const closeBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find(button => button.getAttribute('aria-label') === 'Close');
      if (!closeBtn) throw new Error('Close button not rendered');
      click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking the backdrop overlay', () => {
      const { onClose, container } = renderPanel();
      const overlay = container.querySelector('.zvd-shortcuts-overlay');
      if (!overlay) throw new Error('Overlay not rendered');
      click(overlay);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onClose when clicking inside the panel', () => {
      const { onClose, container } = renderPanel();
      const panel = container.querySelector('[role="dialog"]');
      if (!panel) throw new Error('Dialog panel not rendered');
      click(panel);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('does NOT call onClose when pressing keys other than Escape', () => {
      const { onClose } = renderPanel();
      pressKey(document, 'a');
      pressKey(document, 'Enter');
      pressKey(document, 'Tab');
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('ARIA attributes', () => {
    it('panel has role="dialog"', () => {
      const { container } = renderPanel();
      expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    });

    it('panel has aria-modal="true"', () => {
      const { container } = renderPanel();
      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog?.getAttribute('aria-modal')).toBe('true');
    });

    it('panel has aria-label="Keyboard Shortcuts"', () => {
      const { container } = renderPanel();
      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog?.getAttribute('aria-label')).toBe('Keyboard Shortcuts');
    });

    it('search input has aria-label="Search shortcuts"', () => {
      const { container } = renderPanel();
      const input = container.querySelector<HTMLInputElement>('input[aria-label="Search shortcuts"]');
      expect(input).not.toBeNull();
    });

    it('close button has aria-label="Close"', () => {
      const { container } = renderPanel();
      const btn = Array.from(container.querySelectorAll('button'))
        .find(button => button.getAttribute('aria-label') === 'Close');
      expect(btn).toBeDefined();
    });
  });

  describe('Search input behavior', () => {
    it('renders a search input with placeholder text', () => {
      const { container } = renderPanel();
      expect(getByPlaceholderText(container, 'Search shortcuts...')).toBeTruthy();
    });

    it('search input has the correct class', () => {
      const { container } = renderPanel();
      const input = getByPlaceholderText(container, 'Search shortcuts...');
      expect(input.classList.contains('zvd-shortcuts-search-input')).toBe(true);
    });

    it('search input is focusable', () => {
      const { container } = renderPanel();
      const input = getByPlaceholderText(container, 'Search shortcuts...');
      click(input);
      expect(document.activeElement).toBe(input);
    });
  });

  describe('Header rendering', () => {
    it('renders the "Keyboard Shortcuts" heading', () => {
      const { container } = renderPanel();
      expect(getByText(container, 'Keyboard Shortcuts').tagName).toBe('H2');
    });

    it('renders the keyboard icon in the header', () => {
      const { container } = renderPanel();
      expect(container.querySelector('[data-testid="icon-keyboard"]')).not.toBeNull();
    });

    it('renders the close button with an X icon', () => {
      const { container } = renderPanel();
      expect(container.querySelector('[data-testid="icon-x"]')).not.toBeNull();
    });

    it('renders the search icon', () => {
      const { container } = renderPanel();
      expect(container.querySelector('[data-testid="icon-search"]')).not.toBeNull();
    });
  });

  describe('Body scroll locking', () => {
    it('sets body overflow to hidden when open', () => {
      renderPanel();
      expect(document.body.style.overflow).toBe('hidden');
    });
  });

  describe('Component structure', () => {
    it('panel is rendered inside the overlay', () => {
      const { container } = renderPanel();
      const overlay = container.querySelector('.zvd-shortcuts-overlay');
      if (!overlay) throw new Error('Overlay not rendered');
      expect(overlay.querySelector('[role="dialog"]')).not.toBeNull();
    });

    it('panel has the correct class', () => {
      const { container } = renderPanel();
      const panel = container.querySelector('[role="dialog"]');
      expect(panel?.classList.contains('zvd-shortcuts-panel')).toBe(true);
    });

    it('renders the header section', () => {
      const { container } = renderPanel();
      expect(container.querySelector('.zvd-shortcuts-header')).not.toBeNull();
    });

    it('renders the search wrapper section', () => {
      const { container } = renderPanel();
      expect(container.querySelector('.zvd-shortcuts-search-wrapper')).not.toBeNull();
    });

    it('renders the body section', () => {
      const { container } = renderPanel();
      expect(container.querySelector('.zvd-shortcuts-body')).not.toBeNull();
    });

    it('renders a style element for inline styles', () => {
      const { container } = renderPanel();
      expect(container.querySelector('.zvd-shortcuts-overlay style')).not.toBeNull();
    });
  });
});
