import { type MouseEvent as ReactMouseEvent, type ReactNode, useEffect, useRef, useState } from 'react';

type PaneProps = {
  children: ReactNode;
  width: number;
  onWidthChange: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
  side: 'left' | 'right';
  collapsed?: boolean;
  resizable?: boolean;
};

export function Pane({
  children,
  width,
  onWidthChange,
  minWidth = 180,
  maxWidth = 600,
  side,
  collapsed = false,
  resizable = true,
}: PaneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const deltaX = e.clientX - startXRef.current;
      const direction = side === 'left' ? 1 : -1;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + deltaX * direction));
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
  }, [isDragging, side, minWidth, maxWidth, onWidthChange]);

  const handleMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const currentWidth = collapsed ? 56 : width;

  const style: React.CSSProperties = {
    width: `${currentWidth}px`,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    flexShrink: 0,
    transition: isDragging ? 'none' : 'width 150ms ease-out',
  };

  return (
    <div style={style} className={`zvd-pane zvd-pane-${side} ${collapsed ? 'is-collapsed' : ''} ${isDragging ? 'is-resizing' : ''}`}>
      <div className="zvd-pane-content" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        {children}
      </div>
      {resizable && !collapsed && (
        <div
          onMouseDown={handleMouseDown}
          className="zvd-sash"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: '4px',
            cursor: 'col-resize',
            zIndex: 10,
            [side === 'left' ? 'right' : 'left']: '-2px',
          }}
        />
      )}
    </div>
  );
}
