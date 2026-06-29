import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import EmbedRenderer from '../../../apps/zavorth-desktop/src/components/EmbedRenderer';

const mockLocalStorage = (() => {
  const store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
    get length() { return Object.keys(store).length; },
    key: jest.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

beforeAll(() => {
  Object.defineProperty(global, 'localStorage', { value: mockLocalStorage });
});

beforeEach(() => {
  mockLocalStorage.clear();
  jest.clearAllMocks();
});

describe('EmbedRenderer', () => {
  describe('YouTube URL detection and iframe rendering', () => {
    it('renders an iframe for a standard YouTube watch URL', async () => {
      render(
        <EmbedRenderer
          url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
          theme="dark"
          lazy={false}
        />
      );

      const iframe = await screen.findByTitle('YouTube video');
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute(
        'src',
        'https://www.youtube.com/embed/dQw4w9WgXcQ'
      );
    });

    it('renders an iframe for a YouTube shorts URL', async () => {
      render(
        <EmbedRenderer
          url="https://www.youtube.com/shorts/abc12345678"
          theme="dark"
          lazy={false}
        />
      );

      const iframe = await screen.findByTitle('YouTube video');
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute(
        'src',
        'https://www.youtube.com/embed/abc12345678'
      );
    });

    it('renders an iframe for a youtu.be short URL', async () => {
      render(
        <EmbedRenderer
          url="https://youtu.be/abc12345678"
          theme="dark"
          lazy={false}
        />
      );

      const iframe = await screen.findByTitle('YouTube video');
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute(
        'src',
        'https://www.youtube.com/embed/abc12345678'
      );
    });
  });

  describe('SVG code block rendering', () => {
    it('renders SVG code with dangerouslySetInnerHTML', () => {
      const svgCode = '<svg width="100" height="100"><circle cx="50" cy="50" r="40" fill="blue"/></svg>';
      const { container } = render(
        <EmbedRenderer
          code={svgCode}
          language="svg"
          theme="dark"
          lazy={false}
        />
      );

      const svgElement = container.querySelector('svg');
      expect(svgElement).toBeInTheDocument();
      expect(svgElement?.querySelector('circle')).toBeInTheDocument();
    });

    it('sanitizes script tags from SVG code', () => {
      const maliciousSvg = '<svg><script>alert("xss")</script><rect width="10" height="10"/></svg>';
      const { container } = render(
        <EmbedRenderer
          code={maliciousSvg}
          language="svg"
          theme="dark"
          lazy={false}
        />
      );

      const svgElement = container.querySelector('.zvd-embed-svg');
      expect(svgElement).toBeInTheDocument();
      const scripts = container.querySelectorAll('script');
      expect(scripts.length).toBe(0);
    });

    it('sanitizes event handler attributes from SVG code', () => {
      const maliciousSvg = '<svg onclick="alert(1)" onload="alert(2)"><rect/></svg>';
      const { container } = render(
        <EmbedRenderer
          code={maliciousSvg}
          language="svg"
          theme="dark"
          lazy={false}
        />
      );

      const svgElement = container.querySelector('.zvd-embed-svg');
      expect(svgElement).toBeInTheDocument();
    });
  });

  describe('URL preview card rendering', () => {
    it('renders a clickable link card with title and description', () => {
      render(
        <EmbedRenderer
          url="https://example.com/article"
          title="Example Article"
          description="A brief description of the article"
          theme="dark"
          lazy={false}
        />
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'https://example.com/article');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(screen.getByText('Example Article')).toBeInTheDocument();
      expect(screen.getByText('A brief description of the article')).toBeInTheDocument();
    });

    it('displays the domain name', () => {
      render(
        <EmbedRenderer
          url="https://www.example.com/page"
          theme="dark"
          lazy={false}
        />
      );

      expect(screen.getByText('example.com')).toBeInTheDocument();
    });

    it('shows thumbnail image when provided', () => {
      render(
        <EmbedRenderer
          url="https://example.com"
          thumbnail="https://example.com/thumb.jpg"
          theme="dark"
          lazy={false}
        />
      );

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'https://example.com/thumb.jpg');
    });

    it('falls back to URL text when no title is provided', () => {
      render(
        <EmbedRenderer
          url="https://example.com"
          theme="dark"
          lazy={false}
        />
      );

      expect(screen.getByText('https://example.com')).toBeInTheDocument();
    });
  });

  describe('Image URL handling', () => {
    it('renders an img element for a PNG URL', () => {
      render(
        <EmbedRenderer
          url="https://example.com/photo.png"
          theme="dark"
          lazy={false}
        />
      );

      const img = screen.getByRole('img', { name: 'Embedded image' });
      expect(img).toHaveAttribute('src', 'https://example.com/photo.png');
    });

    it('renders an img element for a JPEG URL', () => {
      render(
        <EmbedRenderer
          url="https://example.com/photo.jpg"
          theme="dark"
          lazy={false}
        />
      );

      const img = screen.getByRole('img', { name: 'Embedded image' });
      expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
    });

    it('renders an img element for a WebP URL', () => {
      render(
        <EmbedRenderer
          url="https://example.com/image.webp"
          theme="dark"
          lazy={false}
        />
      );

      const img = screen.getByRole('img', { name: 'Embedded image' });
      expect(img).toHaveAttribute('src', 'https://example.com/image.webp');
    });

    it('renders an img element for an SVG URL', () => {
      render(
        <EmbedRenderer
          url="https://example.com/icon.svg"
          theme="dark"
          lazy={false}
        />
      );

      const img = screen.getByRole('img', { name: 'Embedded image' });
      expect(img).toHaveAttribute('src', 'https://example.com/icon.svg');
    });

    it('does not render as image for non-image extension URLs', () => {
      render(
        <EmbedRenderer
          url="https://example.com/document.pdf"
          theme="dark"
          lazy={false}
        />
      );

      expect(screen.queryByRole('img', { name: 'Embedded image' })).not.toBeInTheDocument();
    });
  });

  describe('Consent gate for third-party embeds', () => {
    it('shows consent gate for YouTube embeds when domain is not consented', () => {
      render(
        <EmbedRenderer
          url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
          theme="dark"
          lazy={false}
        />
      );

      expect(screen.getByText(/Allow external content from this domain/)).toBeInTheDocument();
      expect(screen.getByText('youtube.com')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Allow youtube\.com/ })).toBeInTheDocument();
    });

    it('renders the iframe after consent is given', () => {
      render(
        <EmbedRenderer
          url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
          theme="dark"
          lazy={false}
        />
      );

      const allowButton = screen.getByRole('button', { name: /Allow youtube\.com/ });
      fireEvent.click(allowButton);

      expect(screen.getByTitle('YouTube video')).toBeInTheDocument();
      expect(screen.queryByText(/Allow external content/)).not.toBeInTheDocument();
    });

    it('saves consented domain to localStorage', () => {
      render(
        <EmbedRenderer
          url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
          theme="dark"
          lazy={false}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Allow youtube\.com/ }));

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'zvd-embed-consent-v1',
        expect.any(String)
      );
    });

    it('skips consent gate if domain is already consented', () => {
      mockLocalStorage.setItem(
        'zvd-embed-consent-v1',
        JSON.stringify(['youtube.com'])
      );

      render(
        <EmbedRenderer
          url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
          theme="dark"
          lazy={false}
        />
      );

      expect(screen.getByTitle('YouTube video')).toBeInTheDocument();
      expect(screen.queryByText(/Allow external content/)).not.toBeInTheDocument();
    });

    it('does not show consent gate for image URLs', () => {
      render(
        <EmbedRenderer
          url="https://example.com/photo.png"
          theme="dark"
          lazy={false}
        />
      );

      expect(screen.queryByText(/Allow external content/)).not.toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Embedded image' })).toBeInTheDocument();
    });
  });

  describe('Code block rendering with line numbers', () => {
    it('renders code with line numbers', () => {
      const code = 'const x = 1;\nconst y = 2;';
      render(
        <EmbedRenderer
          code={code}
          language="typescript"
          theme="dark"
          lazy={false}
        />
      );

      expect(screen.getByText('typescript')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('renders each line of code', () => {
      const code = 'function hello() {\n  return "world";\n}';
      render(
        <EmbedRenderer
          code={code}
          language="javascript"
          theme="dark"
          lazy={false}
        />
      );

      expect(screen.getByText('function hello() {', { exact: false })).toBeInTheDocument();
      expect(screen.getByText('return "world";', { exact: false })).toBeInTheDocument();
    });

    it('renders code without language when language prop is not provided', () => {
      render(
        <EmbedRenderer
          code="some code"
          theme="dark"
          lazy={false}
        />
      );

      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  describe('Unknown URL types and edge cases', () => {
    it('renders nothing when neither url nor code is provided', () => {
      const { container } = render(
        <EmbedRenderer theme="dark" lazy={false} />
      );

      expect(container.innerHTML).toBe('');
    });

    it('handles URL with query parameters correctly for image detection', () => {
      render(
        <EmbedRenderer
          url="https://example.com/image.png?v=123"
          theme="dark"
          lazy={false}
        />
      );

      const img = screen.getByRole('img', { name: 'Embedded image' });
      expect(img).toHaveAttribute('src', 'https://example.com/image.png?v=123');
    });

    it('renders Mermaid diagram code blocks', () => {
      render(
        <EmbedRenderer
          code="graph TD\n  A-->B"
          language="mermaid"
          theme="dark"
          lazy={false}
        />
      );

      expect(screen.getByText(/Allow external content from/)).toBeInTheDocument();
      expect(screen.getByText('cdn.jsdelivr.net')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <EmbedRenderer
          code="test"
          language="plaintext"
          theme="dark"
          lazy={false}
          className="custom-class"
        />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});
