import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from 'react';

type ZavorthPaneShellProps = {
  children: ReactNode;
  className?: string;
  dataThemeAccentVar?: string;
  style?: React.CSSProperties;
};

type ZavorthPaneProps = {
  children: ReactNode;
  collapsed?: boolean;
  collapsedWidth?: number;
  defaultWidth?: number;
  id: string;
  maxWidth?: number;
  minWidth?: number;
  open?: boolean;
  resizable?: boolean;
  side: 'left' | 'right';
  width?: number;
  onWidthChange?: (width: number) => void;
};

export function ZavorthPaneShell({ children, className = '', dataThemeAccentVar, style }: ZavorthPaneShellProps) {
  return (
    <main className={`zvd-pane-shell zavorth-pane-shell ${className}`} data-theme-accent-var={dataThemeAccentVar} style={style}>
      {children}
    </main>
  );
}

export function ZavorthPaneMain({ children }: { children: ReactNode }) {
  return (
    <section className="zvd-pane-main" aria-label="Zavorth main workspace">
      {children}
    </section>
  );
}

export function ZavorthPane({
  children,
  collapsed = false,
  collapsedWidth = 56,
  defaultWidth = 280,
  id,
  maxWidth = 600,
  minWidth = 180,
  open = true,
  resizable = true,
  side,
  width,
  onWidthChange,
}: ZavorthPaneProps) {
  const [localWidth, setLocalWidth] = useState(defaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const currentWidth = width ?? localWidth;
  const effectiveWidth = collapsed ? collapsedWidth : currentWidth;

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      const direction = side === 'left' ? 1 : -1;
      const delta = (event.clientX - startXRef.current) * direction;
      const nextWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + delta));
      if (onWidthChange) {
        onWidthChange(nextWidth);
      } else {
        setLocalWidth(nextWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, maxWidth, minWidth, onWidthChange, side]);

  if (!open) {
    return null;
  }

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
    startXRef.current = event.clientX;
    startWidthRef.current = effectiveWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <aside
      className={`zvd-pane-region zvd-pane-${side} zavorth-pane ${collapsed ? 'is-collapsed' : ''} ${isDragging ? 'is-resizing' : ''}`}
      data-pane-id={id}
      style={{ width: `${effectiveWidth}px` }}
    >
      <div className="zvd-pane-content">{children}</div>
      {resizable && !collapsed && (
        <div
          aria-label={`Resize ${id} pane`}
          className="zvd-pane-sash"
          onMouseDown={handleMouseDown}
          role="separator"
        />
      )}
    </aside>
  );
}
