import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import KeyboardShortcutsPanel from '../src/components/KeyboardShortcutsPanel';

vi.mock('@tabler/icons-react', () => ({
  IconSearch: (props: any) => <span data-testid="icon-search" {...props} />,
  IconX: (props: any) => <span data-testid="icon-x" {...props} />,
  IconKeyboard: (props: any) => <span data-testid="icon-keyboard" {...props} />,
}));

const GROUPS = [
  'Navigation',
  'Chat',
  'Terminal',
  'General',
];

function renderPanel(overrides: Partial<React.ComponentProps<typeof KeyboardShortcutsPanel>> = {}) {
  const onClose = vi.fn();
  return {
    onClose,
    ...render(
      <KeyboardShortcutsPanel isOpen={true} onClose={onClose} {...overrides} />
    ),
  };
}

beforeEach(() => {
  cleanup();
});

afterEach(() => {
  cleanup();
});

describe('KeyboardShortcutsPanel', () => {
  describe('Rendering shortcut groups', () => {
    it('renders all four shortcut groups', () => {
      renderPanel();
      GROUPS.forEach(title => {
        expect(screen.getAllByText(title).length).toBeGreaterThanOrEqual(1);
      });
    });

    it('renders group title elements with the correct class', () => {
      renderPanel();
      const titles = screen.getAllByText('Navigation');
      expect(titles[0]).toHaveClass('zvd-shortcuts-group-title');
    });

    it('renders the correct number of shortcut rows for Navigation group', () => {
      renderPanel();
      const navGroup = screen.getAllByText('Navigation')[0].closest('.zvd-shortcuts-group')!;
      const rows = within(navGroup).getAllByText(/.+/).filter(el => el.closest('.zvd-shortcuts-row'));
      expect(rows.length).toBeGreaterThanOrEqual(4);
    });

    it('renders description text for each shortcut', () => {
      renderPanel();
      expect(screen.getByText('Command Palette')).toBeInTheDocument();
      expect(screen.getByText('Toggle Sidebar')).toBeInTheDocument();
      expect(screen.getByText('Toggle Terminal')).toBeInTheDocument();
      expect(screen.getByText('Open Settings')).toBeInTheDocument();
      expect(screen.getByText('Send Message')).toBeInTheDocument();
      expect(screen.getByText('Show Shortcuts')).toBeInTheDocument();
      expect(screen.getByText('Quit Application')).toBeInTheDocument();
    });

    it('groups shortcuts correctly under their parent titles', () => {
      renderPanel();
      const chatGroup = screen.getAllByText('Chat')[0].closest('.zvd-shortcuts-group')!;
      const chatDescs = within(chatGroup).queryAllByText(/Send Message|New Line|Execute Command|Navigate History/);
      expect(chatDescs.length).toBe(4);

      const termGroup = screen.getAllByText('Terminal')[0].closest('.zvd-shortcuts-group')!;
      const termDescs = within(termGroup).queryAllByText(/Toggle Terminal|Interrupt Process|Clear Terminal/);
      expect(termDescs.length).toBe(3);
    });
  });

  describe('Kbd chips', () => {
    it('renders kbd elements for key combinations', () => {
      renderPanel();
      const kbdElements = document.querySelectorAll('.zvd-kbd-chip');
      expect(kbdElements.length).toBeGreaterThan(0);
    });

    it('renders "Ctrl" and "K" kbd chips for Command Palette shortcut', () => {
      renderPanel();
      const allKbd = Array.from(document.querySelectorAll('.zvd-kbd-chip'));
      expect(allKbd.some(kbd => kbd.textContent === 'Ctrl')).toBe(true);
      expect(allKbd.some(kbd => kbd.textContent === 'K')).toBe(true);
    });

    it('renders single-key shortcuts like "?" and "Esc"', () => {
      renderPanel();
      const allKbd = Array.from(document.querySelectorAll('.zvd-kbd-chip'));
      expect(allKbd.some(kbd => kbd.textContent === '?')).toBe(true);
      expect(allKbd.some(kbd => kbd.textContent === 'Esc')).toBe(true);
    });

    it('renders "+" separator between combined keys', () => {
      renderPanel();
      const separators = document.querySelectorAll('.zvd-shortcuts-keys span[style*="contents"]');
      expect(separators.length).toBeGreaterThan(0);
    });

    it('renders arrow key shortcuts', () => {
      renderPanel();
      const allKbd = Array.from(document.querySelectorAll('.zvd-kbd-chip'));
      expect(allKbd.some(kbd => kbd.textContent === '↑')).toBe(true);
      expect(allKbd.some(kbd => kbd.textContent === '↓')).toBe(true);
    });
  });

  describe('Search filtering', () => {
    it('shows all groups when search is empty', () => {
      renderPanel();
      GROUPS.forEach(title => {
        expect(screen.getByText(title)).toBeInTheDocument();
      });
    });

    it('filters shortcuts by description text', async () => {
      const user = userEvent.setup();
      renderPanel();
      const input = screen.getByPlaceholderText('Search shortcuts...');
      await user.type(input, 'sidebar');

      expect(screen.getByText('Toggle Sidebar')).toBeInTheDocument();
      expect(screen.queryByText('Command Palette')).not.toBeInTheDocument();
      expect(screen.queryByText('Send Message')).not.toBeInTheDocument();
    });

    it('filters shortcuts by key name', async () => {
      const user = userEvent.setup();
      renderPanel();
      const input = screen.getByPlaceholderText('Search shortcuts...');
      await user.type(input, 'ctrl');

      const descEls = screen.getAllByText(/.+/).filter(el => el.closest('.zvd-shortcuts-desc'));
      const visibleDescs = descEls.filter(el => el.closest('.zvd-shortcuts-row'));
      expect(visibleDescs.length).toBeGreaterThanOrEqual(1);
    });

    it('filters case-insensitively', async () => {
      const user = userEvent.setup();
      renderPanel();
      const input = screen.getByPlaceholderText('Search shortcuts...');
      await user.type(input, 'NAVIGATION');

      expect(screen.getByText('Navigation')).toBeInTheDocument();
    });

    it('hides groups with no matching shortcuts', async () => {
      const user = userEvent.setup();
      renderPanel();
      const input = screen.getByPlaceholderText('Search shortcuts...');
      await user.type(input, 'sidebar');

      expect(screen.queryByText('General')).not.toBeInTheDocument();
      expect(screen.queryByText('Chat')).not.toBeInTheDocument();
    });

    it('clears filter when search input is cleared', async () => {
      const user = userEvent.setup();
      renderPanel();
      const input = screen.getByPlaceholderText('Search shortcuts...');

      await user.type(input, 'sidebar');
      expect(screen.queryByText('Command Palette')).not.toBeInTheDocument();

      await user.clear(input);
      GROUPS.forEach(title => {
        expect(screen.getByText(title)).toBeInTheDocument();
      });
    });
  });

  describe('Empty search results', () => {
    it('shows empty state message when no shortcuts match', async () => {
      const user = userEvent.setup();
      renderPanel();
      const input = screen.getByPlaceholderText('Search shortcuts...');
      await user.type(input, 'zzzznonexistent');

      expect(screen.getByText('No shortcuts match your search.')).toBeInTheDocument();
    });

    it('does not render any group titles when no shortcuts match', async () => {
      const user = userEvent.setup();
      renderPanel();
      const input = screen.getByPlaceholderText('Search shortcuts...');
      await user.type(input, 'zzzznonexistent');

      GROUPS.forEach(title => {
        expect(screen.queryByText(title)).not.toBeInTheDocument();
      });
    });

    it('renders empty state with the correct class', async () => {
      const user = userEvent.setup();
      renderPanel();
      const input = screen.getByPlaceholderText('Search shortcuts...');
      await user.type(input, 'zzzznonexistent');

      const emptyEl = screen.getByText('No shortcuts match your search.');
      expect(emptyEl).toHaveClass('zvd-shortcuts-empty');
    });
  });

  describe('Close behavior', () => {
    it('returns null when isOpen is false', () => {
      const { container } = render(
        <KeyboardShortcutsPanel isOpen={false} onClose={vi.fn()} />
      );
      expect(container.innerHTML).toBe('');
    });

    it('calls onClose when Escape key is pressed', () => {
      const { onClose } = renderPanel();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when the close button is clicked', async () => {
      const user = userEvent.setup();
      const { onClose } = renderPanel();
      const closeBtn = screen.getByRole('button', { name: 'Close' });
      await user.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking the backdrop overlay', async () => {
      const user = userEvent.setup();
      const { onClose } = renderPanel();
      const overlay = document.querySelector('.zvd-shortcuts-overlay')!;
      await user.click(overlay);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onClose when clicking inside the panel', async () => {
      const user = userEvent.setup();
      const { onClose } = renderPanel();
      const panel = screen.getByRole('dialog');
      await user.click(panel);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('does NOT call onClose when pressing keys other than Escape', () => {
      const { onClose } = renderPanel();
      fireEvent.keyDown(document, { key: 'a' });
      fireEvent.keyDown(document, { key: 'Enter' });
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('ARIA attributes', () => {
    it('panel has role="dialog"', () => {
      renderPanel();
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });

    it('panel has aria-modal="true"', () => {
      renderPanel();
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('panel has aria-label="Keyboard Shortcuts"', () => {
      renderPanel();
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-label', 'Keyboard Shortcuts');
    });

    it('search input has aria-label="Search shortcuts"', () => {
      renderPanel();
      const input = screen.getByLabelText('Search shortcuts');
      expect(input).toBeInTheDocument();
    });

    it('close button has aria-label="Close"', () => {
      renderPanel();
      const btn = screen.getByRole('button', { name: 'Close' });
      expect(btn).toHaveAttribute('aria-label', 'Close');
    });
  });

  describe('Search input behavior', () => {
    it('renders a search input with placeholder text', () => {
      renderPanel();
      expect(screen.getByPlaceholderText('Search shortcuts...')).toBeInTheDocument();
    });

    it('search input has the correct class', () => {
      renderPanel();
      const input = screen.getByPlaceholderText('Search shortcuts...');
      expect(input).toHaveClass('zvd-shortcuts-search-input');
    });

    it('search input is focusable', async () => {
      const user = userEvent.setup();
      renderPanel();
      const input = screen.getByPlaceholderText('Search shortcuts...');
      await user.click(input);
      expect(input).toHaveFocus();
    });
  });

  describe('Header rendering', () => {
    it('renders the "Keyboard Shortcuts" heading', () => {
      renderPanel();
      expect(screen.getByRole('heading', { name: 'Keyboard Shortcuts' })).toBeInTheDocument();
    });

    it('renders the keyboard icon in the header', () => {
      renderPanel();
      expect(screen.getByTestId('icon-keyboard')).toBeInTheDocument();
    });

    it('renders the close button with an X icon', () => {
      renderPanel();
      expect(screen.getByTestId('icon-x')).toBeInTheDocument();
    });

    it('renders the search icon', () => {
      renderPanel();
      expect(screen.getByTestId('icon-search')).toBeInTheDocument();
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
      renderPanel();
      const overlay = document.querySelector('.zvd-shortcuts-overlay')!;
      const panel = within(overlay).getByRole('dialog');
      expect(panel).toBeInTheDocument();
    });

    it('panel has the correct class', () => {
      renderPanel();
      const panel = screen.getByRole('dialog');
      expect(panel).toHaveClass('zvd-shortcuts-panel');
    });

    it('renders the header section', () => {
      renderPanel();
      const header = document.querySelector('.zvd-shortcuts-header');
      expect(header).toBeInTheDocument();
    });

    it('renders the search wrapper section', () => {
      renderPanel();
      const searchWrapper = document.querySelector('.zvd-shortcuts-search-wrapper');
      expect(searchWrapper).toBeInTheDocument();
    });

    it('renders the body section', () => {
      renderPanel();
      const body = document.querySelector('.zvd-shortcuts-body');
      expect(body).toBeInTheDocument();
    });

    it('renders a style element for inline styles', () => {
      renderPanel();
      const styleEl = document.querySelector('.zvd-shortcuts-overlay style');
      expect(styleEl).toBeInTheDocument();
    });
  });
});
