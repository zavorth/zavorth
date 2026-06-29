import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import InlineCodeEditor from '../../../apps/zavorth-desktop/src/components/InlineCodeEditor';

function createKeyboardEvent(
  key: string,
  options: Partial<React.KeyboardEvent> = {}
): React.KeyboardEvent<HTMLTextAreaElement> {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: jest.fn(),
    ...options,
  } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;
}

describe('InlineCodeEditor', () => {
  const defaultProps = {
    value: 'hello world',
    onChange: jest.fn(),
    onSave: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Line numbers rendering', () => {
    it('renders line numbers for a single line', () => {
      render(<InlineCodeEditor {...defaultProps} value="single line" />);
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('renders line numbers for multiple lines', () => {
      render(<InlineCodeEditor {...defaultProps} value="line1\nline2\nline3" />);
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('renders correct line count for code with many lines', () => {
      const code = Array.from({ length: 5 }, (_, i) => `line ${i + 1}`).join('\n');
      render(<InlineCodeEditor {...defaultProps} value={code} />);
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  describe('Tab key for indentation', () => {
    it('inserts two-space indent on Tab key press', () => {
      const onChange = jest.fn();
      render(<InlineCodeEditor {...defaultProps} value="code" onChange={onChange} />);

      const textarea = screen.getByRole('textbox');
      const event = createKeyboardEvent('Tab');
      Object.defineProperty(textarea, 'selectionStart', { value: 4, writable: true });
      Object.defineProperty(textarea, 'selectionEnd', { value: 4, writable: true });

      act(() => {
        fireEvent.keyDown(textarea, event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith('code  ');
    });

    it('dedents selected lines on Shift+Tab', () => {
      const onChange = jest.fn();
      render(
        <InlineCodeEditor
          {...defaultProps}
          value="  line1\n  line2"
          onChange={onChange}
        />
      );

      const textarea = screen.getByRole('textbox');
      const event = createKeyboardEvent('Tab', { shiftKey: true });
      Object.defineProperty(textarea, 'selectionStart', { value: 0, writable: true });
      Object.defineProperty(textarea, 'selectionEnd', { value: 14, writable: true });

      act(() => {
        fireEvent.keyDown(textarea, event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith('line1\nline2');
    });
  });

  describe('Ctrl+S for save', () => {
    it('calls onSave when Ctrl+S is pressed', () => {
      const onSave = jest.fn();
      render(<InlineCodeEditor {...defaultProps} onSave={onSave} />);

      const textarea = screen.getByRole('textbox');
      const event = createKeyboardEvent('s', { ctrlKey: true });

      act(() => {
        fireEvent.keyDown(textarea, event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(onSave).toHaveBeenCalledWith('hello world');
    });

    it('calls onSave with Cmd+S (metaKey) on macOS', () => {
      const onSave = jest.fn();
      render(<InlineCodeEditor {...defaultProps} onSave={onSave} />);

      const textarea = screen.getByRole('textbox');
      const event = createKeyboardEvent('s', { metaKey: true });

      act(() => {
        fireEvent.keyDown(textarea, event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(onSave).toHaveBeenCalledWith('hello world');
    });
  });

  describe('Esc for cancel', () => {
    it('calls onCancel when Escape is pressed', () => {
      const onCancel = jest.fn();
      render(<InlineCodeEditor {...defaultProps} onCancel={onCancel} />);

      const textarea = screen.getByRole('textbox');
      const event = createKeyboardEvent('Escape');

      act(() => {
        fireEvent.keyDown(textarea, event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Language detection from filename', () => {
    it('detects JavaScript from .js extension', () => {
      render(
        <InlineCodeEditor {...defaultProps} filename="app.js" />
      );
      expect(screen.getByText('javascript')).toBeInTheDocument();
    });

    it('detects TypeScript from .ts extension', () => {
      render(
        <InlineCodeEditor {...defaultProps} filename="utils.ts" />
      );
      expect(screen.getByText('typescript')).toBeInTheDocument();
    });

    it('detects Python from .py extension', () => {
      render(
        <InlineCodeEditor {...defaultProps} filename="script.py" />
      );
      expect(screen.getByText('python')).toBeInTheDocument();
    });

    it('detects Rust from .rs extension', () => {
      render(
        <InlineCodeEditor {...defaultProps} filename="main.rs" />
      );
      expect(screen.getByText('rust')).toBeInTheDocument();
    });

    it('detects Go from .go extension', () => {
      render(
        <InlineCodeEditor {...defaultProps} filename="server.go" />
      );
      expect(screen.getByText('go')).toBeInTheDocument();
    });

    it('detects HTML from .html extension', () => {
      render(
        <InlineCodeEditor {...defaultProps} filename="index.html" />
      );
      expect(screen.getByText('html')).toBeInTheDocument();
    });

    it('detects CSS from .css extension', () => {
      render(
        <InlineCodeEditor {...defaultProps} filename="styles.css" />
      );
      expect(screen.getByText('css')).toBeInTheDocument();
    });

    it('detects JSX from .jsx extension', () => {
      render(
        <InlineCodeEditor {...defaultProps} filename="Component.jsx" />
      );
      expect(screen.getByText('javascript')).toBeInTheDocument();
    });

    it('detects TSX from .tsx extension', () => {
      render(
        <InlineCodeEditor {...defaultProps} filename="App.tsx" />
      );
      expect(screen.getByText('typescript')).toBeInTheDocument();
    });

    it('detects JSON from .json extension', () => {
      render(
        <InlineCodeEditor {...defaultProps} filename="config.json" />
      );
      expect(screen.getByText('json')).toBeInTheDocument();
    });

    it('detects Markdown from .md extension', () => {
      render(
        <InlineCodeEditor {...defaultProps} filename="README.md" />
      );
      expect(screen.getByText('markdown')).toBeInTheDocument();
    });

    it('detects SQL from .sql extension', () => {
      render(
        <InlineCodeEditor {...defaultProps} filename="query.sql" />
      );
      expect(screen.getByText('sql')).toBeInTheDocument();
    });

    it('detects Bash from .sh extension', () => {
      render(
        <InlineCodeEditor {...defaultProps} filename="deploy.sh" />
      );
      expect(screen.getByText('bash')).toBeInTheDocument();
    });

    it('detects XML from .xml extension', () => {
      render(
        <InlineCodeEditor {...defaultProps} filename="data.xml" />
      );
      expect(screen.getByText('xml')).toBeInTheDocument();
    });

    it('detects CSV from .csv extension', () => {
      render(
        <InlineCodeEditor {...defaultProps} filename="export.csv" />
      );
      expect(screen.getByText('csv')).toBeInTheDocument();
    });

    it('uses explicit language prop over filename detection', () => {
      render(
        <InlineCodeEditor
          {...defaultProps}
          filename="file.txt"
          language="python"
        />
      );
      expect(screen.getByText('python')).toBeInTheDocument();
    });

    it('falls back to plaintext for unknown extension', () => {
      render(
        <InlineCodeEditor {...defaultProps} filename="file.xyz" />
      );
      expect(screen.getByText('plaintext')).toBeInTheDocument();
    });

    it('shows filename when provided', () => {
      render(
        <InlineCodeEditor {...defaultProps} filename="app.tsx" />
      );
      expect(screen.getByText('app.tsx')).toBeInTheDocument();
    });
  });

  describe('Undo/Redo support', () => {
    it('undoes the last change with Ctrl+Z', () => {
      const onChange = jest.fn();
      render(<InlineCodeEditor {...defaultProps} value="initial" onChange={onChange} />);

      const textarea = screen.getByRole('textbox');

      act(() => {
        fireEvent.change(textarea, { target: { value: 'modified' } });
      });

      act(() => {
        fireEvent.keyDown(textarea, createKeyboardEvent('z', { ctrlKey: true }));
      });

      expect(onChange).toHaveBeenLastCalledWith('initial');
    });

    it('redoes with Ctrl+Y', () => {
      const onChange = jest.fn();
      const { rerender } = render(
        <InlineCodeEditor {...defaultProps} value="initial" onChange={onChange} />
      );

      const textarea = screen.getByRole('textbox');

      act(() => {
        fireEvent.change(textarea, { target: { value: 'modified' } });
      });

      rerender(
        <InlineCodeEditor {...defaultProps} value="modified" onChange={onChange} />
      );

      act(() => {
        fireEvent.keyDown(textarea, createKeyboardEvent('z', { ctrlKey: true }));
      });

      act(() => {
        fireEvent.keyDown(textarea, createKeyboardEvent('y', { ctrlKey: true }));
      });

      expect(onChange).toHaveBeenLastCalledWith('modified');
    });

    it('redoes with Ctrl+Shift+Z', () => {
      const onChange = jest.fn();
      const { rerender } = render(
        <InlineCodeEditor {...defaultProps} value="initial" onChange={onChange} />
      );

      const textarea = screen.getByRole('textbox');

      act(() => {
        fireEvent.change(textarea, { target: { value: 'modified' } });
      });

      rerender(
        <InlineCodeEditor {...defaultProps} value="modified" onChange={onChange} />
      );

      act(() => {
        fireEvent.keyDown(textarea, createKeyboardEvent('z', { ctrlKey: true }));
      });

      act(() => {
        fireEvent.keyDown(textarea, createKeyboardEvent('z', { ctrlKey: true, shiftKey: true }));
      });

      expect(onChange).toHaveBeenLastCalledWith('modified');
    });
  });

  describe('Line count display', () => {
    it('shows "1 line" for single-line content', () => {
      render(<InlineCodeEditor {...defaultProps} value="single" />);
      expect(screen.getByText('1 line')).toBeInTheDocument();
    });

    it('shows "N lines" for multi-line content', () => {
      render(<InlineCodeEditor {...defaultProps} value="a\nb\nc" />);
      expect(screen.getByText('3 lines')).toBeInTheDocument();
    });
  });

  describe('Empty content handling', () => {
    it('renders with empty value without crashing', () => {
      render(<InlineCodeEditor {...defaultProps} value="" />);
      expect(screen.getByText('1 line')).toBeInTheDocument();
    });

    it('shows placeholder text for empty content', () => {
      render(<InlineCodeEditor {...defaultProps} value="" />);
      expect(screen.getByPlaceholderText('Write code here...')).toBeInTheDocument();
    });

    it('shows custom placeholder when provided', () => {
      render(
        <InlineCodeEditor
          {...defaultProps}
          value=""
          placeholder="Enter your code..."
        />
      );
      expect(screen.getByPlaceholderText('Enter your code...')).toBeInTheDocument();
    });
  });

  describe('Read-only mode', () => {
    it('hides save and cancel buttons in read-only mode', () => {
      render(<InlineCodeEditor {...defaultProps} readOnly />);
      expect(screen.queryByText('Save')).not.toBeInTheDocument();
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });

    it('textarea is read-only when readOnly is true', () => {
      render(<InlineCodeEditor {...defaultProps} readOnly />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('readOnly');
    });
  });

  describe('Theme support', () => {
    it('applies dark theme class by default', () => {
      const { container } = render(<InlineCodeEditor {...defaultProps} />);
      expect(container.querySelector('.zvd-inline-editor--dark')).toBeInTheDocument();
    });

    it('applies light theme class when specified', () => {
      const { container } = render(
        <InlineCodeEditor {...defaultProps} theme="light" />
      );
      expect(container.querySelector('.zvd-inline-editor--light')).toBeInTheDocument();
    });
  });
});
